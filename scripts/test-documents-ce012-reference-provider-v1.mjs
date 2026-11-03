import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Real producer, canonical selectors/Core resolver, CE bridge and evaluator.
// Only scope.query and the upstream Core bridge ports are controlled fixtures.
// No database, issued Auth session, role/ACL or durable receipt proof is claimed.
const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  cache.set(url.href, mod.exports);
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name), mod, mod.exports);
  cache.set(url.href, mod.exports);
  return mod.exports;
}
const producer = load(new URL('../src/lib/customer/documents-ce012-reference-provider-v1.ts', import.meta.url));
const selectors = load(new URL('../src/lib/customer/documents-reference-tx-selector-v1.ts', import.meta.url));
const core = load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts', import.meta.url));
const ce = load(new URL('../src/lib/community/experience-guide-command-contract.ts', import.meta.url));
const bridgeApi = load(new URL('../src/lib/community/experience-guide-provider-bridge.ts', import.meta.url));
const id = n => `38000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-11-02T08:00:01.000Z';
const target = { document_id: id(8), document_version_id: id(9), document_version: 2 };
const guide = { contract: 'ce012-guide-command.v1', version: 1, command_id: id(1),
  action: 'save_draft', context_id: id(2), workspace_id: id(3), guide_id: id(4),
  expected_guide_version: 5, idempotency_key: 'ce012-provider-closeout-02',
  payload: { title: 'Synthetic guide', step_id: id(7), step_title: 'Read',
    instructions: 'Read the authorized reference.', document_target: { ...target, label: 'UNTRUSTED label' } } };
guide.payload_fingerprint = ce.fingerprintCe012GuideSavePayload(guide);
const command = { contract_version: 'core-transaction-command.v2', transaction_id: id(10),
  command_id: guide.command_id, context_id: guide.context_id, workspace_id: guide.workspace_id,
  actor_id: id(5), authority_version: 7, permission_code: 'experience.guide.manage',
  module_code: 'experience_guides', evaluation_purpose: 'experience.guide.command',
  aggregate_type: 'experience_guide', aggregate_id: guide.guide_id, aggregate_version: 6,
  subject_reference: { kind: 'experience.guide', id: guide.guide_id, version: 5, relation: 'save_draft', request_version: 1 },
  provider_source_ids: [guide.guide_id, target.document_id, target.document_version_id],
  input_fingerprint: guide.payload_fingerprint, idempotency_key: guide.idempotency_key };
const transaction = { transaction_id: command.transaction_id, command_id: command.command_id,
  attempt: 1, isolation_level: 'serializable', lock: { kind: 'command_aggregate',
    workspace_id: guide.workspace_id, aggregate_type: 'experience_guide', aggregate_id: guide.guide_id,
    acquired_at: '2026-11-02T08:00:00.000Z' } };
function receipt(request) {
  return core.bindCanonicalCurrentAuthorityObservationV1(request, {
    contract_version: 'core-current-authority-observation.v1', source_contract: 'workspace-native-effective-authority.v2',
    decision_id: request.decision_id, context_id: request.context_id, workspace_id: request.workspace_id,
    actor_id: request.actor_id, authority_version: request.authority_version,
    permission_code: request.permission_code, module_code: request.module_code,
    transaction_context: request.transaction_context, evaluator: 'app_private.check_workspace_native_permission_v2',
    source_disclosure: 'status_only', source_reference: null, actor_status: 'current',
    decision: 'allowed', evaluated_at: now,
    entitlement: { contract_version: 'core-authority-entitlement-binding.v1', workspace_id: request.workspace_id,
      module_definition_id: id(14), module_code: request.module_code,
      entitlement_key: `module.${request.module_code}`, authority_revision: request.authority_version },
  });
}
const authority = receipt({ contract_version: 'core-current-authority-transaction-port-request.v1',
  decision_id: id(11), context_id: guide.context_id, workspace_id: guide.workspace_id,
  actor_id: command.actor_id, authority_version: 7, permission_code: command.permission_code,
  module_code: command.module_code, evaluation_purpose: command.evaluation_purpose, transaction_context: transaction });
const request = { contract: 'docs-ce012-reference-request.v1', version: 1, context_id: guide.context_id,
  workspace_id: guide.workspace_id, guide_id: guide.guide_id, target, evaluation_mode: 'new_command' };
function fixture(state = {}) {
  const calls = [];
  const scope = { transaction_id: command.transaction_id, database_transaction_id: '42',
    workspace_id: guide.workspace_id, tenant_id: id(12), actor_id: command.actor_id, attempt: 1,
    async query(sql, values = []) {
      calls.push({ sql, values });
      assert.match(sql, /^\s*select\b/i, 'read port must never issue writes, SET or transaction commands');
      if (state.error) throw state.error;
      const one = row => ({ rowCount: 1, rows: [row] });
      if (sql === 'select auth.uid()::text as actor_id') return one({ actor_id: state.actor ?? command.actor_id });
      if (sql.includes('txid_current()') && sql.includes('as evaluated_at')) return one({
        transaction_id: '42', actor_id: state.actor ?? command.actor_id, isolation: 'serializable', evaluated_at: now });
      if (sql.includes('canonical_authority_revision_v1')) return one({ revision: state.revision ?? '7' });
      if (sql.includes('from identity.context_grants g join identity.memberships')) return one({
        tenant_id: scope.tenant_id, actor_id: command.actor_id, status: state.revoked ? 'revoked' : 'active', current: !state.expired });
      if (sql.includes('from platform.customer_workspaces')) {
        assert.deepEqual(values, [guide.workspace_id]);
        return one({ tenant_id: state.otherTenant ? id(98) : scope.tenant_id });
      }
      if (sql.includes('app_private.check_workspace_native_permission_v2')) {
        assert.deepEqual(values, [guide.context_id, guide.workspace_id, 'documents.vault.read', 'documents']);
        return one({ allowed: !state.denied, evaluated_at: now, module_definition_id: id(14), entitlement_key: 'module.documents' });
      }
      if (sql.includes('actor_bound')) return one({ transaction_id: '42', isolation: 'serializable', actor_bound: true, aal2: !state.aal1 });
      if (sql.includes('from documents.documents d where')) {
        assert.deepEqual(values, [target.document_id, guide.workspace_id, scope.tenant_id]);
        return state.unbound ? { rowCount: 0, rows: [] } : one({ current_version: state.currentVersion ?? 2, active: !state.deleted });
      }
      if (sql.includes('from documents.document_versions v\n')) {
        assert.deepEqual(values, [target.document_version_id, target.document_id, scope.tenant_id]);
        return one({ version: state.version ?? 2, scanning_status: state.scan ?? 'clean', checksum_status: 'verified' });
      }
      if (sql.includes('from documents.document_permissions p\n')) return { rowCount: 0, rows: [] };
      if (sql.includes('documents.customer_document_scope_matches')) return one({ allowed: !state.hidden });
      if (sql.includes('documents.document_scan_attestations')) return one({ clean: !state.noAttestation });
      if (sql.includes('clock_timestamp()::text as now')) return one({ now });
      throw Error('unrecognized controlled query');
    } };
  return { scope, calls };
}
function provider(f, mode = 'new_command', cmd = command, auth = authority, guideCommand = guide) {
  return producer.createDocumentsCe012ReferenceProviderV1(f.scope, cmd, auth, guideCommand, mode);
}
let groups = 0;
async function check(name, body) { await body(); console.log(`ok ${++groups} - ${name}`); }
function redacted(result, expected) {
  assert.equal(result.decision, expected);
  assert.equal(result.safe_label, null);
  assert.equal(result.redaction, 'none');
  assert.deepEqual(Object.keys(result).sort(), ['contract', 'version', 'decision_id', 'context_id', 'workspace_id',
    'guide_id', 'target', 'evaluation_mode', 'authority_basis', 'decision', 'safe_label', 'redaction', 'evaluated_at'].sort());
}
const coreContext = { contract: 'core-ce012-map-decision.v1', version: 1, decision_id: id(16),
  context_id: guide.context_id, workspace_id: guide.workspace_id, guide_id: guide.guide_id,
  actor_id: command.actor_id, membership_id: id(6), module_code: 'experience_guides',
  entitlement_key: 'module.experience_guides', permission_code: 'experience.guide.manage',
  authority: 'allowed', entitlement: 'active', evaluated_at: now };
const snapshot = docs => ({ guide: { guide_id: guide.guide_id, context_id: guide.context_id,
  workspace_id: guide.workspace_id, current_version: 5, state: 'draft' },
  core_decision: coreContext, document_decision: docs,
  issuance: { receipt_id: id(20), idempotency_binding_id: id(21), evaluated_at: now }, replay: null });
async function connect(f) {
  const bridge = bridgeApi.createCe012GuideProviderBridge({
    coreCommandContext: { evaluate: async () => coreContext },
    coreTransactionalAuthority: { recheckAfterLock: async input => receipt(input) },
    documentsImmutableSelector: provider(f),
  });
  return bridge.evaluate(guide, { decision_id: id(11), authority_version: 7, transaction_context: transaction }, 'new_command');
}
await check('new producer connects to existing CE bridge/evaluator: positive safe-label projection', async () => {
  const f = fixture();
  const result = await connect(f);
  assert.equal(result.document_decision.decision, 'current_authorized');
  assert.equal(result.binding.safe_label, 'Document reference');
  const evaluated = ce.evaluateCe012GuideSaveCommand(guide, snapshot(result.document_decision));
  assert.equal(evaluated.decision_status, 'accepted');
  assert.equal(evaluated.mutation_plan.payload.document_target.label, 'Document reference');
  assert.equal(JSON.stringify(result.document_decision).includes('UNTRUSTED'), false);
  assert.ok(f.calls.findIndex(c => c.sql.includes('canonical_authority_revision_v1'))
    < f.calls.findIndex(c => c.sql.includes('from documents.documents d where')));
  for (const part of ['from documents.documents d where', 'from documents.document_versions v\n', 'from documents.document_permissions p\n']) {
    assert.ok(f.calls.some(c => c.sql.includes(part) && c.sql.includes('for share')));
  }
});
await check('same CE connection denies current Documents revoke without CE receipt/plan', async () => {
  const f = fixture({ denied: true });
  const result = await connect(f);
  redacted(result.document_decision, 'denied');
  const evaluated = ce.evaluateCe012GuideSaveCommand(guide, snapshot(result.document_decision));
  assert.equal(evaluated.result_code, 'DOCUMENT_DENIED');
  assert.equal(evaluated.mutation_plan, null);
  assert.equal(evaluated.receipt, null);
});
await check('historical path is separate: exact old version replay, fresh remains stale', async () => {
  const f = fixture({ currentVersion: 3 });
  const historical = await provider(f, 'replay').select({ ...request, evaluation_mode: 'replay' });
  assert.equal(historical.decision, 'historical_authorized');
  assert.equal(historical.safe_label, 'Document reference');
  redacted(await provider(f).select(request), 'stale');
  assert.equal((await selectors.selectDocumentsReferenceInCoreTransactionV1(f.scope, command, authority, target)).denial_reason, 'STALE_REFERENCE');
});
await check('exact source version, Guide, Context, immutable target and mode cannot drift', async () => {
  for (const delta of [{ context_id: id(99) }, { workspace_id: id(99) }, { guide_id: id(99) },
    { target: { ...target, document_id: id(99) } }, { target: { ...target, document_version_id: id(99) } },
    { target: { ...target, document_version: 3 } }, { evaluation_mode: 'replay' }]) {
    const f = fixture(); redacted(await provider(f).select({ ...request, ...delta }), 'denied');
    assert.equal(f.calls.length, 0);
  }
  for (const delta of [{ subject_reference: { ...command.subject_reference, version: 6 } },
    { aggregate_version: 7 }, { input_fingerprint: `sha256:${'b'.repeat(64)}` },
    { permission_code: 'airprop.asset.read' }, { module_code: 'airprop' }]) {
    const f = fixture(); redacted(await provider(f, 'new_command', { ...command, ...delta }).select(request), 'denied');
    assert.equal(f.calls.length, 0);
  }
});
await check('session actor, expired/revoked context, revision and tenant mismatch fail closed', async () => {
  for (const state of [{ actor: id(99) }, { expired: true }, { revoked: true }, { revision: '8' }, { otherTenant: true }, { aal1: true }]) {
    const result = await provider(fixture(state)).select(request);
    // Canonical selector classifies cross-tenant provider exceptions as unavailable.
    redacted(result, state.otherTenant ? 'not_ready' : 'denied');
  }
});
await check('NULL/foreign/missing Workspace, deleted, hidden, pending/quarantine and absent attestation deny in both modes', async () => {
  for (const mode of ['new_command', 'replay']) {
    for (const state of [{ unbound: true }, { deleted: true }, { hidden: true }, { scan: 'quarantined' }, { scan: 'pending' }, { noAttestation: true }]) {
      redacted(await provider(fixture(state), mode).select({ ...request, evaluation_mode: mode }), 'denied');
    }
  }
});
await check('version mismatch/future is stale and provider failure redacts details; 40001 escapes', async () => {
  redacted(await provider(fixture({ version: 3 })).select(request), 'stale');
  redacted(await provider(fixture({ currentVersion: 1 }), 'replay').select({ ...request, evaluation_mode: 'replay' }), 'stale');
  const f = fixture({ error: Error('private internal secret /storage/path') });
  redacted(await provider(f).select(request), 'not_ready');
  const retry = Object.assign(Error('retry'), { code: '40001' });
  await assert.rejects(() => provider(fixture({ error: retry })).select(request), e => e === retry);
});
await check('post-lock receipt, source lock set and transaction scope bindings remain mandatory', async () => {
  const f = fixture();
  const lockMismatch = { ...authority, transaction_context: { ...authority.transaction_context,
    lock: { ...authority.transaction_context.lock, aggregate_id: id(99) } } };
  redacted(await provider(f, 'new_command', command, lockMismatch).select(request), 'denied');
  redacted(await provider(f, 'new_command', { ...command,
    provider_source_ids: [guide.guide_id, target.document_id] }).select(request), 'denied');
  const alteredPayload = structuredClone(guide); alteredPayload.payload.title = 'Changed payload';
  redacted(await provider(f, 'new_command', command, authority, alteredPayload).select(request), 'denied');
  const otherScope = fixture(); otherScope.scope.workspace_id = id(99);
  redacted(await provider(otherScope).select(request), 'denied');
  assert.equal(f.calls.some(c => c.sql.includes('from documents.documents d where')), false);
});
await check('caller actor/label/internal extras rejected and input mutation cannot rebind a created provider', async () => {
  const f = fixture(); const copy = structuredClone(guide); const p = provider(f, 'new_command', command, authority, copy);
  copy.expected_guide_version = 99; copy.payload.document_target.document_id = id(99);
  assert.equal((await p.select(request)).decision, 'current_authorized');
  for (const extra of [{ actor_id: id(99) }, { safe_label: 'caller' }, { object_path: '/internal' }]) {
    await assert.rejects(() => p.select({ ...request, ...extra }));
  }
});
console.log(JSON.stringify({ contract: producer.documentsCe012ReferenceProviderVersionV1,
  groups, ce_connections: { positive: 'PASS_CONTROLLED', denial: 'PASS_CONTROLLED' },
  database_auth_acl_runtime: 'NOT_RUN_NOT_PASS', zero_write: 'SELECT_ONLY_CONTROLLED_SCOPE' }));
