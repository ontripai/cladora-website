-- Operations independent inactive install unit: foundation, v1; SOURCE ONLY, NOT EXECUTED.
-- New lineage proposal; does not mark any historical migration applied.
-- Original proof55000/NULL/ROLLBACK files remain unchanged and are NOT installers.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('cladora.install.v14.operations',235));
do $unit_entry$
begin
 if current_user<>'postgres' or session_user<>current_user
  or exists(select 1 from pg_roles where rolname=current_user and rolsuper)
  or current_setting('server_version_num')::integer not between 170000 and 179999
  or current_setting('cladora.install.target',true) is distinct from 'ryygcqiunqqtfkpkflzf'
  or current_setting('cladora.install.unit',true) is distinct from 'foundation' then
  raise exception 'operations_install_prestate_mismatch' using errcode='55000';end if;
 if not has_schema_privilege(current_user,'auth','USAGE')
  or not has_column_privilege(current_user,'auth.users','id','REFERENCES')
  or not has_column_privilege(current_user,'auth.users','id','SELECT')
  or not has_column_privilege(current_user,'auth.users','email','SELECT')
  or not has_column_privilege(current_user,'auth.users','email_confirmed_at','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','id','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','user_id','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','not_after','SELECT') then
  raise exception 'operations_managed_auth_read_or_reference_prerequisite' using errcode='55000';end if;
 if 'foundation'='foundation' and exists(select 1 from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')) then
  raise exception 'operations_fresh_application_state_required' using errcode='55000';end if;
end; $unit_entry$;
select set_config('cladora.install.defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]')::text from pg_default_acl d),true);
select set_config('cladora.install.managed',(select jsonb_build_object(
 'namespaces',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where n.nspname in ('auth','extensions','public')),
 'relations',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')))::text),true);
-- COMPLETE CATALOG OBSERVATION; never a source-only equivalence PASS.
select set_config('cladora.install.catalog_before',(with recursive
 namespaces as (select * from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')),
 roots as (select c.* from pg_class c where c.relnamespace in (select oid from namespaces)),
 relids(oid) as (select oid from roots union select c.reltoastrelid from roots c where c.reltoastrelid<>0
  union select i.indexrelid from pg_index i where i.indrelid in (select reltoastrelid from roots where reltoastrelid<>0)),
 constraints as (select c.* from pg_constraint c where c.conrelid in (select oid from relids) or c.contypid in (select oid from pg_type where typnamespace in (select oid from namespaces))),
 triggers as (select t.* from pg_trigger t where t.tgrelid in (select oid from relids) or t.tgconstraint in (select oid from constraints)),
 types as (select t.* from pg_type t where t.typnamespace in (select oid from namespaces) or t.typrelid in (select oid from relids)),
 objects(classid,objid) as (
 select 'pg_namespace'::regclass,oid from namespaces union select 'pg_class'::regclass,oid from relids
 union select 'pg_type'::regclass,oid from types union select 'pg_constraint'::regclass,oid from constraints
 union select 'pg_trigger'::regclass,oid from triggers
 union select 'pg_proc'::regclass,oid from pg_proc where pronamespace in (select oid from namespaces)
 union select 'pg_policy'::regclass,oid from pg_policy where polrelid in (select oid from relids)
 union select 'pg_attrdef'::regclass,oid from pg_attrdef where adrelid in (select oid from relids)
 union select 'pg_rewrite'::regclass,oid from pg_rewrite where ev_class in (select oid from relids))
select jsonb_build_object(
 'format','operations-install-catalog-observation.v1',
 'classification','same-database raw catalog; OIDs retained; NOT cross-database normalization/equivalence',
 'namespaces',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from namespaces n),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c where c.oid in (select oid from relids)),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'default_expression',pg_get_expr(d.adbin,d.adrelid)) order by a.attrelid,a.attnum),'[]') from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid in (select oid from relids) and a.attnum>0),
 'constraints',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('definition',pg_get_constraintdef(c.oid,true)) order by c.oid),'[]') from constraints c),
 'indexes',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'predicate',pg_get_expr(i.indpred,i.indrelid),'expressions',pg_get_expr(i.indexprs,i.indrelid)) order by i.indexrelid),'[]') from pg_index i where i.indexrelid in (select oid from relids)),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('using',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.oid),'[]') from pg_policy p where p.polrelid in (select oid from relids)),
 'triggers_both_FK_sides',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_get_triggerdef(t.oid,true)) order by t.oid),'[]') from triggers t),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from types t),
 'enum_order',(select coalesce(jsonb_agg(to_jsonb(e) order by e.enumtypid,e.enumsortorder),'[]') from pg_enum e where e.enumtypid in (select oid from types)),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('identity',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid)) order by p.oid),'[]') from pg_proc p where p.pronamespace in (select oid from namespaces)),
 'sequences',(select coalesce(jsonb_agg(to_jsonb(s) order by s.seqrelid),'[]') from pg_sequence s where s.seqrelid in (select oid from relids)),
 'rewrite',(select coalesce(jsonb_agg(to_jsonb(r) order by r.oid),'[]') from pg_rewrite r where r.ev_class in (select oid from relids)),
 'dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]') from pg_depend d where exists(select 1 from objects o where (o.classid=d.classid and o.objid=d.objid) or (o.classid=d.refclassid and o.objid=d.refobjid))),
 'shared_dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.deptype),'[]') from pg_shdepend d where d.dbid=(select oid from pg_database where datname=current_database()) and exists(select 1 from objects o where o.classid=d.classid and o.objid=d.objid)),
 'role_graph',(select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]') from pg_auth_members m),
 'role_attributes',(select coalesce(jsonb_agg(to_jsonb(r)-'rolpassword' order by r.oid),'[]') from pg_roles r where r.rolname in ('postgres','cladora_rpc_owner','cladora_building_fixture_ops')),
 'default_acl',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)) )::text,true);
select set_config('cladora.install.managed_complete',(select jsonb_build_object(
 'schemas',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from pg_namespace n where nspname in ('auth','extensions','public')),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')))
 )::text,true);
do $catalog_entry$
begin
 if current_setting('cladora.install.native_binding',true) is null or current_setting('cladora.install.native_binding',true)=''
 or current_setting('cladora.install.operator_binding',true) is null or current_setting('cladora.install.operator_binding',true)=''
 or current_setting('cladora.install.execution_binding',true) is null or current_setting('cladora.install.execution_binding',true)=''
 or current_setting('cladora.install.prestate_sha256',true) is distinct from encode(extensions.digest(convert_to(current_setting('cladora.install.catalog_before'),'UTF8'),'sha256'),'hex') then
 raise exception 'operations_install_external_binding_or_prestate_required' using errcode='55000';end if;
end; $catalog_entry$;
-- SELECTED EFFECT B.PRECONDITIONS
do $pre$
begin
 if current_user<>'postgres' or session_user<>'postgres' or current_setting('server_version_num')::integer not between 170000 and 179999
  or not exists(select 1 from pg_roles where rolname='postgres' and not rolsuper and rolcreaterole)
  or not has_database_privilege(current_database(),'CREATE') then
  raise exception 'building_slice_installer_or_pg17_mismatch'; end if;
 if exists(select 1 from pg_namespace where nspname=any(array['app_private','platform','identity','portfolio','audit','finance','customer_api'])) then
  raise exception 'building_slice_fresh_empty_required'; end if;
 if exists(select 1 from pg_roles where rolname in ('cladora_rpc_owner','cladora_building_fixture_ops')) then
  raise exception 'building_slice_fresh_role_graph_required'; end if;
 if not exists(select 1 from pg_extension where extname='pgcrypto' and extversion='1.3' and extnamespace='extensions'::regnamespace)
  or not exists(select 1 from pg_extension where extname='btree_gist' and extversion='1.7' and extnamespace='extensions'::regnamespace) then
  raise exception 'building_slice_reviewed_extension_prerequisite'; end if;
 if not has_schema_privilege('postgres','auth','USAGE') or not has_column_privilege('postgres','auth.users','id','REFERENCES') then
  raise exception 'building_slice_preserved_fk_prerequisite'; end if;
 if to_regclass('auth.sessions') is null then raise exception 'building_slice_session_schema_prerequisite'; end if;
 if not exists(select 1 from pg_attribute where attrelid='auth.sessions'::regclass and attname='id' and atttypid='uuid'::regtype and not attisdropped)
  or not exists(select 1 from pg_attribute where attrelid='auth.sessions'::regclass and attname='user_id' and atttypid='uuid'::regtype and not attisdropped)
  or not exists(select 1 from pg_attribute where attrelid='auth.sessions'::regclass and attname='not_after' and atttypid='timestamptz'::regtype and not attisdropped)
  or not has_column_privilege('postgres','auth.sessions','id','SELECT')
  or not has_column_privilege('postgres','auth.sessions','user_id','SELECT')
  or not has_column_privilege('postgres','auth.sessions','not_after','SELECT') then
  raise exception 'building_slice_session_read_prerequisite'; end if;
end;
$pre$;


-- SELECTED EFFECT B.SM1
create schema app_private authorization postgres;


-- SELECTED EFFECT B.OC1.SM1
revoke all privileges on schema app_private from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SM1
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='app_private') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema app_private from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.SM2
create schema platform authorization postgres;


-- SELECTED EFFECT B.OC1.SM2
revoke all privileges on schema platform from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SM2
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='platform') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema platform from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.SM3
create schema identity authorization postgres;


-- SELECTED EFFECT B.OC1.SM3
revoke all privileges on schema identity from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SM3
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='identity') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema identity from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.SM4
create schema portfolio authorization postgres;


-- SELECTED EFFECT B.OC1.SM4
revoke all privileges on schema portfolio from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SM4
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='portfolio') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema portfolio from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.SM5
create schema audit authorization postgres;


-- SELECTED EFFECT B.OC1.SM5
revoke all privileges on schema audit from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SM5
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='audit') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema audit from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.SM6
create schema finance authorization postgres;


-- SELECTED EFFECT B.OC1.SM6
revoke all privileges on schema finance from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SM6
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='finance') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema finance from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.SM7
create schema customer_api authorization postgres;


-- SELECTED EFFECT B.OC1.SM7
revoke all privileges on schema customer_api from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SM7
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select nspacl acl,nspowner owner from pg_namespace where nspname='customer_api') o,
  lateral aclexplode(coalesce(o.acl,acldefault('n',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on schema customer_api from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.ROLE1
create role cladora_rpc_owner nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;


-- SELECTED EFFECT B.T04
create table identity.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  resource text not null,
  action text not null,
  description text,
  unique (resource, action)
);


-- SELECTED EFFECT B.OC1.T04
revoke all privileges on table identity.permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T04
revoke select ("id","code","resource","action","description"), insert ("id","code","resource","action","description"), update ("id","code","resource","action","description"), references ("id","code","resource","action","description") on table identity.permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T04
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T04
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T04
alter table identity.permissions enable row level security;


-- SELECTED EFFECT B.T13
create type identity.scope_type as enum ('tenant','property','building','unit');


-- SELECTED EFFECT B.OC1.T13
revoke all privileges on type identity.scope_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T13
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='identity.scope_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type identity.scope_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T15
create table platform.module_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{2,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null,
  labels_json jsonb not null check (labels_json ? 'ro' and labels_json ? 'en' and labels_json ? 'fa'),
  description text not null,
  category text not null check (category in ('core', 'financial', 'operations', 'governance', 'security', 'occupancy', 'services', 'investment')),
  is_active boolean not null default true,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('draft', 'active', 'published', 'deprecated', 'retired', 'catalog_only')),
  sensitivity_level text not null default 'standard' check (sensitivity_level in ('standard', 'sensitive', 'high_impact')),
  requires_aal2 boolean not null default false,
  entitlement_key text,
  config_schema jsonb not null default '{"type":"object","additionalProperties":false}'::jsonb,
  default_config jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (
    (lifecycle_status = 'catalog_only' and entitlement_key is null)
    or
    (lifecycle_status <> 'catalog_only' and entitlement_key is not null and entitlement_key ~ '^module\.[a-z0-9_]{2,64}$')
  ),
  unique (code, version)
);


-- SELECTED EFFECT B.OC1.T15
revoke all privileges on table platform.module_definitions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T15
revoke select ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), update ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), references ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at") on table platform.module_definitions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T15
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_definitions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_definitions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T15
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_definitions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_definitions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T15
alter table platform.module_definitions enable row level security;


-- SELECTED EFFECT B.T25
create table app_private.canonical_authority_revision_v1 (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision between 1 and 9007199254740991)
);


-- SELECTED EFFECT B.OC1.T25
revoke all privileges on table app_private.canonical_authority_revision_v1 from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T25
revoke select ("singleton","revision"), insert ("singleton","revision"), update ("singleton","revision"), references ("singleton","revision") on table app_private.canonical_authority_revision_v1 from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T25
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='app_private.canonical_authority_revision_v1'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table app_private.canonical_authority_revision_v1 from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T25
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='app_private.canonical_authority_revision_v1'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table app_private.canonical_authority_revision_v1 from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T25
alter table app_private.canonical_authority_revision_v1 enable row level security;


-- SELECTED EFFECT B.T38
create table identity.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  locale text not null default 'ro' check (locale in ('ro','en','fa')),
  timezone text not null default 'Europe/Bucharest',
  phone_encrypted text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);


-- SELECTED EFFECT B.OC1.T38
revoke all privileges on table identity.profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T38
revoke select ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), insert ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), update ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), references ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at") on table identity.profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T38
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T38
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T38
alter table identity.profiles enable row level security;


-- SELECTED EFFECT B.T42
create type platform.decision_effect as enum ('allow','deny');


-- SELECTED EFFECT B.OC1.T42
revoke all privileges on type platform.decision_effect from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T42
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.decision_effect'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.decision_effect from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T43
create type platform.record_status as enum ('draft','active','suspended','archived');


-- SELECTED EFFECT B.OC1.T43
revoke all privileges on type platform.record_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T43
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.record_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.record_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T44
create type platform.workspace_type as enum ('ASSOCIATION', 'PROPERTY_MANAGER', 'OWNER_PORTFOLIO', 'HYBRID');


-- SELECTED EFFECT B.OC1.T44
revoke all privileges on type platform.workspace_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T44
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T45
create type platform.workspace_lifecycle_status as enum (
  'LEAD',
  'UNDER_REVIEW',
  'APPROVED',
  'CONTRACT_PENDING',
  'PAYMENT_PENDING',
  'PROVISIONING',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'TERMINATED',
  'ARCHIVED'
);


-- SELECTED EFFECT B.OC1.T45
revoke all privileges on type platform.workspace_lifecycle_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T45
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_lifecycle_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_lifecycle_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T46
create type platform.workspace_environment as enum ('PILOT', 'PRODUCTION');


-- SELECTED EFFECT B.OC1.T46
revoke all privileges on type platform.workspace_environment from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T46
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_environment'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_environment from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T47
create type portfolio.property_type as enum ('condominium','residential_complex','villa','gated_community','mixed_residential');


-- SELECTED EFFECT B.OC1.T47
revoke all privileges on type portfolio.property_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T47
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.property_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.property_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T49
create type identity.membership_status as enum ('invited','active','suspended','expired','revoked');


-- SELECTED EFFECT B.OC1.T49
revoke all privileges on type identity.membership_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T49
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='identity.membership_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type identity.membership_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T52
create type portfolio.unit_status as enum ('active','inactive','combined','archived');


-- SELECTED EFFECT B.OC1.T52
revoke all privileges on type portfolio.unit_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T52
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.unit_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.unit_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T53
create type finance.accounting_period_status as enum ('open','closed');


-- SELECTED EFFECT B.OC1.T53
revoke all privileges on type finance.accounting_period_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T53
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.accounting_period_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.accounting_period_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T54
create type finance.journal_status as enum ('draft','posted','reversed');


-- SELECTED EFFECT B.OC1.T54
revoke all privileges on type finance.journal_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T54
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.journal_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.journal_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T57
create type finance.entry_side as enum ('debit','credit');


-- SELECTED EFFECT B.OC1.T57
revoke all privileges on type finance.entry_side from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T57
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.entry_side'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.entry_side from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T59
create table platform.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null,
  version integer not null default 1 check (version > 0),
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'deprecated', 'retired')),
  feature_catalogue jsonb not null default '[]'::jsonb,
  limit_schema jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default statement_timestamp(),
  effective_until timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (plan_code, version)
);


-- SELECTED EFFECT B.OC1.T59
revoke all privileges on table platform.subscription_plans from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T59
revoke select ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), insert ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), update ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), references ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at") on table platform.subscription_plans from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T59
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.subscription_plans'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.subscription_plans from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T59
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.subscription_plans'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.subscription_plans from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T59
alter table platform.subscription_plans enable row level security;


-- SELECTED EFFECT B.T60
create type finance.account_type as enum ('asset','liability','equity','income','expense');


-- SELECTED EFFECT B.OC1.T60
revoke all privileges on type finance.account_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T60
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.account_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.account_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T61
create type portfolio.party_type as enum ('person','company','association','public_body');


-- SELECTED EFFECT B.OC1.T61
revoke all privileges on type portfolio.party_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T61
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.party_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.party_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T63
create type platform.property_jurisdiction_assignment_status as enum
  ('draft','active','superseded','archived');


-- SELECTED EFFECT B.OC1.T63
revoke all privileges on type platform.property_jurisdiction_assignment_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T63
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.property_jurisdiction_assignment_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.property_jurisdiction_assignment_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T66
create type platform.jurisdiction_profile_status as enum
  ('draft','validated','active','suspended','retired');


-- SELECTED EFFECT B.OC1.T66
revoke all privileges on type platform.jurisdiction_profile_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.T66
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.jurisdiction_profile_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.jurisdiction_profile_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.T01
create table platform.tenants (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  registration_number text,
  status platform.record_status not null default 'draft',
  default_locale text not null default 'ro' check (default_locale in ('ro','en','fa')),
  timezone text not null default 'Europe/Bucharest',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  archived_at timestamptz,
  unique (registration_number)
);


-- SELECTED EFFECT B.OC1.T01
revoke all privileges on table platform.tenants from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T01
revoke select ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), insert ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), update ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), references ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at") on table platform.tenants from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T01
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.tenants'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.tenants from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.tenants'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.tenants from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T01
alter table platform.tenants enable row level security;


-- SELECTED EFFECT B.T09
create table platform.property_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);


-- SELECTED EFFECT B.OC1.T09
revoke all privileges on table platform.property_profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T09
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.property_profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T09
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T09
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T09
alter table platform.property_profiles enable row level security;


-- SELECTED EFFECT B.T10
create table platform.operating_models (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);


-- SELECTED EFFECT B.OC1.T10
revoke all privileges on table platform.operating_models from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T10
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.operating_models from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T10
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.operating_models'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.operating_models from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T10
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.operating_models'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.operating_models from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T10
alter table platform.operating_models enable row level security;


-- SELECTED EFFECT B.T19
create table platform.space_kinds (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);


-- SELECTED EFFECT B.OC1.T19
revoke all privileges on table platform.space_kinds from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T19
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.space_kinds from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T19
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.space_kinds'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.space_kinds from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T19
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.space_kinds'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.space_kinds from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T19
alter table platform.space_kinds enable row level security;


-- SELECTED EFFECT B.T22
create table platform.module_permission_bindings (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  binding_version integer not null default 1 check (binding_version >= 1),
  permission_mode text not null default 'read' check (permission_mode in ('read', 'manage', 'execute', 'admin')),
  is_assignable_to_local_role boolean not null default true,
  is_delegable boolean not null default false, -- Strictly false in 001B.1
  requires_aal2 boolean not null default false,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'deprecated', 'retired')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  unique (module_definition_id, permission_id, binding_version)
);


-- SELECTED EFFECT B.OC1.T22
revoke all privileges on table platform.module_permission_bindings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T22
revoke select ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), insert ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), update ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), references ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at") on table platform.module_permission_bindings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T22
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_permission_bindings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_permission_bindings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T22
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_permission_bindings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_permission_bindings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T22
alter table platform.module_permission_bindings enable row level security;


-- SELECTED EFFECT B.T62
create table platform.jurisdiction_profiles(
  id uuid primary key default gen_random_uuid(),
  code text not null check(code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  version integer not null check(version>0),
  country_code char(2) not null check(country_code::text ~ '^[A-Z]{2}$'),
  name text not null check(nullif(btrim(name),'') is not null),
  default_currency_code char(3) not null
    check(default_currency_code::text ~ '^[A-Z]{3}$'),
  default_timezone text not null check(length(default_timezone) between 1 and 80),
  calendar_code text not null check(calendar_code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  status platform.jurisdiction_profile_status not null default 'draft',
  valid_from date not null,
  valid_to date check(valid_to is null or valid_to>valid_from),
  legal_signoff_reference text,
  legal_signed_at timestamptz,
  accounting_signoff_reference text,
  accounting_signed_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(code,version),
  check((legal_signoff_reference is null)=(legal_signed_at is null)),
  check((accounting_signoff_reference is null)=(accounting_signed_at is null))
);


-- SELECTED EFFECT B.OC1.T62
revoke all privileges on table platform.jurisdiction_profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T62
revoke select ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), insert ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), update ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), references ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at") on table platform.jurisdiction_profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T62
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.jurisdiction_profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.jurisdiction_profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T62
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.jurisdiction_profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.jurisdiction_profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T62
alter table platform.jurisdiction_profiles enable row level security;


-- SELECTED EFFECT B.T02
create table identity.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references platform.tenants(id) on delete restrict,
  code text not null,
  name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct (tenant_id, code)
);


-- SELECTED EFFECT B.OC1.T02
revoke all privileges on table identity.roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T02
revoke select ("id","tenant_id","code","name","is_system","created_at"), insert ("id","tenant_id","code","name","is_system","created_at"), update ("id","tenant_id","code","name","is_system","created_at"), references ("id","tenant_id","code","name","is_system","created_at") on table identity.roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T02
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T02
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T02
alter table identity.roles enable row level security;


-- SELECTED EFFECT B.T05
create table platform.customer_workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_type platform.workspace_type not null,
  lifecycle_status platform.workspace_lifecycle_status not null default 'LEAD',
  commercial_owner text not null,
  environment platform.workspace_environment not null default 'PILOT',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  suspended_at timestamptz,
  terminated_at timestamptz,
  archived_at timestamptz
);


-- SELECTED EFFECT B.OC1.T05
revoke all privileges on table platform.customer_workspaces from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T05
revoke select ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at"), insert ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at"), update ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at"), references ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at") on table platform.customer_workspaces from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T05
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.customer_workspaces'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.customer_workspaces from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T05
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.customer_workspaces'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.customer_workspaces from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T05
alter table platform.customer_workspaces enable row level security;


-- SELECTED EFFECT B.T20
create table platform.property_operating_model_compatibilities (
  id uuid primary key default gen_random_uuid(),
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  operating_model_id uuid not null references platform.operating_models(id) on delete restrict,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  rule_version integer not null default 1 check (rule_version > 0),
  reason text not null,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (property_profile_id, operating_model_id, rule_version)
);


-- SELECTED EFFECT B.OC1.T20
revoke all privileges on table platform.property_operating_model_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T20
revoke select ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), insert ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), update ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), references ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at") on table platform.property_operating_model_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T20
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_operating_model_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_operating_model_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T20
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_operating_model_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_operating_model_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T20
alter table platform.property_operating_model_compatibilities enable row level security;


-- SELECTED EFFECT B.T21
create table platform.property_space_kind_compatibilities (
  id uuid primary key default gen_random_uuid(),
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  space_kind_id uuid not null references platform.space_kinds(id) on delete restrict,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  rule_version integer not null default 1 check (rule_version > 0),
  reason text not null,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (property_profile_id, space_kind_id, rule_version)
);


-- SELECTED EFFECT B.OC1.T21
revoke all privileges on table platform.property_space_kind_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T21
revoke select ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), insert ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), update ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), references ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at") on table platform.property_space_kind_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T21
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_space_kind_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_space_kind_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T21
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_space_kind_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_space_kind_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T21
alter table platform.property_space_kind_compatibilities enable row level security;


-- SELECTED EFFECT B.T23
create table platform.module_property_profile_compatibilities (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  property_profile_id uuid not null references platform.property_profiles(id) on delete cascade,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  reason text not null default 'Canonical module profile compatibility rule',
  created_at timestamptz not null default statement_timestamp(),
  unique (module_definition_id, property_profile_id)
);


-- SELECTED EFFECT B.OC1.T23
revoke all privileges on table platform.module_property_profile_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T23
revoke select ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), insert ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), update ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), references ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at") on table platform.module_property_profile_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T23
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_property_profile_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_property_profile_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T23
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_property_profile_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_property_profile_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T23
alter table platform.module_property_profile_compatibilities enable row level security;


-- SELECTED EFFECT B.T24
create table platform.module_operating_model_compatibilities (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  operating_model_id uuid not null references platform.operating_models(id) on delete cascade,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  reason text not null default 'Canonical module operating model compatibility rule',
  created_at timestamptz not null default statement_timestamp(),
  unique (module_definition_id, operating_model_id)
);


-- SELECTED EFFECT B.OC1.T24
revoke all privileges on table platform.module_operating_model_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T24
revoke select ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), insert ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), update ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), references ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at") on table platform.module_operating_model_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T24
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_operating_model_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_operating_model_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T24
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_operating_model_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_operating_model_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T24
alter table platform.module_operating_model_compatibilities enable row level security;


-- SELECTED EFFECT B.T32
create table audit.events (
  id bigint generated always as identity primary key, tenant_id uuid references platform.tenants(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict, actor_role text, action text not null, entity_type text not null, entity_id uuid,
  request_id uuid, before_snapshot jsonb, after_snapshot jsonb, reason text, occurred_at timestamptz not null default statement_timestamp()
);


-- SELECTED EFFECT B.OC1.T32
revoke all privileges on table audit.events from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T32
revoke select ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), insert ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), update ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), references ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at") on table audit.events from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T32
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='audit.events'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table audit.events from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T32
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='audit.events'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table audit.events from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T32
alter table audit.events enable row level security;


-- SELECTED EFFECT B.T33
create table platform.outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  aggregate_type text not null,
  aggregate_id uuid not null,
  aggregate_version bigint not null check (aggregate_version > 0),
  event_type text not null,
  payload jsonb not null,
  trace_id uuid,
  occurred_at timestamptz not null default statement_timestamp(),
  published_at timestamptz,
  publish_attempts integer not null default 0 check (publish_attempts >= 0),
  unique (tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type)
);


-- SELECTED EFFECT B.OC1.T33
revoke all privileges on table platform.outbox_events from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T33
revoke select ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), insert ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), update ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), references ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts") on table platform.outbox_events from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T33
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.outbox_events'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.outbox_events from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T33
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.outbox_events'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.outbox_events from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T33
alter table platform.outbox_events enable row level security;


-- SELECTED EFFECT B.T48
create table portfolio.addresses (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  country_code char(2) not null default 'RO', county text, city text not null, street text not null,
  building_no text, postal_code text, latitude numeric(9,6), longitude numeric(9,6), created_at timestamptz not null default statement_timestamp()
);


-- SELECTED EFFECT B.OC1.T48
revoke all privileges on table portfolio.addresses from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T48
revoke select ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), insert ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), update ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), references ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at") on table portfolio.addresses from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T48
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.addresses'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.addresses from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T48
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.addresses'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.addresses from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T48
alter table portfolio.addresses enable row level security;


-- SELECTED EFFECT B.T56
create table portfolio.parties (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  type portfolio.party_type not null, legal_name text not null, tax_ref_encrypted text, email_encrypted text, phone_encrypted text,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(), archived_at timestamptz
);


-- SELECTED EFFECT B.OC1.T56
revoke all privileges on table portfolio.parties from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T56
revoke select ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), insert ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), update ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), references ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at") on table portfolio.parties from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T56
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.parties'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.parties from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T56
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.parties'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.parties from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T56
alter table portfolio.parties enable row level security;


-- SELECTED EFFECT B.T03
create table identity.role_permissions (
  role_id uuid not null references identity.roles(id) on delete cascade,
  permission_id uuid not null references identity.permissions(id) on delete cascade,
  effect platform.decision_effect not null default 'allow',
  primary key (role_id, permission_id)
);


-- SELECTED EFFECT B.OC1.T03
revoke all privileges on table identity.role_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T03
revoke select ("role_id","permission_id","effect"), insert ("role_id","permission_id","effect"), update ("role_id","permission_id","effect"), references ("role_id","permission_id","effect") on table identity.role_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T03
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.role_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.role_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T03
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.role_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.role_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T03
alter table identity.role_permissions enable row level security;


-- SELECTED EFFECT B.T06
create table portfolio.properties (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  type portfolio.property_type not null, name text not null, address_id uuid references portfolio.addresses(id) on delete restrict,
  base_currency char(3) not null default 'RON', status platform.record_status not null default 'draft', created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);


-- SELECTED EFFECT B.OC1.T06
revoke all privileges on table portfolio.properties from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T06
revoke select ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), insert ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), update ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), references ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at") on table portfolio.properties from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T06
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.properties'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.properties from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T06
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.properties'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.properties from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T06
alter table portfolio.properties enable row level security;


-- SELECTED EFFECT B.T08
create table platform.workspace_taxonomy_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  operating_model_id uuid not null references platform.operating_models(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'superseded', 'archived')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from)
);


-- SELECTED EFFECT B.OC1.T08
revoke all privileges on table platform.workspace_taxonomy_assignments from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T08
revoke select ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at") on table platform.workspace_taxonomy_assignments from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T08
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_taxonomy_assignments'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_taxonomy_assignments from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T08
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_taxonomy_assignments'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_taxonomy_assignments from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T08
alter table platform.workspace_taxonomy_assignments enable row level security;


-- SELECTED EFFECT B.T11
create table identity.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references identity.roles(id) on delete restrict,
  status identity.membership_status not null default 'invited',
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (ends_at is null or ends_at > starts_at)
);


-- SELECTED EFFECT B.OC1.T11
revoke all privileges on table identity.memberships from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T11
revoke select ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), insert ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), update ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), references ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at") on table identity.memberships from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T11
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.memberships'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.memberships from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T11
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.memberships'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.memberships from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T11
alter table identity.memberships enable row level security;


-- SELECTED EFFECT B.T14
create table platform.workspace_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  module_code text not null,
  status text not null check (status in ('active', 'deactivated', 'superseded')),
  config_json jsonb not null default '{}'::jsonb check (config_json = '{}'::jsonb and octet_length(config_json::text) <= 16384),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  activated_at timestamptz not null default statement_timestamp(),
  deactivated_at timestamptz,
  activated_by uuid references auth.users(id) on delete set null,
  deactivated_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  check ((valid_to is null and status = 'active') or (valid_to is not null and status in ('deactivated', 'superseded')))
);


-- SELECTED EFFECT B.OC1.T14
revoke all privileges on table platform.workspace_modules from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T14
revoke select ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at") on table platform.workspace_modules from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T14
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_modules'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_modules from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T14
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_modules'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_modules from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T14
alter table platform.workspace_modules enable row level security;


-- SELECTED EFFECT B.T37
create table platform.workspace_role_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  action text not null,
  request_hash text not null,
  request_hash_version integer not null default 1,
  result_entity_id uuid not null,
  response_snapshot jsonb not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key)
);


-- SELECTED EFFECT B.OC1.T37
revoke all privileges on table platform.workspace_role_idempotency from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T37
revoke select ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), insert ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), update ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), references ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at") on table platform.workspace_role_idempotency from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T37
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_idempotency'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_idempotency from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T37
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_idempotency'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_idempotency from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T37
alter table platform.workspace_role_idempotency enable row level security;


-- SELECTED EFFECT B.T39
create table platform.workspace_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9_]{3,50}$'),
  role_version integer not null default 1 check (role_version >= 1),
  lock_version integer not null default 1 check (lock_version >= 1),
  name text not null check (length(trim(name)) >= 2),
  description text check (description is null or length(trim(description)) >= 5),
  base_role_id uuid references identity.roles(id) on delete restrict,
  scope_ceiling text not null default 'workspace' check (scope_ceiling in ('workspace', 'property', 'building', 'unit')),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'published', 'archived')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  unique (customer_workspace_id, code, role_version)
);


-- SELECTED EFFECT B.OC1.T39
revoke all privileges on table platform.workspace_roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T39
revoke select ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), insert ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), update ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), references ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at") on table platform.workspace_roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T39
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T39
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T39
alter table platform.workspace_roles enable row level security;


-- SELECTED EFFECT B.T50
create table platform.workspace_contracts (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete cascade,
  plan_id uuid references platform.subscription_plans(id) on delete restrict,
  contract_ref text not null,
  version integer not null default 1 check (version > 0),
  currency text not null default 'EUR' check (currency in ('EUR', 'RON', 'USD')),
  status text not null default 'draft' check (status in ('draft', 'pending_signature', 'signed', 'active', 'suspended', 'expired', 'terminated', 'superseded')),
  start_date date not null,
  end_date date,
  signed_at timestamptz,
  activated_at timestamptz,
  commercial_terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  unique (contract_ref, version)
);


-- SELECTED EFFECT B.OC1.T50
revoke all privileges on table platform.workspace_contracts from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T50
revoke select ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), insert ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), update ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), references ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at") on table platform.workspace_contracts from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T50
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_contracts'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_contracts from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T50
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_contracts'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_contracts from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T50
alter table platform.workspace_contracts enable row level security;


-- SELECTED EFFECT B.OC1.T07
revoke all privileges on table platform.workspace_property_bindings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T07
revoke select ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at") on table platform.workspace_property_bindings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T07
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_property_bindings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_property_bindings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T07
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_property_bindings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_property_bindings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T07
alter table platform.workspace_property_bindings enable row level security;


-- SELECTED EFFECT B.T12
create table identity.context_grants (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references identity.memberships(id) on delete cascade,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  scope_type identity.scope_type not null,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (scope_type='tenant' and property_id is null and building_id is null and unit_id is null) or
    (scope_type='property' and property_id is not null and building_id is null and unit_id is null) or
    (scope_type='building' and building_id is not null and unit_id is null) or
    (scope_type='unit' and unit_id is not null)
  )
);


-- SELECTED EFFECT B.OC1.T12
revoke all privileges on table identity.context_grants from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T12
revoke select ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), insert ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), update ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), references ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at") on table identity.context_grants from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T12
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.context_grants'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.context_grants from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T12
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.context_grants'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.context_grants from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T12
alter table identity.context_grants enable row level security;


-- SELECTED EFFECT B.T16
create table platform.workspace_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete cascade,
  contract_id uuid references platform.workspace_contracts(id) on delete set null,
  entitlement_key text not null,
  value_type text not null check (value_type in ('numeric', 'boolean', 'string', 'array', 'json')),
  numeric_value numeric,
  boolean_value boolean,
  text_value text,
  json_value jsonb,
  valid_from timestamptz not null default statement_timestamp(),
  valid_until timestamptz,
  override_value_json jsonb,
  override_reason text,
  override_expires_at timestamptz,
  override_approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (customer_workspace_id, entitlement_key)
);


-- SELECTED EFFECT B.OC1.T16
revoke all privileges on table platform.workspace_entitlements from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T16
revoke select ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), insert ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), update ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), references ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at") on table platform.workspace_entitlements from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T16
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_entitlements'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_entitlements from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T16
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_entitlements'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_entitlements from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T16
alter table platform.workspace_entitlements enable row level security;


-- SELECTED EFFECT B.T27
create table portfolio.buildings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, code text not null, name text not null,
  year_built smallint, floors smallint check (floors is null or floors>=0), status platform.record_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(), unique(property_id,code)
);


-- SELECTED EFFECT B.OC1.T27
revoke all privileges on table portfolio.buildings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T27
revoke select ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), insert ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), update ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), references ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at") on table portfolio.buildings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T27
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.buildings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.buildings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T27
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.buildings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.buildings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T27
alter table portfolio.buildings enable row level security;


-- SELECTED EFFECT B.T29
create table finance.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  status finance.accounting_period_status not null default 'open',
  closed_at timestamptz,
  snapshot_json jsonb,
  created_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct (tenant_id,property_id,starts_on,ends_on),
  check (ends_on>=starts_on),
  check ((status='open' and closed_at is null and snapshot_json is null) or
    (status='closed' and closed_at is not null and snapshot_json is not null))
);


-- SELECTED EFFECT B.OC1.T29
revoke all privileges on table finance.accounting_periods from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T29
revoke select ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at"), insert ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at"), update ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at"), references ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at") on table finance.accounting_periods from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T29
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.accounting_periods'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.accounting_periods from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T29
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.accounting_periods'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.accounting_periods from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T29
alter table finance.accounting_periods enable row level security;


-- SELECTED EFFECT B.T30
create table finance.journals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  journal_no bigint generated always as identity,
  occurred_on date not null,
  currency char(3) not null,
  description text not null,
  source_type text not null,
  source_id uuid,
  status finance.journal_status not null default 'draft',
  reversal_of_id uuid references finance.journals(id) on delete restrict,
  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, journal_no),
  check ((status='draft' and posted_at is null) or (status<>'draft' and posted_at is not null)),
  check (reversal_of_id is null or status='reversed')
);


-- SELECTED EFFECT B.OC1.T30
revoke all privileges on table finance.journals from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T30
revoke select ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), insert ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), update ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), references ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at") on table finance.journals from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T30
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.journals'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.journals from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T30
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journals'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.journals from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T30
alter table finance.journals enable row level security;


-- SELECTED EFFECT B.T40
create table platform.workspace_role_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_role_id, module_definition_id)
);


-- SELECTED EFFECT B.OC1.T40
revoke all privileges on table platform.workspace_role_modules from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T40
revoke select ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), insert ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), update ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), references ("id","tenant_id","workspace_role_id","module_definition_id","created_at") on table platform.workspace_role_modules from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T40
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_modules'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_modules from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T40
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_modules'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_modules from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T40
alter table platform.workspace_role_modules enable row level security;


-- SELECTED EFFECT B.T41
create table platform.workspace_role_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  effect platform.decision_effect not null default 'allow',
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_role_id, permission_id)
);


-- SELECTED EFFECT B.OC1.T41
revoke all privileges on table platform.workspace_role_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T41
revoke select ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), insert ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), update ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), references ("id","tenant_id","workspace_role_id","permission_id","effect","created_at") on table platform.workspace_role_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T41
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T41
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T41
alter table platform.workspace_role_permissions enable row level security;


-- SELECTED EFFECT B.T55
create table finance.accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  code text not null,
  name text not null,
  type finance.account_type not null,
  currency char(3) not null default 'RON',
  parent_account_id uuid references finance.accounts(id) on delete restrict,
  is_control_account boolean not null default false,
  status platform.record_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct (tenant_id, property_id, code)
);


-- SELECTED EFFECT B.OC1.T55
revoke all privileges on table finance.accounts from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T55
revoke select ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), insert ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), update ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), references ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at") on table finance.accounts from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T55
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.accounts'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.accounts from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T55
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.accounts'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.accounts from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T55
alter table finance.accounts enable row level security;


-- SELECTED EFFECT B.T58
create table platform.property_jurisdiction_assignments(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null
    references platform.customer_workspaces(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  jurisdiction_profile_id uuid not null
    references platform.jurisdiction_profiles(id) on delete restrict,
  assignment_version integer not null check(assignment_version>0),
  country_code char(2) not null check(country_code::text ~ '^[A-Z]{2}$'),
  profile_manifest_sha256 text not null
    check(profile_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  status platform.property_jurisdiction_assignment_status not null default 'draft',
  binding_source text not null check(binding_source in
    ('onboarding_verified','platform_verified','migration_verified')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check(valid_to is null or valid_to>valid_from),
  reason text not null check(nullif(btrim(reason),'') is not null),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(property_id,assignment_version)
);


-- SELECTED EFFECT B.OC1.T58
revoke all privileges on table platform.property_jurisdiction_assignments from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T58
revoke select ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at") on table platform.property_jurisdiction_assignments from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T58
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_jurisdiction_assignments'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_jurisdiction_assignments from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T58
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_jurisdiction_assignments'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_jurisdiction_assignments from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T58
alter table platform.property_jurisdiction_assignments enable row level security;


-- SELECTED EFFECT B.T17
create table platform.workspace_access_bases (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  normalized_email text not null,
  role_id uuid not null references identity.roles(id) on delete restrict,
  mode text not null check (mode in ('PILOT','PAID')),
  status text not null default 'prepared' check (status in ('prepared','active','revoked')),
  duration_hours integer,
  contract_id uuid references platform.workspace_contracts(id) on delete restrict,
  payment_reference text,
  payment_amount numeric(20,4),
  payment_currency text,
  paid_on date,
  paid_through date,
  evidence_note text not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  expires_at timestamptz,
  membership_id uuid references identity.memberships(id) on delete restrict,
  context_grant_id uuid references identity.context_grants(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoke_reason text,
  check (normalized_email = lower(btrim(normalized_email)) and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (
    (mode = 'PILOT' and duration_hours in (24,48,72) and contract_id is null
      and payment_reference is null and payment_amount is null and payment_currency is null
      and paid_on is null and paid_through is null)
    or
    (mode = 'PAID' and duration_hours is null and contract_id is not null
      and length(btrim(payment_reference)) >= 3 and payment_amount > 0
      and payment_currency in ('EUR','RON','USD') and paid_on is not null and paid_through is not null)
  ),
  check (
    (status = 'prepared' and activated_at is null and expires_at is null
      and membership_id is null and context_grant_id is null and revoked_at is null)
    or (status = 'active' and activated_at is not null and expires_at > activated_at
      and membership_id is not null and context_grant_id is not null and revoked_at is null)
    or (status = 'revoked' and (revoked_by is not null or revoke_reason='Contract is no longer active') and revoked_at is not null
      and length(btrim(revoke_reason)) >= 3)
  )
);


-- SELECTED EFFECT B.OC1.T17
revoke all privileges on table platform.workspace_access_bases from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T17
revoke select ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), insert ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), update ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), references ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason") on table platform.workspace_access_bases from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T17
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_access_bases'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_access_bases from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T17
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_access_bases'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_access_bases from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T17
alter table platform.workspace_access_bases enable row level security;


-- SELECTED EFFECT B.T51
create table portfolio.entrances (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  building_id uuid not null references portfolio.buildings(id) on delete restrict, code text not null, name text, created_at timestamptz not null default statement_timestamp(), unique(building_id,code)
);


-- SELECTED EFFECT B.OC1.T51
revoke all privileges on table portfolio.entrances from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T51
revoke select ("id","tenant_id","building_id","code","name","created_at"), insert ("id","tenant_id","building_id","code","name","created_at"), update ("id","tenant_id","building_id","code","name","created_at"), references ("id","tenant_id","building_id","code","name","created_at") on table portfolio.entrances from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T51
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.entrances'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.entrances from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T51
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.entrances'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.entrances from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T51
alter table portfolio.entrances enable row level security;


-- SELECTED EFFECT B.T28
create table portfolio.units (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  building_id uuid not null references portfolio.buildings(id) on delete restrict, entrance_id uuid references portfolio.entrances(id) on delete restrict,
  code text not null, floor smallint, area_m2 numeric(12,3) check(area_m2 is null or area_m2>0), bedrooms smallint check(bedrooms is null or bedrooms>=0),
  status portfolio.unit_status not null default 'active', created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(), unique(building_id,code)
);


-- SELECTED EFFECT B.OC1.T28
revoke all privileges on table portfolio.units from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T28
revoke select ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), insert ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), update ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), references ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at") on table portfolio.units from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T28
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.units'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.units from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T28
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.units'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.units from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T28
alter table portfolio.units enable row level security;


-- SELECTED EFFECT B.T31
create table finance.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  journal_id uuid not null references finance.journals(id) on delete restrict,
  account_id uuid not null references finance.accounts(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  party_id uuid references portfolio.parties(id) on delete restrict,
  side finance.entry_side not null,
  amount numeric(20,4) not null check (amount>0),
  memo text,
  created_at timestamptz not null default statement_timestamp()
);


-- SELECTED EFFECT B.OC1.T31
revoke all privileges on table finance.journal_entries from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T31
revoke select ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), insert ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), update ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), references ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at") on table finance.journal_entries from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T31
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.journal_entries'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.journal_entries from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T31
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journal_entries'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.journal_entries from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T31
alter table finance.journal_entries enable row level security;


-- SELECTED EFFECT B.T34
create table platform.workspace_member_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  scope_type text not null check (scope_type in ('workspace', 'property', 'building', 'unit')),
  property_id uuid references portfolio.properties(id) on delete restrict,
  building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  assigned_by_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by_membership_id uuid not null references identity.memberships(id) on delete restrict,
  lock_version integer not null default 1 check (lock_version >= 1),
  reason text not null check (length(trim(reason)) >= 5),
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  -- Exactly-one-scope constraint
  check (
    (scope_type = 'workspace' and property_id is null and building_id is null and unit_id is null)
    or (scope_type = 'property' and property_id is not null and building_id is null and unit_id is null)
    or (scope_type = 'building' and property_id is not null and building_id is not null and unit_id is null)
    or (scope_type = 'unit' and property_id is not null and building_id is not null and unit_id is not null)
  )
);


-- SELECTED EFFECT B.OC1.T34
revoke all privileges on table platform.workspace_member_roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T34
revoke select ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at"), insert ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at"), update ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at"), references ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at") on table platform.workspace_member_roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T34
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_member_roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_member_roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T34
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_member_roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_member_roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T34
alter table platform.workspace_member_roles enable row level security;


-- SELECTED EFFECT B.T64
create table platform.workspace_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  delegation_code text not null,
  grantor_membership_id uuid not null references identity.memberships(id) on delete restrict,
  grantee_membership_id uuid not null references identity.memberships(id) on delete restrict,
  grantor_user_id uuid not null references auth.users(id) on delete restrict,
  grantee_user_id uuid not null references auth.users(id) on delete restrict,
  scope_type text not null check (scope_type in ('workspace', 'property', 'building', 'unit')),
  property_id uuid references portfolio.properties(id) on delete restrict,
  building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  lifecycle_status text not null default 'draft' check (
    lifecycle_status in ('draft', 'pending_acceptance', 'pending_approval', 'active', 'revoked', 'rejected')
  ),
  delegation_depth integer not null default 0 check (delegation_depth = 0),
  purpose text not null check (length(trim(purpose)) between 5 and 500),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  lock_version integer not null default 1 check (lock_version >= 1),
  approval_policy_code text check (approval_policy_code is null or approval_policy_code in ('single_manager', 'four_eyes_financial', 'four_eyes_sensitive')),
  required_approval_count integer not null default 1 check (required_approval_count = 1),
  payload_hash text,
  submitted_at timestamptz,
  accepted_at timestamptz,
  activated_at timestamptz,
  rejected_at timestamptz,
  rejected_by_user_id uuid references auth.users(id) on delete restrict,
  rejection_reason text,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (grantor_membership_id <> grantee_membership_id),
  check (grantor_user_id <> grantee_user_id),
  check (valid_until > valid_from),
  check (
    (scope_type = 'workspace' and property_id is null and building_id is null and unit_id is null) or
    (scope_type = 'property' and property_id is not null and building_id is null and unit_id is null) or
    (scope_type = 'building' and property_id is not null and building_id is not null and unit_id is null) or
    (scope_type = 'unit' and property_id is not null and building_id is not null and unit_id is not null)
  ),
  unique (customer_workspace_id, delegation_code)
);


-- SELECTED EFFECT B.OC1.T64
revoke all privileges on table platform.workspace_delegations from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T64
revoke select ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at") on table platform.workspace_delegations from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T64
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_delegations'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_delegations from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T64
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_delegations'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_delegations from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T64
alter table platform.workspace_delegations enable row level security;


-- SELECTED EFFECT B.T35
create table platform.workspace_member_role_authority_sources (
  assignment_id uuid not null references platform.workspace_member_roles(id) on delete restrict deferrable initially deferred,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  source_kind text not null check(source_kind in ('identity_role','workspace_role_assignment')),
  source_identity_role_id uuid references identity.roles(id) on delete restrict,
  source_assignment_id uuid references platform.workspace_member_roles(id) on delete restrict deferrable initially deferred,
  authority_depth smallint not null check(authority_depth between 0 and 4),
  created_at timestamptz not null default statement_timestamp(),
  primary key(assignment_id,permission_id,module_definition_id),
  check (
    (source_kind='identity_role' and source_identity_role_id is not null and source_assignment_id is null and authority_depth=0)
    or (source_kind='workspace_role_assignment' and source_identity_role_id is null and source_assignment_id is not null and authority_depth between 1 and 4)
  )
);


-- SELECTED EFFECT B.OC1.T35
revoke all privileges on table platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T35
revoke select ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), insert ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), update ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), references ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at") on table platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T35
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_member_role_authority_sources'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_member_role_authority_sources from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T35
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_member_role_authority_sources'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_member_role_authority_sources from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T35
alter table platform.workspace_member_role_authority_sources enable row level security;


-- SELECTED EFFECT B.T36
create table platform.workspace_role_handover_lineage (
  successor_assignment_id uuid primary key references platform.workspace_member_roles(id),
  manager_membership_id uuid not null references identity.memberships(id),
  manager_context_id uuid not null references identity.context_grants(id),
  parent_assignment_id uuid references platform.workspace_member_roles(id),
  created_at timestamptz not null default statement_timestamp(),
  check (parent_assignment_id is distinct from successor_assignment_id)
);


-- SELECTED EFFECT B.OC1.T36
revoke all privileges on table platform.workspace_role_handover_lineage from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T36
revoke select ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), insert ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), update ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), references ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at") on table platform.workspace_role_handover_lineage from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T36
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_handover_lineage'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_handover_lineage from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T36
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_handover_lineage'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_handover_lineage from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T36
alter table platform.workspace_role_handover_lineage enable row level security;


-- SELECTED EFFECT B.T65
create table platform.workspace_delegation_permissions (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references platform.workspace_delegations(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  module_permission_binding_id uuid not null references platform.module_permission_bindings(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (delegation_id, module_definition_id, permission_id)
);


-- SELECTED EFFECT B.OC1.T65
revoke all privileges on table platform.workspace_delegation_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.T65
revoke select ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), insert ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), update ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), references ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at") on table platform.workspace_delegation_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.T65
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_delegation_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_delegation_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.T65
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_delegation_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_delegation_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.RLS.T65
alter table platform.workspace_delegation_permissions enable row level security;


-- SELECTED EFFECT B.OC1.SQ1
revoke all privileges on sequence audit.events_id_seq from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SQ1
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='audit.events_id_seq'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('S',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on sequence audit.events_id_seq from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.SQ2
revoke all privileges on sequence finance.journals_journal_no_seq from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.SQ2
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journals_journal_no_seq'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('S',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on sequence finance.journals_journal_no_seq from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.E001
alter table platform.tenants enable row level security;


-- SELECTED EFFECT B.E002
alter table platform.outbox_events enable row level security;


-- SELECTED EFFECT B.E003
alter table identity.profiles enable row level security;


-- SELECTED EFFECT B.E004
alter table identity.roles enable row level security;


-- SELECTED EFFECT B.E005
alter table identity.permissions enable row level security;


-- SELECTED EFFECT B.E006
alter table identity.role_permissions enable row level security;


-- SELECTED EFFECT B.E007
alter table identity.memberships enable row level security;


-- SELECTED EFFECT B.E008
alter table identity.context_grants enable row level security;


-- SELECTED EFFECT B.E009
alter table audit.events enable row level security;


-- SELECTED EFFECT B.E010
alter table platform.customer_workspaces enable row level security;


-- SELECTED EFFECT B.E011
alter table platform.subscription_plans enable row level security;


-- SELECTED EFFECT B.E012
alter table platform.workspace_contracts enable row level security;


-- SELECTED EFFECT B.E013
alter table platform.workspace_entitlements enable row level security;


-- SELECTED EFFECT B.E014
alter table platform.customer_workspaces
  add column primary_admin_user_id uuid references auth.users(id) on delete restrict,
  add column primary_admin_membership_id uuid references identity.memberships(id) on delete restrict,
  add column primary_admin_accepted_at timestamptz,
  add column onboarding_completed_at timestamptz;


-- SELECTED EFFECT B.E015
alter table platform.customer_workspaces
  add constraint customer_workspaces_primary_admin_consistency check (
    (
      primary_admin_user_id is null
      and primary_admin_membership_id is null
      and primary_admin_accepted_at is null
    )
    or (
      primary_admin_user_id is not null
      and primary_admin_membership_id is not null
      and primary_admin_accepted_at is not null
    )
  );


-- SELECTED EFFECT B.E016
alter table platform.customer_workspaces
  add column onboarding_completed_by uuid references auth.users(id) on delete restrict;


-- SELECTED EFFECT B.E017
alter table platform.customer_workspaces
  add constraint customer_workspaces_onboarding_completion_consistency check (
    (onboarding_completed_at is null and onboarding_completed_by is null)
    or (onboarding_completed_at is not null and onboarding_completed_by is not null)
  );


-- SELECTED EFFECT B.E018
alter table platform.subscription_plans drop constraint if exists subscription_plans_status_check;


-- SELECTED EFFECT B.E019
alter table platform.subscription_plans alter column status set default 'draft';


-- SELECTED EFFECT B.E020
alter table platform.subscription_plans add constraint subscription_plans_status_check
  check (status in ('draft', 'active', 'deprecated', 'retired'));


-- SELECTED EFFECT B.E021
alter table platform.subscription_plans add constraint subscription_plans_effective_window_check
  check (effective_until is null or effective_until > effective_from);


-- SELECTED EFFECT B.E022
alter table finance.accounting_periods enable row level security;


-- SELECTED EFFECT B.E023
alter table finance.accounting_periods
  add column if not exists closed_by uuid references auth.users(id) on delete restrict;


-- SELECTED EFFECT B.E024
alter table finance.accounting_periods
drop constraint if exists accounting_periods_property_no_overlap;


-- SELECTED EFFECT B.E025
alter table finance.accounting_periods
add constraint accounting_periods_property_no_overlap
exclude using gist (
  tenant_id with =,
  property_id with =,
  (daterange(starts_on, ends_on, '[]'::text)) with &&
) where (property_id is not null);


-- SELECTED EFFECT B.E026
alter table finance.accounting_periods
drop constraint if exists accounting_periods_tenant_no_overlap;


-- SELECTED EFFECT B.E027
alter table finance.accounting_periods
add constraint accounting_periods_tenant_no_overlap
exclude using gist (
  tenant_id with =,
  (daterange(starts_on, ends_on, '[]'::text)) with &&
) where (property_id is null);


-- SELECTED EFFECT B.E029
alter table platform.property_profiles enable row level security;


-- SELECTED EFFECT B.E030
alter table platform.operating_models enable row level security;


-- SELECTED EFFECT B.E031
alter table platform.space_kinds enable row level security;


-- SELECTED EFFECT B.E032
alter table platform.property_operating_model_compatibilities enable row level security;


-- SELECTED EFFECT B.E033
alter table platform.property_space_kind_compatibilities enable row level security;


-- SELECTED EFFECT B.E034
alter table platform.workspace_taxonomy_assignments enable row level security;


-- SELECTED EFFECT B.E035
alter table platform.workspace_property_bindings enable row level security;


-- SELECTED EFFECT B.E036
alter table platform.workspace_taxonomy_assignments
  add column if not exists country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$');


-- SELECTED EFFECT B.E037
alter table platform.module_definitions enable row level security;


-- SELECTED EFFECT B.E038
alter table platform.module_property_profile_compatibilities enable row level security;


-- SELECTED EFFECT B.E039
alter table platform.module_operating_model_compatibilities enable row level security;


-- SELECTED EFFECT B.E040
alter table platform.workspace_modules enable row level security;


-- SELECTED EFFECT B.E041
alter table platform.module_permission_bindings enable row level security;


-- SELECTED EFFECT B.E042
alter table platform.workspace_roles enable row level security;


-- SELECTED EFFECT B.E043
alter table platform.workspace_role_modules enable row level security;


-- SELECTED EFFECT B.E044
alter table platform.workspace_role_permissions enable row level security;


-- SELECTED EFFECT B.E045
alter table platform.workspace_member_roles enable row level security;


-- SELECTED EFFECT B.E046
alter table platform.workspace_role_idempotency enable row level security;


-- SELECTED EFFECT B.E047
alter table platform.workspace_delegations enable row level security;


-- SELECTED EFFECT B.E048
alter table platform.workspace_delegation_permissions enable row level security;


-- SELECTED EFFECT B.E049
alter table portfolio.properties
  add constraint properties_tenant_id_id_uq unique (tenant_id,id);


-- SELECTED EFFECT B.E050
alter table platform.workspace_access_bases enable row level security;


-- SELECTED EFFECT B.E052
alter table platform.customer_workspaces add constraint customer_workspaces_id_tenant_airprop_key unique(id,tenant_id);


-- SELECTED EFFECT B.E053
alter table platform.workspace_member_roles
  add column assigned_by_context_grant_id uuid references identity.context_grants(id) on delete restrict,
  add column authority_policy_version smallint not null default 1 check(authority_policy_version in (1,2)),
  add column authority_depth smallint not null default 0 check(authority_depth between 0 and 4);


-- SELECTED EFFECT B.E054
alter table platform.workspace_member_role_authority_sources enable row level security;


-- SELECTED EFFECT B.E055
alter table app_private.canonical_authority_revision_v1 enable row level security;


-- SELECTED EFFECT B.E083
alter table portfolio.addresses alter column country_code drop default;


-- SELECTED EFFECT B.E084
alter table portfolio.addresses
  add constraint addresses_country_code_explicit_v1
  check(country_code::text ~ '^[A-Z]{2}$') not valid;


-- SELECTED EFFECT B.E085
alter table portfolio.addresses
  validate constraint addresses_country_code_explicit_v1;


-- SELECTED EFFECT B.E086
alter table platform.jurisdiction_profiles enable row level security;


-- SELECTED EFFECT B.E087
alter table platform.property_jurisdiction_assignments enable row level security;


-- SELECTED EFFECT B.E088
alter table portfolio.parties enable row level security;


-- SELECTED EFFECT B.E089
alter table portfolio.units enable row level security;


-- SELECTED EFFECT B.E090
alter table portfolio.buildings enable row level security;


-- SELECTED EFFECT B.E091
alter table platform.workspace_property_bindings enable row level security;


-- SELECTED EFFECT B.E092
alter table platform.customer_workspaces enable row level security;


-- SELECTED EFFECT B.E093
alter table platform.workspace_entitlements enable row level security;


-- SELECTED EFFECT B.E094
alter table identity.context_grants enable row level security;


-- SELECTED EFFECT B.E095
alter table identity.memberships enable row level security;


-- SELECTED EFFECT B.E096
alter table platform.module_definitions enable row level security;


-- SELECTED EFFECT B.E097
alter table app_private.canonical_authority_revision_v1 enable row level security;


-- SELECTED EFFECT B.E098
alter table audit.events enable row level security;


-- SELECTED EFFECT B.E099
alter table platform.outbox_events enable row level security;


-- SELECTED EFFECT B.SD67
insert into app_private.canonical_authority_revision_v1(singleton,revision) values(true,1);


-- SELECTED EFFECT B.N01
create function app_private.require_building_session_current_v1()
returns void language plpgsql stable security definer set search_path=pg_catalog
as $n01$
declare actor uuid; claims jsonb; sid uuid; expiry numeric; now_at timestamptz:=statement_timestamp();
begin
 begin
  actor:=auth.uid(); claims:=auth.jwt(); sid:=(claims->>'session_id')::uuid;
  expiry:=(claims->>'exp')::numeric;
  if actor is null or (claims->>'sub')::uuid is distinct from actor
   or claims->>'role' is distinct from 'authenticated' or claims->>'aal' is distinct from 'aal2'
   or sid is null or expiry is null or expiry::text in ('NaN','Infinity','-Infinity')
   or expiry<=extract(epoch from now_at)
   or not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=actor
      and (s.not_after is null or s.not_after>now_at)) then
   raise exception using errcode='42501',message='setup_session_not_current';
  end if;
 exception when others then
  raise exception using errcode='42501',message='setup_session_not_current';
 end;
end;
$n01$;


-- SELECTED EFFECT B.OC1.N01
revoke all privileges on function app_private.require_building_session_current_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.N01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.require_building_session_current_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.require_building_session_current_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F18
create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F18
revoke all privileges on function app_private.set_updated_at() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F18
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.set_updated_at()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.set_updated_at() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F20
create or replace function finance.protect_accounting_period()
returns trigger language plpgsql security definer set search_path=pg_catalog,finance
as $$ begin
  if old.status='closed' then raise exception 'closed_accounting_period_is_immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;


-- SELECTED EFFECT B.OC1.F20
revoke all privileges on function finance.protect_accounting_period() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F20
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.protect_accounting_period()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.protect_accounting_period() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F21
create or replace function finance.assert_accounting_period_no_overlap()
returns trigger
language plpgsql
set search_path = finance, platform, extensions, public
as $$
declare
  v_overlap_count int;
begin
  -- Serialize concurrent period operations for the same tenant
  perform 1
  from platform.tenants
  where id = new.tenant_id
  for update;

  -- Rule A: Tenant-wide period must not overlap with ANY period of the same tenant
  if new.property_id is null then
    select count(*) into v_overlap_count
    from finance.accounting_periods p
    where p.tenant_id = new.tenant_id
      and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(p.starts_on, p.ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]');

    if v_overlap_count > 0 then
      raise exception 'Tenant-wide accounting period cannot overlap with any tenant or property period'
        using errcode = '23P01';
    end if;
  else
    -- Rule B: Property-specific period must not overlap with any tenant-wide period of the same tenant
    select count(*) into v_overlap_count
    from finance.accounting_periods p
    where p.tenant_id = new.tenant_id
      and p.property_id is null
      and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and daterange(p.starts_on, p.ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]');

    if v_overlap_count > 0 then
      raise exception 'Property accounting period cannot overlap with existing tenant-wide period'
        using errcode = '23P01';
    end if;
  end if;

  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F21
revoke all privileges on function finance.assert_accounting_period_no_overlap() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F21
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.assert_accounting_period_no_overlap()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.assert_accounting_period_no_overlap() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F22
create or replace function finance.assert_accounting_period_property_tenant()
returns trigger
language plpgsql
set search_path = finance, portfolio, platform, public
as $$
declare
  v_prop_tenant uuid;
begin
  if new.property_id is not null then
    select tenant_id into v_prop_tenant
    from portfolio.properties
    where id = new.property_id;

    if not found then
      raise exception 'Property % does not exist', new.property_id
        using errcode = '23503';
    end if;

    if v_prop_tenant <> new.tenant_id then
      raise exception 'Accounting period property (%) belongs to tenant %, not period tenant %',
        new.property_id, v_prop_tenant, new.tenant_id
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F22
revoke all privileges on function finance.assert_accounting_period_property_tenant() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F22
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.assert_accounting_period_property_tenant()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.assert_accounting_period_property_tenant() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F23
create or replace function app_private.guard_taxonomy_version_effective_period_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_overlap boolean;
begin
  if new.is_active = true and new.lifecycle_status = 'active' then
    -- Deterministic transactional lock per (table, code) to serialize concurrent version inserts
    perform pg_advisory_xact_lock(hashtextextended(TG_TABLE_SCHEMA || ':' || TG_TABLE_NAME || ':' || new.code, 0));

    if TG_TABLE_NAME = 'property_profiles' then
      select exists (
        select 1 from platform.property_profiles p
        where p.code = new.code
          and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and p.is_active = true and p.lifecycle_status = 'active'
          and (
            (p.valid_to is null and (new.valid_to is null or new.valid_to > p.valid_from))
            or
            (p.valid_to is not null and new.valid_from < p.valid_to and (new.valid_to is null or new.valid_to > p.valid_from))
          )
      ) into v_overlap;
    elsif TG_TABLE_NAME = 'operating_models' then
      select exists (
        select 1 from platform.operating_models m
        where m.code = new.code
          and m.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and m.is_active = true and m.lifecycle_status = 'active'
          and (
            (m.valid_to is null and (new.valid_to is null or new.valid_to > m.valid_from))
            or
            (m.valid_to is not null and new.valid_from < m.valid_to and (new.valid_to is null or new.valid_to > m.valid_from))
          )
      ) into v_overlap;
    elsif TG_TABLE_NAME = 'space_kinds' then
      select exists (
        select 1 from platform.space_kinds s
        where s.code = new.code
          and s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and s.is_active = true and s.lifecycle_status = 'active'
          and (
            (s.valid_to is null and (new.valid_to is null or new.valid_to > s.valid_from))
            or
            (s.valid_to is not null and new.valid_from < s.valid_to and (new.valid_to is null or new.valid_to > s.valid_from))
          )
      ) into v_overlap;
    end if;

    if coalesce(v_overlap, false) then
      raise exception 'workspace_taxonomy_version_effective_period_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F23
revoke all privileges on function app_private.guard_taxonomy_version_effective_period_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F23
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_taxonomy_version_effective_period_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_taxonomy_version_effective_period_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F24
create or replace function app_private.guard_taxonomy_record_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_TABLE_NAME = 'property_profiles' then
    if exists (select 1 from platform.workspace_taxonomy_assignments where property_profile_id = old.id)
       or exists (select 1 from platform.property_operating_model_compatibilities where property_profile_id = old.id)
       or exists (select 1 from platform.property_space_kind_compatibilities where property_profile_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'operating_models' then
    if exists (select 1 from platform.workspace_taxonomy_assignments where operating_model_id = old.id)
       or exists (select 1 from platform.property_operating_model_compatibilities where operating_model_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'space_kinds' then
    if exists (select 1 from platform.property_space_kind_compatibilities where space_kind_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  end if;
  return old;
end;
$$;


-- SELECTED EFFECT B.OC1.F24
revoke all privileges on function app_private.guard_taxonomy_record_immutability_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F24
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_taxonomy_record_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_taxonomy_record_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F25
create or replace function app_private.guard_workspace_taxonomy_assignment_history_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.property_profile_id <> new.property_profile_id
       or old.operating_model_id <> new.operating_model_id
       or (old.country_code is distinct from new.country_code)
       or (old.created_by is distinct from new.created_by)
       or old.created_at <> new.created_at
       or old.valid_from <> new.valid_from then
      raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F25
revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_history_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F25
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_taxonomy_assignment_history_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_history_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F26
create or replace function app_private.guard_workspace_property_binding_history_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_property_binding_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.property_id <> new.property_id
       or old.binding_source <> new.binding_source
       or (old.created_by is distinct from new.created_by)
       or old.created_at <> new.created_at
       or old.valid_from <> new.valid_from then
      raise exception 'workspace_property_binding_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F26
revoke all privileges on function app_private.guard_workspace_property_binding_history_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F26
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_property_binding_history_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_property_binding_history_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F27
create or replace function app_private.guard_workspace_property_binding_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, portfolio
as $$
declare
  v_workspace_tenant uuid;
  v_property_tenant uuid;
begin
  -- 1. Lock and validate Property tenant (serialize concurrent bindings targeting the same property)
  select tenant_id into v_property_tenant
  from portfolio.properties
  where id = new.property_id
  for update;

  if not found then
    raise exception 'workspace_property_binding_property_not_found' using errcode = 'P0002';
  end if;

  if v_property_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
  end if;

  -- 2. Validate Customer Workspace tenant
  select tenant_id into v_workspace_tenant
  from platform.customer_workspaces
  where id = new.customer_workspace_id
  for update;

  if not found then
    raise exception 'workspace_property_binding_workspace_not_found' using errcode = 'P0002';
  end if;

  if v_workspace_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
  end if;

  -- 3. Non-overlapping active bindings for this property
  if new.status = 'active' then
    if exists (
      select 1 from platform.workspace_property_bindings b
      where b.property_id = new.property_id
        and b.status = 'active'
        and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          (b.valid_to is null and (new.valid_to is null or new.valid_to > b.valid_from))
          or
          (b.valid_to is not null and new.valid_from < b.valid_to and (new.valid_to is null or new.valid_to > b.valid_from))
        )
    ) then
      raise exception 'workspace_property_binding_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F27
revoke all privileges on function app_private.guard_workspace_property_binding_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F27
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_property_binding_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_property_binding_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F28
create or replace function app_private.guard_workspace_taxonomy_assignment_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, app_private
as $$
declare
  v_workspace_tenant uuid;
  v_compat_level text;
  v_profile_active boolean;
  v_model_active boolean;
begin
  -- 1. Tenant boundary check
  select tenant_id into v_workspace_tenant from platform.customer_workspaces where id = new.customer_workspace_id for update;
  if not found then
    raise exception 'workspace_taxonomy_not_found' using errcode = 'P0002';
  end if;
  if v_workspace_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_tenant_mismatch' using errcode = '42501';
  end if;

  -- 2. Verify Profile and Operating Model active status
  select is_active into v_profile_active from platform.property_profiles
  where id = new.property_profile_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_profile_active, false) then
    raise exception 'workspace_taxonomy_profile_inactive' using errcode = '22023';
  end if;

  select is_active into v_model_active from platform.operating_models
  where id = new.operating_model_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_model_active, false) then
    raise exception 'workspace_taxonomy_operating_model_inactive' using errcode = '22023';
  end if;

  -- 3. Evaluate Compatibility Rule
  select compatibility_level into v_compat_level
  from platform.property_operating_model_compatibilities
  where property_profile_id = new.property_profile_id
    and operating_model_id = new.operating_model_id
  order by rule_version desc limit 1;

  if v_compat_level is null then
    raise exception 'workspace_taxonomy_compatibility_rule_missing' using errcode = 'P0001';
  end if;

  if v_compat_level = 'incompatible' then
    raise exception 'workspace_taxonomy_incompatible_assignment' using errcode = 'P0001';
  elsif v_compat_level = 'review_required' then
    if new.status = 'active' and (new.notes is null or length(trim(new.notes)) = 0) then
      raise exception 'workspace_taxonomy_review_required' using errcode = 'P0001';
    end if;
  end if;

  -- 4. Check for overlapping active assignments for this workspace
  if new.status = 'active' then
    if exists (
      select 1 from platform.workspace_taxonomy_assignments a
      where a.customer_workspace_id = new.customer_workspace_id
        and a.status = 'active'
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          (a.valid_to is null and (new.valid_to is null or new.valid_to > a.valid_from))
          or
          (a.valid_to is not null and new.valid_from < a.valid_to and (new.valid_to is null or new.valid_to > a.valid_from))
        )
    ) then
      raise exception 'workspace_taxonomy_assignment_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F28
revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F28
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_taxonomy_assignment_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F29
create or replace function app_private.bootstrap_role_taxonomy_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  if lower(new.code) in ('association_admin', 'property_manager') then
    insert into identity.role_permissions (role_id, permission_id, effect)
    select new.id, p.id, 'allow'
    from identity.permissions p
    where p.code = 'workspace.taxonomy.manage'
    on conflict do nothing;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F29
revoke all privileges on function app_private.bootstrap_role_taxonomy_permissions_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F29
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_taxonomy_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_taxonomy_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F30
create or replace function app_private.bootstrap_role_module_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  -- Only grant to canonical global system management roles (tenant_id is null, is_system = true)
  -- Rogue/spoof roles with prefix/suffix or non-canonical properties are strictly rejected
  if new.code in ('association_admin', 'property_manager')
     and new.tenant_id is null
     and new.is_system = true
     and new.name is not null and length(trim(new.name)) > 0 then
    insert into identity.role_permissions (role_id, permission_id, effect)
    select new.id, p.id, 'allow'
    from identity.permissions p
    where p.code = 'workspace.module.manage'
    on conflict do nothing;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F30
revoke all privileges on function app_private.bootstrap_role_module_permissions_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F30
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_module_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_module_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F31
create or replace function app_private.guard_module_definition_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    if old.lifecycle_status in ('active', 'published') then
      raise exception 'platform_module_definition_immutable' using errcode = '42501';
    end if;
  elsif TG_OP = 'UPDATE' then
    if old.lifecycle_status in ('active', 'published') then
      if old.id <> new.id
         or old.code <> new.code
         or old.version <> new.version
         or old.name <> new.name
         or old.description <> new.description
         or old.entitlement_key <> new.entitlement_key
         or old.requires_aal2 <> new.requires_aal2
         or old.sensitivity_level <> new.sensitivity_level
         or old.category <> new.category
         or old.labels_json <> new.labels_json
         or old.config_schema <> new.config_schema
         or old.created_at <> new.created_at
         or old.valid_from <> new.valid_from then
        raise exception 'platform_module_definition_immutable' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F31
revoke all privileges on function app_private.guard_module_definition_immutability_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F31
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_definition_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_definition_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F32
create or replace function app_private.guard_module_definition_effective_period_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_overlap boolean;
begin
  if new.is_active = true and new.lifecycle_status in ('active', 'published') then
    if new.valid_to is not null and new.valid_to <= new.valid_from then
      return new; -- Allow table check constraint (valid_to is null or valid_to > valid_from) to raise check_violation (23514)
    end if;

    perform pg_advisory_xact_lock(hashtextextended('module_definition:' || new.code, 0));

    select exists (
      select 1
      from platform.module_definitions d
      where d.code = new.code
        and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and d.is_active = true
        and d.lifecycle_status in ('active', 'published')
        and tstzrange(d.valid_from, coalesce(d.valid_to, 'infinity'), '[)') &&
            tstzrange(new.valid_from, coalesce(new.valid_to, 'infinity'), '[)')
    ) into v_overlap;

    if v_overlap then
      raise exception 'platform_module_definition_version_overlap' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F32
revoke all privileges on function app_private.guard_module_definition_effective_period_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F32
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_definition_effective_period_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_definition_effective_period_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F33
create or replace function app_private.guard_workspace_module_code_sync_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_expected_code text;
  v_expected_tenant uuid;
begin
  select code into v_expected_code
  from platform.module_definitions
  where id = new.module_definition_id;

  if v_expected_code is null then
    raise exception 'workspace_module_definition_not_found' using errcode = 'P0002';
  end if;

  if new.module_code <> v_expected_code then
    raise exception 'workspace_module_code_mismatch' using errcode = '22023';
  end if;

  select tenant_id into v_expected_tenant
  from platform.customer_workspaces
  where id = new.customer_workspace_id;

  if v_expected_tenant is null or new.tenant_id <> v_expected_tenant then
    raise exception 'workspace_module_tenant_mismatch' using errcode = '42501';
  end if;

  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F33
revoke all privileges on function app_private.guard_workspace_module_code_sync_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F33
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_module_code_sync_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_module_code_sync_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F34
create or replace function app_private.guard_workspace_module_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_module_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.valid_to is not null then
      raise exception 'workspace_module_history_immutable' using errcode = '42501';
    end if;
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.module_definition_id <> new.module_definition_id
       or old.module_code <> new.module_code
       or old.valid_from <> new.valid_from
       or old.activated_at <> new.activated_at
       or old.activated_by is distinct from new.activated_by
       or old.config_json <> new.config_json
       or old.created_at <> new.created_at then
      raise exception 'workspace_module_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F34
revoke all privileges on function app_private.guard_workspace_module_immutability_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F34
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_module_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_module_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F35
create or replace function app_private.bootstrap_role_workspace_role_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  if new.tenant_id is null and new.is_system = true and new.name is not null and length(trim(new.name)) > 0 then
    if new.code in ('association_admin', 'property_manager') then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.role.read', 'workspace.role.manage', 'workspace.role.publish', 'workspace.role.assign')
      on conflict do nothing;
    elsif new.code in ('president', 'censor') then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code = 'workspace.role.read'
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F35
revoke all privileges on function app_private.bootstrap_role_workspace_role_permissions_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F35
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_workspace_role_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_workspace_role_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F36
create or replace function app_private.guard_module_permission_binding_invariants_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_mod_status text;
  v_perm_code text;
begin
  if tg_op = 'UPDATE' then
    -- Allow controlled forward-close handoff: only lifecycle_status active -> deprecated and valid_to null -> timestamp
    if old.binding_version = new.binding_version
       and old.module_definition_id = new.module_definition_id
       and old.permission_id = new.permission_id
       and old.is_assignable_to_local_role = new.is_assignable_to_local_role
       and old.is_delegable = new.is_delegable
       and old.requires_aal2 = new.requires_aal2
       and old.valid_from = new.valid_from
       and old.lifecycle_status = 'active'
       and new.lifecycle_status = 'deprecated'
       and old.valid_to is null
       and new.valid_to is not null
    then
      return new;
    end if;
    raise exception 'module_permission_binding_historical_records_are_immutable' using errcode = '42501';
  end if;

  -- Validation for INSERT
  select code into v_perm_code from identity.permissions where id = new.permission_id;
  select lifecycle_status into v_mod_status from platform.module_definitions where id = new.module_definition_id;

  if v_mod_status = 'catalog_only' then
    raise exception 'catalog_only_modules_cannot_have_permission_bindings' using errcode = '42501';
  end if;

  -- Strict Non-Delegable Invariant
  if new.is_delegable is true then
    if v_perm_code in (
      'billing.cancel',
      'payments.reverse',
      'payments.reconcile',
      'utilities.tariffs.manage',
      'governance.votes.administer',
      'governance.minutes.finalize',
      'workspace.role.read',
      'workspace.role.manage',
      'workspace.role.publish',
      'workspace.role.assign',
      'workspace.delegation.read',
      'workspace.delegation.manage',
      'workspace.delegation.approve',
      'workspace.delegation.revoke'
    ) then
      raise exception 'permission_is_strictly_non_delegable: %', v_perm_code using errcode = '42501';
    end if;
  end if;

  -- Prevent temporal overlap among active records
  if new.lifecycle_status = 'active' and exists (
    select 1 from platform.module_permission_bindings b
    where b.module_definition_id = new.module_definition_id
      and b.permission_id = new.permission_id
      and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and b.lifecycle_status = 'active'
      and (
        (new.valid_to is null and b.valid_to is null) or
        (new.valid_to is null and b.valid_to > new.valid_from) or
        (b.valid_to is null and new.valid_to > b.valid_from) or
        (new.valid_from < b.valid_to and new.valid_to > b.valid_from)
      )
  ) then
    raise exception 'active_module_permission_binding_temporal_overlap' using errcode = '42501';
  end if;

  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F36
revoke all privileges on function app_private.guard_module_permission_binding_invariants_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F36
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_permission_binding_invariants_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_permission_binding_invariants_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F37
create or replace function app_private.guard_workspace_role_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'workspace_role_delete_prohibited' using errcode = '42501';
  end if;

  if old.lifecycle_status = 'archived' then
    raise exception 'workspace_role_archived_immutable' using errcode = '42501';
  end if;

  if old.lifecycle_status = 'published' then
    -- Only permitted transition is published -> archived
    if new.lifecycle_status = 'archived' then
      if new.valid_to is null or new.valid_to < old.valid_from then
        raise exception 'archived_role_requires_valid_to' using errcode = '22023';
      end if;
      -- Immutable fields cannot be modified during supersession
      if new.id <> old.id
         or new.tenant_id <> old.tenant_id
         or new.customer_workspace_id <> old.customer_workspace_id
         or new.code <> old.code
         or new.role_version <> old.role_version
         or new.name <> old.name
         or new.description is distinct from old.description
         or new.base_role_id is distinct from old.base_role_id
         or new.scope_ceiling <> old.scope_ceiling
         or new.valid_from <> old.valid_from
         or new.created_by <> old.created_by
         or new.created_at <> old.created_at
         or new.lock_version <> old.lock_version + 1 then
        raise exception 'published_workspace_role_content_immutable' using errcode = '42501';
      end if;
    else
      raise exception 'published_workspace_role_immutable' using errcode = '42501';
    end if;
  end if;

  if old.lifecycle_status = 'draft' then
    if new.lifecycle_status not in ('draft', 'published') then
      raise exception 'draft_role_invalid_lifecycle_transition' using errcode = '42501';
    end if;
    if new.id <> old.id
       or new.tenant_id <> old.tenant_id
       or new.customer_workspace_id <> old.customer_workspace_id
       or new.code <> old.code
       or new.role_version <> old.role_version
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception 'draft_role_identity_immutable' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F37
revoke all privileges on function app_private.guard_workspace_role_immutability_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F37
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F38
create or replace function app_private.guard_workspace_role_module_draft_only_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_role_status text;
  v_target_role_id uuid;
begin
  v_target_role_id := case when tg_op = 'DELETE' then old.workspace_role_id else new.workspace_role_id end;

  select lifecycle_status into v_role_status
  from platform.workspace_roles
  where id = v_target_role_id;

  if v_role_status is null or v_role_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- SELECTED EFFECT B.OC1.F38
revoke all privileges on function app_private.guard_workspace_role_module_draft_only_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F38
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_module_draft_only_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_module_draft_only_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F39
create or replace function app_private.guard_workspace_role_permission_bindings_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_role_status text;
  v_target_role_id uuid;
begin
  v_target_role_id := case when tg_op = 'DELETE' then old.workspace_role_id else new.workspace_role_id end;

  select lifecycle_status into v_role_status
  from platform.workspace_roles
  where id = v_target_role_id;

  if v_role_status is null or v_role_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    -- Guard: Permission must be registered and assignable for at least one module currently attached to this role
    if not exists (
      select 1
      from platform.workspace_role_modules wrm
      join platform.module_permission_bindings mpb
        on mpb.module_definition_id = wrm.module_definition_id
      where wrm.workspace_role_id = new.workspace_role_id
        and mpb.permission_id = new.permission_id
        and mpb.is_assignable_to_local_role = true
        and mpb.lifecycle_status = 'active'
        and mpb.valid_from <= statement_timestamp()
        and (mpb.valid_to is null or mpb.valid_to > statement_timestamp())
    ) then
      raise exception 'permission_not_assignable_to_role_modules' using errcode = '42501';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- SELECTED EFFECT B.OC1.F39
revoke all privileges on function app_private.guard_workspace_role_permission_bindings_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F39
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_permission_bindings_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_permission_bindings_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F40
create or replace function app_private.guard_workspace_member_role_invariants_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, portfolio, identity
as $$
declare
  v_role record;
  v_mem record;
  v_bld record;
  v_unit record;
  v_ceiling_rank integer;
  v_scope_rank integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'workspace_member_role_delete_prohibited' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    -- Reopening prohibited: once revoked, no updates are allowed
    if old.valid_to is not null and old.valid_to <= statement_timestamp() then
      raise exception 'workspace_member_role_already_revoked' using errcode = '42501';
    end if;

    -- All identity, scope, role, membership, timestamps, and creator provenance fields are strictly immutable
    if new.id <> old.id
       or new.customer_workspace_id <> old.customer_workspace_id
       or new.tenant_id <> old.tenant_id
       or new.membership_id <> old.membership_id
       or new.workspace_role_id <> old.workspace_role_id
       or new.scope_type <> old.scope_type
       or new.property_id is distinct from old.property_id
       or new.building_id is distinct from old.building_id
       or new.unit_id is distinct from old.unit_id
       or new.valid_from <> old.valid_from
       or new.created_at <> old.created_at
       or new.assigned_by_user_id <> old.assigned_by_user_id
       or new.assigned_by_membership_id <> old.assigned_by_membership_id then
      raise exception 'workspace_member_role_fields_immutable' using errcode = '42501';
    end if;

    -- Revocation transition only: valid_to must transition from NULL to a valid timestamp
    if new.valid_to is null or new.valid_to < old.valid_from
       or new.valid_to > statement_timestamp()
       or (old.valid_to is not null and new.valid_to >= old.valid_to) then
      raise exception 'workspace_member_role_update_must_be_revocation' using errcode = '42501';
    end if;

    -- lock_version must increment by exactly 1
    if new.lock_version <> old.lock_version + 1 then
      raise exception 'workspace_member_role_expected_lock_version_conflict' using errcode = '40001';
    end if;

    -- Reason must be valid
    if new.reason is null or length(trim(new.reason)) < 5 then
      raise exception 'workspace_member_role_reason_invalid' using errcode = '22023';
    end if;

    return new;
  end if;

  -- INSERT Validations:
  -- 1. Tenant & Membership consistency and active validity
  select * into v_mem
  from identity.memberships
  where id = new.membership_id;

  if not found or v_mem.tenant_id <> new.tenant_id or v_mem.status <> 'active'
     or v_mem.starts_at > statement_timestamp()
     or (v_mem.ends_at is not null and v_mem.ends_at <= statement_timestamp()) then
    raise exception 'workspace_member_role_target_membership_invalid' using errcode = '42501';
  end if;

  -- 2. Role Status & Tenant/Workspace consistency
  select * into v_role
  from platform.workspace_roles
  where id = new.workspace_role_id;

  if not found or v_role.tenant_id <> new.tenant_id or v_role.customer_workspace_id <> new.customer_workspace_id then
    raise exception 'workspace_member_role_cross_workspace_prohibited' using errcode = '42501';
  end if;

  if v_role.lifecycle_status <> 'published' or (v_role.valid_to is not null and v_role.valid_to <= statement_timestamp()) then
    raise exception 'workspace_role_not_published' using errcode = '42501';
  end if;

  -- 3. Scope Ceiling Enforcement: workspace(0) > property(1) > building(2) > unit(3)
  v_ceiling_rank := case v_role.scope_ceiling
    when 'workspace' then 0
    when 'property' then 1
    when 'building' then 2
    when 'unit' then 3
    else 99
  end;

  v_scope_rank := case new.scope_type
    when 'workspace' then 0
    when 'property' then 1
    when 'building' then 2
    when 'unit' then 3
    else 99
  end;

  if v_scope_rank < v_ceiling_rank then
    raise exception 'workspace_member_role_exceeds_scope_ceiling' using errcode = '42501';
  end if;

  -- 4. Scope Ancestry & Workspace Property Binding
  if new.property_id is not null then
    if not exists (
      select 1 from platform.workspace_property_bindings
      where customer_workspace_id = new.customer_workspace_id
        and property_id = new.property_id
        and status = 'active'
        and valid_from <= statement_timestamp()
        and (valid_to is null or valid_to > statement_timestamp())
    ) then
      raise exception 'property_not_bound_to_workspace' using errcode = '42501';
    end if;
  end if;

  if new.building_id is not null then
    select * into v_bld from portfolio.buildings where id = new.building_id;
    if not found or v_bld.property_id <> new.property_id or v_bld.tenant_id <> new.tenant_id then
      raise exception 'building_scope_ancestry_mismatch' using errcode = '22023';
    end if;
  end if;

  if new.unit_id is not null then
    select * into v_unit from portfolio.units where id = new.unit_id;
    if not found or v_unit.building_id <> new.building_id or v_unit.tenant_id <> new.tenant_id then
      raise exception 'unit_scope_ancestry_mismatch' using errcode = '22023';
    end if;
  end if;

  -- 5. Temporal Non-Overlap for identical assignment target
  if exists (
    select 1 from platform.workspace_member_roles r
    where r.customer_workspace_id = new.customer_workspace_id
      and r.membership_id = new.membership_id
      and r.workspace_role_id = new.workspace_role_id
      and r.scope_type = new.scope_type
      and r.property_id is not distinct from new.property_id
      and r.building_id is not distinct from new.building_id
      and r.unit_id is not distinct from new.unit_id
      and (r.valid_to is null or r.valid_to > new.valid_from)
  ) then
    raise exception 'workspace_member_role_overlapping_assignment' using errcode = '23505';
  end if;

  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F40
revoke all privileges on function app_private.guard_workspace_member_role_invariants_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F40
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_member_role_invariants_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_member_role_invariants_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F41
create or replace function app_private.bootstrap_role_workspace_delegation_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  if new.tenant_id is null and new.is_system = true and new.name is not null and length(trim(new.name)) > 0 then
    if new.code in ('association_admin', 'property_manager') then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.delegation.read', 'workspace.delegation.manage', 'workspace.delegation.approve', 'workspace.delegation.revoke')
      on conflict do nothing;
    elsif new.code = 'president' then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.delegation.read', 'workspace.delegation.approve', 'workspace.delegation.revoke')
      on conflict do nothing;
    elsif new.code = 'censor' then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.delegation.read', 'workspace.delegation.approve')
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F41
revoke all privileges on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F41
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_workspace_delegation_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F42
create or replace function platform.cap_customer_membership_to_access_basis()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_end timestamptz; v_now timestamptz:=pg_catalog.statement_timestamp(); v_prepared record; v_prepared_end timestamptz;
begin
  if new.status<>'active' or not exists(
    select 1 from platform.workspace_access_bases b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id
    where w.tenant_id=new.tenant_id
  ) then return new; end if;
  select max(b.expires_at) into v_end from platform.workspace_access_bases b
  join platform.customer_workspaces w on w.id=b.customer_workspace_id
  where w.tenant_id=new.tenant_id and b.status='active' and b.expires_at>v_now;
  if v_end is null then
    -- The initial primary-admin activation is the only permitted membership
    -- while the decision is prepared. It must already carry a bounded expiry.
    select b.* into v_prepared from platform.workspace_access_bases b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id
    join auth.users u on pg_catalog.lower(pg_catalog.btrim(u.email))=b.normalized_email
    where w.tenant_id=new.tenant_id and w.lifecycle_status='PROVISIONING'
      and b.status='prepared' and b.approved_at+interval '7 days'>v_now
      and u.id=new.user_id and new.user_id=auth.uid()
      and coalesce(auth.jwt()->>'aal','')='aal2'
      and (b.mode='PILOT' or exists(select 1 from platform.workspace_contracts c
        where c.id=b.contract_id and c.status='active' and c.signed_at is not null
          and b.paid_through>=(v_now at time zone 'Europe/Bucharest')::date))
      and b.role_id=new.role_id and u.email_confirmed_at is not null
    limit 1;
    if not found then raise exception 'commercial_access_basis_required' using errcode='42501'; end if;
    if v_prepared.mode='PILOT' then
      v_prepared_end:=v_now+pg_catalog.make_interval(hours=>v_prepared.duration_hours);
    else
      v_prepared_end:=(v_prepared.paid_through+1)::timestamp at time zone 'Europe/Bucharest';
    end if;
    if new.ends_at is null or new.ends_at > v_prepared_end
      or new.ends_at<=v_now then
      raise exception 'commercial_access_basis_required' using errcode='42501';
    end if;
    return new;
  end if;
  if new.ends_at is null or new.ends_at>v_end then new.ends_at:=v_end; end if;
  if new.ends_at<=v_now then raise exception 'commercial_access_expired' using errcode='42501'; end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F42
revoke all privileges on function platform.cap_customer_membership_to_access_basis() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F42
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.cap_customer_membership_to_access_basis()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.cap_customer_membership_to_access_basis() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F43
create or replace function platform.cap_customer_context_to_membership()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_end timestamptz; v_tenant uuid;
begin
  select m.ends_at,m.tenant_id into v_end,v_tenant from identity.memberships m where m.id=new.membership_id;
  if v_tenant is null or v_tenant<>new.tenant_id then
    raise exception 'context_membership_tenant_mismatch' using errcode='42501';
  end if;
  if v_end is not null and (new.ends_at is null or new.ends_at>v_end) then new.ends_at:=v_end; end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F43
revoke all privileges on function platform.cap_customer_context_to_membership() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F43
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.cap_customer_context_to_membership()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.cap_customer_context_to_membership() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F44
create or replace function platform.require_workspace_access_basis_for_provisioning()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.lifecycle_status='PROVISIONING' and old.lifecycle_status<>'PROVISIONING'
    and not exists (
      select 1 from platform.workspace_access_bases b
      left join platform.workspace_contracts c on c.id=b.contract_id
      where b.customer_workspace_id=new.id
        and ((b.status='prepared' and b.approved_at+interval '7 days'>pg_catalog.statement_timestamp())
          or (b.status='active' and b.expires_at>pg_catalog.statement_timestamp()))
        and ((b.mode='PILOT' and new.environment='PILOT')
          or (b.mode='PAID' and c.status='active' and c.signed_at is not null
            and b.paid_through>=(pg_catalog.statement_timestamp() at time zone 'Europe/Bucharest')::date))
    ) then
    raise exception 'prepared_commercial_or_pilot_basis_required' using errcode='55000';
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F44
revoke all privileges on function platform.require_workspace_access_basis_for_provisioning() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F44
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.require_workspace_access_basis_for_provisioning()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.require_workspace_access_basis_for_provisioning() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F45
create function app_private.guard_undefined_primary_role_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_type platform.workspace_type; v_role text;
begin
  select workspace_type into v_type from platform.customer_workspaces
  where id=new.customer_workspace_id;
  if not found then return new; end if;
  if v_type in ('OWNER_PORTFOLIO','HYBRID') then
    if tg_table_name='workspace_access_bases' then
      raise exception 'workspace_primary_admin_role_not_defined' using errcode='22023';
    end if;
    select code into v_role from identity.roles where id=new.role_id;
    if v_role in ('association_admin','property_manager') then
      raise exception 'workspace_primary_admin_role_not_defined' using errcode='22023';
    end if;
  end if;
  return new;
end $$;


-- SELECTED EFFECT B.OC1.F45
revoke all privileges on function app_private.guard_undefined_primary_role_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F45
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_undefined_primary_role_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_undefined_primary_role_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F48
create or replace function app_private.guard_workspace_role_authority_source_immutable_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 raise exception 'workspace_role_authority_source_immutable' using errcode='42501';
end;
$$;


-- SELECTED EFFECT B.OC1.F48
revoke all privileges on function app_private.guard_workspace_role_authority_source_immutable_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F48
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_authority_source_immutable_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_authority_source_immutable_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F50
create function app_private.guard_authority_revision_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if tg_op <> 'UPDATE' or pg_trigger_depth() < 2
    or new.singleton is distinct from old.singleton
    or new.revision <> old.revision + 1 then
    raise exception 'canonical_authority_revision_write_denied' using errcode='42501';
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F50
revoke all privileges on function app_private.guard_authority_revision_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F50
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_authority_revision_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_authority_revision_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F51
create function app_private.bump_canonical_authority_revision_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  -- The row update and source mutation share a commit/rollback boundary.
  -- Overflow or a missing singleton aborts the entire source mutation.
  update app_private.canonical_authority_revision_v1
    set revision=revision+1 where singleton;
  if not found then
    raise exception 'canonical_authority_revision_unavailable' using errcode='55000';
  end if;
  return null;
end;
$$;


-- SELECTED EFFECT B.OC1.F51
revoke all privileges on function app_private.bump_canonical_authority_revision_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F51
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bump_canonical_authority_revision_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bump_canonical_authority_revision_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F52
create function app_private.guard_jurisdiction_bound_property_address_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare target_country char(2); bound_country char(2);
begin
  if old.address_id is distinct from new.address_id and exists(
    select 1 from platform.property_jurisdiction_assignments a
    where a.property_id=old.id and a.status in ('active','superseded','archived')) then
    select country_code into target_country from portfolio.addresses where id=new.address_id;
    select country_code into bound_country from platform.property_jurisdiction_assignments
      where property_id=old.id and status in ('active','superseded','archived')
      order by assignment_version desc limit 1;
    if target_country is null or target_country<>bound_country then
      raise exception 'property_jurisdiction_property_country_immutable' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F52
revoke all privileges on function app_private.guard_jurisdiction_bound_property_address_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F52
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_jurisdiction_bound_property_address_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_jurisdiction_bound_property_address_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.F53
revoke all privileges on function app_private.protect_setup_creation_v2() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F53
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.protect_setup_creation_v2()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.protect_setup_creation_v2() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F60
create or replace function app_private.resolve_workspace_from_customer_context_v1(
  p_context_id uuid,
  p_is_mutation boolean
)
returns table (
  workspace_id uuid,
  tenant_id uuid,
  membership_id uuid,
  role_id uuid,
  role_code text,
  status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
#variable_conflict use_column
declare
  v_grant record;
  v_target_property_id uuid;
  v_binding_count integer;
  v_binding record;
  v_workspace platform.customer_workspaces%rowtype;
  v_ws_count integer;
begin
  -- 1. Authentication
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Context grant & active membership
  select g.*, m.id as membership_key, m.tenant_id as membership_tenant, m.role_id, r.code as role_code
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 3. Resolve target property if scoped
  if v_grant.property_id is not null then
    v_target_property_id := v_grant.property_id;
  elsif v_grant.building_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.buildings b
    where b.id = v_grant.building_id and b.tenant_id = v_grant.membership_tenant;
  elsif v_grant.unit_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_grant.unit_id and u.tenant_id = v_grant.membership_tenant;
  end if;

  -- 4. Context-to-Workspace resolution
  if p_is_mutation then
    -- Mutation strictly requires Property/Building/Unit binding. Tenant-only fallback is prohibited.
    if v_target_property_id is null then
      raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
    end if;

    select count(*)
    into v_binding_count
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

    if v_binding_count = 0 then
      raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
    elsif v_binding_count > 1 then
      raise exception 'workspace_composition_workspace_binding_ambiguous' using errcode = '42501';
    end if;

    select * into v_binding
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
    limit 1;

    if v_binding.tenant_id <> v_grant.membership_tenant then
      raise exception 'workspace_composition_workspace_binding_tenant_mismatch' using errcode = '42501';
    end if;

    select * into v_workspace
    from platform.customer_workspaces cw
    where cw.id = v_binding.customer_workspace_id
      and cw.tenant_id = v_grant.membership_tenant
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

    if v_workspace.id is null then
      raise exception 'workspace_composition_workspace_inactive' using errcode = '42501';
    end if;

    return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
    return;
  else
    -- Read projection
    if v_target_property_id is not null then
      select count(*)
      into v_binding_count
      from platform.workspace_property_bindings b
      where b.property_id = v_target_property_id
        and b.status = 'active'
        and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

      if v_binding_count = 0 then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      elsif v_binding_count > 1 then
        raise exception 'workspace_composition_workspace_binding_ambiguous' using errcode = '42501';
      end if;

      select * into v_binding
      from platform.workspace_property_bindings b
      where b.property_id = v_target_property_id
        and b.status = 'active'
        and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
      limit 1;

      if v_binding.tenant_id <> v_grant.membership_tenant then
        raise exception 'workspace_composition_workspace_binding_tenant_mismatch' using errcode = '42501';
      end if;

      select * into v_workspace
      from platform.customer_workspaces cw
      where cw.id = v_binding.customer_workspace_id
        and cw.tenant_id = v_grant.membership_tenant
        and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

      if v_workspace.id is null then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      end if;

      return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
      return;
    else
      -- Pure tenant-scoped context read
      select count(*) into v_ws_count
      from platform.customer_workspaces cw
      where cw.tenant_id = v_grant.membership_tenant and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

      if v_ws_count = 1 then
        select * into v_workspace
        from platform.customer_workspaces cw
        where cw.tenant_id = v_grant.membership_tenant and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');
        return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
        return;
      elsif v_ws_count = 0 then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      else
        raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
      end if;
    end if;
  end if;
end;
$$;


-- SELECTED EFFECT B.OC1.F60
revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F60
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.F72
revoke all privileges on function app_private.validate_setup_units_v2(jsonb) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F72
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.validate_setup_units_v2(jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.validate_setup_units_v2(jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F73
create or replace function platform.assert_workspace_activation_ready(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = pg_catalog, platform, identity, auth
as $$
declare v_ws platform.customer_workspaces;
begin
  select * into v_ws from platform.customer_workspaces where id = p_workspace_id;
  if not found then return false; end if;
  return v_ws.onboarding_completed_at is not null
    and v_ws.onboarding_completed_by = v_ws.primary_admin_user_id
    and v_ws.primary_admin_accepted_at is not null
    and exists (
      select 1 from identity.memberships m
      where m.id = v_ws.primary_admin_membership_id and m.user_id = v_ws.primary_admin_user_id
        and m.tenant_id = v_ws.tenant_id and m.status = 'active'
        and m.starts_at <= statement_timestamp()
        and (m.ends_at is null or m.ends_at > statement_timestamp())
    )
    and exists (
      select 1 from auth.mfa_factors f
      where f.user_id = v_ws.primary_admin_user_id and f.status = 'verified'
    );
end;
$$;


-- SELECTED EFFECT B.OC1.F73
revoke all privileges on function platform.assert_workspace_activation_ready(uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F73
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.assert_workspace_activation_ready(uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.assert_workspace_activation_ready(uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F74
create or replace function app_private.workspace_context_covers_role_scope_v1(
 p_context_id uuid,p_tenant_id uuid,p_scope_type text,p_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,identity,portfolio,app_private as $$
declare c record; v_property uuid; v_building uuid; v_unit uuid;
begin
 select * into c from identity.context_grants g
 where g.id=p_context_id and g.tenant_id=p_tenant_id
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
 if not found then return false; end if;
 if p_scope_type='workspace' then return c.scope_type='tenant'; end if;
 if p_scope_type='property' then v_property:=p_scope_id;
 elsif p_scope_type='building' then
   v_building:=p_scope_id;
   select b.property_id into v_property from portfolio.buildings b where b.id=p_scope_id and b.tenant_id=p_tenant_id;
 elsif p_scope_type='unit' then
   v_unit:=p_scope_id;
   select u.building_id,b.property_id into v_building,v_property
   from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
   where u.id=p_scope_id and u.tenant_id=p_tenant_id;
 else return false; end if;
 if v_property is null then return false; end if;
 if c.scope_type='tenant' then return true; end if;
 if c.scope_type='property' then
   return c.property_id=v_property;
 elsif c.scope_type='building' then
   if v_building is null and p_scope_type='property' then return false; end if;
   if v_building is null then
     select b.id into v_building from portfolio.buildings b where b.property_id=v_property and b.tenant_id=p_tenant_id;
     if not found then return false; end if;
   end if;
   return c.building_id=v_building;
 elsif c.scope_type='unit' then
   if p_scope_type<>'unit' then return false; end if;
   return c.unit_id=v_unit;
 end if;
 return false;
exception when others then return false;
end;
$$;


-- SELECTED EFFECT B.OC1.F74
revoke all privileges on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F74
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F76
create or replace function app_private.workspace_role_scope_contains_v1(
 p_parent_type text,p_parent_property uuid,p_parent_building uuid,p_parent_unit uuid,
 p_child_type text,p_child_property uuid,p_child_building uuid,p_child_unit uuid
) returns boolean language sql immutable set search_path=pg_catalog as $$
 select case p_parent_type
  when 'workspace' then p_child_type in ('workspace','property','building','unit')
  when 'property' then p_child_type in ('property','building','unit') and p_parent_property is not distinct from p_child_property
  when 'building' then p_child_type in ('building','unit') and p_parent_building is not distinct from p_child_building
  when 'unit' then p_child_type='unit' and p_parent_unit is not distinct from p_child_unit
  else false end;
$$;


-- SELECTED EFFECT B.OC1.F76
revoke all privileges on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F76
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F84
create or replace function app_private.workspace_role_scope_overlaps_v1(
 p_left_type text,p_left_property uuid,p_left_building uuid,p_left_unit uuid,
 p_right_type text,p_right_property uuid,p_right_building uuid,p_right_unit uuid
) returns boolean language sql immutable set search_path=pg_catalog as $$
 select case
  when p_left_type='workspace' or p_right_type='workspace' then true
  when p_left_type='property' then p_left_property is not distinct from p_right_property
  when p_right_type='property' then p_right_property is not distinct from p_left_property
  when p_left_type='building' then p_left_building is not distinct from p_right_building
  when p_right_type='building' then p_right_building is not distinct from p_left_building
  when p_left_type='unit' then p_left_unit is not distinct from p_right_unit
  when p_right_type='unit' then p_right_unit is not distinct from p_left_unit
  else false end;
$$;


-- SELECTED EFFECT B.OC1.F84
revoke all privileges on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F84
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F87
create or replace function app_private.customer_mfa_required()
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,identity
as $$
  select case
    when auth.uid() is null then true
    else exists(
      select 1
      from identity.memberships m
      join identity.roles r on r.id=m.role_id
      where m.user_id=auth.uid()
        and m.status='active'
        and m.starts_at<=statement_timestamp()
        and (m.ends_at is null or m.ends_at>statement_timestamp())
        and lower(r.code) in ('association_admin','property_manager','president','censor')
    )
  end;
$$;


-- SELECTED EFFECT B.OC1.F87
revoke all privileges on function app_private.customer_mfa_required() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F87
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.customer_mfa_required()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.customer_mfa_required() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F19
create or replace function platform.enforce_workspace_activation_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if new.environment = 'PRODUCTION'
     and new.lifecycle_status = 'ACTIVE'
     and old.lifecycle_status is distinct from 'ACTIVE'
     and not platform.assert_workspace_activation_ready(new.id) then
    raise exception 'activation_blocked: primary admin acceptance, active membership, verified MFA, and completed onboarding are required'
      using errcode = '55000';
  end if;
  return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F19
revoke all privileges on function platform.enforce_workspace_activation_gate() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F19
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.enforce_workspace_activation_gate()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.enforce_workspace_activation_gate() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F75
create or replace function app_private.workspace_role_identity_source_current_v1(
 p_context_id uuid,p_grantor_membership_id uuid,p_identity_role_id uuid,
 p_tenant_id uuid,p_workspace_id uuid,p_permission_id uuid,p_module_id uuid,
 p_scope_type text,p_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare v_member record; v_module record;
begin
 select m.* into v_member from identity.memberships m
 where m.id=p_grantor_membership_id and m.tenant_id=p_tenant_id
   and m.role_id=p_identity_role_id and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found or not exists(select 1 from identity.context_grants g
    where g.id=p_context_id and g.membership_id=p_grantor_membership_id and g.tenant_id=p_tenant_id
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp()))
    or not app_private.workspace_context_covers_role_scope_v1(p_context_id,p_tenant_id,p_scope_type,p_scope_id)
    or not exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='allow')
    or exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='deny')
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable
        and b.lifecycle_status='active' and b.valid_from<=statement_timestamp()
        and (b.valid_to is null or b.valid_to>statement_timestamp()))
    or not exists(select 1 from platform.workspace_modules wm
      where wm.customer_workspace_id=p_workspace_id
        and wm.module_definition_id=p_module_id and wm.status='active'
        and wm.valid_from<=statement_timestamp() and (wm.valid_to is null or wm.valid_to>statement_timestamp()))
    or exists(select 1 from platform.module_definitions md
      where md.id=p_module_id and md.entitlement_key is not null
        and not exists(select 1 from platform.workspace_entitlements e
          where e.customer_workspace_id=p_workspace_id and e.entitlement_key=md.entitlement_key
            and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
            and case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
              then e.override_value_json='true'::jsonb else (e.boolean_value is true or e.numeric_value>0) end))
 then return false; end if;

 -- A deny on the grantor wins even when the underlying identity role allows.
 if exists(
   select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id
   where a.customer_workspace_id=p_workspace_id and a.membership_id=p_grantor_membership_id
     and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
     and r.lifecycle_status='published' and r.valid_from<=statement_timestamp()
     and (r.valid_to is null or r.valid_to>statement_timestamp())
     and rp.permission_id=p_permission_id and rp.effect='deny' and rm.module_definition_id=p_module_id
     and app_private.workspace_role_scope_overlaps_v1(
       a.scope_type,a.property_id,a.building_id,a.unit_id,
       p_scope_type,
       case when p_scope_type='property' then p_scope_id when p_scope_type in ('building','unit') then
         (select b.property_id from portfolio.buildings b where b.id=case when p_scope_type='building' then p_scope_id else (select u.building_id from portfolio.units u where u.id=p_scope_id) end) end,
       case when p_scope_type='building' then p_scope_id when p_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_scope_id) end,
       case when p_scope_type='unit' then p_scope_id end)
 ) then return false; end if;
 return true;
exception when others then return false;
end;
$$;


-- SELECTED EFFECT B.OC1.F75
revoke all privileges on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F75
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F77
create or replace function app_private.workspace_member_role_authority_active_v1(
 p_assignment_id uuid,p_permission_id uuid,p_module_id uuid,
 p_target_scope_type text,p_target_scope_id uuid,p_path uuid[] default '{}'::uuid[]
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare
 a record; s record; grantor_rec record; wr record; v_code text; v_module text;
 v_prop uuid; v_bld uuid; v_unit uuid; v_workspace_id uuid;
begin
 if p_assignment_id is null or p_assignment_id=any(coalesce(p_path,'{}'::uuid[]))
    or cardinality(coalesce(p_path,'{}'::uuid[]))>=5 then return false; end if;
 select wmr.* into a from platform.workspace_member_roles wmr
 join identity.memberships m on m.id=wmr.membership_id and m.tenant_id=wmr.tenant_id
 join platform.workspace_roles r on r.id=wmr.workspace_role_id and r.customer_workspace_id=wmr.customer_workspace_id
 where wmr.id=p_assignment_id and wmr.valid_from<=statement_timestamp()
   and (wmr.valid_to is null or wmr.valid_to>statement_timestamp())
   and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
   and r.lifecycle_status='published' and r.valid_from<=statement_timestamp() and (r.valid_to is null or r.valid_to>statement_timestamp());
 if not found then return false; end if;
 if not app_private.workspace_role_scope_contains_v1(
   a.scope_type,a.property_id,a.building_id,a.unit_id,
   p_target_scope_type,
   case when p_target_scope_type='property' then p_target_scope_id when p_target_scope_type in ('building','unit') then
      (select b.property_id from portfolio.buildings b where b.id=case when p_target_scope_type='building' then p_target_scope_id else (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end) end,
   case when p_target_scope_type='building' then p_target_scope_id when p_target_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end,
   case when p_target_scope_type='unit' then p_target_scope_id end
 ) then return false; end if;
 if a.authority_policy_version=1 then return true; end if;
 if a.authority_policy_version<>2 then return false; end if;
 if not app_private.workspace_context_covers_role_scope_v1(
   a.assigned_by_context_grant_id,a.tenant_id,p_target_scope_type,p_target_scope_id) then return false; end if;

 select p.code into v_code from identity.permissions p where p.id=p_permission_id;
 select md.code into v_module from platform.module_definitions md where md.id=p_module_id
   and md.is_active and md.lifecycle_status in ('active','published')
   and md.valid_from<=statement_timestamp() and (md.valid_to is null or md.valid_to>statement_timestamp());
 if v_code is null or v_module is null
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()))
 then return false; end if;
 if not exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='allow') then return false; end if;
 if exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='deny') then return false; end if;

 select * into s from platform.workspace_member_role_authority_sources x
 where x.assignment_id=a.id and x.permission_id=p_permission_id and x.module_definition_id=p_module_id;
 if not found then return false; end if;

 if s.source_kind='identity_role' then
   select grantor.* into grantor_rec from identity.memberships grantor
    where grantor.id=a.assigned_by_membership_id and grantor.tenant_id=a.tenant_id
      and grantor.status='active' and grantor.starts_at<=statement_timestamp()
      and (grantor.ends_at is null or grantor.ends_at>statement_timestamp());
   if not found or grantor_rec.role_id is distinct from s.source_identity_role_id
      or not exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='allow')
      or exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='deny') then return false; end if;
   return app_private.workspace_role_identity_source_current_v1(
      a.assigned_by_context_grant_id,a.assigned_by_membership_id,s.source_identity_role_id,
      a.tenant_id,a.customer_workspace_id,p_permission_id,p_module_id,
      p_target_scope_type,p_target_scope_id);
 elsif s.source_kind='workspace_role_assignment' then
   select parent.* into wr from platform.workspace_member_roles parent
   where parent.id=s.source_assignment_id
     and parent.customer_workspace_id=a.customer_workspace_id
     and parent.tenant_id=a.tenant_id
     and parent.membership_id=a.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=statement_timestamp()
     and (parent.valid_to is null or parent.valid_to>statement_timestamp())
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       a.scope_type,a.property_id,a.building_id,a.unit_id);
   if not found then return false; end if;
   if s.authority_depth>4 or s.authority_depth<>wr.authority_depth+1 then return false; end if;
   return app_private.workspace_member_role_authority_active_v1(
     wr.id,p_permission_id,p_module_id,p_target_scope_type,p_target_scope_id,
     array_append(coalesce(p_path,'{}'::uuid[]),a.id));
 end if;
 return false;
exception when others then return false;
end;
$$;


-- SELECTED EFFECT B.OC1.F77
revoke all privileges on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F77
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F49
create or replace function app_private.guard_workspace_member_role_authority_v2()
returns trigger language plpgsql security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare
 v_ctx record; v_actor record; v_role record; v_pair record; v_parent record;
 v_scope_id uuid; v_child_pairs integer:=0; v_parent_pairs integer:=0;
 v_depth integer:=0; v_pair_depth integer:=0; v_cap timestamptz; v_base_expiry timestamptz;
 v_workspace_id uuid; v_source_kind text; v_source_role uuid; v_source_assignment uuid;
 v_scope_property uuid; v_scope_building uuid; v_scope_unit uuid;
begin
 if tg_op='UPDATE' then
   if new.assigned_by_context_grant_id is distinct from old.assigned_by_context_grant_id
      or new.authority_policy_version is distinct from old.authority_policy_version
      or new.authority_depth is distinct from old.authority_depth then
     raise exception 'workspace_member_role_authority_immutable' using errcode='42501';
   end if;
   return new;
 end if;
 if new.authority_policy_version=1 and new.assigned_by_context_grant_id is null
    and session_user in ('postgres','supabase_admin') then
   -- Preserve historical fixtures and privileged migration backfills only.
   return new;
 end if;
 if new.authority_policy_version<>2 or new.assigned_by_context_grant_id is null then
   raise exception 'workspace_member_role_authority_required' using errcode='42501';
 end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or new.assigned_by_user_id is distinct from auth.uid()
    or new.assigned_by_membership_id=new.membership_id then
   raise exception 'workspace_role_authority_context_invalid' using errcode='42501';
 end if;
 select cg.* into v_ctx from identity.context_grants cg
 where cg.id=new.assigned_by_context_grant_id and cg.membership_id=new.assigned_by_membership_id
   and cg.tenant_id=new.tenant_id and cg.starts_at<=statement_timestamp()
   and (cg.ends_at is null or cg.ends_at>statement_timestamp());
 if not found then raise exception 'workspace_role_authority_context_invalid' using errcode='42501'; end if;
 select m.* into v_actor from identity.memberships m where m.id=new.assigned_by_membership_id
   and m.tenant_id=new.tenant_id and m.user_id=auth.uid() and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found then raise exception 'workspace_role_authority_context_invalid' using errcode='42501'; end if;
 if not app_private.workspace_context_covers_role_scope_v1(
      new.assigned_by_context_grant_id,new.tenant_id,new.scope_type,
      case new.scope_type when 'property' then new.property_id when 'building' then new.building_id when 'unit' then new.unit_id else null end)
 then raise exception 'workspace_role_authority_scope_exceeded' using errcode='42501'; end if;
 select wr.* into v_role from platform.workspace_roles wr
 where wr.id=new.workspace_role_id and wr.customer_workspace_id=new.customer_workspace_id
  and wr.tenant_id=new.tenant_id and wr.lifecycle_status='published'
  and wr.valid_from<=statement_timestamp() and (wr.valid_to is null or wr.valid_to>statement_timestamp());
 if not found then raise exception 'workspace_role_not_published' using errcode='42501'; end if;
 v_workspace_id:=case when new.scope_type='workspace' then new.customer_workspace_id end;
 v_scope_id:=case new.scope_type when 'property' then new.property_id when 'building' then new.building_id when 'unit' then new.unit_id else new.customer_workspace_id end;

 for v_pair in
   select distinct rp.permission_id,rm.module_definition_id,p.code permission_code,md.code module_code
   from platform.workspace_role_permissions rp
   join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
   join identity.permissions p on p.id=rp.permission_id
   join platform.module_definitions md on md.id=rm.module_definition_id
   where rp.workspace_role_id=new.workspace_role_id and rp.effect='allow'
 loop
   v_child_pairs:=v_child_pairs+1; v_pair_depth:=0;
   if not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=v_pair.module_definition_id and b.permission_id=v_pair.permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()))
   then raise exception 'workspace_role_grant_binding_invalid' using errcode='42501'; end if;
   if exists(select 1 from identity.role_permissions rp
      where rp.role_id=v_actor.role_id and rp.permission_id=v_pair.permission_id and rp.effect='deny') then
     raise exception 'workspace_role_grant_denied_by_assigner' using errcode='42501'; end if;

   v_source_kind:=null;v_source_role:=null;v_source_assignment:=null;
   if exists(select 1 from identity.role_permissions rp
       where rp.role_id=v_actor.role_id and rp.permission_id=v_pair.permission_id and rp.effect='allow')
      and app_private.workspace_role_identity_source_current_v1(
       new.assigned_by_context_grant_id,new.assigned_by_membership_id,v_actor.role_id,
       new.tenant_id,new.customer_workspace_id,v_pair.permission_id,v_pair.module_definition_id,
       new.scope_type,v_scope_id)
   then
     v_source_kind:='identity_role';v_source_role:=v_actor.role_id;
   else
     select parent.id,parent.authority_depth,parent.valid_to into v_parent
     from platform.workspace_member_roles parent
     join platform.workspace_roles pr on pr.id=parent.workspace_role_id
     join platform.workspace_role_permissions prp on prp.workspace_role_id=pr.id
     join platform.workspace_role_modules prm on prm.workspace_role_id=pr.id
     where parent.customer_workspace_id=new.customer_workspace_id
       and parent.membership_id=new.assigned_by_membership_id
       and parent.tenant_id=new.tenant_id and parent.authority_policy_version=2
       and parent.valid_from<=statement_timestamp() and (parent.valid_to is null or parent.valid_to>statement_timestamp())
       and pr.lifecycle_status='published' and pr.valid_from<=statement_timestamp() and (pr.valid_to is null or pr.valid_to>statement_timestamp())
       and prp.permission_id=v_pair.permission_id and prp.effect='allow'
       and prm.module_definition_id=v_pair.module_definition_id
       and app_private.workspace_role_scope_contains_v1(
         parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
         new.scope_type,new.property_id,new.building_id,new.unit_id)
       and app_private.workspace_member_role_authority_active_v1(
         parent.id,v_pair.permission_id,v_pair.module_definition_id,
         new.scope_type,v_scope_id,'{}'::uuid[])
     order by coalesce(parent.valid_to,'infinity'::timestamptz) asc
     limit 1;
     if not found then raise exception 'workspace_role_grant_source_missing' using errcode='42501'; end if;
     v_source_kind:='workspace_role_assignment';v_source_assignment:=v_parent.id;
     v_pair_depth:=v_parent.authority_depth+1; v_depth:=greatest(v_depth,v_pair_depth);
     if v_parent.valid_to is not null then
       v_cap:=least(coalesce(v_cap,'infinity'::timestamptz),v_parent.valid_to);
     end if;
     if exists(
       with recursive lineage(id,membership_id,depth) as (
        select v_parent.id,new.assigned_by_membership_id,0
        union all
        select x.source_assignment_id,parent.membership_id,l.depth+1
        from lineage l
        join platform.workspace_member_role_authority_sources x on x.assignment_id=l.id
        join platform.workspace_member_roles parent on parent.id=x.source_assignment_id
        where x.source_assignment_id is not null and l.depth<4
       )
       select 1 from lineage where membership_id=new.membership_id
     ) then raise exception 'workspace_role_authority_cycle_prohibited' using errcode='42501'; end if;
   end if;
   insert into platform.workspace_member_role_authority_sources(
      assignment_id,permission_id,module_definition_id,source_kind,
      source_identity_role_id,source_assignment_id,authority_depth)
   values(new.id,v_pair.permission_id,v_pair.module_definition_id,v_source_kind,
      v_source_role,v_source_assignment,
      v_pair_depth);
 end loop;
 -- A deny-only role is valid and carries no delegable allow pairs.

 -- Require a strict proper subset of the assigner's currently effective,
 -- delegable authority pairs at this exact scope.
 select count(*) into v_parent_pairs from (
   select distinct p.permission_id,b.module_definition_id
   from identity.role_permissions p
   join platform.module_permission_bindings b on b.permission_id=p.permission_id
   join platform.module_definitions md on md.id=b.module_definition_id
   where p.role_id=v_actor.role_id and p.effect='allow'
     and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
     and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
     and md.is_active and md.lifecycle_status in ('active','published')
     and md.valid_from<=statement_timestamp() and (md.valid_to is null or md.valid_to>statement_timestamp())
     and app_private.workspace_role_identity_source_current_v1(
       new.assigned_by_context_grant_id,new.assigned_by_membership_id,v_actor.role_id,
       new.tenant_id,new.customer_workspace_id,p.permission_id,b.module_definition_id,
       new.scope_type,v_scope_id)
   union
   select distinct rp.permission_id,rm.module_definition_id
   from platform.workspace_member_roles parent
   join platform.workspace_roles pr on pr.id=parent.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=pr.id and rp.effect='allow'
   join platform.workspace_role_modules rm on rm.workspace_role_id=pr.id
   join platform.module_permission_bindings b on b.permission_id=rp.permission_id and b.module_definition_id=rm.module_definition_id
   where parent.customer_workspace_id=new.customer_workspace_id
     and parent.membership_id=new.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=statement_timestamp() and (parent.valid_to is null or parent.valid_to>statement_timestamp())
     and pr.lifecycle_status='published' and pr.valid_from<=statement_timestamp() and (pr.valid_to is null or pr.valid_to>statement_timestamp())
     and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
     and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       new.scope_type,new.property_id,new.building_id,new.unit_id)
     and app_private.workspace_member_role_authority_active_v1(
       parent.id,rp.permission_id,rm.module_definition_id,new.scope_type,v_scope_id,'{}'::uuid[])
 ) authority;
 if v_child_pairs>0 and v_child_pairs>=v_parent_pairs then
   raise exception 'workspace_role_peer_or_superior_grant_prohibited' using errcode='42501';
 end if;

 -- Cap expiry to target/grantor membership, exact grant context, role, inherited
 -- parent assignment and active workspace access basis. No active open-ended
 -- access basis exists in this schema, so open-ended assignments are impossible.
 v_cap:=least(coalesce(v_cap,'infinity'::timestamptz),
   coalesce(new.valid_to,'infinity'::timestamptz),
   coalesce(v_actor.ends_at,'infinity'::timestamptz),
   coalesce((select m.ends_at from identity.memberships m where m.id=new.membership_id),'infinity'::timestamptz),
   coalesce(v_ctx.ends_at,'infinity'::timestamptz),
   coalesce(v_role.valid_to,'infinity'::timestamptz));
 select max(b.expires_at) into v_base_expiry from platform.workspace_access_bases b
 where b.customer_workspace_id=new.customer_workspace_id and b.status='active'
   and b.expires_at>statement_timestamp();
 if v_base_expiry is not null then v_cap:=least(v_cap,v_base_expiry); end if;
 if v_cap='infinity'::timestamptz or v_cap<=statement_timestamp() then
   raise exception 'workspace_role_authority_horizon_invalid' using errcode='42501'; end if;
 if new.valid_to is null or new.valid_to>v_cap then new.valid_to:=v_cap; end if;
 if new.valid_to<=statement_timestamp() then raise exception 'workspace_role_authority_horizon_invalid' using errcode='42501'; end if;
 new.authority_depth:=v_depth;
 return new;
end;
$$;


-- SELECTED EFFECT B.OC1.F49
revoke all privileges on function app_private.guard_workspace_member_role_authority_v2() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F49
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_member_role_authority_v2()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_member_role_authority_v2() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F62
create or replace function app_private.native_workspace_scope_for_membership_v2(
  p_context_id uuid, p_membership_id uuid, p_workspace_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog
as $$
  select auth.uid() is not null and exists (
    select 1
    from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join identity.roles r on r.id=m.role_id and (r.tenant_id is null or r.tenant_id=m.tenant_id)
    join platform.customer_workspaces w on w.id=p_workspace_id and w.tenant_id=g.tenant_id
    join platform.workspace_member_roles a on a.membership_id=m.id
      and a.tenant_id=w.tenant_id and a.customer_workspace_id=w.id
    join platform.workspace_roles wr on wr.id=a.workspace_role_id
      and wr.tenant_id=w.tenant_id and wr.customer_workspace_id=w.id
    where g.id=p_context_id and m.id=p_membership_id and g.scope_type='tenant'
      and g.property_id is null and g.building_id is null and g.unit_id is null
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and m.status='active' and m.starts_at<=statement_timestamp()
      and (m.ends_at is null or m.ends_at>statement_timestamp())
      and w.lifecycle_status='ACTIVE'
      and a.scope_type in ('workspace','property','building','unit')
      and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
      and wr.scope_ceiling in ('workspace','property','building','unit')
      and case a.scope_type
        when 'workspace' then wr.scope_ceiling='workspace'
        when 'property' then wr.scope_ceiling in ('workspace','property')
        when 'building' then wr.scope_ceiling in ('workspace','property','building')
        when 'unit' then wr.scope_ceiling in ('workspace','property','building','unit')
        else false end
      and wr.lifecycle_status='published'
      and wr.valid_from<=statement_timestamp() and (wr.valid_to is null or wr.valid_to>statement_timestamp())
      and (
        (a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null)
        or (a.scope_type='property' and a.building_id is null and a.unit_id is null
          and exists (
            select 1 from platform.workspace_property_bindings b
            where b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id
              and b.property_id=a.property_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
        or (a.scope_type='building' and a.property_id is null and a.unit_id is null
          and exists (
            select 1 from portfolio.buildings pb
            join platform.workspace_property_bindings b on b.property_id=pb.property_id
            where pb.id=a.building_id and pb.tenant_id=w.tenant_id
              and b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
        or (a.scope_type='unit' and a.property_id is null and a.building_id is null
          and exists (
            select 1 from portfolio.units pu
            join portfolio.buildings pb on pb.id=pu.building_id and pb.tenant_id=pu.tenant_id
            join platform.workspace_property_bindings b on b.property_id=pb.property_id
            where pu.id=a.unit_id and pu.tenant_id=w.tenant_id
              and b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id and b.status='active'
              and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
          ))
      )
      and (
        a.authority_policy_version=1
        or exists (
          select 1 from platform.workspace_role_permissions rp
          join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
          where rp.workspace_role_id=wr.id and rp.effect='allow'
            and app_private.workspace_member_role_authority_active_v1(
              a.id,rp.permission_id,rm.module_definition_id,
              a.scope_type,
              case a.scope_type when 'property' then a.property_id when 'building' then a.building_id
                when 'unit' then a.unit_id else null end,
              '{}'::uuid[])
        )
      )
  );
$$;


-- SELECTED EFFECT B.OC1.F62
revoke all privileges on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F62
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F83
create function app_private.resolve_workspace_native_context_v2(
  p_context_id uuid, p_workspace_id uuid
) returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_id uuid,role_code text,status text)
language plpgsql stable security definer set search_path=pg_catalog
as $$
begin
  if auth.uid() is null or p_context_id is null or p_workspace_id is null then
    raise exception 'workspace_native_context_access_denied' using errcode='42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'mfa_required' using errcode='42501';
  end if;
  return query select w.id,m.tenant_id,m.id,m.role_id,r.code,'active'::text
    from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join identity.roles r on r.id=m.role_id
    join platform.customer_workspaces w on w.id=p_workspace_id and w.tenant_id=m.tenant_id
    where g.id=p_context_id and m.user_id=auth.uid()
      and app_private.native_workspace_scope_for_membership_v2(g.id,m.id,w.id);
  if not found then
    raise exception 'workspace_native_context_access_denied' using errcode='42501';
  end if;
end;
$$;


-- SELECTED EFFECT B.OC1.F83
revoke all privileges on function app_private.resolve_workspace_native_context_v2(uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F83
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.resolve_workspace_native_context_v2(uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.resolve_workspace_native_context_v2(uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F85
create or replace function app_private.check_direct_effective_permission_v2(
  p_context_id uuid,
  p_membership_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid,
  p_explicit_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_member record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_ctx_grant record;
  v_workspace_id uuid;
  v_ctx_property_id uuid;
  v_ctx_scope_covered boolean := false;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_membership_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  -- 1. Validate Context Grant independently (deterministic single-row, fail-closed)
  select cg.id, cg.tenant_id, cg.membership_id, cg.scope_type, cg.property_id, cg.building_id, cg.unit_id
  into v_ctx_grant
  from identity.context_grants cg
  where cg.id = p_context_id
    and cg.membership_id = p_membership_id
    and cg.starts_at <= statement_timestamp()
    and (cg.ends_at is null or cg.ends_at > statement_timestamp());

  if not found then return false; end if;

  if p_explicit_workspace_id is not null then
    -- The direct helper also evaluates grantors for delegated permission.
    -- This internal check deliberately validates the supplied membership,
    -- while the top-level native resolver verifies the current caller owns it.
    if p_target_scope_type is distinct from 'workspace'
      or p_target_scope_id is distinct from p_explicit_workspace_id
      or not app_private.native_workspace_scope_for_membership_v2(
        p_context_id,p_membership_id,p_explicit_workspace_id) then return false; end if;
    v_workspace_id := p_explicit_workspace_id;
  else
  -- 2. Resolve property from context grant
  if v_ctx_grant.property_id is not null then
    v_ctx_property_id := v_ctx_grant.property_id;
  elsif v_ctx_grant.building_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.buildings b
    where b.id = v_ctx_grant.building_id and b.tenant_id = v_ctx_grant.tenant_id;
  elsif v_ctx_grant.unit_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_ctx_grant.unit_id and u.tenant_id = v_ctx_grant.tenant_id;
  end if;

  if v_ctx_property_id is not null then
    select b.customer_workspace_id into v_workspace_id
    from platform.workspace_property_bindings b
    join platform.customer_workspaces cw on cw.id = b.customer_workspace_id
    where b.property_id = v_ctx_property_id
      and b.tenant_id = v_ctx_grant.tenant_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp()
      and (b.valid_to is null or b.valid_to > statement_timestamp())
      and cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  else
    select cw.id into v_workspace_id
    from platform.customer_workspaces cw
    where cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  end if;

  end if;

  if v_workspace_id is null then return false; end if;

  select v_workspace_id as workspace_id, v_ctx_grant.tenant_id as tenant_id into v_res;

  -- 3. Verify target member exists, active and belongs to same tenant
  select m.id, m.tenant_id, m.user_id, m.role_id, r.code as role_code
  into v_member
  from identity.memberships m
  left join identity.roles r on r.id = m.role_id
  where m.id = p_membership_id
    and m.tenant_id = v_res.tenant_id
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp());

  if not found then return false; end if;

  -- Permission & Module Verification
  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  -- Active Module Permission Binding Gate
  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if p_explicit_workspace_id is not null
    and (v_mod.requires_aal2 or v_binding.requires_aal2)
    and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return false; end if;

  -- Workspace Module Activation Gate
  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Entitlement Gate
  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  -- Taxonomy Gate
  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  -- Target Scope Ancestry
  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Context Grant scope containment check against Target Scope
  if v_ctx_grant.scope_type::text in ('workspace', 'tenant') then
      v_ctx_scope_covered := true;
    elsif v_ctx_grant.scope_type::text = 'property' then
      if p_target_scope_type in ('property', 'building', 'unit')
         and v_ctx_grant.property_id = v_target_property_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'building' then
      if p_target_scope_type in ('building', 'unit')
         and v_ctx_grant.building_id = v_target_building_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'unit' then
      if p_target_scope_type = 'unit'
         and v_ctx_grant.unit_id = v_target_unit_id then
        v_ctx_scope_covered := true;
      end if;
    end if;

  -- Deny Path A
  if v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A (Strict: requires valid context grant that covers target scope)
  if v_ctx_scope_covered and v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B (Strict: requires local role assignment that covers target scope)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;


-- SELECTED EFFECT B.OC1.F85
revoke all privileges on function app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F85
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F80
create or replace function app_private.check_effective_permission_v2(
  p_context_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid,
  p_explicit_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path =pg_catalog
as $$
declare
  v_res record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  begin
    if p_explicit_workspace_id is null then
      select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false);
    else
      if p_target_scope_type is distinct from 'workspace'
        or p_target_scope_id is distinct from p_explicit_workspace_id then return false; end if;
      select * into v_res from app_private.resolve_workspace_native_context_v2(p_context_id,p_explicit_workspace_id);
    end if;
  exception when others then
    return false;
  end;

  if v_res.workspace_id is null or v_res.membership_id is null then
    return false;
  end if;

  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if p_explicit_workspace_id is not null
    and (v_mod.requires_aal2 or v_binding.requires_aal2)
    and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return false; end if;

  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Deny Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  -- Path C: Valid Delegated Allow (Zero recursion: checks grantor via direct helper only)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_delegations wd
    join platform.workspace_delegation_permissions wdp on wdp.delegation_id = wd.id
    join platform.module_permission_bindings mpb on mpb.id = wdp.module_permission_binding_id
    where wd.customer_workspace_id = v_res.workspace_id
      and wd.grantee_membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wd.tenant_id=v_res.tenant_id
        and mpb.module_definition_id=v_mod.id and mpb.permission_id=v_perm.id
        and mpb.valid_from<=statement_timestamp() and (mpb.valid_to is null or mpb.valid_to>statement_timestamp())))
      and wd.lifecycle_status = 'active'
      and wd.valid_from <= statement_timestamp()
      and wd.valid_until > statement_timestamp()
      and wdp.module_definition_id = v_mod.id
      and wdp.permission_id = v_perm.id
      and mpb.is_delegable = true
      and mpb.lifecycle_status = 'active'
      and (
        wd.scope_type = 'workspace'
        or (wd.scope_type = 'property' and wd.property_id = v_target_property_id)
        or (wd.scope_type = 'building' and wd.building_id = v_target_building_id)
        or (wd.scope_type = 'unit' and wd.unit_id = v_target_unit_id)
      )
      -- Dynamic Fail-Closed Grantor Check:
      and exists (
        select 1 from identity.context_grants gcg
        where gcg.membership_id = wd.grantor_membership_id
          and gcg.tenant_id = v_res.tenant_id
          and gcg.starts_at <= statement_timestamp()
          and (gcg.ends_at is null or gcg.ends_at > statement_timestamp())
          and app_private.check_direct_effective_permission_v2(
            gcg.id,
            wd.grantor_membership_id,
            p_permission_code,
            p_module_code,
            wd.scope_type,
            coalesce(wd.unit_id, wd.building_id, wd.property_id, v_res.workspace_id),
            p_explicit_workspace_id
          ) = true
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;


-- SELECTED EFFECT B.OC1.F80
revoke all privileges on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F80
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.F64
create function app_private.check_workspace_native_permission_v2(
 p_context_id uuid,p_workspace_id uuid,p_permission_code text,p_module_code text
) returns boolean language sql stable security definer set search_path=pg_catalog
as $$ select case when p_context_id is null or p_workspace_id is null
 or p_permission_code is null or p_module_code is null then false else
 coalesce(app_private.check_effective_permission_v2(
 p_context_id,p_permission_code,p_module_code,'workspace',p_workspace_id,p_workspace_id),false) end; $$;


-- SELECTED EFFECT B.OC1.F64
revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.F64
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.G01
create trigger tenants_updated_at before update on platform.tenants for each row execute function app_private.set_updated_at();


-- SELECTED EFFECT B.G02
create trigger profiles_updated_at before update on identity.profiles for each row execute function app_private.set_updated_at();


-- SELECTED EFFECT B.G03
create trigger memberships_updated_at before update on identity.memberships for each row execute function app_private.set_updated_at();


-- SELECTED EFFECT B.G04
create trigger customer_workspaces_activation_gate
before update of lifecycle_status on platform.customer_workspaces
for each row execute function platform.enforce_workspace_activation_gate();


-- SELECTED EFFECT B.G05
create trigger accounting_periods_immutable before update or delete on finance.accounting_periods
for each row execute function finance.protect_accounting_period();


-- SELECTED EFFECT B.G06
create trigger trg_assert_accounting_period_no_overlap
before insert or update on finance.accounting_periods
for each row
execute function finance.assert_accounting_period_no_overlap();


-- SELECTED EFFECT B.G07
create trigger a_assert_accounting_period_property_tenant
before insert or update of tenant_id, property_id on finance.accounting_periods
for each row
execute function finance.assert_accounting_period_property_tenant();


-- SELECTED EFFECT B.G08
create trigger property_profiles_updated_at before update on platform.property_profiles for each row execute function app_private.set_updated_at();


-- SELECTED EFFECT B.G09
create trigger operating_models_updated_at before update on platform.operating_models for each row execute function app_private.set_updated_at();


-- SELECTED EFFECT B.G10
create trigger space_kinds_updated_at before update on platform.space_kinds for each row execute function app_private.set_updated_at();


-- SELECTED EFFECT B.G11
create trigger ws_taxonomy_assignments_updated_at before update on platform.workspace_taxonomy_assignments for each row execute function app_private.set_updated_at();


-- SELECTED EFFECT B.G12
create trigger ws_property_bindings_updated_at before update on platform.workspace_property_bindings for each row execute function app_private.set_updated_at();


-- SELECTED EFFECT B.G13
create trigger guard_property_profiles_version_overlap
before insert or update on platform.property_profiles
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();


-- SELECTED EFFECT B.G14
create trigger guard_operating_models_version_overlap
before insert or update on platform.operating_models
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();


-- SELECTED EFFECT B.G15
create trigger guard_space_kinds_version_overlap
before insert or update on platform.space_kinds
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();


-- SELECTED EFFECT B.G16
create trigger guard_property_profiles_immutability before delete on platform.property_profiles for each row execute function app_private.guard_taxonomy_record_immutability_v1();


-- SELECTED EFFECT B.G17
create trigger guard_operating_models_immutability before delete on platform.operating_models for each row execute function app_private.guard_taxonomy_record_immutability_v1();


-- SELECTED EFFECT B.G18
create trigger guard_space_kinds_immutability before delete on platform.space_kinds for each row execute function app_private.guard_taxonomy_record_immutability_v1();


-- SELECTED EFFECT B.G19
create trigger a_guard_ws_taxonomy_assignments_history
before update or delete on platform.workspace_taxonomy_assignments
for each row execute function app_private.guard_workspace_taxonomy_assignment_history_v1();


-- SELECTED EFFECT B.G20
create trigger a_guard_ws_property_bindings_history
before update or delete on platform.workspace_property_bindings
for each row execute function app_private.guard_workspace_property_binding_history_v1();


-- SELECTED EFFECT B.G21
create trigger guard_ws_property_binding_before_ins_upd
before insert or update on platform.workspace_property_bindings
for each row execute function app_private.guard_workspace_property_binding_v1();


-- SELECTED EFFECT B.G22
create trigger guard_ws_taxonomy_assignment_before_ins_upd
before insert or update on platform.workspace_taxonomy_assignments
for each row execute function app_private.guard_workspace_taxonomy_assignment_v1();


-- SELECTED EFFECT B.G23
create trigger trg_bootstrap_role_taxonomy_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_taxonomy_permissions_v1();


-- SELECTED EFFECT B.G24
create trigger trg_bootstrap_role_module_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_module_permissions_v1();


-- SELECTED EFFECT B.G25
create trigger trg_guard_module_definition_immutability
before update or delete on platform.module_definitions
for each row
execute function app_private.guard_module_definition_immutability_v1();


-- SELECTED EFFECT B.G26
create trigger trg_guard_module_definition_effective_period
before insert or update on platform.module_definitions
for each row
execute function app_private.guard_module_definition_effective_period_v1();


-- SELECTED EFFECT B.G27
create trigger trg_guard_workspace_module_code_sync
before insert or update on platform.workspace_modules
for each row
execute function app_private.guard_workspace_module_code_sync_v1();


-- SELECTED EFFECT B.G28
create trigger trg_guard_workspace_module_immutability
before update or delete on platform.workspace_modules
for each row
execute function app_private.guard_workspace_module_immutability_v1();


-- SELECTED EFFECT B.G29
create trigger trg_bootstrap_role_workspace_role_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_workspace_role_permissions_v1();


-- SELECTED EFFECT B.G30
create trigger trg_guard_module_permission_binding_invariants
before insert or update on platform.module_permission_bindings
for each row
execute function app_private.guard_module_permission_binding_invariants_v1();


-- SELECTED EFFECT B.G31
create trigger trg_guard_workspace_role_immutability
before update or delete on platform.workspace_roles
for each row
execute function app_private.guard_workspace_role_immutability_v1();


-- SELECTED EFFECT B.G32
create trigger trg_guard_workspace_role_module_draft_only
before insert or update or delete on platform.workspace_role_modules
for each row
execute function app_private.guard_workspace_role_module_draft_only_v1();


-- SELECTED EFFECT B.G33
create trigger trg_guard_workspace_role_permission_bindings
before insert or update or delete on platform.workspace_role_permissions
for each row
execute function app_private.guard_workspace_role_permission_bindings_v1();


-- SELECTED EFFECT B.G34
create trigger trg_guard_workspace_member_role_invariants
before insert or update or delete on platform.workspace_member_roles
for each row
execute function app_private.guard_workspace_member_role_invariants_v1();


-- SELECTED EFFECT B.G35
create trigger trg_bootstrap_role_workspace_delegation_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_workspace_delegation_permissions_v1();


-- SELECTED EFFECT B.G36
create trigger cap_customer_membership_to_access_basis
before insert or update on identity.memberships
for each row execute function platform.cap_customer_membership_to_access_basis();


-- SELECTED EFFECT B.G37
create trigger cap_customer_context_to_membership
before insert or update on identity.context_grants
for each row execute function platform.cap_customer_context_to_membership();


-- SELECTED EFFECT B.G38
create trigger require_workspace_access_basis_for_provisioning
before update of lifecycle_status on platform.customer_workspaces
for each row execute function platform.require_workspace_access_basis_for_provisioning();


-- SELECTED EFFECT B.G39
create trigger guard_undefined_workspace_access_basis_role
before insert or update of role_id,customer_workspace_id on platform.workspace_access_bases
for each row execute function app_private.guard_undefined_primary_role_v1();


-- SELECTED EFFECT B.G42
create trigger trg_workspace_role_authority_source_immutable
before update or delete on platform.workspace_member_role_authority_sources
for each row execute function app_private.guard_workspace_role_authority_source_immutable_v1();


-- SELECTED EFFECT B.G43
create trigger trg_workspace_member_role_authority_v2
before insert or update on platform.workspace_member_roles
for each row execute function app_private.guard_workspace_member_role_authority_v2();


-- SELECTED EFFECT B.G44
create trigger canonical_authority_revision_guard
before insert or update or delete on app_private.canonical_authority_revision_v1
for each row execute function app_private.guard_authority_revision_v1();


-- SELECTED EFFECT B.G45
create trigger canonical_authority_revision_truncate_guard
before truncate on app_private.canonical_authority_revision_v1
for each statement execute function app_private.guard_authority_revision_v1();


-- SELECTED EFFECT B.G46
create trigger jurisdiction_bound_property_address_guard
before update of address_id on portfolio.properties
for each row execute function app_private.guard_jurisdiction_bound_property_address_v1();


-- SELECTED EFFECT B.G48
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.context_grants
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G49
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.memberships
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G50
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G51
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.role_permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G52
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on identity.roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G53
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.customer_workspaces
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G54
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_definitions
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G55
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_operating_model_compatibilities
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G56
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_permission_bindings
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G57
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.module_property_profile_compatibilities
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G58
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.operating_models
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G59
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.property_profiles
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G60
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_entitlements
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G61
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_member_role_authority_sources
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G62
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_member_roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G63
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_modules
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G64
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_property_bindings
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G65
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_role_modules
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G66
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_role_permissions
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G67
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_roles
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G68
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on platform.workspace_taxonomy_assignments
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G69
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on portfolio.buildings
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.G70
create trigger canonical_authority_revision_changed
after insert or update or delete or truncate on portfolio.units
for each statement execute function app_private.bump_canonical_authority_revision_v1();


-- SELECTED EFFECT B.X01
create index outbox_unpublished_idx on platform.outbox_events (occurred_at, id) where published_at is null;


-- SELECTED EFFECT B.X02
create unique index memberships_active_unique on identity.memberships (tenant_id,user_id,role_id) where status in ('invited','active');


-- SELECTED EFFECT B.X03
create index properties_tenant_status_idx on portfolio.properties(tenant_id,status,id);


-- SELECTED EFFECT B.X04
create index buildings_tenant_property_idx on portfolio.buildings(tenant_id,property_id,id);


-- SELECTED EFFECT B.X05
create index units_tenant_building_idx on portfolio.units(tenant_id,building_id,status,id);


-- SELECTED EFFECT B.X06
create index audit_events_tenant_time_idx on audit.events(tenant_id,occurred_at desc,id desc);


-- SELECTED EFFECT B.X07
create index customer_workspaces_tenant_idx on platform.customer_workspaces (tenant_id);


-- SELECTED EFFECT B.X08
create index customer_workspaces_status_idx on platform.customer_workspaces (lifecycle_status);


-- SELECTED EFFECT B.X09
create index customer_workspaces_env_idx on platform.customer_workspaces (environment);


-- SELECTED EFFECT B.X10
create index workspace_contracts_workspace_idx on platform.workspace_contracts (customer_workspace_id, status);


-- SELECTED EFFECT B.X11
create index workspace_entitlements_lookup_idx on platform.workspace_entitlements (customer_workspace_id, entitlement_key);


-- SELECTED EFFECT B.X12
create index if not exists audit_events_actor_id_idx
  on audit.events (actor_id);


-- SELECTED EFFECT B.X13
create index if not exists workspace_contracts_plan_id_idx
  on platform.workspace_contracts (plan_id);


-- SELECTED EFFECT B.X14
create index if not exists workspace_entitlements_contract_id_idx
  on platform.workspace_entitlements (contract_id);


-- SELECTED EFFECT B.X15
create index if not exists workspace_entitlements_override_approved_by_idx
  on platform.workspace_entitlements (override_approved_by);


-- SELECTED EFFECT B.X16
create index customer_workspaces_primary_admin_user_idx
  on platform.customer_workspaces (primary_admin_user_id);


-- SELECTED EFFECT B.X17
create index customer_workspaces_primary_admin_membership_idx
  on platform.customer_workspaces (primary_admin_membership_id);


-- SELECTED EFFECT B.X18
create index customer_workspaces_onboarding_completed_by_idx
  on platform.customer_workspaces (onboarding_completed_by);


-- SELECTED EFFECT B.X19
create index if not exists subscription_plans_browse_idx
  on platform.subscription_plans (status, plan_code, version desc);


-- SELECTED EFFECT B.X20
create unique index if not exists subscription_plans_one_active_code_idx
  on platform.subscription_plans (plan_code) where status = 'active';


-- SELECTED EFFECT B.X21
create index if not exists workspace_contracts_plan_workspace_idx
  on platform.workspace_contracts (plan_id, customer_workspace_id) where plan_id is not null;


-- SELECTED EFFECT B.X22
create index if not exists audit_events_action_time_idx
  on audit.events(action, occurred_at desc, id desc);


-- SELECTED EFFECT B.X23
create index if not exists audit_events_entity_time_idx
  on audit.events(entity_type, occurred_at desc, id desc);


-- SELECTED EFFECT B.X24
create index accounting_periods_scope_date_idx on finance.accounting_periods(tenant_id,property_id,starts_on,ends_on);


-- SELECTED EFFECT B.X25
create index accounting_periods_property_id_idx on finance.accounting_periods(property_id);


-- SELECTED EFFECT B.X26
create unique index context_grants_open_tenant_unique
  on identity.context_grants (membership_id, tenant_id, scope_type)
  where scope_type = 'tenant'
    and property_id is null
    and building_id is null
    and unit_id is null
    and ends_at is null;


-- SELECTED EFFECT B.X27
create index if not exists accounting_periods_closed_by_idx on finance.accounting_periods(closed_by);


-- SELECTED EFFECT B.X32
create index property_profiles_code_ver_idx on platform.property_profiles (code, version);


-- SELECTED EFFECT B.X33
create index operating_models_code_ver_idx on platform.operating_models (code, version);


-- SELECTED EFFECT B.X34
create index space_kinds_code_ver_idx on platform.space_kinds (code, version);


-- SELECTED EFFECT B.X35
create index prop_op_compat_lookup_idx on platform.property_operating_model_compatibilities (property_profile_id, operating_model_id);


-- SELECTED EFFECT B.X36
create index prop_space_compat_lookup_idx on platform.property_space_kind_compatibilities (property_profile_id, space_kind_id);


-- SELECTED EFFECT B.X37
create index ws_taxonomy_assignments_lookup_idx on platform.workspace_taxonomy_assignments (tenant_id, customer_workspace_id, status);


-- SELECTED EFFECT B.X38
create index ws_prop_bindings_lookup_idx on platform.workspace_property_bindings (tenant_id, property_id, status);


-- SELECTED EFFECT B.X39
create index ws_prop_bindings_ws_idx on platform.workspace_property_bindings (customer_workspace_id, status);


-- SELECTED EFFECT B.X40
create index module_definitions_code_ver_idx on platform.module_definitions (code, version);


-- SELECTED EFFECT B.X41
create index module_definitions_lifecycle_idx on platform.module_definitions (lifecycle_status, is_active);


-- SELECTED EFFECT B.X42
create index mod_prop_compat_lookup_idx on platform.module_property_profile_compatibilities (module_definition_id, property_profile_id);


-- SELECTED EFFECT B.X43
create index mod_op_compat_lookup_idx on platform.module_operating_model_compatibilities (module_definition_id, operating_model_id);


-- SELECTED EFFECT B.X44
create index ws_modules_ws_code_idx on platform.workspace_modules (customer_workspace_id, module_code);


-- SELECTED EFFECT B.X45
create index ws_modules_tenant_ws_idx on platform.workspace_modules (tenant_id, customer_workspace_id);


-- SELECTED EFFECT B.X46
create unique index uq_workspace_modules_active_code on platform.workspace_modules (customer_workspace_id, module_code) where (valid_to is null);


-- SELECTED EFFECT B.X47
create unique index module_permission_bindings_active_idx
  on platform.module_permission_bindings (module_definition_id, permission_id)
  where (lifecycle_status = 'active' and valid_to is null);


-- SELECTED EFFECT B.X48
create index mod_perm_bindings_lookup_idx
  on platform.module_permission_bindings (module_definition_id, permission_id, lifecycle_status);


-- SELECTED EFFECT B.X49
create unique index workspace_roles_active_published_idx
  on platform.workspace_roles (customer_workspace_id, code)
  where (lifecycle_status = 'published' and valid_to is null);


-- SELECTED EFFECT B.X50
create index ws_roles_tenant_ws_idx
  on platform.workspace_roles (tenant_id, customer_workspace_id, lifecycle_status);


-- SELECTED EFFECT B.X51
create index ws_role_modules_lookup_idx
  on platform.workspace_role_modules (workspace_role_id, module_definition_id);


-- SELECTED EFFECT B.X52
create index ws_role_permissions_lookup_idx
  on platform.workspace_role_permissions (workspace_role_id, permission_id, effect);


-- SELECTED EFFECT B.X53
create index ws_member_roles_active_lookup_idx
  on platform.workspace_member_roles (customer_workspace_id, membership_id, workspace_role_id)
  where (valid_to is null);


-- SELECTED EFFECT B.X54
create index ws_member_roles_tenant_idx
  on platform.workspace_member_roles (tenant_id, customer_workspace_id);


-- SELECTED EFFECT B.X55
create index ws_role_idempotency_lookup_idx
  on platform.workspace_role_idempotency (tenant_id, customer_workspace_id, action);


-- SELECTED EFFECT B.X56
create index ws_delegations_lookup_idx
  on platform.workspace_delegations (customer_workspace_id, lifecycle_status, valid_from, valid_until);


-- SELECTED EFFECT B.X57
create index ws_delegations_grantee_idx
  on platform.workspace_delegations (customer_workspace_id, grantee_membership_id, lifecycle_status);


-- SELECTED EFFECT B.X58
create index ws_delegations_grantor_idx
  on platform.workspace_delegations (customer_workspace_id, grantor_membership_id, lifecycle_status);


-- SELECTED EFFECT B.X59
create index ws_del_perms_delegation_idx
  on platform.workspace_delegation_permissions (delegation_id);


-- SELECTED EFFECT B.X60
create unique index workspace_access_bases_open_email
  on platform.workspace_access_bases(customer_workspace_id, normalized_email)
  where status in ('prepared','active');


-- SELECTED EFFECT B.X61
create unique index workspace_access_bases_payment_reference
  on platform.workspace_access_bases(payment_currency, payment_reference)
  where mode='PAID' and status in ('prepared','active');


-- SELECTED EFFECT B.X62
create index workspace_access_bases_expiry on platform.workspace_access_bases(expires_at)
  where status = 'active';


-- SELECTED EFFECT B.X64
create index workspace_role_authority_source_parent_idx
 on platform.workspace_member_role_authority_sources(source_assignment_id)
 where source_assignment_id is not null;


-- SELECTED EFFECT B.X65
create index jurisdiction_profiles_country_status_idx
  on platform.jurisdiction_profiles(country_code,status,valid_from,valid_to);


-- SELECTED EFFECT B.X66
create index property_jurisdiction_current_idx
  on platform.property_jurisdiction_assignments
  (tenant_id,property_id,status,valid_from,valid_to);


-- SELECTED EFFECT B.X67
create index property_jurisdiction_workspace_idx
  on platform.property_jurisdiction_assignments
  (customer_workspace_id,property_id,status);


-- SELECTED EFFECT B.X68
create unique index journals_source_unique on finance.journals(tenant_id,source_type,source_id) where source_id is not null;


-- SELECTED EFFECT B.X69
create index journal_entries_journal_idx on finance.journal_entries(tenant_id,journal_id,id);


-- SELECTED EFFECT B.X70
create index journal_entries_account_date_idx on finance.journal_entries(tenant_id,account_id,journal_id);


-- SELECTED EFFECT B.E056
alter table app_private.canonical_authority_revision_v1
  enable always trigger canonical_authority_revision_guard;


-- SELECTED EFFECT B.E057
alter table app_private.canonical_authority_revision_v1
  enable always trigger canonical_authority_revision_truncate_guard;


-- SELECTED EFFECT B.E058
alter table identity.context_grants enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E059
alter table identity.memberships enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E060
alter table identity.permissions enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E061
alter table identity.role_permissions enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E062
alter table identity.roles enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E063
alter table platform.customer_workspaces enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E064
alter table platform.module_definitions enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E065
alter table platform.module_operating_model_compatibilities enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E066
alter table platform.module_permission_bindings enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E067
alter table platform.module_property_profile_compatibilities enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E068
alter table platform.operating_models enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E069
alter table platform.property_profiles enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E070
alter table platform.workspace_delegation_permissions enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E071
alter table platform.workspace_delegations enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E072
alter table platform.workspace_entitlements enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E073
alter table platform.workspace_member_role_authority_sources enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E074
alter table platform.workspace_member_roles enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E075
alter table platform.workspace_modules enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E076
alter table platform.workspace_property_bindings enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E077
alter table platform.workspace_role_modules enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E078
alter table platform.workspace_role_permissions enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E079
alter table platform.workspace_roles enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E080
alter table platform.workspace_taxonomy_assignments enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E081
alter table portfolio.buildings enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.E082
alter table portfolio.units enable always trigger canonical_authority_revision_changed;


-- SELECTED EFFECT B.SD01
insert into identity.roles(tenant_id,code,name,is_system) values (null,'association_admin','Association Administrator',true);


-- SELECTED EFFECT B.SD02
insert into identity.roles(tenant_id,code,name,is_system) values (null,'property_manager','Property Manager',true);


-- SELECTED EFFECT B.SD03
insert into identity.roles(tenant_id,code,name,is_system) values (null,'president','Association President',true);


-- SELECTED EFFECT B.SD04
insert into identity.roles(tenant_id,code,name,is_system) values (null,'censor','Censor / Financial Auditor',true);


-- SELECTED EFFECT B.SD05
insert into identity.roles(tenant_id,code,name,is_system) values (null,'owner','Owner',true);


-- SELECTED EFFECT B.SD06
insert into identity.roles(tenant_id,code,name,is_system) values (null,'tenant_resident','Tenant / Resident',true);


-- SELECTED EFFECT B.SD07
insert into identity.permissions(code,resource,action,description) values ('onboarding.import.read','onboarding.import','read','Read controlled onboarding imports');


-- SELECTED EFFECT B.SD08
insert into identity.permissions(code,resource,action,description) values ('onboarding.import.manage','onboarding.import','manage','Create, upload, validate and dry-run onboarding imports');


-- SELECTED EFFECT B.SD09
insert into identity.permissions(code,resource,action,description) values ('onboarding.import.approve','onboarding.import','approve','Independently approve, reconcile and activate onboarding imports');


-- SELECTED EFFECT B.SD10
insert into identity.permissions(code,resource,action,description) values ('workspace.taxonomy.manage', 'workspace.taxonomy', 'manage', 'Assign and transition workspace universal taxonomy profiles and operating models');


-- SELECTED EFFECT B.SD11
insert into identity.permissions(code,resource,action,description) values ('workspace.module.manage', 'workspace.module', 'manage', 'Activate, configure, and deactivate workspace dynamic composition modules');


-- SELECTED EFFECT B.SD12
insert into identity.permissions(code,resource,action,description) values ('workspace.role.read', 'workspace.role', 'read', 'View workspace-local roles, module bindings, and member assignments');


-- SELECTED EFFECT B.SD13
insert into identity.permissions(code,resource,action,description) values ('workspace.role.manage', 'workspace.role', 'manage', 'Create and modify draft workspace-local roles, module attachments, and permission attachments');


-- SELECTED EFFECT B.SD14
insert into identity.permissions(code,resource,action,description) values ('workspace.role.publish', 'workspace.role', 'publish', 'Publish and supersede workspace-local roles with atomic version transition');


-- SELECTED EFFECT B.SD15
insert into identity.permissions(code,resource,action,description) values ('workspace.role.assign', 'workspace.role', 'assign', 'Assign and revoke workspace-local roles to workspace members with scope boundaries');


-- SELECTED EFFECT B.SD16
insert into identity.permissions(code,resource,action,description) values ('workspace.delegation.read', 'workspace.delegation', 'read', 'View workspace delegations, permission bindings, and audit trails');


-- SELECTED EFFECT B.SD17
insert into identity.permissions(code,resource,action,description) values ('workspace.delegation.manage', 'workspace.delegation', 'manage', 'Create delegation drafts, attach/detach permissions, and submit for acceptance');


-- SELECTED EFFECT B.SD18
insert into identity.permissions(code,resource,action,description) values ('workspace.delegation.approve', 'workspace.delegation', 'approve', 'Execute independent Four-Eyes approval or rejection decisions');


-- SELECTED EFFECT B.SD19
insert into identity.permissions(code,resource,action,description) values ('workspace.delegation.revoke', 'workspace.delegation', 'revoke', 'Execute administrative or emergency revocation of active delegations');


-- SELECTED EFFECT B.SD20
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='onboarding.import.read';


-- SELECTED EFFECT B.SD21
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='onboarding.import.manage';


-- SELECTED EFFECT B.SD22
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='onboarding.import.read';


-- SELECTED EFFECT B.SD23
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='onboarding.import.manage';


-- SELECTED EFFECT B.SD24
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='onboarding.import.approve';


-- SELECTED EFFECT B.SD25
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='onboarding.import.read';


-- SELECTED EFFECT B.SD26
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='onboarding.import.approve';


-- SELECTED EFFECT B.SD27
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='onboarding.import.read';


-- SELECTED EFFECT B.SD28
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='onboarding.import.approve';


-- SELECTED EFFECT B.SD29
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.taxonomy.manage';


-- SELECTED EFFECT B.SD30
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.module.manage';


-- SELECTED EFFECT B.SD31
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.role.read';


-- SELECTED EFFECT B.SD32
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.role.manage';


-- SELECTED EFFECT B.SD33
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.role.publish';


-- SELECTED EFFECT B.SD34
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.role.assign';


-- SELECTED EFFECT B.SD35
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.delegation.read';


-- SELECTED EFFECT B.SD36
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.delegation.manage';


-- SELECTED EFFECT B.SD37
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.delegation.approve';


-- SELECTED EFFECT B.SD38
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='association_admin' and p.code='workspace.delegation.revoke';


-- SELECTED EFFECT B.SD39
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.taxonomy.manage';


-- SELECTED EFFECT B.SD40
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.module.manage';


-- SELECTED EFFECT B.SD41
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.role.read';


-- SELECTED EFFECT B.SD42
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.role.manage';


-- SELECTED EFFECT B.SD43
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.role.publish';


-- SELECTED EFFECT B.SD44
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.role.assign';


-- SELECTED EFFECT B.SD45
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.delegation.read';


-- SELECTED EFFECT B.SD46
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.delegation.manage';


-- SELECTED EFFECT B.SD47
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.delegation.approve';


-- SELECTED EFFECT B.SD48
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='property_manager' and p.code='workspace.delegation.revoke';


-- SELECTED EFFECT B.SD49
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='workspace.role.read';


-- SELECTED EFFECT B.SD50
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='workspace.role.read';


-- SELECTED EFFECT B.SD51
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='workspace.delegation.read';


-- SELECTED EFFECT B.SD52
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='workspace.delegation.approve';


-- SELECTED EFFECT B.SD53
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='president' and p.code='workspace.delegation.revoke';


-- SELECTED EFFECT B.SD54
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='workspace.delegation.read';


-- SELECTED EFFECT B.SD55
insert into identity.role_permissions(role_id,permission_id,effect) select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null and r.code='censor' and p.code='workspace.delegation.approve';


-- SELECTED EFFECT B.SD56
insert into platform.property_profiles(code,version,name,labels_json,description) values ('residential_condominium', 1, 'Residential Condominium', jsonb_build_object('en','Residential Condominium','ro','Condominiu rezidențial','fa','مجتمع آپارتمانی مسکونی'), 'Apartment building or condominium block under co-ownership governance');


-- SELECTED EFFECT B.SD57
insert into platform.operating_models(code,version,name,labels_json,description) values ('association_managed', 1, 'Owners Association Managed', jsonb_build_object('en','Owners Association Managed','ro','Administrare prin Asociație de Proprietari','fa','مدیریت هیئت مدیره / انجمن مالکان'), 'Statutory condominium or HOA association governance under co-ownership law');


-- SELECTED EFFECT B.SD58
insert into platform.space_kinds(code,version,name,labels_json,description) values ('residential_unit', 1, 'Residential Unit', jsonb_build_object('en','Residential Unit','ro','Apartament / Unitate rezidențială','fa','واحد مسکونی / آپارتمان'), 'Private apartment or residential living space');


-- SELECTED EFFECT B.SD59
insert into platform.property_operating_model_compatibilities (property_profile_id, operating_model_id, compatibility_level, reason)
select p.id, m.id,
  case
    -- Condominium
    when p.code = 'residential_condominium' and m.code in ('association_managed', 'third_party_managed') then 'compatible'
    when p.code = 'residential_condominium' and m.code in ('developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'residential_condominium' then 'incompatible'

    -- Residential Complex
    when p.code = 'residential_complex' and m.code in ('association_managed', 'third_party_managed', 'mixed_authority') then 'compatible'
    when p.code = 'residential_complex' and m.code in ('developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'residential_complex' then 'incompatible'

    -- Gated Villa Community
    when p.code = 'gated_villa_community' and m.code in ('association_managed', 'third_party_managed', 'multi_owner_contractual') then 'compatible'
    when p.code = 'gated_villa_community' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'gated_villa_community' then 'incompatible'

    -- Single Villa
    when p.code = 'single_villa' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease') then 'compatible'
    when p.code = 'single_villa' then 'incompatible'

    -- Small Landlord Portfolio
    when p.code = 'small_landlord_portfolio' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease') then 'compatible'
    when p.code = 'small_landlord_portfolio' then 'incompatible'

    -- Mixed-Use Estate
    when p.code = 'mixed_use_estate' and m.code in ('mixed_authority', 'third_party_managed', 'institutional_owner') then 'compatible'
    when p.code = 'mixed_use_estate' and m.code in ('association_managed', 'developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'mixed_use_estate' then 'incompatible'

    -- Retail Centre
    when p.code = 'retail_centre' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'retail_centre' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'retail_centre' then 'incompatible'

    -- Office Centre
    when p.code = 'office_centre' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'office_centre' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'office_centre' then 'incompatible'

    -- Warehouse Logistics
    when p.code = 'warehouse_logistics' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'warehouse_logistics' then 'incompatible'

    -- Managed Township
    when p.code = 'managed_township' and m.code in ('mixed_authority', 'third_party_managed', 'developer_operated', 'institutional_owner') then 'compatible'
    when p.code = 'managed_township' then 'incompatible'

    -- Industrial Park
    when p.code = 'industrial_park' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'mixed_authority') then 'compatible'
    when p.code = 'industrial_park' then 'incompatible'

    -- Serviced Residence
    when p.code = 'serviced_residence' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease', 'institutional_owner') then 'compatible'
    when p.code = 'serviced_residence' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'serviced_residence' then 'incompatible'

    -- Standalone Parking
    when p.code = 'standalone_parking' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease', 'mixed_authority') then 'compatible'
    when p.code = 'standalone_parking' then 'incompatible'

    -- Shared Facility
    when p.code = 'shared_facility' and m.code in ('third_party_managed', 'single_owner_operated', 'mixed_authority') then 'compatible'
    when p.code = 'shared_facility' and m.code = 'association_managed' then 'review_required'
    when p.code = 'shared_facility' then 'incompatible'

    -- Developer Portfolio
    when p.code = 'developer_portfolio' and m.code in ('developer_operated', 'third_party_managed') then 'compatible'
    when p.code = 'developer_portfolio' then 'incompatible'

    -- Third-Party Portfolio
    when p.code = 'third_party_management_portfolio' and m.code in ('third_party_managed', 'mixed_authority') then 'compatible'
    when p.code = 'third_party_management_portfolio' then 'incompatible'

    else 'incompatible'
  end as compatibility_level,
  'Canonical architectural compatibility matrix v1.0' as reason
from platform.property_profiles p
cross join platform.operating_models m;


-- SELECTED EFFECT B.SD60
insert into platform.property_space_kind_compatibilities (property_profile_id, space_kind_id, compatibility_level, reason)
select p.id, s.id,
  case
    -- Condominium Allowed Spaces
    when p.code = 'residential_condominium' and s.code in ('residential_unit', 'parking_space', 'storage_space', 'common_area', 'technical_room', 'service_point', 'roof_deck') then 'compatible'
    when p.code = 'residential_condominium' and s.code in ('retail_unit', 'amenity', 'shared_facility', 'courtyard_garden') then 'review_required'
    when p.code = 'residential_condominium' then 'incompatible'

    -- Residential Complex
    when p.code = 'residential_complex' and s.code in ('residential_unit', 'villa', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'technical_room', 'service_point', 'courtyard_garden', 'roof_deck', 'infrastructure_node') then 'compatible'
    when p.code = 'residential_complex' and s.code in ('retail_unit', 'provider_location') then 'review_required'
    when p.code = 'residential_complex' then 'incompatible'

    -- Gated Villa Community
    when p.code = 'gated_villa_community' and s.code in ('villa', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'technical_room', 'service_point', 'courtyard_garden', 'infrastructure_node', 'yard', 'land_parcel') then 'compatible'
    when p.code = 'gated_villa_community' and s.code in ('provider_location', 'retail_unit') then 'review_required'
    when p.code = 'gated_villa_community' then 'incompatible'

    -- Single Villa
    when p.code = 'single_villa' and s.code in ('villa', 'parking_space', 'storage_space', 'courtyard_garden', 'amenity', 'technical_room', 'yard', 'land_parcel') then 'compatible'
    when p.code = 'single_villa' then 'incompatible'

    -- Small Landlord Portfolio
    when p.code = 'small_landlord_portfolio' and s.code in ('residential_unit', 'villa', 'parking_space', 'storage_space') then 'compatible'
    when p.code = 'small_landlord_portfolio' and s.code in ('retail_unit', 'office_suite') then 'review_required'
    when p.code = 'small_landlord_portfolio' then 'incompatible'

    -- Mixed Use Estate
    when p.code = 'mixed_use_estate' and s.code in ('residential_unit', 'retail_unit', 'office_suite', 'parking_space', 'storage_space', 'common_area', 'shared_facility', 'amenity', 'service_point', 'provider_location', 'technical_room', 'courtyard_garden', 'roof_deck', 'infrastructure_node', 'loading_zone') then 'compatible'
    when p.code = 'mixed_use_estate' and s.code in ('warehouse_bay', 'yard', 'land_parcel') then 'review_required'
    when p.code = 'mixed_use_estate' then 'incompatible'

    -- Retail Centre
    when p.code = 'retail_centre' and s.code in ('retail_unit', 'parking_space', 'storage_space', 'common_area', 'service_point', 'provider_location', 'technical_room', 'infrastructure_node', 'amenity', 'loading_zone') then 'compatible'
    when p.code = 'retail_centre' and s.code in ('office_suite', 'warehouse_bay', 'yard') then 'review_required'
    when p.code = 'retail_centre' then 'incompatible'

    -- Office Centre
    when p.code = 'office_centre' and s.code in ('office_suite', 'retail_unit', 'parking_space', 'storage_space', 'common_area', 'shared_facility', 'service_point', 'provider_location', 'technical_room', 'infrastructure_node') then 'compatible'
    when p.code = 'office_centre' and s.code in ('warehouse_bay', 'loading_zone', 'yard') then 'review_required'
    when p.code = 'office_centre' then 'incompatible'

    -- Warehouse & Logistics
    when p.code = 'warehouse_logistics' and s.code in ('warehouse_bay', 'industrial_lot', 'office_suite', 'parking_space', 'storage_space', 'technical_room', 'infrastructure_node', 'service_point', 'yard', 'loading_zone') then 'compatible'
    when p.code = 'warehouse_logistics' then 'incompatible'

    -- Managed Township
    when p.code = 'managed_township' then 'compatible'

    -- Industrial Park
    when p.code = 'industrial_park' and s.code in ('industrial_lot', 'factory_hall', 'warehouse_bay', 'office_suite', 'parking_space', 'storage_space', 'technical_room', 'infrastructure_node', 'service_point', 'yard', 'loading_zone', 'land_parcel') then 'compatible'
    when p.code = 'industrial_park' then 'incompatible'

    -- Serviced Residence
    when p.code = 'serviced_residence' and s.code in ('residential_unit', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'service_point', 'provider_location', 'technical_room') then 'compatible'
    when p.code = 'serviced_residence' and s.code in ('retail_unit', 'office_suite') then 'review_required'
    when p.code = 'serviced_residence' then 'incompatible'

    -- Standalone Parking
    when p.code = 'standalone_parking' and s.code in ('parking_space', 'technical_room', 'service_point', 'infrastructure_node') then 'compatible'
    when p.code = 'standalone_parking' and s.code = 'storage_space' then 'review_required'
    when p.code = 'standalone_parking' then 'incompatible'

    -- Shared Facility
    when p.code = 'shared_facility' and s.code in ('shared_facility', 'amenity', 'service_point', 'common_area', 'technical_room', 'parking_space', 'provider_location') then 'compatible'
    when p.code = 'shared_facility' then 'incompatible'

    -- Developer Portfolio
    when p.code = 'developer_portfolio' then 'compatible'

    -- Third-Party Management Portfolio
    when p.code = 'third_party_management_portfolio' then 'compatible'

    else 'incompatible'
  end as compatibility_level,
  'Canonical architectural space kind matrix v1.0' as reason
from platform.property_profiles p
cross join platform.space_kinds s;


-- SELECTED EFFECT B.OC1.FINAL.T04
revoke all privileges on table identity.permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T04
revoke select ("id","code","resource","action","description"), insert ("id","code","resource","action","description"), update ("id","code","resource","action","description"), references ("id","code","resource","action","description") on table identity.permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T04
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T04
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T13
revoke all privileges on type identity.scope_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T13
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='identity.scope_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type identity.scope_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T15
revoke all privileges on table platform.module_definitions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T15
revoke select ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), update ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at"), references ("id","code","version","name","labels_json","description","category","is_active","lifecycle_status","sensitivity_level","requires_aal2","entitlement_key","config_schema","default_config","published_at","valid_from","valid_to","created_at","updated_at") on table platform.module_definitions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T15
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_definitions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_definitions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T15
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_definitions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_definitions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T25
revoke all privileges on table app_private.canonical_authority_revision_v1 from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T25
revoke select ("singleton","revision"), insert ("singleton","revision"), update ("singleton","revision"), references ("singleton","revision") on table app_private.canonical_authority_revision_v1 from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T25
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='app_private.canonical_authority_revision_v1'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table app_private.canonical_authority_revision_v1 from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T25
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='app_private.canonical_authority_revision_v1'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table app_private.canonical_authority_revision_v1 from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T38
revoke all privileges on table identity.profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T38
revoke select ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), insert ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), update ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at"), references ("user_id","display_name","locale","timezone","phone_encrypted","created_at","updated_at") on table identity.profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T38
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T38
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T42
revoke all privileges on type platform.decision_effect from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T42
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.decision_effect'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.decision_effect from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T43
revoke all privileges on type platform.record_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T43
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.record_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.record_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T44
revoke all privileges on type platform.workspace_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T44
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T45
revoke all privileges on type platform.workspace_lifecycle_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T45
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_lifecycle_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_lifecycle_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T46
revoke all privileges on type platform.workspace_environment from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T46
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.workspace_environment'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.workspace_environment from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T47
revoke all privileges on type portfolio.property_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T47
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.property_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.property_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T49
revoke all privileges on type identity.membership_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T49
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='identity.membership_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type identity.membership_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T52
revoke all privileges on type portfolio.unit_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T52
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.unit_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.unit_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T53
revoke all privileges on type finance.accounting_period_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T53
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.accounting_period_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.accounting_period_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T54
revoke all privileges on type finance.journal_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T54
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.journal_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.journal_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T57
revoke all privileges on type finance.entry_side from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T57
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.entry_side'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.entry_side from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T59
revoke all privileges on table platform.subscription_plans from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T59
revoke select ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), insert ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), update ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at"), references ("id","plan_code","version","display_name","status","feature_catalogue","limit_schema","effective_from","effective_until","created_at") on table platform.subscription_plans from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T59
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.subscription_plans'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.subscription_plans from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T59
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.subscription_plans'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.subscription_plans from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T60
revoke all privileges on type finance.account_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T60
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='finance.account_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type finance.account_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T61
revoke all privileges on type portfolio.party_type from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T61
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='portfolio.party_type'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type portfolio.party_type from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T63
revoke all privileges on type platform.property_jurisdiction_assignment_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T63
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.property_jurisdiction_assignment_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.property_jurisdiction_assignment_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T66
revoke all privileges on type platform.jurisdiction_profile_status from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T66
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select typacl acl,typowner owner from pg_type where oid='platform.jurisdiction_profile_status'::regtype) o,
  lateral aclexplode(coalesce(o.acl,acldefault('T',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on type platform.jurisdiction_profile_status from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T01
revoke all privileges on table platform.tenants from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T01
revoke select ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), insert ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), update ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at"), references ("id","legal_name","registration_number","status","default_locale","timezone","created_at","updated_at","archived_at") on table platform.tenants from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T01
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.tenants'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.tenants from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.tenants'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.tenants from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T09
revoke all privileges on table platform.property_profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T09
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.property_profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T09
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T09
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T10
revoke all privileges on table platform.operating_models from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T10
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.operating_models from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T10
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.operating_models'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.operating_models from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T10
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.operating_models'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.operating_models from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T19
revoke all privileges on table platform.space_kinds from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T19
revoke select ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), insert ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), update ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at"), references ("id","code","version","name","labels_json","description","lifecycle_status","is_active","valid_from","valid_to","metadata_json","created_at","updated_at") on table platform.space_kinds from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T19
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.space_kinds'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.space_kinds from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T19
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.space_kinds'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.space_kinds from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T22
revoke all privileges on table platform.module_permission_bindings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T22
revoke select ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), insert ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), update ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at"), references ("id","module_definition_id","permission_id","binding_version","permission_mode","is_assignable_to_local_role","is_delegable","requires_aal2","lifecycle_status","valid_from","valid_to","created_at") on table platform.module_permission_bindings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T22
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_permission_bindings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_permission_bindings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T22
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_permission_bindings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_permission_bindings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T62
revoke all privileges on table platform.jurisdiction_profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T62
revoke select ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), insert ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), update ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at"), references ("id","code","version","country_code","name","default_currency_code","default_timezone","calendar_code","manifest_sha256","status","valid_from","valid_to","legal_signoff_reference","legal_signed_at","accounting_signoff_reference","accounting_signed_at","activated_at","retired_at","created_at","updated_at") on table platform.jurisdiction_profiles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T62
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.jurisdiction_profiles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.jurisdiction_profiles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T62
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.jurisdiction_profiles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.jurisdiction_profiles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T02
revoke all privileges on table identity.roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T02
revoke select ("id","tenant_id","code","name","is_system","created_at"), insert ("id","tenant_id","code","name","is_system","created_at"), update ("id","tenant_id","code","name","is_system","created_at"), references ("id","tenant_id","code","name","is_system","created_at") on table identity.roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T02
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T02
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T05
revoke all privileges on table platform.customer_workspaces from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T05
revoke select ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at","primary_admin_user_id","primary_admin_membership_id","primary_admin_accepted_at","onboarding_completed_at","onboarding_completed_by"), insert ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at","primary_admin_user_id","primary_admin_membership_id","primary_admin_accepted_at","onboarding_completed_at","onboarding_completed_by"), update ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at","primary_admin_user_id","primary_admin_membership_id","primary_admin_accepted_at","onboarding_completed_at","onboarding_completed_by"), references ("id","tenant_id","workspace_type","lifecycle_status","commercial_owner","environment","version","created_at","updated_at","activated_at","suspended_at","terminated_at","archived_at","primary_admin_user_id","primary_admin_membership_id","primary_admin_accepted_at","onboarding_completed_at","onboarding_completed_by") on table platform.customer_workspaces from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T05
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.customer_workspaces'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.customer_workspaces from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T05
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.customer_workspaces'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.customer_workspaces from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T20
revoke all privileges on table platform.property_operating_model_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T20
revoke select ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), insert ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), update ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at"), references ("id","property_profile_id","operating_model_id","compatibility_level","rule_version","reason","metadata_json","created_at") on table platform.property_operating_model_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T20
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_operating_model_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_operating_model_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T20
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_operating_model_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_operating_model_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T21
revoke all privileges on table platform.property_space_kind_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T21
revoke select ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), insert ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), update ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at"), references ("id","property_profile_id","space_kind_id","compatibility_level","rule_version","reason","metadata_json","created_at") on table platform.property_space_kind_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T21
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_space_kind_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_space_kind_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T21
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_space_kind_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_space_kind_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T23
revoke all privileges on table platform.module_property_profile_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T23
revoke select ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), insert ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), update ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at"), references ("id","module_definition_id","property_profile_id","compatibility_level","reason","created_at") on table platform.module_property_profile_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T23
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_property_profile_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_property_profile_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T23
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_property_profile_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_property_profile_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T24
revoke all privileges on table platform.module_operating_model_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T24
revoke select ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), insert ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), update ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at"), references ("id","module_definition_id","operating_model_id","compatibility_level","reason","created_at") on table platform.module_operating_model_compatibilities from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T24
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.module_operating_model_compatibilities'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.module_operating_model_compatibilities from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T24
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.module_operating_model_compatibilities'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.module_operating_model_compatibilities from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T32
revoke all privileges on table audit.events from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T32
revoke select ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), insert ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), update ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at"), references ("id","tenant_id","actor_id","actor_role","action","entity_type","entity_id","request_id","before_snapshot","after_snapshot","reason","occurred_at") on table audit.events from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T32
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='audit.events'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table audit.events from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T32
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='audit.events'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table audit.events from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T33
revoke all privileges on table platform.outbox_events from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T33
revoke select ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), insert ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), update ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts"), references ("id","tenant_id","aggregate_type","aggregate_id","aggregate_version","event_type","payload","trace_id","occurred_at","published_at","publish_attempts") on table platform.outbox_events from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T33
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.outbox_events'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.outbox_events from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T33
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.outbox_events'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.outbox_events from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T48
revoke all privileges on table portfolio.addresses from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T48
revoke select ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), insert ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), update ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at"), references ("id","tenant_id","country_code","county","city","street","building_no","postal_code","latitude","longitude","created_at") on table portfolio.addresses from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T48
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.addresses'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.addresses from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T48
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.addresses'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.addresses from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T56
revoke all privileges on table portfolio.parties from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T56
revoke select ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), insert ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), update ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at"), references ("id","tenant_id","type","legal_name","tax_ref_encrypted","email_encrypted","phone_encrypted","created_at","updated_at","archived_at") on table portfolio.parties from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T56
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.parties'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.parties from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T56
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.parties'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.parties from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T03
revoke all privileges on table identity.role_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T03
revoke select ("role_id","permission_id","effect"), insert ("role_id","permission_id","effect"), update ("role_id","permission_id","effect"), references ("role_id","permission_id","effect") on table identity.role_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T03
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.role_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.role_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T03
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.role_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.role_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T06
revoke all privileges on table portfolio.properties from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T06
revoke select ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), insert ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), update ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at"), references ("id","tenant_id","type","name","address_id","base_currency","status","created_at","updated_at") on table portfolio.properties from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T06
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.properties'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.properties from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T06
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.properties'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.properties from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T08
revoke all privileges on table platform.workspace_taxonomy_assignments from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T08
revoke select ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at","country_code"), insert ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at","country_code"), update ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at","country_code"), references ("id","tenant_id","customer_workspace_id","property_profile_id","operating_model_id","status","valid_from","valid_to","notes","created_by","created_at","updated_at","country_code") on table platform.workspace_taxonomy_assignments from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T08
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_taxonomy_assignments'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_taxonomy_assignments from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T08
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_taxonomy_assignments'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_taxonomy_assignments from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T11
revoke all privileges on table identity.memberships from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T11
revoke select ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), insert ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), update ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at"), references ("id","tenant_id","user_id","role_id","status","starts_at","ends_at","created_at","updated_at") on table identity.memberships from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T11
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.memberships'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.memberships from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T11
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.memberships'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.memberships from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T14
revoke all privileges on table platform.workspace_modules from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T14
revoke select ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","module_definition_id","module_code","status","config_json","valid_from","valid_to","activated_at","deactivated_at","activated_by","deactivated_by","reason","created_at","updated_at") on table platform.workspace_modules from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T14
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_modules'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_modules from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T14
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_modules'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_modules from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T37
revoke all privileges on table platform.workspace_role_idempotency from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T37
revoke select ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), insert ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), update ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at"), references ("id","tenant_id","customer_workspace_id","idempotency_key","action","request_hash","request_hash_version","result_entity_id","response_snapshot","actor_id","created_at") on table platform.workspace_role_idempotency from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T37
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_idempotency'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_idempotency from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T37
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_idempotency'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_idempotency from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T39
revoke all privileges on table platform.workspace_roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T39
revoke select ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), insert ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), update ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at"), references ("id","tenant_id","customer_workspace_id","code","role_version","lock_version","name","description","base_role_id","scope_ceiling","lifecycle_status","valid_from","valid_to","created_by","created_at") on table platform.workspace_roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T39
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T39
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T50
revoke all privileges on table platform.workspace_contracts from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T50
revoke select ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), insert ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), update ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at"), references ("id","customer_workspace_id","plan_id","contract_ref","version","currency","status","start_date","end_date","signed_at","activated_at","commercial_terms","created_at") on table platform.workspace_contracts from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T50
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_contracts'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_contracts from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T50
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_contracts'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_contracts from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T07
revoke all privileges on table platform.workspace_property_bindings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T07
revoke select ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_id","status","valid_from","valid_to","binding_source","created_by","created_at","updated_at") on table platform.workspace_property_bindings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T07
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_property_bindings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_property_bindings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T07
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_property_bindings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_property_bindings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T12
revoke all privileges on table identity.context_grants from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T12
revoke select ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), insert ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), update ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at"), references ("id","membership_id","tenant_id","scope_type","property_id","building_id","unit_id","starts_at","ends_at","created_at") on table identity.context_grants from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T12
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='identity.context_grants'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table identity.context_grants from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T12
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='identity.context_grants'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table identity.context_grants from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T16
revoke all privileges on table platform.workspace_entitlements from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T16
revoke select ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), insert ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), update ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at"), references ("id","customer_workspace_id","contract_id","entitlement_key","value_type","numeric_value","boolean_value","text_value","json_value","valid_from","valid_until","override_value_json","override_reason","override_expires_at","override_approved_by","created_at","updated_at") on table platform.workspace_entitlements from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T16
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_entitlements'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_entitlements from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T16
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_entitlements'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_entitlements from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T27
revoke all privileges on table portfolio.buildings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T27
revoke select ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), insert ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), update ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at"), references ("id","tenant_id","property_id","code","name","year_built","floors","status","created_at","updated_at") on table portfolio.buildings from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T27
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.buildings'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.buildings from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T27
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.buildings'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.buildings from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T29
revoke all privileges on table finance.accounting_periods from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T29
revoke select ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at","closed_by"), insert ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at","closed_by"), update ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at","closed_by"), references ("id","tenant_id","property_id","starts_on","ends_on","status","closed_at","snapshot_json","created_at","closed_by") on table finance.accounting_periods from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T29
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.accounting_periods'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.accounting_periods from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T29
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.accounting_periods'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.accounting_periods from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T30
revoke all privileges on table finance.journals from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T30
revoke select ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), insert ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), update ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at"), references ("id","tenant_id","property_id","journal_no","occurred_on","currency","description","source_type","source_id","status","reversal_of_id","posted_at","posted_by","created_at") on table finance.journals from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T30
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.journals'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.journals from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T30
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journals'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.journals from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T40
revoke all privileges on table platform.workspace_role_modules from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T40
revoke select ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), insert ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), update ("id","tenant_id","workspace_role_id","module_definition_id","created_at"), references ("id","tenant_id","workspace_role_id","module_definition_id","created_at") on table platform.workspace_role_modules from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T40
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_modules'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_modules from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T40
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_modules'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_modules from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T41
revoke all privileges on table platform.workspace_role_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T41
revoke select ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), insert ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), update ("id","tenant_id","workspace_role_id","permission_id","effect","created_at"), references ("id","tenant_id","workspace_role_id","permission_id","effect","created_at") on table platform.workspace_role_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T41
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T41
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T55
revoke all privileges on table finance.accounts from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T55
revoke select ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), insert ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), update ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at"), references ("id","tenant_id","property_id","code","name","type","currency","parent_account_id","is_control_account","status","created_at") on table finance.accounts from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T55
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.accounts'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.accounts from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T55
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.accounts'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.accounts from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T58
revoke all privileges on table platform.property_jurisdiction_assignments from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T58
revoke select ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","property_id","jurisdiction_profile_id","assignment_version","country_code","profile_manifest_sha256","status","binding_source","valid_from","valid_to","reason","created_by","created_at","updated_at") on table platform.property_jurisdiction_assignments from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T58
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.property_jurisdiction_assignments'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.property_jurisdiction_assignments from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T58
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.property_jurisdiction_assignments'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.property_jurisdiction_assignments from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T17
revoke all privileges on table platform.workspace_access_bases from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T17
revoke select ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), insert ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), update ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason"), references ("id","customer_workspace_id","normalized_email","role_id","mode","status","duration_hours","contract_id","payment_reference","payment_amount","payment_currency","paid_on","paid_through","evidence_note","approved_by","approved_at","activated_at","expires_at","membership_id","context_grant_id","revoked_by","revoked_at","revoke_reason") on table platform.workspace_access_bases from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T17
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_access_bases'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_access_bases from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T17
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_access_bases'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_access_bases from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T51
revoke all privileges on table portfolio.entrances from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T51
revoke select ("id","tenant_id","building_id","code","name","created_at"), insert ("id","tenant_id","building_id","code","name","created_at"), update ("id","tenant_id","building_id","code","name","created_at"), references ("id","tenant_id","building_id","code","name","created_at") on table portfolio.entrances from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T51
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.entrances'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.entrances from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T51
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.entrances'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.entrances from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T28
revoke all privileges on table portfolio.units from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T28
revoke select ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), insert ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), update ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at"), references ("id","tenant_id","building_id","entrance_id","code","floor","area_m2","bedrooms","status","created_at","updated_at") on table portfolio.units from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T28
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='portfolio.units'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table portfolio.units from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T28
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='portfolio.units'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table portfolio.units from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T31
revoke all privileges on table finance.journal_entries from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T31
revoke select ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), insert ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), update ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at"), references ("id","tenant_id","journal_id","account_id","unit_id","party_id","side","amount","memo","created_at") on table finance.journal_entries from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T31
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='finance.journal_entries'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table finance.journal_entries from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T31
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journal_entries'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table finance.journal_entries from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T34
revoke all privileges on table platform.workspace_member_roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T34
revoke select ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at","assigned_by_context_grant_id","authority_policy_version","authority_depth"), insert ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at","assigned_by_context_grant_id","authority_policy_version","authority_depth"), update ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at","assigned_by_context_grant_id","authority_policy_version","authority_depth"), references ("id","tenant_id","customer_workspace_id","membership_id","workspace_role_id","scope_type","property_id","building_id","unit_id","valid_from","valid_to","assigned_by_user_id","assigned_by_membership_id","lock_version","reason","created_at","assigned_by_context_grant_id","authority_policy_version","authority_depth") on table platform.workspace_member_roles from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T34
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_member_roles'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_member_roles from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T34
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_member_roles'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_member_roles from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T64
revoke all privileges on table platform.workspace_delegations from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T64
revoke select ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), insert ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), update ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at"), references ("id","tenant_id","customer_workspace_id","delegation_code","grantor_membership_id","grantee_membership_id","grantor_user_id","grantee_user_id","scope_type","property_id","building_id","unit_id","lifecycle_status","delegation_depth","purpose","valid_from","valid_until","lock_version","approval_policy_code","required_approval_count","payload_hash","submitted_at","accepted_at","activated_at","rejected_at","rejected_by_user_id","rejection_reason","revoked_at","revoked_by_user_id","revocation_reason","created_by","created_at","updated_at") on table platform.workspace_delegations from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T64
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_delegations'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_delegations from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T64
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_delegations'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_delegations from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T35
revoke all privileges on table platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T35
revoke select ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), insert ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), update ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at"), references ("assignment_id","permission_id","module_definition_id","source_kind","source_identity_role_id","source_assignment_id","authority_depth","created_at") on table platform.workspace_member_role_authority_sources from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T35
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_member_role_authority_sources'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_member_role_authority_sources from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T35
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_member_role_authority_sources'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_member_role_authority_sources from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T36
revoke all privileges on table platform.workspace_role_handover_lineage from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T36
revoke select ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), insert ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), update ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at"), references ("successor_assignment_id","manager_membership_id","manager_context_id","parent_assignment_id","created_at") on table platform.workspace_role_handover_lineage from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T36
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_role_handover_lineage'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_role_handover_lineage from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T36
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_role_handover_lineage'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_role_handover_lineage from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.T65
revoke all privileges on table platform.workspace_delegation_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.COLUMNS.FINAL.T65
revoke select ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), insert ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), update ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at"), references ("id","delegation_id","module_definition_id","permission_id","module_permission_binding_id","created_at") on table platform.workspace_delegation_permissions from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM_COLUMNS.FINAL.T65
do $columns$ declare a record; begin
   for a in select c.attname,x.grantee,x.privilege_type from pg_attribute c,lateral aclexplode(c.attacl) x
    where c.attrelid='platform.workspace_delegation_permissions'::regclass and x.grantee<>(select relowner from pg_class where oid=c.attrelid) loop
    execute format('revoke %s (%I) on table platform.workspace_delegation_permissions from %s restrict',a.privilege_type,a.attname,
     case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end);
   end loop;
   end; $columns$;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.T65
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='platform.workspace_delegation_permissions'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('r',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on table platform.workspace_delegation_permissions from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.SQ1
revoke all privileges on sequence audit.events_id_seq from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.SQ1
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='audit.events_id_seq'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('S',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on sequence audit.events_id_seq from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.SQ2
revoke all privileges on sequence finance.journals_journal_no_seq from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.SQ2
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select relacl acl,relowner owner from pg_class where oid='finance.journals_journal_no_seq'::regclass) o,
  lateral aclexplode(coalesce(o.acl,acldefault('S',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on sequence finance.journals_journal_no_seq from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.N01
revoke all privileges on function app_private.require_building_session_current_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.N01
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.require_building_session_current_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.require_building_session_current_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F18
revoke all privileges on function app_private.set_updated_at() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F18
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.set_updated_at()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.set_updated_at() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F20
revoke all privileges on function finance.protect_accounting_period() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F20
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.protect_accounting_period()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.protect_accounting_period() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F21
revoke all privileges on function finance.assert_accounting_period_no_overlap() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F21
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.assert_accounting_period_no_overlap()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.assert_accounting_period_no_overlap() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F22
revoke all privileges on function finance.assert_accounting_period_property_tenant() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F22
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='finance.assert_accounting_period_property_tenant()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function finance.assert_accounting_period_property_tenant() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F23
revoke all privileges on function app_private.guard_taxonomy_version_effective_period_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F23
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_taxonomy_version_effective_period_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_taxonomy_version_effective_period_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F24
revoke all privileges on function app_private.guard_taxonomy_record_immutability_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F24
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_taxonomy_record_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_taxonomy_record_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F25
revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_history_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F25
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_taxonomy_assignment_history_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_history_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F26
revoke all privileges on function app_private.guard_workspace_property_binding_history_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F26
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_property_binding_history_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_property_binding_history_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F27
revoke all privileges on function app_private.guard_workspace_property_binding_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F27
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_property_binding_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_property_binding_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F28
revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F28
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_taxonomy_assignment_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_taxonomy_assignment_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F29
revoke all privileges on function app_private.bootstrap_role_taxonomy_permissions_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F29
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_taxonomy_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_taxonomy_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F30
revoke all privileges on function app_private.bootstrap_role_module_permissions_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F30
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_module_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_module_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F31
revoke all privileges on function app_private.guard_module_definition_immutability_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F31
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_definition_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_definition_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F32
revoke all privileges on function app_private.guard_module_definition_effective_period_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F32
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_definition_effective_period_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_definition_effective_period_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F33
revoke all privileges on function app_private.guard_workspace_module_code_sync_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F33
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_module_code_sync_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_module_code_sync_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F34
revoke all privileges on function app_private.guard_workspace_module_immutability_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F34
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_module_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_module_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F35
revoke all privileges on function app_private.bootstrap_role_workspace_role_permissions_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F35
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_workspace_role_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_workspace_role_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F36
revoke all privileges on function app_private.guard_module_permission_binding_invariants_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F36
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_module_permission_binding_invariants_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_module_permission_binding_invariants_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F37
revoke all privileges on function app_private.guard_workspace_role_immutability_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F37
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_immutability_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_immutability_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F38
revoke all privileges on function app_private.guard_workspace_role_module_draft_only_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F38
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_module_draft_only_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_module_draft_only_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F39
revoke all privileges on function app_private.guard_workspace_role_permission_bindings_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F39
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_permission_bindings_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_permission_bindings_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F40
revoke all privileges on function app_private.guard_workspace_member_role_invariants_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F40
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_member_role_invariants_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_member_role_invariants_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F41
revoke all privileges on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F41
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bootstrap_role_workspace_delegation_permissions_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F42
revoke all privileges on function platform.cap_customer_membership_to_access_basis() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F42
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.cap_customer_membership_to_access_basis()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.cap_customer_membership_to_access_basis() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F43
revoke all privileges on function platform.cap_customer_context_to_membership() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F43
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.cap_customer_context_to_membership()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.cap_customer_context_to_membership() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F44
revoke all privileges on function platform.require_workspace_access_basis_for_provisioning() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F44
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.require_workspace_access_basis_for_provisioning()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.require_workspace_access_basis_for_provisioning() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F45
revoke all privileges on function app_private.guard_undefined_primary_role_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F45
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_undefined_primary_role_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_undefined_primary_role_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F48
revoke all privileges on function app_private.guard_workspace_role_authority_source_immutable_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F48
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_role_authority_source_immutable_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_role_authority_source_immutable_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F50
revoke all privileges on function app_private.guard_authority_revision_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F50
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_authority_revision_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_authority_revision_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F51
revoke all privileges on function app_private.bump_canonical_authority_revision_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F51
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.bump_canonical_authority_revision_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.bump_canonical_authority_revision_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F52
revoke all privileges on function app_private.guard_jurisdiction_bound_property_address_v1() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F52
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_jurisdiction_bound_property_address_v1()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_jurisdiction_bound_property_address_v1() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F53
revoke all privileges on function app_private.protect_setup_creation_v2() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F53
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.protect_setup_creation_v2()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.protect_setup_creation_v2() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F60
revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F60
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F72
revoke all privileges on function app_private.validate_setup_units_v2(jsonb) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F72
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.validate_setup_units_v2(jsonb)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.validate_setup_units_v2(jsonb) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F73
revoke all privileges on function platform.assert_workspace_activation_ready(uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F73
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.assert_workspace_activation_ready(uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.assert_workspace_activation_ready(uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F74
revoke all privileges on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F74
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F76
revoke all privileges on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F76
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F84
revoke all privileges on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F84
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F87
revoke all privileges on function app_private.customer_mfa_required() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F87
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.customer_mfa_required()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.customer_mfa_required() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F19
revoke all privileges on function platform.enforce_workspace_activation_gate() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F19
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='platform.enforce_workspace_activation_gate()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function platform.enforce_workspace_activation_gate() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F75
revoke all privileges on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F75
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F77
revoke all privileges on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F77
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[]) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F49
revoke all privileges on function app_private.guard_workspace_member_role_authority_v2() from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F49
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.guard_workspace_member_role_authority_v2()'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.guard_workspace_member_role_authority_v2() from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F62
revoke all privileges on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F62
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F83
revoke all privileges on function app_private.resolve_workspace_native_context_v2(uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F83
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.resolve_workspace_native_context_v2(uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.resolve_workspace_native_context_v2(uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F85
revoke all privileges on function app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F85
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F80
revoke all privileges on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F80
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT B.OC1.FINAL.F64
revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;


-- SELECTED EFFECT B.OC1.CUSTOM.FINAL.F64
do $close$ declare a record; begin
 for a in select distinct x.grantee from (select proacl acl,proowner owner from pg_proc where oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure) o,
  lateral aclexplode(coalesce(o.acl,acldefault('f',o.owner))) x where x.grantee<>o.owner loop
  execute 'revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from '||case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end||' restrict';
 end loop;
 end; $close$;


-- SELECTED EFFECT G2.ROLE
-- Exact F64/F80 nested owner edges; PM137 E_rpc retained, never product authority.
do $role_entry$ declare r oid; p oid; e record; begin
 select oid into strict r from pg_roles where rolname='cladora_rpc_owner' and not(rolcanlogin or rolsuper or rolbypassrls or rolinherit or rolcreaterole or rolcreatedb or rolreplication);
 select oid into strict p from pg_roles where rolname='postgres';
 if (select count(*) from pg_auth_members where roleid=r or member=r)<>1 then raise exception 'setup_g2_role_entry_graph' using errcode='55000'; end if;
 select * into strict e from pg_auth_members where roleid=r and member=p and admin_option and not inherit_option and not set_option;
 perform set_config('cladora.g2.role_entry',to_jsonb(e)::text,true);
 if e.grantor=p then
  grant cladora_rpc_owner to postgres with admin true,inherit false,set true granted by postgres;
 else
  grant cladora_rpc_owner to postgres with admin false,inherit false,set true granted by postgres;
 end if;
end; $role_entry$;
grant usage,create on schema app_private to cladora_rpc_owner;
grant execute on function app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid) to cladora_rpc_owner;
alter function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) owner to cladora_rpc_owner;
set local role cladora_rpc_owner;
revoke all on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from public,anon,authenticated,service_role;
do $owner_close$ declare g record; begin
 for g in select distinct a.grantee from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure and a.grantee<>p.proowner loop
  execute 'revoke all privileges on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) from '||case when g.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(g.grantee)) end||' restrict';
 end loop; end; $owner_close$;
grant execute on function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) to postgres;
reset role;
revoke create on schema app_private from cladora_rpc_owner restrict;
do $role_exit$ declare e jsonb:=current_setting('cladora.g2.role_entry')::jsonb; r oid:='cladora_rpc_owner'::regrole::oid; p oid:='postgres'::regrole::oid; begin
 if (e->>'grantor')::oid=p then
  grant cladora_rpc_owner to postgres with admin true,inherit false,set false granted by postgres;
 else revoke cladora_rpc_owner from postgres granted by postgres restrict; end if;
 if (select count(*) from pg_auth_members where roleid=r or member=r)<>1
  or not exists(select 1 from pg_auth_members m where to_jsonb(m)=e) then raise exception 'setup_g2_role_exit_graph' using errcode='55000'; end if;
 if has_schema_privilege(r,'app_private','CREATE') then raise exception 'setup_g2_temporary_schema_right_remains' using errcode='55000'; end if;
end; $role_exit$;


-- CANONICAL RANGE supabase/migrations/20260825000000_extensions_foundation.sql:33-65
create or replace function app_private.jwt_uuid(claim_name text)
returns uuid
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select nullif(auth.jwt() ->> claim_name, '')::uuid;
$$;

create or replace function app_private.active_tenant_id()
returns uuid
language sql
stable
security invoker
set search_path = pg_catalog
as $$ select app_private.jwt_uuid('active_tenant_id'); $$;

create or replace function app_private.active_context_id()
returns uuid
language sql
stable
security invoker
set search_path = pg_catalog
as $$ select app_private.jwt_uuid('active_context_id'); $$;

create or replace function app_private.is_service_role()
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$ select coalesce(auth.jwt() ->> 'role', '') = 'service_role'; $$;


-- CANONICAL RANGE supabase/migrations/20260825000200_identity_roles_memberships_contexts.sql:92-116
create or replace function app_private.is_active_member(target_tenant uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, identity
as $$
  select exists (
    select 1 from identity.memberships m
    where m.tenant_id=target_tenant and m.user_id=auth.uid() and m.status='active'
      and m.starts_at <= statement_timestamp()
      and (m.ends_at is null or m.ends_at > statement_timestamp())
  );
$$;
revoke all on function app_private.is_active_member(uuid) from public;
grant execute on function app_private.is_active_member(uuid) to authenticated, service_role;

create or replace function app_private.active_membership_id()
returns uuid language sql stable security definer
set search_path = pg_catalog, identity
as $$
  select m.id from identity.memberships m
  where m.tenant_id=app_private.active_tenant_id() and m.user_id=auth.uid() and m.status='active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
  order by m.starts_at desc limit 1;
$$;
revoke all on function app_private.active_membership_id() from public;
grant execute on function app_private.active_membership_id() to authenticated, service_role;


-- CANONICAL RANGE supabase/migrations/20260825000300_portfolio_properties_buildings_units.sql:48-58
create or replace function app_private.can_access_property(target_property uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,identity,portfolio
as $$ select exists(select 1 from identity.context_grants g where g.id=app_private.active_context_id() and g.membership_id=app_private.active_membership_id() and g.tenant_id=app_private.active_tenant_id() and (g.scope_type='tenant' or g.property_id=target_property)); $$;
create or replace function app_private.can_access_building(target_building uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,identity,portfolio
as $$ select exists(select 1 from portfolio.buildings b join identity.context_grants g on g.id=app_private.active_context_id() where b.id=target_building and b.tenant_id=app_private.active_tenant_id() and g.membership_id=app_private.active_membership_id() and (g.scope_type='tenant' or g.property_id=b.property_id or g.building_id=b.id)); $$;
create or replace function app_private.can_access_unit(target_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,identity,portfolio
as $$ select exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id join identity.context_grants g on g.id=app_private.active_context_id() where u.id=target_unit and u.tenant_id=app_private.active_tenant_id() and g.membership_id=app_private.active_membership_id() and (g.scope_type='tenant' or g.property_id=b.property_id or g.building_id=b.id or g.unit_id=u.id)); $$;
revoke all on function app_private.can_access_property(uuid),app_private.can_access_building(uuid),app_private.can_access_unit(uuid) from public;
grant execute on function app_private.can_access_property(uuid),app_private.can_access_building(uuid),app_private.can_access_unit(uuid) to authenticated,service_role;


-- CANONICAL RANGE supabase/migrations/20260825000100_platform_tenants_settings_outbox.sql:26-37
create table platform.idempotency_keys (
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  actor_id uuid,
  key text not null,
  request_hash text not null,
  response_ref jsonb,
  status_code integer,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  primary key (tenant_id, key),
  check (expires_at > created_at)
);


alter table platform.idempotency_keys enable row level security;
revoke all on platform.idempotency_keys from public,anon,authenticated,service_role;


create schema utilities authorization postgres;
create schema security_access authorization postgres;


-- CANONICAL RANGE supabase/migrations/20260825000900_utilities_contracts_invoices_ocr.sql:6-6
create type utilities.service_type as enum ('water','electricity','gas','heat','sewer','waste','internet','telephone','other');


-- CANONICAL RANGE supabase/migrations/20260825000900_utilities_contracts_invoices_ocr.sql:60-64
create or replace function app_private.can_access_utility_scope(target_property uuid,target_building uuid,target_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,portfolio
as $$ select case when target_unit is not null then app_private.can_access_unit(target_unit) when target_building is not null then app_private.can_access_building(target_building) else app_private.can_access_property(target_property) end; $$;
revoke all on function app_private.can_access_utility_scope(uuid,uuid,uuid) from public;
grant execute on function app_private.can_access_utility_scope(uuid,uuid,uuid) to authenticated,service_role;


-- CANONICAL RANGE supabase/migrations/20260825001000_utilities_meters_readings_consumption.sql:2-57

create type utilities.meter_scope as enum ('property','building','unit','common_area','submeter');
create type utilities.reading_method as enum ('manual','photo_ocr','bulk_import','iot','provider');
create type utilities.reading_status as enum ('captured','validated','rejected','superseded');

create table utilities.meters (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict, parent_meter_id uuid references utilities.meters(id) on delete restrict,
  service_type utilities.service_type not null, scope utilities.meter_scope not null, serial_number_encrypted text, serial_fingerprint text not null,
  unit_code text not null, multiplier numeric(20,8) not null default 1 check(multiplier>0), rollover_value numeric(20,6),
  installed_on date, removed_on date, status platform.record_status not null default 'active', metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  check(removed_on is null or installed_on is null or removed_on>=installed_on),
  check((scope='property' and building_id is null and unit_id is null) or (scope in ('building','common_area') and building_id is not null and unit_id is null) or (scope in ('unit','submeter') and unit_id is not null)),
  unique(tenant_id,serial_fingerprint)
);
create table utilities.meter_readings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meter_id uuid not null references utilities.meters(id) on delete restrict, reading_at timestamptz not null, reading_value numeric(20,6) not null check(reading_value>=0),
  method utilities.reading_method not null, status utilities.reading_status not null default 'captured', confidence numeric(6,5) check(confidence between 0 and 1),
  source_object_path text, source_sha256 text, entered_by uuid references auth.users(id) on delete restrict, validated_by uuid references auth.users(id) on delete restrict,
  validated_at timestamptz, supersedes_reading_id uuid references utilities.meter_readings(id) on delete restrict,
  note text, created_at timestamptz not null default statement_timestamp(),
  check((status='validated' and validated_at is not null) or status<>'validated'), unique(meter_id,reading_at)
);
create unique index meter_reading_source_unique on utilities.meter_readings(tenant_id,source_sha256) where source_sha256 is not null;
create table utilities.consumption_periods (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meter_id uuid not null references utilities.meters(id) on delete restrict, start_reading_id uuid not null references utilities.meter_readings(id) on delete restrict,
  end_reading_id uuid not null references utilities.meter_readings(id) on delete restrict, period_start timestamptz not null, period_end timestamptz not null,
  raw_consumption numeric(20,6) not null check(raw_consumption>=0), adjusted_consumption numeric(20,6) not null check(adjusted_consumption>=0),
  calculation_snapshot jsonb not null, created_at timestamptz not null default statement_timestamp(),
  check(start_reading_id<>end_reading_id), check(period_end>period_start), unique(meter_id,start_reading_id,end_reading_id)
);

create or replace function utilities.protect_validated_reading()
returns trigger language plpgsql security definer set search_path=pg_catalog,utilities
as $$ begin
  if tg_op='DELETE' and old.status in ('validated','superseded') then raise exception 'validated_meter_reading_is_immutable'; end if;
  if tg_op='UPDATE' and old.status='superseded' and new is distinct from old then raise exception 'validated_meter_reading_is_immutable'; end if;
  if tg_op='UPDATE' and old.status='validated' and new is distinct from old and not (new.status='superseded' and (to_jsonb(new)-'status')=(to_jsonb(old)-'status')) then raise exception 'validated_meter_reading_is_immutable'; end if;
  if tg_op='UPDATE' and old.status='captured' and new.status='validated' then new.validated_at=coalesce(new.validated_at,statement_timestamp()); end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger meter_readings_protect before update or delete on utilities.meter_readings for each row execute function utilities.protect_validated_reading();
create trigger meters_updated_at before update on utilities.meters for each row execute function app_private.set_updated_at();

do $$ declare t text; begin foreach t in array array['meters','meter_readings','consumption_periods'] loop execute format('alter table utilities.%I enable row level security',t); end loop; end $$;
create policy meters_context_read on utilities.meters for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_utility_scope(property_id,building_id,unit_id));
create policy readings_context_read on utilities.meter_readings for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from utilities.meters m where m.id=meter_id and app_private.can_access_utility_scope(m.property_id,m.building_id,m.unit_id)));
create policy consumption_context_read on utilities.consumption_periods for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from utilities.meters m where m.id=meter_id and app_private.can_access_utility_scope(m.property_id,m.building_id,m.unit_id)));
grant select on utilities.meters,utilities.meter_readings,utilities.consumption_periods to authenticated;
grant all on all tables in schema utilities to service_role;
revoke all on function utilities.protect_validated_reading() from public;



-- CANONICAL RANGE supabase/migrations/20260829005300_customer_security_access_credentials_visitors.sql:14-14
create type security_access.access_point_type as enum('entrance','door','gate');


-- CANONICAL RANGE supabase/migrations/20260829005300_customer_security_access_credentials_visitors.sql:21-27
create table security_access.access_points(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references platform.tenants(id) on delete restrict,
 property_id uuid not null references portfolio.properties(id) on delete restrict,building_id uuid not null references portfolio.buildings(id) on delete restrict,
 entrance_id uuid references portfolio.entrances(id) on delete restrict,unit_id uuid references portfolio.units(id) on delete restrict,
 point_type security_access.access_point_type not null,code text not null,name text not null,status platform.record_status not null default'active',
 created_at timestamptz not null default statement_timestamp(),finalized_at timestamptz,unique(tenant_id,building_id,code)
);


alter table utilities.meters enable row level security;
alter table security_access.access_points enable row level security;


-- CANONICAL RANGE supabase/migrations/20260825001300_assets_registry_lifecycle.sql:2-63

create schema if not exists assets;
grant usage on schema assets to authenticated;

create type assets.asset_scope as enum ('property','building','unit','common_area');
create type assets.asset_condition as enum ('unknown','good','fair','poor','critical','retired');

create table assets.asset_categories (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  parent_id uuid references assets.asset_categories(id) on delete restrict, code text not null, name text not null,
  default_attributes jsonb not null default '{}'::jsonb, status platform.record_status not null default 'active', created_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,code)
);
create table assets.assets (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  category_id uuid not null references assets.asset_categories(id) on delete restrict, property_id uuid not null references portfolio.properties(id) on delete restrict,
  building_id uuid references portfolio.buildings(id) on delete restrict, unit_id uuid references portfolio.units(id) on delete restrict,
  scope assets.asset_scope not null, asset_code text not null, name text not null, manufacturer text, model text,
  serial_number_encrypted text, serial_fingerprint text, installed_on date, expected_life_months integer check(expected_life_months is null or expected_life_months>0),
  condition assets.asset_condition not null default 'unknown', criticality smallint not null default 3 check(criticality between 1 and 5),
  replacement_cost numeric(20,4) check(replacement_cost is null or replacement_cost>=0), currency char(3) not null default 'RON',
  attributes jsonb not null default '{}'::jsonb, status platform.record_status not null default 'active', retired_at timestamptz,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  check((scope='property' and building_id is null and unit_id is null) or (scope in ('building','common_area') and building_id is not null and unit_id is null) or (scope='unit' and unit_id is not null)),
  unique(tenant_id,asset_code)
);
create unique index assets_serial_unique on assets.assets(tenant_id,serial_fingerprint) where serial_fingerprint is not null;
create table assets.asset_components (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  parent_asset_id uuid not null references assets.assets(id) on delete restrict, component_asset_id uuid not null references assets.assets(id) on delete restrict,
  quantity numeric(12,4) not null default 1 check(quantity>0), installed_on date, removed_on date, created_at timestamptz not null default statement_timestamp(),
  check(parent_asset_id<>component_asset_id), check(removed_on is null or installed_on is null or removed_on>=installed_on), unique(parent_asset_id,component_asset_id,installed_on)
);
create table assets.asset_warranties (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  asset_id uuid not null references assets.assets(id) on delete restrict, provider_party_id uuid references portfolio.parties(id) on delete restrict,
  warranty_ref_encrypted text, starts_on date not null, ends_on date not null, coverage_json jsonb not null default '{}'::jsonb,
  evidence_object_path text, created_at timestamptz not null default statement_timestamp(), check(ends_on>=starts_on)
);
create table assets.asset_documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  asset_id uuid not null references assets.assets(id) on delete restrict, document_type text not null, title text not null,
  object_path text not null, sha256 text not null, version integer not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(),
  unique(asset_id,document_type,version), unique(tenant_id,sha256)
);

create or replace function app_private.can_access_asset_scope(target_property uuid,target_building uuid,target_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$ select case when target_unit is not null then app_private.can_access_unit(target_unit) when target_building is not null then app_private.can_access_building(target_building) else app_private.can_access_property(target_property) end; $$;
revoke all on function app_private.can_access_asset_scope(uuid,uuid,uuid) from public;
grant execute on function app_private.can_access_asset_scope(uuid,uuid,uuid) to authenticated,service_role;
create trigger assets_updated_at before update on assets.assets for each row execute function app_private.set_updated_at();

do $$ declare t text; begin foreach t in array array['asset_categories','assets','asset_components','asset_warranties','asset_documents'] loop execute format('alter table assets.%I enable row level security',t); end loop; end $$;
create policy asset_categories_member_read on assets.asset_categories for select to authenticated using(tenant_id=app_private.active_tenant_id());
create policy assets_context_read on assets.assets for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_asset_scope(property_id,building_id,unit_id));
create policy asset_components_context_read on assets.asset_components for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from assets.assets a where a.id=parent_asset_id and app_private.can_access_asset_scope(a.property_id,a.building_id,a.unit_id)));
create policy asset_warranties_context_read on assets.asset_warranties for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from assets.assets a where a.id=asset_id and app_private.can_access_asset_scope(a.property_id,a.building_id,a.unit_id)));
create policy asset_documents_context_read on assets.asset_documents for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from assets.assets a where a.id=asset_id and app_private.can_access_asset_scope(a.property_id,a.building_id,a.unit_id)));
grant select on all tables in schema assets to authenticated;
grant all on all tables in schema assets to service_role;



-- CANONICAL RANGE supabase/migrations/20260825001400_maintenance_plans_work_orders.sql:2-78

create schema if not exists maintenance;
grant usage on schema maintenance to authenticated;
create type maintenance.priority as enum ('low','normal','high','urgent','emergency');
create type maintenance.work_order_status as enum ('draft','scheduled','assigned','in_progress','blocked','completed','verified','cancelled');
create type maintenance.plan_trigger as enum ('calendar','meter','condition','manual');

create table maintenance.maintenance_plans (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  asset_id uuid not null references assets.assets(id) on delete restrict, name text not null, trigger_type maintenance.plan_trigger not null,
  recurrence_rule jsonb not null, checklist_template jsonb not null default '[]'::jsonb, estimated_duration_minutes integer check(estimated_duration_minutes is null or estimated_duration_minutes>0),
  default_priority maintenance.priority not null default 'normal', next_due_at timestamptz, last_generated_at timestamptz,
  status platform.record_status not null default 'active', created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);
create table maintenance.work_orders (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict, asset_id uuid references assets.assets(id) on delete restrict,
  plan_id uuid references maintenance.maintenance_plans(id) on delete restrict, work_order_no bigint generated always as identity,
  title text not null, description text, priority maintenance.priority not null default 'normal', status maintenance.work_order_status not null default 'draft',
  scheduled_start timestamptz, scheduled_end timestamptz, started_at timestamptz, completed_at timestamptz, verified_at timestamptz,
  assigned_membership_id uuid references identity.memberships(id) on delete restrict, created_by uuid references auth.users(id) on delete restrict,
  completion_summary text, created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  check(scheduled_end is null or scheduled_start is not null), check(scheduled_end is null or scheduled_end>scheduled_start),
  check(completed_at is null or started_at is null or completed_at>=started_at), unique(tenant_id,work_order_no)
);
create table maintenance.work_order_checklist_items (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid not null references maintenance.work_orders(id) on delete cascade, sequence_no integer not null check(sequence_no>0),
  label text not null, required boolean not null default true, completed boolean not null default false,
  result_json jsonb, completed_by uuid references auth.users(id) on delete restrict, completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(), unique(work_order_id,sequence_no),
  check((completed and completed_at is not null) or not completed)
);
create table maintenance.work_order_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid not null references maintenance.work_orders(id) on delete restrict, event_type text not null,
  from_status maintenance.work_order_status, to_status maintenance.work_order_status, actor_id uuid references auth.users(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default statement_timestamp()
);

create or replace function maintenance.enforce_work_order_transition()
returns trigger language plpgsql security definer set search_path=pg_catalog,maintenance
as $$ declare incomplete integer; allowed boolean; begin
  if new.status=old.status then return new; end if;
  allowed=case old.status
    when 'draft' then new.status in ('scheduled','assigned','cancelled')
    when 'scheduled' then new.status in ('assigned','in_progress','cancelled')
    when 'assigned' then new.status in ('scheduled','in_progress','cancelled')
    when 'in_progress' then new.status in ('blocked','completed','cancelled')
    when 'blocked' then new.status in ('in_progress','cancelled')
    when 'completed' then new.status in ('verified','in_progress')
    else false end;
  if not allowed then raise exception 'invalid_work_order_transition: % -> %',old.status,new.status; end if;
  if new.status='in_progress' then new.started_at=coalesce(new.started_at,statement_timestamp()); end if;
  if new.status='completed' then
    select count(*) into incomplete from maintenance.work_order_checklist_items where work_order_id=old.id and required and not completed;
    if incomplete>0 then raise exception 'required_checklist_items_incomplete'; end if;
    new.completed_at=coalesce(new.completed_at,statement_timestamp());
  end if;
  if new.status='verified' then new.verified_at=coalesce(new.verified_at,statement_timestamp()); end if;
  return new;
end; $$;
create trigger work_orders_transition before update on maintenance.work_orders for each row execute function maintenance.enforce_work_order_transition();
create trigger maintenance_plans_updated_at before update on maintenance.maintenance_plans for each row execute function app_private.set_updated_at();
create trigger work_orders_updated_at before update on maintenance.work_orders for each row execute function app_private.set_updated_at();

do $$ declare t text; begin foreach t in array array['maintenance_plans','work_orders','work_order_checklist_items','work_order_events'] loop execute format('alter table maintenance.%I enable row level security',t); end loop; end $$;
create policy plans_context_read on maintenance.maintenance_plans for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from assets.assets a where a.id=asset_id and app_private.can_access_asset_scope(a.property_id,a.building_id,a.unit_id)));
create policy work_orders_context_read on maintenance.work_orders for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_asset_scope(property_id,building_id,unit_id));
create policy checklist_context_read on maintenance.work_order_checklist_items for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from maintenance.work_orders w where w.id=work_order_id and app_private.can_access_asset_scope(w.property_id,w.building_id,w.unit_id)));
create policy work_order_events_context_read on maintenance.work_order_events for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from maintenance.work_orders w where w.id=work_order_id and app_private.can_access_asset_scope(w.property_id,w.building_id,w.unit_id)));
grant select on all tables in schema maintenance to authenticated;
grant all on all tables in schema maintenance to service_role;
grant usage,select on all sequences in schema maintenance to service_role;
revoke all on function maintenance.enforce_work_order_transition() from public;



-- CANONICAL RANGE supabase/migrations/20260825001500_maintenance_vendors_procurement_sla.sql:2-77

create type maintenance.vendor_status as enum ('candidate','approved','suspended','blocked');
create type maintenance.procurement_status as enum ('draft','requested','approved','ordered','received','cancelled');

create table maintenance.vendors (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  party_id uuid not null references portfolio.parties(id) on delete restrict, status maintenance.vendor_status not null default 'candidate',
  service_categories text[] not null default '{}', rating numeric(3,2) check(rating between 0 and 5),
  insurance_valid_until date, compliance_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,party_id)
);
create table maintenance.vendor_contracts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  vendor_id uuid not null references maintenance.vendors(id) on delete restrict, property_id uuid not null references portfolio.properties(id) on delete restrict,
  contract_ref_encrypted text, starts_on date not null, ends_on date, currency char(3) not null default 'RON',
  rate_card jsonb not null default '{}'::jsonb, sla_json jsonb not null default '{}'::jsonb, status platform.record_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(), check(ends_on is null or ends_on>starts_on)
);
create table maintenance.work_order_assignments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid not null references maintenance.work_orders(id) on delete restrict, vendor_id uuid not null references maintenance.vendors(id) on delete restrict,
  contract_id uuid references maintenance.vendor_contracts(id) on delete restrict, assigned_at timestamptz not null default statement_timestamp(),
  accepted_at timestamptz, declined_at timestamptz, response_note text, unique(work_order_id,vendor_id,assigned_at)
);
create table maintenance.vendor_quotes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid not null references maintenance.work_orders(id) on delete restrict, vendor_id uuid not null references maintenance.vendors(id) on delete restrict,
  quote_ref text, subtotal numeric(20,4) not null check(subtotal>=0), tax_total numeric(20,4) not null default 0 check(tax_total>=0),
  currency char(3) not null default 'RON', valid_until date, scope_snapshot jsonb not null, status platform.record_status not null default 'draft',
  submitted_at timestamptz, created_at timestamptz not null default statement_timestamp(), unique(work_order_id,vendor_id,quote_ref)
);
create table maintenance.purchase_orders (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid not null references maintenance.work_orders(id) on delete restrict, vendor_id uuid not null references maintenance.vendors(id) on delete restrict,
  quote_id uuid references maintenance.vendor_quotes(id) on delete restrict, po_no bigint generated always as identity,
  subtotal numeric(20,4) not null check(subtotal>=0), tax_total numeric(20,4) not null default 0 check(tax_total>=0), currency char(3) not null default 'RON',
  status maintenance.procurement_status not null default 'draft', approved_by uuid references auth.users(id) on delete restrict, approved_at timestamptz,
  ordered_at timestamptz, received_at timestamptz, ledger_journal_id uuid references finance.journals(id) on delete restrict,
  snapshot_json jsonb not null, created_at timestamptz not null default statement_timestamp(), unique(tenant_id,po_no),
  check((status in ('approved','ordered','received') and approved_at is not null) or status not in ('approved','ordered','received'))
);
create table maintenance.sla_measurements (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid not null references maintenance.work_orders(id) on delete restrict, contract_id uuid references maintenance.vendor_contracts(id) on delete restrict,
  metric_code text not null, target_value numeric(20,6), actual_value numeric(20,6), unit_code text not null,
  met boolean, measured_at timestamptz not null default statement_timestamp(), details_json jsonb not null default '{}'::jsonb,
  unique(work_order_id,metric_code)
);

create or replace function maintenance.protect_purchase_order()
returns trigger language plpgsql security definer set search_path=pg_catalog,maintenance
as $$ begin
  if tg_op='DELETE' and old.status in ('approved','ordered','received') then raise exception 'approved_purchase_order_is_immutable'; end if;
  if tg_op='UPDATE' and old.status='received' and new is distinct from old then raise exception 'approved_purchase_order_is_immutable'; end if;
  if tg_op='UPDATE' and old.status='approved' and (new.status not in ('approved','ordered') or (new.tenant_id,new.work_order_id,new.vendor_id,new.quote_id,new.subtotal,new.tax_total,new.currency,new.snapshot_json) is distinct from (old.tenant_id,old.work_order_id,old.vendor_id,old.quote_id,old.subtotal,old.tax_total,old.currency,old.snapshot_json)) then raise exception 'approved_purchase_order_is_immutable'; end if;
  if tg_op='UPDATE' and old.status='ordered' and (new.status not in ('ordered','received') or (new.tenant_id,new.work_order_id,new.vendor_id,new.quote_id,new.subtotal,new.tax_total,new.currency,new.snapshot_json) is distinct from (old.tenant_id,old.work_order_id,old.vendor_id,old.quote_id,old.subtotal,old.tax_total,old.currency,old.snapshot_json)) then raise exception 'approved_purchase_order_is_immutable'; end if;
  if tg_op='UPDATE' and old.status not in ('approved','ordered','received') and new.status in ('approved','ordered','received') then new.approved_at=coalesce(new.approved_at,statement_timestamp()); end if;
  if tg_op='UPDATE' and new.status='ordered' and old.status<>'ordered' then new.ordered_at=coalesce(new.ordered_at,statement_timestamp()); end if;
  if tg_op='UPDATE' and new.status='received' and old.status<>'received' then new.received_at=coalesce(new.received_at,statement_timestamp()); end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger purchase_orders_protect before update or delete on maintenance.purchase_orders for each row execute function maintenance.protect_purchase_order();
create trigger vendors_updated_at before update on maintenance.vendors for each row execute function app_private.set_updated_at();

do $$ declare t text; begin foreach t in array array['vendors','vendor_contracts','work_order_assignments','vendor_quotes','purchase_orders','sla_measurements'] loop execute format('alter table maintenance.%I enable row level security',t); end loop; end $$;
create policy vendors_member_read on maintenance.vendors for select to authenticated using(tenant_id=app_private.active_tenant_id());
create policy vendor_contracts_context_read on maintenance.vendor_contracts for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_property(property_id));
create policy assignments_context_read on maintenance.work_order_assignments for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from maintenance.work_orders w where w.id=work_order_id and app_private.can_access_asset_scope(w.property_id,w.building_id,w.unit_id)));
create policy quotes_context_read on maintenance.vendor_quotes for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from maintenance.work_orders w where w.id=work_order_id and app_private.can_access_asset_scope(w.property_id,w.building_id,w.unit_id)));
create policy purchase_orders_context_read on maintenance.purchase_orders for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from maintenance.work_orders w where w.id=work_order_id and app_private.can_access_asset_scope(w.property_id,w.building_id,w.unit_id)));
create policy sla_context_read on maintenance.sla_measurements for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from maintenance.work_orders w where w.id=work_order_id and app_private.can_access_asset_scope(w.property_id,w.building_id,w.unit_id)));
grant select on maintenance.vendors,maintenance.vendor_contracts,maintenance.work_order_assignments,maintenance.vendor_quotes,maintenance.purchase_orders,maintenance.sla_measurements to authenticated;
grant all on all tables in schema maintenance to service_role;
grant usage,select on all sequences in schema maintenance to service_role;
revoke all on function maintenance.protect_purchase_order() from public;



-- CANONICAL RANGE supabase/migrations/20260825001600_maintenance_tickets_costs_history.sql:2-56

create type maintenance.ticket_status as enum ('open','triaged','planned','in_progress','resolved','closed','reopened','cancelled');

create table maintenance.tickets (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict, asset_id uuid references assets.assets(id) on delete restrict,
  ticket_no bigint generated always as identity, title text not null, description text not null, category_code text,
  priority maintenance.priority not null default 'normal', status maintenance.ticket_status not null default 'open',
  reported_by uuid references auth.users(id) on delete restrict, reported_at timestamptz not null default statement_timestamp(),
  triaged_at timestamptz, resolved_at timestamptz, closed_at timestamptz, resolution_summary text,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(), unique(tenant_id,ticket_no)
);
create table maintenance.ticket_work_orders (
  ticket_id uuid not null references maintenance.tickets(id) on delete restrict, work_order_id uuid not null references maintenance.work_orders(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict, created_at timestamptz not null default statement_timestamp(), primary key(ticket_id,work_order_id)
);
create table maintenance.work_order_costs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid not null references maintenance.work_orders(id) on delete restrict, purchase_order_id uuid references maintenance.purchase_orders(id) on delete restrict,
  category_code text not null, description text not null, amount numeric(20,4) not null check(amount>=0), currency char(3) not null default 'RON',
  charge_category_id uuid references finance.charge_categories(id) on delete restrict, allocation_run_id uuid references finance.allocation_runs(id) on delete restrict,
  journal_id uuid references finance.journals(id) on delete restrict, incurred_on date not null, snapshot_json jsonb not null,
  created_at timestamptz not null default statement_timestamp()
);
create table assets.asset_history (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  asset_id uuid not null references assets.assets(id) on delete restrict, event_type text not null, work_order_id uuid references maintenance.work_orders(id) on delete restrict,
  ticket_id uuid references maintenance.tickets(id) on delete restrict, actor_id uuid references auth.users(id) on delete restrict,
  before_snapshot jsonb, after_snapshot jsonb, reason text, occurred_at timestamptz not null default statement_timestamp()
);
create table maintenance.attachments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  ticket_id uuid references maintenance.tickets(id) on delete restrict, work_order_id uuid references maintenance.work_orders(id) on delete restrict,
  object_path text not null, sha256 text not null, mime_type text not null, title text, uploaded_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(), check(ticket_id is not null or work_order_id is not null), unique(tenant_id,sha256)
);

create trigger tickets_updated_at before update on maintenance.tickets for each row execute function app_private.set_updated_at();
alter table maintenance.tickets enable row level security;
alter table maintenance.ticket_work_orders enable row level security;
alter table maintenance.work_order_costs enable row level security;
alter table maintenance.attachments enable row level security;
alter table assets.asset_history enable row level security;
create policy tickets_context_read on maintenance.tickets for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_asset_scope(property_id,building_id,unit_id));
create policy ticket_work_orders_context_read on maintenance.ticket_work_orders for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from maintenance.tickets t where t.id=ticket_id and app_private.can_access_asset_scope(t.property_id,t.building_id,t.unit_id)));
create policy work_order_costs_context_read on maintenance.work_order_costs for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from maintenance.work_orders w where w.id=work_order_id and app_private.can_access_asset_scope(w.property_id,w.building_id,w.unit_id)));
create policy attachments_context_read on maintenance.attachments for select to authenticated using(tenant_id=app_private.active_tenant_id() and ((ticket_id is not null and exists(select 1 from maintenance.tickets t where t.id=ticket_id and app_private.can_access_asset_scope(t.property_id,t.building_id,t.unit_id))) or (work_order_id is not null and exists(select 1 from maintenance.work_orders w where w.id=work_order_id and app_private.can_access_asset_scope(w.property_id,w.building_id,w.unit_id)))));
create policy asset_history_context_read on assets.asset_history for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from assets.assets a where a.id=asset_id and app_private.can_access_asset_scope(a.property_id,a.building_id,a.unit_id)));
grant select on maintenance.tickets,maintenance.ticket_work_orders,maintenance.work_order_costs,maintenance.attachments to authenticated;
grant select on assets.asset_history to authenticated;
grant all on all tables in schema maintenance to service_role;
grant all on all tables in schema assets to service_role;
grant usage,select on all sequences in schema maintenance to service_role;



-- CANONICAL RANGE supabase/migrations/20260825001900_documents_vault_legal_records.sql:2-69

create schema if not exists documents;
grant usage on schema documents to authenticated;
create type documents.classification as enum ('public','internal','confidential','restricted');

create table documents.folders (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  parent_id uuid references documents.folders(id) on delete restrict, property_id uuid references portfolio.properties(id) on delete restrict,
  name text not null, classification documents.classification not null default 'internal', created_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct(tenant_id,parent_id,property_id,name)
);
create table documents.documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  folder_id uuid references documents.folders(id) on delete restrict, property_id uuid references portfolio.properties(id) on delete restrict,
  title text not null, document_type text not null, classification documents.classification not null default 'internal',
  retention_policy_code text, legal_hold boolean not null default false, current_version integer not null default 1 check(current_version>0),
  status platform.record_status not null default 'active', created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);
create table documents.document_versions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  document_id uuid not null references documents.documents(id) on delete restrict, version integer not null check(version>0), object_path text not null,
  sha256 text not null, mime_type text not null, size_bytes bigint check(size_bytes is null or size_bytes>=0), metadata_json jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete restrict, created_at timestamptz not null default statement_timestamp(),
  unique(document_id,version), unique(tenant_id,sha256)
);
create table documents.document_links (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  document_id uuid not null references documents.documents(id) on delete cascade, entity_type text not null, entity_id uuid not null,
  relation_type text not null default 'attachment', created_at timestamptz not null default statement_timestamp(), unique(document_id,entity_type,entity_id,relation_type)
);
create table documents.retention_policies (
  tenant_id uuid not null references platform.tenants(id) on delete restrict, code text not null, name text not null,
  retain_months integer check(retain_months is null or retain_months>0), disposition_action text not null default 'review',
  policy_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default statement_timestamp(), primary key(tenant_id,code)
);
create table documents.access_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  document_id uuid not null references documents.documents(id) on delete restrict, version_id uuid references documents.document_versions(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict, action text not null, purpose text, ip_hash text,
  occurred_at timestamptz not null default statement_timestamp()
);
create table documents.legal_records (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, record_type text not null, reference_no text,
  title text not null, authority text, effective_on date, expires_on date, document_id uuid references documents.documents(id) on delete restrict,
  status platform.record_status not null default 'active', metadata_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default statement_timestamp(),
  check(expires_on is null or effective_on is null or expires_on>=effective_on)
);

create or replace function documents.protect_document_version()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$ begin raise exception 'document_versions_are_immutable'; end; $$;
create trigger document_versions_immutable before update or delete on documents.document_versions for each row execute function documents.protect_document_version();

create trigger vault_documents_updated_at before update on documents.documents for each row execute function app_private.set_updated_at();
do $$ declare t text; begin foreach t in array array['folders','documents','document_versions','document_links','retention_policies','access_events','legal_records'] loop execute format('alter table documents.%I enable row level security',t); end loop; end $$;
create policy folders_context_read on documents.folders for select to authenticated using(tenant_id=app_private.active_tenant_id() and (property_id is null or app_private.can_access_property(property_id)));
create policy documents_context_read on documents.documents for select to authenticated using(tenant_id=app_private.active_tenant_id() and (property_id is null or app_private.can_access_property(property_id)));
create policy document_versions_context_read on documents.document_versions for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from documents.documents d where d.id=document_id and (d.property_id is null or app_private.can_access_property(d.property_id))));
create policy document_links_context_read on documents.document_links for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from documents.documents d where d.id=document_id and (d.property_id is null or app_private.can_access_property(d.property_id))));
create policy retention_policies_member_read on documents.retention_policies for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.is_active_member(tenant_id));
create policy access_events_self_read on documents.access_events for select to authenticated using(tenant_id=app_private.active_tenant_id() and actor_id=auth.uid());
create policy legal_records_context_read on documents.legal_records for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_property(property_id));
grant select on all tables in schema documents to authenticated;
grant all on all tables in schema documents to service_role;
revoke all on function documents.protect_document_version() from public;



-- CANONICAL RANGE supabase/migrations/20261003151649_20261003122445_workspace_native_context_authority_v2.sql:716-726
create or replace function app_private.check_direct_effective_permission_v1(
 p_context_id uuid,p_membership_id uuid,p_permission_code text,p_module_code text,p_target_scope_type text,p_target_scope_id uuid
) returns boolean language sql stable security definer set search_path=pg_catalog
as $$ select app_private.check_direct_effective_permission_v2(
 p_context_id,p_membership_id,p_permission_code,p_module_code,p_target_scope_type,p_target_scope_id,null); $$;
create or replace function app_private.check_effective_permission_v1(
 p_context_id uuid,p_permission_code text,p_module_code text,p_target_scope_type text,p_target_scope_id uuid
) returns boolean language sql stable security definer set search_path=pg_catalog
as $$ select app_private.check_effective_permission_v2(
 p_context_id,p_permission_code,p_module_code,p_target_scope_type,p_target_scope_id,null); $$;



create schema occupancy authorization postgres;


-- CANONICAL RANGE supabase/migrations/20260825000400_occupancy_parties_leases_access.sql:16-22
create table occupancy.leases (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
 unit_id uuid not null references portfolio.units(id) on delete restrict, landlord_party_id uuid not null references portfolio.parties(id) on delete restrict,
 tenant_party_id uuid not null references portfolio.parties(id) on delete restrict, starts_on date not null, ends_on date, currency char(3) not null default 'RON',
 status platform.record_status not null default 'draft', evidence_id uuid, created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
 check(landlord_party_id<>tenant_party_id), check(ends_on is null or ends_on>starts_on)
);


alter table occupancy.leases enable row level security;


-- CANONICAL RANGE supabase/migrations/20260825000600_finance_allocation.sql:2-72

create type finance.allocation_method as enum ('meter_consumption','cpi','per_person','surface_m2','direct','fixed');
create type finance.run_status as enum ('draft','calculated','approved','posted','cancelled');

create table finance.charge_categories (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  code text not null, name text not null, default_expense_account_id uuid references finance.accounts(id) on delete restrict,
  recoverable boolean not null default true, status platform.record_status not null default 'active', created_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,code)
);
create table finance.allocation_rules (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, charge_category_id uuid not null references finance.charge_categories(id) on delete restrict,
  method finance.allocation_method not null, parameters jsonb not null default '{}'::jsonb, valid_from date not null, valid_to date,
  version integer not null default 1 check(version>0), status platform.record_status not null default 'active', created_at timestamptz not null default statement_timestamp(),
  check(valid_to is null or valid_to>valid_from), unique(property_id,charge_category_id,valid_from,version)
);
create table finance.allocation_runs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, period_start date not null, period_end date not null,
  currency char(3) not null default 'RON', status finance.run_status not null default 'draft', input_hash text,
  calculated_at timestamptz, approved_at timestamptz, approved_by uuid references auth.users(id) on delete restrict,
  journal_id uuid references finance.journals(id) on delete restrict, created_at timestamptz not null default statement_timestamp(),
  check(period_end>period_start), unique(property_id,period_start,period_end)
);
create table finance.allocation_inputs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  run_id uuid not null references finance.allocation_runs(id) on delete cascade, source_type text not null, source_id uuid,
  category_id uuid not null references finance.charge_categories(id) on delete restrict, amount numeric(20,4) not null check(amount>=0),
  snapshot_json jsonb not null, created_at timestamptz not null default statement_timestamp()
);
create table finance.allocation_items (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  run_id uuid not null references finance.allocation_runs(id) on delete cascade, input_id uuid not null references finance.allocation_inputs(id) on delete restrict,
  unit_id uuid not null references portfolio.units(id) on delete restrict, responsible_party_id uuid references portfolio.parties(id) on delete restrict,
  method finance.allocation_method not null, basis_value numeric(20,8), basis_total numeric(20,8), allocated_amount numeric(20,4) not null check(allocated_amount>=0),
  rule_snapshot jsonb not null, explanation_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default statement_timestamp(),
  unique(input_id,unit_id,responsible_party_id)
);
create index allocation_items_run_unit_idx on finance.allocation_items(tenant_id,run_id,unit_id);

create or replace function finance.assert_allocation_balanced(target_run uuid)
returns void language plpgsql security definer set search_path=pg_catalog,finance
as $$ declare source_total numeric(20,4); allocated_total numeric(20,4); begin
  select coalesce(sum(amount),0) into source_total from finance.allocation_inputs where run_id=target_run;
  select coalesce(sum(allocated_amount),0) into allocated_total from finance.allocation_items where run_id=target_run;
  if source_total<>allocated_total then
    raise exception 'allocation_unbalanced: %, source %, allocated %',target_run,source_total,allocated_total;
  end if;
end; $$;

create or replace function finance.protect_allocation_run()
returns trigger language plpgsql security definer set search_path=pg_catalog,finance
as $$ begin
  if old.status in ('approved','posted','cancelled') and new is distinct from old then raise exception 'final_allocation_run_is_immutable'; end if;
  if old.status not in ('approved','posted') and new.status in ('approved','posted') then perform finance.assert_allocation_balanced(old.id); end if;
  return new;
end; $$;
create trigger allocation_runs_protect before update on finance.allocation_runs for each row execute function finance.protect_allocation_run();

do $$ declare t text; begin foreach t in array array['charge_categories','allocation_rules','allocation_runs','allocation_inputs','allocation_items'] loop execute format('alter table finance.%I enable row level security',t); end loop; end $$;
create policy categories_member_read on finance.charge_categories for select to authenticated using(tenant_id=app_private.active_tenant_id());
create policy rules_context_read on finance.allocation_rules for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_property(property_id));
create policy runs_context_read on finance.allocation_runs for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_property(property_id));
create policy inputs_context_read on finance.allocation_inputs for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from finance.allocation_runs r where r.id=run_id and app_private.can_access_property(r.property_id)));
create policy items_context_read on finance.allocation_items for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_unit(unit_id));
grant select on finance.charge_categories,finance.allocation_rules,finance.allocation_runs,finance.allocation_inputs,finance.allocation_items to authenticated;
grant all on all tables in schema finance to service_role;
revoke all on function finance.assert_allocation_balanced(uuid),finance.protect_allocation_run() from public;
grant execute on function finance.assert_allocation_balanced(uuid) to service_role;



-- CANONICAL RANGE supabase/migrations/20260825000700_billing_invoices_receivables.sql:2-65

create schema if not exists billing;
grant usage on schema billing to authenticated;
create type billing.invoice_status as enum ('draft','issued','partially_paid','paid','void','credited');

create table billing.invoices (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, unit_id uuid not null references portfolio.units(id) on delete restrict,
  liable_party_id uuid not null references portfolio.parties(id) on delete restrict, invoice_no bigint generated always as identity,
  period_start date not null, period_end date not null, issued_on date, due_on date, currency char(3) not null default 'RON',
  subtotal numeric(20,4) not null default 0, tax_total numeric(20,4) not null default 0, total numeric(20,4) generated always as (subtotal+tax_total) stored,
  status billing.invoice_status not null default 'draft', allocation_run_id uuid references finance.allocation_runs(id) on delete restrict,
  journal_id uuid references finance.journals(id) on delete restrict, issued_snapshot jsonb, created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  check(period_end>period_start), check(subtotal>=0 and tax_total>=0), check((status='draft' and issued_on is null) or (status<>'draft' and issued_on is not null)),
  unique(tenant_id,invoice_no)
);
create table billing.invoice_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  invoice_id uuid not null references billing.invoices(id) on delete restrict, allocation_item_id uuid references finance.allocation_items(id) on delete restrict,
  category_id uuid references finance.charge_categories(id) on delete restrict, description text not null, quantity numeric(20,8) not null default 1 check(quantity>0),
  unit_price numeric(20,4) not null, tax_rate numeric(9,6) not null default 0 check(tax_rate>=0), line_subtotal numeric(20,4) not null,
  line_tax numeric(20,4) not null default 0, created_at timestamptz not null default statement_timestamp(), check(line_subtotal>=0 and line_tax>=0)
);
create table billing.receivables (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  invoice_id uuid not null unique references billing.invoices(id) on delete restrict, original_amount numeric(20,4) not null check(original_amount>=0),
  paid_amount numeric(20,4) not null default 0 check(paid_amount>=0), credited_amount numeric(20,4) not null default 0 check(credited_amount>=0),
  outstanding_amount numeric(20,4) generated always as (original_amount-paid_amount-credited_amount) stored,
  last_payment_at timestamptz, updated_at timestamptz not null default statement_timestamp(), check(paid_amount+credited_amount<=original_amount)
);

create or replace function billing.protect_issued_invoice()
returns trigger language plpgsql security definer set search_path=pg_catalog,billing
as $$ declare s billing.invoice_status; lines_subtotal numeric(20,4); lines_tax numeric(20,4); begin
  if tg_table_name='invoices' then
    if tg_op='DELETE' and old.status<>'draft' then raise exception 'issued_invoice_is_immutable'; end if;
    if tg_op='UPDATE' and old.status<>'draft' and (new.tenant_id,new.property_id,new.unit_id,new.liable_party_id,new.period_start,new.period_end,new.currency,new.subtotal,new.tax_total,new.issued_snapshot)
      is distinct from (old.tenant_id,old.property_id,old.unit_id,old.liable_party_id,old.period_start,old.period_end,old.currency,old.subtotal,old.tax_total,old.issued_snapshot) then raise exception 'issued_invoice_financial_fields_are_immutable'; end if;
    if tg_op='UPDATE' and old.status='draft' and new.status<>'draft' then
      select coalesce(sum(line_subtotal),0),coalesce(sum(line_tax),0) into lines_subtotal,lines_tax from billing.invoice_lines where invoice_id=old.id;
      if lines_subtotal<>new.subtotal or lines_tax<>new.tax_total then raise exception 'invoice_totals_do_not_match_lines'; end if;
      new.issued_on=coalesce(new.issued_on,current_date);
      new.issued_snapshot=coalesce(new.issued_snapshot,jsonb_build_object('invoice_id',new.id,'subtotal',new.subtotal,'tax_total',new.tax_total,'currency',new.currency));
    end if;
    return case when tg_op='DELETE' then old else new end;
  end if;
  select status into s from billing.invoices where id=coalesce(new.invoice_id,old.invoice_id);
  if s<>'draft' then raise exception 'issued_invoice_lines_are_immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger invoices_immutable before update or delete on billing.invoices for each row execute function billing.protect_issued_invoice();
create trigger invoice_lines_immutable before insert or update or delete on billing.invoice_lines for each row execute function billing.protect_issued_invoice();
create trigger invoices_updated_at before update on billing.invoices for each row execute function app_private.set_updated_at();
create trigger receivables_updated_at before update on billing.receivables for each row execute function app_private.set_updated_at();

do $$ declare t text; begin foreach t in array array['invoices','invoice_lines','receivables'] loop execute format('alter table billing.%I enable row level security',t); end loop; end $$;
create policy invoices_unit_read on billing.invoices for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_unit(unit_id));
create policy invoice_lines_unit_read on billing.invoice_lines for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from billing.invoices i where i.id=invoice_id and app_private.can_access_unit(i.unit_id)));
create policy receivables_unit_read on billing.receivables for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from billing.invoices i where i.id=invoice_id and app_private.can_access_unit(i.unit_id)));
grant select on all tables in schema billing to authenticated;
grant all on all tables in schema billing to service_role;
grant usage,select on all sequences in schema billing to service_role;
revoke all on function billing.protect_issued_invoice() from public;



-- CANONICAL RANGE supabase/migrations/20260825000800_payments_reconciliation.sql:2-57

create schema if not exists payments;
grant usage on schema payments to authenticated;
create type payments.transaction_direction as enum ('credit','debit');
create type payments.match_status as enum ('unmatched','suggested','confirmed','rejected');
create type payments.payment_status as enum ('pending','settled','failed','refunded');

create table payments.bank_accounts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict, iban_encrypted text not null, iban_fingerprint text not null,
  bank_name text, currency char(3) not null default 'RON', status platform.record_status not null default 'active', created_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,iban_fingerprint)
);
create table payments.import_batches (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  bank_account_id uuid not null references payments.bank_accounts(id) on delete restrict, source text not null, source_hash text not null,
  period_start date, period_end date, imported_at timestamptz not null default statement_timestamp(), imported_by uuid references auth.users(id) on delete restrict,
  row_count integer not null default 0 check(row_count>=0), unique(bank_account_id,source_hash)
);
create table payments.bank_transactions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  batch_id uuid not null references payments.import_batches(id) on delete restrict, bank_account_id uuid not null references payments.bank_accounts(id) on delete restrict,
  external_ref text, booked_on date not null, value_on date, direction payments.transaction_direction not null, amount numeric(20,4) not null check(amount>0),
  currency char(3) not null, counterparty_name text, counterparty_iban_encrypted text, remittance_text text, fingerprint text not null,
  raw_snapshot jsonb not null, created_at timestamptz not null default statement_timestamp(), unique(bank_account_id,fingerprint)
);
create table payments.payments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, unit_id uuid references portfolio.units(id) on delete restrict,
  payer_party_id uuid references portfolio.parties(id) on delete restrict, bank_transaction_id uuid unique references payments.bank_transactions(id) on delete restrict,
  provider_ref text, amount numeric(20,4) not null check(amount>0), currency char(3) not null, paid_at timestamptz not null,
  status payments.payment_status not null default 'pending', journal_id uuid references finance.journals(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp()
);
create unique index payments_provider_ref_unique on payments.payments(tenant_id,provider_ref) where provider_ref is not null;
create table payments.reconciliation_matches (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  bank_transaction_id uuid not null references payments.bank_transactions(id) on delete restrict, payment_id uuid references payments.payments(id) on delete restrict,
  receivable_id uuid references billing.receivables(id) on delete restrict, matched_amount numeric(20,4) not null check(matched_amount>0),
  confidence numeric(6,5) check(confidence between 0 and 1), status payments.match_status not null default 'suggested', rationale_json jsonb not null default '{}'::jsonb,
  confirmed_by uuid references auth.users(id) on delete restrict, confirmed_at timestamptz, created_at timestamptz not null default statement_timestamp(),
  check(payment_id is not null or receivable_id is not null), check((status='confirmed' and confirmed_at is not null) or status<>'confirmed'),
  unique nulls not distinct(bank_transaction_id,payment_id,receivable_id)
);
create index bank_transactions_date_idx on payments.bank_transactions(tenant_id,bank_account_id,booked_on,id);
create index reconciliation_status_idx on payments.reconciliation_matches(tenant_id,status,created_at);

do $$ declare t text; begin foreach t in array array['bank_accounts','import_batches','bank_transactions','payments','reconciliation_matches'] loop execute format('alter table payments.%I enable row level security',t); end loop; end $$;
create policy bank_accounts_context_read on payments.bank_accounts for select to authenticated using(tenant_id=app_private.active_tenant_id() and (property_id is null or app_private.can_access_property(property_id)));
create policy import_batches_context_read on payments.import_batches for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from payments.bank_accounts a where a.id=bank_account_id and (a.property_id is null or app_private.can_access_property(a.property_id))));
create policy bank_transactions_context_read on payments.bank_transactions for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from payments.bank_accounts a where a.id=bank_account_id and (a.property_id is null or app_private.can_access_property(a.property_id))));
create policy payments_context_read on payments.payments for select to authenticated using(tenant_id=app_private.active_tenant_id() and ((unit_id is not null and app_private.can_access_unit(unit_id)) or (unit_id is null and app_private.can_access_property(property_id))));
create policy reconciliation_context_read on payments.reconciliation_matches for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from payments.bank_transactions t join payments.bank_accounts a on a.id=t.bank_account_id where t.id=bank_transaction_id and (a.property_id is null or app_private.can_access_property(a.property_id))));
grant select on all tables in schema payments to authenticated;
grant all on all tables in schema payments to service_role;



-- CANONICAL RANGE supabase/migrations/20260825001700_governance_meetings_voting.sql:2-104

create schema if not exists governance;
grant usage on schema governance to authenticated;
create type governance.meeting_status as enum ('draft','announced','open','adjourned','closed','cancelled');
create type governance.vote_status as enum ('draft','open','closed','cancelled');

create table governance.meetings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict, title text not null, meeting_type text not null,
  scheduled_at timestamptz not null, location_text text, remote_join_url text, status governance.meeting_status not null default 'draft',
  quorum_rule jsonb not null, announced_at timestamptz, opened_at timestamptz, closed_at timestamptz,
  created_by uuid references auth.users(id) on delete restrict, created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);
create table governance.agenda_items (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meeting_id uuid not null references governance.meetings(id) on delete cascade, sequence_no integer not null check(sequence_no>0),
  title text not null, description text, decision_required boolean not null default false, attachments_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default statement_timestamp(), unique(meeting_id,sequence_no)
);
create table governance.eligibility_snapshots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meeting_id uuid not null references governance.meetings(id) on delete restrict, unit_id uuid not null references portfolio.units(id) on delete restrict,
  party_id uuid not null references portfolio.parties(id) on delete restrict, ownership_share numeric(12,10) not null check(ownership_share>0 and ownership_share<=1),
  voting_weight numeric(20,10) not null check(voting_weight>0), eligible boolean not null default true, reason text,
  snapshot_json jsonb not null, created_at timestamptz not null default statement_timestamp(), unique(meeting_id,unit_id,party_id)
);
create table governance.attendance (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meeting_id uuid not null references governance.meetings(id) on delete restrict, eligibility_id uuid not null references governance.eligibility_snapshots(id) on delete restrict,
  represented_by_party_id uuid references portfolio.parties(id) on delete restrict, attendance_mode text not null,
  checked_in_at timestamptz not null default statement_timestamp(), proxy_evidence_path text, unique(meeting_id,eligibility_id)
);
create table governance.votes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meeting_id uuid not null references governance.meetings(id) on delete restrict, agenda_item_id uuid not null references governance.agenda_items(id) on delete restrict,
  question text not null, status governance.vote_status not null default 'draft', voting_method text not null default 'weighted',
  opens_at timestamptz, closes_at timestamptz, result_snapshot jsonb, created_at timestamptz not null default statement_timestamp(),
  unique(agenda_item_id)
);
create table governance.vote_options (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  vote_id uuid not null references governance.votes(id) on delete cascade, code text not null, label text not null, sequence_no integer not null check(sequence_no>0),
  created_at timestamptz not null default statement_timestamp(), unique(vote_id,code), unique(vote_id,sequence_no)
);
create table governance.ballots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  vote_id uuid not null references governance.votes(id) on delete restrict, eligibility_id uuid not null references governance.eligibility_snapshots(id) on delete restrict,
  option_id uuid not null references governance.vote_options(id) on delete restrict, voting_weight numeric(20,10) not null check(voting_weight>0),
  cast_by uuid references auth.users(id) on delete restrict, cast_at timestamptz not null default statement_timestamp(), receipt_hash text not null,
  unique(vote_id,eligibility_id), unique(tenant_id,receipt_hash)
);
create table governance.resolutions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meeting_id uuid not null references governance.meetings(id) on delete restrict, agenda_item_id uuid not null references governance.agenda_items(id) on delete restrict,
  resolution_no text not null, title text not null, text_body text not null, adopted boolean not null, result_snapshot jsonb not null,
  effective_on date, created_at timestamptz not null default statement_timestamp(), unique(meeting_id,resolution_no)
);
create table governance.minutes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  meeting_id uuid not null references governance.meetings(id) on delete restrict, version integer not null default 1 check(version>0),
  content_json jsonb not null, object_path text, sha256 text, approved_at timestamptz, approved_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(), unique(meeting_id,version)
);

create or replace function governance.protect_closed_vote()
returns trigger language plpgsql security definer set search_path=pg_catalog,governance
as $$ declare s governance.vote_status; begin
  if tg_table_name='votes' then
    if tg_op='DELETE' and old.status='closed' then raise exception 'closed_vote_is_immutable'; end if;
    if tg_op='UPDATE' and old.status='closed' and new is distinct from old then raise exception 'closed_vote_is_immutable'; end if;
    if tg_op='UPDATE' and old.status='open' and new.status='closed' then new.closes_at=coalesce(new.closes_at,statement_timestamp()); end if;
    return case when tg_op='DELETE' then old else new end;
  end if;
  select status into s from governance.votes where id=coalesce(new.vote_id,old.vote_id);
  if s<>'open' then raise exception 'ballot_requires_open_vote'; end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger votes_protect before update or delete on governance.votes for each row execute function governance.protect_closed_vote();
create trigger ballots_open_vote before insert or update or delete on governance.ballots for each row execute function governance.protect_closed_vote();
create or replace function governance.protect_vote_option()
returns trigger language plpgsql security definer set search_path=pg_catalog,governance
as $$ declare s governance.vote_status; begin
  select status into s from governance.votes where id=coalesce(new.vote_id,old.vote_id);
  if s<>'draft' then raise exception 'vote_options_require_draft_vote'; end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger vote_options_draft_vote before insert or update or delete on governance.vote_options for each row execute function governance.protect_vote_option();
create trigger meetings_updated_at before update on governance.meetings for each row execute function app_private.set_updated_at();

do $$ declare t text; begin foreach t in array array['meetings','agenda_items','eligibility_snapshots','attendance','votes','vote_options','ballots','resolutions','minutes'] loop execute format('alter table governance.%I enable row level security',t); end loop; end $$;
create policy meetings_context_read on governance.meetings for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_property(property_id));
create policy agenda_context_read on governance.agenda_items for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from governance.meetings m where m.id=meeting_id and app_private.can_access_property(m.property_id)));
create policy eligibility_self_read on governance.eligibility_snapshots for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_unit(unit_id));
create policy attendance_context_read on governance.attendance for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from governance.meetings m where m.id=meeting_id and app_private.can_access_property(m.property_id)));
create policy votes_context_read on governance.votes for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from governance.meetings m where m.id=meeting_id and app_private.can_access_property(m.property_id)));
create policy vote_options_context_read on governance.vote_options for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from governance.votes v join governance.meetings m on m.id=v.meeting_id where v.id=vote_id and app_private.can_access_property(m.property_id)));
create policy ballots_self_read on governance.ballots for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from governance.eligibility_snapshots e where e.id=eligibility_id and app_private.can_access_unit(e.unit_id)));
create policy resolutions_context_read on governance.resolutions for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from governance.meetings m where m.id=meeting_id and app_private.can_access_property(m.property_id)));
create policy minutes_context_read on governance.minutes for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from governance.meetings m where m.id=meeting_id and app_private.can_access_property(m.property_id)));
grant select on all tables in schema governance to authenticated;
grant all on all tables in schema governance to service_role;
revoke all on function governance.protect_closed_vote(),governance.protect_vote_option() from public;



-- CANONICAL RANGE supabase/migrations/20260825002200_platform_control_plane_users_roles.sql:2-117

create type platform.platform_role_type as enum (
  'PLATFORM_SUPER_ADMIN',
  'PLATFORM_OPERATIONS',
  'PLATFORM_FINANCE',
  'PLATFORM_SUPPORT',
  'PLATFORM_AUDITOR'
);

create table platform.platform_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  employee_ref text not null unique,
  display_name text not null,
  status platform.record_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deactivated_at timestamptz
);

create table platform.platform_role_assignments (
  id uuid primary key default gen_random_uuid(),
  platform_user_id uuid not null references platform.platform_users(id) on delete cascade,
  role platform.platform_role_type not null,
  valid_from timestamptz not null default statement_timestamp(),
  valid_until timestamptz,
  status text not null default 'active' check (status in ('active','revoked','expired')),
  granted_by uuid references auth.users(id) on delete restrict,
  grant_reason text not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoke_reason text,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_until is null or valid_until > valid_from)
);

create unique index platform_role_assignments_active_idx on platform.platform_role_assignments (platform_user_id, role) where status = 'active';
create index platform_role_assignments_user_status_idx on platform.platform_role_assignments (platform_user_id, status, valid_from, valid_until);

create trigger platform_users_updated_at before update on platform.platform_users for each row execute function app_private.set_updated_at();

create or replace function app_private.current_platform_user_id()
returns uuid language sql stable security definer
set search_path = pg_catalog, platform
as $$
  select u.id from platform.platform_users u
  where u.auth_user_id = auth.uid()
    and u.status = 'active'
    and u.deactivated_at is null
  limit 1;
$$;
revoke all on function app_private.current_platform_user_id() from public;
grant execute on function app_private.current_platform_user_id() to authenticated, service_role;

create or replace function app_private.has_platform_role(required_role platform.platform_role_type)
returns boolean language sql stable security definer
set search_path = pg_catalog, platform
as $$
  select exists (
    select 1 from platform.platform_role_assignments ra
    join platform.platform_users pu on pu.id = ra.platform_user_id
    where pu.auth_user_id = auth.uid()
      and pu.status = 'active'
      and pu.deactivated_at is null
      and ra.role = required_role
      and ra.status = 'active'
      and ra.valid_from <= statement_timestamp()
      and (ra.valid_until is null or ra.valid_until > statement_timestamp())
  );
$$;
revoke all on function app_private.has_platform_role(platform.platform_role_type) from public;
grant execute on function app_private.has_platform_role(platform.platform_role_type) to authenticated, service_role;

create or replace function app_private.is_platform_user()
returns boolean language sql stable security definer
set search_path = pg_catalog, platform
as $$
  select app_private.current_platform_user_id() is not null;
$$;
revoke all on function app_private.is_platform_user() from public;
grant execute on function app_private.is_platform_user() to authenticated, service_role;

alter table platform.platform_users enable row level security;
alter table platform.platform_role_assignments enable row level security;

create policy platform_users_read on platform.platform_users for select to authenticated
using (
  auth_user_id = auth.uid()
  or app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
  or app_private.has_platform_role('PLATFORM_AUDITOR')
  or app_private.has_platform_role('PLATFORM_OPERATIONS')
);

create policy platform_users_manage on platform.platform_users for all to authenticated
using (app_private.has_platform_role('PLATFORM_SUPER_ADMIN'))
with check (app_private.has_platform_role('PLATFORM_SUPER_ADMIN'));

create policy platform_roles_read on platform.platform_role_assignments for select to authenticated
using (
  platform_user_id = app_private.current_platform_user_id()
  or app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
  or app_private.has_platform_role('PLATFORM_AUDITOR')
);

create policy platform_roles_manage on platform.platform_role_assignments for all to authenticated
using (app_private.has_platform_role('PLATFORM_SUPER_ADMIN'))
with check (app_private.has_platform_role('PLATFORM_SUPER_ADMIN'));

create policy service_platform_users_all on platform.platform_users for all to service_role using (true) with check (true);
create policy service_platform_role_assignments_all on platform.platform_role_assignments for all to service_role using (true) with check (true);

grant usage on schema app_private to authenticated;
grant select on platform.platform_users, platform.platform_role_assignments to authenticated;
grant insert, update on platform.platform_users, platform.platform_role_assignments to authenticated;
grant all on platform.platform_users, platform.platform_role_assignments to service_role;



-- CANONICAL DECLARATION supabase/migrations/20260923141840_platform_auth_routing_gateway_hardening.sql / app_private.has_platform_access_for_routing
create or replace function app_private.has_platform_access_for_routing()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, platform
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from platform.platform_users pu
      join platform.platform_role_assignments pra
        on pra.platform_user_id = pu.id
      where pu.auth_user_id = auth.uid()
        and pu.status = 'active'
        and pu.deactivated_at is null
        and pra.status = 'active'
        and pra.valid_from <= statement_timestamp()
        and (pra.valid_until is null or pra.valid_until > statement_timestamp())
    );
$$;

-- CANONICAL DECLARATION supabase/migrations/20260923141840_platform_auth_routing_gateway_hardening.sql / customer_api.has_platform_access_v1
create or replace function customer_api.has_platform_access_v1()
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return app_private.has_platform_access_for_routing();
end;
$$;

-- CANONICAL DECLARATION supabase/migrations/20260902074312_customer_password_optional_mfa_policy.sql / platform.my_customer_mfa_requirement
create or replace function platform.my_customer_mfa_requirement()
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  return app_private.customer_mfa_required();
end;
$$;

-- CANONICAL DECLARATION supabase/migrations/20260902074312_customer_password_optional_mfa_policy.sql / platform.list_my_customer_contexts
create or replace function platform.list_my_customer_contexts()
returns table(context_id uuid,membership_id uuid,tenant_id uuid,tenant_name text,role_code text,role_name text,scope_type text,property_id uuid,building_id uuid,unit_id uuid,context_label text,starts_at timestamptz,ends_at timestamptz)
language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio
as $$ begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  return query
  select g.id,m.id,m.tenant_id,t.legal_name,r.code,r.name,g.scope_type::text,g.property_id,g.building_id,g.unit_id,
    coalesce(u.code,b.name,p.name,t.legal_name),g.starts_at,g.ends_at
  from identity.memberships m join identity.context_grants g on g.membership_id=m.id and g.tenant_id=m.tenant_id
  join platform.tenants t on t.id=m.tenant_id join identity.roles r on r.id=m.role_id
  left join portfolio.properties p on p.id=g.property_id and p.tenant_id=g.tenant_id
  left join portfolio.buildings b on b.id=g.building_id and b.tenant_id=g.tenant_id
  left join portfolio.units u on u.id=g.unit_id and u.tenant_id=g.tenant_id
  where m.user_id=auth.uid() and m.status='active' and m.starts_at<=statement_timestamp()
    and (m.ends_at is null or m.ends_at>statement_timestamp()) and g.starts_at<=statement_timestamp()
    and (g.ends_at is null or g.ends_at>statement_timestamp())
  order by t.legal_name,coalesce(u.code,b.name,p.name,t.legal_name),g.id;
end $$;

-- CANONICAL DECLARATION supabase/migrations/20260906120000_customer_role_aware_dashboard.sql / platform.get_customer_dashboard
create or replace function platform.get_customer_dashboard(p_context_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,maintenance,billing,communications,occupancy
as $$
declare
  v record;
  v_workspace uuid;
  v_party_id uuid;
  v_ownership_id uuid;
  v_lease_id uuid;
  v_entitlements jsonb;
  v_permissions jsonb;
  v_modules jsonb;
  v_persona text;
  v_sections jsonb;
  v_capabilities jsonb;
  v_kpis jsonb;
begin
  -- 1. Authentication requirement
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Customer MFA verification
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Context grant, active membership, tenant and role resolution
  select
    g.id,
    g.membership_id,
    g.tenant_id,
    g.scope_type,
    g.property_id,
    g.building_id,
    g.unit_id,
    m.id as membership_key,
    m.role_id,
    lower(r.code) as role_code,
    r.name as role_name,
    t.legal_name as tenant_name
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp()
    and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 4. Fail-closed check: only 6 canonical roles permitted
  if v.role_code not in ('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident') then
    raise exception 'unknown_role' using errcode = '42501';
  end if;

  -- 5. Customer workspace validation: active workspace must be present
  select resolved.workspace_id into v_workspace
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false) resolved;

  if v_workspace is null then
    raise exception 'workspace_inactive' using errcode = '42501';
  end if;

  -- 6. Server-authoritative entitlements and permissions extraction with full override semantics
  select coalesce(jsonb_agg(e.entitlement_key order by e.entitlement_key), '[]'::jsonb)
  into v_entitlements
  from platform.workspace_entitlements e
  where e.customer_workspace_id = v_workspace
    and e.valid_from <= statement_timestamp()
    and (e.valid_until is null or e.valid_until > statement_timestamp())
    and (
      case
        when e.override_value_json is not null
         and e.override_expires_at > statement_timestamp()
        then e.override_value_json = 'true'::jsonb
        else e.boolean_value is true
      end
    );

  select coalesce(jsonb_agg(distinct p.code order by p.code), '[]'::jsonb)
  into v_permissions
  from identity.role_permissions rp
  join identity.permissions p on p.id = rp.permission_id
  where rp.role_id = v.role_id and rp.effect = 'allow';

  -- 7. Server-authoritative module visibility derivation (intersection of permission + active entitlement)
  select coalesce(jsonb_agg(m order by m), '[]'::jsonb)
  into v_modules
  from (
    select 'dashboard' as m
    union
    select 'accounting' where (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting')
    union
    select 'billing' where (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing')
    union
    select 'payments' where (v_permissions ? 'payments.reconciliation.read') and (v_entitlements ? 'module.payments')
    union
    select 'utilities' where (v_permissions ? 'utilities.metering.read') and (v_entitlements ? 'module.utilities')
    union
    select 'maintenance' where (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance')
    union
    select 'procurement' where (v_permissions ? 'maintenance.procurement.read') and (v_entitlements ? 'module.maintenance')
    union
    select 'governance' where (v_permissions ? 'governance.meetings.read') and (v_entitlements ? 'module.governance')
    union
    select 'communications' where (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications')
    union
    select 'documents' where (v_permissions ? 'documents.vault.read') and (v_entitlements ? 'module.documents')
    union
    select 'occupancy' where (v_permissions ? 'occupancy.registry.read') and (v_entitlements ? 'module.occupancy')
    union
    select 'security' where (v_permissions ? 'security.access.read') and (v_entitlements ? 'module.security')
    union
    select 'audit' where (v_permissions ? 'audit.events.read')
  ) t;

  -- 8. Deep Resident Validation (owner and tenant_resident)
  if v.role_code in ('owner', 'tenant_resident') then
    -- 8.1 Unit context requirement: scope_type must be unit and unit_id not null
    if v.scope_type <> 'unit' or v.unit_id is null then
      raise exception 'unit_context_required' using errcode = '42501';
    end if;

    -- 8.2 Party mapping requirement
    select mp.party_id into v_party_id
    from identity.membership_parties mp
    where mp.membership_id = v.membership_key
      and mp.tenant_id = v.tenant_id;

    if v_party_id is null then
      raise exception 'resident_party_mapping_required' using errcode = '42501';
    end if;

    -- 8.3 Owner validation: active ownership record
    if v.role_code = 'owner' then
      select o.id into v_ownership_id
      from portfolio.ownerships o
      where o.tenant_id = v.tenant_id
        and o.unit_id = v.unit_id
        and o.party_id = v_party_id
        and o.valid_from <= current_date
        and (o.valid_to is null or o.valid_to > current_date)
      limit 1;

      if v_ownership_id is null then
        raise exception 'ownership_required' using errcode = '42501';
      end if;

    -- 8.4 Tenant-resident validation: active lease
    elsif v.role_code = 'tenant_resident' then
      select l.id into v_lease_id
      from occupancy.leases l
      where l.tenant_id = v.tenant_id
        and l.unit_id = v.unit_id
        and l.tenant_party_id = v_party_id
        and l.status = 'active'
        and l.starts_on <= current_date
        and (l.ends_on is null or l.ends_on > current_date)
      limit 1;

      if v_lease_id is null then
        raise exception 'active_lease_required' using errcode = '42501';
      end if;
    end if;
  end if;

  -- 9. Role-aware Persona matrix, sections, capabilities, and isolated KPIs
  if v.role_code in ('association_admin', 'property_manager') then
    v_persona := v.role_code;
    v_sections := '[]'::jsonb;
    v_capabilities := '[]'::jsonb;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_sections := v_sections || jsonb_build_array('operations');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_operations');
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_sections := v_sections || jsonb_build_array('financials');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financials');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'properties', (select count(*) from portfolio.properties p where p.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or p.id = v.property_id or p.id = (select b.property_id from portfolio.buildings b where b.id = v.building_id) or p.id = (select b.property_id from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = v.unit_id))),
      'buildings', (select count(*) from portfolio.buildings b where b.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or b.id = v.building_id or b.id = (select u.building_id from portfolio.units u where u.id = v.unit_id))),
      'units', (select count(*) from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or u.building_id = v.building_id or u.id = v.unit_id))
    );

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id or w.unit_id = v.unit_id)));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id or u.id = v.unit_id)));
    end if;

  elsif v.role_code = 'president' then
    v_persona := 'president';
    v_sections := '[]'::jsonb;
    v_capabilities := jsonb_build_array('is_read_only');

    if (v_permissions ? 'governance.meetings.read') and (v_entitlements ? 'module.governance') then
      v_sections := v_sections || jsonb_build_array('governance');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_governance');
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_sections := v_sections || jsonb_build_array('financial_summary');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financial_summary');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'buildings', (select count(*) from portfolio.buildings b where b.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or b.id = v.building_id)),
      'units', (select count(*) from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or b.property_id = v.property_id or u.building_id = v.building_id))
    );

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('open_work_orders', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.status not in ('completed','verified','cancelled') and (v.scope_type = 'tenant' or w.property_id = v.property_id or w.building_id = v.building_id)));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if ((v_permissions ? 'billing.receivables.read' and v_entitlements ? 'module.billing') or
        (v_permissions ? 'finance.ledger.read' and v_entitlements ? 'module.accounting')) then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)));
    end if;

  elsif v.role_code = 'censor' then
    v_persona := 'censor';
    v_sections := '[]'::jsonb;
    v_capabilities := jsonb_build_array('is_read_only');

    if (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting') then
      v_sections := v_sections || jsonb_build_array('financial_controls');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_financial_controls');
    end if;

    if v_permissions ? 'audit.events.read' then
      v_sections := v_sections || jsonb_build_array('audit');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_audit');
    end if;

    v_kpis := '{}'::jsonb;

    if (v_permissions ? 'finance.ledger.read') and (v_entitlements ? 'module.accounting') then
      v_kpis := v_kpis || jsonb_build_object(
        'outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id join portfolio.units u on u.id = i.unit_id join portfolio.buildings b on b.id = u.building_id where rc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id or u.building_id = v.building_id)),
        'financial_records', (select count(*) from billing.invoices i where i.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or i.property_id = v.property_id))
      );
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

  elsif v.role_code = 'owner' then
    v_persona := 'owner';
    v_sections := '[]'::jsonb;
    v_capabilities := '[]'::jsonb;

    v_sections := v_sections || jsonb_build_array('my_units');
    v_capabilities := v_capabilities || jsonb_build_array('can_view_my_units');

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('my_financials');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_financials');
    end if;

    -- Strict unit-only isolation: unit_id matches the validated ownership unit!
    v_kpis := '{}'::jsonb;
    v_kpis := v_kpis || jsonb_build_object(
      'my_units_count', (select count(*) from portfolio.ownerships o where o.tenant_id = v.tenant_id and o.unit_id = v.unit_id and o.party_id = v_party_id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date))
    );

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and i.unit_id = v.unit_id));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('my_open_requests', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.unit_id = v.unit_id and w.status not in ('completed','verified','cancelled')));
    end if;

  elsif v.role_code = 'tenant_resident' then
    v_persona := 'tenant_resident';
    v_sections := jsonb_build_array('my_residence');
    v_capabilities := jsonb_build_array('can_view_my_residence');

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_sections := v_sections || jsonb_build_array('my_expenses');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_expenses');
    end if;

    if (v_permissions ? 'utilities.metering.read') and (v_entitlements ? 'module.utilities') then
      v_sections := v_sections || jsonb_build_array('my_consumption');
      v_capabilities := v_capabilities || jsonb_build_array('can_view_my_consumption');
    end if;

    -- Strict unit & tenant party isolation!
    v_kpis := '{}'::jsonb;

    if (v_permissions ? 'billing.receivables.read') and (v_entitlements ? 'module.billing') then
      v_kpis := v_kpis || jsonb_build_object('outstanding_amount', (select coalesce(sum(rc.outstanding_amount), 0) from billing.receivables rc join billing.invoices i on i.id = rc.invoice_id where rc.tenant_id = v.tenant_id and i.unit_id = v.unit_id and (i.liable_party_id is null or i.liable_party_id = v_party_id)));
    end if;

    if (v_permissions ? 'maintenance.assets.read') and (v_entitlements ? 'module.maintenance') then
      v_kpis := v_kpis || jsonb_build_object('my_open_tickets', (select count(*) from maintenance.work_orders w where w.tenant_id = v.tenant_id and w.unit_id = v.unit_id and w.status not in ('completed','verified','cancelled')));
    end if;

    if (v_permissions ? 'communications.feed.read') and (v_entitlements ? 'module.communications') then
      v_kpis := v_kpis || jsonb_build_object('unread_notifications', (select count(*) from communications.notifications n where n.tenant_id = v.tenant_id and n.membership_id = v.membership_key and n.read_at is null));
    end if;
  end if;

  -- 10. Explicit versioned response construction
  return jsonb_build_object(
    'version', 1,
    'persona', v_persona,
    'contextId', v.id,
    'context', jsonb_build_object(
      'id', v.id,
      'tenant_id', v.tenant_id,
      'tenant_name', v.tenant_name,
      'role_code', v.role_code,
      'role_name', v.role_name,
      'scope_type', v.scope_type,
      'property_id', v.property_id,
      'building_id', v.building_id,
      'unit_id', v.unit_id
    ),
    'workspace_id', v_workspace,
    'permissions', v_permissions,
    'entitlements', v_entitlements,
    'modules', v_modules,
    'capabilities', v_capabilities,
    'sections', v_sections,
    'kpis', v_kpis,
    'generated_at', statement_timestamp()
  );
end $$;

-- CANONICAL DECLARATION supabase/migrations/20260907200000_customer_api_gateway.sql / customer_api.get_dashboard_v1
create or replace function customer_api.get_dashboard_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return platform.get_customer_dashboard(p_context_id);
end;
$$;

-- CANONICAL DECLARATION supabase/migrations/20260907200000_customer_api_gateway.sql / customer_api.list_contexts_v1
create or replace function customer_api.list_contexts_v1()
returns table(
  context_id uuid,
  membership_id uuid,
  tenant_id uuid,
  tenant_name text,
  role_code text,
  role_name text,
  scope_type text,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  context_label text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone
)
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return query select * from platform.list_my_customer_contexts();
end;
$$;

-- CANONICAL DECLARATION supabase/migrations/20260907200000_customer_api_gateway.sql / customer_api.my_mfa_requirement_v1
create or replace function customer_api.my_mfa_requirement_v1()
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return platform.my_customer_mfa_requirement();
end;
$$;

-- CANONICAL RANGE supabase/migrations/20260825000300_portfolio_properties_buildings_units.sql:37-46
create table portfolio.ownerships (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  unit_id uuid not null references portfolio.units(id) on delete restrict, party_id uuid not null references portfolio.parties(id) on delete restrict,
  share numeric(10,8) not null check(share>0 and share<=1), valid_from date not null, valid_to date, evidence_id uuid,
  created_at timestamptz not null default statement_timestamp(), check(valid_to is null or valid_to>valid_from)
);
create index properties_tenant_status_idx on portfolio.properties(tenant_id,status,id);
create index buildings_tenant_property_idx on portfolio.buildings(tenant_id,property_id,id);
create index units_tenant_building_idx on portfolio.units(tenant_id,building_id,status,id);
create index ownerships_unit_period_idx on portfolio.ownerships(tenant_id,unit_id,valid_from,valid_to);


alter table portfolio.ownerships enable row level security;


-- CANONICAL RANGE supabase/migrations/20260825000300_portfolio_properties_buildings_units.sql:67-67
create policy ownerships_context_read on portfolio.ownerships for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_unit(unit_id));


-- CANONICAL RANGE supabase/migrations/20260829004300_customer_accounting_ledger_dashboard.sql:37-48
create table identity.membership_parties (
  membership_id uuid primary key references identity.memberships(id) on delete cascade,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  party_id uuid not null references portfolio.parties(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, party_id)
);
create index membership_parties_tenant_party_idx on identity.membership_parties(tenant_id,party_id);
create index membership_parties_party_id_idx on identity.membership_parties(party_id);
alter table identity.membership_parties enable row level security;
create policy membership_parties_self_read on identity.membership_parties for select to authenticated
using (exists(select 1 from identity.memberships m where m.id=membership_id and m.user_id=(select auth.uid()) and m.tenant_id=tenant_id));


-- CANONICAL RANGE supabase/migrations/20260825001800_communications_feed_polls_notifications.sql:2-99

create schema if not exists communications;
grant usage on schema communications to authenticated;
create type communications.channel_scope as enum ('tenant','property','building','unit','direct');
create type communications.post_status as enum ('draft','published','archived','removed');

create table communications.channels (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict, building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict, scope communications.channel_scope not null, name text not null,
  is_private boolean not null default true, status platform.record_status not null default 'active', created_at timestamptz not null default statement_timestamp(),
  check((scope='tenant' and property_id is null and building_id is null and unit_id is null) or (scope='property' and property_id is not null and building_id is null and unit_id is null) or (scope='building' and building_id is not null and unit_id is null) or (scope='unit' and unit_id is not null) or scope='direct')
);
create table communications.channel_members (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  channel_id uuid not null references communications.channels(id) on delete cascade, membership_id uuid not null references identity.memberships(id) on delete cascade,
  role text not null default 'member', joined_at timestamptz not null default statement_timestamp(), muted_until timestamptz, unique(channel_id,membership_id)
);
create table communications.posts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  channel_id uuid not null references communications.channels(id) on delete restrict, author_membership_id uuid references identity.memberships(id) on delete restrict,
  title text, body text not null, post_type text not null default 'update', status communications.post_status not null default 'draft',
  pinned_until timestamptz, published_at timestamptz, created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);
create table communications.comments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  post_id uuid not null references communications.posts(id) on delete cascade, parent_comment_id uuid references communications.comments(id) on delete cascade,
  author_membership_id uuid not null references identity.memberships(id) on delete restrict, body text not null, removed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);
create table communications.reactions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict, post_id uuid references communications.posts(id) on delete cascade,
  comment_id uuid references communications.comments(id) on delete cascade, membership_id uuid not null references identity.memberships(id) on delete cascade,
  reaction text not null, created_at timestamptz not null default statement_timestamp(),
  check((post_id is not null)::integer+(comment_id is not null)::integer=1), unique nulls not distinct(post_id,comment_id,membership_id,reaction)
);
create table communications.polls (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  post_id uuid not null unique references communications.posts(id) on delete cascade, question text not null, multiple_choice boolean not null default false,
  opens_at timestamptz not null, closes_at timestamptz, anonymous boolean not null default false, result_snapshot jsonb, created_at timestamptz not null default statement_timestamp(),
  check(closes_at is null or closes_at>opens_at)
);
create table communications.poll_options (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  poll_id uuid not null references communications.polls(id) on delete cascade, label text not null, sequence_no integer not null check(sequence_no>0), unique(poll_id,sequence_no)
);
create table communications.poll_responses (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  poll_id uuid not null references communications.polls(id) on delete restrict, option_id uuid not null references communications.poll_options(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict, responded_at timestamptz not null default statement_timestamp(),
  unique(poll_id,option_id,membership_id)
);
create table communications.notifications (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete cascade, type text not null, title text not null, body text,
  action_url text, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default statement_timestamp(), read_at timestamptz
);
create table communications.notification_preferences (
  tenant_id uuid not null references platform.tenants(id) on delete restrict, membership_id uuid not null references identity.memberships(id) on delete cascade,
  channel text not null, event_type text not null, enabled boolean not null default true, quiet_hours jsonb, updated_at timestamptz not null default statement_timestamp(),
  primary key(membership_id,channel,event_type)
);

create or replace function app_private.can_access_channel(target_channel uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,communications
as $$ select exists(select 1 from communications.channels c where c.id=target_channel and c.tenant_id=app_private.active_tenant_id() and ((c.scope='tenant' and app_private.is_active_member(c.tenant_id)) or (c.scope='property' and app_private.can_access_property(c.property_id)) or (c.scope='building' and app_private.can_access_building(c.building_id)) or (c.scope='unit' and app_private.can_access_unit(c.unit_id)) or (c.scope='direct' and exists(select 1 from communications.channel_members cm where cm.channel_id=c.id and cm.membership_id=app_private.active_membership_id())))); $$;
revoke all on function app_private.can_access_channel(uuid) from public;
grant execute on function app_private.can_access_channel(uuid) to authenticated,service_role;

create or replace function communications.enforce_poll_response()
returns trigger language plpgsql security definer set search_path=pg_catalog,communications
as $$ declare p communications.polls%rowtype; existing_count integer; begin
  select * into p from communications.polls where id=new.poll_id;
  if not found or statement_timestamp()<p.opens_at or (p.closes_at is not null and statement_timestamp()>=p.closes_at) then raise exception 'poll_is_not_open'; end if;
  if not exists(select 1 from communications.poll_options o where o.id=new.option_id and o.poll_id=new.poll_id) then raise exception 'poll_option_mismatch'; end if;
  if not p.multiple_choice then
    select count(*) into existing_count from communications.poll_responses r where r.poll_id=new.poll_id and r.membership_id=new.membership_id and (tg_op='INSERT' or r.id<>new.id);
    if existing_count>0 then raise exception 'single_choice_poll_allows_one_response'; end if;
  end if;
  return new;
end; $$;
create trigger poll_responses_validate before insert or update on communications.poll_responses for each row execute function communications.enforce_poll_response();
revoke all on function communications.enforce_poll_response() from public;

do $$ declare t text; begin foreach t in array array['channels','channel_members','posts','comments','reactions','polls','poll_options','poll_responses','notifications','notification_preferences'] loop execute format('alter table communications.%I enable row level security',t); end loop; end $$;
create policy channels_context_read on communications.channels for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_channel(id));
create policy channel_members_self_read on communications.channel_members for select to authenticated using(tenant_id=app_private.active_tenant_id() and (membership_id=app_private.active_membership_id() or app_private.can_access_channel(channel_id)));
create policy posts_context_read on communications.posts for select to authenticated using(tenant_id=app_private.active_tenant_id() and app_private.can_access_channel(channel_id));
create policy comments_context_read on communications.comments for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from communications.posts p where p.id=post_id and app_private.can_access_channel(p.channel_id)));
create policy reactions_context_read on communications.reactions for select to authenticated using(tenant_id=app_private.active_tenant_id() and ((post_id is not null and exists(select 1 from communications.posts p where p.id=post_id and app_private.can_access_channel(p.channel_id))) or (comment_id is not null and exists(select 1 from communications.comments c join communications.posts p on p.id=c.post_id where c.id=comment_id and app_private.can_access_channel(p.channel_id)))));
create policy polls_context_read on communications.polls for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from communications.posts p where p.id=post_id and app_private.can_access_channel(p.channel_id)));
create policy poll_options_context_read on communications.poll_options for select to authenticated using(tenant_id=app_private.active_tenant_id() and exists(select 1 from communications.polls x join communications.posts p on p.id=x.post_id where x.id=poll_id and app_private.can_access_channel(p.channel_id)));
create policy poll_responses_self_read on communications.poll_responses for select to authenticated using(tenant_id=app_private.active_tenant_id() and membership_id=app_private.active_membership_id());
create policy notifications_self_read on communications.notifications for select to authenticated using(tenant_id=app_private.active_tenant_id() and membership_id=app_private.active_membership_id());
create policy notification_preferences_self_read on communications.notification_preferences for select to authenticated using(tenant_id=app_private.active_tenant_id() and membership_id=app_private.active_membership_id());
grant select on all tables in schema communications to authenticated;
grant all on all tables in schema communications to service_role;



-- CANONICAL RANGE supabase/migrations/20260928130116_20260928113655_scoped_unit_invitations.sql:3-39
create table communications.unit_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id),
  workspace_id uuid not null references platform.customer_workspaces(id),
  unit_id uuid not null references portfolio.units(id),
  party_id uuid references portfolio.parties(id),
  vendor_id uuid references maintenance.vendors(id),
  normalized_email text not null,
  role_code text not null check (role_code in ('owner','tenant_resident','vendor_contact')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id),
  inviter_context_id uuid not null references identity.context_grants(id),
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '72 hours'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (normalized_email = lower(trim(normalized_email))),
  check ((role_code='vendor_contact' and vendor_id is not null and party_id is null)
    or (role_code in ('owner','tenant_resident') and party_id is not null and vendor_id is null)),
  check (expires_at > created_at),
  check ((status='accepted' and accepted_by is not null and accepted_at is not null)
    or (status<>'accepted' and accepted_by is null and accepted_at is null))
);
create unique index unit_invitations_pending_unique on communications.unit_invitations
  (workspace_id,unit_id,normalized_email,role_code) where status='pending';
create index unit_invitations_email_idx on communications.unit_invitations(normalized_email,status,expires_at);
create index unit_invitations_tenant_idx on communications.unit_invitations(tenant_id);
create index unit_invitations_workspace_idx on communications.unit_invitations(workspace_id);
create index unit_invitations_unit_idx on communications.unit_invitations(unit_id);
create index unit_invitations_party_idx on communications.unit_invitations(party_id);
create index unit_invitations_vendor_idx on communications.unit_invitations(vendor_id);
create index unit_invitations_inviter_idx on communications.unit_invitations(invited_by);
create index unit_invitations_inviter_context_idx on communications.unit_invitations(inviter_context_id);
create index unit_invitations_acceptor_idx on communications.unit_invitations(accepted_by);
alter table communications.unit_invitations enable row level security;
revoke all on communications.unit_invitations from public,anon,authenticated;


-- CANONICAL RANGE supabase/migrations/20260929065846_owner_portfolio_manager_invite.sql:5-8
alter table communications.unit_invitations
  add column owner_portfolio_requested boolean not null default false;
alter table communications.unit_invitations
  add constraint owner_portfolio_owner_only check (not owner_portfolio_requested or role_code='owner');


-- CANONICAL DECLARATION supabase/migrations/20260929065846_owner_portfolio_manager_invite.sql / customer_api.list_my_unit_invitations_v1
create or replace function customer_api.list_my_unit_invitations_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_email text;
begin
  select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'unit',u.code,
    'building',b.name,'role',i.role_code,'owner_portfolio',i.owner_portfolio_requested,
    'expires_at',i.expires_at) order by i.created_at desc)
    from communications.unit_invitations i join portfolio.units u on u.id=i.unit_id
    join portfolio.buildings b on b.id=u.building_id where i.normalized_email=v_email
      and i.status='pending' and i.expires_at>statement_timestamp()),'[]'::jsonb);
end $$;

-- CANONICAL DECLARATION supabase/migrations/20260925131751_multi_unit_owner_private_portfolio_v1.sql / app_private.has_multi_unit_owner_role_v1
create or replace function app_private.has_multi_unit_owner_role_v1()
returns boolean language sql stable security definer
set search_path=pg_catalog,identity,auth as $$
  select auth.uid() is not null
    and (auth.jwt()->>'aal')='aal2'
    and exists (
      select 1 from identity.memberships m
      join identity.roles r on r.id=m.role_id
      join platform.tenants t on t.id=m.tenant_id
      join auth.users u on u.id=m.user_id
      where m.user_id=auth.uid() and u.email_confirmed_at is not null
        and r.code='multi_unit_owner' and r.is_system and r.tenant_id is null
        and t.status='active' and m.status='active' and m.starts_at<=statement_timestamp()
        and (m.ends_at is null or m.ends_at>statement_timestamp())
    );
$$;

-- CANONICAL DECLARATION supabase/migrations/20260925131751_multi_unit_owner_private_portfolio_v1.sql / customer_api.my_multi_unit_owner_access_v1
create or replace function customer_api.my_multi_unit_owner_access_v1()
returns boolean language sql stable security invoker
set search_path=pg_catalog as $$
  select app_private.has_multi_unit_owner_role_v1();
$$;
-- OC1: inactive schemas/tables/sequences/functions remain closed before COMMIT.
-- Only the approved F64/F80 nested owner edges survive. No runtime/fixture grant.
do $oc1$
declare r record; s text; begin
 for s in select nspname from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke all privileges on schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all tables in schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all sequences in schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all functions in schema %I from public,anon,authenticated,service_role',s);
 end loop;
 for r in select n.nspname,t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype in ('e','d') and n.nspname in ('platform','identity','portfolio','finance','assets','maintenance','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke all privileges on type %I.%I from public,anon,authenticated,service_role',r.nspname,r.typname);
 end loop;
 for r in select n.nspname,c.relname,a.attname from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where a.attnum>0 and not a.attisdropped and a.attacl is not null and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke select (%I),insert (%I),update (%I),references (%I) on table %I.%I from public,anon,authenticated,service_role',r.attname,r.attname,r.attname,r.attname,r.nspname,r.relname);
 end loop;
 if (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d) is distinct from current_setting('cladora.install.defaults')::jsonb then
  raise exception 'operations_default_acl_delta' using errcode='55000';end if;
 if (select jsonb_build_object(
 'namespaces',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where n.nspname in ('auth','extensions','public')),
 'relations',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')))) is distinct from current_setting('cladora.install.managed')::jsonb then
  raise exception 'operations_managed_catalog_delta' using errcode='55000';end if;
 -- Fail closed on unenumerated ACL rather than trusting role names or changing defaults.
 for r in select p.oid,p.proowner,a.grantee,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>p.proowner loop
  if not(r.nspname='app_private' and ((r.oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure and r.grantee='postgres'::regrole) or (r.oid='app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)'::regprocedure and r.grantee='cladora_rpc_owner'::regrole))) then
   raise exception 'operations_unexpected_routine_acl' using errcode='55000';end if;
 end loop;
 if exists(select 1 from pg_namespace n,lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>n.nspowner and not(n.nspname='app_private' and a.grantee='cladora_rpc_owner'::regrole and a.privilege_type='USAGE' and not a.is_grantable)) then
  raise exception 'operations_unexpected_schema_acl' using errcode='55000';end if;
 if exists(select 1 from pg_attribute x join pg_class c on c.oid=x.attrelid join pg_namespace n on n.oid=c.relnamespace,lateral aclexplode(x.attacl) a where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>c.relowner) then
  raise exception 'operations_unexpected_column_acl' using errcode='55000';end if;
 if exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace,lateral aclexplode(coalesce(t.typacl,acldefault('T',t.typowner))) a where t.typtype in ('e','d') and n.nspname in ('platform','identity','portfolio','finance','assets','maintenance','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>t.typowner) then
  raise exception 'operations_unexpected_type_acl' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and not c.relrowsecurity) then
  raise exception 'operations_table_rls_not_enabled' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace,
  lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a
  where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>c.relowner) then
  raise exception 'operations_unexpected_relation_acl' using errcode='55000';end if;
end; $oc1$;
-- SOURCE CATALOG ASSERTIONS: literal declaration/body identities, not a compiled equivalence claim.
-- Caller/operator/transport binding remains separate; source alone grants no execution permission.
do $source_catalog$
begin
 if exists(
 with source(signature,body_hash,owner_name,secdef,language_name,volatility,is_strict,config,ordinal) as (values
('app_private.require_building_session_current_v1()','fe08aab2dd1d8a064132b37f8f4c1e135b2315797efdc46ea0fbaf961375a4be','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],0),
('app_private.set_updated_at()','5a8f4016886cdf8674eb096c4d9b4b5c2599fd42d6952222e5c60717d5075fda','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],1),
('finance.protect_accounting_period()','6d683063bd39295cb61fbe13994a1281ac183aa56ee908977c96e4bb68e3b04d','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, finance']::text[],2),
('finance.assert_accounting_period_no_overlap()','6f19738d2f3155fede6fa896b9cc373a6eb61891ab792af5b112e0eab731048d','postgres',false,'plpgsql','v',false,array['search_path=finance, platform, extensions, public']::text[],3),
('finance.assert_accounting_period_property_tenant()','1a420399690ff1ec2be1ca1ce6c5e3c884da334e43eccc530433d9d024de91af','postgres',false,'plpgsql','v',false,array['search_path=finance, portfolio, platform, public']::text[],4),
('app_private.guard_taxonomy_version_effective_period_v1()','5b0526e5baa803dd1d7c8d51223035e2791ea30cb584ea4ad3d81c8e9f1c2b20','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],5),
('app_private.guard_taxonomy_record_immutability_v1()','62c110bda6f2c61e19d2edbda1fdf76acbb9837cccd154407721d9a21e3dd442','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],6),
('app_private.guard_workspace_taxonomy_assignment_history_v1()','57775bdf49589b29e54667792754737ffac2c9f8f8d2968fa5a78f19cb71fd2f','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],7),
('app_private.guard_workspace_property_binding_history_v1()','ae4ba0c418b59d58d9a039fbf7c4fec9f60301ed1e7622e70bf20052959e1c52','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],8),
('app_private.guard_workspace_property_binding_v1()','7f1cbf81b9bcdd252e4e4612f36f8d4603b4df91207671e8665df7c0a976a649','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform, portfolio']::text[],9),
('app_private.guard_workspace_taxonomy_assignment_v1()','9c3ea8db58c4535bba622f1ff7b68ad8a3b931327a6e23cc167746c7eb8620d6','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform, app_private']::text[],10),
('app_private.bootstrap_role_taxonomy_permissions_v1()','d6f7a621af1c1253daf93ce189093e7740fe192fcb2d6864cefd6dbc26fb3f73','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, identity']::text[],11),
('app_private.bootstrap_role_module_permissions_v1()','e1b36b34d24b7c126e9d51275f2088f15b34ac9ff8f7e6b5d082371979470b65','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, identity']::text[],12),
('app_private.guard_module_definition_immutability_v1()','1612ccc7d6b86019eab2f43cb8e48e86bac834944b1690a6fb74c8b40020774a','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],13),
('app_private.guard_module_definition_effective_period_v1()','ae430ae42200f43067e80b49a0cd6ed90880713ef74cfa10092fc9041e84f03e','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],14),
('app_private.guard_workspace_module_code_sync_v1()','b771eceb7716fda7c546b3518a78b469acbd2521de501164eb01a05e65688254','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],15),
('app_private.guard_workspace_module_immutability_v1()','53a32dc1e7732073006af0a6bd014096da50cb69526f438e4a62a30fc9b66f50','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],16),
('app_private.bootstrap_role_workspace_role_permissions_v1()','6adbe60831f68f040874086cb3140d2490b162fefbcbf4a0056821c781aae5c4','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, identity']::text[],17),
('app_private.guard_module_permission_binding_invariants_v1()','4493f6e9241f06b3af9a3d985b4cf57f3342f3917becdc10b78c3d177cfd53bc','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform, identity']::text[],18),
('app_private.guard_workspace_role_immutability_v1()','96a8fa06482eaaa0a7e8e2ac7ae06395477db33661d38b392534b8261fcb39c1','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],19),
('app_private.guard_workspace_role_module_draft_only_v1()','80d6755b78cfa349bf400f84cb88063a07b105989d09bc62cfe03ccd10278143','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],20),
('app_private.guard_workspace_role_permission_bindings_v1()','5946bbadaf83cf0ca91d7f582ecfa9266381c08dcdb95769e9240ba5ad4aadef','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],21),
('app_private.guard_workspace_member_role_invariants_v1()','efad60b6dc092417c2659f83b308c7010b58b47fda3a942c5006420055529c22','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform, portfolio, identity']::text[],22),
('app_private.bootstrap_role_workspace_delegation_permissions_v1()','2bfa606eb7072ffe01a50e9735e7839b9d4801e2114f8cbed4d1d0c277621daa','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, identity']::text[],23),
('platform.cap_customer_membership_to_access_basis()','faddba945ba322502909fa8b7651cef72bf75cea8d13bb4ee19c5d83737ce505','postgres',true,'plpgsql','v',false,array['search_path=""']::text[],24),
('platform.cap_customer_context_to_membership()','0a55df5094c39ea561e475c63b97e3a76ebba62a2d9262447188cc4df5bc4bf7','postgres',true,'plpgsql','v',false,array['search_path=""']::text[],25),
('platform.require_workspace_access_basis_for_provisioning()','8d32710fdfe66ce18e426d5afd71862ef09251d146710ef056795d69c339fccf','postgres',true,'plpgsql','v',false,array['search_path=""']::text[],26),
('app_private.guard_undefined_primary_role_v1()','a8ecc3e34993fe4199518bc061d50aba74d89796dd6e3825f69fd0cde0b6b978','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],27),
('app_private.guard_workspace_role_authority_source_immutable_v1()','44da2e8b2ccae7621d02d1cb152c6ef918b1daed5fefa4174bef3709da264576','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],28),
('app_private.guard_authority_revision_v1()','8cd211b50e7c7280bc76ca44c637bbb3294a2f8be85e019e74a6796a630c5140','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],29),
('app_private.bump_canonical_authority_revision_v1()','e81a9e847ba3ab6768a027b7f33689d8f136b3f81fc17e83f1a531ee4f6ad60f','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],30),
('app_private.guard_jurisdiction_bound_property_address_v1()','d6ee15d58fa2285b88a96fc785ea95ffd164491d6455c3f0103a048a2d2cb76e','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],31),
('app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)','cedb3d8afe2432fb01397a5c041042010e9a59605b18760f737e4f94e4de6adb','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, platform, identity, portfolio, app_private']::text[],32),
('platform.assert_workspace_activation_ready(uuid)','d4d4431ff458ce288f7cb6ad67e91445ec1ba878d3d14e8908d1ac97ca6e2a09','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, platform, identity, auth']::text[],33),
('app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)','f0928f38cb5d10127d103c95938c4ebfbbaf5b2ffe3a390afa4865b57cd23e10','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, identity, portfolio, app_private']::text[],34),
('app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','ebd3ac9d0052b960b6e0257ea4f423c3461441bd2f29671fd0df61f09e0eb125','postgres',false,'sql','i',false,array['search_path=pg_catalog']::text[],35),
('app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','1a92d34a89f3885dcbf7e48f1101807efbb679441ef378b2067b94fc3b7a83ca','postgres',false,'sql','i',false,array['search_path=pg_catalog']::text[],36),
('app_private.customer_mfa_required()','e36b759f7da693b6b7a534b6e1603918d2990b5efceef3ed91224e8c373c839f','postgres',true,'sql','s',false,array['search_path=pg_catalog, identity']::text[],37),
('platform.enforce_workspace_activation_gate()','72fdb46676cea7644a64b6bfcba1b527c9165a22fc2c008d770eba5863178513','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform']::text[],38),
('app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)','58c63fb293ae7354f69bddb6f0dac572a0d2913281ca96634d093e2d84dd85e4','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, platform, identity, portfolio, app_private']::text[],39),
('app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])','8cdc0a8b98478147a11db0da64ecb6656feacf5a0c1cf7709433a36735f3257b','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, platform, identity, portfolio, app_private']::text[],40),
('app_private.guard_workspace_member_role_authority_v2()','ba55df5a5c2fd97032195db0ab78c7fdd7fa4f72786619547768c7dad8b6311c','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, platform, identity, portfolio, app_private']::text[],41),
('app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)','e03bd53c4b28eb540fd42ed08ccabb8793f48b18cfbfff198f6bb60bf8b6e238','postgres',true,'sql','s',false,array['search_path=pg_catalog']::text[],42),
('app_private.resolve_workspace_native_context_v2(uuid,uuid)','9aa35ef5341aac517c394f69e6fb0cdbe5249583c8034b6ba2ac3495390b2536','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],43),
('app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)','9b7457df9b1cd47d9aa43b70e868c555cce97edfe905c2b2cad9832733b2dbd6','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, platform, identity, portfolio, app_private']::text[],44),
('app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)','8f00424daca0ede92c652b5137a498b19797db611cb0b20054413041869d57c9','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],45),
('app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)','ad512bd9cf2bf231a9332623d3d7b1d5cc318ecc3efd582faec60c3ebe4a0e95','cladora_rpc_owner',true,'sql','s',false,array['search_path=pg_catalog']::text[],46),
('app_private.jwt_uuid(text)','bf8dce7f971df9b4105bb495c3a20d8da112f633584e86ca98472d58062782c7','postgres',false,'sql','s',false,array['search_path=pg_catalog']::text[],47),
('app_private.active_tenant_id()','1b60eac753375e7e40885fb38db0584452f995879b7daa5cdb3f0faa4c9a1072','postgres',false,'sql','s',false,array['search_path=pg_catalog']::text[],48),
('app_private.active_context_id()','6b36b5c7dd534e2082755f5b32962970abc2e699e402206f64a16b9048afc000','postgres',false,'sql','s',false,array['search_path=pg_catalog']::text[],49),
('app_private.is_service_role()','68501d07b89300301d17cd0fa551e7301505c69afdf0bb0f2a53a63e22fb5676','postgres',false,'sql','s',false,array['search_path=pg_catalog']::text[],50),
('app_private.is_active_member(uuid)','0fe7e23a0daed3920918c323d0c64177b5132333dac56e126651e33c8280bdc8','postgres',true,'sql','s',false,array['search_path=pg_catalog, identity']::text[],51),
('app_private.active_membership_id()','4ea73f77cf8437ae9dbbfe6fc5bc1fdf0c7f3cc582a65e33c38c301a3cf8c641','postgres',true,'sql','s',false,array['search_path=pg_catalog, identity']::text[],52),
('app_private.can_access_property(uuid)','770705be79c24ab1f14d151cd44ddfc2126478d0882fe7c37e3aa5b3cab00181','postgres',true,'sql','s',false,array['search_path=pg_catalog, identity, portfolio']::text[],53),
('app_private.can_access_building(uuid)','9f484d3ec07ff220c513d8b4c40bf3d408bbc1ddb2d1bcebfd174c4a4bfd7056','postgres',true,'sql','s',false,array['search_path=pg_catalog, identity, portfolio']::text[],54),
('app_private.can_access_unit(uuid)','425044f1ee609a111308139154e577081352c001ffadb7edb96a5d2a8ea83ad6','postgres',true,'sql','s',false,array['search_path=pg_catalog, identity, portfolio']::text[],55),
('app_private.can_access_utility_scope(uuid,uuid,uuid)','c1927e19bd9aac346ea119ae0a272cff8a102fbb6442ed140f2e0a19ba6bfc62','postgres',true,'sql','s',false,array['search_path=pg_catalog, portfolio']::text[],56),
('utilities.protect_validated_reading()','8fb74661f9d40bfbd550fcf2460d0390c0fb0990cbe9a8f41c4f36da6cc10b2f','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, utilities']::text[],57),
('app_private.can_access_asset_scope(uuid,uuid,uuid)','c1927e19bd9aac346ea119ae0a272cff8a102fbb6442ed140f2e0a19ba6bfc62','postgres',true,'sql','s',false,array['search_path=pg_catalog']::text[],58),
('maintenance.enforce_work_order_transition()','ce5927be55e829ab72aada5e18ef6750c9e27697ce13bc9f2a73c5230a0812df','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance']::text[],59),
('maintenance.protect_purchase_order()','80bb89864b1b294d02a4bcd216f2d5c4017c27cc6df783ff475e846c5ac50f22','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance']::text[],60),
('documents.protect_document_version()','abe7680768f18b7978ca661ee72a8e257e718788e733b6636641cbd90428966d','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],61),
('app_private.check_direct_effective_permission_v1(uuid,uuid,text,text,text,uuid)','d6a4b7cb6bf42d87cb5795ffcabaa505efcc0aa286aa4d5c31ddd21d6a49db69','postgres',true,'sql','s',false,array['search_path=pg_catalog']::text[],62),
('app_private.check_effective_permission_v1(uuid,text,text,text,uuid)','707192742baa1e8929f03d3a3a443b8843fdcb2749cf057333e03832d1e6a58f','postgres',true,'sql','s',false,array['search_path=pg_catalog']::text[],63),
('finance.assert_allocation_balanced(uuid)','d49f4e4383be97976d9ecd65226dd9ff1c7fadc0315d0fb919afe9ffd9d1e12c','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, finance']::text[],64),
('finance.protect_allocation_run()','95e31f91bdf3c8513a0b47e7d52e64c75e9326e66fbef1d01379a43652ae6813','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, finance']::text[],65),
('billing.protect_issued_invoice()','51a4c6cffb6620b8c75db696b557c38246a6678370e0635966a6a3d781da4999','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, billing']::text[],66),
('governance.protect_closed_vote()','3f048e672acd691d16b4cc0eabb0fc5c3e30eeae6a1aacf2cedc6f5dc02a9597','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, governance']::text[],67),
('governance.protect_vote_option()','0ae3ec113bbb35e3ed8e713c3da4853ee378ab30bb27583e4760bda4f0a13f8b','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, governance']::text[],68),
('app_private.current_platform_user_id()','89d71858a02a69e1cd0b40845476e706c8d37b210f371325e6bf15150eb4ce4b','postgres',true,'sql','s',false,array['search_path=pg_catalog, platform']::text[],69),
('app_private.has_platform_role(platform.platform_role_type)','9d9f49960d8b4ac23584e7d013fe823c2fe2d3062138c4b4001b62bb7972941e','postgres',true,'sql','s',false,array['search_path=pg_catalog, platform']::text[],70),
('app_private.is_platform_user()','4c5c51aae879070a353e1dc267977b0e380835c9f6092aefee5a164483882ec6','postgres',true,'sql','s',false,array['search_path=pg_catalog, platform']::text[],71),
('app_private.has_platform_access_for_routing()','fcc4323468699e770c0cf6a0e2b5745cf5d02db9f84db954b448325e1d3a3639','postgres',true,'sql','s',false,array['search_path=pg_catalog, platform']::text[],72),
('customer_api.has_platform_access_v1()','c0d07f09d70b15d0818ca7a60f5dfc2e3f3e9d1b14b3d410c9cf70ce2ed890b1','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],73),
('platform.my_customer_mfa_requirement()','8d21e2a72d5fd35346a7aec4ba89440d67295bdc83668e9f8f71a5619abfc223','postgres',true,'plpgsql','s',false,array['search_path=""']::text[],74),
('platform.list_my_customer_contexts()','d1ef0500c77700a0378a14302da47b0b1013986b16107edade2b2bd9243bebcd','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, platform, identity, portfolio']::text[],75),
('platform.get_customer_dashboard(uuid)','3c497392a5c0d42f265d3ec02e6e394f9d1597e8405fc205cb788eed7a670af5','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, platform, identity, portfolio, maintenance, billing, communications, occupancy']::text[],76),
('customer_api.get_dashboard_v1(uuid)','7f6f9129f3d780e116a8e099b9ec7d09011bb26dd914605fe626314203ad87b7','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],77),
('customer_api.list_contexts_v1()','f351518c6938db6cd7ada9816f5df9af7e4694e06122dbeba2e4558e104ea04b','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],78),
('customer_api.my_mfa_requirement_v1()','5af92a7879fa189c87c52a32d9085e4014b4b057398e522e1ebd9cddfb26c117','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],79),
('app_private.can_access_channel(uuid)','e5b36d81cf301c02aa6f3ca34820f875a1385991e39b0db0804b1df84113d0ae','postgres',true,'sql','s',false,array['search_path=pg_catalog, communications']::text[],80),
('communications.enforce_poll_response()','2ea18916a626bd9bc12d3dbdaab4b53e3060afb7e6e28770525d5eca4f868295','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, communications']::text[],81),
('customer_api.list_my_unit_invitations_v1()','f3e2d05926fdd5d00667195ed2dd406f68d41921f3aefe6575c7929905382469','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],82),
('app_private.has_multi_unit_owner_role_v1()','840935b40bf316d8d74d41f4154879a4a29ca5cd07feada80f1f04f19e0f204d','postgres',true,'sql','s',false,array['search_path=pg_catalog, identity, auth']::text[],83),
('customer_api.my_multi_unit_owner_access_v1()','52b56865ca561558614efb449bd4546adfbe213b4e85c2d2f533a208e76bd985','postgres',false,'sql','s',false,array['search_path=pg_catalog']::text[],84)), expected as (
 select distinct on(to_regprocedure(signature)) * from source order by to_regprocedure(signature),ordinal desc
 ) select 1 from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature) left join pg_language l on l.oid=p.prolang
 where p.oid is null or p.prokind<>'f' or p.proowner<>to_regrole(e.owner_name) or p.prosecdef is distinct from e.secdef
 or p.provolatile::text is distinct from e.volatility or p.proisstrict is distinct from e.is_strict
 or l.lanname is distinct from e.language_name or p.proconfig is distinct from e.config
 or encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') is distinct from e.body_hash) then
 raise exception 'operations_routine_catalog_identity_mismatch' using errcode='55000';end if;
 if to_regclass('app_private.canonical_authority_revision_v1') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.asset_categories') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.asset_components') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.asset_documents') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.asset_history') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.asset_warranties') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.assets') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('audit.events') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('billing.invoice_lines') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('billing.invoices') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('billing.receivables') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.channel_members') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.channels') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.comments') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.notification_preferences') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.notifications') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.poll_options') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.poll_responses') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.polls') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.posts') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.reactions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('communications.unit_invitations') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('documents.access_events') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('documents.document_links') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('documents.document_versions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('documents.documents') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('documents.folders') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('documents.legal_records') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('documents.retention_policies') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.accounting_periods') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.accounts') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.allocation_inputs') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.allocation_items') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.allocation_rules') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.allocation_runs') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.charge_categories') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.journal_entries') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('finance.journals') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.agenda_items') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.attendance') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.ballots') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.eligibility_snapshots') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.meetings') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.minutes') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.resolutions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.vote_options') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('governance.votes') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('identity.context_grants') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('identity.membership_parties') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('identity.memberships') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('identity.permissions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('identity.profiles') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('identity.role_permissions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('identity.roles') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.attachments') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.maintenance_plans') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.purchase_orders') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.sla_measurements') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.ticket_work_orders') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.tickets') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.vendor_contracts') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.vendor_quotes') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.vendors') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.work_order_assignments') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.work_order_checklist_items') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.work_order_costs') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.work_order_events') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.work_orders') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('occupancy.leases') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('payments.bank_accounts') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('payments.bank_transactions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('payments.import_batches') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('payments.payments') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('payments.reconciliation_matches') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.customer_workspaces') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.idempotency_keys') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.jurisdiction_profiles') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.module_definitions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.module_operating_model_compatibilities') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.module_permission_bindings') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.module_property_profile_compatibilities') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.operating_models') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.outbox_events') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.platform_role_assignments') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.platform_users') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.property_jurisdiction_assignments') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.property_operating_model_compatibilities') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.property_profiles') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.property_space_kind_compatibilities') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.space_kinds') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.subscription_plans') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.tenants') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_access_bases') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_contracts') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_delegation_permissions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_delegations') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_entitlements') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_member_role_authority_sources') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_member_roles') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_modules') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_role_handover_lineage') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_role_idempotency') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_role_modules') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_role_permissions') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_roles') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('platform.workspace_taxonomy_assignments') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('portfolio.addresses') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('portfolio.buildings') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('portfolio.entrances') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('portfolio.ownerships') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('portfolio.parties') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('portfolio.properties') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('portfolio.units') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('security_access.access_points') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('utilities.consumption_periods') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('utilities.meter_readings') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('utilities.meters') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('identity.scope_type')) is distinct from array['tenant','property','building','unit']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('platform.decision_effect')) is distinct from array['allow','deny']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('platform.record_status')) is distinct from array['draft','active','suspended','archived']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('platform.workspace_type')) is distinct from array['ASSOCIATION','PROPERTY_MANAGER','OWNER_PORTFOLIO','HYBRID']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('platform.workspace_lifecycle_status')) is distinct from array['LEAD','UNDER_REVIEW','APPROVED','CONTRACT_PENDING','PAYMENT_PENDING','PROVISIONING','ACTIVE','PAST_DUE','SUSPENDED','TERMINATED','ARCHIVED']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('platform.workspace_environment')) is distinct from array['PILOT','PRODUCTION']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('portfolio.property_type')) is distinct from array['condominium','residential_complex','villa','gated_community','mixed_residential']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('identity.membership_status')) is distinct from array['invited','active','suspended','expired','revoked']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('portfolio.unit_status')) is distinct from array['active','inactive','combined','archived']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('finance.accounting_period_status')) is distinct from array['open','closed']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('finance.journal_status')) is distinct from array['draft','posted','reversed']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('finance.entry_side')) is distinct from array['debit','credit']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('finance.account_type')) is distinct from array['asset','liability','equity','income','expense']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('portfolio.party_type')) is distinct from array['person','company','association','public_body']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('platform.property_jurisdiction_assignment_status')) is distinct from array['draft','active','superseded','archived']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('platform.jurisdiction_profile_status')) is distinct from array['draft','validated','active','suspended','retired']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('utilities.service_type')) is distinct from array['water','electricity','gas','heat','sewer','waste','internet','telephone','other']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('utilities.meter_scope')) is distinct from array['property','building','unit','common_area','submeter']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('utilities.reading_method')) is distinct from array['manual','photo_ocr','bulk_import','iot','provider']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('utilities.reading_status')) is distinct from array['captured','validated','rejected','superseded']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('security_access.access_point_type')) is distinct from array['entrance','door','gate']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('assets.asset_scope')) is distinct from array['property','building','unit','common_area']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('assets.asset_condition')) is distinct from array['unknown','good','fair','poor','critical','retired']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('maintenance.priority')) is distinct from array['low','normal','high','urgent','emergency']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('maintenance.work_order_status')) is distinct from array['draft','scheduled','assigned','in_progress','blocked','completed','verified','cancelled']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('maintenance.plan_trigger')) is distinct from array['calendar','meter','condition','manual']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('maintenance.vendor_status')) is distinct from array['candidate','approved','suspended','blocked']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('maintenance.procurement_status')) is distinct from array['draft','requested','approved','ordered','received','cancelled']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('maintenance.ticket_status')) is distinct from array['open','triaged','planned','in_progress','resolved','closed','reopened','cancelled']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('documents.classification')) is distinct from array['public','internal','confidential','restricted']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('finance.allocation_method')) is distinct from array['meter_consumption','cpi','per_person','surface_m2','direct','fixed']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('finance.run_status')) is distinct from array['draft','calculated','approved','posted','cancelled']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('billing.invoice_status')) is distinct from array['draft','issued','partially_paid','paid','void','credited']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('payments.transaction_direction')) is distinct from array['credit','debit']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('payments.match_status')) is distinct from array['unmatched','suggested','confirmed','rejected']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('payments.payment_status')) is distinct from array['pending','settled','failed','refunded']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('governance.meeting_status')) is distinct from array['draft','announced','open','adjourned','closed','cancelled']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('governance.vote_status')) is distinct from array['draft','open','closed','cancelled']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('platform.platform_role_type')) is distinct from array['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_SUPPORT','PLATFORM_AUDITOR']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('communications.channel_scope')) is distinct from array['tenant','property','building','unit','direct']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid=to_regtype('communications.post_status')) is distinct from array['draft','published','archived','removed']::text[] then raise exception 'operations_enum_order_mismatch' using errcode='55000';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and p.oid not in (select to_regprocedure(x) from unnest(array['app_private.require_building_session_current_v1()','app_private.set_updated_at()','finance.protect_accounting_period()','finance.assert_accounting_period_no_overlap()','finance.assert_accounting_period_property_tenant()','app_private.guard_taxonomy_version_effective_period_v1()','app_private.guard_taxonomy_record_immutability_v1()','app_private.guard_workspace_taxonomy_assignment_history_v1()','app_private.guard_workspace_property_binding_history_v1()','app_private.guard_workspace_property_binding_v1()','app_private.guard_workspace_taxonomy_assignment_v1()','app_private.bootstrap_role_taxonomy_permissions_v1()','app_private.bootstrap_role_module_permissions_v1()','app_private.guard_module_definition_immutability_v1()','app_private.guard_module_definition_effective_period_v1()','app_private.guard_workspace_module_code_sync_v1()','app_private.guard_workspace_module_immutability_v1()','app_private.bootstrap_role_workspace_role_permissions_v1()','app_private.guard_module_permission_binding_invariants_v1()','app_private.guard_workspace_role_immutability_v1()','app_private.guard_workspace_role_module_draft_only_v1()','app_private.guard_workspace_role_permission_bindings_v1()','app_private.guard_workspace_member_role_invariants_v1()','app_private.bootstrap_role_workspace_delegation_permissions_v1()','platform.cap_customer_membership_to_access_basis()','platform.cap_customer_context_to_membership()','platform.require_workspace_access_basis_for_provisioning()','app_private.guard_undefined_primary_role_v1()','app_private.guard_workspace_role_authority_source_immutable_v1()','app_private.guard_authority_revision_v1()','app_private.bump_canonical_authority_revision_v1()','app_private.guard_jurisdiction_bound_property_address_v1()','app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)','platform.assert_workspace_activation_ready(uuid)','app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)','app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','app_private.customer_mfa_required()','platform.enforce_workspace_activation_gate()','app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)','app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])','app_private.guard_workspace_member_role_authority_v2()','app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)','app_private.resolve_workspace_native_context_v2(uuid,uuid)','app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)','app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)','app_private.jwt_uuid(text)','app_private.active_tenant_id()','app_private.active_context_id()','app_private.is_service_role()','app_private.is_active_member(uuid)','app_private.active_membership_id()','app_private.can_access_property(uuid)','app_private.can_access_building(uuid)','app_private.can_access_unit(uuid)','app_private.can_access_utility_scope(uuid,uuid,uuid)','utilities.protect_validated_reading()','app_private.can_access_asset_scope(uuid,uuid,uuid)','maintenance.enforce_work_order_transition()','maintenance.protect_purchase_order()','documents.protect_document_version()','app_private.check_direct_effective_permission_v1(uuid,uuid,text,text,text,uuid)','app_private.check_effective_permission_v1(uuid,text,text,text,uuid)','finance.assert_allocation_balanced(uuid)','finance.protect_allocation_run()','billing.protect_issued_invoice()','governance.protect_closed_vote()','governance.protect_vote_option()','app_private.current_platform_user_id()','app_private.has_platform_role(platform.platform_role_type)','app_private.is_platform_user()','app_private.has_platform_access_for_routing()','customer_api.has_platform_access_v1()','platform.my_customer_mfa_requirement()','platform.list_my_customer_contexts()','platform.get_customer_dashboard(uuid)','customer_api.get_dashboard_v1(uuid)','customer_api.list_contexts_v1()','customer_api.my_mfa_requirement_v1()','app_private.can_access_channel(uuid)','communications.enforce_poll_response()','customer_api.list_my_unit_invitations_v1()','app_private.has_multi_unit_owner_role_v1()','customer_api.my_multi_unit_owner_access_v1()']) x where to_regprocedure(x) is not null)) then raise exception 'operations_unexpected_routine_effect' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and c.relkind in ('r','p') and c.oid not in (select to_regclass(x) from unnest(array['app_private.canonical_authority_revision_v1','assets.asset_categories','assets.asset_components','assets.asset_documents','assets.asset_history','assets.asset_warranties','assets.assets','audit.events','billing.invoice_lines','billing.invoices','billing.receivables','communications.channel_members','communications.channels','communications.comments','communications.notification_preferences','communications.notifications','communications.poll_options','communications.poll_responses','communications.polls','communications.posts','communications.reactions','communications.unit_invitations','documents.access_events','documents.document_links','documents.document_versions','documents.documents','documents.folders','documents.legal_records','documents.retention_policies','finance.accounting_periods','finance.accounts','finance.allocation_inputs','finance.allocation_items','finance.allocation_rules','finance.allocation_runs','finance.charge_categories','finance.journal_entries','finance.journals','governance.agenda_items','governance.attendance','governance.ballots','governance.eligibility_snapshots','governance.meetings','governance.minutes','governance.resolutions','governance.vote_options','governance.votes','identity.context_grants','identity.membership_parties','identity.memberships','identity.permissions','identity.profiles','identity.role_permissions','identity.roles','maintenance.attachments','maintenance.maintenance_plans','maintenance.purchase_orders','maintenance.sla_measurements','maintenance.ticket_work_orders','maintenance.tickets','maintenance.vendor_contracts','maintenance.vendor_quotes','maintenance.vendors','maintenance.work_order_assignments','maintenance.work_order_checklist_items','maintenance.work_order_costs','maintenance.work_order_events','maintenance.work_orders','occupancy.leases','payments.bank_accounts','payments.bank_transactions','payments.import_batches','payments.payments','payments.reconciliation_matches','platform.customer_workspaces','platform.idempotency_keys','platform.jurisdiction_profiles','platform.module_definitions','platform.module_operating_model_compatibilities','platform.module_permission_bindings','platform.module_property_profile_compatibilities','platform.operating_models','platform.outbox_events','platform.platform_role_assignments','platform.platform_users','platform.property_jurisdiction_assignments','platform.property_operating_model_compatibilities','platform.property_profiles','platform.property_space_kind_compatibilities','platform.space_kinds','platform.subscription_plans','platform.tenants','platform.workspace_access_bases','platform.workspace_contracts','platform.workspace_delegation_permissions','platform.workspace_delegations','platform.workspace_entitlements','platform.workspace_member_role_authority_sources','platform.workspace_member_roles','platform.workspace_modules','platform.workspace_role_handover_lineage','platform.workspace_role_idempotency','platform.workspace_role_modules','platform.workspace_role_permissions','platform.workspace_roles','platform.workspace_taxonomy_assignments','portfolio.addresses','portfolio.buildings','portfolio.entrances','portfolio.ownerships','portfolio.parties','portfolio.properties','portfolio.units','security_access.access_points','utilities.consumption_periods','utilities.meter_readings','utilities.meters']) x where to_regclass(x) is not null)) then raise exception 'operations_unexpected_table_effect' using errcode='55000';end if;
 if exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and t.typtype='e' and t.oid not in (select to_regtype(x) from unnest(array['assets.asset_condition','assets.asset_scope','billing.invoice_status','communications.channel_scope','communications.post_status','documents.classification','finance.account_type','finance.accounting_period_status','finance.allocation_method','finance.entry_side','finance.journal_status','finance.run_status','governance.meeting_status','governance.vote_status','identity.membership_status','identity.scope_type','maintenance.plan_trigger','maintenance.priority','maintenance.procurement_status','maintenance.ticket_status','maintenance.vendor_status','maintenance.work_order_status','payments.match_status','payments.payment_status','payments.transaction_direction','platform.decision_effect','platform.jurisdiction_profile_status','platform.platform_role_type','platform.property_jurisdiction_assignment_status','platform.record_status','platform.workspace_environment','platform.workspace_lifecycle_status','platform.workspace_type','portfolio.party_type','portfolio.property_type','portfolio.unit_status','security_access.access_point_type','utilities.meter_scope','utilities.reading_method','utilities.reading_status','utilities.service_type']) x where to_regtype(x) is not null)) then raise exception 'operations_unexpected_enum_effect' using errcode='55000';end if;
end; $source_catalog$;

-- Full poststate receipt is observable before commit, but does not by itself prove COMMIT.
select set_config('cladora.install.catalog_after',(with recursive
 namespaces as (select * from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')),
 roots as (select c.* from pg_class c where c.relnamespace in (select oid from namespaces)),
 relids(oid) as (select oid from roots union select c.reltoastrelid from roots c where c.reltoastrelid<>0
  union select i.indexrelid from pg_index i where i.indrelid in (select reltoastrelid from roots where reltoastrelid<>0)),
 constraints as (select c.* from pg_constraint c where c.conrelid in (select oid from relids) or c.contypid in (select oid from pg_type where typnamespace in (select oid from namespaces))),
 triggers as (select t.* from pg_trigger t where t.tgrelid in (select oid from relids) or t.tgconstraint in (select oid from constraints)),
 types as (select t.* from pg_type t where t.typnamespace in (select oid from namespaces) or t.typrelid in (select oid from relids)),
 objects(classid,objid) as (
 select 'pg_namespace'::regclass,oid from namespaces union select 'pg_class'::regclass,oid from relids
 union select 'pg_type'::regclass,oid from types union select 'pg_constraint'::regclass,oid from constraints
 union select 'pg_trigger'::regclass,oid from triggers
 union select 'pg_proc'::regclass,oid from pg_proc where pronamespace in (select oid from namespaces)
 union select 'pg_policy'::regclass,oid from pg_policy where polrelid in (select oid from relids)
 union select 'pg_attrdef'::regclass,oid from pg_attrdef where adrelid in (select oid from relids)
 union select 'pg_rewrite'::regclass,oid from pg_rewrite where ev_class in (select oid from relids))
select jsonb_build_object(
 'format','operations-install-catalog-observation.v1',
 'classification','same-database raw catalog; OIDs retained; NOT cross-database normalization/equivalence',
 'namespaces',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from namespaces n),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c where c.oid in (select oid from relids)),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'default_expression',pg_get_expr(d.adbin,d.adrelid)) order by a.attrelid,a.attnum),'[]') from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid in (select oid from relids) and a.attnum>0),
 'constraints',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('definition',pg_get_constraintdef(c.oid,true)) order by c.oid),'[]') from constraints c),
 'indexes',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'predicate',pg_get_expr(i.indpred,i.indrelid),'expressions',pg_get_expr(i.indexprs,i.indrelid)) order by i.indexrelid),'[]') from pg_index i where i.indexrelid in (select oid from relids)),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('using',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.oid),'[]') from pg_policy p where p.polrelid in (select oid from relids)),
 'triggers_both_FK_sides',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_get_triggerdef(t.oid,true)) order by t.oid),'[]') from triggers t),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from types t),
 'enum_order',(select coalesce(jsonb_agg(to_jsonb(e) order by e.enumtypid,e.enumsortorder),'[]') from pg_enum e where e.enumtypid in (select oid from types)),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('identity',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid)) order by p.oid),'[]') from pg_proc p where p.pronamespace in (select oid from namespaces)),
 'sequences',(select coalesce(jsonb_agg(to_jsonb(s) order by s.seqrelid),'[]') from pg_sequence s where s.seqrelid in (select oid from relids)),
 'rewrite',(select coalesce(jsonb_agg(to_jsonb(r) order by r.oid),'[]') from pg_rewrite r where r.ev_class in (select oid from relids)),
 'dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]') from pg_depend d where exists(select 1 from objects o where (o.classid=d.classid and o.objid=d.objid) or (o.classid=d.refclassid and o.objid=d.refobjid))),
 'shared_dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.deptype),'[]') from pg_shdepend d where d.dbid=(select oid from pg_database where datname=current_database()) and exists(select 1 from objects o where o.classid=d.classid and o.objid=d.objid)),
 'role_graph',(select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]') from pg_auth_members m),
 'role_attributes',(select coalesce(jsonb_agg(to_jsonb(r)-'rolpassword' order by r.oid),'[]') from pg_roles r where r.rolname in ('postgres','cladora_rpc_owner','cladora_building_fixture_ops')),
 'default_acl',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)) )::text,true);
do $managed_complete$
declare before_catalog jsonb:=current_setting('cladora.install.managed_complete')::jsonb; after_catalog jsonb; tr jsonb;
begin
 after_catalog:=(select jsonb_build_object(
 'schemas',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from pg_namespace n where nspname in ('auth','extensions','public')),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')))
);
 if before_catalog-'triggers' is distinct from after_catalog-'triggers' then raise exception 'operations_managed_complete_delta' using errcode='55000';end if;
 for tr in select value from jsonb_array_elements(before_catalog->'triggers') loop
  if not (after_catalog->'triggers') @> jsonb_build_array(tr) then raise exception 'operations_managed_trigger_changed' using errcode='55000';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(after_catalog->'triggers') t where not (before_catalog->'triggers') @> jsonb_build_array(t.value)
 and not exists(select 1 from pg_trigger x join pg_constraint f on f.oid=x.tgconstraint join pg_class r on r.oid=f.conrelid join pg_namespace n on n.oid=r.relnamespace
 where x.oid=(t.value->>'oid')::oid and x.tgisinternal and x.tgrelid='auth.users'::regclass and f.contype='f' and f.confrelid='auth.users'::regclass
 and f.confkey=array[(select attnum from pg_attribute where attrelid='auth.users'::regclass and attname='id')]::smallint[] and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications'))) then
 raise exception 'operations_unmapped_managed_trigger' using errcode='55000';end if;
end; $managed_complete$;
select jsonb_build_object('unit',current_setting('cladora.install.unit'),'transaction_id',pg_current_xact_id()::text,
 'source_contract','operations-inactive-install.v1','prestate_sha256',current_setting('cladora.install.prestate_sha256'),
 'poststate_sha256',encode(extensions.digest(convert_to(current_setting('cladora.install.catalog_after'),'UTF8'),'sha256'),'hex'),
 'poststate',current_setting('cladora.install.catalog_after')::jsonb,'commit_acknowledged',false,'runtime_active',false) as operations_install_precommit_receipt;

commit;
-- A successful response is an acknowledgement of this unit only, never product acceptance.
