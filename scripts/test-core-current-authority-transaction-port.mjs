import assert from 'node:assert/strict';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  canonicalCurrentAuthorityObservationV1Schema,
  currentAuthorityTransactionDecisionReceiptV1Schema,
  currentAuthorityTransactionRequestV1Schema,
} from '../src/lib/core/current-authority-transaction-port-v1.ts';

const id = (value) => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
const lockedAt = '2026-10-12T08:00:00.000Z';

function fixture() {
  const request = {
    contract_version: 'core-current-authority-transaction-port-request.v1',
    decision_id: id(1),
    context_id: id(2),
    workspace_id: id(3),
    actor_id: id(4),
    authority_version: 17,
    permission_code: 'services.orders.request',
    module_code: 'services_orders',
    evaluation_purpose: 'service.order.transition',
    transaction_context: {
      transaction_id: id(5),
      command_id: id(6),
      attempt: 1,
      isolation_level: 'read_committed',
      lock: {
        kind: 'command_aggregate',
        workspace_id: id(3),
        aggregate_type: 'service_order',
        aggregate_id: id(7),
        acquired_at: lockedAt,
      },
    },
  };
  const observation = {
    contract_version: 'core-current-authority-observation.v1',
    source_contract: 'workspace-native-effective-authority.v2',
    decision_id: id(1),
    context_id: id(2),
    workspace_id: id(3),
    actor_id: id(4),
    authority_version: 17,
    permission_code: 'services.orders.request',
    module_code: 'services_orders',
    transaction_context: structuredClone(request.transaction_context),
    evaluator: 'app_private.check_workspace_native_permission_v2',
    source_disclosure: 'status_only',
    source_reference: null,
    actor_status: 'current',
    decision: 'allowed',
    evaluated_at: '2026-10-12T10:00:00.000+02:00',
  };
  return { request, observation };
}

let cases = 0;
function evaluate(change = () => {}) {
  const value = fixture();
  change(value);
  const before = structuredClone(value);
  const receipt = bindCanonicalCurrentAuthorityObservationV1(value.request, value.observation);
  assert.deepEqual(value, before, 'binding must not mutate request or canonical observation');
  currentAuthorityTransactionDecisionReceiptV1Schema.parse(receipt);
  cases++;
  return receipt;
}

const allowed = evaluate();
assert.equal(allowed.decision, 'allowed');
assert.equal(allowed.denial_reason, null);
assert.equal(allowed.receipt_version, 1);
assert.equal(allowed.evaluated_at, '2026-10-12T10:00:00.000+02:00');
assert.equal(allowed.rechecked_after_lock, true, 'equivalent offset instant is after the lock');
assert.equal(allowed.transaction_bound, true);
assert.equal(allowed.reusable_as_command_authority, false);
assert.equal(allowed.current_authority_recheck_required_on_retry, true);
assert.equal(allowed.source_disclosure, 'status_only');
assert.equal(allowed.source_reference, null);
assert.deepEqual(allowed.transaction_context, fixture().request.transaction_context);

const equivalentLockOffset = evaluate(({ observation }) => {
  observation.transaction_context.lock.acquired_at = '2026-10-12T10:00:00.000+02:00';
});
assert.equal(equivalentLockOffset.decision, 'allowed', 'equivalent lock instants must bind');

function deny(reason, change) {
  const receipt = evaluate(change);
  assert.equal(receipt.decision, 'denied');
  assert.equal(receipt.denial_reason, reason);
  assert.equal(receipt.source_reference, null);
  assert.equal(Object.hasOwn(receipt, 'role'), false);
  assert.equal(Object.hasOwn(receipt, 'grant'), false);
  assert.equal(Object.hasOwn(receipt, 'membership'), false);
}

deny('RECHECK_BEFORE_LOCK', ({ observation }) => {
  observation.evaluated_at = '2026-10-12T07:59:59.999Z';
});
deny('STALE_AUTHORITY_VERSION', ({ observation }) => {
  observation.authority_version = 18;
});
deny('ACTOR_REVOKED', ({ observation }) => {
  observation.actor_status = 'revoked';
});
deny('CROSS_WORKSPACE', ({ observation }) => {
  observation.workspace_id = id(30);
});
deny('CROSS_WORKSPACE', ({ request }) => {
  request.transaction_context.lock.workspace_id = id(30);
});
deny('TRANSACTION_CONTEXT_MISMATCH', ({ observation }) => {
  observation.transaction_context.transaction_id = id(31);
});
deny('TRANSACTION_CONTEXT_MISMATCH', ({ observation }) => {
  observation.transaction_context.attempt = 2;
});
deny('TRANSACTION_CONTEXT_MISMATCH', ({ observation }) => {
  observation.transaction_context.lock.aggregate_id = id(33);
});
deny('AUTHORITY_BINDING_MISMATCH', ({ observation }) => {
  observation.actor_id = id(32);
});
deny('AUTHORITY_DENIED', ({ observation }) => {
  observation.decision = 'denied';
});

assert.throws(() => currentAuthorityTransactionRequestV1Schema.parse({ ...fixture().request, extra: true }));
assert.throws(() => canonicalCurrentAuthorityObservationV1Schema.parse({ ...fixture().observation, extra: true }));
cases += 2;

console.log(`${cases} current-authority transactional port cases passed; no database or Auth access`);
