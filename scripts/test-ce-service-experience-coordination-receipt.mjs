import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import {
  SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT,
  evaluateServiceExperienceCoordination,
  fingerprintServiceExperienceCoordinationInput,
  projectServicePr334CoordinationReceipt,
  serviceExperienceCoordinationInputV1Schema,
  serviceExperienceCoordinationReceiptV1Schema,
  serviceExperienceCoordinationSnapshotV1Schema,
} from '../src/lib/community/service-experience-coordination-receipt.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const ids = {
  context: id(1), workspace: id(2), otherWorkspace: id(3), order: id(4), otherOrder: id(5),
  actor: id(6), participant: id(7), component: id(8), compensation: id(9), source: id(10),
  status: id(11), receipt: id(12), binding: id(13), otherReceipt: id(14), otherBinding: id(15),
};
const common = {
  contract: SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT,
  version: 1,
  context_id: ids.context,
  workspace_id: ids.workspace,
  service_order_id: ids.order,
  expected_order_version: 7,
  actor_reference_id: ids.actor,
  participant_reference_id: ids.participant,
  coordination_source_id: ids.source,
  expected_coordination_source_version: 5,
  idempotency_key: 'ce.sv01n.provider.0001',
};
const inputs = {
  component: serviceExperienceCoordinationInputV1Schema.parse({
    ...common,
    action: 'acknowledge_component_status',
    component_id: ids.component,
    expected_component_version: 3,
    status_reference_id: ids.status,
  }),
  cancellation: serviceExperienceCoordinationInputV1Schema.parse({
    ...common,
    action: 'request_cancellation',
    reason_code: 'CUSTOMER_REQUEST',
  }),
  compensationRequest: serviceExperienceCoordinationInputV1Schema.parse({
    ...common,
    action: 'request_compensation',
    component_id: ids.component,
    expected_component_version: 3,
    reason_code: 'SERVICE_FAILURE',
  }),
  compensationAccept: serviceExperienceCoordinationInputV1Schema.parse({
    ...common,
    action: 'accept_compensation',
    compensation_reference_id: ids.compensation,
    expected_compensation_version: 2,
  }),
};

const subjectFor = (input) => {
  if ('component_id' in input) return { kind: 'component', id: input.component_id, version: input.expected_component_version };
  if ('compensation_reference_id' in input) return { kind: 'compensation', id: input.compensation_reference_id, version: input.expected_compensation_version };
  return null;
};

const snapshotFor = (input, overrides = {}) => {
  const subject = subjectFor(input);
  return serviceExperienceCoordinationSnapshotV1Schema.parse({
    authority: { actor_reference_id: ids.actor, workspace_id: ids.workspace, result: 'allowed' },
    participant: { participant_reference_id: ids.participant, workspace_id: ids.workspace, membership_state: 'active' },
    order: { id: ids.order, workspace_id: ids.workspace, version: 7, state: 'in_progress' },
    subject: subject ? { ...subject, workspace_id: ids.workspace, service_order_id: ids.order, state: 'available' } : null,
    source: { id: ids.source, workspace_id: ids.workspace, version: 5, state: 'available' },
    allowed_actions: ['acknowledge_component_status', 'request_cancellation', 'request_compensation', 'accept_compensation'],
    resolution: 'known',
    issuance: { receipt_id: ids.receipt, idempotency_binding_id: ids.binding, evaluated_at: '2026-10-11T11:30:00.000Z' },
    replay: null,
    ...overrides,
  });
};

const evaluated = (input, snapshot) => {
  const inputBefore = structuredClone(input);
  const snapshotBefore = structuredClone(snapshot);
  const result = evaluateServiceExperienceCoordination(input, snapshot);
  assert.deepEqual(input, inputBefore, 'input must remain unchanged');
  assert.deepEqual(snapshot, snapshotBefore, 'snapshot must remain unchanged');
  assert.equal(serviceExperienceCoordinationReceiptV1Schema.safeParse(result.receipt).success, true);
  return result;
};

const expectCode = (input, snapshot, code, status) => {
  const result = evaluated(input, snapshot);
  assert.equal(result.result_code, code);
  assert.equal(result.decision_status, status);
  assert.equal(result.receipt.result_code, code);
  assert.equal(result.receipt.resulting_coordination_state, code === 'UNKNOWN_RESULT' ? 'unknown' : code === 'OK' ? result.receipt.resulting_coordination_state : 'unchanged');
  return result;
};

for (const input of Object.values(inputs)) {
  const parsed = serviceExperienceCoordinationInputV1Schema.safeParse(input);
  assert.equal(parsed.success, true, input.action);
  const result = expectCode(input, snapshotFor(input), 'OK', 'verified');
  assert.equal(result.replayed, false);
  assert.equal(result.receipt.contract, SERVICE_EXPERIENCE_COORDINATION_RECEIPT_CONTRACT);
  assert.equal(result.receipt.action, input.action);
  assert.equal(result.receipt.workspace_id, ids.workspace);
  assert.equal(result.receipt.service_order_id, ids.order);
  assert.equal(result.receipt.coordination_source_id, ids.source);
  assert.equal(result.receipt.actor_authority, 'verified');
  assert.equal(result.receipt.participant_authority, 'verified');
}

assert.equal(evaluated(inputs.component, snapshotFor(inputs.component)).receipt.resulting_coordination_state, 'component_status_acknowledged');
assert.equal(evaluated(inputs.cancellation, snapshotFor(inputs.cancellation)).receipt.resulting_coordination_state, 'cancellation_requested');
assert.equal(evaluated(inputs.compensationRequest, snapshotFor(inputs.compensationRequest)).receipt.resulting_coordination_state, 'compensation_requested');
assert.equal(evaluated(inputs.compensationAccept, snapshotFor(inputs.compensationAccept)).receipt.resulting_coordination_state, 'compensation_accepted');

for (const field of ['order_state', 'authority_result', 'participant_membership', 'experience_state', 'cancellation_result',
  'compensation_amount', 'currency', 'tax', 'rounding', 'payment_id', 'refund_id', 'ledger_reference', 'audit_result', 'outbox_result']) {
  assert.equal(serviceExperienceCoordinationInputV1Schema.safeParse({ ...inputs.component, [field]: 'client-claim' }).success, false, field);
}
assert.equal(serviceExperienceCoordinationInputV1Schema.safeParse({ ...inputs.component, expected_coordination_source_version: 0 }).success, false);
assert.equal(serviceExperienceCoordinationInputV1Schema.safeParse({ ...inputs.component, expected_coordination_source_version: Number.MAX_SAFE_INTEGER + 1 }).success, false);
const { status_reference_id: _status, ...componentWithoutStatus } = inputs.component;
assert.equal(serviceExperienceCoordinationInputV1Schema.safeParse(componentWithoutStatus).success, false);
assert.equal(serviceExperienceCoordinationInputV1Schema.safeParse({ ...inputs.cancellation, status_reference_id: ids.status }).success, false);
assert.equal(serviceExperienceCoordinationInputV1Schema.safeParse({ ...inputs.compensationAccept, reason_code: 'SERVICE_FAILURE' }).success, false);
const { reason_code: _reason, ...compensationWithoutReason } = inputs.compensationRequest;
assert.equal(serviceExperienceCoordinationInputV1Schema.safeParse(compensationWithoutReason).success, false);
assert.equal(serviceExperienceCoordinationInputV1Schema.safeParse({ ...inputs.cancellation, reason_code: 'UNBOUNDED_REASON' }).success, false);

expectCode(inputs.component, snapshotFor(inputs.component, {
  authority: { actor_reference_id: ids.actor, workspace_id: ids.workspace, result: 'denied' },
}), 'AUTHORITY_DENIED', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, {
  participant: { participant_reference_id: ids.participant, workspace_id: ids.workspace, membership_state: 'revoked' },
}), 'PARTICIPANT_DENIED', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, {
  authority: { actor_reference_id: ids.actor, workspace_id: ids.otherWorkspace, result: 'allowed' },
}), 'WORKSPACE_MISMATCH', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, { order: null }), 'ORDER_UNAVAILABLE', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, {
  order: { id: ids.otherOrder, workspace_id: ids.workspace, version: 7, state: 'in_progress' },
}), 'ORDER_UNAVAILABLE', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, {
  order: { id: ids.order, workspace_id: ids.workspace, version: 8, state: 'in_progress' },
}), 'STALE_ORDER', 'conflict');
expectCode(inputs.component, snapshotFor(inputs.component, { source: null }), 'SOURCE_UNAVAILABLE', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, {
  source: { id: ids.source, workspace_id: ids.workspace, version: 6, state: 'available' },
}), 'STALE_SOURCE', 'conflict');
expectCode(inputs.component, snapshotFor(inputs.component, {
  source: { id: ids.source, workspace_id: ids.workspace, version: 5, state: 'unknown' },
}), 'UNKNOWN_RESULT', 'unknown');
expectCode(inputs.component, snapshotFor(inputs.component, { allowed_actions: ['request_cancellation'] }), 'ACTION_NOT_ALLOWED', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, { subject: null }), 'SUBJECT_UNAVAILABLE', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, {
  subject: { kind: 'component', id: ids.component, workspace_id: ids.workspace, service_order_id: ids.order, version: 4, state: 'available' },
}), 'STALE_SUBJECT', 'conflict');
expectCode(inputs.compensationAccept, snapshotFor(inputs.compensationAccept, {
  subject: { kind: 'compensation', id: ids.compensation, workspace_id: ids.workspace, service_order_id: ids.order, version: 3, state: 'available' },
}), 'STALE_SUBJECT', 'conflict');
expectCode(inputs.compensationAccept, snapshotFor(inputs.compensationAccept, {
  subject: { kind: 'component', id: ids.compensation, workspace_id: ids.workspace, service_order_id: ids.order, version: 2, state: 'available' },
}), 'ACTION_NOT_ALLOWED', 'denied');
expectCode(inputs.cancellation, snapshotFor(inputs.cancellation, {
  subject: { kind: 'component', id: ids.component, workspace_id: ids.workspace, service_order_id: ids.order, version: 3, state: 'available' },
}), 'ACTION_NOT_ALLOWED', 'denied');
expectCode(inputs.component, snapshotFor(inputs.component, {
  subject: { kind: 'component', id: ids.component, workspace_id: ids.otherWorkspace, service_order_id: ids.order, version: 3, state: 'available' },
}), 'WORKSPACE_MISMATCH', 'denied');

const initial = expectCode(inputs.compensationRequest, snapshotFor(inputs.compensationRequest), 'OK', 'verified');
assert.equal(serviceExperienceCoordinationReceiptV1Schema.safeParse({ ...initial.receipt, decision_status: 'denied' }).success, false);
assert.equal(serviceExperienceCoordinationReceiptV1Schema.safeParse({ ...initial.receipt, subject_id: null }).success, false);
assert.equal(serviceExperienceCoordinationReceiptV1Schema.safeParse({ ...initial.receipt, participant_authority: 'denied' }).success, false);
const replaySnapshot = snapshotFor(inputs.compensationRequest, {
  issuance: { receipt_id: ids.otherReceipt, idempotency_binding_id: ids.otherBinding, evaluated_at: '2026-10-11T11:31:00.000Z' },
  replay: {
    idempotency_key: inputs.compensationRequest.idempotency_key,
    input_fingerprint: fingerprintServiceExperienceCoordinationInput(inputs.compensationRequest),
    receipt: initial.receipt,
  },
});
const replay = evaluated(inputs.compensationRequest, replaySnapshot);
assert.equal(replay.result_code, 'OK');
assert.equal(replay.replayed, true);
assert.deepEqual(replay.receipt, initial.receipt, 'exact replay returns the immutable original receipt');
expectCode({ ...inputs.compensationRequest, reason_code: 'QUALITY_ISSUE' }, replaySnapshot, 'REPLAY_CONFLICT', 'conflict');
expectCode(inputs.compensationRequest, {
  ...replaySnapshot,
  authority: { actor_reference_id: ids.actor, workspace_id: ids.workspace, result: 'denied' },
}, 'AUTHORITY_DENIED', 'denied');

const denied = evaluated(inputs.component, snapshotFor(inputs.component, {
  participant: { participant_reference_id: ids.participant, workspace_id: ids.workspace, membership_state: 'inactive' },
}));
const deniedJson = JSON.stringify(denied);
assert.doesNotMatch(deniedJson, new RegExp(ids.participant, 'i'));
assert.doesNotMatch(deniedJson, new RegExp(ids.actor, 'i'));
assert.doesNotMatch(deniedJson, /membership_state|context_id|idempotency_key|input_fingerprint|payload/i);
assert.equal(denied.receipt.resulting_coordination_state, 'unchanged');

const consumerReceiptSchema = z.strictObject({
  status: z.enum(['verified', 'denied', 'stale']),
  action: z.enum(['acknowledge_component_status', 'request_cancellation', 'request_compensation', 'accept_compensation']),
  workspace_id: z.string().uuid(),
  order_id: z.string().uuid(),
  order_version: z.number().int().positive(),
  subject_id: z.string().uuid().nullable(),
  subject_version: z.number().int().positive().nullable(),
  status_reference_id: z.string().uuid().nullable(),
});
const projected = projectServicePr334CoordinationReceipt(evaluated(inputs.component, snapshotFor(inputs.component)).receipt);
assert.equal(consumerReceiptSchema.safeParse(projected).success, true);
assert.deepEqual(Object.keys(projected).sort(), ['action', 'order_id', 'order_version', 'status', 'status_reference_id', 'subject_id', 'subject_version', 'workspace_id']);
const consumerMissing = ['contract', 'version', 'receipt_id', 'result_code', 'coordination_source_id',
  'coordination_source_version', 'reason_code', 'actor_authority', 'participant_authority',
  'current_coordination_state', 'resulting_coordination_state', 'idempotency_binding_id', 'evaluated_at'];
for (const field of consumerMissing) assert.equal(field in projected, false, field);

const doc = readFileSync(path.join(root, 'docs/architecture/CLADORA-CE-SV01N-PROVIDER-CONTRACT-v1.0.md'), 'utf8');
assert.match(doc, /SERVICE owns the canonical Service Order/i);
assert.match(doc, /changes_requested_on_consumer/i);
for (const code of ['AUTHORITY_DENIED', 'PARTICIPANT_DENIED', 'ORDER_UNAVAILABLE', 'STALE_ORDER', 'SUBJECT_UNAVAILABLE',
  'STALE_SUBJECT', 'SOURCE_UNAVAILABLE', 'STALE_SOURCE', 'WORKSPACE_MISMATCH', 'ACTION_NOT_ALLOWED', 'REPLAY_CONFLICT', 'UNKNOWN_RESULT']) {
  assert.match(doc, new RegExp(`\\b${code}\\b`));
}

console.log('CE service experience coordination receipt v1: PASS — strict four-action contract, bounded decisions, replay, zero mutation, privacy and PR #334 compatibility.');
