/** Exact pinned CE + Core source, controlled SDK and physical PG transport only. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url),ts=require('typescript');
const CE='6259b70268a851113c8f981e2d346da5428e343f',BASE='bfadc5042cb00841dd605862a2a72ddc0dbafb87';
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'});
const cePaths=new Set(git('diff','--name-only',BASE,CE).trim().split('\n'));
function sourceRead(p,encoding){const relative=path.relative(root,p instanceof URL?fileURLToPath(p):p);return cePaths.has(relative)?git('show',CE+':'+relative):readFileSync(p,encoding);}
let journey=git('show',CE+':scripts/test-ce-guide-native-journey.mjs');
journey=journey.slice(journey.indexOf('const url='),journey.indexOf('const loaded='));
journey=journey.replace("new URL('test-ce-guide-create14.mjs',import.meta.url)","new URL("+JSON.stringify(new URL('./test-ce-guide-create14.mjs',import.meta.url).href)+")");
// Setup-only local test loader: production modules read from pinned Git, not copied.
journey+='\nreturn prefix;';
let prefix=new Function('readFileSync','createRequire','require','ts',journey)(sourceRead,createRequire,require,ts);
prefix=prefix.replace("function load(p){p=path.posix.normalize(p);", "function load(p){p=path.posix.normalize(p);if(p.endsWith('.json'))return JSON.parse(readFileSync(path.join(root,p),'utf8'));if(p==='src/lib/supabase/env.ts')return{getPublicSupabaseEnv:()=>({url:'http://127.0.0.1:55421',publishableKey:'synthetic'})};");
prefix=prefix.replace("if(/\\.[cm]?[jt]sx?$/.test(p))return p;", "if(/\\.[cm]?[jt]sx?$/.test(p)||p.endsWith('.json'))return p;");
prefix+='\nexport const setSDK=v=>{legacyBackend=v;};';
const realmRequire=id=>id==='node:fs'?{...require(id),readFileSync:sourceRead}:id==='node:module'?{...require(id),createRequire:()=>realmRequire}:require(id);
const realm={exports:{}};new Function('require','module','exports','readFileSync',ts.transpileModule(prefix,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(realmRequire,realm,realm.exports,sourceRead);
const {setup,ids,client,api,load,NextRequest,input,setSDK}=realm.exports;
const binding=load('src/lib/core/guide-request-binding-v1.ts'),actions=load('src/lib/community/experience-guide-actions-client.ts');
const target={contract:'core-functional-development-target.v1',backend_id:'core15-dev:'+'b'.repeat(32),purpose:'owned-isolated-persistent-development',host:'127.0.0.1',port:55422,database_name:'postgres',database_oid:1234,runtime_role:'cladora_ce_guide_runtime',auth_origin:'http://127.0.0.1:55421'};
function connected(){const h=setup(),observed=[],runtimeRole=target.runtime_role,executor='cladora_ce_guide_executor';
 let denied=false;const driverErrors=[];
 const SDK={auth:{getUser:async()=>({error:denied?Error('synthetic denial'):null,data:{user:{id:ids.actor}}}),getSession:async()=>({error:null,data:{session:{user:{id:ids.actor},expires_at:4070908800}}}),getClaims:async()=>({error:null,data:{claims:{sub:ids.actor,session_id:'80000000-0000-4000-8000-000000000001',exp:4070908800,role:'authenticated',aal:'aal2'}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({error:null,data:{currentLevel:'aal2'}})}}};setSDK(SDK);
 const physical={options:{host:target.host,port:target.port,database:target.database_name,user:runtimeRole,connectionTimeoutMillis:5000,query_timeout:15000},async connect(){const c=await h.dependencies.role_bound_pool.connect(),q=c.query.bind(c);let role=runtimeRole;c.query=async(text,v=[])=>{observed.push({text,values:v});
  if(text===binding.CORE_GUIDE_IDENTITY_SQL_V1)return{rows:[{current_user:role,session_user:runtimeRole,database_name:target.database_name,database_oid:target.database_oid,server_version_num:170011,backend_marker:target.backend_id,rolsuper:false,rolbypassrls:false,rolcreaterole:false,rolcreatedb:false,rolreplication:false}],rowCount:1};
  if(text==='reset role'){role=runtimeRole;return{command:'RESET',rows:[],rowCount:0};}if(text==='reset all')return{command:'RESET',rows:[],rowCount:0};
  if(text==='set role '+executor){role=executor;return{command:'SET',rows:[],rowCount:0};}
  if(text==='select current_user::text as current_user,session_user::text as session_user')return{rows:[{current_user:role,session_user:runtimeRole}],rowCount:1};
  if(text.includes('ce_guide_role_safety'))return{rows:[{safe:true}],rowCount:1};
  try{return await q(text,v);}catch(error){driverErrors.push(error);throw error;}
 };return c;}};
 h.fetch=async(url,init={})=>{const request=new NextRequest('http://ce.test'+url,{...init,headers:{origin:'http://ce.test',...init.headers}});const {handlers:handler}=binding.createCoreGuideRequestHandlersV1({request,runtime_pool:physical,target,connection_model:'direct'});if(init.method==='POST'){h.wires.push(init.body);return handler.POST(request);}return handler.GET(request);};
 return{h,observed,driverErrors,deny(){denied=true;}};
}
let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
await check('real Core binder -> actual CE6259 handler/provider -> canonical C03 create/edit/publish/cancel',async()=>{
 const {h,observed}=connected(),owner={},creator=client.createCe012GuideCreatorV1({fetch:h.fetch,context_id:ids.context,workspace_id:ids.workspace,owner:()=>owner,denied:()=>{}});
 const guide=await creator.create(input);assert.equal(h.f.created.get(guide).version,1);const original=h.wires.at(-1),replayed=await h.fetch('/api/customer/v1/experience/guides/draft',{method:'POST',headers:{'content-type':'application/json'},body:original});assert.equal(replayed.status,200);assert.equal(h.f.commits,1);assert.equal((await replayed.json()).replayed,true);
 // Drive exact actual editor protocol, preserving its original command identities.
 const command_id=crypto.randomUUID(),key='core-guide-r1-save-01';
 const prepared=await h.fetch('/api/customer/v1/experience/guides/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'prepare',context_id:ids.context,workspace_id:ids.workspace,guide_id:guide,expected_guide_version:1,command_id,idempotency_key:key,title:'Core coupled edit',step_title:'Edited step',instructions:'Synthetic edited instructions'})});assert.equal(prepared.status,200);const p=await prepared.json();
 const saved=await h.fetch('/api/customer/v1/experience/guides/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'execute',guide_command:p.guide_command,core_command:p.core_command})});assert.equal(saved.status,200);assert.equal(h.f.created.get(guide).version,2);
 for(const [operation,version,expected]of [['publish',2,'published'],['cancel',3,'cancelled']]){const a=actions.createCe012GuideActionsV1({fetch:h.fetch,context_id:ids.context,workspace_id:ids.workspace,guide_id:guide,version,owner:()=>owner,denied:()=>{}});await a.run(operation,...(operation==='cancel'?['Synthetic cancellation']:[]));assert.equal(h.f.created.get(guide).status,expected);assert.equal(h.f.created.get(guide).version,version+1);}
 const read=await h.fetch(`/api/customer/v1/experience/guides?context_id=${ids.context}&workspace_id=${ids.workspace}`);assert.equal(read.status,200);const body=await read.json();assert.equal(body.projection.guides[0].guide_id,guide);assert.equal(body.projection.guides[0].version,4);assert.equal(body.projection.guides[0].status,'cancelled');assert.equal(h.f.commits,4);
 const claims=observed.filter(v=>v.text.includes("set_config('request.jwt.claims',$1,true)"));assert.ok(claims.length>0);for(const q of claims){const token=JSON.parse(q.values[0]);assert.equal(token.sub,ids.actor);assert.equal(token.session_id,'80000000-0000-4000-8000-000000000001');assert.equal(token.exp,4070908800);}
 assert.equal(observed.some(v=>/service_catalog|services\.orders\.request/.test(v.text)),false);
});
await check('actual CE auth denial over official Core binding has no checkout/write',async()=>{const x=connected();x.deny();const before=x.h.f.commits;const r=await x.h.fetch(`/api/customer/v1/experience/guides?context_id=${ids.context}&workspace_id=${ids.workspace}`);assert.equal(r.status,401);assert.equal(x.observed.length,0);assert.equal(x.h.f.commits,before);});
await check('Core-composed lease retains exact40001 across bounded canonical-host attempts; no mutation commits',async()=>{
 const x=connected(),create=load('src/lib/community/experience-guide-create-writer-v1.ts'),error=Object.assign(new Error('controlled serialization'),{code:'40001'});x.h.f.faultSql=create.CE012_CREATE_GUIDE_SQL;x.h.f.driver=error;
 const creator=client.createCe012GuideCreatorV1({fetch:x.h.fetch,context_id:ids.context,workspace_id:ids.workspace,owner:()=>x,denied:()=>{}});await assert.rejects(creator.create(input));assert.equal(x.h.f.commits,0);assert.deepEqual(x.h.f.writes,[]);assert.equal(x.driverErrors.length,3);assert.ok(x.driverErrors.every(e=>e===error));
});
await check('expiry/revoke at post-reservation checkpoint rolls back through Core-composed lease',async()=>{
 const x=connected();x.h.f.expireAtReservation=true;const creator=client.createCe012GuideCreatorV1({fetch:x.h.fetch,context_id:ids.context,workspace_id:ids.workspace,owner:()=>x,denied:()=>{}});await assert.rejects(creator.create(input));assert.equal(x.h.f.commits,0);assert.deepEqual(x.h.f.writes,[]);assert.equal(x.h.f.created.size,0);
});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/Guide-R1',CE_SOURCE:CE,coupling_groups:n,scope:'ACTUAL_CORE_CE_C03_MODULES_CONTROLLED_SDK_PG',native:'NOT_RUN_NOT_PASS'}));
