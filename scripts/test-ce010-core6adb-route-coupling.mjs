/** Actual route -> official Core factory -> CE HTTP/provider/C03.
 * Fixture definitions only are reused; no owner suite is executed.
 * SDK/PG are controlled transports, not Auth/PG/native proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire,Module} from 'node:module';
import {dirname,resolve} from 'node:path';
import {EventEmitter} from 'node:events';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=resolve(new URL('..',import.meta.url).pathname);
const CORE='6adb3e3f0ffc72f1f138a4990b23653a7c5b62cd',CE='989e35a78363908357f65460011492e0472dc047';
const git=p=>execFileSync('git',['show',CE+':'+p],{encoding:'utf8',cwd:root});
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
assert.equal(require('next/package.json').version,'16.4.1');assert.equal(require('zod/package.json').version,'4.6.6');
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
let owner=execFileSync('git',['show',CORE+':scripts/test-core-ce010-request-binding-v1.mjs'],{encoding:'utf8',cwd:root});
owner=owner.slice(owner.indexOf('function harness(){'),owner.indexOf('let n=0;'));
// Load the actual combined candidate, not historical CE handler copies.
owner=owner.replace("rel.startsWith('src/lib/community/')?git(rel):readFileSync(p,'utf8')", "readFileSync(p,'utf8')");
const seam="if(q===resolve(root,'src/lib/supabase/env'))";
assert.ok(owner.includes(seam));
owner=owner.replace(seam,"if(q===resolve(root,'src/lib/community/community-announcement-platform-provider-v1'))return{get CE010_PLATFORM_PROVIDER_V1(){return state.provider;}};"+seam);
const factory="api=load('src/lib/core/ce010-request-binding-v1.ts');";
assert.ok(owner.includes(factory));
owner=owner.replace(factory,factory+`const actualFactory=api.createCoreCe010RequestRuntimeV1;state.factoryOptions=[];state.requests=[];
 api.createCoreCe010RequestRuntimeV1=options=>{state.factoryOptions.push(options);const rt=actualFactory(options);return{...rt,resolve(request,scope){state.requests.push(request);return rt.resolve(request,scope);}};};`);
const ret='return{state,f,target,api,runtime,load,http,domain,handlers,get,post,command};';
assert.ok(owner.includes(ret));
owner=owner.replace(ret,`state.provider={runtime_pool:f.pool,target,connection_model:'direct'};state.legacyReads=0;
 sdk.schema=()=>({rpc:async name=>{assert.equal(name,'read_ce_community_v1');state.legacyReads++;return{data:{workspace_id:id(3),communities:[],announcements:[],reports:[],limit:100},error:null};}});
 const route=load('src/app/api/customer/v1/community/base/route.ts');
 const request=(value)=>new NextRequest('http://ce.test/api/customer/v1/community/base'+(value===undefined?'?context_id='+id(4)+'&workspace_id='+id(3):''),value===undefined?{}:{method:'POST',headers:{origin:'http://ce.test','content-type':'application/json'},body:JSON.stringify(value)});
 return{state,f,target,api,runtime,load,http,domain,route,command,request};`);
const harness=new Function('readFileSync','execFileSync','require','Module','dirname','resolve','EventEmitter','ts','root','CE','git','id','assert',owner+'\nreturn harness;')(readFileSync,execFileSync,require,Module,dirname,resolve,EventEmitter,ts,root,CE,git,id,assert);
let n=0;async function check(name,fn){await fn();console.log('PASS '+(++n)+' '+name);}
await check('actual GET consumes official provider with original Request; read does not require publish',async()=>{
 const x=harness();x.f.canPublish=false;const request=x.request(),r=await x.route.GET(request);
 assert.equal(r.status,200);assert.equal((await r.json()).workspace_id,id(3));assert.match(r.headers.get('cache-control'),/no-store, private/);
 assert.equal(x.state.requests.at(-1),request);assert.equal(x.state.factoryOptions.at(-1),x.state.provider);assert.equal(x.state.legacyReads,0);assert.deepEqual(x.f.writes,[]);assert.equal(x.state.destroyed,1);
});
await check('actual POST prepare/execute UNKNOWN and explicit same-wire replay through official factory',async()=>{
 const x=harness(),prepare=x.request({op:'prepare_announcement',command:x.command}),p=await x.route.POST(prepare);assert.equal(p.status,200);assert.equal(x.state.requests.at(-1),prepare);
 const prepared=await p.json(),body={op:'execute_announcement',command:x.command,core_command:prepared.core_command},wire=JSON.stringify(body);
 x.f.lostCommit=true;const execute=x.request(body),r=await x.route.POST(execute);assert.equal(x.state.requests.at(-1),execute);assert.equal(r.status,202);assert.equal((await r.json()).outcome,'unknown');
 assert.equal(JSON.stringify(body),wire);assert.equal(x.f.commits,1);
 const replay=await x.route.POST(x.request(JSON.parse(wire)));assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);assert.equal(x.f.commits,1);assert.equal(x.f.announcements.size,1);assert.equal(x.state.legacyReads,0);
});
await check('NULL provider preserves accepted reader but native envelope remains unavailable',async()=>{
 const x=harness();x.state.provider=null;const factories=x.state.factoryOptions.length;
 assert.equal((await x.route.GET(x.request())).status,200);assert.equal(x.state.legacyReads,1);
 assert.equal((await x.route.POST(x.request({op:'prepare_announcement',command:x.command}))).status,503);assert.equal(x.state.factoryOptions.length,factories);assert.equal(x.state.checkout,0);assert.deepEqual(x.f.writes,[]);
});
await check('selected invalid binding or Guide/SERVICE target fails closed without fallback',async()=>{
 for(const role of ['cladora_ce_guide_runtime','cladora_service_subject_link_runtime']){const x=harness();x.state.provider={...x.state.provider,target:{...x.target,runtime_role:role}};
 assert.equal((await x.route.GET(x.request())).status,503);assert.equal((await x.route.POST(x.request({op:'prepare_announcement',command:x.command}))).status,503);assert.equal(x.state.legacyReads,0);assert.equal(x.state.checkout,0);assert.deepEqual(x.f.writes,[]);}
});
await check('missing either real safety helper blocks consumer SQL; no synthetic helper admission',async()=>{
 for(const name of ['assert_ce010_role_safety_v1','acquire_ce010_role_safety_lease_v1']){const x=harness();const source=readFileSync(resolve(root,'src/lib/core/platform-role-bound-pool-v1.ts'),'utf8');
 const match=source.match(new RegExp("'([^'\\n]*"+name+"[^'\\n]*)'"));assert.ok(match,'official helper SQL literal');
 x.state.failText=match[1];x.state.fail=Object.assign(Error('controlled missing helper'),{code:'42883'});
 assert.equal((await x.route.GET(x.request())).status,503);assert.equal(x.state.legacyReads,0);assert.ok(!x.state.trace.some(t=>t.text===x.http.CE010_NATIVE_READ_SQL));assert.equal(x.state.destroyed,1);assert.deepEqual(x.f.writes,[]);}
});
await check('selected Auth denial and revoke during read never fall back to weaker reader',async()=>{
 const x=harness();x.state.invalid=true;assert.equal((await x.route.GET(x.request())).status,401);assert.equal(x.state.legacyReads,0);assert.equal(x.state.checkout,0);
 const y=harness();y.state.readWait=()=>{y.state.revoked=true;};assert.equal((await y.route.GET(y.request())).status,403);assert.equal(y.state.legacyReads,0);assert.deepEqual(y.f.writes,[]);
});
console.log(JSON.stringify({groups:n,Core:CORE,consumer_parent:CE,proof:'ACTUAL_ROUTE_CORE_FACTORY_CE_PROVIDER_C03_CONTROLLED_TRANSPORT',native:'NOT_RUN_NOT_PASS',old_suites_run:false}));
