// New G2 tests only. RPC rows/session/transport controlled; no PostgreSQL proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Module, createRequire } from 'node:module';
import { createEventCommandSession } from '../src/lib/community/event-interest-client.ts';
const require = createRequire(import.meta.url);
const id = n => `24900000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const command = { type:'publish_event', command_id:id(1), idempotency_key:'ce011.lookup.original', context_id:id(2), workspace_id:id(3), event_id:id(4), expected_version:2, reason:'Original command reason' };
const receipt = {entity_type:'event',entity_id:id(4),version:3,command:'publish_event',replayed:false};
const match = {contract:'ce011-receipt-lookup.v1',status:'matched',result:receipt};
const unresolved = {contract:'ce011-receipt-lookup.v1',status:'unresolved'};
const cases=[];
let owner={}, calls=[], accepted=[], denied=0, mode, release;
function session() { return createEventCommandSession({contextId:id(2),workspaceId:id(3),owner:()=>owner,onState:()=>{},accepted:(...x)=>accepted.push(x),denied:()=>denied++,timeoutMs:100,
 fetch:async(url,init)=>{calls.push({url,wire:init.body});if(!url.endsWith('/receipt'))throw Error('lost');
 if(mode==='late')return {ok:true,status:200,json:()=>new Promise(r=>{release=()=>r(match);})};
 if(typeof mode==='number')return Response.json({error:'private'},{status:mode});return Response.json(mode);}}); }
for(const value of [unresolved,{...unresolved,reason:'expired'},null,{...match,result:{...receipt,version:9}},{...match,private_row:{}},503,403,500]) {
 owner={};calls=[];accepted=[];denied=0;const s=session();await s.send(command);const pending=s.getState().pending;mode=value;assert.equal(await s.lookup(),false);
 assert.equal(s.getState().pending,pending);assert.equal(s.getState().phase,'unknown');assert.equal(accepted.length,0);assert.equal(calls.length,2);assert.equal(calls[1].wire,calls[0].wire);assert.ok(calls[1].url.endsWith('/receipt'));
 if(value===403)assert.equal(denied,1);if(value===503)assert.equal(s.getState().failure,'not_ready');cases.push('unresolved/invalid/error preserves exact pending: '+JSON.stringify(value));
}
owner={};calls=[];accepted=[];let s=session();await s.send(command);mode=match;assert.equal(await s.lookup(),true);assert.equal(s.getState().phase,'done');assert.equal(s.getState().pending,null);assert.equal(accepted.length,1);assert.deepEqual(accepted[0][1],receipt);assert.equal(calls.length,2);cases.push('historical valid result resolves UNKNOWN without resend');
owner={};calls=[];accepted=[];s=session();await s.send(command);mode='late';const lookup=s.lookup();await new Promise(r=>setTimeout(r,0));owner={};release();assert.equal(await lookup,false);assert.ok(s.getState().pending);assert.equal(accepted.length,0);cases.push('late decoded lookup cannot publish or clear pending');
owner={};calls=[];s=session();await s.send(command);mode='late';const wait=s.lookup();await new Promise(r=>setTimeout(r,0));assert.equal(await s.replay(),false);s.invalidate();assert.equal(await wait,false);release();assert.ok(s.getState().pending);cases.push('lookup shares flight lock/cancellation with existing replay');
let rpcResult=match,rpcError=null,rpcCalls=[],auth=true;
const cache=new Map();
function load(p) {p=path.resolve(p);if(cache.has(p))return cache.get(p).exports;const m=new Module(p);cache.set(p,m);
 m.require=name=>name==='next/server'?{NextResponse:{json:(b,i)=>Response.json(b,i)}}:name==='@/lib/supabase/server'?{createClient:async()=>({auth:{getClaims:async()=>({data:auth?{claims:{sub:id(9)}}:null,error:null})},schema:()=>({rpc:async(name,args)=>{rpcCalls.push({name,args});return{data:rpcResult,error:rpcError};}})})}:name.startsWith('@/')?load('src/'+name.slice(2)+'.ts'):name.startsWith('.')?load(path.resolve(path.dirname(p),name.endsWith('.ts')?name:name+'.ts')):require(name);
 m._compile(require('typescript').transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:1,target:9}}).outputText,p);return m.exports;}
const {POST}=load('src/app/api/customer/v1/community/events/receipt/route.ts');
function request(body=command,extra={}) {return new Request('http://ce.test/api/customer/v1/community/events/receipt',{method:'POST',headers:{origin:'http://ce.test','content-type':'application/json',...extra},body:JSON.stringify(body)});}
let r=await POST(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),match);assert.deepEqual(rpcCalls[0],{name:'lookup_ce_event_receipt_v1',args:{p_request:command}});assert.match(r.headers.get('cache-control'),/private/);assert.match(r.headers.get('cache-control'),/no-store/);
for(const field of ['actor','tenant_id','hash','permission']) {const count=rpcCalls.length;assert.equal((await POST(request({...command,[field]:'client-proof'}))).status,400);assert.equal(rpcCalls.length,count);}
auth=false;assert.equal((await POST(request())).status,401);auth=true;
for(const [code,status] of [['42501',403],['23505',409],['42883',503],['PGRST202',503],['XX000',500]]){rpcError={code,message:'PRIVATE'};r=await POST(request());assert.equal(r.status,status);assert.doesNotMatch(JSON.stringify(await r.json()),/PRIVATE/);}
rpcError=null;for(const bad of [null,{...match,result:{...receipt,entity_id:id(99)}},{...match,result:{...receipt,version:4}}]){rpcResult=bad;assert.equal((await POST(request())).status,502);}
cases.push('actual route strict request/result, server claims, bounded errors/no-store and single read RPC');
const sql=fs.readFileSync('supabase/proposals/ce_011_receipt_lookup_v1.sql','utf8');const original=fs.readFileSync('supabase/proposals/ce_011_event_interest_operational_v1.sql','utf8');
for(const prefix of [' v_key:=',' v_hash:='])assert.equal(sql.split('\n').find(x=>x.startsWith(prefix)),original.split('\n').find(x=>x.startsWith(prefix)),'EXACT existing SQL canonical expression');
const executable=sql.replace(/--[^\n]*/g,'');assert.doesNotMatch(executable,/\b(insert|update|delete|grant)\s/i);assert.match(executable,/for share/);assert.match(executable,/represented_party_id is distinct from/);assert.match(executable,/response_ref is distinct from v_result/);assert.match(executable,/expires_at<=clock_timestamp/);cases.push('SQL source canonical identity/read-only guards (not native hash/wait/zero-write proof)');
console.log(JSON.stringify({task:'CE011-RECEIPT-LOOKUP-04',result:'PASS_CONTROLLED',count:cases.length,cases,native:'NOT_RUN_NOT_PASS',toolchain:{next:require('next/package.json').version,zod:require('zod/package.json').version}},null,2));
