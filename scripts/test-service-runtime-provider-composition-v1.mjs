import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { receiptEnvelope } from './service-receipt-test-fixtures.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(
    name => name.startsWith('.')
      ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, file))
      : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url)) : require(name),
    mod,
    mod.exports,
  );
  cache.set(file.href, mod.exports);
  return mod.exports;
}

const compositionModule = load(new URL('../src/lib/customer/service-runtime-provider-composition-v1.ts', import.meta.url));
const coordinatorModule = load(new URL('../src/lib/customer/service-runtime-commit-coordinator-v1.ts', import.meta.url));
const id = n => `e1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const workspaceId = id(1);
const actorId = id(2);
const authorityVersion = 7;
const lockOrder = [...coordinatorModule.SERVICE_RUNTIME_COMMIT_LOCK_ORDER];
let pass = 0;
const check = async (name, fn) => { await fn(); pass += 1; return name; };
const bounded = (value, status, code) => {
  assert.deepEqual(value, { status, code });
  assert.deepEqual(Object.keys(value).sort(), ['code', 'status']);
};

const subjectIntent = {
  context_id: id(3), workspace_id: workspaceId, service_request_id: id(4), expected_request_version: 5,
  reference_kind: 'document', reference_id: id(6), source_version: 8, relation: 'evidence',
  idempotency_key: 'composition-subject-0001',
};
const subjectReceipt = receiptEnvelope({
  contract: 'service-subject-link-adapter.v1', intent: subjectIntent, workspaceId,
  sourceKind: 'document', sourceId: subjectIntent.reference_id, sourceVersion: subjectIntent.source_version,
  actorId, authorityVersion, request_id: subjectIntent.service_request_id,
  request_version: subjectIntent.expected_request_version, reference_kind: subjectIntent.reference_kind,
  reference_id: subjectIntent.reference_id, reference_version: subjectIntent.source_version,
  relation: subjectIntent.relation, reference_state: 'available', current_actor_can_read: true,
  request_party_audience_only: true,
});

const deliveryIntent = {
  context_id: id(3), workspace_id: workspaceId, service_order_id: id(10), expected_order_version: 11,
  service_stage_id: id(12), expected_stage_version: 13, quantity: '1', action: 'record_delivery',
  evidence_references: [{ reference_id: id(14), source_version: 15 }],
  idempotency_key: 'composition-delivery-0001',
};
const deliveryReceipt = receiptEnvelope({
  contract: 'service-delivery-evidence-receipt.v1', intent: deliveryIntent, workspaceId,
  sourceKind: 'service_stage', sourceId: deliveryIntent.service_stage_id,
  sourceVersion: deliveryIntent.expected_stage_version, actorId, authorityVersion,
  order_id: deliveryIntent.service_order_id, order_version: deliveryIntent.expected_order_version,
  stage_id: deliveryIntent.service_stage_id, stage_version: deliveryIntent.expected_stage_version,
  evidence_references: deliveryIntent.evidence_references.map(value => ({ ...value, workspace_id: workspaceId,
    state: 'available', current_actor_can_read: true })),
});

const workOrderIntent = {
  context_id: id(3), workspace_id: workspaceId, service_order_id: id(10), expected_order_version: 11,
  service_stage_id: id(12), expected_stage_version: 13, execution_kind: 'technical',
  work_order_id: id(20), expected_work_order_version: 21, idempotency_key: 'composition-work-order-0001',
};
const workOrderReceipt = receiptEnvelope({
  contract: 'service-order-stage-work-order-adapter.v1', intent: workOrderIntent, workspaceId,
  sourceKind: 'service_stage', sourceId: workOrderIntent.service_stage_id,
  sourceVersion: workOrderIntent.expected_stage_version, actorId, authorityVersion,
  order_id: workOrderIntent.service_order_id, order_version: workOrderIntent.expected_order_version,
  stage_id: workOrderIntent.service_stage_id, stage_version: workOrderIntent.expected_stage_version,
  work_order_id: workOrderIntent.work_order_id, work_order_version: workOrderIntent.expected_work_order_version,
  work_order_status: 'in_progress', current_actor_can_read: true,
});

const portfolioIntent = {
  context_id: id(3), workspace_id: workspaceId, portfolio_id: id(30), expected_portfolio_version: 31,
  service_order_id: id(10), expected_order_version: 11, action: 'continue_delivery',
  idempotency_key: 'composition-portfolio-0001',
};
const portfolioReceipt = receiptEnvelope({
  contract: 'portfolio-service-action-projection-receipt.v1', intent: portfolioIntent, workspaceId,
  sourceKind: 'service_portfolio', sourceId: portfolioIntent.portfolio_id,
  sourceVersion: portfolioIntent.expected_portfolio_version, actorId, authorityVersion,
  portfolio_id: portfolioIntent.portfolio_id, current_actor_can_read: true,
  order_references: [{ service_order_id: portfolioIntent.service_order_id,
    order_version: portfolioIntent.expected_order_version, resource_id: id(32),
    available_actions: ['view_order', 'continue_delivery'] }],
});

const results = {
  subject: { port: 'subject', owner: 'communications_documents', contract: 'service-subject-link-adapter.v1',
    source_contract: 'documents-reference-authority.v1', acceptance: 'contract_only', receipt: subjectReceipt },
  deliveryEvidence: { port: 'delivery_evidence', owner: 'documents_vault',
    source_contract: 'documents-delivery-evidence.v1', contract: 'service-delivery-evidence-receipt.v1',
    acceptance: 'contract_only', receipt: deliveryReceipt },
  stageWorkOrder: { port: 'stage_work_order', owner: 'operations_ops01',
    source_contract: 'operations-execution-request-receipt.v1',
    contract: 'service-order-stage-work-order-adapter.v1', acceptance: 'contract_only', receipt: workOrderReceipt },
  portfolioAction: { port: 'portfolio_action', owner: 'portfolio_pf01',
    source_contract: 'owner-portfolio-projection.v1', contract: 'portfolio-service-action-projection-receipt.v1',
    acceptance: 'contract_only', receipt: portfolioReceipt },
};

const command = (operation, intent, transaction = 40) => ({
  contract: 'service-runtime-commit-coordinator.v1', transaction_id: id(transaction), operation,
  actor_reference_id: actorId, expected_authority_version: authorityVersion, intent,
});
const snapshot = (overrides = {}) => ({
  workspace_id: workspaceId,
  acquired_locks: lockOrder,
  replay: null,
  authority_context: {
    decision_id: id(41), command_id: id(42), attempt: 1, isolation_level: 'serializable',
    lock_acquired_at: '2026-10-12T09:00:00.000Z',
  },
  ...overrides,
});

function authorityReceipt(request, overrides = {}) {
  return {
    contract_version: 'core-current-authority-decision-receipt.v1', receipt_version: 1,
    decision_id: request.decision_id, context_id: request.context_id, workspace_id: request.workspace_id,
    actor_id: request.actor_id, authority_version: request.authority_version,
    permission_code: request.permission_code, module_code: request.module_code,
    evaluation_purpose: request.evaluation_purpose,
    transaction_context: structuredClone(request.transaction_context),
    evaluator: 'app_private.check_workspace_native_permission_v2', source_disclosure: 'status_only',
    source_reference: null, evaluated_at: '2026-10-12T09:00:00.001Z', rechecked_after_lock: true,
    transaction_bound: true, reusable_as_command_authority: false,
    current_authority_recheck_required_on_retry: true, decision: 'allowed', denial_reason: null,
    ...overrides,
  };
}

function makeCandidate({ authority = request => authorityReceipt(request), providerOverrides = {} } = {}) {
  const observed = { authorityCalls: 0, providerCalls: 0, effects: 0, authorityRequests: [] };
  const canonicalProviders = Object.fromEntries(Object.keys(results).map(name => [name, intent => {
    observed.providerCalls += 1;
    return (providerOverrides[name] ?? (() => results[name]))(intent);
  }]));
  const currentAuthority = {
    recheckAfterLock: async request => {
      observed.authorityCalls += 1;
      observed.authorityRequests.push(structuredClone(request));
      return authority(request);
    },
  };
  return {
    compose: compositionModule.createServiceRuntimeProviderCompositionV1({ currentAuthority, canonicalProviders }),
    observed,
  };
}

const cases = [
  ['subject_link', subjectIntent, 'subject', 'service_request', subjectIntent.service_request_id],
  ['delivery_evidence', deliveryIntent, 'deliveryEvidence', 'service_order', deliveryIntent.service_order_id],
  ['stage_work_order', workOrderIntent, 'stageWorkOrder', 'service_order', workOrderIntent.service_order_id],
  ['portfolio_action', portfolioIntent, 'portfolioAction', 'service_order', portfolioIntent.service_order_id],
];

for (const [operation, intent, portName, aggregateType, aggregateId] of cases) {
  await check(`${operation}: Core authority then injected provider produces non-executable plan`, async () => {
    const candidate = makeCandidate();
    const decision = await candidate.compose(command(operation, intent), snapshot());
    assert.equal(decision.status, 'planned');
    assert.equal(decision.code, 'CONTRACT_PLAN_READY');
    assert.equal(decision.executable, false);
    assert.equal(candidate.observed.authorityCalls, 1);
    assert.equal(candidate.observed.providerCalls, 1);
    assert.equal(candidate.observed.effects, 0);
    const request = candidate.observed.authorityRequests[0];
    assert.equal(request.permission_code, 'services.orders.request');
    assert.equal(request.module_code, 'services_orders');
    assert.equal(request.evaluation_purpose, 'service.order.transition');
    assert.equal(request.transaction_context.lock.aggregate_type, aggregateType);
    assert.equal(request.transaction_context.lock.aggregate_id, aggregateId);
    assert.equal(request.workspace_id, intent.workspace_id);
    assert.ok(results[portName]);
  });
}

for (const [reason, expected] of [
  ['ACTOR_REVOKED', 'AUTHORITY_REVOKED'],
  ['STALE_AUTHORITY_VERSION', 'AUTHORITY_STALE'],
  ['AUTHORITY_DENIED', 'AUTHORITY_DENIED'],
]) {
  await check(`${reason}: bounded before provider with zero writes`, async () => {
    const candidate = makeCandidate({ authority: request => authorityReceipt(request,
      { decision: 'denied', denial_reason: reason }) });
    bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot()), 'denied', expected);
    assert.equal(candidate.observed.authorityCalls, 1);
    assert.equal(candidate.observed.providerCalls, 0);
    assert.equal(candidate.observed.effects, 0);
  });
}

await check('authority receipt binding mismatch is zero-write denial', async () => {
  const candidate = makeCandidate({ authority: request => authorityReceipt(request, { actor_id: id(90) }) });
  bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot()),
    'denied', 'AUTHORITY_BINDING_MISMATCH');
  assert.equal(candidate.observed.providerCalls, 0);
  assert.equal(candidate.observed.effects, 0);
});
await check('authority observation before lock is zero-write denial', async () => {
  const candidate = makeCandidate({ authority: request => authorityReceipt(request,
    { evaluated_at: '2026-10-12T08:59:59.999Z' }) });
  bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot()),
    'denied', 'AUTHORITY_BINDING_MISMATCH');
  assert.equal(candidate.observed.providerCalls, 0);
});
await check('malformed authority port result is bounded', async () => {
  const candidate = makeCandidate({ authority: () => ({}) });
  bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot()),
    'denied', 'AUTHORITY_PORT_UNAVAILABLE');
  assert.equal(candidate.observed.providerCalls, 0);
});
await check('authority provider exception is bounded unknown and zero-write', async () => {
  const candidate = makeCandidate({ authority: () => { throw new Error('private provider failure'); } });
  bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot()),
    'unknown', 'AUTHORITY_RESULT_UNKNOWN');
  assert.equal(candidate.observed.providerCalls, 0);
  assert.equal(candidate.observed.effects, 0);
});
await check('cross-Workspace is denied before authority provider', async () => {
  const candidate = makeCandidate();
  bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot({ workspace_id: id(91) })),
    'denied', 'WORKSPACE_MISMATCH');
  assert.equal(candidate.observed.authorityCalls, 0);
});
await check('wrong lock order is denied before authority provider', async () => {
  const candidate = makeCandidate();
  bounded(await candidate.compose(command('subject_link', subjectIntent),
    snapshot({ acquired_locks: [...lockOrder].reverse() })), 'denied', 'LOCK_ORDER_VIOLATION');
  assert.equal(candidate.observed.authorityCalls, 0);
});

const baseline = makeCandidate();
const first = await baseline.compose(command('subject_link', subjectIntent), snapshot());
assert.equal(first.status, 'planned');
const committedReplay = {
  state: 'committed', operation: 'subject_link', workspace_id: workspaceId, actor_reference_id: actorId,
  idempotency_key: subjectIntent.idempotency_key, input_fingerprint: first.command_fingerprint,
  commit_receipt_id: id(70),
};
await check('exact replay rechecks Core authority and skips canonical provider', async () => {
  const candidate = makeCandidate();
  const replayed = await candidate.compose(command('subject_link', subjectIntent), snapshot({ replay: committedReplay }));
  assert.deepEqual(replayed, { status: 'replayed', code: 'REPLAY_VERIFIED',
    prior_commit_receipt_id: id(70), executable: false });
  assert.equal(candidate.observed.authorityCalls, 1);
  assert.equal(candidate.observed.providerCalls, 0);
});
await check('changed replay rechecks authority then conflicts with zero writes', async () => {
  const candidate = makeCandidate();
  const changed = { ...subjectIntent, relation: 'attachment' };
  bounded(await candidate.compose(command('subject_link', changed), snapshot({ replay: committedReplay })),
    'conflict', 'REPLAY_CONFLICT');
  assert.equal(candidate.observed.authorityCalls, 1);
  assert.equal(candidate.observed.providerCalls, 0);
  assert.equal(candidate.observed.effects, 0);
});
for (const state of ['pending', 'unknown_commit']) {
  await check(`${state}: authority rechecked and speculative provider call blocked`, async () => {
    const candidate = makeCandidate();
    const replay = { ...committedReplay, state, commit_receipt_id: null };
    bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot({ replay })),
      'unknown', 'COMMIT_OUTCOME_UNKNOWN');
    assert.equal(candidate.observed.authorityCalls, 1);
    assert.equal(candidate.observed.providerCalls, 0);
  });
}

const staleProviders = {
  subject: () => ({ ...results.subject, receipt: { ...subjectReceipt,
    source_identity: { ...subjectReceipt.source_identity, version: subjectReceipt.source_identity.version + 1 } } }),
  deliveryEvidence: () => ({ ...results.deliveryEvidence, receipt: { ...deliveryReceipt,
    evidence_references: deliveryReceipt.evidence_references.map(value => ({ ...value,
      source_version: value.source_version + 1 })) } }),
  stageWorkOrder: () => ({ ...results.stageWorkOrder, receipt: { ...workOrderReceipt,
    work_order_version: workOrderReceipt.work_order_version + 1 } }),
  portfolioAction: () => ({ ...results.portfolioAction, receipt: { ...portfolioReceipt,
    order_references: portfolioReceipt.order_references.map(value => ({ ...value,
      order_version: value.order_version + 1 })) } }),
};
for (const [operation, intent, portName] of cases) {
  await check(`${operation}: stale provider source is bounded zero-write denial`, async () => {
    const candidate = makeCandidate({ providerOverrides: { [portName]: staleProviders[portName] } });
    bounded(await candidate.compose(command(operation, intent), snapshot()), 'denied', 'STALE_PROVIDER_SOURCE');
    assert.equal(candidate.observed.authorityCalls, 1);
    assert.equal(candidate.observed.providerCalls, 1);
    assert.equal(candidate.observed.effects, 0);
  });
}

await check('provider denial before commit has zero writes and no receipt leakage', async () => {
  const denied = { ...results.subject, receipt: { ...subjectReceipt, current_actor_can_read: false } };
  const candidate = makeCandidate({ providerOverrides: { subject: () => denied } });
  bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot()), 'denied', 'PROVIDER_DENIED');
  assert.equal(candidate.observed.effects, 0);
});
await check('provider exception before commit is bounded unknown with zero writes', async () => {
  const candidate = makeCandidate({ providerOverrides: { subject: () => { throw new Error('private'); } } });
  bounded(await candidate.compose(command('subject_link', subjectIntent), snapshot()),
    'unknown', 'PROVIDER_RESULT_UNKNOWN');
  assert.equal(candidate.observed.effects, 0);
});

const source = readFileSync(new URL('../src/lib/customer/service-runtime-provider-composition-v1.ts', import.meta.url), 'utf8');
await check('composition has no direct runtime I/O', async () => assert.doesNotMatch(source,
  /(?:fetch\s*\(|createClient\s*\(|supabase|\.from\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\()/i));
await check('composition keeps successful coordinator plans non-executable', async () => {
  assert.match(source, /createServiceRuntimeCommitCoordinatorV1/);
  const candidate = makeCandidate();
  const result = await candidate.compose(command('subject_link', subjectIntent), snapshot());
  assert.equal(result.executable, false);
});

console.log(`SERVICE runtime provider composition: ${pass}/${pass} PASS`);
