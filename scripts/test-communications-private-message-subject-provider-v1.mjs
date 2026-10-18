import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  communicationsPrivateMessageProviderCodeV1,
  communicationsPrivateMessageSubjectEvidenceProviderV1,
  resolveCommunicationsPrivateMessageSubjectV1,
} from '../src/lib/core/communications-private-message-subject-provider-v1.ts';
import {
  coreTransactionProviderEvidenceV1Schema,
} from '../src/lib/core/transaction-provider-evidence-v1.ts';

const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const workspaceId = id(1);
const actorId = id(2);
const messageId = id(3);
const transactionId = id(12);
const commandId = id(13);
const aggregateId = id(14);

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
      transaction_id: transactionId,
      command_id: commandId,
      attempt: 1,
      isolation_level: 'serializable',
      lock: {
        kind: 'command_aggregate',
        workspace_id: workspaceId,
        aggregate_type: 'service_request',
        aggregate_id: aggregateId,
        acquired_at: '2026-10-13T12:00:00.000Z',
      },
    },
    evaluator: 'app_private.check_workspace_native_permission_v2',
    source_disclosure: 'status_only',
    source_reference: null,
    evaluated_at: '2026-10-13T12:00:00.001Z',
    rechecked_after_lock: true,
    transaction_bound: true,
    reusable_as_command_authority: false,
    current_authority_recheck_required_on_retry: true,
    decision: 'allowed',
    denial_reason: null,
    ...overrides,
  };
}

function command(overrides = {}) {
  return {
    contract_version: 'core-transaction-command.v2',
    transaction_id: transactionId,
    command_id: commandId,
    context_id: id(11),
    workspace_id: workspaceId,
    actor_id: actorId,
    authority_version: 7,
    permission_code: 'services.orders.request',
    module_code: 'services_orders',
    evaluation_purpose: 'service.order.transition',
    aggregate_type: 'service_request',
    aggregate_id: aggregateId,
    aggregate_version: 4,
    provider_source_ids: [messageId],
    idempotency_key: 'comm-message-provider-test',
    input_fingerprint: 'sha256:0123456789abcdef',
    subject_reference: {
      kind: 'message',
      id: messageId,
      version: 3,
      relation: 'subject_link',
      request_version: 3,
    },
    ...overrides,
  };
}

const available = {
  decision: 'accepted',
  denial_reason: null,
  message_id: messageId,
  message_version: '3',
  workspace_id: workspaceId,
  lifecycle_state: 'available',
  participant_current: true,
  participant_revoked: false,
  evaluated_at: '2026-10-13T12:00:00.002Z',
};
const boundedDenial = reason => ({
  decision: 'denied',
  denial_reason: reason,
  message_id: null,
  message_version: null,
  workspace_id: null,
  lifecycle_state: null,
  participant_current: null,
  participant_revoked: null,
  evaluated_at: '2026-10-13T12:00:00.002Z',
});

function harness(row = available, sqlError) {
  const calls = [];
  const scope = {
    transaction_id: transactionId,
    database_transaction_id: '9001',
    workspace_id: workspaceId,
    tenant_id: id(20),
    actor_id: actorId,
    attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (sqlError) throw Object.assign(new Error('bounded database result'), { code: sqlError });
      return { rows: row ? [structuredClone(row)] : [], rowCount: row ? 1 : 0 };
    },
  };
  return { scope, calls };
}

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

await check('accepted message maps directly to merged Core provider evidence', async () => {
  const { scope } = harness();
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, command(), authority());
  assert.equal(coreTransactionProviderEvidenceV1Schema.safeParse(result).success, true);
  assert.equal(result.decision, 'accepted');
  assert.equal(result.provider_code, communicationsPrivateMessageProviderCodeV1);
  assert.deepEqual(result.subject_reference, command().subject_reference);
  assert.equal(result.reference_state, 'available');
  assert.equal(result.current_actor_can_read, true);
  assert.equal(result.source_reference, null);
});

await check('provider object is directly consumable by CoreTransactionProvidersV2', async () => {
  assert.equal(communicationsPrivateMessageSubjectEvidenceProviderV1.provider_code,
    communicationsPrivateMessageProviderCodeV1);
  assert.equal(communicationsPrivateMessageSubjectEvidenceProviderV1.validateProviders,
    resolveCommunicationsPrivateMessageSubjectV1);
});

await check('SQL resolver requires canonical Workspace permission and exact scoped assignment without role fallback', async () => {
  const sql = readFileSync(new URL(
    '../supabase/migrations/20261018153000_communications_private_message_currentness_gate_v2.sql',
    import.meta.url,
  ), 'utf8');
  assert.match(sql, /c\.workspace_id is not null/);
  assert.match(sql, /c\.workspace_id=p_workspace_id/);
  assert.match(sql, /check_workspace_native_permission_v2\([\s\S]*'communications\.feed\.read','communications'/);
  assert.doesNotMatch(sql, /workspace_property_bindings|native_workspace_scope_for_membership_v2/);
  assert.doesNotMatch(sql, /communications\.can_read_private\(/);
  assert.doesNotMatch(sql, /communications\.context_covers_unit\(/);
  assert.doesNotMatch(sql, /lower\(r\.code\)\s+in\s*\('association_admin'/);
});

await check('resolver query is one read-only statement with exact bindings', async () => {
  const { scope, calls } = harness();
  await resolveCommunicationsPrivateMessageSubjectV1(scope, command(), authority());
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /^select\s/i);
  assert.match(calls[0].text, /resolve_private_message_currentness_v2/);
  assert.doesNotMatch(calls[0].text, /resolve_private_message_subject_v1/);
  assert.deepEqual(calls[0].values, [id(11), workspaceId, actorId, messageId, 3]);
});

await check('accepted evidence exposes no private message or participant payload', async () => {
  const { scope } = harness();
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, command(), authority());
  const serialized = JSON.stringify(result);
  for (const forbidden of ['body', 'sender_id', 'conversation_id', 'unit_id', 'membership_id', 'participants']) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must remain absent`);
  }
});

for (const [name, row] of [
  ['revoked participant', { ...available, participant_current: false, participant_revoked: true }],
  ['non-current participant', { ...available, participant_current: false }],
  ['quarantined message', { ...available, lifecycle_state: 'quarantined' }],
  ['deleted message', { ...available, lifecycle_state: 'deleted' }],
]) {
  await check(`${name} fails closed`, async () => {
    const { scope, calls } = harness(row);
    const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, command(), authority());
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'SUBJECT_DENIED');
    assert.equal(result.source_reference, null);
    assert.equal(calls.length, 1);
  });
}

for (const [name, row, reason] of [
  ['stale version', boundedDenial('STALE_SUBJECT'), 'STALE_SUBJECT'],
  ['cross-Workspace or unreadable source', boundedDenial('SUBJECT_DENIED'), 'SUBJECT_DENIED'],
]) {
  await check(`${name} returns bounded Core evidence`, async () => {
    const { scope } = harness(row);
    const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, command(), authority());
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, reason);
    assert.equal(result.source_reference, null);
  });
}

for (const sqlState of ['40001', 'XX000']) {
  await check(`real PostgreSQL ${sqlState} is propagated to the Core host`, async () => {
    const { scope } = harness(null, sqlState);
    await assert.rejects(
      resolveCommunicationsPrivateMessageSubjectV1(scope, command(), authority()),
      error => error.code === sqlState,
    );
  });
}

for (const [name, mutate, reason] of [
  ['message kind', value => ({ ...value, subject_reference: { ...value.subject_reference, kind: 'document' } }), 'RELATION_MISMATCH'],
  ['subject relation', value => ({ ...value, subject_reference: { ...value.subject_reference, relation: 'attachment' } }), 'RELATION_MISMATCH'],
  ['request version', value => ({ ...value, subject_reference: { ...value.subject_reference, request_version: 2 } }), 'STALE_SUBJECT'],
]) {
  await check(`${name} mismatch fails before SQL`, async () => {
    const { scope, calls } = harness();
    const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, mutate(command()), authority());
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, reason);
    assert.equal(calls.length, 0);
  });
}

for (const [name, mutate] of [
  ['denied authority', value => ({ ...value, decision: 'denied', denial_reason: 'ACTOR_REVOKED', rechecked_after_lock: false })],
  ['Workspace authority', value => ({ ...value, workspace_id: id(99) })],
  ['actor authority', value => ({ ...value, actor_id: id(99) })],
  ['transaction authority', value => ({ ...value,
    transaction_context: { ...value.transaction_context, transaction_id: id(99) } })],
  ['command authority', value => ({ ...value,
    transaction_context: { ...value.transaction_context, command_id: id(99) } })],
  ['attempt authority', value => ({ ...value,
    transaction_context: { ...value.transaction_context, attempt: 2 } })],
  ['aggregate authority', value => ({ ...value,
    transaction_context: { ...value.transaction_context,
      lock: { ...value.transaction_context.lock, aggregate_id: id(99) } } })],
]) {
  await check(`${name} mismatch fails before provider SQL`, async () => {
    const { scope, calls } = harness();
    const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, command(), mutate(authority()));
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'SUBJECT_DENIED');
    assert.equal(calls.length, 0);
  });
}

for (const [name, row, reason] of [
  ['message identity', { ...available, message_id: id(99) }, 'STALE_SUBJECT'],
  ['message version', { ...available, message_version: '4' }, 'STALE_SUBJECT'],
  ['Workspace binding', { ...available, workspace_id: id(99) }, 'RELATION_MISMATCH'],
  ['malformed evaluation time', { ...available, evaluated_at: 'private-clock-value' }, 'PROVIDER_UNAVAILABLE'],
]) {
  await check(`${name} result mismatch fails closed`, async () => {
    const { scope } = harness(row);
    const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, command(), authority());
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, reason);
    assert.equal(result.source_reference, null);
  });
}

await check('missing source row is denied without a reference payload', async () => {
  const { scope } = harness(null);
  const result = await resolveCommunicationsPrivateMessageSubjectV1(scope, command(), authority());
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'SUBJECT_DENIED');
  assert.equal(result.source_reference, null);
});

assert.equal(passed, 28);
console.log(`Communications private-message Core evidence provider: ${passed}/28 PASS`);
