/** Bounded source assertions; NOT a SQL parser, compile proof or admission service. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function inspectStore(source){
 const sql=source.split('\n').map(x=>x.split('--')[0]).join('\n');const failures=[];
 const need=(ok,id)=>{if(!ok)failures.push(id);};
 need(sql.trim().startsWith('BEGIN;')&&sql.trim().endsWith('ROLLBACK;')&&!/\bCOMMIT\s*;/.test(sql),'ROLLBACK_CAPSULE');
 need(!/\b(GRANT|ALTER DEFAULT PRIVILEGES|SECURITY DEFINER|SET ROLE)\b/i.test(sql),'NO_AUTHORITY_WIDENING');
 need(!/CREATE\s+(TABLE|INDEX|SCHEMA)\s+IF NOT EXISTS/i.test(sql),'NO_REPAIR_DDL');
 for(const [id,pattern] of [
  ['PARTY_TENANT_KEY',/ALTER TABLE portfolio\.parties ADD CONSTRAINT core_s01_party_tenant_key_v1 UNIQUE\(id,tenant_id\)/],
  ['WORKSPACE_TENANT_KEY',/ALTER TABLE platform\.customer_workspaces ADD CONSTRAINT core_s01_workspace_tenant_key_v1 UNIQUE\(id,tenant_id\)/],
  ['PARTY_TENANT_FK',/FOREIGN KEY\(provider_party_id,tenant_id\)\s+REFERENCES portfolio\.parties\(id,tenant_id\) ON UPDATE RESTRICT ON DELETE RESTRICT/],
  ['WORKSPACE_TENANT_FK',/FOREIGN KEY\(workspace_id,tenant_id\)\s+REFERENCES platform\.customer_workspaces\(id,tenant_id\) ON UPDATE RESTRICT ON DELETE RESTRICT/],
  ['VERSION_TUPLE_FK',/FOREIGN KEY\(agreement_id,tenant_id,workspace_id,provider_party_id\)\s+REFERENCES platform\.provider_agreement_heads_v1\(id,tenant_id,workspace_id,provider_party_id\)/],
  ['CURRENT_VERSION_FK',/FOREIGN KEY\(id,current_version\) REFERENCES platform\.provider_agreement_versions_v1\(agreement_id,version\)\s+DEFERRABLE INITIALLY DEFERRED/],
  ['VERSION_IMMUTABLE',/IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'core_s01_version_immutable'/],
  ['TRUNCATE_IMMUTABLE',/IF TG_OP IN \('DELETE','TRUNCATE'\) THEN RAISE EXCEPTION 'core_s01_history_immutable'/],
  ['DEFERRED_VERSION_LINK',/CREATE CONSTRAINT TRIGGER core_s01_version_link AFTER INSERT[\s\S]+DEFERRABLE INITIALLY DEFERRED/],
  ['EXPECTED_REVISION',/h\.revision<>p_expected_revision/],
  ['REVISION_BUMP',/SET current_version=next_version,revision=revision\+1/],
  ['HEAD_INVARIANT',/NEW\.revision IS DISTINCT FROM OLD\.revision\+1/],
  ['DEFAULT_EQUALITY',/IF defaults_after IS DISTINCT FROM defaults_before THEN RAISE/],
  ['POSITIVE_DATE_INTERVAL',/CHECK\(valid_until IS NULL OR valid_until>valid_from\)/],
  ['FRESH_SCOPES',/array_ndims\(NEW\.allowed_service_scope\) IS DISTINCT FROM 1/],
 ])need(pattern.test(sql),id);
 for(const table of ['provider_agreement_heads_v1','provider_agreement_versions_v1']){
  need(sql.includes(`ALTER TABLE platform.${table} ENABLE ROW LEVEL SECURITY;`)&&sql.includes(`ALTER TABLE platform.${table} FORCE ROW LEVEL SECURITY;`),'FORCED_RLS_'+table);
  need(sql.includes(`REVOKE ALL ON TABLE platform.${table} FROM PUBLIC,anon,authenticated,service_role;`),'OC1_'+table);
 }
 need((sql.match(/CREATE FUNCTION app_private\./g)||[]).length===4,'FUNCTION_SET');
 need((sql.match(/SECURITY INVOKER SET search_path=pg_catalog/g)||[]).length===4,'INVOKER_PATH_SET');
 need((sql.match(/REVOKE ALL ON FUNCTION app_private\./g)||[]).length===4,'FUNCTION_OC1_SET');
 const writer=sql.split('CREATE FUNCTION app_private.write_core_provider_agreement_v1(')[1]||'';
 const positions=[writer.indexOf('FROM portfolio.parties'),writer.indexOf('FROM platform.customer_workspaces'),writer.indexOf('FROM platform.provider_agreement_heads_v1 WHERE id=p_id FOR UPDATE')];
 need(positions.every(x=>x>=0)&&positions[0]<positions[1]&&positions[1]<positions[2],'WRITER_PARENT_FIRST');
 need(writer.includes('FOR UPDATE')&&sql.includes('core_s01_current_version_missing'),'WRITER_ATOMIC_LINK');
 return{status:failures.length?'BLOCKED':'STATIC_SOURCE_CONSISTENT',failures,sql_compile:'NOT_RUN',execute:false};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const source=readFileSync(resolve(root,'supabase/proposals/core-service-s01/store-v1.sql'),'utf8');
 const result=inspectStore(source);assert.deepEqual(result.failures,[]);
 const mutations=[
  ['REFERENCES portfolio.parties(id,tenant_id)','REFERENCES portfolio.parties(id)','PARTY_TENANT_FK'],
  ['REFERENCES platform.customer_workspaces(id,tenant_id)','REFERENCES platform.customer_workspaces(id)','WORKSPACE_TENANT_FK'],
  ["IF TG_OP<>'INSERT'","IF false",'VERSION_IMMUTABLE'],
  ['FORCE ROW LEVEL SECURITY','ENABLE ROW LEVEL SECURITY','FORCED_RLS_provider_agreement_heads_v1'],
  ['h.revision<>p_expected_revision','false','EXPECTED_REVISION'],
  ['defaults_after IS DISTINCT FROM defaults_before','false','DEFAULT_EQUALITY'],
  ['ROLLBACK;','COMMIT;','ROLLBACK_CAPSULE'],
  ['SECURITY INVOKER','SECURITY DEFINER','NO_AUTHORITY_WIDENING'],
  ['revision=revision+1','revision=revision','REVISION_BUMP'],
 ];
 for(const [a,b,id] of mutations){let changed=source.replaceAll(a,b);if(id==='PARTY_TENANT_FK')changed=changed.replace('FOREIGN KEY(provider_party_id,tenant_id)','FOREIGN KEY(provider_party_id)');if(id==='WORKSPACE_TENANT_FK')changed=changed.replace('FOREIGN KEY(workspace_id,tenant_id)','FOREIGN KEY(workspace_id)');assert.notEqual(createHash('sha256').update(changed).digest('hex'),createHash('sha256').update(source).digest('hex'));assert.ok(inspectStore(changed).failures.includes(id),id);}
 console.log(JSON.stringify({...result,negative_cases:mutations.length}));
}
