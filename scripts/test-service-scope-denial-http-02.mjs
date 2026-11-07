/** Actual Core lease/binding + SERVICE application/HTTP; controlled Auth/pg only. */
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
const ts=require('typescript'),{NextRequest}=require('next/server');
const id=n=>String(n).padStart(8,'0')+'-0000-4000-8000-'+String(n).padStart(12,'0');
const target={contract:'core-functional-development-target.v1',backend_id:'core15-dev:'+'a'.repeat(32),purpose:'owned-isolated-persistent-development',host:'127.0.0.1',port:55422,database_name:'postgres',database_oid:16384,runtime_role:'cladora_core_runtime',auth_origin:'http://127.0.0.1:55421'};
const input={context_id:id(1),workspace_id:id(2),offering_id:id(3),published_revision_id:id(4),beneficiary_party_id:id(5),resource:null,description:'Synthetic scoped request',idempotency_key:'synthetic-scope-denial-02'};
const post=()=>new NextRequest('http://localhost:3008/api/customer/v1/services/offering-request-flow',{method:'POST',headers:{origin:'http://localhost:3008','content-type':'application/json'},body:JSON.stringify(input)});
const get=()=>new NextRequest('http://localhost:3008/api/customer/v1/services/catalog?'+new URLSearchParams({context_id:input.context_id,workspace_id:input.workspace_id}));
const preflight=()=>new NextRequest('http://localhost:3008/api/customer/v1/services/offering-request-flow?'+new URLSearchParams(Object.fromEntries(Object.entries(input).filter(([k])=>['context_id','workspace_id','offering_id','published_revision_id'].includes(k)))));

function fixture(mode='workspace'){
 const counts={pool:0,rollback:0,destroy:0,business:0,auth:0,getter:0,queries:[]};
 const error=Object.assign(Error(mode==='checkpoint'?'core_functional_checkpoint_denied':'workspace_native_context_access_denied'),{code:'42501',routine:'exec_stmt_raise'});
 if(mode==='acl')Object.assign(error,{message:'permission denied for schema app_private',routine:'aclcheck_error'});
 if(mode==='message-only')Object.assign(error,{routine:'aclcheck_error'});
 if(mode==='unknown-raise')Object.assign(error,{message:'unclassified private exception'});
 if(mode==='transport')Object.assign(error,{code:'08006'});
 if(mode==='serialization')Object.assign(error,{code:'40001'});
 if(mode==='getter')Object.defineProperty(error,'code',{get(){counts.getter++;return '42501';}});
 const cache=new Map();let binding,SQL;
 const verified={auth:{
  async getUser(){counts.auth++;return {data:{user:mode==='anonymous'||(mode==='auth-after-bind'&&counts.auth>1)?null:{id:id(6),user_metadata:{admin:true}}},error:null};},
  async getClaims(){return{data:{claims:{sub:id(6),session_id:id(7),role:'authenticated',aal:'aal2',exp:2000000000}},error:null};},
 }};
 class Client extends EventEmitter{
  async query(text){
   counts.queries.push(text);
   const q=text.trim().toLowerCase();
   if(/^(insert|update|delete|commit)\b/.test(q)){counts.business++;throw Error('BUSINESS_EFFECT_FORBIDDEN');}
   if(text===SQL.principal)return{rowCount:1,rows:[{backend_pid:500,principal:target.runtime_role,login:target.runtime_role,database_name:'postgres',database_oid:16384,backend_marker:target.backend_id,server_version_num:170011,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false,privileged_membership:false,database_create:false,schema_create:false,table_owner:false}]};
   if(q==='begin isolation level serializable')return{command:'BEGIN',rows:[],rowCount:0};
   if(q==='rollback'){counts.rollback++;if(mode==='rollback-unknown')throw Object.assign(Error('synthetic rollback ACK lost'),{code:'08006'});return{command:'ROLLBACK',rows:[],rowCount:0};}
   if(q.startsWith('set local ')||text===SQL.identity||text===SQL.session)return{command:'SET',rows:[{}],rowCount:1};
   if(text===SQL.resolve){
    if(mode==='typed-scope')return{rowCount:1,rows:[{workspace_id:id(99),tenant_id:id(8),membership_id:id(9)}]};
    if(mode==='typed-read-scope')return{rowCount:1,rows:[{workspace_id:id(2),tenant_id:id(8),membership_id:id(9)}]};
    throw error;
   }
   if(q.includes('pg_advisory_xact_lock'))return{rows:[{}],rowCount:1};
   if(q.startsWith('select id from platform.customer_workspaces'))return{rows:[],rowCount:0};
   if(q.startsWith('select id from service_catalog.offerings'))return{rows:[{id:id(3)}],rowCount:1};
   throw Error('UNEXPECTED_CONTROLLED_QUERY');
  }
  release(destroy){assert.equal(destroy,true);counts.destroy++;this.emit('end');if(mode==='cleanup-unknown')throw Error('synthetic destroy failure');}
 }
 const pool={options:{host:target.host,port:target.port,database:'postgres',user:target.runtime_role,connectionTimeoutMillis:5000,query_timeout:15000},async connect(){counts.pool++;return new Client();}};
 function load(path){
  if(!extname(path))path+='.ts';
  if(path.endsWith('/src/lib/supabase/env.ts'))return{getPublicSupabaseEnv:()=>({url:target.auth_origin,publishableKey:'synthetic-public-key'})};
  if(path.endsWith('/src/lib/supabase/server.ts'))return{createClient:async()=>verified};
  if(path.endsWith('/src/lib/core/private-service-development-binding-v1.ts'))return{
   getCore15PrivateServiceDevelopmentBindingV1:()=>binding,
   getCoreServiceAppRuntimeV1:request=>load(resolve(root,'src/lib/core/functional-command-runtime-v1.ts')).createCoreFunctionalCommandRuntimeV1({pool,target,offering:null,request})};
  if(cache.has(path))return cache.get(path).exports;
  const m={exports:{}};cache.set(path,m);
  if(path.endsWith('.json')){m.exports=JSON.parse(readFileSync(path,'utf8'));return m.exports;}
  const code=ts.transpileModule(readFileSync(path,'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const imports=name=>name==='server-only'?{}:name==='@supabase/ssr'?{...require(name),createServerClient:()=>verified}:name.startsWith('@/')?load(resolve(root,'src',name.slice(2))):name.startsWith('.')?load(resolve(dirname(path),name)):require(name);
  new Function('require','module','exports',code)(imports,m,m.exports);return m.exports;
 }
 const core=load(resolve(root,'src/lib/core/functional-command-runtime-v1.ts'));SQL=core.CORE_FUNCTIONAL_RUNTIME_SQL;
 binding=load(resolve(root,'src/lib/core/service-functional-binding-v1.ts')).createCoreServiceFunctionalBindingV1({pool,target});
 if(mode==='unattested')binding={...binding,async bind(){return{async loadOffering(){throw error;},host:{execute(){counts.business++;throw Error('UNEXPECTED_COMMAND');}}};}};
 const resolver=load(resolve(root,'src/lib/customer/service-v14-execution/runtime-binding.ts')).getServiceOfferingRequestRuntimeBinding();
 const handlers=load(resolve(root,'src/lib/customer/service-v14-execution/http.ts')).createServiceOfferingRequestFlowHandlers(resolver);
 return{counts,error,core,handlers,
  make:load(resolve(root,'src/lib/customer/service-v14-execution/http.ts')).createServiceOfferingRequestFlowHandlers,
  boundary:()=>load(resolve(root,'src/lib/customer/service-v14-execution/read-failure-boundary.ts')).serviceRequestReadFailureBoundaryV1,
  read:load(resolve(root,'src/lib/core/service-app-read-v1.ts')).coreServiceAppReadV1};
}
async function responseIs(response,status,code){assert.equal(response.status,status);assert.deepEqual(await response.json(),{error:{code}});assert.equal(response.headers.get('cache-control'),'no-store, private');assert.equal(response.headers.get('vary'),'Cookie');}
let checks=0,failures=0;
async function check(name,fn){checks++;try{await fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+': '+error.message);}}
for(const mode of ['workspace','checkpoint','typed-scope','typed-read-scope']){
 await check(mode+' canonical settled denial: real Core + request adapter + binding + application + HTTP403',async()=>{
  const f=fixture(mode);
  await responseIs(await f.handlers.POST(post()),403,'SERVICE_ACCESS_DENIED');
  assert.equal(f.counts.pool,1);assert.equal(f.counts.rollback,1);assert.equal(f.counts.destroy,1);assert.equal(f.counts.business,0);
 });
}
await check('same controlled canonical SQL denial remains GET403 and now POST403',async()=>{
 const f=fixture('workspace');const before=process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE;
 process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE='core-service-real-app-assembly.v1';
 try{await responseIs(await f.read(get(),'catalog'),403,'SERVICE_ACCESS_DENIED');}
 finally{if(before===undefined)delete process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE;else process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE=before;}
 await responseIs(await f.handlers.POST(post()),403,'SERVICE_ACCESS_DENIED');assert.equal(f.counts.business,0);
});
await check('valid preflight GET also reports canonical denied scope403',async()=>{const f=fixture('workspace');await responseIs(await f.handlers.GET(preflight()),403,'SERVICE_ACCESS_DENIED');assert.equal(f.counts.business,0);});
for(const mode of ['acl','message-only','unknown-raise','transport','rollback-unknown','cleanup-unknown','unattested','getter']){
 await check(mode+' is NOT a canonical settled denial and remains unavailable503',async()=>{
  const f=fixture(mode);await responseIs(await f.handlers.POST(post()),503,'RUNTIME_BINDING_INACTIVE');
  assert.equal(f.counts.business,0);if(mode==='getter')assert.equal(f.counts.getter,0);
 });
}
await check('serialization preserves the original40001 object and never becomes denial',async()=>{const f=fixture('serialization');await assert.rejects(f.handlers.POST(post()),e=>e===f.error);assert.equal(f.counts.business,0);});
await check('anonymous bind remains401 with no database lease',async()=>{const f=fixture('anonymous');await responseIs(await f.handlers.POST(post()),401,'UNAUTHORIZED');assert.equal(f.counts.pool,0);});
await check('Auth expiry between initial bind and read remains401 without database lease',async()=>{const f=fixture('auth-after-bind');await responseIs(await f.handlers.POST(post()),401,'UNAUTHORIZED');assert.equal(f.counts.pool,0);});
for(const phase of ['second-offering','final-offering','agreement','principal','resource-after-allowed']){
 await check('settled denial at '+phase+' never escapes as ready or dispatches a command',async()=>{
  const f=fixture('workspace');await responseIs(await f.handlers.POST(post()),403,'SERVICE_ACCESS_DENIED');
  assert.equal(f.core.coreFunctionalReadFailureV1(f.error).settlement,'rolled_back');
  let loads=0,resources=0,commands=0;
  const snapshot={workspace_id:id(2),offering_id:id(3),offering_version:1,published_revision_id:id(4),published_revision_version:1,provider_party_id:id(10),provider_agreement_id:id(11),provider_agreement_version:1,status:'published',acquisition_mode:'direct',valid_from:'2026-01-01T00:00:00Z',valid_until:null,coverage:phase==='resource-after-allowed'?{kind:'resources',resources:[{resource_type:'property',resource_id:id(12),resource_version:1},{resource_type:'property',resource_id:id(13),resource_version:1}]}:{kind:'workspace'},eligibility:{policy_version:1,required_resource_types:[],required_capabilities:[],required_policy_codes:[]},current_actor_can_request:true};
  const ports={async loadOffering(){loads++;if((phase==='second-offering'&&loads===2)||(phase==='final-offering'&&loads===3))throw f.error;return snapshot;},
   async resolveProviderAgreement(){if(phase==='agreement')throw f.error;return{contract_version:'provider-agreement-verification.v1',agreement_status:'effective',tenant_id:id(8),workspace_id:id(2),provider_party_id:id(10),provider_agreement_id:id(11),provider_agreement_version:1,valid_from:'2026-01-01',valid_until:null,allowed_service_scope:['service.request.create'],evaluated_at:'2026-11-02T00:00:00Z',action_authorization:'not_evaluated'};},
   async resolvePrincipal(){if(phase==='principal')throw f.error;return{actor_id:id(6),authority_version:1};},
   async resolveCanonicalResource(reference){resources++;if(resources===2)throw f.error;return{contract_version:'canonical-resource-reference.v1',reference_status:'verified',tenant_id:id(8),workspace_id:id(2),resource_type:'property',resource_id:reference.resource_id,resource_version:1,party_kind:null,display_name:'SYNTHETIC_RESOURCE',lifecycle_status:'ACTIVE',evaluated_at:'2026-11-02T00:00:00Z',action_authorization:'not_evaluated'};},
   host:{async execute(){commands++;throw Error('UNEXPECTED_COMMAND');}},transactionalReaders:{},now(){return'2026-11-02T00:00:00Z';}};
  const handlers=f.make(f.boundary()(ports));
  const response=phase==='resource-after-allowed'?await handlers.GET(preflight()):await handlers.POST(post());
  await responseIs(response,403,phase==='agreement'?'SOURCE_ACCESS_DENIED':'SERVICE_ACCESS_DENIED');
  assert.equal(commands,0);assert.equal(f.counts.business,0);
 });
}
console.log(JSON.stringify({task:'SERVICE-SCOPE-DENIAL-HTTP-02',checks,failures,evidence:'ACTUAL_CORE_AND_HTTP_WITH_CONTROLLED_AUTH_PG',native:'NOT_RUN'}));
if(failures)process.exitCode=1;
