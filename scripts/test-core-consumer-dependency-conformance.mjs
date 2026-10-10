import assert from 'node:assert/strict';
import { evaluateCoreResourceAuthorityV1 } from '../src/lib/core/resource-authority-contract-v1.ts';

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const at = '2026-10-10T12:00:00.000Z';
// These are existing domain permissions, not new registry entries or grants.
const consumers = [
  ['AIRPROP', 'airprop.asset.read', 'airprop_commercial', 'management', 'company'],
  ['SERVICE', 'services.orders.read', 'services_orders', 'representation', 'person'],
  ['CE resource-linked extension', 'events.event.read', 'community_events', 'access', 'person'],
];

function fixture([, permission, module, kind, partyKind], workspace = id(2)) {
  const resourceRequest = {
    contract_version: 'canonical-resource-reference.v1', context_id: id(1),
    workspace_id: workspace, resource_type: 'property', resource_id: id(3),
    resource_version: 4, permission_code: permission, purpose: 'core.consumer.conformance',
  };
  const authorityRequest = {
    contract_version: 'workspace-native-effective-authority.v2', decision_id: id(5),
    context_id: id(1), workspace_id: workspace, permission_code: permission,
    module_code: module, target_scope_type: 'workspace', target_scope_id: workspace,
    evaluation_purpose: 'core.consumer.conformance',
  };
  return {
    request: {
      contract_version: 'core-resource-authority.v1', evaluation_time: at,
      resource: resourceRequest,
      relationship: { relationship_id: id(4), relationship_version: 2,
        relationship_kind: kind, required_scope_codes: ['consumer_read'] },
      authority: authorityRequest,
    },
    evidence: {
      resource: {
        contract_version: 'canonical-resource-reference.v1', reference_status: 'verified',
        tenant_id: id(6), workspace_id: workspace, resource_type: 'property', resource_id: id(3),
        resource_version: 4, party_kind: null, display_name: 'Synthetic private display',
        lifecycle_status: 'active', evaluated_at: at, action_authorization: 'not_evaluated',
      },
      relationship: {
        contract_version: 'resource-relationship.v1', relationship_id: id(4),
        relationship_version: 2, tenant_id: id(6), workspace_id: workspace,
        party_id: id(7), party_kind: partyKind, resource_type: 'property', resource_id: id(3),
        relationship_kind: kind, scope_codes: ['consumer_read'], valid_from: at,
        valid_until: '2026-10-11T12:00:00.000Z', evidence_reference: 'test://private-evidence',
        relationship_status: 'effective', evaluated_at: at, action_authorization: 'not_evaluated',
      },
      authority: {
        contract_version: authorityRequest.contract_version, decision_id: id(5),
        workspace_id: workspace, permission_code: permission, module_code: module,
        target_scope_type: 'workspace', target_scope_id: workspace,
        evaluator: 'app_private.check_workspace_native_permission_v2', authority_policy_version: 2,
        source_disclosure: 'status_only', source_reference: null, evaluated_at: at,
        current_authority_recheck_required: true, reusable_as_command_authority: false,
        decision: 'allowed', reason_codes: ['current_effective_permission_allowed'],
      },
    },
  };
}

let cases = 0;
function deny(f, reason) {
  const decision = evaluateCoreResourceAuthorityV1(f.request, f.evidence);
  assert.equal(decision.decision, 'denied');
  assert.deepEqual(decision.reason_codes, [reason]);
  assert.equal(decision.disclosure, 'withheld');
  assert.equal(decision.resource_identity, null);
  assert.equal(decision.relationship_reference, null);
  const serialized = JSON.stringify(decision);
  for (const privateValue of [id(3), id(4), id(6), id(7), 'Synthetic private display', 'test://private-evidence']) {
    assert.equal(serialized.includes(privateValue), false, `withheld output leaks ${privateValue}`);
  }
  cases++;
}

for (const consumer of consumers) {
  const baseline = fixture(consumer);
  const before = structuredClone(baseline);
  const allowed = evaluateCoreResourceAuthorityV1(baseline.request, baseline.evidence);
  assert.equal(allowed.decision, 'allowed'); // valid_from is inclusive
  assert.equal(allowed.resource_identity.resource_version, 4);
  assert.equal(allowed.relationship_reference.party_id, id(7));
  assert.equal(allowed.authority_reference.reusable_as_command_authority, false);
  assert.equal(allowed.authority_reference.current_authority_recheck_required, true);
  assert.deepEqual(baseline, before, 'evaluation must not mutate historical evidence');
  cases++;

  const switched = fixture(consumer, id(20));
  switched.evidence = structuredClone(baseline.evidence);
  deny(switched, 'authority_request_mismatch');

  // Re-resolving authority alone must not carry the old Workspace resource forward.
  switched.evidence.authority = fixture(consumer, id(20)).evidence.authority;
  deny(switched, 'resource_identity_mismatch');

  for (const other of consumers.filter((row) => row !== consumer)) {
    const crossDomain = structuredClone(baseline);
    crossDomain.evidence.authority = fixture(other).evidence.authority;
    deny(crossDomain, 'authority_request_mismatch');
  }

  const revoked = structuredClone(baseline);
  revoked.evidence.authority.decision = 'denied';
  revoked.evidence.authority.reason_codes = ['current_effective_permission_denied'];
  deny(revoked, 'authority_denied'); // same request ID cannot preserve a previous allow
  assert.equal(allowed.decision, 'allowed', 'prior decision remains historical evidence');

  const ended = structuredClone(baseline);
  ended.evidence.relationship.valid_from = '2026-10-09T12:00:00.000Z';
  ended.evidence.relationship.valid_until = at;
  deny(ended, 'relationship_outside_evaluation_time'); // valid_until is exclusive

  const replaced = structuredClone(baseline);
  replaced.evidence.resource.resource_version++;
  deny(replaced, 'resource_version_stale');

  const changedRelationship = structuredClone(baseline);
  changedRelationship.evidence.relationship.relationship_version++;
  deny(changedRelationship, 'relationship_version_stale');

  const tenantMismatch = structuredClone(baseline);
  tenantMismatch.evidence.relationship.tenant_id = id(60);
  deny(tenantMismatch, 'relationship_identity_mismatch');

  const explicitDeny = structuredClone(tenantMismatch);
  explicitDeny.evidence.authority.decision = 'denied';
  explicitDeny.evidence.authority.reason_codes = ['current_effective_permission_denied'];
  deny(explicitDeny, 'authority_denied');
  console.log(`PASS ${consumer[0]} dependency conformance`);
}
console.log(`${cases} cross-consumer contract cases passed; no database or Auth access`);
