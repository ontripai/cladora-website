import assert from 'node:assert/strict';
import { bindCanonicalCurrentAuthorityObservationV1 } from '../src/lib/core/current-authority-transaction-port-v1.ts';

const id = (value) => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
const consumers = [
  {
    name: 'SERVICE',
    permission: 'services.orders.request',
    module: 'services_orders',
    purpose: 'service.order.transition',
    aggregate: 'service_order',
  },
  {
    name: 'CE',
    permission: 'experience.guide.manage',
    module: 'experience_guides',
    purpose: 'experience.guide.command',
    aggregate: 'experience_guide',
  },
];

function fixture(consumer, seed = 0) {
  const workspaceId = id(seed + 10);
  const request = {
    contract_version: 'core-current-authority-transaction-port-request.v1',
    decision_id: id(seed + 11),
    context_id: id(seed + 12),
    workspace_id: workspaceId,
    actor_id: id(seed + 13),
    authority_version: 23,
    permission_code: consumer.permission,
    module_code: consumer.module,
    evaluation_purpose: consumer.purpose,
    transaction_context: {
      transaction_id: id(seed + 14),
      command_id: id(seed + 15),
      attempt: 1,
      isolation_level: 'read_committed',
      lock: {
        kind: 'command_aggregate',
        workspace_id: workspaceId,
        aggregate_type: consumer.aggregate,
        aggregate_id: id(seed + 16),
        acquired_at: '2026-10-12T09:00:00.000Z',
      },
    },
  };
  return {
    request,
    observation: {
      contract_version: 'core-current-authority-observation.v1',
      source_contract: 'workspace-native-effective-authority.v2',
      decision_id: request.decision_id,
      context_id: request.context_id,
      workspace_id: request.workspace_id,
      actor_id: request.actor_id,
      authority_version: request.authority_version,
      permission_code: request.permission_code,
      module_code: request.module_code,
      transaction_context: structuredClone(request.transaction_context),
      evaluator: 'app_private.check_workspace_native_permission_v2',
      source_disclosure: 'status_only',
      source_reference: null,
      actor_status: 'current',
      decision: 'allowed',
      evaluated_at: '2026-10-12T09:00:00.001Z',
    },
  };
}

let cases = 0;
function expectDenied(value, reason) {
  const receipt = bindCanonicalCurrentAuthorityObservationV1(value.request, value.observation);
  assert.equal(receipt.decision, 'denied');
  assert.equal(receipt.denial_reason, reason);
  assert.deepEqual(
    Object.keys(receipt).filter((key) => ['role', 'grant', 'membership', 'policy_source'].includes(key)),
    [],
    'bounded denial must not expose authority internals',
  );
  cases++;
}

for (const [index, consumer] of consumers.entries()) {
  const baseline = fixture(consumer, index * 100);
  const before = structuredClone(baseline);
  const receipt = bindCanonicalCurrentAuthorityObservationV1(baseline.request, baseline.observation);
  assert.equal(receipt.decision, 'allowed');
  assert.equal(receipt.permission_code, consumer.permission);
  assert.equal(receipt.module_code, consumer.module);
  assert.deepEqual(baseline, before, `${consumer.name} fixture must remain immutable`);
  cases++;

  const stale = fixture(consumer, index * 100);
  stale.observation.authority_version++;
  expectDenied(stale, 'STALE_AUTHORITY_VERSION');

  const revoked = fixture(consumer, index * 100);
  revoked.observation.actor_status = 'revoked';
  expectDenied(revoked, 'ACTOR_REVOKED');

  const crossWorkspace = fixture(consumer, index * 100);
  crossWorkspace.observation.workspace_id = id(900 + index);
  expectDenied(crossWorkspace, 'CROSS_WORKSPACE');

  const beforeLock = fixture(consumer, index * 100);
  beforeLock.observation.evaluated_at = '2026-10-12T08:59:59.999Z';
  expectDenied(beforeLock, 'RECHECK_BEFORE_LOCK');

  const other = consumers[(index + 1) % consumers.length];
  const crossConsumer = fixture(consumer, index * 100);
  crossConsumer.observation.permission_code = other.permission;
  crossConsumer.observation.module_code = other.module;
  expectDenied(crossConsumer, 'AUTHORITY_BINDING_MISMATCH');

  console.log(`PASS ${consumer.name} transactional authority conformance`);
}

console.log(`${cases} SERVICE/CE conformance cases passed; no runtime provider or database access`);
