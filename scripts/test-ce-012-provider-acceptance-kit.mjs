import assert from 'node:assert/strict';
import {
  CORE_CE012_MAP_DECISION_CONTRACT,
  DOCS_CE012_REFERENCE_DECISION_CONTRACT,
  coreCe012MapDecisionV1Schema,
  coreCe012MapRequestV1Schema,
  docsCe012ReferenceDecisionV1Schema,
  docsCe012ReferenceRequestV1Schema,
} from '../src/lib/community/experience-guide-command-contract.ts';
import {
  ce012ProviderAcceptanceFixture as fixture,
  runCe012ProviderAcceptanceKit,
} from './ce012-provider-acceptance-kit.mjs';

const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
let scenario = '';
let mutationState = { guides: 0, receipts: 0, audit: 0, outbox: 0, idempotency: 0 };

const coreResult = (request) => {
  const values = scenario === 'core_revoked_authority'
    ? { authority: 'revoked', entitlement: 'active' }
    : scenario === 'core_inactive_entitlement'
      ? { authority: 'allowed', entitlement: 'inactive' }
      : scenario === 'core_cross_workspace'
        ? { authority: 'denied', entitlement: 'active' }
        : { authority: 'allowed', entitlement: 'active' };
  return {
    contract: CORE_CE012_MAP_DECISION_CONTRACT,
    version: 1,
    decision_id: uuid(30),
    context_id: request.context_id,
    workspace_id: request.workspace_id,
    guide_id: request.guide_id,
    actor_id: fixture.actor_id,
    membership_id: fixture.membership_id,
    module_code: request.module_code,
    entitlement_key: request.entitlement_key,
    permission_code: request.permission_code,
    ...values,
    evaluated_at: fixture.evaluated_at,
  };
};

const docsResult = (request) => {
  const decision = scenario === 'docs_historical_replay' ? 'historical_authorized'
    : scenario === 'docs_stale_or_mutable_reference' ? 'stale'
      : scenario === 'docs_revoked_authority' || scenario === 'docs_cross_workspace' ? 'denied'
        : 'current_authorized';
  const allowed = decision === 'current_authorized' || decision === 'historical_authorized';
  return {
    contract: DOCS_CE012_REFERENCE_DECISION_CONTRACT,
    version: 1,
    decision_id: uuid(31),
    context_id: request.context_id,
    workspace_id: request.workspace_id,
    guide_id: request.guide_id,
    target: request.target,
    evaluation_mode: request.evaluation_mode,
    authority_basis: 'current_server_session',
    decision,
    safe_label: allowed ? fixture.safe_label : null,
    redaction: allowed ? 'safe_label_only' : 'none',
    evaluated_at: fixture.evaluated_at,
  };
};

const adapter = {
  async arrange(name) { scenario = name; },
  async evaluateCore(request) { return coreResult(request); },
  async evaluateDocuments(request) { return docsResult(request); },
  async mutationDigest() { return mutationState; },
};

const report = await runCe012ProviderAcceptanceKit(adapter);
assert.deepEqual(report, {
  contract: 'ce012-provider-acceptance-kit.v1',
  scenarios: 9,
  compatibility_checks: 4,
  result: 'pass',
});

const coreRequest = {
  contract: 'core-ce012-map-request.v1', version: 1,
  context_id: fixture.context_id, workspace_id: fixture.workspace_id, guide_id: fixture.guide_id,
  action: 'save_draft', module_code: 'experience_guides',
  entitlement_key: 'module.experience_guides', permission_code: 'experience.guide.manage',
};
const docsRequest = {
  contract: 'docs-ce012-reference-request.v1', version: 1,
  context_id: fixture.context_id, workspace_id: fixture.workspace_id, guide_id: fixture.guide_id,
  target: {
    document_id: fixture.document_id,
    document_version_id: fixture.document_version_id,
    document_version: fixture.document_version,
  },
  evaluation_mode: 'new_command',
};

for (const invalid of [
  { ...docsRequest, target: { ...docsRequest.target, document_version_id: undefined } },
  { ...docsRequest, target: { ...docsRequest.target, document_version_id: 'latest' } },
  { ...docsRequest, target: { ...docsRequest.target, document_version: 0 } },
  { ...docsRequest, target: { ...docsRequest.target, document_version: Number.MAX_SAFE_INTEGER + 1 } },
  { ...docsRequest, object_path: 'private/object' },
]) assert.equal(docsCe012ReferenceRequestV1Schema.safeParse(invalid).success, false);

for (const invalid of [
  { ...coreRequest, workspace_id: undefined },
  { ...coreRequest, guide_id: undefined },
  { ...coreRequest, permission_code: 'documents.read' },
  { ...coreRequest, actor_id: fixture.actor_id },
]) assert.equal(coreCe012MapRequestV1Schema.safeParse(invalid).success, false);

const validCore = coreResult(coreRequest);
for (const invalid of [
  { ...validCore, evaluated_at: 'not-a-timestamp' },
  { ...validCore, tenant_id: uuid(99) },
  { ...validCore, guide_id: fixture.other_guide_id },
]) assert.equal(coreCe012MapDecisionV1Schema.safeParse(invalid).success, invalid.guide_id === fixture.other_guide_id);

scenario = 'docs_current_immutable_version';
const validDocs = docsResult(docsRequest);
for (const internalField of ['object_path', 'bucket_id', 'sha256', 'mime_type', 'classification', 'owner_id', 'tenant_id']) {
  assert.equal(docsCe012ReferenceDecisionV1Schema.safeParse({ ...validDocs, [internalField]: 'secret' }).success, false);
}
assert.equal(docsCe012ReferenceDecisionV1Schema.safeParse({ ...validDocs, evaluated_at: 'yesterday' }).success, false);
assert.equal(docsCe012ReferenceDecisionV1Schema.safeParse({ ...validDocs, target: { ...validDocs.target, document_version: 0 } }).success, false);
assert.equal(docsCe012ReferenceDecisionV1Schema.safeParse({ ...validDocs, target: { ...validDocs.target, document_version: Number.MAX_SAFE_INTEGER + 1 } }).success, false);

scenario = 'docs_cross_workspace';
const deniedDocs = docsResult({ ...docsRequest, workspace_id: fixture.other_workspace_id });
assert.equal(deniedDocs.safe_label, null);
assert.equal(deniedDocs.redaction, 'none');
assert.equal(docsCe012ReferenceDecisionV1Schema.safeParse({ ...deniedDocs, safe_label: fixture.safe_label }).success, false);

mutationState = { ...mutationState, receipts: 1 };
await assert.rejects(
  runCe012ProviderAcceptanceKit({ ...adapter, mutationDigest: async () => ({ ...mutationState, receipts: mutationState.receipts++ }) }),
  /zero-write/,
);

console.log('CE012 provider acceptance kit: 9 provider scenarios, 4 command compatibility gates, strict redaction/version/input boundary and zero-write sentinel passed');
