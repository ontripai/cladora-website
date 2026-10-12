import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';

const connectionString = process.env.SERVICE_PERSISTENCE_TEST_DATABASE_URL;
if (!connectionString) throw new Error('SERVICE_PERSISTENCE_TEST_DATABASE_URL is required');
const parsedUrl = new URL(connectionString);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname)
  || parsedUrl.pathname !== '/service_persistence_test') {
  throw new Error('Disposable PostgreSQL test requires localhost/service_persistence_test');
}

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

const contract = load(new URL('../src/lib/customer/service-runtime-persistence-v1.ts', import.meta.url));
const { Client } = pg;
const schema = 'service_runtime_persistence_test';
let pass = 0;
const check = async (name, fn) => { await fn(); pass += 1; return name; };
const id = n => `f3000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function client() {
  const value = new Client({ connectionString, application_name: 'sv-runtime-persistence-22-local' });
  await value.connect();
  return value;
}

async function setup() {
  const db = await client();
  try {
    await db.query(`drop schema if exists ${schema} cascade`);
    await db.query(`create schema ${schema}`);
    await db.query(`
      create table ${schema}.idempotency_records (
        id uuid primary key,
        transaction_scope_id uuid not null,
        workspace_id uuid not null,
        actor_reference_id uuid not null,
        idempotency_key text not null,
        input_fingerprint text not null,
        state text not null check (state in ('pending','committed','unknown_commit')),
        commit_receipt_id uuid,
        response_snapshot jsonb,
        created_at timestamptz not null default clock_timestamp(),
        unique (workspace_id, idempotency_key),
        check ((state = 'committed') = (commit_receipt_id is not null and response_snapshot is not null))
      );
      create table ${schema}.domain_mutations (
        id uuid primary key, transaction_scope_id uuid not null unique, workspace_id uuid not null,
        operation text not null, aggregate_id uuid not null, provider_receipt_id uuid not null
      );
      create table ${schema}.audit_events (
        id uuid primary key, transaction_scope_id uuid not null unique, workspace_id uuid not null,
        actor_reference_id uuid not null, action text not null, redaction text not null check (redaction='metadata_only')
      );
      create table ${schema}.outbox_events (
        id uuid primary key, transaction_scope_id uuid not null unique, workspace_id uuid not null,
        aggregate_id uuid not null, event_type text not null, event_version integer not null check (event_version=1)
      );
    `);
  } finally {
    await db.end();
  }
}

async function reset() {
  const db = await client();
  try {
    await db.query(`truncate ${schema}.domain_mutations, ${schema}.audit_events,
      ${schema}.outbox_events, ${schema}.idempotency_records`);
  } finally {
    await db.end();
  }
}

async function counts(idempotencyKey) {
  const db = await client();
  try {
    const result = await db.query(`select
      (select count(*)::int from ${schema}.idempotency_records where idempotency_key=$1) idempotency,
      (select count(*)::int from ${schema}.domain_mutations d join ${schema}.idempotency_records i
        on d.transaction_scope_id=i.transaction_scope_id where i.idempotency_key=$1) domain,
      (select count(*)::int from ${schema}.audit_events a join ${schema}.idempotency_records i
        on a.transaction_scope_id=i.transaction_scope_id where i.idempotency_key=$1) audit,
      (select count(*)::int from ${schema}.outbox_events o join ${schema}.idempotency_records i
        on o.transaction_scope_id=i.transaction_scope_id where i.idempotency_key=$1) outbox`, [idempotencyKey]);
    return result.rows[0];
  } finally {
    await db.end();
  }
}

function replayIdentity(input) {
  return {
    transaction_scope_id: input.transaction_scope_id,
    workspace_id: input.workspace_id,
    actor_reference_id: input.actor_reference_id,
    idempotency_key: input.idempotency_key,
    input_fingerprint: input.input_fingerprint,
  };
}

class UnknownCommit extends Error {
  constructor() { super('simulated acknowledgement loss'); this.name = 'UnknownCommit'; }
}

async function executeAtomic(input, options = {}, attempt = 1) {
  if (options.authorityAllowed === false) return { status: 'denied', code: 'AUTHORITY_STALE' };
  if (options.providerAvailable === false) return { status: 'unknown', code: 'PROVIDER_RESULT_UNKNOWN' };
  const db = await client();
  let committed = false;
  let closed = false;
  try {
    await db.query('begin isolation level serializable');
    const idempotencyId = randomUUID();
    const claim = await db.query(`insert into ${schema}.idempotency_records
      (id,transaction_scope_id,workspace_id,actor_reference_id,idempotency_key,input_fingerprint,state)
      values ($1,$2,$3,$4,$5,$6,'pending')
      on conflict (workspace_id,idempotency_key) do nothing returning id`, [
      idempotencyId, input.transaction_scope_id, input.workspace_id, input.actor_reference_id,
      input.idempotency_key, input.input_fingerprint,
    ]);
    if (claim.rowCount === 0) {
      const prior = (await db.query(`select * from ${schema}.idempotency_records
        where workspace_id=$1 and idempotency_key=$2 for update`, [input.workspace_id, input.idempotency_key])).rows[0];
      await db.query('commit');
      committed = true;
      if (prior.input_fingerprint !== input.input_fingerprint) {
        return { outcome: 'changed_replay', ...replayIdentity(input),
          stored_input_fingerprint: prior.input_fingerprint };
      }
      if (prior.state === 'committed') {
        return { outcome: 'exact_replay', replayed: true, receipt: prior.response_snapshot };
      }
      return { outcome: 'unknown_commit', ...replayIdentity(input), recovery_required: true };
    }

    if (options.delayAfterClaim) await db.query('select pg_sleep($1)', [options.delayAfterClaim]);
    const domainId = randomUUID();
    const auditId = randomUUID();
    const outboxId = randomUUID();
    const receiptId = randomUUID();
    await db.query(`insert into ${schema}.domain_mutations
      (id,transaction_scope_id,workspace_id,operation,aggregate_id,provider_receipt_id)
      values ($1,$2,$3,$4,$5,$6)`, [domainId, input.transaction_scope_id, input.workspace_id,
      input.operation, input.aggregate_id, input.provider_receipt_id]);
    await db.query(`insert into ${schema}.audit_events
      (id,transaction_scope_id,workspace_id,actor_reference_id,action,redaction)
      values ($1,$2,$3,$4,$5,'metadata_only')`, [auditId, input.transaction_scope_id, input.workspace_id,
      input.actor_reference_id, `SERVICE_${input.operation.toUpperCase()}`]);
    await db.query(`insert into ${schema}.outbox_events
      (id,transaction_scope_id,workspace_id,aggregate_id,event_type,event_version)
      values ($1,$2,$3,$4,$5,1)`, [outboxId, input.transaction_scope_id, input.workspace_id,
      input.aggregate_id, `service.${input.operation}.v1`]);
    if (options.failAfterEffects) throw new Error('simulated transaction failure');
    const receipt = {
      contract: 'service-runtime-persistence-receipt.v1', version: 1, receipt_id: receiptId,
      transaction_scope_id: input.transaction_scope_id, workspace_id: input.workspace_id,
      actor_reference_id: input.actor_reference_id, authority_decision_id: input.authority_decision_id,
      authority_version: input.authority_version, operation: input.operation, aggregate_id: input.aggregate_id,
      idempotency_key: input.idempotency_key, input_fingerprint: input.input_fingerprint,
      provider_receipt_id: input.provider_receipt_id, state: 'committed',
      effects: { domain_mutation_id: domainId, audit_event_id: auditId, outbox_event_id: outboxId,
        idempotency_record_id: idempotencyId, domain_mutation_count: 1, audit_event_count: 1,
        outbox_event_count: 1, idempotency_record_count: 1 },
      committed_at: new Date().toISOString(),
    };
    await db.query(`update ${schema}.idempotency_records set state='committed', commit_receipt_id=$1,
      response_snapshot=$2::jsonb where id=$3`, [receiptId, JSON.stringify(receipt), idempotencyId]);
    await db.query('commit');
    committed = true;
    if (options.loseAcknowledgement) throw new UnknownCommit();
    return { outcome: 'committed', replayed: false, receipt };
  } catch (error) {
    if (!committed) await db.query('rollback').catch(() => undefined);
    if (error?.code === '40001' && attempt < 5) {
      await db.end();
      closed = true;
      return executeAtomic(input, options, attempt + 1);
    }
    throw error;
  } finally {
    if (!closed) await db.end();
  }
}

async function recover(input) {
  const db = await client();
  try {
    const result = await db.query(`select * from ${schema}.idempotency_records
      where workspace_id=$1 and idempotency_key=$2`, [input.workspace_id, input.idempotency_key]);
    if (result.rowCount === 0) {
      return { outcome: 'absent', ...replayIdentity(input),
        retry_requires_fresh_authority_and_providers: true };
    }
    const row = result.rows[0];
    if (row.input_fingerprint !== input.input_fingerprint) {
      return { outcome: 'changed_replay', ...replayIdentity(input), stored_input_fingerprint: row.input_fingerprint };
    }
    if (row.state === 'committed') return { outcome: 'committed', receipt: row.response_snapshot };
    return { outcome: 'pending', ...replayIdentity(input), retry_allowed: false };
  } finally {
    await db.end();
  }
}

function intent(seed, overrides = {}) {
  const value = {
    contract: 'service-runtime-persistence.v1', version: 1, acceptance: 'contract_only', executable: false,
    transaction_scope_id: id(seed), isolation_level: 'serializable', workspace_id: id(1),
    actor_reference_id: id(2), authority_decision_id: id(3), authority_version: 4,
    authority_evaluated_at: '2026-10-12T09:40:00.000Z', authority_rechecked_after_lock: true,
    operation: 'subject_link', aggregate_type: 'service_request', aggregate_id: id(5),
    idempotency_key: `service-pg-${String(seed).padStart(4, '0')}`,
    input_fingerprint: `svc1:${seed.toString(16).padStart(16, '0')}`,
    provider_receipt_id: id(6),
    effect_set: {
      lock_order: ['idempotency_key', 'workspace', 'service_aggregate', 'provider_source'],
      domain_mutation: { count: 1, operation: 'subject_link', aggregate_id: id(5), provider_receipt_id: id(6) },
      audit: { count: 1, contract: 'audit.events', redaction: 'metadata_only' },
      outbox: { count: 1, contract: 'platform.outbox_events', event_version: 1 },
      idempotency: { count: 1, contract: 'platform.idempotency_keys',
        input_fingerprint: `svc1:${seed.toString(16).padStart(16, '0')}` },
      atomic: true,
    },
    ...overrides,
  };
  return contract.serviceRuntimePersistenceIntentV1Schema.parse(value);
}

await setup();
try {
  const firstIntent = intent(20);
  const first = await executeAtomic(firstIntent);
  await check('initial atomic commit verifies against contract', async () => {
    const evaluated = contract.evaluateServiceRuntimePersistenceResultV1(firstIntent, first);
    assert.equal(evaluated.status, 'verified');
    assert.equal(evaluated.code, 'ATOMIC_COMMIT_VERIFIED');
  });
  await check('initial commit writes exactly one complete effect set', async () => {
    assert.deepEqual(await counts(firstIntent.idempotency_key), { idempotency: 1, domain: 1, audit: 1, outbox: 1 });
  });

  const exact = await executeAtomic(firstIntent);
  await check('exact replay returns immutable prior receipt', async () => {
    assert.equal(exact.outcome, 'exact_replay');
    assert.deepEqual(exact.receipt, first.receipt);
    assert.equal(contract.evaluateServiceRuntimePersistenceResultV1(firstIntent, exact).code, 'EXACT_REPLAY_VERIFIED');
  });
  await check('exact replay creates zero duplicate effects', async () => {
    assert.deepEqual(await counts(firstIntent.idempotency_key), { idempotency: 1, domain: 1, audit: 1, outbox: 1 });
  });

  const changedIntent = intent(20, { input_fingerprint: 'svc1:9999999999999999', effect_set: {
    ...firstIntent.effect_set, idempotency: { ...firstIntent.effect_set.idempotency,
      input_fingerprint: 'svc1:9999999999999999' } } });
  const changed = await executeAtomic(changedIntent);
  await check('changed replay is a bounded conflict', async () => {
    assert.equal(changed.outcome, 'changed_replay');
    assert.deepEqual(contract.evaluateServiceRuntimePersistenceResultV1(changedIntent, changed),
      { status: 'conflict', code: 'REPLAY_CONFLICT' });
  });
  await check('changed replay creates zero duplicate effects', async () => {
    assert.deepEqual(await counts(firstIntent.idempotency_key), { idempotency: 1, domain: 1, audit: 1, outbox: 1 });
  });

  const rollbackIntent = intent(21);
  await check('transaction failure rolls back the entire effect set', async () => {
    await assert.rejects(() => executeAtomic(rollbackIntent, { failAfterEffects: true }), /simulated transaction failure/);
    assert.deepEqual(await counts(rollbackIntent.idempotency_key), { idempotency: 0, domain: 0, audit: 0, outbox: 0 });
  });
  const staleIntent = intent(22);
  await check('stale authority performs zero writes', async () => {
    assert.deepEqual(await executeAtomic(staleIntent, { authorityAllowed: false }),
      { status: 'denied', code: 'AUTHORITY_STALE' });
    assert.deepEqual(await counts(staleIntent.idempotency_key), { idempotency: 0, domain: 0, audit: 0, outbox: 0 });
  });
  const providerFailureIntent = intent(23);
  await check('provider failure performs zero writes', async () => {
    assert.deepEqual(await executeAtomic(providerFailureIntent, { providerAvailable: false }),
      { status: 'unknown', code: 'PROVIDER_RESULT_UNKNOWN' });
    assert.deepEqual(await counts(providerFailureIntent.idempotency_key),
      { idempotency: 0, domain: 0, audit: 0, outbox: 0 });
  });

  const unknownIntent = intent(24);
  await check('lost acknowledgement is recovered from committed readback', async () => {
    await assert.rejects(() => executeAtomic(unknownIntent, { loseAcknowledgement: true }), UnknownCommit);
    const result = await recover(unknownIntent);
    const request = { contract: 'service-runtime-unknown-commit-recovery.v1', version: 1,
      ...replayIdentity(unknownIntent), recovery_attempt: 1 };
    const evaluated = contract.evaluateServiceRuntimeUnknownCommitRecoveryV1(request, result);
    assert.equal(evaluated.status, 'recovered');
    assert.equal(evaluated.code, 'COMMIT_RECOVERED');
    assert.deepEqual(await counts(unknownIntent.idempotency_key),
      { idempotency: 1, domain: 1, audit: 1, outbox: 1 });
  });
  const absentIntent = intent(25);
  await check('absent recovery requires fresh authority and providers', async () => {
    const request = { contract: 'service-runtime-unknown-commit-recovery.v1', version: 1,
      ...replayIdentity(absentIntent), recovery_attempt: 1 };
    const evaluated = contract.evaluateServiceRuntimeUnknownCommitRecoveryV1(request, await recover(absentIntent));
    assert.equal(evaluated.status, 'absent');
    assert.equal(evaluated.retryable, true);
    assert.equal(evaluated.requires_fresh_authority_and_providers, true);
  });

  await reset();
  const duplicateIntent = intent(26);
  const concurrent = await Promise.all([
    executeAtomic(duplicateIntent, { delayAfterClaim: 0.2 }),
    executeAtomic(duplicateIntent),
  ]);
  await check('concurrent duplicate has one commit and one exact replay', async () => {
    assert.deepEqual(concurrent.map(value => value.outcome).sort(), ['committed', 'exact_replay']);
    assert.deepEqual(concurrent[0].receipt, concurrent[1].receipt);
  });
  await check('concurrent duplicate persists exactly one atomic effect set', async () => {
    assert.deepEqual(await counts(duplicateIntent.idempotency_key),
      { idempotency: 1, domain: 1, audit: 1, outbox: 1 });
  });
  await check('concurrent exact replay remains contract-valid', async () => {
    for (const result of concurrent) {
      assert.equal(contract.evaluateServiceRuntimePersistenceResultV1(duplicateIntent, result).status, 'verified');
    }
  });
} finally {
  const db = await client();
  await db.query(`drop schema if exists ${schema} cascade`);
  await db.end();
}

console.log(`SERVICE runtime persistence PostgreSQL: ${pass}/${pass} PASS`);
