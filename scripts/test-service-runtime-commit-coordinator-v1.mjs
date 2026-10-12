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
    name => name.startsWith('.') ? load(new URL(`${name}.ts`, file))
      : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url)) : require(name), mod, mod.exports,
  );
  cache.set(file.href, mod.exports);
  return mod.exports;
}

const coordinatorModule = load(new URL('../src/lib/customer/service-runtime-commit-coordinator-v1.ts', import.meta.url));
const id = n => `d1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const workspaceId = id(1);
const actorId = id(2);
const authorityVersion = 7;
const authority = { actor_reference_id: actorId, authority_version: authorityVersion, outcome: 'allowed' };
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
  idempotency_key: 'runtime-subject-0001',
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
  evidence_references: [{ reference_id: id(14), source_version: 15 }], idempotency_key: 'runtime-delivery-0001',
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
  work_order_id: id(20), expected_work_order_version: 21, idempotency_key: 'runtime-work-order-0001',
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
  idempotency_key: 'runtime-portfolio-0001',
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
  delivery: { port: 'delivery_evidence', owner: 'documents_vault',
    source_contract: 'documents-delivery-evidence.v1', contract: 'service-delivery-evidence-receipt.v1',
    acceptance: 'contract_only', receipt: deliveryReceipt },
  workOrder: { port: 'stage_work_order', owner: 'operations_ops01',
    source_contract: 'operations-execution-request-receipt.v1',
    contract: 'service-order-stage-work-order-adapter.v1', acceptance: 'contract_only', receipt: workOrderReceipt },
  portfolio: { port: 'portfolio_action', owner: 'portfolio_pf01',
    source_contract: 'owner-portfolio-projection.v1',
    contract: 'portfolio-service-action-projection-receipt.v1', acceptance: 'contract_only', receipt: portfolioReceipt },
};
const ports = {
  subject: async () => results.subject,
  deliveryEvidence: async () => results.delivery,
  stageWorkOrder: async () => results.workOrder,
  portfolioAction: async () => results.portfolio,
};
const coordinator = coordinatorModule.createServiceRuntimeCommitCoordinatorV1(ports);
const command = (operation, intent, transaction = 40) => ({
  contract: 'service-runtime-commit-coordinator.v1', transaction_id: id(transaction), operation,
  actor_reference_id: actorId, expected_authority_version: authorityVersion, intent,
});
const snapshot = (overrides = {}) => ({
  workspace_id: workspaceId, acquired_locks: lockOrder, current_authority: authority, replay: null, ...overrides,
});
const cases = [
  ['subject_link', subjectIntent, results.subject],
  ['delivery_evidence', deliveryIntent, results.delivery],
  ['stage_work_order', workOrderIntent, results.workOrder],
  ['portfolio_action', portfolioIntent, results.portfolio],
];

for (const [operation, intent] of cases) {
  await check(`${operation}: adapter port produces non-executable atomic plan`, async () => {
    const decision = await coordinator(command(operation, intent), snapshot());
    assert.equal(decision.status, 'planned');
    assert.equal(decision.code, 'CONTRACT_PLAN_READY');
    assert.equal(decision.executable, false);
    assert.deepEqual(decision.plan.lock_order, lockOrder);
    assert.deepEqual(decision.plan.audit, { count: 1, contract: 'audit.events', redaction: 'metadata_only' });
    assert.deepEqual(decision.plan.outbox, { count: 1, contract: 'platform.outbox_events', event_version: 1 });
    assert.equal(decision.plan.idempotency.count, 1);
    assert.equal(decision.plan.atomic, true);
    assert.equal(decision.provider_receipt_id, 'f0000000-0000-4000-8000-000000000001');
  });
  await check(`${operation}: full command fingerprint is stable`, async () => {
    const first = await coordinator(command(operation, intent), snapshot());
    const second = await coordinator(command(operation, intent), snapshot());
    assert.equal(first.command_fingerprint, second.command_fingerprint);
  });
  await check(`${operation}: cross-Workspace denied with no plan`, async () => bounded(
    await coordinator(command(operation, intent), snapshot({ workspace_id: id(90) })), 'denied', 'WORKSPACE_MISMATCH',
  ));
  await check(`${operation}: revoked authority denied with no provider output`, async () => bounded(
    await coordinator(command(operation, intent), snapshot({ current_authority: { ...authority, outcome: 'denied' } })),
    'denied', 'AUTHORITY_REVOKED',
  ));
  await check(`${operation}: stale authority denied`, async () => bounded(
    await coordinator(command(operation, intent), snapshot({ current_authority: { ...authority, authority_version: 8 } })),
    'denied', 'AUTHORITY_STALE',
  ));
}

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index))
    .map(rest => [value, ...rest]));
}
for (const order of permutations(lockOrder)) {
  const exact = order.every((value, index) => value === lockOrder[index]);
  await check(`lock order ${order.join('>')}`, async () => {
    const decision = await coordinator(command('subject_link', subjectIntent), snapshot({ acquired_locks: order }));
    if (exact) assert.equal(decision.status, 'planned');
    else bounded(decision, 'denied', 'LOCK_ORDER_VIOLATION');
  });
}
for (const locks of [[], lockOrder.slice(0, 1), lockOrder.slice(0, 2), lockOrder.slice(0, 3)]) {
  await check(`partial lock prefix denied ${locks.length}`, async () => bounded(
    await coordinator(command('subject_link', subjectIntent), snapshot({ acquired_locks: locks })),
    'denied', 'LOCK_ORDER_VIOLATION',
  ));
}

await check('provider port mismatch is bounded', async () => {
  const bad = coordinatorModule.createServiceRuntimeCommitCoordinatorV1({ ...ports, subject: async () => results.portfolio });
  bounded(await bad(command('subject_link', subjectIntent), snapshot()), 'denied', 'PROVIDER_PORT_MISMATCH');
});
await check('provider port unavailable is bounded', async () => {
  const bad = coordinatorModule.createServiceRuntimeCommitCoordinatorV1({ ...ports, subject: async () => ({}) });
  bounded(await bad(command('subject_link', subjectIntent), snapshot()), 'denied', 'PROVIDER_PORT_UNAVAILABLE');
});
await check('provider exception becomes unknown without details', async () => {
  const bad = coordinatorModule.createServiceRuntimeCommitCoordinatorV1({ ...ports, subject: async () => { throw new Error('private'); } });
  bounded(await bad(command('subject_link', subjectIntent), snapshot()), 'unknown', 'PROVIDER_RESULT_UNKNOWN');
});

await check('stale subject source is denied', async () => {
  const stale = { ...results.subject, receipt: { ...subjectReceipt,
    source_identity: { ...subjectReceipt.source_identity, version: subjectReceipt.source_identity.version + 1 } } };
  const candidate = coordinatorModule.createServiceRuntimeCommitCoordinatorV1({ ...ports, subject: async () => stale });
  bounded(await candidate(command('subject_link', subjectIntent), snapshot()), 'denied', 'STALE_PROVIDER_SOURCE');
});
await check('stale evidence source is denied', async () => {
  const references = structuredClone(deliveryReceipt.evidence_references);
  references[0].source_version += 1;
  const stale = { ...results.delivery, receipt: { ...deliveryReceipt, evidence_references: references } };
  const candidate = coordinatorModule.createServiceRuntimeCommitCoordinatorV1({ ...ports, deliveryEvidence: async () => stale });
  bounded(await candidate(command('delivery_evidence', deliveryIntent), snapshot()), 'denied', 'STALE_PROVIDER_SOURCE');
});
await check('stale Work Order source is denied', async () => {
  const stale = { ...results.workOrder, receipt: { ...workOrderReceipt,
    work_order_version: workOrderReceipt.work_order_version + 1 } };
  const candidate = coordinatorModule.createServiceRuntimeCommitCoordinatorV1({ ...ports, stageWorkOrder: async () => stale });
  bounded(await candidate(command('stage_work_order', workOrderIntent), snapshot()), 'denied', 'STALE_PROVIDER_SOURCE');
});
await check('stale portfolio Order source is denied', async () => {
  const references = structuredClone(portfolioReceipt.order_references);
  references[0].order_version += 1;
  const stale = { ...results.portfolio, receipt: { ...portfolioReceipt, order_references: references } };
  const candidate = coordinatorModule.createServiceRuntimeCommitCoordinatorV1({ ...ports, portfolioAction: async () => stale });
  bounded(await candidate(command('portfolio_action', portfolioIntent), snapshot()), 'denied', 'STALE_PROVIDER_SOURCE');
});

let providerCalls = 0;
const counted = coordinatorModule.createServiceRuntimeCommitCoordinatorV1({ ...ports,
  subject: async () => { providerCalls += 1; return results.subject; } });
const first = await counted(command('subject_link', subjectIntent), snapshot());
await check('concurrency winner plans exactly once', async () => {
  assert.equal(first.status, 'planned');
  assert.equal(providerCalls, 1);
});
const committedReplay = {
  state: 'committed', operation: 'subject_link', workspace_id: workspaceId, actor_reference_id: actorId,
  idempotency_key: subjectIntent.idempotency_key, input_fingerprint: first.command_fingerprint,
  commit_receipt_id: id(70),
};
await check('concurrency loser returns exact replay without provider call', async () => {
  const replayed = await counted(command('subject_link', subjectIntent), snapshot({ replay: committedReplay }));
  assert.deepEqual(replayed, { status: 'replayed', code: 'REPLAY_VERIFIED', prior_commit_receipt_id: id(70),
    executable: false });
  assert.equal(providerCalls, 1);
});
await check('same key changed payload conflicts before provider call', async () => {
  const changed = { ...subjectIntent, relation: 'attachment' };
  bounded(await counted(command('subject_link', changed), snapshot({ replay: committedReplay })), 'conflict', 'REPLAY_CONFLICT');
  assert.equal(providerCalls, 1);
});
for (const replayState of ['pending', 'unknown_commit']) {
  await check(`${replayState} record blocks speculative retry`, async () => {
    const replay = { ...committedReplay, state: replayState, commit_receipt_id: null };
    bounded(await counted(command('subject_link', subjectIntent), snapshot({ replay })), 'unknown', 'COMMIT_OUTCOME_UNKNOWN');
    assert.equal(providerCalls, 1);
  });
}

const idle = { phase: 'idle', effects_observation: 'none', retryable: false };
const advance = (current, event) => {
  const result = coordinatorModule.transitionServiceRuntimeCommitV1(current, event);
  assert.equal(result.status, 'advanced');
  return result.state;
};
let machine = idle;
machine = advance(machine, { event: 'acquire_locks', lock_order: lockOrder });
await check('state machine locks first', async () => assert.equal(machine.phase, 'locks_acquired'));
machine = advance(machine, { event: 'authority_allowed' });
await check('state machine rechecks authority after locks', async () => assert.equal(machine.phase, 'authority_rechecked'));
machine = advance(machine, { event: 'providers_verified' });
await check('state machine verifies providers after authority', async () => assert.equal(machine.phase, 'providers_verified'));
machine = advance(machine, { event: 'stage_effects' });
await check('staging effects performs no write', async () => assert.deepEqual(machine,
  { phase: 'effects_staged', effects_observation: 'staged_not_written', retryable: false }));
machine = advance(machine, { event: 'commit_acknowledged' });
await check('commit acknowledgement exposes one atomic effect set', async () => assert.deepEqual(machine,
  { phase: 'committed', effects_observation: 'committed_once', retryable: false }));
await check('committed state cannot commit twice', async () => {
  const denied = coordinatorModule.transitionServiceRuntimeCommitV1(machine, { event: 'commit_acknowledged' });
  assert.deepEqual(denied, { status: 'denied', code: 'INVALID_STATE_TRANSITION', state: machine });
});

for (const phase of ['idle', 'locks_acquired', 'authority_rechecked', 'providers_verified', 'effects_staged']) {
  await check(`denial at ${phase} rolls back with zero observed writes`, async () => {
    const effects = phase === 'effects_staged' ? 'staged_not_written' : 'none';
    const result = coordinatorModule.transitionServiceRuntimeCommitV1(
      { phase, effects_observation: effects, retryable: false }, { event: 'deny' },
    );
    assert.deepEqual(result, { status: 'advanced', state: { phase: 'rolled_back', effects_observation: 'none',
      retryable: false } });
  });
}
await check('wrong state-machine lock order is rejected without advance', async () => {
  const wrong = [...lockOrder].reverse();
  const result = coordinatorModule.transitionServiceRuntimeCommitV1(idle, { event: 'acquire_locks', lock_order: wrong });
  assert.deepEqual(result, { status: 'denied', code: 'INVALID_STATE_TRANSITION', state: idle });
});

let unknown = idle;
for (const event of [
  { event: 'acquire_locks', lock_order: lockOrder },
  { event: 'authority_allowed' },
  { event: 'providers_verified' },
  { event: 'stage_effects' },
  { event: 'connection_lost_after_commit_attempt' },
]) unknown = advance(unknown, event);
await check('lost acknowledgement becomes unknown commit', async () => assert.deepEqual(unknown,
  { phase: 'unknown_commit', effects_observation: 'unknown', retryable: false }));
await check('unknown commit cannot be acknowledged speculatively', async () => {
  const result = coordinatorModule.transitionServiceRuntimeCommitV1(unknown, { event: 'commit_acknowledged' });
  assert.equal(result.status, 'denied');
  assert.deepEqual(result.state, unknown);
});
await check('unknown commit recovery can prove committed once', async () => {
  const result = advance(unknown, { event: 'recovery_committed' });
  assert.deepEqual(result, { phase: 'committed', effects_observation: 'committed_once', retryable: false });
});
await check('unknown commit recovery can prove zero-write rollback before retry', async () => {
  const result = advance(unknown, { event: 'recovery_absent' });
  assert.deepEqual(result, { phase: 'rolled_back', effects_observation: 'none', retryable: true });
});

await check('invalid delivery action cannot request evidence port', async () => {
  const other = { ...deliveryIntent, action: 'accept_delivery' };
  delete other.evidence_references;
  bounded(await coordinator(command('delivery_evidence', other), snapshot()), 'denied', 'PROVIDER_NOT_REQUIRED_FOR_ACTION');
});
await check('unknown client field is rejected', async () => bounded(
  await coordinator({ ...command('subject_link', subjectIntent), audit_id: id(99) }, snapshot()),
  'denied', 'INVALID_COMMIT_INPUT',
));

const source = readFileSync(new URL('../src/lib/customer/service-runtime-commit-coordinator-v1.ts', import.meta.url), 'utf8');
await check('coordinator has no runtime I/O', async () => assert.doesNotMatch(source,
  /(?:fetch\s*\(|supabase|\.from\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\()/i));
await check('coordinator remains explicitly non-executable', async () => assert.match(source, /executable: false/));
await check('coordinator declares canonical shared effects', async () => {
  assert.match(source, /audit\.events/);
  assert.match(source, /platform\.outbox_events/);
  assert.match(source, /platform\.idempotency_keys/);
});

console.log(`SERVICE runtime commit coordinator: ${pass}/${pass} PASS`);
