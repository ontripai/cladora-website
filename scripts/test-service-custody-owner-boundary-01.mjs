/** Real owner route/binding; Core/official Auth responses controlled; no DB/Auth target. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {NextRequest}=require('next/server');
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const url='http://localhost:3008/api/customer/v1/services/command-custody';
process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE='core-service-real-app-assembly.v1';
process.env.CLADORA_CORE15_SERVICE_BINDING_SHA256='a'.repeat(64);
function fixture(mode='valid'){
 const counts={verify:0,bind:0,pool:0,business:0},cache=new Map();
 const auth={auth:{getUser:async()=>({data:{user:mode==='anonymous'?null:{id:id(1),user_metadata:{session_id:id(90),admin:true}}},error:null}),
 getClaims:async()=>({data:{claims:{sub:mode==='mismatch'?id(2):id(1),session_id:mode==='new-session'?id(4):id(3),aal:mode==='aal1'?'aal1':'aal2',role:'authenticated',exp:2000000000}},error:null})}};
 const binding={contract_version:'service-functional-request-runtime.v1',core_contract:'core15-service-request-runtime.v1',database_contract:'platform12-service-request-database.v1',bind:async()=>{counts.bind++;return null;}};
 function load(file){
  if(!extname(file))file+='.ts';if(cache.has(file))return cache.get(file).exports;
  if(file.endsWith('/core/private-service-development-binding-v1.ts'))return{
   getCore15PrivateServiceDevelopmentBindingV1:()=>binding,
   getCoreServiceAppRuntimeV1:()=>mode==='inactive'?null:{verifyServerSession:async()=>{counts.verify++;if(mode==='anonymous')throw Object.assign(Error('synthetic Auth rejection'),{code:'AUTHENTICATION_REQUIRED'});}},
  };
  if(file.endsWith('/core/functional-request-auth-v1.ts'))return{createCoreFunctionalRequestAuthV1:async()=>auth};
  if(file.endsWith('/supabase/env.ts'))return{getPublicSupabaseEnv:()=>({url:'http://127.0.0.1:55421',publishableKey:'synthetic-public-key'})};
  const mod={exports:{}};cache.set(file,mod);
  if(file.endsWith('.json')){mod.exports=JSON.parse(readFileSync(file,'utf8'));return mod.exports;}
  function imported(name){if(name==='server-only')return{};if(name.startsWith('@/'))return load(resolve(root,'src',name.slice(2)));if(name.startsWith('.'))return load(resolve(dirname(file),name));return require(name);}
  const code=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(imported,mod,mod.exports);return mod.exports;
 }
 return{route:load(resolve(root,'src/app/api/customer/v1/services/command-custody/route.ts')),
  owner:load(resolve(root,'src/lib/customer/service-v14-execution/custody-owner.ts')),
  binding:load(resolve(root,'src/lib/customer/service-v14-execution/runtime-binding.ts')),counts};
}
let checks=0;
async function check(name,run){await run();checks++;console.log('PASS '+name);}
await check('owner route returns only an opaque stable label, no raw actor/session/JWT',async()=>{const f=fixture();const a=await f.route.GET(new NextRequest(url)),b=await f.route.GET(new NextRequest(url));assert.equal(a.status,200);const one=await a.json(),two=await b.json();assert.deepEqual(one,two);assert.deepEqual(Object.keys(one).sort(),['contract','owner']);assert.match(one.owner,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(one),new RegExp(id(1)+'|'+id(3)));assert.match(a.headers.get('cache-control'),/no-store/);assert.equal(a.headers.get('vary'),'Cookie');assert.equal(f.counts.pool,0);});
await check('new session or target binding changes the label',async()=>{const a=await fixture().owner.serviceRequestCustodyOwner(new NextRequest(url));const b=await fixture('new-session').owner.serviceRequestCustodyOwner(new NextRequest(url));assert.notEqual(a,b);process.env.CLADORA_CORE15_SERVICE_BINDING_SHA256='b'.repeat(64);const c=await fixture().owner.serviceRequestCustodyOwner(new NextRequest(url));assert.notEqual(a,c);process.env.CLADORA_CORE15_SERVICE_BINDING_SHA256='a'.repeat(64);});
await check('anonymous and actor mismatch reject rather than returning a label',async()=>{for(const mode of ['anonymous','mismatch','aal1']){const f=fixture(mode);const response=await f.route.GET(new NextRequest(url));assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:{code:'UNAUTHORIZED'}});assert.equal(f.counts.pool,0);}});
await check('inactive runtime is503 and a public profile flag cannot activate the route',async()=>{assert.equal((await fixture('inactive').route.GET(new NextRequest(url))).status,503);process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE='';process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY='v1';assert.equal((await fixture().route.GET(new NextRequest(url))).status,503);process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE='core-service-real-app-assembly.v1';});
await check('query input is rejected before Auth or any pool/bind operation',async()=>{const f=fixture();assert.equal((await f.route.GET(new NextRequest(url+'?actor='+id(1)))).status,400);assert.equal(f.counts.verify,0);assert.equal(f.counts.bind,0);});
await check('matching continuity label reaches the same canonical binding',async()=>{const f=fixture(),label=await f.owner.serviceRequestCustodyOwner(new NextRequest(url));await f.binding.getServiceOfferingRequestRuntimeBinding()(new NextRequest(url,{headers:{'x-cladora-service-custody':label}}));assert.equal(f.counts.bind,1);assert.equal(f.counts.pool,0);});
await check('stale account/session hint is denied before binding or business dispatch',async()=>{const old=await fixture().owner.serviceRequestCustodyOwner(new NextRequest(url));const f=fixture('new-session');await assert.rejects(f.binding.getServiceOfferingRequestRuntimeBinding()(new NextRequest(url,{headers:{'x-cladora-service-custody':old}})),e=>e.code==='ACTOR_BINDING_MISMATCH');assert.equal(f.counts.bind,0);assert.equal(f.counts.business,0);});
await check('malformed hint is denied without any Auth/pool/bind call',async()=>{const f=fixture();await assert.rejects(f.binding.getServiceOfferingRequestRuntimeBinding()(new NextRequest(url,{headers:{'x-cladora-service-custody':'malformed'}})),e=>e.code==='ACTOR_BINDING_MISMATCH');assert.equal(f.counts.verify,0);assert.equal(f.counts.bind,0);});
await check('ordinary clients without a hint retain their canonical binding behavior',async()=>{const f=fixture();await f.binding.getServiceOfferingRequestRuntimeBinding()(new NextRequest(url));assert.equal(f.counts.bind,1);assert.equal(f.counts.verify,0);});
console.log(JSON.stringify({task:'SERVICE-CUSTODY-OWNER-BOUNDARY-01',checks,status:'PASS_CONTROLLED_ONLY',native:'NOT_RUN_NOT_PASS'}));
