/** Operator-only local composition writer; no secret output, no provider-role
 * changes, no repeated init/bootstrap/users or broad application privilege.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const p='/workspace/private/cladora-functional-dev-v1',path=p+'/core15/service-runtime-binding.json';assert.equal(existsSync(path),false,'existing private binding STOP');
const read=x=>JSON.parse(readFileSync(p+'/'+x));
assert.equal(read('core15/service-domain-v1/runtime-access-committed.json').state,'COMMIT_AND_RFQ_I');
// Private configuration is not acceptance; native proofs follow actual install.
const observed=JSON.parse(execFileSync('python3',['-I','-B','-c',`import importlib.util,json,subprocess
from pathlib import Path
p=Path('/workspace/work/platform12-core15-input-794f5a1');ref='794f5a12c3928ae0a3585ab679a3cbe60aab49a3'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=p,text=True).strip()==ref
for n in ['stack.py','profile.json','bootstrap.sql','provider-compatibility.sql','gateway.conf']:
 f='scripts/functional-dev-stack-v1/'+n;assert (p/f).read_bytes()==subprocess.check_output(['git','show',ref+':'+f],cwd=p)
s=importlib.util.spec_from_file_location('p12',p/'scripts/functional-dev-stack-v1/stack.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
_,d=m.state();m.cid('pg');m.gateway_process();key='core15-dev:'+d['instance'];assert len(d['instance'])==32 and all(c in '0123456789abcdef' for c in d['instance'])
old=m.sql(b"SELECT coalesce(obj_description('core_runtime'::regnamespace::oid,'pg_namespace'),'');").decode().strip()
assert old in ('',key),'DIFFERENT_BACKEND_MARKER_STOP'
if old=='':
 m.write(m.PRIVATE/'core15/backend-marker-dispatch.json',{'state':'DISPATCHED_NO_BLIND_RETRY','platform':ref})
 sql=("BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s'; COMMENT ON SCHEMA core_runtime IS '"+key+"'; COMMIT;").encode();m.sql(sql)
new=m.sql(b"SELECT json_build_object('marker',obj_description('core_runtime'::regnamespace::oid,'pg_namespace'),'database_oid',(SELECT oid::int FROM pg_database WHERE datname=current_database()),'schema_owner',(SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='core_runtime'));")
v=json.loads(new);assert v['marker']==key and v['schema_owner']=='cladora_core_session_owner'
m.write(m.PRIVATE/'core15/backend-marker-observation.json',{'state':'INDEPENDENT_CATALOG_OBSERVED','platform':ref,'marker':key,'database_oid':v['database_oid']})
print(json.dumps(v))`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const secret=read('core15/runtime-secret.json');assert.equal(secret.role,'cladora_core_runtime');
const value={contract:'core15-owned-service-private-binding.v1',platform:'794f5a12c3928ae0a3585ab679a3cbe60aab49a3',target:{contract:'core-functional-development-target.v1',backend_id:observed.marker,purpose:'owned-isolated-persistent-development',host:'127.0.0.1',port:55422,database_name:'postgres',database_oid:observed.database_oid,runtime_role:'cladora_core_runtime',auth_origin:'http://127.0.0.1:55421'},password:secret.password};
writeFileSync(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});
const hash=createHash('sha256').update(readFileSync(path)).digest('hex');
writeFileSync(p+'/core15/private-binding-identity.json',JSON.stringify({path,sha256:hash,bytes:readFileSync(path).length,kind:'private secret-bearing app config; NEVER publish'})+'\n',{mode:0o600});
console.log(JSON.stringify({private_configuration:'CREATED_WITH_ACTUAL_OWNER_PROTECTED_DB_MARKER',password_or_backend_identity_output:false,application_binding:'NOT_YET_EXERCISED_IN_NEXT'}));
