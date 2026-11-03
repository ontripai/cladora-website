/** Minimal workspace-wide Service closure, without Maintenance/Building or history replay. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const domainUnits=Object.freeze([
 ['catalog','supabase/migrations/20261003200211_20261003141918_service_catalog_persistence_v1.sql'],
 ['module-registry','supabase/migrations/20260917120000_workspace_dynamic_composition.sql'],
 ['request','supabase/migrations/20261004182557_20261004181358_service_request_persistence_v1.sql'],
 ['service-v14','supabase/hosted-service-v14-execution/forward.sql'],
 ['subject-validity','supabase/migrations/20260829005200_customer_occupancy_parties_ownership_lease_registry.sql'],
 ['request-version','supabase/migrations/20261013062342_service_request_subject_context_v1.sql'],
 ['s01-store','supabase/install/core-functional-runtime-v1/01-s01-store.sql'],
 ['canonical-sqlstate','supabase/install/core-functional-runtime-v1/03-canonical-sqlstate.sql'],
 ['session-authority-delegation','supabase/install/core-functional-runtime-v1/service-native-v3/06-session-authority-delegation.sql'],
 ['owner-execute-bindings','supabase/install/core-functional-runtime-v1/service-native-v3/08-owner-execute-bindings.sql'],
 ['runtime-access','supabase/install/core-functional-runtime-v1/service-native-v3/07-runtime-access.sql'],
]);
const root=new URL('../',import.meta.url),sha=s=>createHash('sha256').update(s).digest('hex');
export const preamble=`
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $core15_domain_admit$ BEGIN
 IF current_user<>'cladora_core_installer' OR session_user<>current_user OR current_database()<>'postgres'
  OR current_setting('server_version_num')::integer<>170011
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
  OR to_regnamespace('platform') IS NULL
 THEN RAISE EXCEPTION 'core15_domain_principal_mismatch' USING ERRCODE='55000';END IF;
END $core15_domain_admit$;
CREATE TEMP TABLE core15_domain_procs ON COMMIT DROP AS SELECT oid FROM pg_proc;
CREATE TEMP TABLE core15_domain_tables ON COMMIT DROP AS SELECT oid FROM pg_class;
CREATE TEMP TABLE core15_domain_schemas ON COMMIT DROP AS SELECT oid FROM pg_namespace;
CREATE TEMP TABLE core15_domain_defaults ON COMMIT DROP AS TABLE pg_default_acl;
`;
export const closure=`
DO $core15_domain_close$
DECLARE r record;
BEGIN
 FOR r IN SELECT p.oid,p.proowner,p.oid::regprocedure signature,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.oid NOT IN (SELECT oid FROM core15_domain_procs) LOOP
  IF r.nspname NOT IN ('app_private','customer_api','service_catalog') OR r.proowner<>current_user::regrole
   THEN RAISE EXCEPTION 'core15_domain_unexpected_function' USING ERRCODE='55000';END IF;
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.signature);
 END LOOP;
 FOR r IN SELECT c.oid,c.relowner,c.relkind,c.oid::regclass relation,n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.oid NOT IN (SELECT oid FROM core15_domain_tables) AND n.nspname NOT LIKE 'pg_%' LOOP
  IF r.nspname NOT IN ('platform','portfolio','service_catalog') OR r.relowner<>current_user::regrole
   THEN RAISE EXCEPTION 'core15_domain_unexpected_relation' USING ERRCODE='55000';END IF;
  IF r.relkind IN ('r','p','v','m','f') THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC,anon,authenticated,service_role',r.relation);
  ELSIF r.relkind='S' THEN EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC,anon,authenticated,service_role',r.relation);END IF;
 END LOOP;
 FOR r IN SELECT oid,nspname FROM pg_namespace WHERE oid NOT IN (SELECT oid FROM core15_domain_schemas) AND nspname NOT LIKE 'pg_%' LOOP
  IF r.nspname<>'service_catalog' THEN RAISE EXCEPTION 'core15_domain_unexpected_namespace' USING ERRCODE='55000';END IF;
  EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC,anon,authenticated,service_role',r.nspname);
 END LOOP;
 IF EXISTS((TABLE pg_default_acl EXCEPT TABLE core15_domain_defaults) UNION ALL (TABLE core15_domain_defaults EXCEPT TABLE pg_default_acl))
  OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid NOT IN (SELECT oid FROM core15_domain_procs) AND a.grantee<>p.proowner)
 THEN RAISE EXCEPTION 'core15_domain_acl_or_default_delta' USING ERRCODE='55000';END IF;
END $core15_domain_close$;
`;
export function deriveDomainUnitV1(source,id){
 assert.ok(domainUnits.some(x=>x[0]===id));
 if(id==='subject-validity')assert.equal(sha(source),'1b78c4f78f1ee9d5aae4a8d8001d1056a6c97b4d642d26165f754680e9c38b56');
 if(id==='request-version')assert.equal(sha(source),'c8555ccaacd3964c7667d82bcbe904619fdda697a2e37f44870242c8cbc58e04');
 if(['session-authority-delegation','owner-execute-bindings','runtime-access'].includes(id))return source; // Fixed lane; NEVER implicit role rewrite or runtime-grant closure.
 if(id==='subject-validity'){
  const selected=['valid_from','valid_until'].map(c=>{const re=new RegExp('^alter table identity\\.membership_parties add column if not exists '+c+'[^;]+;','m');const match=source.match(re);assert.ok(match);return match[0].replace(' if not exists','');});
  const constraint=source.match(/^alter table identity\.membership_parties add constraint membership_parties_valid_period[^;]+;/m);assert.ok(constraint);
  return 'BEGIN;\n'+preamble+`DO $subject_pre$ BEGIN
   IF EXISTS(SELECT 1 FROM identity.membership_parties)
    OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='identity.membership_parties'::regclass AND attname IN ('valid_from','valid_until') AND NOT attisdropped)
    OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='identity.membership_parties'::regclass AND conname='membership_parties_valid_period')
   THEN RAISE EXCEPTION 'core15_subject_validity_prestate' USING ERRCODE='55000';END IF;
   END $subject_pre$;\n`+selected.join('\n')+'\n'+constraint[0]+'\n'+closure+'\nCOMMIT;\n';
 }
 if(id==='module-registry'){
  assert.equal(sha(source),'5d96ea037185f6a4b302455cd060ff598cac6435d05ce97e89d2e6c9d41189a6');
  const a=source.indexOf('create table platform.module_dependencies ('),b=source.indexOf('-- 4. Relational Module Incompatibilities Table',a);
  const c=source.indexOf('create or replace function app_private.guard_module_dependency_dag_v1()'),d=source.indexOf('-- 9.4 Workspace Module Code',c);
  assert.ok(a>0&&b>a&&c>b&&d>c);
  // Exact canonical table/index/DAG trigger family; not a fabricated registry.
  return 'BEGIN;\n'+preamble+source.slice(a,b)+source.slice(c,d)
   +'\nALTER TABLE platform.module_dependencies ENABLE ROW LEVEL SECURITY;\n'+closure+'\nCOMMIT;\n';
 }
 assert.equal((source.match(/^begin;/gim)??[]).length,1);
 assert.equal((source.match(/^commit;/gim)??[]).length,1);assert.doesNotMatch(source,/ALTER\s+DEFAULT\s+PRIVILEGES/i);
 let adapted=source.replace(/\bpostgres\b/g,'cladora_core_installer');
 if(id==='canonical-sqlstate'){
  const old="current_database()!~'^cladora_dev_[a-z0-9_]+$'";assert.equal(adapted.split(old).length,2);
  adapted=adapted.replace(old,()=>"current_database()<>'postgres'");
  // Native observation: all eight exact bodies match, but THREE canonical
  // legacy functions have distinct pinned search_path lists. Preserve them;
  // do not require a false universal catalog image or change function headers.
  const config="OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]";
  assert.equal(adapted.split(config).length,2);
  adapted=adapted.replace(config,()=>`OR p.proconfig IS DISTINCT FROM (CASE t.signature
   WHEN 'app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)' THEN ARRAY['search_path=pg_catalog, identity, portfolio, app_private']::text[]
   WHEN 'app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])' THEN ARRAY['search_path=pg_catalog, platform, identity, portfolio, app_private']::text[]
   WHEN 'app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)' THEN ARRAY['search_path=pg_catalog, platform, identity, portfolio, app_private']::text[]
   ELSE ARRAY['search_path=pg_catalog']::text[] END)`);
 }
 const output=adapted.replace(/^begin;/im,()=>`BEGIN;\n${preamble}`).replace(/^commit;/im,()=>closure+'\nCOMMIT;');
 assert.equal(output.replace('BEGIN;\n'+preamble,'begin;').replace(closure+'\nCOMMIT;','commit;').toLowerCase(),adapted.toLowerCase());
 return output;
}
if(process.argv[1]?.endsWith('/prepare-core15-service-domain-v1.mjs')){
 const initial=JSON.parse(readFileSync(new URL('supabase/install/core-functional-runtime-v1/manifest.json',root)));
 const units=domainUnits.map(([id,path],i)=>{const source=readFileSync(new URL(path,root),'utf8');const pin=initial.units.find(x=>x.path===path);
  if(!['session-authority-delegation','owner-execute-bindings','runtime-access','subject-validity','request-version'].includes(id))assert.equal(sha(source),id==='module-registry'?'5d96ea037185f6a4b302455cd060ff598cac6435d05ce97e89d2e6c9d41189a6':pin.sha256);
  const payload=deriveDomainUnitV1(source,id);return{id,path,order:i+1,source_sha256:sha(source),source_bytes:Buffer.byteLength(source),payload_sha256:sha(payload),payload_bytes:Buffer.byteLength(payload)};});
 const m={contract:'core15-service-domain-install.v1',parent:'a0a37f3c573558d14be2e62ba27e6e5475b9c4fe',required_native:['Core300 foundation via ordinary installer v3'],incidental_native:['assets already committed; not a Service dependency'],excluded_native:{maintenance:'OC1 rejects extra cladora_rpc_owner helper/table ACL; rolled back; not required for workspace-wide Request',building:'no Service prerequisite edge'},scope:'workspace-wide non-reservation resource=null; DW02/Unit not required or enabled',units,status:'PAYLOAD_GENERATION_ONLY; native execution evidence is separate in service-cut manifest'};
 writeFileSync(new URL('supabase/install/core-functional-runtime-v1/service-native-v3/domain-manifest.json',root),JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify({units:units.map(x=>({id:x.id,bytes:x.payload_bytes,sha256:x.payload_sha256})),native:'NOT_RUN'}));
}
