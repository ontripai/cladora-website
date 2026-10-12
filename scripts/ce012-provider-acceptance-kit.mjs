import assert from 'node:assert/strict';
import {
  CE012_GUIDE_COMMAND_CONTRACT,
  coreCe012MapDecisionV1Schema,
  coreCe012MapRequestV1Schema,
  docsCe012ReferenceDecisionV1Schema,
  docsCe012ReferenceRequestV1Schema,
  evaluateCe012GuideSaveCommand,
  fingerprintCe012GuideSavePayload,
} from '../src/lib/community/experience-guide-command-contract.ts';

const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;

export const ce012ProviderAcceptanceFixture = Object.freeze({
  context_id: uuid(1),
  workspace_id: uuid(2),
  other_workspace_id: uuid(3),
  guide_id: uuid(4),
  other_guide_id: uuid(5),
  actor_id: uuid(6),
  membership_id: uuid(7),
  document_id: uuid(8),
  document_version_id: uuid(9),
  document_version: 12,
  safe_label: 'Public safety instructions',
  evaluated_at: '2026-10-11T13:30:00.000Z',
});

const coreRequest = (overrides = {}) => coreCe012MapRequestV1Schema.parse({
  contract: 'core-ce012-map-request.v1',
  version: 1,
  context_id: ce012ProviderAcceptanceFixture.context_id,
  workspace_id: ce012ProviderAcceptanceFixture.workspace_id,
  guide_id: ce012ProviderAcceptanceFixture.guide_id,
  action: 'save_draft',
  module_code: 'experience_guides',
  entitlement_key: 'module.experience_guides',
  permission_code: 'experience.guide.manage',
  ...overrides,
});

const docsRequest = (overrides = {}) => docsCe012ReferenceRequestV1Schema.parse({
  contract: 'docs-ce012-reference-request.v1',
  version: 1,
  context_id: ce012ProviderAcceptanceFixture.context_id,
  workspace_id: ce012ProviderAcceptanceFixture.workspace_id,
  guide_id: ce012ProviderAcceptanceFixture.guide_id,
  target: {
    document_id: ce012ProviderAcceptanceFixture.document_id,
    document_version_id: ce012ProviderAcceptanceFixture.document_version_id,
    document_version: ce012ProviderAcceptanceFixture.document_version,
  },
  evaluation_mode: 'new_command',
  ...overrides,
});

const scenarios = [
  { name: 'core_current_authority', provider: 'core', request: coreRequest(), expected: { authority: 'allowed', entitlement: 'active' } },
  { name: 'core_revoked_authority', provider: 'core', request: coreRequest(), expected: { authority: 'revoked', entitlement: 'active' }, denial: true },
  { name: 'core_inactive_entitlement', provider: 'core', request: coreRequest(), expected: { authority: 'allowed', entitlement: 'inactive' }, denial: true },
  { name: 'core_cross_workspace', provider: 'core', request: coreRequest({ workspace_id: ce012ProviderAcceptanceFixture.other_workspace_id, guide_id: ce012ProviderAcceptanceFixture.other_guide_id }), expected: { authority: 'denied' }, denial: true },
  { name: 'docs_current_immutable_version', provider: 'documents', request: docsRequest(), expected: { decision: 'current_authorized', authority_basis: 'current_server_session', safe_label: ce012ProviderAcceptanceFixture.safe_label, redaction: 'safe_label_only' } },
  { name: 'docs_historical_replay', provider: 'documents', request: docsRequest({ evaluation_mode: 'replay' }), expected: { decision: 'historical_authorized', authority_basis: 'current_server_session', safe_label: ce012ProviderAcceptanceFixture.safe_label, redaction: 'safe_label_only' } },
  { name: 'docs_stale_or_mutable_reference', provider: 'documents', request: docsRequest(), expected: { decision: 'stale', authority_basis: 'current_server_session', safe_label: null, redaction: 'none' }, denial: true },
  { name: 'docs_revoked_authority', provider: 'documents', request: docsRequest(), expected: { decision: 'denied', authority_basis: 'current_server_session', safe_label: null, redaction: 'none' }, denial: true },
  { name: 'docs_cross_workspace', provider: 'documents', request: docsRequest({ workspace_id: ce012ProviderAcceptanceFixture.other_workspace_id, guide_id: ce012ProviderAcceptanceFixture.other_guide_id }), expected: { decision: 'denied', authority_basis: 'current_server_session', safe_label: null, redaction: 'none' }, denial: true },
];

const exactCoreBinding = (decision, request) => {
  assert.equal(decision.context_id, request.context_id, 'Core decision must bind exact Context');
  assert.equal(decision.workspace_id, request.workspace_id, 'Core decision must bind exact Workspace');
  assert.equal(decision.guide_id, request.guide_id, 'Core decision must bind exact Guide');
  assert.equal(decision.module_code, request.module_code, 'Core decision must bind module');
  assert.equal(decision.entitlement_key, request.entitlement_key, 'Core decision must bind entitlement');
  assert.equal(decision.permission_code, request.permission_code, 'Core decision must bind permission');
};

const exactDocsBinding = (decision, request) => {
  assert.equal(decision.context_id, request.context_id, 'Documents decision must bind exact Context');
  assert.equal(decision.workspace_id, request.workspace_id, 'Documents decision must bind exact Workspace');
  assert.equal(decision.guide_id, request.guide_id, 'Documents decision must bind exact Guide');
  assert.deepEqual(decision.target, request.target, 'Documents decision must bind the exact immutable target');
  assert.equal(decision.evaluation_mode, request.evaluation_mode, 'Documents decision must bind evaluation mode');
};

const makeCommand = () => {
  const command = {
    contract: CE012_GUIDE_COMMAND_CONTRACT,
    version: 1,
    command_id: uuid(20),
    action: 'save_draft',
    context_id: ce012ProviderAcceptanceFixture.context_id,
    workspace_id: ce012ProviderAcceptanceFixture.workspace_id,
    guide_id: ce012ProviderAcceptanceFixture.guide_id,
    expected_guide_version: 7,
    payload: {
      title: 'Arrival guide',
      step_id: uuid(21),
      step_title: 'Before arrival',
      instructions: 'Read the current safety instructions.',
      document_target: {
        document_id: ce012ProviderAcceptanceFixture.document_id,
        document_version_id: ce012ProviderAcceptanceFixture.document_version_id,
        document_version: ce012ProviderAcceptanceFixture.document_version,
        label: 'Untrusted browser label',
      },
    },
    idempotency_key: 'ce012:provider-kit:0001',
  };
  command.payload_fingerprint = fingerprintCe012GuideSavePayload(command);
  return command;
};

const compatibilitySnapshot = (command, coreDecision, documentDecision) => ({
  guide: {
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    guide_id: command.guide_id,
    current_version: command.expected_guide_version,
    state: 'draft',
  },
  core_decision: coreDecision,
  document_decision: documentDecision,
  issuance: {
    receipt_id: uuid(22),
    idempotency_binding_id: uuid(23),
    evaluated_at: ce012ProviderAcceptanceFixture.evaluated_at,
  },
  replay: null,
});

export async function runCe012ProviderAcceptanceKit(adapter) {
  for (const method of ['arrange', 'evaluateCore', 'evaluateDocuments', 'mutationDigest']) {
    assert.equal(typeof adapter?.[method], 'function', `adapter.${method} must be a function`);
  }

  const decisions = new Map();
  for (const scenario of scenarios) {
    await adapter.arrange(scenario.name, ce012ProviderAcceptanceFixture);
    const before = structuredClone(await adapter.mutationDigest());
    const raw = scenario.provider === 'core'
      ? await adapter.evaluateCore(scenario.request)
      : await adapter.evaluateDocuments(scenario.request);
    const after = structuredClone(await adapter.mutationDigest());
    assert.deepEqual(after, before, `${scenario.name}: provider evaluation must be zero-write`);

    const decision = scenario.provider === 'core'
      ? coreCe012MapDecisionV1Schema.parse(raw)
      : docsCe012ReferenceDecisionV1Schema.parse(raw);
    if (scenario.provider === 'core') exactCoreBinding(decision, scenario.request);
    else exactDocsBinding(decision, scenario.request);
    for (const [key, expected] of Object.entries(scenario.expected)) {
      assert.deepEqual(decision[key], expected, `${scenario.name}: ${key}`);
    }
    decisions.set(scenario.name, decision);
  }

  const command = makeCommand();
  const accepted = evaluateCe012GuideSaveCommand(command, compatibilitySnapshot(
    command,
    decisions.get('core_current_authority'),
    decisions.get('docs_current_immutable_version'),
  ));
  assert.equal(accepted.result_code, 'OK', 'provider decisions must be compatible with ce012-guide-command.v1');
  assert.equal(accepted.receipt?.document_target?.label, ce012ProviderAcceptanceFixture.safe_label, 'receipt must use the provider-redacted label');
  assert.equal(accepted.mutation_plan?.payload.document_target?.label, ce012ProviderAcceptanceFixture.safe_label, 'mutation plan must use the provider-redacted label');

  const revoked = evaluateCe012GuideSaveCommand(command, compatibilitySnapshot(
    command,
    decisions.get('core_revoked_authority'),
    decisions.get('docs_current_immutable_version'),
  ));
  assert.equal(revoked.result_code, 'AUTHORITY_DENIED');
  assert.equal(revoked.receipt, null);
  assert.equal(revoked.mutation_plan, null);

  const stale = evaluateCe012GuideSaveCommand(command, compatibilitySnapshot(
    command,
    decisions.get('core_current_authority'),
    decisions.get('docs_stale_or_mutable_reference'),
  ));
  assert.equal(stale.result_code, 'DOCUMENT_STALE');
  assert.equal(stale.receipt, null);
  assert.equal(stale.mutation_plan, null);

  const crossWorkspace = evaluateCe012GuideSaveCommand(command, compatibilitySnapshot(
    command,
    decisions.get('core_cross_workspace'),
    decisions.get('docs_cross_workspace'),
  ));
  assert.equal(crossWorkspace.result_code, 'WORKSPACE_MISMATCH');
  assert.equal(crossWorkspace.receipt, null);
  assert.equal(crossWorkspace.mutation_plan, null);

  return {
    contract: 'ce012-provider-acceptance-kit.v1',
    scenarios: scenarios.length,
    compatibility_checks: 4,
    result: 'pass',
  };
}
