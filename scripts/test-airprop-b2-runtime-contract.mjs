import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createB2Loader } from './lib/airprop-b2-test-loader.mjs';
import { createB2ContractPool, persistedB2Effects } from './lib/airprop-b2-contract-pool.mjs';

const { createAirpropB2Runtime } = createB2Loader()('src/lib/airprop/artifact-b2-runtime.ts');
const actor = randomUUID(), context = randomUUID(), workspace = randomUUID(), property = randomUUID();
const binding = { actor_id: actor, context_id: context, workspace_id: workspace, property_id: property,
  authority_version: 7, aggregate_version: 1, transaction_id: randomUUID(), command_id: randomUUID() };
const base = { version: 1, context_id: context, workspace_id: workspace, idempotency_key: 'b2-test-0001' };
const listing = { ...base, action: 'withdraw_listing', listing_id: randomUUID(), expected_version: 1, reason: 'Contract test withdraw' };
const zero = { domain: 0, audit: 0, outbox: 0, idempotency: 0 };
let passed = 0;
async function check(name, run) { await run(); console.log(`ok ${++passed} - ${name}`); }
async function denied(name, configure, b = binding, command = listing, code) {
  await check(name, async () => {
    const pool = createB2ContractPool(actor); configure(pool.state);
    const result = await createAirpropB2Runtime(pool).execute(b, command);
    assert.equal(result.status, 'denied'); if (code) assert.equal(result.code, code);
    assert.deepEqual(persistedB2Effects(pool), zero);
    assert.equal(pool.state.queries.some(text => text.startsWith('insert into') || text.startsWith('select customer_api.')), false,
      'denial must occur before staging any write');
  });
}
await denied('pre-activation EXECUTE gate: zero writes', () => {}, binding, listing, 'PROVIDER_UNAVAILABLE');
await denied('stale canonical epoch: zero writes', s => { s.gate = true; }, { ...binding, authority_version: 6 }, listing, 'AUTHORITY_DENIED');
await denied('revoked membership: zero writes', s => { s.gate = true; s.revoked = true; });
await denied('canonical permission denial: zero writes', s => { s.gate = true; s.permission = false; }, binding, listing, 'AUTHORITY_DENIED');
await denied('cross-Workspace trusted binding: zero connections/writes', s => { s.gate = true; }, binding, { ...listing, workspace_id: randomUUID() }, 'AUTHORITY_DENIED');
await denied('canonical provider failure: zero writes', s => { s.gate = true; s.failure = 'provider'; }, binding, listing, 'TRANSACTION_FAILED');
await denied('forged JSON authority fields rejected', s => { s.gate = true; }, binding, { ...listing, authority_version: 7 }, 'INVALID_COMMAND');
await denied('aggregate version mismatch rejected before writes', s => { s.gate = true; }, binding, { ...listing, expected_version: 2 }, 'AUTHORITY_DENIED');

await check('shared ledger commit, fresh-authority exact replay, conflict and revoked replay', async () => {
  const pool = createB2ContractPool(actor); pool.state.gate = true;
  const runtime = createAirpropB2Runtime(pool);
  const first = await runtime.execute(binding, listing);
  assert.equal(first.status, 'committed');
  const effects = persistedB2Effects(pool); assert.deepEqual(effects, { domain: 1, audit: 1, outbox: 1, idempotency: 1 });
  const revisions = () => pool.state.queries.filter(sql => sql.includes('canonical_authority_revision_v1')).length;
  const reads = revisions();
  const replay = await runtime.execute(binding, listing);
  assert.equal(replay.status, 'exact_replay'); assert.deepEqual(replay.receipt, first.receipt);
  assert.equal(revisions(), reads + 1); assert.deepEqual(persistedB2Effects(pool), effects);
  const before = pool.state.queries.length;
  const conflict = await runtime.execute(binding, { ...listing, reason: 'Conflicting input reason' });
  assert.equal(conflict.code, 'REPLAY_CONFLICT'); assert.deepEqual(persistedB2Effects(pool), effects);
  assert.equal(pool.state.queries.slice(before).some(sql => sql.startsWith('insert into')), false);
  pool.state.revoked = true;
  assert.equal((await runtime.execute(binding, listing)).status, 'denied');
  assert.deepEqual(persistedB2Effects(pool), effects);
});
await check('domain provider failure rolls back all shared effects', async () => {
  const pool = createB2ContractPool(actor); pool.state.gate = true; pool.state.failure = 'mutation';
  assert.equal((await createAirpropB2Runtime(pool).execute(binding, listing)).status, 'denied');
  assert.deepEqual(persistedB2Effects(pool), zero);
});
await check('uncertain commit requires read-back and never automatically retries', async () => {
  const pool = createB2ContractPool(actor); pool.state.gate = true; pool.state.failure = 'commit';
  assert.equal((await createAirpropB2Runtime(pool).execute(binding, listing)).status, 'unknown_commit');
  assert.equal(pool.state.connections, 1);
});
await check('all seven mutation gateway families use supplied scope and existing A signatures', async () => {
  const commands = [listing,
    { ...base, action: 'cancel_reservation', reservation_id: randomUUID(), expected_version: 1, reason: 'Contract test cancel' },
    { ...base, action: 'record_obligation_schedule', presale_contract_id: randomUUID(), currency: 'EUR', total_amount: '12.00', terms: [{ due_on: '2026-12-01', amount: 12, label: 'Contract term' }], financial_source_reference: 'canonical-receipt-01' },
    { ...base, action: 'link_execution', property_id: property, unit_id: randomUUID(), kind: 'resale', core_record_id: randomUUID(), commercial_terms: { price: '12.00', currency: 'EUR' }, effective_from: '2026-12-01', effective_to: null },
    { ...base, action: 'request_management_mandate', property_id: property, owner_party_id: randomUUID(), scope: { capabilities: ['owner_reporting'] }, valid_from: '2026-12-01', valid_to: '2027-12-01', proposal_evidence_reference: 'canonical-evidence-01' },
    { ...base, action: 'accept_management_mandate', mandate_request_id: randomUUID(), acceptance_evidence_reference: 'canonical-evidence-02' },
    { ...base, action: 'link_management_work_order', mandate_request_id: randomUUID(), work_order_id: randomUUID() },
  ];
  for (const command of commands) {
    const pool = createB2ContractPool(actor); pool.state.gate = true;
    assert.equal((await createAirpropB2Runtime(pool).execute(binding, command)).status, 'committed', command.action);
    assert.equal(pool.state.connections, 1);
    assert.equal(pool.state.queries.filter(sql => sql.startsWith('select customer_api.')).length, 1);
  }
});
console.log(`PASS ${passed} B2 runtime-contract cases; deterministic pool fixture; live SQL/HTTP/AAL2 NOT_RUN_NOT_PASS`);
