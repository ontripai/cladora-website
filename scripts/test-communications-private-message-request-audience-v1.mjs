import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  communicationsPrivateMessageRequestAudienceEvidenceProviderV1,
  communicationsPrivateMessageRequestAudienceProviderCodeV1,
  resolveCommunicationsPrivateMessageRequestAudienceV1,
} from '../src/lib/core/communications-private-message-request-audience-provider-v1.ts';
import {
  communicationsPrivateMessageProviderCodeV1,
  resolveCommunicationsPrivateMessageSubjectV1,
} from '../src/lib/core/communications-private-message-subject-provider-v1.ts';
import { coreTransactionProviderEvidenceV1Schema } from
  '../src/lib/core/transaction-provider-evidence-v1.ts';

const id = value => `a7000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const workspaceId = id(1);
const actorId = id(2);
const messageId = id(3);
const requestId = id(4);
const transactionId = id(5);
const commandId = id(6);

const command = (overrides = {}) => ({
  contract_version: 'core-transaction-command.v2',
  transaction_id: transactionId,
  command_id: commandId,
  context_id: id(7),
  workspace_id: workspaceId,
  actor_id: actorId,
  authority_version: 9,
  permission_code: 'services.orders.subject_link',
  module_code: 'services_orders',
  evaluation_purpose: 'service.request.subject_link',
  aggregate_type: 'service_request',
  aggregate_id: requestId,
  aggregate_version: 6,
  provider_source_ids: [messageId],
  idempotency_key: 'comm-request-audience-001',
  input_fingerprint: 'sha256:0123456789abcdef',
  subject_reference: {
    kind: 'message', id: messageId, version: 3,
    relation: 'subject_link', request_version: 3,
  },
  ...overrides,
});
const authority = () => ({
  contract_version: 'core-current-authority-decision-receipt.v1',
  receipt_version: 1,
  decision_id: id(8),
  context_id: id(7),
  workspace_id: workspaceId,
  actor_id: actorId,
  authority_version: 9,
  permission_code: 'services.orders.subject_link',
  module_code: 'services_orders',
  evaluation_purpose: 'service.request.subject_link',
  transaction_context: {
    transaction_id: transactionId,
    command_id: commandId,
    attempt: 1,
    isolation_level: 'serializable',
    lock: {
      kind: 'command_aggregate', workspace_id: workspaceId,
      aggregate_type: 'service_request', aggregate_id: requestId,
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
});
const subjectAccepted = {
  decision: 'accepted', denial_reason: null,
  message_id: messageId, message_version: '3', workspace_id: workspaceId,
  lifecycle_state: 'available', participant_current: true, participant_revoked: false,
  evaluated_at: '2026-10-13T12:00:00.002Z',
};
const audienceAccepted = {
  decision: 'accepted', denial_reason: null,
  current_actor_can_read: true, request_party_audience_only: true,
  evaluated_at: '2026-10-13T12:00:00.003Z',
};
const subjectDenied = reason => ({
  decision: 'denied', denial_reason: reason,
  message_id: null, message_version: null, workspace_id: null, lifecycle_state: null,
  participant_current: null, participant_revoked: null,
  evaluated_at: '2026-10-13T12:00:00.002Z',
});
const audienceDenied = reason => ({
  decision: 'denied', denial_reason: reason,
  current_actor_can_read: null, request_party_audience_only: null,
  evaluated_at: '2026-10-13T12:00:00.003Z',
});

function harness(rows = [subjectAccepted, audienceAccepted], failureAt = 0, sqlState = '40001') {
  const calls = [];
  const scope = {
    transaction_id: transactionId,
    database_transaction_id: '9701',
    workspace_id: workspaceId,
    tenant_id: id(9),
    actor_id: actorId,
    attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (failureAt === calls.length) throw Object.assign(new Error('database failure'), { code: sqlState });
      const row = rows[calls.length - 1];
      return { rows: row ? [structuredClone(row)] : [], rowCount: row ? 1 : 0 };
    },
  };
  return { scope, calls };
}

let passed = 0;
async function check(name, run) {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

await check('accepted evidence means current read plus canonical Request-party audience', async () => {
  const { scope } = harness();
  const result = await resolveCommunicationsPrivateMessageRequestAudienceV1(scope, command(), authority());
  assert.equal(coreTransactionProviderEvidenceV1Schema.safeParse(result).success, true);
  assert.equal(result.decision, 'accepted');
  assert.equal(result.provider_code, communicationsPrivateMessageRequestAudienceProviderCodeV1);
  assert.equal(result.current_actor_can_read, true);
  assert.equal(result.evaluated_at, audienceAccepted.evaluated_at);
});

await check('CE audience evidence has its own identity and provider code', async () => {
  const baseHarness = harness([subjectAccepted]);
  const base = await resolveCommunicationsPrivateMessageSubjectV1(
    baseHarness.scope, command(), authority(),
  );
  const audienceHarness = harness();
  const audience = await resolveCommunicationsPrivateMessageRequestAudienceV1(
    audienceHarness.scope, command(), authority(),
  );
  assert.equal(base.provider_code, communicationsPrivateMessageProviderCodeV1);
  assert.equal(audience.provider_code, communicationsPrivateMessageRequestAudienceProviderCodeV1);
  assert.notEqual(audience.evidence_id, base.evidence_id);
});

await check('provider object is directly consumable by the Core V2 host', async () => {
  assert.equal(communicationsPrivateMessageRequestAudienceEvidenceProviderV1.provider_code,
    communicationsPrivateMessageRequestAudienceProviderCodeV1);
  assert.equal(communicationsPrivateMessageRequestAudienceEvidenceProviderV1.validateProviders,
    resolveCommunicationsPrivateMessageRequestAudienceV1);
});

await check('exact Request and message bindings reach the private gate', async () => {
  const profile = command();
  assert.equal(profile.contract_version, 'core-transaction-command.v2');
  assert.equal(profile.permission_code, 'services.orders.subject_link');
  assert.equal(profile.module_code, 'services_orders');
  assert.equal(profile.evaluation_purpose, 'service.request.subject_link');
  const { scope, calls } = harness();
  await resolveCommunicationsPrivateMessageRequestAudienceV1(scope, profile, authority());
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => /^select\s/i.test(call.text)));
  assert.match(calls[1].text, /resolve_private_message_request_audience_current_v2/);
  assert.doesNotMatch(calls[1].text, /resolve_private_message_request_audience_v1/);
  assert.deepEqual(calls[1].values, [id(7), workspaceId, actorId, messageId, 3, requestId, 5]);
});

for (const [field, value] of [
  ['permission_code', 'services.orders.read'],
  ['module_code', 'communications'],
  ['evaluation_purpose', 'service.request.subject_context'],
]) {
  await check(`mismatched ${field} fails closed before Request audience resolution`, async () => {
    const profile = command({ [field]: value });
    const profileAuthority = authority();
    profileAuthority[field] = value;
    const { scope, calls } = harness();
    const result = await resolveCommunicationsPrivateMessageRequestAudienceV1(
      scope, profile, profileAuthority,
    );
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, 'RELATION_MISMATCH');
    assert.equal(calls.length, 1);
  });
}

await check('result version one cannot name a positive expected Request version', async () => {
  const { scope, calls } = harness();
  const result = await resolveCommunicationsPrivateMessageRequestAudienceV1(
    scope, command({ aggregate_version: 1 }), authority(),
  );
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'STALE_SUBJECT');
  assert.equal(calls.length, 1);
});

await check('non-Request aggregate fails closed before the audience gate', async () => {
  const other = command({ aggregate_type: 'property' });
  const mismatchedAuthority = authority();
  mismatchedAuthority.transaction_context.lock.aggregate_type = 'property';
  const { scope, calls } = harness();
  const result = await resolveCommunicationsPrivateMessageRequestAudienceV1(scope, other, mismatchedAuthority);
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'RELATION_MISMATCH');
  assert.equal(calls.length, 1);
});

for (const [reason, expected] of [
  ['AUDIENCE_DENIED', 'SUBJECT_DENIED'],
  ['STALE_REQUEST', 'STALE_SUBJECT'],
  ['STALE_SUBJECT', 'STALE_SUBJECT'],
]) {
  await check(`${reason} is bounded and exposes no source`, async () => {
    const { scope, calls } = harness([subjectAccepted, audienceDenied(reason)]);
    const result = await resolveCommunicationsPrivateMessageRequestAudienceV1(scope, command(), authority());
    assert.equal(result.decision, 'denied');
    assert.equal(result.denial_reason, expected);
    assert.equal(result.source_reference, null);
    assert.ok(calls.every(call => /^select\s/i.test(call.text)));
  });
}

await check('base permission or scope denial never reaches the audience gate', async () => {
  const { scope, calls } = harness([subjectDenied('SUBJECT_DENIED')]);
  const result = await resolveCommunicationsPrivateMessageRequestAudienceV1(scope, command(), authority());
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'SUBJECT_DENIED');
  assert.equal(calls.length, 1);
});

await check('malformed audience result fails closed', async () => {
  const { scope } = harness([subjectAccepted, { ...audienceAccepted, participant_ids: [id(90)] }]);
  const result = await resolveCommunicationsPrivateMessageRequestAudienceV1(scope, command(), authority());
  assert.equal(result.decision, 'denied');
  assert.equal(result.denial_reason, 'PROVIDER_UNAVAILABLE');
});

await check('real PostgreSQL serialization failure reaches the Core host', async () => {
  const { scope } = harness([subjectAccepted], 2, '40001');
  await assert.rejects(
    resolveCommunicationsPrivateMessageRequestAudienceV1(scope, command(), authority()),
    error => error.code === '40001',
  );
});

await check('evidence and SQL output disclose no message body or audience identities', async () => {
  const { scope } = harness();
  const result = await resolveCommunicationsPrivateMessageRequestAudienceV1(scope, command(), authority());
  const serialized = JSON.stringify(result);
  for (const forbidden of ['body', 'sender_id', 'conversation_id', 'unit_id', 'membership_id',
    'participant_ids', 'party_id']) assert.equal(serialized.includes(forbidden), false, forbidden);
});

await check('SQL consumes canonical owners and has no fallback allow or durable write', async () => {
  const sql = readFileSync(new URL(
    '../supabase/migrations/20261018153000_communications_private_message_currentness_gate_v2.sql',
    import.meta.url,
  ), 'utf8');
  assert.match(sql, /resolve_private_message_currentness_v2/);
  assert.match(sql, /resolve_private_message_request_audience_v1/);
  assert.match(sql, /c\.workspace_id=p_workspace_id/);
  assert.doesNotMatch(sql, /\b(insert|update|delete)\s+(into|communications|service_catalog|identity|maintenance|platform|audit)\b/i);
  assert.doesNotMatch(sql, /grant\s+execute/i);
  assert.doesNotMatch(sql, /association_admin|property_manager|role_code/i);
});

assert.equal(passed, 17);
console.log(`Communications Request audience provider: ${passed}/17 PASS`);
