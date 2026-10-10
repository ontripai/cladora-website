import assert from 'node:assert/strict';

const {
  coreResourceAuthorityDecisionV1Schema,
  coreResourceAuthorityRequestV1Schema,
  evaluateCoreResourceAuthorityV1,
} = await import('../src/lib/core/resource-authority-contract-v1.ts');

const id = (value) => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
const evaluatedAt = '2026-10-10T12:00:00.000Z';

const request = {
  contract_version: 'core-resource-authority.v1',
  evaluation_time: evaluatedAt,
  resource: {
    contract_version: 'canonical-resource-reference.v1',
    context_id: id(1),
    workspace_id: id(2),
    resource_type: 'property',
    resource_id: id(3),
    resource_version: 4,
    permission_code: 'airprop.asset.read',
    purpose: 'airprop.management.portfolio',
  },
  relationship: {
    relationship_id: id(4),
    relationship_version: 2,
    relationship_kind: 'management',
    required_scope_codes: ['owner_reporting', 'maintenance_coordination'],
  },
  authority: {
    contract_version: 'workspace-native-effective-authority.v2',
    decision_id: id(5),
    context_id: id(1),
    workspace_id: id(2),
    permission_code: 'airprop.asset.read',
    module_code: 'airprop_commercial',
    target_scope_type: 'workspace',
    target_scope_id: id(2),
    evaluation_purpose: 'airprop.management.portfolio',
  },
};

const resource = {
  contract_version: 'canonical-resource-reference.v1',
  reference_status: 'verified',
  tenant_id: id(6),
  workspace_id: id(2),
  resource_type: 'property',
  resource_id: id(3),
  resource_version: 4,
  party_kind: null,
  display_name: 'Synthetic accepted contract property',
  lifecycle_status: 'active',
  evaluated_at: evaluatedAt,
  action_authorization: 'not_evaluated',
};

const relationship = {
  contract_version: 'resource-relationship.v1',
  relationship_id: id(4),
  relationship_version: 2,
  tenant_id: id(6),
  workspace_id: id(2),
  party_id: id(7),
  party_kind: 'company',
  resource_type: 'property',
  resource_id: id(3),
  relationship_kind: 'management',
  scope_codes: ['maintenance_coordination', 'owner_reporting'],
  valid_from: '2026-01-01T00:00:00.000Z',
  valid_until: '2027-01-01T00:00:00.000Z',
  evidence_reference: 'test://contract/evidence',
  relationship_status: 'effective',
  evaluated_at: evaluatedAt,
  action_authorization: 'not_evaluated',
};

const authority = {
  contract_version: 'workspace-native-effective-authority.v2',
  decision_id: id(5),
  workspace_id: id(2),
  permission_code: 'airprop.asset.read',
  module_code: 'airprop_commercial',
  target_scope_type: 'workspace',
  target_scope_id: id(2),
  evaluator: 'app_private.check_workspace_native_permission_v2',
  authority_policy_version: 2,
  source_disclosure: 'status_only',
  source_reference: null,
  evaluated_at: evaluatedAt,
  current_authority_recheck_required: true,
  reusable_as_command_authority: false,
  decision: 'allowed',
  reason_codes: ['current_effective_permission_allowed'],
};

const evidence = { resource, relationship, authority };
const clone = (value) => structuredClone(value);
let cases = 0;
function check(name, fn) {
  fn();
  cases += 1;
  process.stdout.write(`PASS ${name}\n`);
}
function decide(mutator = () => {}) {
  const next = clone(evidence);
  mutator(next);
  return evaluateCoreResourceAuthorityV1(clone(request), next);
}
function expectDenied(expected, mutator) {
  const decision = decide(mutator);
  assert.equal(decision.decision, 'denied');
  assert.equal(decision.disclosure, 'withheld');
  assert.equal(decision.resource_identity, null);
  assert.equal(decision.relationship_reference, null);
  assert.deepEqual(decision.reason_codes, [expected]);
  return decision;
}

check('exact resource, current relationship and current authority allow', () => {
  const decision = decide();
  assert.equal(decision.decision, 'allowed');
  assert.equal(decision.resource_identity.resource_id, id(3));
  assert.equal(decision.resource_identity.resource_version, 4);
  assert.equal(decision.relationship_reference.relationship_id, id(4));
  assert.deepEqual(decision.reason_codes, ['resource_relationship_authority_verified']);
  assert.equal(coreResourceAuthorityDecisionV1Schema.safeParse(decision).success, true);
});

check('authority deny is evaluated before resource disclosure', () => {
  const decision = expectDenied('authority_denied', (next) => {
    next.authority.decision = 'denied';
    next.authority.reason_codes = ['current_effective_permission_denied'];
    next.resource.display_name = 'must never be disclosed';
  });
  assert.doesNotMatch(JSON.stringify(decision), /must never be disclosed/);
});

check('authority decision must match exact request', () => {
  expectDenied('authority_request_mismatch', (next) => {
    next.authority.decision_id = id(99);
  });
});

check('authority evidence must belong to the current evaluation snapshot', () => {
  expectDenied('authority_evaluation_stale', (next) => {
    next.authority.evaluated_at = '2026-10-10T11:59:59.000Z';
  });
});

check('stale resource fails closed', () => {
  expectDenied('resource_not_verified', (next) => {
    next.resource.reference_status = 'stale';
  });
});

check('resource identity and version are pinned independently', () => {
  expectDenied('resource_identity_mismatch', (next) => {
    next.resource.resource_id = id(30);
  });
  expectDenied('resource_version_stale', (next) => {
    next.resource.resource_version = 5;
  });
});

check('resource evidence must belong to the current evaluation snapshot', () => {
  expectDenied('resource_evaluation_stale', (next) => {
    next.resource.evaluated_at = '2026-10-10T11:59:59.000Z';
  });
});

check('relationship is mandatory and pinned to the same canonical resource', () => {
  expectDenied('relationship_missing', (next) => {
    next.relationship = null;
  });
  expectDenied('relationship_identity_mismatch', (next) => {
    next.relationship.workspace_id = id(20);
  });
  expectDenied('relationship_identity_mismatch', (next) => {
    next.relationship.tenant_id = id(60);
  });
});

check('relationship version and kind are pinned', () => {
  expectDenied('relationship_version_stale', (next) => {
    next.relationship.relationship_version = 3;
  });
  expectDenied('relationship_kind_mismatch', (next) => {
    next.relationship.relationship_kind = 'ownership';
  });
});

check('relationship scopes cannot be widened by the consumer', () => {
  expectDenied('relationship_scope_insufficient', (next) => {
    next.relationship.scope_codes = ['owner_reporting'];
  });
});

check('revoked or expired relationship status fails closed', () => {
  expectDenied('relationship_not_effective', (next) => {
    next.relationship.relationship_status = 'revoked';
  });
});

check('relationship evidence must belong to the current evaluation snapshot', () => {
  expectDenied('relationship_evaluation_stale', (next) => {
    next.relationship.evaluated_at = '2026-10-10T11:59:59.000Z';
  });
});

check('future and ended temporal relationships fail closed', () => {
  expectDenied('relationship_outside_evaluation_time', (next) => {
    next.relationship.valid_from = '2026-10-11T00:00:00.000Z';
    next.relationship.valid_until = '2027-01-01T00:00:00.000Z';
  });
  expectDenied('relationship_outside_evaluation_time', (next) => {
    next.relationship.valid_until = evaluatedAt;
  });
});

check('malformed evidence becomes a withheld denial', () => {
  const decision = evaluateCoreResourceAuthorityV1(clone(request), { unexpected: true });
  assert.deepEqual(decision.reason_codes, ['invalid_or_mismatched_evidence']);
  assert.equal(decision.resource_identity, null);
});

check('consumer input is strict and internally consistent', () => {
  assert.equal(coreResourceAuthorityRequestV1Schema.safeParse({ ...clone(request), unexpected: true }).success, false);
  const mismatch = clone(request);
  mismatch.authority.workspace_id = id(22);
  mismatch.authority.target_scope_id = id(22);
  assert.equal(coreResourceAuthorityRequestV1Schema.safeParse(mismatch).success, false);
  const duplicateScope = clone(request);
  duplicateScope.relationship.required_scope_codes = ['owner_reporting', 'owner_reporting'];
  assert.equal(coreResourceAuthorityRequestV1Schema.safeParse(duplicateScope).success, false);
});

check('authority reference is status-only and never reusable', () => {
  const allowed = decide();
  assert.equal(allowed.authority_reference.source_disclosure, 'status_only');
  assert.equal(allowed.authority_reference.source_reference, null);
  assert.equal(allowed.authority_reference.current_authority_recheck_required, true);
  assert.equal(allowed.authority_reference.reusable_as_command_authority, false);
});

process.stdout.write(`${cases} Core Resource/Relationship/Authority authorization cases passed\n`);
