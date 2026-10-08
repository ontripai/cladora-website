import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, mocks = {}) { const filename = fileURLToPath(new URL(`../${path}`, import.meta.url)); const compiled = new Module(filename); compiled.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id); compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename); return compiled.exports; }
const { NextRequest } = require('next/server');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const base = { version: 1, context_id: id(1), workspace_id: id(2), idempotency_key: 'commercial-route-018' };
const commands = [
 { ...base, action: 'publish_listing', opportunity_id: id(3), property_id: id(4), unit_id: id(5), kind: 'presale', available_from: '2026-10-07T10:00:00Z', available_until: '2026-10-08T10:00:00Z' },
 { ...base, action: 'submit_applicant', listing_id: id(6), party_id: id(7) },
 { ...base, action: 'reserve_listing', listing_id: id(6), applicant_id: id(8), reserved_until: '2026-10-08T10:00:00Z' },
 { ...base, idempotency_key: 'listing-edit-019', action: 'edit_listing', listing_id: id(6), expected_version: 1, available_from: '2026-10-09T10:00:00Z', available_until: '2026-10-10T10:00:00Z', reason: 'Correct listing availability.' },
 { ...base, idempotency_key: 'listing-withdraw-019', action: 'withdraw_listing', listing_id: id(6), expected_version: 2, reason: 'Owner paused market activity.' },
 { ...base, idempotency_key: 'listing-republish-019', action: 'republish_listing', listing_id: id(6), expected_version: 3, available_from: '2026-10-11T10:00:00Z', available_until: null, reason: 'Owner approved renewed publication.' },
 { ...base, action: 'record_obligation_schedule', presale_contract_id: id(9), currency: 'EUR', total_amount: '100.0000', terms: [{ due_on: '2026-11-01', amount: 100, label: 'Deposit' }], financial_source_reference: 'urn:finance:test' },
 { ...base, action: 'link_execution', property_id: id(4), unit_id: id(5), kind: 'resale', core_record_id: id(10), commercial_terms: { price: '100' }, effective_from: '2026-10-07', effective_to: null },
 { ...base, action: 'link_execution', property_id: id(4), unit_id: null, kind: 'management_mandate', core_record_id: id(11), commercial_terms: { fee: '10' }, effective_from: '2026-10-07', effective_to: null },
];
const expectedRpc = ['publish_airprop_listing_v1','submit_airprop_applicant_v1','reserve_airprop_listing_v1','control_airprop_listing_v1','control_airprop_listing_v1','control_airprop_listing_v1','record_airprop_obligation_schedule_v1','link_airprop_commercial_execution_v1','link_airprop_commercial_execution_v1'];
let auth = { data: { claims: { sub: 'principal' } }, error: null }, result = { data: { version: 1, idempotent: false, record_id: id(12) }, error: null }, calls = [], cases = 0;
const contract = load('src/lib/airprop/commercial-lifecycle-v1.ts');
const route = load('src/app/api/customer/v2/airprop/commercial-lifecycle/route.ts', { '@/lib/airprop/commercial-lifecycle-v1': contract, '@/lib/airprop/diligence-route-response': load('src/lib/airprop/diligence-route-response.ts'), '@/lib/security/same-origin': load('src/lib/security/same-origin.ts'), '@/lib/security/request-body': load('src/lib/security/request-body.ts'), '@/lib/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => auth }, schema: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return result; } }) }) } });
const post = (body, headers = {}) => new NextRequest('https://cladora.test/api/customer/v2/airprop/commercial-lifecycle', { method: 'POST', headers: { origin: 'https://cladora.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
async function check(name, fn) { calls = []; await fn(); cases++; console.log(`PASS ${name}`); }
await check('all AIRPROP commercial actions map to bounded RPCs', async () => { for (let i=0;i<commands.length;i++) { const r=await route.POST(post(commands[i])); assert.equal(r.status,201); assert.equal(calls.at(-1).name,expectedRpc[i]); } });
for (const bad of [{ ...commands[0], actor_id: id(90) }, { ...commands[0], kind: 'service' }, { ...commands[2], reserved_until: 'tomorrow' }, { ...commands[3], expected_version: 0 }, { ...commands[3], available_until: '2026-10-08T10:00:00Z' }, { ...commands[4], reason: 'short' }, { ...commands[6], currency: 'euro' }, { ...commands[7], unit_id: null }, { ...commands[8], unit_id: id(5) }, { ...commands[8], effective_to: '2026-10-06' }]) await check('forged authority and malformed lifecycle commands are rejected', async () => { assert.equal((await route.POST(post(bad))).status,400); assert.equal(calls.length,0); });
await check('listing controls map authority-neutral arguments to one bounded RPC', async () => {
  for (const [command, action] of [[commands[3], 'edit'], [commands[4], 'withdraw'], [commands[5], 'republish']]) {
    await route.POST(post(command));
    const call = calls.at(-1);
    assert.equal(call.name, 'control_airprop_listing_v1');
    assert.equal(call.args.p_action, action);
    assert.equal('p_actor_id' in call.args, false);
  }
});
await check('origin and media type are enforced before database access', async () => { assert.equal((await route.POST(post(commands[0],{origin:'https://evil.test'}))).status,403); assert.equal((await route.POST(post(commands[0],{'content-type':'text/plain'}))).status,415); assert.equal(calls.length,0); });
await check('authentication is required', async () => { auth={data:null,error:null};assert.equal((await route.POST(post(commands[0]))).status,401);assert.equal(calls.length,0);auth={data:{claims:{sub:'principal'}},error:null}; });
for (const [code,message,status,visible] of [['42501','mfa_required',403,'MFA_REQUIRED'],['42501','private detail',403,'AIRPROP_COMMERCIAL_ACCESS_DENIED'],['23P01','airprop_reservation_conflict',409,'COMMERCIAL_CONFLICT'],['23505','private',409,'COMMERCIAL_CONFLICT'],['22023','private',400,'INVALID_REQUEST'],['XX000','private',500,'AIRPROP_COMMERCIAL_FAILED']]) await check('database failures are redacted and classified', async () => { result={data:null,error:{code,message}};const r=await route.POST(post(commands[0]));assert.equal(r.status,status);assert.deepEqual(await r.json(),{error:{code:visible}}); });
await check('exact replay returns HTTP 200', async () => { result={data:{version:1,idempotent:true},error:null};assert.equal((await route.POST(post(commands[0]))).status,200); });
await check('malformed receipt fails closed', async () => { result={data:{idempotent:false},error:null};assert.equal((await route.POST(post(commands[0]))).status,500); });
console.log(`${cases} AIRPROP commercial lifecycle route checks passed`);
