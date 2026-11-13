/** Core binder + actual fixed-role adapter. Synthetic CE contract seam, NOT a CE successor/native witness. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const uuid=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const runtimeRole='cladora_ce_guide_runtime',executorRole='cladora_ce_guide_executor';
const target={contract:'core-functional-development-target.v1',backend_id:'core15-dev:'+'b'.repeat(32),purpose:'owned-isolated-persistent-development',host:'127.0.0.1',port:55422,database_name:'postgres',database_oid:1234,runtime_role:runtimeRole,auth_origin:'http://127.0.0.1:55421'};
const CE_SOURCE='6259b70268a851113c8f981e2d346da5428e343f';
const cePaths=new Set(execFileSync('git',['diff','--name-only','bfadc5042cb00841dd605862a2a72ddc0dbafb87',CE_SOURCE],{cwd:root,encoding:'utf8'}).trim().split('\n'));
function environment({actualLegacyCE=false,acceptedCE=false,legacyPool=false}={}){
 const state={origin:target.auth_origin,calls:0,auth:{source:'supabase_verified_session',actor_id:uuid(1),assurance_level:'aal2',expires_at:4102444800,session_id:uuid(2)},pending:null};
 const cache=new Map();function load(name){let p=resolve(root,name);if(!extname(p))p+=existsSync(p+'.ts')?'.ts':'.json';if(cache.has(p))return cache.get(p).exports;
  if(p.endsWith('/supabase/env.ts'))return{getPublicSupabaseEnv:()=>({url:state.origin,publishableKey:'synthetic'})};
  if(p.endsWith('/supabase/server.ts'))return{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:uuid(1)}},error:null}),getClaims:async()=>({data:{claims:{sub:state.auth?.actor_id,session_id:state.auth?.session_id,exp:state.auth?.expires_at,role:'authenticated',aal:state.auth?.assurance_level}},error:null}),getSession:async()=>({data:{session:{user:{id:uuid(1)},expires_at:4102444800}},error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})}}})};
  if(!actualLegacyCE&&!acceptedCE&&p.endsWith('/community/experience-guide-lifecycle-http-v1.ts'))return{authenticateExperienceGuideLifecycleServerSessionV1:async()=>{state.calls++;if(state.pending)return state.pending;return state.auth;}};
  if(p.endsWith('.json'))return JSON.parse(readFileSync(p,'utf8'));
  const m={exports:{}};cache.set(p,m);const relative=p.slice(root.length+1),raw=legacyPool&&relative==='src/lib/core/platform-role-bound-pool-v1.ts'?execFileSync('git',['show','4d15a37797fc9f0d5ef49565606e400e94f88d27:'+relative],{cwd:root,encoding:'utf8'}):acceptedCE&&cePaths.has(relative)?execFileSync('git',['show',CE_SOURCE+':'+relative],{cwd:root,encoding:'utf8'}):readFileSync(p,'utf8');const source=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const req=id=>id==='server-only'?{}:id.startsWith('@/')?load('src/'+id.slice(2)):id.startsWith('.')?load(resolve(dirname(p),id)):require(id);
  new Function('require','module','exports',source)(req,m,m.exports);return m.exports;
 }
 return{state,load};
}
function poolFixture(api){
 const x={checkout:0,releases:[],calls:[],role:runtimeRole,metadata:{},safe:true,fault:null};
 const pool={options:{host:target.host,port:target.port,database:target.database_name,user:runtimeRole,connectionTimeoutMillis:5000,query_timeout:15000},async connect(){x.checkout++;
  return{async query(text,values=[]){x.calls.push({text,values});if(x.fault?.sql===text)throw x.fault.error;
   if(text===api.CORE_GUIDE_IDENTITY_SQL_V1)return{rows:[{current_user:x.role,session_user:runtimeRole,database_name:target.database_name,database_oid:target.database_oid,server_version_num:170011,backend_marker:target.backend_id,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,...x.metadata}],rowCount:1};
   if(text==='reset role')x.role=runtimeRole;if(text===`set role ${executorRole}`)x.role=executorRole;
   if(text==='select current_user::text as current_user,session_user::text as session_user')return{rows:[{current_user:x.role,session_user:runtimeRole}],rowCount:1};
   if(text.includes('ce_guide_role_safety'))return{rows:[{safe:x.safe}],rowCount:1};
   return{command:text.startsWith('begin')?'BEGIN':text==='commit'?'COMMIT':text==='rollback'?'ROLLBACK':'SELECT',rows:[],rowCount:0};
  },release(value){x.releases.push(value);}};
 }};
 return{x,pool};
}
function setup(opts){const e=environment(opts),api=e.load('src/lib/core/guide-request-binding-v1.ts'),f=poolFixture(api),request=new Request('http://localhost:3008/api/customer/v1/experience/guides'),create=(extra={})=>api.createCoreGuideRequestBindingV1({request,runtime_pool:f.pool,target,connection_model:'direct',...extra});return{...e,...f,api,request,create};}
let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
await check('Core composes real fixed-role adapter with strict native-shaped CE seam, not SERVICE',async()=>{
 const s=setup(),b=s.create(),d=b.dependencies;assert.ok(Object.isFrozen(d));const verified=await d.authenticate(s.request);assert.deepEqual(verified,s.state.auth);assert.ok(Object.isFrozen(verified));const c=await d.role_bound_pool.connect();await c.query('begin isolation level serializable');await c.query('rollback');c.release();await new Promise(resolve=>setImmediate(resolve));assert.ok(s.x.calls.some(v=>v.text==='set role '+executorRole));assert.ok(s.x.calls.some(v=>v.text.includes('acquire_ce_guide_role_safety_lease_v1')));assert.equal(s.state.calls,1);
});
await check('legacy actual CE authenticator missing issuer SID stays closed, not upgraded',async()=>{
 const s=setup({actualLegacyCE:true}),b=s.create();assert.equal(await b.dependencies.authenticate(s.request),null);await assert.rejects(b.dependencies.role_bound_pool.connect());assert.equal(s.x.checkout,0);
});
await check('different Request/caller JSON/AAL1/missing SID cannot authorize a lease',async()=>{
 const s=setup(),d=s.create().dependencies;assert.equal(await d.authenticate(new Request(s.request.url)),null);
 for(const change of [{assurance_level:'aal1'},{session_id:undefined},{source:'caller_json'},{actor_id:'malformed'}]){s.state.auth={...s.state.auth,...change};assert.equal(await d.authenticate(s.request),null);await assert.rejects(d.role_bound_pool.connect());}
 assert.equal(s.x.checkout,0);
});
await check('wrong target/connection-model/selectors and SERVICE principal fail before checkout',async()=>{
 for(const extra of [{connection_model:'transaction_pooler'},{target:{...target,runtime_role:'cladora_core_runtime'}},{target:{...target,host:'remote.example'}},{target:{...target,database_name:'production'}}]){const s=setup();assert.throws(()=>s.create(extra));assert.equal(s.x.checkout,0);}
 const s=setup();s.pool.options.user='service_role';assert.throws(()=>s.create());assert.equal(s.x.checkout,0);
});
await check('Auth target mismatch stops before official authenticator or PG',async()=>{const s=setup(),d=s.create().dependencies;s.state.origin='https://foreign.example';await assert.rejects(d.authenticate(s.request));assert.equal(s.state.calls,0);assert.equal(s.x.checkout,0);});
await check('actual database/OID/backend/PG17/powerful principal checked before SET ROLE',async()=>{
 for(const metadata of [{database_oid:999},{backend_marker:'foreign'},{server_version_num:160010},{rolsuper:true},{rolbypassrls:true},{rolcreaterole:true},{current_user:'postgres'},{session_user:'postgres'}]){const s=setup();s.x.metadata=metadata;const d=s.create().dependencies;await d.authenticate(s.request);await assert.rejects(d.role_bound_pool.connect());assert.equal(s.x.calls.some(v=>v.text.startsWith('set role ')),false);assert.deepEqual(s.x.releases,[true]);}
});
await check('existing role-safety guard remains mandatory and cannot be replaced by profile',async()=>{const s=setup(),d=s.create().dependencies;await d.authenticate(s.request);s.x.safe=false;await assert.rejects(d.role_bound_pool.connect());assert.deepEqual(s.x.releases,[true]);});
await check('invalid re-authentication removes an earlier checkout capability',async()=>{const s=setup(),d=s.create().dependencies;await d.authenticate(s.request);s.state.auth=null;assert.equal(await d.authenticate(s.request),null);await assert.rejects(d.role_bound_pool.connect());assert.equal(s.x.checkout,0);});
await check('same Request cannot change verified actor or SID after first authentication',async()=>{for(const field of ['actor_id','session_id']){const s=setup(),d=s.create().dependencies;await d.authenticate(s.request);s.state.auth={...s.state.auth,[field]:uuid(99)};await assert.rejects(d.authenticate(s.request));await assert.rejects(d.role_bound_pool.connect());assert.equal(s.x.checkout,0);}});
await check('late auth result cannot restore capability after a newer denial',async()=>{const s=setup(),d=s.create().dependencies;let release;s.state.pending=new Promise(r=>{release=r;});const old=d.authenticate(s.request);s.state.pending=null;s.state.auth=null;assert.equal(await d.authenticate(s.request),null);release({source:'supabase_verified_session',actor_id:uuid(1),assurance_level:'aal2',expires_at:4102444800,session_id:uuid(2)});assert.equal(await old,null);await assert.rejects(d.role_bound_pool.connect());});
await check('40001 original object propagates through actual role-bound query wrappers',async()=>{const s=setup(),d=s.create().dependencies;await d.authenticate(s.request);const c=await d.role_bound_pool.connect(),error=Object.assign(new Error('synthetic serialization'),{code:'40001'});await c.query('begin isolation level serializable');s.x.fault={sql:'select synthetic_failure',error};await assert.rejects(c.query('select synthetic_failure'),e=>e===error);await assert.rejects(c.query('select next'),e=>e===error);await c.query('rollback');c.release();assert.deepEqual(s.x.releases,[true]);});
await check('aborted request blocks effects but permits rollback/destroy',async()=>{const s=setup(),abort=new AbortController(),request=new Request(s.request.url,{signal:abort.signal}),d=s.create({request}).dependencies;await d.authenticate(request);const c=await d.role_bound_pool.connect();await c.query('begin isolation level serializable');abort.abort();await assert.rejects(c.query('insert into forbidden values(1)'));assert.equal(s.x.calls.some(v=>v.text.startsWith('insert')),false);await c.query('rollback');c.release();assert.deepEqual(s.x.releases,[true]);});
await check('no Core pool/identity/auth constructor imports the SERVICE runtime binding',async()=>{const source=readFileSync(resolve(root,'src/lib/core/guide-request-binding-v1.ts'),'utf8');assert.doesNotMatch(source,/createCoreService|service-functional-binding|service-role|new Pool|set role \$/);assert.ok(source.includes('authenticateExperienceGuideLifecycleServerSessionV1'));assert.ok(source.includes('createCorePlatformRoleBoundPoolV1'));});
await check('actual CE6259 official authenticator composes through Core/fixed roles with issuer SID',async()=>{const s=setup({acceptedCE:true}),d=s.create().dependencies;const verified=await d.authenticate(s.request);assert.equal(verified.session_id,uuid(2));assert.equal(verified.assurance_level,'aal2');const c=await d.role_bound_pool.connect();await c.query('begin isolation level serializable read only');await c.query('rollback');c.release();await new Promise(r=>setImmediate(r));assert.ok(s.x.calls.some(v=>v.text.includes('acquire_ce_guide_role_safety_lease_v1')));});
await check('CE-only read-only admission keeps other BEGIN options and SERVICE profile closed',async()=>{const s=setup({acceptedCE:true}),d=s.create().dependencies;await d.authenticate(s.request);const c=await d.role_bound_pool.connect();await assert.rejects(c.query('begin isolation level serializable read only; select 1'));c.release(true);const profile=s.load('src/lib/core/platform-role-bound-pool-v1.ts');const calls=[],runtime=profile.corePlatformServiceSubjectLinkRuntimeRoleV1,executor=profile.corePlatformServiceSubjectLinkExecutorRoleV1;let role=runtime;
 const raw={async connect(){return{async query(q){calls.push(q);if(q==='reset role')role=runtime;if(q==='set role '+executor)role=executor;if(q.startsWith('select current_user::text'))return{rows:[{current_user:role,session_user:runtime}],rowCount:1};return{rows:[{safe:true}],rowCount:1};},release(){}};}};
 const service=profile.createCorePlatformServiceSubjectLinkRoleBoundPoolV1({runtime_pool:raw,connection_model:'direct'}),lease=await service.connect();await assert.rejects(lease.query('begin isolation level serializable read only'),/transaction_control_denied/);assert.equal(calls.includes('begin isolation level serializable read only'),false);lease.release(true);});
await check('actual predecessor pool rejects CE probe literal before SQL, successor admits only that closed case',async()=>{const s=setup({acceptedCE:true,legacyPool:true}),d=s.create().dependencies;await d.authenticate(s.request);const c=await d.role_bound_pool.connect();await assert.rejects(c.query('begin isolation level serializable read only'),/transaction_control_denied/);assert.equal(s.x.calls.some(q=>q.text==='begin isolation level serializable read only'),false);c.release(true);});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/Guide-R1',groups:n,proof:'CONTROLLED_CORE_AND_ROLE_ADAPTER_ONLY',CE_6259_source:CE_SOURCE,CE_successor_auth_coupling:'CONTROLLED_PASS',native:'NOT_RUN_NOT_PASS'}));
