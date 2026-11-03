import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { z } from 'zod';

const require = createRequire(import.meta.url);
let auth = { data: { claims: { sub: 'actor' } }, error: null };
let result = { data: null, error: null };
let calls = [];
const uuid = z.string().uuid();
const requestSchema = z.strictObject({ contract_version: z.literal('shared-capacity-allocation-receipt.v1'), request_id: uuid, idempotency_key: z.string(), context_id: uuid, workspace_id: uuid, source: z.object({}).passthrough(), policy_id: uuid, expected_policy_version: z.number(), requested_at: z.string(), action: z.string() });
const receiptSchema = z.strictObject({ contract_version: z.literal('shared-capacity-allocation-receipt.v1'), decision_status: z.string() }).passthrough();
const readSchema = z.strictObject({ contract_version: z.literal('c13-amenity-capacity.v1'), workspace_id: uuid, policies: z.array(z.unknown()), my_holds: z.array(z.unknown()), read_only_projection: z.literal(true) });
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file); const mod = new Module(filename);
  mod.require = name => name === '@/lib/supabase/server' ? { createClient: async () => ({ auth: { getClaims: async () => auth }, schema: schema => { assert.equal(schema, 'customer_api'); return { rpc: async (rpc, args) => { calls.push({ rpc, args }); return result; } }; } }) }
    : name === '@/lib/core/shared-capacity-time-v1' ? { sharedCapacityAllocationRequestV1Schema: requestSchema, sharedCapacityAllocationReceiptV1Schema: receiptSchema }
    : name === '@/lib/customer/amenity-capacity-v1' ? { amenityCapacityReadV1Schema: readSchema }
    : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  cache.set(file.href, mod.exports); return mod.exports;
}

const { GET, POST } = load(new URL('../src/app/api/customer/v1/amenities/reservations/route.ts', import.meta.url));
const { NextRequest } = require('next/server');
const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const command = { contract_version:'shared-capacity-allocation-receipt.v1',request_id:id(1),idempotency_key:'bk01-route-001',context_id:id(2),workspace_id:id(3),source:{consumer_domain:'community'},policy_id:id(4),expected_policy_version:1,requested_at:'2026-10-19T23:00:00Z',action:'request_hold' };
const receipt = { contract_version:'shared-capacity-allocation-receipt.v1',decision_status:'verified' };
const read = { contract_version:'c13-amenity-capacity.v1',workspace_id:id(3),policies:[],my_holds:[],read_only_projection:true };
const post = (body=command, headers={}) => POST(new NextRequest('https://cladora.test/api/customer/v1/amenities/reservations', { method:'POST',headers:{'content-type':'application/json',origin:'https://cladora.test',...headers},body:typeof body==='string'?body:JSON.stringify(body) }));
const get = (query=`context_id=${id(2)}&workspace_id=${id(3)}`) => GET(new NextRequest(`https://cladora.test/api/customer/v1/amenities/reservations?${query}`));
async function check(name, run) { calls=[]; await run(); console.log(`PASS ${name}`); }

await check('GET delegates exact bounded context and validates projection',async()=>{ result={data:read,error:null};const r=await get();assert.equal(r.status,200);assert.deepEqual(calls,[{rpc:'read_amenity_capacity_v1',args:{p_context_id:id(2),p_workspace_id:id(3)}}]); });
for(const query of [`context_id=${id(2)}&workspace_id=${id(3)}&tenant_id=${id(9)}`,`context_id=${id(2)}&context_id=${id(8)}&workspace_id=${id(3)}`,'context_id=bad']) await check('GET rejects injection, duplicates, or malformed context',async()=>{assert.equal((await get(query)).status,400);assert.equal(calls.length,0);});
await check('POST delegates strict command and validates receipt',async()=>{result={data:receipt,error:null};const r=await post();assert.equal(r.status,200);assert.deepEqual(calls,[{rpc:'command_amenity_capacity_v1',args:{p_request:command}}]);});
for(const body of [{...command,tenant_id:id(9)},{...command,workspace_id:'bad'},{}]) await check('POST rejects injected or malformed commands',async()=>{assert.equal((await post(body)).status,400);assert.equal(calls.length,0);});
await check('cross-origin command is denied before RPC',async()=>{assert.equal((await post(command,{origin:'https://evil.test'})).status,403);assert.equal(calls.length,0);});
await check('unauthenticated read and mutation are denied',async()=>{auth={data:null,error:null};assert.equal((await get()).status,401);assert.equal((await post()).status,401);auth={data:{claims:{sub:'actor'}},error:null};});
for(const [code,status] of [['42501',403],['23505',409],['40001',409],['22023',400],['42883',503],['XX000',500]]) await check(`database ${code} maps to bounded ${status}`,async()=>{result={data:null,error:{code,message:'private details'}};const r=await post();assert.equal(r.status,status);assert.doesNotMatch(JSON.stringify(await r.json()),/private details/);});
await check('malformed database read and receipt fail closed',async()=>{result={data:{},error:null};assert.equal((await get()).status,502);assert.equal((await post()).status,502);});

console.log('PASS BK01/C13 amenity API boundary');
