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
 { ...base, idempotency_key: 'reservation-cancel-020', action: 'cancel_reservation', reservation_id: id(12), expected_version: 1, reason: 'Applicant cancelled the reservation.' },
 { ...base, idempotency_key: 'reservation-expire-020', action: 'expire_reservation', reservation_id: id(12), expected_version: 1, reason: 'Reservation reached its agreed expiry.' },
 { ...base, idempotency_key: 'reservation-extend-020', action: 'extend_reservation', reservation_id: id(12), expected_version: 1, reserved_until: '2026-10-09T10:00:00Z', reason: 'Owner approved a bounded extension.' },
 { ...base, idempotency_key: 'reservation-convert-020', action: 'convert_reservation', reservation_id: id(12), expected_version: 1, conversion_reference: 'urn:airprop:handoff:reservation-12', reason: 'Owner approved commercial handoff.' },
 { ...base, idempotency_key: 'listing-edit-019', action: 'edit_listing', listing_id: id(6), expected_version: 1, available_from: '2026-10-09T10:00:00Z', available_until: '2026-10-10T10:00:00Z', reason: 'Correct listing availability.' },
 { ...base, idempotency_key: 'listing-withdraw-019', action: 'withdraw_listing', listing_id: id(6), expected_version: 2, reason: 'Owner paused market activity.' },
 { ...base, idempotency_key: 'listing-republish-019', action: 'republish_listing', listing_id: id(6), expected_version: 3, available_from: '2026-10-11T10:00:00Z', available_until: null, reason: 'Owner approved renewed publication.' },
 { ...base, action: 'record_obligation_schedule', presale_contract_id: id(9), currency: 'EUR', total_amount: '100.0000', terms: [{ due_on: '2026-11-01', amount: 100, label: 'Deposit' }], financial_source_reference: 'urn:finance:test' },
 { ...base, action: 'link_execution', property_id: id(4), unit_id: id(5), kind: 'resale', core_record_id: id(10), commercial_terms: { price: '100.0000', currency: 'EUR' }, effective_from: '2026-10-07', effective_to: null },
 { ...base, action: 'link_execution', property_id: id(4), unit_id: id(5), kind: 'lease', core_record_id: id(13), commercial_terms: { rent_amount: 3200, currency: 'RON' }, effective_from: '2026-10-07', effective_to: '2027-10-07' },
 { ...base, action: 'link_execution', property_id: id(4), unit_id: null, kind: 'management_mandate', core_record_id: id(11), commercial_terms: { fee: '10' }, effective_from: '2026-10-07', effective_to: null },
 { ...base, idempotency_key: 'mandate-request-018', action: 'request_management_mandate', property_id: id(4), owner_party_id: id(7), scope: { capabilities: ['listing', 'owner_reporting'] }, valid_from: '2026-10-10', valid_to: '2027-10-10', proposal_evidence_reference: 'urn:document:mandate-proposal-018' },
 { ...base, idempotency_key: 'mandate-accept-018', action: 'accept_management_mandate', mandate_request_id: id(14), acceptance_evidence_reference: 'urn:document:mandate-acceptance-018' },
 { ...base, idempotency_key: 'mandate-work-order-018', action: 'link_management_work_order', mandate_request_id: id(14), work_order_id: id(15) },
 { ...base, idempotency_key: 'mandate-report-018', action: 'read_management_portfolio' },
];
const expectedRpc = ['publish_airprop_listing_v1','submit_airprop_applicant_v1','reserve_airprop_listing_v1','control_airprop_reservation_v1','control_airprop_reservation_v1','control_airprop_reservation_v1','control_airprop_reservation_v1','control_airprop_listing_v1','control_airprop_listing_v1','control_airprop_listing_v1','record_airprop_obligation_schedule_v1','link_airprop_commercial_execution_v1','link_airprop_commercial_execution_v1','link_airprop_commercial_execution_v1','request_airprop_management_mandate_v1','accept_airprop_management_mandate_v1','link_airprop_management_work_order_v1','read_airprop_management_portfolio_v1'];
let auth = { data: { claims: { sub: 'principal' } }, error: null }, result = { data: { version: 1, idempotent: false, record_id: id(12) }, error: null }, calls = [], cases = 0;
const contract = load('src/lib/airprop/commercial-lifecycle-v1.ts');
const route = load('src/app/api/customer/v2/airprop/commercial-lifecycle/route.ts', { '@/lib/airprop/commercial-lifecycle-v1': contract, '@/lib/airprop/diligence-route-response': load('src/lib/airprop/diligence-route-response.ts'), '@/lib/security/same-origin': load('src/lib/security/same-origin.ts'), '@/lib/security/request-body': load('src/lib/security/request-body.ts'), '@/lib/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => auth }, schema: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return result; } }) }) } });
const post = (body, headers = {}) => new NextRequest('https://cladora.test/api/customer/v2/airprop/commercial-lifecycle', { method: 'POST', headers: { origin: 'https://cladora.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const get = (query = `context_id=${id(1)}&workspace_id=${id(2)}`) => new NextRequest(`https://cladora.test/api/customer/v2/airprop/commercial-lifecycle?${query}`);
async function check(name, fn) { calls = []; await fn(); cases++; console.log(`PASS ${name}`); }
await check('all AIRPROP commercial actions map to bounded RPCs', async () => { for (let i=0;i<commands.length;i++) { const r=await route.POST(post(commands[i])); assert.equal(r.status,201); assert.equal(calls.at(-1).name,expectedRpc[i]); } });
for (const bad of [{ ...commands[0], actor_id: id(90) }, { ...commands[0], kind: 'service' }, { ...commands[2], reserved_until: 'tomorrow' }, { ...commands[3], expected_version: 0 }, { ...commands[4], reason: 'short' }, { ...commands[5], reserved_until: 'tomorrow' }, { ...commands[6], conversion_reference: 'short' }, { ...commands[7], expected_version: 0 }, { ...commands[7], available_until: '2026-10-08T10:00:00Z' }, { ...commands[8], reason: 'short' }, { ...commands[10], currency: 'euro' }, { ...commands[11], unit_id: null }, { ...commands[11], commercial_terms: { price: '100.0000' } }, { ...commands[11], commercial_terms: { price: '-1', currency: 'EUR' } }, { ...commands[11], effective_to: '2026-10-08' }, { ...commands[12], commercial_terms: { currency: 'RON' } }, { ...commands[12], commercial_terms: { rent_amount: 0, currency: 'RON' } }, { ...commands[12], commercial_terms: { rent_amount: 3200, currency: 'ron' } }, { ...commands[13], unit_id: id(5) }, { ...commands[13], effective_to: '2026-10-06' }, { ...commands[14], scope: { capabilities: [] } }, { ...commands[14], scope: { capabilities: ['listing', 'listing'] } }, { ...commands[14], scope: { capabilities: ['role_grant'] } }, { ...commands[14], valid_to: '2026-10-09' }, { ...commands[15], acceptance_evidence_reference: 'short' }]) await check('forged authority and malformed lifecycle commands are rejected', async () => { assert.equal((await route.POST(post(bad))).status,400); assert.equal(calls.length,0); });
await check('reservation controls map authority-neutral arguments to one bounded RPC', async () => {
  for (const [command, action] of [[commands[3], 'cancel'], [commands[4], 'expire'], [commands[5], 'extend'], [commands[6], 'convert']]) {
    await route.POST(post(command));
    const call = calls.at(-1);
    assert.equal(call.name, 'control_airprop_reservation_v1');
    assert.equal(call.args.p_action, action);
    assert.equal('p_actor_id' in call.args, false);
  }
});
await check('listing controls map authority-neutral arguments to one bounded RPC', async () => {
  for (const [command, action] of [[commands[7], 'edit'], [commands[8], 'withdraw'], [commands[9], 'republish']]) {
    await route.POST(post(command));
    const call = calls.at(-1);
    assert.equal(call.name, 'control_airprop_listing_v1');
    assert.equal(call.args.p_action, action);
    assert.equal('p_actor_id' in call.args, false);
  }
});
await check('resale receipt maps canonical Core reference without client authority', async () => {
  await route.POST(post(commands[11]));
  const call = calls.at(-1);
  assert.equal(call.name, 'link_airprop_commercial_execution_v1');
  assert.equal(call.args.p_kind, 'resale');
  assert.equal(call.args.p_core_record_id, id(10));
  assert.equal('p_actor_id' in call.args, false);
  assert.equal('p_transfer_title' in call.args, false);
});
await check('lease receipt maps canonical handover without client authority', async () => {
  await route.POST(post(commands[12]));
  const call = calls.at(-1);
  assert.equal(call.name, 'link_airprop_commercial_execution_v1');
  assert.equal(call.args.p_kind, 'lease');
  assert.equal(call.args.p_core_record_id, id(13));
  assert.equal('p_actor_id' in call.args, false);
  assert.equal('p_create_lease' in call.args, false);
});
await check('management mandate request and acceptance map no software authority fields', async () => {
  await route.POST(post(commands[14]));
  assert.equal(calls.at(-1).name, 'request_airprop_management_mandate_v1');
  assert.deepEqual(calls.at(-1).args.p_scope, { capabilities: ['listing', 'owner_reporting'] });
  assert.equal('p_permission_id' in calls.at(-1).args, false);
  assert.equal('p_role_id' in calls.at(-1).args, false);
  await route.POST(post(commands[15]));
  assert.equal(calls.at(-1).name, 'accept_airprop_management_mandate_v1');
  assert.equal('p_authority_id' in calls.at(-1).args, false);
});
await check('management work-order link maps only canonical identifiers', async () => {
  await route.POST(post(commands[16]));
  const call = calls.at(-1);
  assert.equal(call.name, 'link_airprop_management_work_order_v1');
  assert.equal(call.args.p_work_order_id, id(15));
  assert.equal('p_create_work_order' in call.args, false);
  assert.equal('p_payment' in call.args, false);
  assert.equal('p_outbox_event' in call.args, false);
});
await check('management portfolio report maps current context without client filters', async () => {
  await route.POST(post(commands[17]));
  const call = calls.at(-1);
  assert.equal(call.name, 'read_airprop_management_portfolio_v1');
  assert.deepEqual(Object.keys(call.args).sort(), ['p_context_id', 'p_workspace_id']);
  assert.equal('p_tenant_id' in call.args, false);
  assert.equal('p_include_finance' in call.args, false);
});
const managementPortfolio = {
  version: 1,
  idempotent: true,
  as_of: '2026-10-09T12:00:00Z',
  properties: [{
    mandate_request_id: id(14),
    property: { id: id(4), label: 'Old Town Residence' },
    owner: { party_id: id(7), label: 'Ionescu Family' },
    scope: { capabilities: ['listing', 'maintenance_coordination', 'owner_reporting'] },
    valid_from: '2026-10-10',
    valid_to: '2027-10-10',
    status: 'accepted',
    action_links: [{ action_link_id: id(16), core_record_type: 'maintenance.work_order', core_record_id: id(15), unit_id: id(5), source_status_snapshot: 'assigned', linked_at: '2026-10-09T11:00:00Z' }],
  }],
  operations: { detail_owner: 'Operations', mode: 'canonical_references_only' },
  finance: { detail_owner: 'Finance', mode: 'not_connected', reason: 'canonical_receipt_contract_unavailable' },
};
await check('read-only portfolio GET validates query and returns a strict current-authority report', async () => {
  result = { data: managementPortfolio, error: null };
  const response = await route.GET(get());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.deepEqual(await response.json(), managementPortfolio);
  assert.deepEqual(calls, [{ name: 'read_airprop_management_portfolio_v1', args: { p_context_id: id(1), p_workspace_id: id(2) } }]);
});
await check('portfolio GET rejects unknown filters before database access', async () => {
  assert.equal((await route.GET(get(`context_id=${id(1)}&workspace_id=${id(2)}&owner_id=${id(7)}`))).status, 400);
  assert.equal(calls.length, 0);
});
await check('portfolio GET requires authentication', async () => {
  auth = { data: null, error: null };
  assert.equal((await route.GET(get())).status, 401);
  assert.equal(calls.length, 0);
  auth = { data: { claims: { sub: 'principal' } }, error: null };
});
await check('portfolio GET redacts authority denial', async () => {
  result = { data: null, error: { code: '42501', message: 'private policy detail' } };
  const response = await route.GET(get());
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: { code: 'AIRPROP_COMMERCIAL_ACCESS_DENIED' } });
});
await check('portfolio GET fails closed on malformed cross-domain detail', async () => {
  result = { data: { ...managementPortfolio, finance: { detail_owner: 'AIRPROP', mode: 'embedded' } }, error: null };
  const response = await route.GET(get());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: 'AIRPROP_COMMERCIAL_FAILED' } });
});
await check('origin and media type are enforced before database access', async () => { assert.equal((await route.POST(post(commands[0],{origin:'https://evil.test'}))).status,403); assert.equal((await route.POST(post(commands[0],{'content-type':'text/plain'}))).status,415); assert.equal(calls.length,0); });
await check('authentication is required', async () => { auth={data:null,error:null};assert.equal((await route.POST(post(commands[0]))).status,401);assert.equal(calls.length,0);auth={data:{claims:{sub:'principal'}},error:null}; });
for (const [code,message,status,visible] of [['42501','mfa_required',403,'MFA_REQUIRED'],['42501','private detail',403,'AIRPROP_COMMERCIAL_ACCESS_DENIED'],['23P01','airprop_reservation_conflict',409,'COMMERCIAL_CONFLICT'],['23505','private',409,'COMMERCIAL_CONFLICT'],['22023','private',400,'INVALID_REQUEST'],['XX000','private',500,'AIRPROP_COMMERCIAL_FAILED']]) await check('database failures are redacted and classified', async () => { result={data:null,error:{code,message}};const r=await route.POST(post(commands[0]));assert.equal(r.status,status);assert.deepEqual(await r.json(),{error:{code:visible}}); });
await check('exact replay returns HTTP 200', async () => { result={data:{version:1,idempotent:true},error:null};assert.equal((await route.POST(post(commands[0]))).status,200); });
await check('malformed receipt fails closed', async () => { result={data:{idempotent:false},error:null};assert.equal((await route.POST(post(commands[0]))).status,500); });
console.log(`${cases} AIRPROP commercial lifecycle route checks passed`);
