import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(
    name => name.startsWith('.') ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, file))
      : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url)) : require(name),
    mod,
    mod.exports,
  );
  cache.set(file.href, mod.exports);
  return mod.exports;
}

const persistence = load(new URL('../src/lib/customer/service-runtime-persistence-v1.ts', import.meta.url));
const coordinator = load(new URL('../src/lib/customer/service-runtime-commit-coordinator-v1.ts', import.meta.url));
const receipts = load(new URL('../src/lib/customer/service-provider-receipt-v1-schema.ts', import.meta.url));
const id = n => `f2000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const workspaceId = id(1);
const actorId = id(2);
const aggregateId = id(3);
const providerReceiptId = id(4);
const transactionScopeId = id(5);
const authorityDecisionId = id(6);
let pass = 0;
const check = (name, fn) => { fn(); pass += 1; return name; };
const denied = (value, code) => assert.deepEqual(value, { status: 'denied', code });

const command = {
  contract: 'service-runtime-commit-coordinator.v1',
  transaction_id: transactionScopeId,
  operation: 'subject_link',
  actor_reference_id: actorId,
  expected_authority_version: 9,
  intent: {
    context_id: id(8),
    workspace_id: workspaceId,
    service_request_id: aggregateId,
    expected_request_version: 10,
    reference_kind: 'document',
    reference_id: id(11),
    source_version: 12,
    relation: 'evidence',
    idempotency_key: 'service-persistence-0001',
  },
};
const fingerprint = receipts.fingerprintServiceProviderInput(command);
const plan = {
  status: 'planned',
  code: 'CONTRACT_PLAN_READY',
  executable: false,
  command_fingerprint: fingerprint,
  provider_receipt_id: providerReceiptId,
  plan: {
    lock_order: [...coordinator.SERVICE_RUNTIME_COMMIT_LOCK_ORDER],
    domain_mutation: { operation: command.operation, aggregate_id: aggregateId },
    audit: { count: 1, contract: 'audit.events', redaction: 'metadata_only' },
    outbox: { count: 1, contract: 'platform.outbox_events', event_version: 1 },
    idempotency: { count: 1, contract: 'platform.idempotency_keys', input_fingerprint: fingerprint },
    atomic: true,
  },
};
const context = {
  transaction_scope_id: transactionScopeId,
  authority_decision_id: authorityDecisionId,
  authority_evaluated_at: '2026-10-12T09:30:00.000Z',
  authority_rechecked_after_lock: true,
  isolation_level: 'serializable',
};
const prepared = persistence.prepareServiceRuntimePersistenceV1(command, plan, context);
assert.equal(prepared.status, 'prepared');
const intent = prepared.intent;

check('prepared contract stays non-executable', () => {
  assert.equal(prepared.code, 'PERSISTENCE_CONTRACT_READY');
  assert.equal(prepared.executable, false);
  assert.equal(intent.executable, false);
  assert.equal(intent.acceptance, 'contract_only');
});
check('transaction context is serializable and authority-bound', () => {
  assert.equal(intent.transaction_scope_id, transactionScopeId);
  assert.equal(intent.isolation_level, 'serializable');
  assert.equal(intent.authority_decision_id, authorityDecisionId);
  assert.equal(intent.authority_version, command.expected_authority_version);
  assert.equal(intent.authority_rechecked_after_lock, true);
});
check('effect set is exact and atomic', () => {
  assert.deepEqual(intent.effect_set.lock_order, [...coordinator.SERVICE_RUNTIME_COMMIT_LOCK_ORDER]);
  assert.equal(intent.effect_set.atomic, true);
  for (const effect of ['domain_mutation', 'audit', 'outbox', 'idempotency']) {
    assert.equal(intent.effect_set[effect].count, 1);
  }
});
check('domain mutation and provider receipt are exact', () => {
  assert.equal(intent.operation, command.operation);
  assert.equal(intent.aggregate_type, 'service_request');
  assert.equal(intent.aggregate_id, aggregateId);
  assert.equal(intent.provider_receipt_id, providerReceiptId);
});
check('idempotency binds the full command fingerprint', () => {
  assert.equal(intent.idempotency_key, command.intent.idempotency_key);
  assert.equal(intent.input_fingerprint, fingerprint);
  assert.equal(intent.effect_set.idempotency.input_fingerprint, fingerprint);
});
check('intent schema is strict', () => assert.equal(
  persistence.serviceRuntimePersistenceIntentV1Schema.safeParse({ ...intent, client_money: '10.00' }).success, false,
));
check('invalid command is denied', () => denied(
  persistence.prepareServiceRuntimePersistenceV1({ ...command, client_authority: true }, plan, context),
  'INVALID_PERSISTENCE_INPUT',
));
for (const [name, changed] of [
  ['fingerprint', { ...plan, command_fingerprint: 'svc1:0000000000000000' }],
  ['idempotency fingerprint', { ...plan, plan: { ...plan.plan, idempotency: {
    ...plan.plan.idempotency, input_fingerprint: 'svc1:0000000000000000' } } }],
  ['operation', { ...plan, plan: { ...plan.plan, domain_mutation: {
    ...plan.plan.domain_mutation, operation: 'portfolio_action' } } }],
  ['aggregate', { ...plan, plan: { ...plan.plan, domain_mutation: {
    ...plan.plan.domain_mutation, aggregate_id: id(90) } } }],
]) {
  check(`${name} plan tamper is denied`, () => denied(
    persistence.prepareServiceRuntimePersistenceV1(command, changed, context), 'PERSISTENCE_PLAN_MISMATCH',
  ));
}
check('lock-order tamper is rejected as invalid input', () => denied(
  persistence.prepareServiceRuntimePersistenceV1(command,
    { ...plan, plan: { ...plan.plan, lock_order: [...plan.plan.lock_order].reverse() } }, context),
  'INVALID_PERSISTENCE_INPUT',
));
check('non-serializable context is denied', () => denied(
  persistence.prepareServiceRuntimePersistenceV1(command, plan, { ...context, isolation_level: 'read_committed' }),
  'INVALID_PERSISTENCE_INPUT',
));
check('pre-lock authority observation is denied', () => denied(
  persistence.prepareServiceRuntimePersistenceV1(command, plan, { ...context, authority_rechecked_after_lock: false }),
  'INVALID_PERSISTENCE_INPUT',
));
check('transaction scope tamper is denied', () => denied(
  persistence.prepareServiceRuntimePersistenceV1(command, plan, { ...context, transaction_scope_id: id(98) }),
  'PERSISTENCE_PLAN_MISMATCH',
));

const receipt = {
  contract: 'service-runtime-persistence-receipt.v1',
  version: 1,
  receipt_id: id(20),
  transaction_scope_id: transactionScopeId,
  workspace_id: workspaceId,
  actor_reference_id: actorId,
  authority_decision_id: authorityDecisionId,
  authority_version: 9,
  operation: command.operation,
  aggregate_id: aggregateId,
  idempotency_key: command.intent.idempotency_key,
  input_fingerprint: fingerprint,
  provider_receipt_id: providerReceiptId,
  state: 'committed',
  effects: {
    domain_mutation_id: id(21), audit_event_id: id(22), outbox_event_id: id(23), idempotency_record_id: id(24),
    domain_mutation_count: 1, audit_event_count: 1, outbox_event_count: 1, idempotency_record_count: 1,
  },
  committed_at: '2026-10-12T09:30:01.000Z',
};

check('atomic commit receipt verifies', () => {
  const value = persistence.evaluateServiceRuntimePersistenceResultV1(intent,
    { outcome: 'committed', replayed: false, receipt });
  assert.equal(value.status, 'verified');
  assert.equal(value.code, 'ATOMIC_COMMIT_VERIFIED');
  assert.equal(value.executable, false);
});
check('exact replay returns the same immutable receipt', () => {
  const value = persistence.evaluateServiceRuntimePersistenceResultV1(intent,
    { outcome: 'exact_replay', replayed: true, receipt });
  assert.equal(value.status, 'verified');
  assert.equal(value.code, 'EXACT_REPLAY_VERIFIED');
  assert.deepEqual(value.receipt, receipt);
});
const replayIdentity = {
  transaction_scope_id: transactionScopeId, workspace_id: workspaceId, actor_reference_id: actorId,
  idempotency_key: command.intent.idempotency_key, input_fingerprint: fingerprint,
};
check('idempotency claim is transaction-scoped and strict', () => {
  const value = { outcome: 'claimed', ...replayIdentity, idempotency_record_id: id(25), state: 'pending' };
  assert.equal(persistence.serviceRuntimeIdempotencyClaimV1Schema.safeParse(value).success, true);
  assert.equal(persistence.serviceRuntimeIdempotencyClaimV1Schema.safeParse({ ...value, state: 'committed' }).success,
    false);
});
check('exact idempotency readback carries the immutable commit receipt', () => {
  const value = { outcome: 'exact_readback', ...replayIdentity, idempotency_record_id: id(24), receipt };
  assert.equal(persistence.serviceRuntimeIdempotencyClaimV1Schema.safeParse(value).success, true);
});
check('idempotency claim rejects unbounded client fields', () => {
  const value = { outcome: 'claimed', ...replayIdentity, idempotency_record_id: id(25), state: 'pending',
    database_error: 'private' };
  assert.equal(persistence.serviceRuntimeIdempotencyClaimV1Schema.safeParse(value).success, false);
});
check('changed replay is a bounded conflict', () => assert.deepEqual(
  persistence.evaluateServiceRuntimePersistenceResultV1(intent,
    { outcome: 'changed_replay', ...replayIdentity, stored_input_fingerprint: 'svc1:1111111111111111' }),
  { status: 'conflict', code: 'REPLAY_CONFLICT' },
));
check('false changed replay is rejected', () => denied(
  persistence.evaluateServiceRuntimePersistenceResultV1(intent,
    { outcome: 'changed_replay', ...replayIdentity, stored_input_fingerprint: fingerprint }),
  'PERSISTENCE_BINDING_MISMATCH',
));
check('unknown commit is bounded and contains no effect detail', () => assert.deepEqual(
  persistence.evaluateServiceRuntimePersistenceResultV1(intent,
    { outcome: 'unknown_commit', ...replayIdentity, recovery_required: true }),
  { status: 'unknown', code: 'COMMIT_OUTCOME_UNKNOWN' },
));

for (const [name, changed] of [
  ['transaction scope', { transaction_scope_id: id(91) }],
  ['Workspace', { workspace_id: id(92) }],
  ['actor', { actor_reference_id: id(93) }],
  ['authority decision', { authority_decision_id: id(94) }],
  ['authority version', { authority_version: 10 }],
  ['operation', { operation: 'portfolio_action' }],
  ['aggregate', { aggregate_id: id(95) }],
  ['idempotency key', { idempotency_key: 'service-persistence-other' }],
  ['fingerprint', { input_fingerprint: 'svc1:2222222222222222' }],
  ['provider receipt', { provider_receipt_id: id(96) }],
]) {
  check(`${name} receipt tamper is denied`, () => denied(
    persistence.evaluateServiceRuntimePersistenceResultV1(intent,
      { outcome: 'committed', replayed: false, receipt: { ...receipt, ...changed } }),
    'PERSISTENCE_BINDING_MISMATCH',
  ));
}
check('malformed persistence output is unavailable', () => denied(
  persistence.evaluateServiceRuntimePersistenceResultV1(intent, { private_error: 'database detail' }),
  'PERSISTENCE_RESULT_UNAVAILABLE',
));

const recoveryRequest = {
  contract: 'service-runtime-unknown-commit-recovery.v1', version: 1,
  transaction_scope_id: transactionScopeId, workspace_id: workspaceId, actor_reference_id: actorId,
  idempotency_key: command.intent.idempotency_key, input_fingerprint: fingerprint, recovery_attempt: 1,
};
check('unknown commit recovery proves committed receipt', () => {
  const value = persistence.evaluateServiceRuntimeUnknownCommitRecoveryV1(recoveryRequest,
    { outcome: 'committed', receipt });
  assert.equal(value.status, 'recovered');
  assert.equal(value.code, 'COMMIT_RECOVERED');
  assert.equal(value.executable, false);
});
check('absent recovery requires fresh authority and providers', () => assert.deepEqual(
  persistence.evaluateServiceRuntimeUnknownCommitRecoveryV1(recoveryRequest,
    { outcome: 'absent', ...replayIdentity, retry_requires_fresh_authority_and_providers: true }),
  { status: 'absent', code: 'RECOVERY_ABSENT_RECHECK_REQUIRED', executable: false,
    retryable: true, requires_fresh_authority_and_providers: true },
));
check('pending recovery blocks retry', () => assert.deepEqual(
  persistence.evaluateServiceRuntimeUnknownCommitRecoveryV1(recoveryRequest,
    { outcome: 'pending', ...replayIdentity, retry_allowed: false }),
  { status: 'unknown', code: 'COMMIT_OUTCOME_UNKNOWN', retryable: false },
));
check('changed recovery is a bounded conflict', () => assert.deepEqual(
  persistence.evaluateServiceRuntimeUnknownCommitRecoveryV1(recoveryRequest,
    { outcome: 'changed_replay', ...replayIdentity, stored_input_fingerprint: 'svc1:3333333333333333' }),
  { status: 'conflict', code: 'REPLAY_CONFLICT' },
));
check('recovery identity tamper is denied', () => denied(
  persistence.evaluateServiceRuntimeUnknownCommitRecoveryV1(recoveryRequest,
    { outcome: 'pending', ...replayIdentity, workspace_id: id(97), retry_allowed: false }),
  'RECOVERY_BINDING_MISMATCH',
));
check('unsafe recovery attempt is unavailable', () => denied(
  persistence.evaluateServiceRuntimeUnknownCommitRecoveryV1({ ...recoveryRequest,
    recovery_attempt: Number.MAX_SAFE_INTEGER + 1 }, { outcome: 'committed', receipt }),
  'RECOVERY_RESULT_UNAVAILABLE',
));

const source = readFileSync(new URL('../src/lib/customer/service-runtime-persistence-v1.ts', import.meta.url), 'utf8');
check('persistence contract has no direct I/O', () => assert.doesNotMatch(source,
  /(?:fetch\s*\(|createClient\s*\(|supabase|\.from\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\()/i));
check('persistence port remains injected and Promise-based', () => {
  assert.match(source, /interface ServiceRuntimeAtomicPersistencePortV1/);
  assert.match(source, /executeAtomic[\s\S]*Promise<unknown>/);
  assert.match(source, /recoverUnknownCommit[\s\S]*Promise<unknown>/);
});
check('contract has no runtime activation', () => {
  assert.match(source, /executable: z\.literal\(false\)/);
  assert.doesNotMatch(source, /executable:\s*true/);
  assert.doesNotMatch(source, /app\/api|route\.ts/);
});

console.log(`SERVICE runtime persistence contract: ${pass}/${pass} PASS`);
