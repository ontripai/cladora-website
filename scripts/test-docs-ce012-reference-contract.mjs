import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DOCS_CE012_REFERENCE_DECISION_CONTRACT,
  DOCS_CE012_REFERENCE_REQUEST_CONTRACT,
  docsCe012ImmutableTargetV1Schema,
  docsCe012ReferenceDecisionV1Schema,
  docsCe012ReferenceRequestV1Schema,
} from '../src/lib/customer/documents-ce012-reference-contract.ts';

const uuid = (suffix) => `20000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const request = {
  contract: DOCS_CE012_REFERENCE_REQUEST_CONTRACT,
  version: 1,
  context_id: uuid(1),
  workspace_id: uuid(2),
  guide_id: uuid(3),
  target: { document_id: uuid(4), document_version_id: uuid(5), document_version: 7 },
  evaluation_mode: 'new_command',
};
const decision = (value, overrides = {}) => {
  const allowed = value === 'current_authorized' || value === 'historical_authorized';
  return {
    contract: DOCS_CE012_REFERENCE_DECISION_CONTRACT,
    version: 1,
    decision_id: uuid(6),
    context_id: request.context_id,
    workspace_id: request.workspace_id,
    guide_id: request.guide_id,
    target: request.target,
    evaluation_mode: request.evaluation_mode,
    authority_basis: 'current_server_session',
    decision: value,
    safe_label: allowed ? 'Building safety instructions' : null,
    redaction: allowed ? 'safe_label_only' : 'none',
    evaluated_at: '2026-10-11T15:30:00.000Z',
    ...overrides,
  };
};

const requestBefore = structuredClone(request);
assert.deepEqual(docsCe012ReferenceRequestV1Schema.parse(request), request);
assert.deepEqual(request, requestBefore, 'request parsing is zero-mutation');
assert.deepEqual(docsCe012ImmutableTargetV1Schema.parse(request.target), request.target);

for (const invalid of [
  { ...request, context_id: undefined },
  { ...request, workspace_id: undefined },
  { ...request, guide_id: undefined },
  { ...request, target: { document_id: request.target.document_id } },
  { ...request, target: { ...request.target, document_version_id: 'latest' } },
  { ...request, target: { ...request.target, document_version: 0 } },
  { ...request, target: { ...request.target, document_version: -1 } },
  { ...request, target: { ...request.target, document_version: 1.5 } },
  { ...request, target: { ...request.target, document_version: Number.MAX_SAFE_INTEGER + 1 } },
  { ...request, actor_id: uuid(9) },
  { ...request, authority: 'allowed' },
  { ...request, safe_label: 'Client label' },
]) assert.equal(docsCe012ReferenceRequestV1Schema.safeParse(invalid).success, false);

for (const value of ['current_authorized', 'historical_authorized']) {
  const candidate = decision(value);
  const before = structuredClone(candidate);
  const parsed = docsCe012ReferenceDecisionV1Schema.parse(candidate);
  assert.deepEqual(candidate, before, `${value} parsing is zero-mutation`);
  assert.equal(parsed.authority_basis, 'current_server_session');
  assert.equal(parsed.safe_label, 'Building safety instructions');
  assert.equal(parsed.redaction, 'safe_label_only');
  assert.deepEqual(parsed.target, request.target);
}

for (const value of ['stale', 'denied', 'not_found', 'not_ready']) {
  const parsed = docsCe012ReferenceDecisionV1Schema.parse(decision(value));
  assert.equal(parsed.safe_label, null, `${value} cannot disclose a label`);
  assert.equal(parsed.redaction, 'none', `${value} has no released metadata`);
  assert.equal(parsed.authority_basis, 'current_server_session');
}

const crossWorkspace = decision('denied', { workspace_id: uuid(20) });
assert.equal(docsCe012ReferenceDecisionV1Schema.parse(crossWorkspace).decision, 'denied');
const revokedAuthority = decision('denied');
assert.equal(docsCe012ReferenceDecisionV1Schema.parse(revokedAuthority).decision, 'denied');
const staleVersion = decision('stale');
assert.equal(docsCe012ReferenceDecisionV1Schema.parse(staleVersion).decision, 'stale');

for (const invalid of [
  { ...decision('current_authorized'), safe_label: null },
  { ...decision('denied'), safe_label: 'Leaked label' },
  { ...decision('denied'), redaction: 'safe_label_only' },
  { ...decision('current_authorized'), authority_basis: 'client_claim' },
  { ...decision('current_authorized'), evaluated_at: 'today' },
  { ...decision('current_authorized'), target: { ...request.target, document_version: 0 } },
  { ...decision('current_authorized'), target: { ...request.target, document_version_id: 'mutable' } },
]) assert.equal(docsCe012ReferenceDecisionV1Schema.safeParse(invalid).success, false);

for (const internalField of ['object_path', 'bucket_id', 'sha256', 'mime_type', 'classification', 'owner_id', 'tenant_id', 'storage_key']) {
  assert.equal(docsCe012ReferenceDecisionV1Schema.safeParse({ ...decision('current_authorized'), [internalField]: 'internal' }).success, false);
}

const source = fs.readFileSync('src/lib/customer/documents-ce012-reference-contract.ts', 'utf8');
assert.doesNotMatch(source, /@supabase|createClient\s*\(|\.rpc\s*\(|\.from\s*\(/);
assert.doesNotMatch(source, /CREATE\s+(?:TABLE|FUNCTION|POLICY)|SECURITY\s+DEFINER/i);
assert.doesNotMatch(source, /resolve\w*\s*=|class\s+.*(?:Store|Resolver)|new\s+Map/);

console.log('DOCS-CE012-REF-01A contract passed: exact immutable target, current-session authority basis, safe decisions, redaction, denial and zero-mutation');
