import assert from 'node:assert/strict';

import {
  resolveCommunicationsPrivateMessageSubjectV1,
} from '../src/lib/core/communications-private-message-subject-provider-v1.ts';

const id = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const workspaceId = id(1);
const actorId = id(2);
const messageId = id(3);

function authority(overrides = {}) {
  return {
    contract_version: 'core-current-authority-decision-receipt.v1',
    receipt_version: 1,
    decision_id: id(10),
    context_id: id(11),
    workspace_id: workspaceId,
    actor_id: actorId,
    authority_version: 7,
    permission_code: 'services.orders.request',
    module_code: 'services_orders',
    evaluation_purpose: 'service.order.transition',
    transaction_context: {
      transaction_id: id(12), command_id: id(13), attempt: 1, isolation_level: 'serializable',
      lock: {
        kind: 'command_aggregate', workspace_id: workspaceId,
        aggregate_type: 'service_request', aggregate_id: id(14),
        acquired_at: '2026-10-13T12:00:00.000Z',
      },
    },
    evaluator: 'app_private.check_workspace_native_permission_v2',
    source_disclosure: 'status_only', source_reference: null,
    evaluated_at: '2026-10-13T12:00:00.001Z',
    rechecked_after_lock: true, transaction_bound: true,
    reusable_as_command_authority: false,
    current_authority_recheck_required_on_retry: true,
    decision: 'allowed', denial_reason: null,
    ...overrides,
  };
}

function harness(row, sqlError) {
  const calls = [];
  const scope = {
    transaction_id: id(12), database_transaction_id: '9001', workspace_id: workspaceId,
    tenant_id: id(20), actor_id: actorId, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (sqlError) throw Object.assign(new Error('bounded database result'), { code: sqlError });
      return { rows: row ? [structuredClone(row)] : [], rowCount: row ? 1 : 0 };
    },
  };
  return { scope, calls };
}

const request = (receipt = authority()) => ({
  contract_version: 'communications-private-message-subject-provider.v1',
  message_id: messageId,
  expected_version: 3,
  authority: receipt,
});
const available = {
  message_id: messageId, message_version: '3', workspace_id: workspaceId,
  lifecycle_state: 'available', participant_current: true, participant_revoked: false,
};

let assertions = 0;

{
  const { scope, calls } = harness(available);
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, request());
  assert.equal(result.decision, 'verified');
  assert.deepEqual(result.reference, { kind: 'message', id: messageId, version: 3 });
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /^select\s/i);
  assert.match(calls[0].text, /resolve_private_message_subject_v1/);
  assert.deepEqual(calls[0].values, [id(11), workspaceId, actorId, messageId, 3]);
  assert.equal(JSON.stringify(result).includes('body'), false);
  assert.equal(JSON.stringify(result).includes('membership'), false);
  assertions += 8;
}

for (const [row, code] of [
  [{ ...available, participant_current: false, participant_revoked: true }, 'PARTICIPANT_REVOKED'],
  [{ ...available, participant_current: false }, 'PARTICIPANT_NOT_CURRENT'],
  [{ ...available, lifecycle_state: 'quarantined' }, 'REFERENCE_QUARANTINED'],
  [{ ...available, lifecycle_state: 'deleted' }, 'REFERENCE_DELETED'],
]) {
  const { scope } = harness(row);
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, request());
  assert.equal(result.decision, 'denied');
  assert.equal(result.code, code);
  assert.equal(result.reference, null);
  assertions += 3;
}

for (const [sqlState, decision, code] of [
  ['40001', 'conflict', 'STALE_REFERENCE'],
  ['42501', 'denied', 'REFERENCE_UNAVAILABLE'],
  ['XX000', 'unknown', 'PROVIDER_UNKNOWN'],
]) {
  const { scope } = harness(null, sqlState);
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, request());
  assert.equal(result.decision, decision);
  assert.equal(result.code, code);
  assertions += 2;
}

{
  const { scope, calls } = harness(available);
  const denied = authority({ decision: 'denied', denial_reason: 'ACTOR_REVOKED', rechecked_after_lock: false });
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, request(denied));
  assert.equal(result.code, 'AUTHORITY_DENIED');
  assert.equal(calls.length, 0);
  assertions += 2;
}

for (const mutate of [
  (receipt) => ({ ...receipt, workspace_id: id(99) }),
  (receipt) => ({ ...receipt, actor_id: id(99) }),
  (receipt) => ({ ...receipt, transaction_context: { ...receipt.transaction_context, transaction_id: id(99) } }),
]) {
  const { scope, calls } = harness(available);
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, request(mutate(authority())));
  assert.equal(result.code, 'AUTHORITY_BINDING_MISMATCH');
  assert.equal(calls.length, 0, 'binding denial must issue zero SQL statements');
  assertions += 2;
}

{
  const { scope, calls } = harness(available);
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, { ...request(), expected_version: 0 });
  assert.equal(result.code, 'INVALID_REQUEST');
  assert.equal(calls.length, 0);
  assertions += 2;
}

assert.equal(assertions, 36);
console.log(`Communications private-message subject provider: ${assertions}/36 PASS`);
