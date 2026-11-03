/** New Core15 wiring/security controls. Controlled pg/Auth transports, NOT native evidence. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const original=new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url),source=readFileSync(original,'utf8');
const prefix=source.slice(source.indexOf('const original='),source.indexOf('\nlet n=0;'))
 .replace("new URL('./test-core-host-terminal-lifecycle-11.mjs',import.meta.url)","new URL('./test-core-host-terminal-lifecycle-11.mjs',providedUrl)");
const auth={user:null,claims:null,error:null,origin:'http://127.0.0.1:55421',calls:0};
globalThis.__core15_test_auth_transport=auth;
const read=(file,encoding)=>{
 if(String(file).endsWith('/functional-read-queries-v1.json'))return 'export default '+readFileSync(file,'utf8')+';';
 if(String(file).endsWith('/supabase/server.ts'))return `export async function createClient(){const a=globalThis.__core15_test_auth_transport;return{auth:{async getUser(){a.calls++;return{error:a.error,data:{user:a.user}};},async getClaims(){a.calls++;return{error:a.error,data:{claims:a.claims}};}}};}`;
 if(String(file).endsWith('/supabase/env.ts'))return `export function getPublicSupabaseEnv(){return{url:globalThis.__core15_test_auth_transport.origin,publishableKey:'synthetic-no-network'};}`;
 return readFileSync(file,encoding);
};
let aliasLoad;
// Controlled SDK Auth transport for the new request-bound SSR path. The actual
// request client, cookie envelope and Core authority/runtime code still execute.
const cr=url=>{const actual=createRequire(url);return name=>name==='server-only'?{}
 :name==='@supabase/ssr'?{...actual(name),createServerClient:()=>({auth:{
  async getUser(){auth.calls++;return{error:auth.error,data:{user:auth.user}};},
  async getClaims(){auth.calls++;return{error:auth.error,data:{claims:auth.claims}};},
 }})}:name.startsWith('@/')?aliasLoad(name.replace('@/','src/')):actual(name);};
const {setup,core,provider,next,id,env}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','providedUrl',prefix+'\nreturn{setup,core,provider,next,id,env};')
 (assert,read,execFileSync,cr,resolve,dirname,extname,fileURLToPath,ts,original.href);
aliasLoad=env.load;
const runtimeModule=env.load('src/lib/core/functional-command-runtime-v1.ts'),SQL=runtimeModule.CORE_FUNCTIONAL_RUNTIME_SQL;
const target={contract:'core-functional-development-target.v1',backend_id:'controlled-model-not-platform12',purpose:'owned-isolated-persistent-development',host:'127.0.0.1',port:55432,database_name:'cladora_dev_core15_model',database_oid:1234,runtime_role:'cladora_core_runtime',auth_origin:auth.origin};
const offering={contract_version:'service-offering-disclosure-source.v1',context_id:id(4),workspace_id:id(3),offering_id:id(70),offering_version:1,published_revision_id:id(71),published_revision_version:1,provider_party_id:id(72),provider_agreement_id:id(73),provider_agreement_version:1,requested_service_scope:'service.request.create',permission_code:'services.orders.request'};
const SSQL=env.load('src/lib/customer/service-offering-disclosure-source-v1.ts').SERVICE_OFFERING_DISCLOSURE_SQL;
const S01=env.load('src/lib/core/service-s01/provider-agreement-reader-v1.ts').CORE_S01_SQL;

async function fixture(){const x=await setup();auth.user={id:x.cmd.actor_id};auth.claims={sub:x.cmd.actor_id,session_id:id(90),exp:4102444800,aal:'aal2',role:'authenticated',user_metadata:{allow:true}};auth.error=null;auth.origin=target.auth_origin;auth.calls=0;
 x.f.pool.options={host:target.host,port:target.port,database:target.database_name,user:target.runtime_role,connectionTimeoutMillis:5000,query_timeout:15000};
 const connect=x.f.pool.connect.bind(x.f.pool);x.calls=[];x.checkpoints=0;x.claimImages=[];
 x.f.pool.connect=async()=>{const client=await connect(),query=client.query.bind(client),release=client.release.bind(client),ends=[];
 client.once=(event,fn)=>{assert.equal(event,'end');ends.push(fn);return client;};client.release=(destroy)=>{release(destroy);for(const fn of ends.splice(0))fn();};client.query=async(text,values=[])=>{
  x.calls.push(text);
  if(x.faultSql===text)throw x.fault;
  if(text===SQL.principal)return{rows:[{backend_pid:80,principal:target.runtime_role,login:target.runtime_role,database_name:target.database_name,database_oid:target.database_oid,server_version_num:170011,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,privileged_membership:false,database_create:false,schema_create:false,table_owner:false,...x.principal}],rowCount:1};
  if(text===SQL.identity){x.claimImages.push(JSON.parse(values[0]));return{rows:[],rowCount:1};}
  if(text===SQL.session){if(x.sessionDenied)throw Object.assign(Error('controlled-session-denial'),{code:'42501'});return{rows:[{}],rowCount:1};}
  if(text===SQL.resolve)return{rows:[{workspace_id:id(3),tenant_id:id(2),membership_id:id(6)}],rowCount:1};
  if(text===SQL.checkpoint){x.checkpoints++;if(x.checkpointFault)throw x.checkpointFault;return{rows:[{}],rowCount:1};}
  if(text.includes('select expires_at>clock_timestamp() as unexpired'))return{rows:[{unexpired:!x.replayExpired}],rowCount:1};
  if(text.includes('app_private.active_tenant_id()::text as tenant_id'))return{rows:[{database_transaction_id:String(100+x.f.attempts),actor_id:id(1),tenant_id:id(2),at:x.f.now}],rowCount:1};
  if(text.startsWith('select pg_backend_pid() as backend_pid,to_char('))return{rows:[{backend_pid:80,at:x.f.now}],rowCount:1};
  if(text.startsWith('select id from service_catalog.offerings'))return{rows:[{id:offering.offering_id}],rowCount:1};
  if(text===SSQL.offering)return{rows:[{tenant_id:id(2),workspace_id:id(3),offering_id:id(70),offering_version:'1',published_revision_id:id(71),provider_party_id:id(72),definition_id:id(74)}],rowCount:1};
  if(text===SSQL.revision)return{rows:[{tenant_id:id(2),workspace_id:id(3),offering_id:id(70),published_revision_id:id(71),published_revision_version:'1',provider_agreement_id:id(73),provider_agreement_version:'1',revision_status:'published',valid_from:'2026-01-01T00:00:00.000000Z',valid_until:null,acquisition_mode:'direct',coverage:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]}}],rowCount:1};
  if(text===SSQL.definition)return{rows:[{definition_id:id(74),tenant_id:id(2),workspace_id:id(3),definition_current:true}],rowCount:1};
  if(text===SSQL.provider)return{rows:[{provider_party_id:id(72),tenant_id:id(2),provider_current:true}],rowCount:1};
  if(text===SSQL.clock)return{rows:[{database_transaction_id:String(100+x.f.attempts),actor_id:id(1),evaluated_at:x.f.now}],rowCount:1};
  if(text===S01.clock)return{rows:[{database_transaction_id:String(100+x.f.attempts),actor_id:id(1),isolation:'serializable',evaluated_at:x.f.now}],rowCount:1};
  if(text===S01.session)return{rows:[{}],rowCount:1};
  if(text===S01.final)return{rows:[{database_transaction_id:String(100+x.f.attempts),actor_id:id(1),isolation:'serializable',evaluated_at:x.f.now,allowed:true,session_guard:null,authority_revision:'1'}],rowCount:1};
  if(text===S01.discover||text===S01.head)return{rows:[{id:id(73),tenant_id:id(2),workspace_id:id(3),provider_party_id:id(72),current_version:1,revision:x.revisionCodec??'1',status:'effective'}],rowCount:1};
  if(text===S01.party)return{rows:[{id:id(72),tenant_id:id(2),current:true}],rowCount:1};
  if(text===S01.workspace)return{rows:[{id:id(3),tenant_id:id(2),current:true}],rowCount:1};
  if(text===S01.version)return{rows:[{agreement_id:id(73),tenant_id:id(2),workspace_id:id(3),provider_party_id:id(72),version:1,valid_from:'2026-01-01',valid_until:null,allowed_service_scope:['service.request.create']}],rowCount:1};
  return query(text,values);
 };return client;};
 x.runtime=()=>runtimeModule.createCoreFunctionalCommandRuntimeV1({pool:x.f.pool,target,offering});return x;}
let n=0;async function check(name,operation){await operation();console.log(`PASS ${++n} ${name}`);}
await check('Pool target mismatch rejected BEFORE checkout/Auth; no fallback staging URL',async()=>{const x=await fixture();x.f.pool.options.host='remote.invalid';assert.throws(x.runtime,/POOL_BINDING_MISMATCH/);assert.equal(x.calls.length,0);assert.equal(auth.calls,0);});
await check('unknown/extra target, protected database, privileged runtime and missing budgets rejected',async()=>{
 const x=await fixture();for(const change of [{database_name:'postgres'},{runtime_role:'postgres'},{host:'remote.invalid'},{extra:true}])assert.throws(()=>runtimeModule.createCoreFunctionalCommandRuntimeV1({pool:x.f.pool,target:{...target,...change},offering}));
 x.f.pool.options.query_timeout=0;assert.throws(x.runtime,/POOL_BUDGET_REQUIRED/);
});
await check('fixed server Auth target mismatch prevents any Auth call/DB checkout',async()=>{const x=await fixture(),r=x.runtime();auth.origin='http://127.0.0.1:1';await assert.rejects(r.host.execute(x.cmd,provider(x.guide)),/AUTH_TARGET_MISMATCH/);assert.equal(x.calls.length,0);assert.equal(auth.calls,0);});
for(const [name,change] of [['foreign actor',a=>{a.user={id:id(99)};}],['AAL1',a=>{a.claims.aal='aal1';}],['missing session',a=>{delete a.claims.session_id;}],['bad role',a=>{a.claims.role='service_role';}],['Auth error',a=>{a.error={message:'CONTROLLED_PRIVATE'};}]])await check(`Auth ${name} fails before DB; user_metadata.allow is not authority`,async()=>{const x=await fixture(),r=x.runtime();change(auth);await assert.rejects(r.host.execute(x.cmd,provider(x.guide)));assert.equal(x.calls.length,0);});
for(const change of [{rolsuper:true},{rolbypassrls:true},{privileged_membership:true},{database_create:true},{schema_create:true},{table_owner:true},{database_oid:999}])await check(`actual checkout principal rejects ${Object.keys(change)[0]}`,async()=>{const x=await fixture();x.principal=change;const r=await x.runtime().host.execute(x.cmd,provider(x.guide));assert.equal(r.status,'denied');assert.equal(x.calls.includes('begin isolation level serializable'),false);});
await check('real C03 fresh dispatch remains atomic on controlled transport; verified claims minimized',async()=>{const x=await fixture(),c=next(x),before=x.f.writes.length;
 const result=await x.runtime().host.execute(c.cmd,provider(c.guide));assert.equal(result.status,'committed',JSON.stringify(result));assert.ok(x.f.writes.length>before);assert.ok(x.checkpoints>0);
 assert.equal(x.claimImages.some(c=>Object.hasOwn(c,'user_metadata')),false);assert.equal(x.claimImages.at(-1).active_tenant_id,id(2));assert.equal(x.claimImages.at(-1).active_context_id,id(4));assert.equal(x.f.releases.at(-1),true);
});
await check('caller authority callback ignored in favor of actual canonical provider',async()=>{const x=await fixture();let called=0;const c=next(x),r=await x.runtime().host.execute(c.cmd,{...provider(c.guide),async resolveAuthority(){called++;throw Error('CALLER_ALLOW');}});assert.equal(called,0);assert.equal(r.status,'committed');});
await check('same real C03 key/body replay has zero second mutation/audit/outbox',async()=>{const x=await fixture(),c=next(x),r=x.runtime(),p=provider(c.guide);assert.equal((await r.host.execute(c.cmd,p)).status,'committed');const before=structuredClone(x.f.writes);assert.equal((await r.host.execute(c.cmd,p)).status,'exact_replay');assert.deepEqual(x.f.writes,before);});
await check('expired ledger checked by fresh DB query after lock; never creates a fresh command',async()=>{const x=await fixture(),before=structuredClone(x.f.writes);x.replayExpired=true;const r=await x.runtime().host.execute(x.cmd,provider(x.guide));assert.equal(r.status,'denied');assert.equal(r.code,'REPLAY_CONFLICT');assert.ok(x.calls.some(q=>q.includes('expires_at>clock_timestamp()')));assert.deepEqual(x.f.writes,before);});
await check('current session denial before resolver/command locks creates zero effects',async()=>{const x=await fixture();x.sessionDenied=true;const before=structuredClone(x.f.writes),c=next(x);assert.equal((await x.runtime().host.execute(c.cmd,provider(c.guide))).status,'denied');assert.deepEqual(x.f.writes,before);assert.equal(x.calls.includes(SQL.resolve),false);});
await check('denial at first post-authorization checkpoint rolls back zero durable model effects',async()=>{const x=await fixture();x.checkpointFault=Object.assign(Error('controlled-revoke'),{code:'42501'});const before=structuredClone(x.f.writes),c=next(x);const result=await x.runtime().host.execute(c.cmd,provider(c.guide));assert.equal(result.status,'denied');assert.deepEqual(x.f.writes,before);});
await check('original40001 reaches EXISTING bounded host attempts and no separate retry engine',async()=>{const x=await fixture();const error=Object.assign(Error('controlled serialization'),{code:'40001'});x.faultSql=SQL.checkpoint;x.fault=error;const before=structuredClone(x.f.writes),attempts=x.f.attempts,c=next(x);assert.equal((await x.runtime().host.execute(c.cmd,provider(c.guide))).status,'denied');assert.equal(x.f.attempts-attempts,3);assert.deepEqual(x.f.writes,before);});
await check('lost COMMIT reply remains UNKNOWN and is not reported committed',async()=>{const x=await fixture(),c=next(x);x.f.lostCommit=true;assert.equal((await x.runtime().host.execute(c.cmd,provider(c.guide))).status,'unknown_commit');});
const selection={context_id:id(4),workspace_id:id(3),offering_id:id(70)};
await check('Core-owned preflight is SERIALIZABLE, positive ROLLBACK, no C03/audit/outbox/domain writes',async()=>{
 const x=await fixture(),before=structuredClone(x.f.writes),commits=x.f.commits;
 const result=await x.runtime().withRequestScope(selection,async()=>({value:'controlled-read'}));
 assert.deepEqual(result.value,{value:'controlled-read'});assert.equal(result.completed_at,x.f.now);
 assert.deepEqual(x.f.writes,before);assert.equal(x.f.commits,commits);assert.ok(x.calls.includes('rollback'));
});
await check('read scope cannot escape settlement or run SELECT-side-effect mutation/query not in closed source census',async()=>{
 const x=await fixture(),r=x.runtime();let old;
 await r.withRequestScope(selection,async scope=>{old=scope;});
 await assert.rejects(old.query('select app_private.apply_service_v14_execution_v1($1,$2::jsonb)',['create_request','{}']),/READ_QUERY_NOT_ADMITTED/);
 await assert.rejects(r.withRequestScope(selection,async scope=>{try{await scope.query('select 1');}catch{}return{success:true};}),/READ_QUERY_NOT_ADMITTED/);
});
await check('preflight preserves original40001 and no successful value escapes callback/rollback failure',async()=>{
 const x=await fixture(),r=x.runtime(),error=Object.assign(Error('original serialization'),{code:'40001'});
 await assert.rejects(r.withRequestScope(selection,async()=>{throw error;}),e=>e===error);
 assert.equal(runtimeModule.coreFunctionalReadFailureV1(error).settlement,'rolled_back');
});
await check('preflight lost ROLLBACK ACK remains UNKNOWN and discards read value',async()=>{
 const x=await fixture(),r=x.runtime();x.faultSql='rollback';x.fault=Object.assign(Error('lost ACK'),{code:'08006'});
 await assert.rejects(r.withRequestScope(selection,async()=>({private:'must-not-escape'})),e=>{assert.equal(runtimeModule.coreFunctionalReadFailureV1(e).settlement,'unknown');return true;});
});
await check('actual SERVICE source port executes on real Core read scope; returns authorized published snapshot',async()=>{
 const x=await fixture(),r=x.runtime(),result=await r.withRequestScope(selection,(_scope,p)=>p.loadOffering({...selection,published_revision_id:id(71)}));
 assert.equal(result.value.offering_id,id(70));assert.equal(result.value.provider_agreement_id,id(73));assert.equal(result.value.status,'published');assert.equal(result.completed_at,x.f.now);
});
await check('real S01 reader + actual SERVICE Offering projector couple with pg int8-text revision adapter',async()=>{
 const x=await fixture(),r=x.runtime(),input={contract_version:'provider-agreement-verification.v1',context_id:id(4),workspace_id:id(3),provider_agreement_id:id(73),provider_agreement_version:1,requested_service_scope:['service.request.create'],permission_code:'services.orders.request'};
 const result=await r.withRequestScope(selection,(_scope,p)=>p.resolveProviderAgreement(input));
 assert.equal(result.value.agreement_status,'effective',JSON.stringify(result.value));assert.equal(result.value.action_authorization,'not_evaluated');
});
await check('unsafe int8 revision fails closed, no lossy Number/fallback provider success',async()=>{
 const x=await fixture(),r=x.runtime();x.revisionCodec='9007199254740992';
 await assert.rejects(r.withRequestScope(selection,(_scope,p)=>p.resolveProviderAgreement({contract_version:'provider-agreement-verification.v1',context_id:id(4),workspace_id:id(3),provider_agreement_id:id(73),provider_agreement_version:1,requested_service_scope:['service.request.create'],permission_code:'services.orders.request'})));
});
await check('Core request-local producer supplies real SERVICE loadOffering/S01/principal methods, exact DB clock',async()=>{
 const x=await fixture(),binding=env.load('src/lib/core/service-functional-binding-v1.ts').createCoreServiceFunctionalBindingV1({pool:x.f.pool,target});
 assert.equal(binding.core_contract,'core15-service-request-runtime.v1');assert.equal(binding.database_contract,'platform12-service-request-database.v1');
 const ports=await binding.bind(new Request('http://127.0.0.1/api/customer/v1/services/offering-request-flow'));
 const input={...selection,published_revision_id:id(71)};
 assert.equal((await ports.loadOffering(input)).offering_id,id(70));
 const agreement=await ports.resolveProviderAgreement({contract_version:'provider-agreement-verification.v1',context_id:id(4),workspace_id:id(3),provider_agreement_id:id(73),provider_agreement_version:1,requested_service_scope:['service.request.create'],permission_code:'services.orders.request'});
 assert.equal(agreement.agreement_status,'effective');assert.equal((await ports.resolvePrincipal(selection)).actor_id,id(1));assert.equal(ports.now(),x.f.now);
 await assert.rejects(ports.loadOffering({...input,context_id:id(99)}),/scope_mismatch/);
});
await check('request-local SSR Auth denial prevents any SERVICE database lease',async()=>{
 const x=await fixture();auth.error={message:'controlled SDK denial'};
 const binding=env.load('src/lib/core/service-functional-binding-v1.ts').createCoreServiceFunctionalBindingV1({pool:x.f.pool,target});
 await assert.rejects(binding.bind(new Request('http://127.0.0.1/api/customer/v1/services/offering-request-flow')));
 assert.equal(x.calls.length,0);assert.equal(auth.calls,2);
});
await check('ledger expiry during actual replay-provider wait is rechecked by server AFTER that wait',async()=>{
 const x=await fixture(),before=structuredClone(x.f.writes),p=provider(x.guide);
 const r=await x.runtime().host.execute(x.cmd,{...p,async validateReplay(...args){const result=await p.validateReplay(...args);x.replayExpired=true;return result;}});
 assert.equal(r.status,'denied');assert.equal(r.code,'REPLAY_CONFLICT');assert.deepEqual(x.f.writes,before);
});
await check('read cleanup failure cannot replace original40001 or expose partial value',async()=>{
 const x=await fixture(),r=x.runtime(),original=Object.assign(Error('first serialization'),{code:'40001'});x.f.releaseError=Error('cleanup');
 await assert.rejects(r.withRequestScope(selection,async()=>{throw original;}),e=>e===original);
 assert.equal(moduleFailure(original).cleanup_error.message,'cleanup');
 function moduleFailure(e){return runtimeModule.coreFunctionalReadFailureV1(e);}
});
await check('mutating shared Pool selectors after construction cannot open a foreign/staging connection',async()=>{
 const x=await fixture(),r=x.runtime();x.f.pool.options.host='remote.invalid';
 assert.equal((await r.host.execute(x.cmd,provider(x.guide))).status,'denied');assert.equal(x.calls.length,0);
});
console.log(JSON.stringify({task:'CORE-FUNCTIONAL-RUNTIME-15',controls:n,evidence:'CONTROLLED_TRANSPORT_NOT_NATIVE',Platform12:'NOT_DELIVERED',sql_pg_auth:'NOT_RUN',task_complete:false}));
