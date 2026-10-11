import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url); const cache = new Map();
function load(file) { if (cache.has(file.href)) return cache.get(file.href); const result = ts.transpileModule(readFileSync(file, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }); const mod = { exports: {} };
  const localRequire = moduleId => moduleId.startsWith('.') ? load(new URL(`${moduleId}.ts`, file)) : require(moduleId);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, mod, mod.exports); cache.set(file.href, mod.exports); return mod.exports; }
const sourceText = readFileSync(new URL('../src/lib/customer/service-experience-v14-schema.ts', import.meta.url), 'utf8');
const { SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT: contract,
  SERVICE_EXPERIENCE_COORDINATION_PROVIDER_SHA: providerSha,
  serviceExperienceIntentV1Schema: schema,
  serviceExperienceCoordinationReceiptV1Schema: receiptSchema,
  fingerprintServiceExperienceIntent: fingerprint,
  evaluateServiceExperienceIntent: evaluate } = load(new URL('../src/lib/customer/service-experience-v14-schema.ts', import.meta.url));
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const common = { contract, version: 1, context_id: id(1), workspace_id: id(2), service_order_id: id(3),
  expected_order_version: 4, actor_reference_id: id(4), participant_reference_id: id(5), coordination_source_id: id(6),
  expected_coordination_source_version: 7, idempotency_key: 'service-experience-action-001' };
const intent = { ...common, action: 'acknowledge_component_status', component_id: id(8), expected_component_version: 9,
  status_reference_id: id(10) };
const receipt = { contract, version: 1, receipt_id: id(11), decision_status: 'verified', result_code: 'OK',
  action: intent.action, workspace_id: intent.workspace_id, service_order_id: intent.service_order_id,
  service_order_version: intent.expected_order_version, subject_kind: 'component', subject_id: intent.component_id,
  subject_version: intent.expected_component_version, coordination_source_id: intent.coordination_source_id,
  coordination_source_version: intent.expected_coordination_source_version, status_reference_id: intent.status_reference_id,
  reason_code: null, actor_authority: 'verified', participant_authority: 'verified', current_coordination_state: 'available',
  resulting_coordination_state: 'component_status_acknowledged', idempotency_binding_id: id(12),
  evaluated_at: '2026-10-11T11:30:00+00:00' };
const snapshot = { authority: { actor_reference_id: id(4), workspace_id: id(2), result: 'allowed' },
  participant: { participant_reference_id: id(5), workspace_id: id(2), membership_state: 'active' },
  order: { id: id(3), workspace_id: id(2), version: 4, state: 'in_progress' },
  subject: { kind: 'component', id: id(8), workspace_id: id(2), service_order_id: id(3), version: 9, state: 'available' },
  source: { id: id(6), workspace_id: id(2), version: 7, state: 'available' },
  allowed_actions: ['acknowledge_component_status', 'request_cancellation', 'request_compensation', 'accept_compensation'],
  resolution: 'known', receipt_reference: { receipt_id: id(11), idempotency_key: intent.idempotency_key,
    input_fingerprint: fingerprint(intent), idempotency_binding_id: id(12), evaluated_at: receipt.evaluated_at },
  coordination_receipt: receipt };

assert.equal(providerSha, '2a6a52ffbb97ace228daf9221404f308aa05668c');
assert.equal(schema.safeParse(intent).success, true);
assert.equal(receiptSchema.safeParse(receipt).success, true);
assert.equal(evaluate(intent, snapshot), 'OK');
const cancellation = { ...common, action: 'request_cancellation', reason_code: 'CUSTOMER_REQUEST' };
const compensation = { ...common, action: 'request_compensation', component_id: id(8), expected_component_version: 9,
  reason_code: 'SERVICE_FAILURE' };
const acceptance = { ...common, action: 'accept_compensation', compensation_reference_id: id(13),
  expected_compensation_version: 2 };
for (const value of [cancellation, compensation, acceptance]) assert.equal(schema.safeParse(value).success, true);
for (const field of ['actor_id', 'authority_result', 'participant_membership', 'experience_state', 'cancellation_state',
  'compensation_amount', 'currency', 'tax', 'rounding', 'benefit_id', 'payment_id', 'refund_id', 'ledger_entry_id',
  'notification_status', 'result_code']) {
  assert.equal(schema.safeParse({ ...intent, [field]: 'client-claim' }).success, false, field);
}
assert.equal(evaluate(intent, { ...snapshot, authority: { ...snapshot.authority, result: 'denied' } }), 'AUTHORITY_DENIED');
assert.equal(evaluate(intent, { ...snapshot, participant: { ...snapshot.participant, membership_state: 'revoked' } }), 'PARTICIPANT_DENIED');
assert.equal(evaluate(intent, { ...snapshot, order: { ...snapshot.order, version: 5 } }), 'STALE_ORDER');
assert.equal(evaluate(intent, { ...snapshot, source: { ...snapshot.source, version: 8 } }), 'STALE_SOURCE');
assert.equal(evaluate(intent, { ...snapshot, subject: { ...snapshot.subject, version: 10 } }), 'STALE_SUBJECT');
assert.equal(evaluate(intent, { ...snapshot, coordination_receipt: null }), 'COORDINATION_RECEIPT_REQUIRED');
assert.equal(evaluate(intent, { ...snapshot, receipt_reference: { ...snapshot.receipt_reference,
  idempotency_key: 'service-experience-action-002' } }), 'REPLAY_CONFLICT');
assert.equal(evaluate(intent, { ...snapshot, receipt_reference: { ...snapshot.receipt_reference,
  input_fingerprint: 'different' } }), 'REPLAY_CONFLICT');
assert.equal(evaluate(intent, { ...snapshot, coordination_receipt: { ...receipt,
  coordination_source_version: 8 } }), 'COORDINATION_RECEIPT_MISMATCH');
assert.equal(evaluate(intent, { ...snapshot, coordination_receipt: { ...receipt,
  status_reference_id: id(99) } }), 'COORDINATION_RECEIPT_MISMATCH');
assert.equal(receiptSchema.safeParse({ ...receipt, action: 'request_cancellation', subject_kind: 'none', subject_id: null,
  subject_version: null, status_reference_id: id(10), reason_code: 'CUSTOMER_REQUEST',
  resulting_coordination_state: 'cancellation_requested' }).success, false);
assert.equal(evaluate(intent, { ...snapshot, coordination_receipt: { ...receipt,
  decision_status: 'unknown' } }), 'COORDINATION_RECEIPT_MISMATCH');
const before = JSON.stringify({ intent, snapshot }); evaluate(intent, snapshot);
assert.equal(JSON.stringify({ intent, snapshot }), before);
assert.match(sourceText, /pure evaluator performs no writes or side effects/i);
console.log('SERVICE v1.4 experience coordination contract: PASS');
