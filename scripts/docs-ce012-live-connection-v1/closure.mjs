import { createHash } from 'node:crypto';

export const SCOPE = 'documents-ce012-runtime-closure.v1';
export const COMPONENTS = ['schemas', 'functions', 'relations', 'columns', 'constraints',
  'triggers', 'policies', 'types', 'roles', 'role_edges', 'effective_acl', 'dependencies', 'defaults'];
const stable = v => JSON.stringify(sort(v));
function sort(v) { return Array.isArray(v) ? v.map(sort) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v; }
export const hash = v => createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : stable(v)).digest('hex');
export class ScopeError extends Error { constructor(code) { super(code); this.code = code; } }
const need = (v, code) => { if (!v) throw new ScopeError(code); };
const digest = x => /^[a-f0-9]{64}$/.test(x ?? '');
const keys = (o, expected, code) => need(o && stable(Object.keys(o).sort()) === stable([...expected].sort()), code);

export function validateClosure(closure, inventory) {
  need(closure.source_base === 'f3b0a7626de1ffcbbe1b01350a252b92c3e841dc'
    && closure.offline_inventory_base === inventory.base && closure.contract === SCOPE && closure.installation_policy === 'catalog-source-lineage-not-global-migration-replay'
    && closure.migration_metadata === 'advisory-only', 'SCOPE_VERSION');
  need(Array.isArray(closure.functions) && closure.functions.length > 0
    && Array.isArray(closure.relations) && closure.relations.length > 0, 'SCOPE_ROOTS_MISSING');
  const source = new Map(inventory.files.map(f => [f.path, f]));
  for (const pin of closure.source_inputs) need(stable(source.get(pin.path)) === stable(pin), 'SCOPE_LINEAGE_SOURCE_MISMATCH');
  const names = new Set();
  for (const f of closure.functions) {
    need(/^[a-z_]\w*\.[a-z_]\w*\([a-z0-9_,[\] ]*\)$/.test(f.signature)
      && !names.has(f.signature), 'FUNCTION_SCOPE_INVALID'); names.add(f.signature);
    if (f.source_kind === 'repository') need(digest(f.body_sha256)
      && source.get(f.source_path)?.sha256 === f.source_sha256
      && closure.source_inputs.some(p => p.path === f.source_path), 'FUNCTION_LINEAGE_MISSING');
    else need(f.source_kind === 'supabase_managed' && ['auth.uid()', 'auth.jwt()'].includes(f.signature), 'UNREVIEWED_MANAGED_FUNCTION');
  }
  need(new Set(closure.relations.map(r => r.name)).size === closure.relations.length
    && closure.relations.every(r => /^[a-z_]\w*\.[a-z_]\w*$/.test(r.name)
      && r.columns.length > 0 && r.columns.every(c => /^[a-z_]\w*$/.test(c))), 'RELATION_SCOPE_INVALID');
  need(stable(closure.compatibility.required_catalog_components) === stable(COMPONENTS)
    && closure.compatibility.unknown_impact === 'BLOCKED'
    && closure.compatibility.guard300 === 'unchanged-canonical-source-and-runtime-safety', 'COMPATIBILITY_SCOPE_INVALID');
  return closure;
}

export function validateCatalog(catalog, closure) {
  keys(catalog, ['present', 'function_bodies', 'digests'], 'CATALOG_EVIDENCE_SHAPE');
  keys(catalog.present, ['functions', 'relations', 'columns', 'triggers', 'rls', 'roles', 'role_edges', 'sequences'], 'CATALOG_PRESENCE_SHAPE');
  for (const [kind, value] of Object.entries(catalog.present)) need(value === true, `REQUIRED_${kind.toUpperCase()}_MISSING`);
  keys(catalog.digests, COMPONENTS, 'CATALOG_COMPONENT_SET');
  need(Object.values(catalog.digests).every(digest), 'CATALOG_COMPONENT_DIGEST_INVALID');
  need(Array.isArray(catalog.function_bodies), 'FUNCTION_BODY_SET_MISMATCH');
  const bodies = new Map(catalog.function_bodies.map(x => [x.signature, x.body_sha256]));
  need(bodies.size === closure.functions.length && catalog.function_bodies.length === bodies.size, 'FUNCTION_BODY_SET_MISMATCH');
  for (const f of closure.functions) need(f.source_kind === 'repository'
    ? bodies.get(f.signature) === f.body_sha256 : digest(bodies.get(f.signature)), 'FUNCTION_SOURCE_PREIMAGE_MISMATCH');
}

export function validateScopedInstallation(installation, closure, closureBytes, inventoryBytes, inventory) {
  keys(installation, ['scope_contract', 'runtime_closure_sha256', 'source_inventory_sha256',
    'catalog_sha256', 'catalog_evidence', 'lineage', 'compatibility', 'observed_migration_versions',
    'fixture_source_sha256', 'platform_lifecycle_source_sha256', 'platform_profile_sha256'], 'SCOPED_INSTALLATION_SHAPE');
  validateClosure(closure, inventory);
  need(installation.scope_contract === SCOPE && installation.runtime_closure_sha256 === hash(closureBytes)
    && installation.source_inventory_sha256 === hash(inventoryBytes), 'SCOPED_INSTALLATION_BINDING');
  need(stable(installation.lineage) === stable(closure.source_inputs), 'SCOPED_SOURCE_LINEAGE_MISMATCH');
  validateCatalog(installation.catalog_evidence, closure);
  need(installation.catalog_sha256 === hash(installation.catalog_evidence), 'SCOPED_CATALOG_SEAL_MISMATCH');
  const c = installation.compatibility;
  keys(c, ['contract', 'closure_sha256', 'unresolved_impacts', 'guard300'], 'COMPATIBILITY_SHAPE');
  need(c.contract === 'documents-ce012-bounded-compatibility.v1' && c.closure_sha256 === hash(closureBytes)
    && Array.isArray(c.unresolved_impacts) && c.unresolved_impacts.length === 0
    && c.guard300 === 'unchanged', 'UNRESOLVED_SCOPED_COMPATIBILITY');
  // Neither the set, count, presence nor absence of unrelated migration versions
  // grants or denies admission. Semantic/source/catalog evidence above is mandatory.
  need(Array.isArray(installation.observed_migration_versions)
    && installation.observed_migration_versions.every(v => /^\d{14}$/.test(v))
    && new Set(installation.observed_migration_versions).size === installation.observed_migration_versions.length, 'MIGRATION_OBSERVATION_SHAPE');
  need(['fixture_source_sha256', 'platform_lifecycle_source_sha256', 'platform_profile_sha256']
    .every(k => digest(installation[k])), 'FIXTURE_PROVENANCE_MISSING');
}

export async function verifyScopedCatalog(observer, installation, closure, principals = []) {
  const result = await observer.query(SCOPED_CATALOG_SQL, [JSON.stringify(closure),
    // Include actually admitted observer/conflict identities in effective ACL and
    // role graph, without ever treating them as provider/current-actor authority.
    principals]);
  const actual = result.rows[0]?.catalog;
  validateCatalog(actual, closure);
  need(hash(actual) === installation.catalog_sha256, 'SCOPED_CATALOG_CHANGED');
}

// Fixed read-only projection. All selectors are data parameters from the
// request-hashed closure, never SQL or shell supplied by the fixture caller.
// Catalog bodies/ACL/lineage preimages stay local; only bounded hashes/presence
// and repository function-body hashes return to the driver.
export const SCOPED_CATALOG_SQL = `with recursive
 cfg as (select $1::jsonb as j),
 fs as (select f, to_regprocedure(f->>'signature')::oid as oid
   from cfg,jsonb_array_elements(j->'functions') f),
 rs as (select r,to_regclass(r->>'name')::oid as oid
   from cfg,jsonb_array_elements(j->'relations') r),
 ss as (select value as name,to_regclass(value)::oid as oid from cfg,jsonb_array_elements_text(j->'sequences')),
 tr as (select t from cfg,jsonb_array_elements(j->'required_triggers') t),
 type_roots as (select atttypid oid from pg_attribute where attrelid in (select oid from rs) and attnum>0 and not attisdropped
   union select prorettype from pg_proc where oid in (select oid from fs)
   union select unnest(coalesce(proallargtypes,proargtypes::oid[])) from pg_proc where oid in (select oid from fs)),
 type_walk(oid) as (select oid from type_roots union
   select d.oid from type_walk w join pg_type t on t.oid=w.oid
   cross join lateral (select t.typelem as oid union select t.typbasetype union
     select atttypid from pg_attribute where attrelid=t.typrelid and attnum>0 and not attisdropped) d where d.oid<>0),
 policy_roots as (select oid from pg_policy where polrelid in (select oid from rs)),
 trigger_roots as (select oid from pg_trigger where tgrelid in (select oid from rs) and not tgisinternal),
 constraint_roots as (select oid from pg_constraint where conrelid in (select oid from rs)),
 seed_dependency_roots as (select 'pg_proc'::regclass::oid classid,oid objid from fs
   union select 'pg_class'::regclass::oid,oid from rs union select 'pg_class'::regclass::oid,oid from ss
   union select 'pg_policy'::regclass::oid,oid from policy_roots
   union select 'pg_trigger'::regclass::oid,oid from trigger_roots
   union select 'pg_constraint'::regclass::oid,oid from constraint_roots
   union select 'pg_attrdef'::regclass::oid,oid from pg_attrdef where adrelid in (select oid from rs)
   union select 'pg_rewrite'::regclass::oid,oid from pg_rewrite where ev_class in (select oid from rs)),
 function_seeds(oid) as (
   select oid from fs
   union select d.refobjid from pg_depend d join seed_dependency_roots x on x.classid=d.classid and x.objid=d.objid where d.refclassid='pg_proc'::regclass
   union select tgfoid from pg_trigger where oid in (select oid from trigger_roots)
   union select unnest(array[typinput,typoutput,typreceive,typsend,typmodin,typmodout,typanalyze])::oid from pg_type where oid in (select oid from type_walk)
   union select unnest(array[o.oprcode,o.oprrest,o.oprjoin])::oid from pg_operator o where o.oid in (
     select d.refobjid from pg_depend d join seed_dependency_roots x on x.classid=d.classid and x.objid=d.objid where d.refclassid='pg_operator'::regclass)
 ), function_walk(oid) as (select oid from function_seeds where oid is not null and oid<>0
   union select d.refobjid from function_walk f join pg_depend d on d.classid='pg_proc'::regclass and d.objid=f.oid where d.refclassid='pg_proc'::regclass
 ), dependency_roots as (select * from seed_dependency_roots union select 'pg_proc'::regclass::oid,oid from function_walk),
 role_roots as (select oid from pg_roles where rolname in
   (select value from cfg,jsonb_array_elements_text(j->'roles')) or rolname=any($2::text[])
   union select relowner from pg_class where oid in (select oid from rs union select oid from ss)
   union select proowner from pg_proc where oid in (select oid from function_walk)),
 role_walk(oid) as (select oid from role_roots union
   select case when a.member=w.oid then a.roleid else a.member end
   from role_walk w join pg_auth_members a on w.oid in (a.member,a.roleid)),
 ns as (select oid from pg_namespace where nspname in
   (select split_part(r->>'name','.',1) from rs union select n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in (select oid from function_walk))),
 effective_rows as (
  select jsonb_build_object('kind','table','role',p.rolname,'object',r->>'name','privilege',v,'allowed',has_table_privilege(p.oid,rs.oid,v)) as value
   from pg_roles p cross join rs cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) v where p.oid in (select oid from role_walk)
  union all select jsonb_build_object('kind','column','role',p.rolname,'object',r->>'name','column',a.attname,'privilege',v,'allowed',has_column_privilege(p.oid,rs.oid,a.attnum,v))
   from pg_roles p cross join rs join pg_attribute a on a.attrelid=rs.oid cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) v
   where p.oid in (select oid from role_walk) and a.attnum>0 and not a.attisdropped
  union all select jsonb_build_object('kind','function','role',p.rolname,'object',fs.oid::regprocedure::text,'allowed',has_function_privilege(p.oid,fs.oid,'EXECUTE'))
   from pg_roles p cross join function_walk fs where p.oid in (select oid from role_walk)
  union all select jsonb_build_object('kind','schema','role',p.rolname,'object',n.nspname,'privilege',v,'allowed',has_schema_privilege(p.oid,n.oid,v))
   from pg_roles p cross join pg_namespace n cross join unnest(array['USAGE','CREATE']) v where p.oid in (select oid from role_walk) and n.oid in (select oid from ns)
  union all select jsonb_build_object('kind','sequence','role',p.rolname,'object',ss.name,'privilege',v,'allowed',has_sequence_privilege(p.oid,ss.oid,v))
   from pg_roles p cross join ss cross join unnest(array['USAGE','SELECT','UPDATE']) v where p.oid in (select oid from role_walk)
 ), parts as (select
 (select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl) order by nspname)
   from pg_namespace where oid in (select oid from ns)) as schemas,
 (select jsonb_agg(jsonb_build_object('identity',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
   'owner',pg_get_userbyid(proowner),'acl',proacl,'config',proconfig) order by p.oid::regprocedure::text)
   from pg_proc p where p.oid in (select oid from function_walk) and p.prokind='f') as functions,
 (select jsonb_agg(jsonb_build_object('name',r->>'name','kind',relkind,'owner',pg_get_userbyid(relowner),
   'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity,'options',reloptions,
   'view',case when relkind='v' then pg_get_viewdef(c.oid,true) else null end) order by r->>'name')
   from rs join pg_class c on c.oid=rs.oid) ||
   coalesce((select jsonb_agg(jsonb_build_object('sequence',ss.name,'owner',pg_get_userbyid(c.relowner),
    'acl',c.relacl,'definition',to_jsonb(q)-'seqrelid') order by ss.name)
    from ss join pg_class c on c.oid=ss.oid join pg_sequence q on q.seqrelid=ss.oid),'[]'::jsonb) as relations,
 (select jsonb_agg(jsonb_build_object('table',r->>'name','column',a.attname,'type',format_type(a.atttypid,a.atttypmod),
   'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl,'identity',a.attidentity,'generated',a.attgenerated)
   order by r->>'name',a.attnum) from rs join pg_attribute a on a.attrelid=rs.oid
   left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped) as columns,
 (select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(c.oid),
   'validated',convalidated,'index',(select jsonb_build_object('valid',indisvalid,'ready',indisready,
    'live',indislive,'unique',indisunique,'exclusion',indisexclusion,'immediate',indimmediate) from pg_index where indexrelid=c.conindid)) order by conrelid::regclass::text,conname) from pg_constraint c where c.oid in (select oid from constraint_roots)) as constraints,
 (select jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(t.oid))
   order by tgrelid::regclass::text,tgname) from pg_trigger t where t.oid in (select oid from trigger_roots)) as triggers,
 (select jsonb_agg(jsonb_build_object('table',polrelid::regclass::text,'name',polname,'roles',polroles,'command',polcmd,
   'permissive',polpermissive,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid))
   order by polrelid::regclass::text,polname) from pg_policy where oid in (select oid from policy_roots)) as policies,
 (select jsonb_agg(jsonb_build_object('name',t.oid::regtype::text,'owner',pg_get_userbyid(typowner),'kind',typtype,
   'base',typbasetype,'element',typelem,'collation',typcollation,'input',typinput,'output',typoutput,'acl',typacl,
   'enum',(select jsonb_agg(enumlabel order by enumsortorder) from pg_enum where enumtypid=t.oid),
   'domain',(select jsonb_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where contypid=t.oid))
   order by t.oid::regtype::text) from pg_type t where oid in (select oid from type_walk)) as types,
 (select jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createdb',rolcreatedb,
   'createrole',rolcreaterole,'login',rolcanlogin,'replication',rolreplication,'bypass',rolbypassrls,'config',rolconfig)
   order by rolname) from pg_roles where oid in (select oid from role_walk)) as roles,
 (select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),
   'grantor',pg_get_userbyid(grantor),'admin',admin_option,'inherit',inherit_option,'set',set_option)
   order by roleid,member,grantor) from pg_auth_members where roleid in (select oid from role_walk) or member in (select oid from role_walk)) as role_edges,
 (select jsonb_agg(value order by value::text) from effective_rows) as effective_acl,
 (select jsonb_agg(jsonb_build_object('from',pg_describe_object(d.classid,d.objid,d.objsubid),
   'to',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'kind',d.deptype)
   order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype)
   from pg_depend d join dependency_roots x on x.classid=d.classid and x.objid=d.objid) as dependencies,
 (select jsonb_agg(to_jsonb(d) order by defaclrole,defaclnamespace,defaclobjtype) from pg_default_acl d
   where defaclrole in (select oid from role_walk) and (defaclnamespace=0 or defaclnamespace in (select oid from ns))) as defaults
 ), component_values as (select key,value from parts,jsonb_each(to_jsonb(parts))),
 present as (select jsonb_build_object(
  'functions',not exists(select 1 from fs where oid is null),
  'relations',not exists(select 1 from rs where oid is null),
  'columns',not exists(select 1 from rs,jsonb_array_elements_text(r->'columns') col where not exists
    (select 1 from pg_attribute where attrelid=rs.oid and attname=col and attnum>0 and not attisdropped)),
  'triggers',not exists(select 1 from tr where not exists(select 1 from pg_trigger where
    tgrelid=to_regclass(t->>'table') and tgname=t->>'name' and tgfoid=to_regprocedure(t->>'function') and tgenabled::text in (select jsonb_array_elements_text(t->'enabled_modes')))),
  'rls',not exists(select 1 from cfg,jsonb_array_elements_text(j->'rls_relations') t where not exists
    (select 1 from pg_class where oid=to_regclass(t) and relrowsecurity)),
  'roles',not exists(select 1 from cfg,jsonb_array_elements_text(j->'roles') r where not exists(select 1 from pg_roles where rolname=r)),
  'role_edges',not exists(select 1 from cfg,jsonb_array_elements(j->'required_role_edges') e where not exists(
    select 1 from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member
    where r.rolname=e->>'role' and u.rolname=e->>'member' and m.admin_option=(e->>'admin')::boolean
      and m.inherit_option=(e->>'inherit')::boolean and m.set_option=(e->>'set')::boolean)),
  'sequences',not exists(select 1 from ss where oid is null or not exists(select 1 from pg_class where oid=ss.oid and relkind='S'))
 ) as value)
 select jsonb_build_object('present',(select value from present),
  'function_bodies',(select jsonb_agg(jsonb_build_object('signature',f->>'signature',
    'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) order by f->>'signature') from fs left join pg_proc p on p.oid=fs.oid),
  'digests',(select jsonb_object_agg(key,encode(sha256(convert_to(value::text,'UTF8')),'hex')) from component_values)) as catalog`;
