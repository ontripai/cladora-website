import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { z } from 'zod';

const require=createRequire(import.meta.url);let auth={data:{claims:{sub:'actor'}},error:null};let result={data:null,error:null};let calls=[];
const uuid=z.string().uuid();const responseSchema=z.strictObject({contract_version:z.literal('workspace-cost-benchmark.v1'),workspace_id:uuid}).passthrough();const cache=new Map();
function load(file){if(cache.has(file.href))return cache.get(file.href);const filename=fileURLToPath(file);const mod=new Module(filename);mod.require=name=>name==='@/lib/supabase/server'?{createClient:async()=>({auth:{getClaims:async()=>auth},schema:schema=>{assert.equal(schema,'customer_api');return{rpc:async(rpc,args)=>{calls.push({rpc,args});return result;}};}})}:name==='@/lib/customer/workspace-cost-benchmark-v1'?{workspaceCostBenchmarkV1Schema:responseSchema}:name.startsWith('@/')?load(new URL(`../src/${name.slice(2)}.ts`,import.meta.url)):require(name);mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);cache.set(file.href,mod.exports);return mod.exports;}
const {GET}=load(new URL('../src/app/api/customer/v1/cost-benchmark/route.ts',import.meta.url));const {NextRequest}=require('next/server');const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query={context_id:id(1),workspace_id:id(2),period_start:'2026-10-01',period_end:'2026-10-31',currency:'RON'};const projection={contract_version:'workspace-cost-benchmark.v1',workspace_id:id(2)};
const get=(value=query)=>GET(new NextRequest(`https://cladora.test/api/customer/v1/cost-benchmark?${new URLSearchParams(value)}`));async function check(name,run){calls=[];await run();console.log(`PASS ${name}`);}
await check('valid query delegates exact bounded RPC',async()=>{result={data:projection,error:null};const r=await get();assert.equal(r.status,200);assert.deepEqual(calls,[{rpc:'get_workspace_cost_benchmark_v1',args:{p_context_id:id(1),p_workspace_id:id(2),p_period_start:'2026-10-01',p_period_end:'2026-10-31',p_currency:'RON'}}]);});
for(const value of [{...query,tenant_id:id(9)},{...query,context_id:'bad'},{...query,period_end:'2025-01-01'},{...query,currency:'ron'}])await check('injected or malformed query is rejected',async()=>{assert.equal((await get(value)).status,400);assert.equal(calls.length,0);});
await check('duplicate parameter is rejected',async()=>{const raw=`context_id=${id(1)}&context_id=${id(3)}&workspace_id=${id(2)}&period_start=2026-10-01&period_end=2026-10-31&currency=RON`;assert.equal((await GET(new NextRequest(`https://cladora.test/api/customer/v1/cost-benchmark?${raw}`))).status,400);assert.equal(calls.length,0);});
await check('unauthenticated query is denied',async()=>{auth={data:null,error:null};assert.equal((await get()).status,401);assert.equal(calls.length,0);auth={data:{claims:{sub:'actor'}},error:null};});
for(const[code,status]of[['42501',403],['22023',400],['42883',503],['XX000',500]])await check(`database ${code} maps to bounded ${status}`,async()=>{result={data:null,error:{code,message:'private details'}};const r=await get();assert.equal(r.status,status);assert.doesNotMatch(JSON.stringify(await r.json()),/private details/);});
await check('malformed projection fails closed',async()=>{result={data:{},error:null};assert.equal((await get()).status,502);});
console.log('PASS C14 cost benchmark API boundary');
