import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';

import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';

const connectionString = process.env.CORE_TX_REPLAY_HOOK_TEST_DATABASE_URL;
if (!connectionString || process.env.CORE_TX_REPLAY_HOOK_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Core replay-hook PostgreSQL target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || !['/postgres', '/core_tx_replay_hook_test'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url))
    : require(name), mod, mod.exports);
  cache.set(url.href, mod.exports);
  return mod.exports;
}

const { createCorePostgresTransactionHostV1 } = load(new URL(
  '../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url,
));
const { resolveAuthority } = load(new URL(
  '../src/lib/core/current-authority-postgres-provider-v1.ts', import.meta.url,
));
const {
  coreTransactionReplayCommandHashV1,
  coreTransactionReplayReceiptHashV1,
} = load(new URL('../src/lib/core/transaction-replay-provider-hook-v1.ts', import.meta.url));

const pool = new pg.Pool({ connectionString, max: 12 });
const host = createCorePostgresTransactionHostV1(pool);
const driver = createAp10CoreAuthorityDriver(pool);
const actor = randomUUID();
let checks = 0;
const check = async (name, operation) => {
  await operation();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
};

const counters = {
  authority: 0,
  fresh: { ce: 0, documents: 0 },
  replay: { ce: 0, documents: 0 },
  mutation: { ce: 0, documents: 0 },
};

let ids;
const revision = async () => Number((await pool.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton',
)).rows[0].revision);

function command(profile, authorityVersion) {
  const index = profile === 'ce' ? 0 : 1;
  const transactionId = randomUUID();
  const commandId = randomUUID();
  const common = {
    transaction_id: transactionId,
    command_id: commandId,
    context_id: ids.contextId,
    workspace_id: ids.workspaceIds[index],
    actor_id: actor,
    authority_version: authorityVersion,
    permission_code: 'airprop.asset.manage',
    module_code: 'airprop_commercial',
    evaluation_purpose: profile === 'ce'
      ? 'experience.guide.publish'
      : 'documents.workspace_upload.finalize',
    aggregate_type: profile === 'ce' ? 'experience_guide' : 'documents.document',
    aggregate_id: ids.propertyIds[index],
    aggregate_version: 1,
    provider_source_ids: [ids.propertyIds[index]],
    idempotency_key: `${profile}-replay-${randomUUID()}`,
    input_fingerprint: `${profile}1:${'a'.repeat(64)}`,
  };
  return profile === 'ce' ? {
    contract_version: 'core-transaction-command.v2',
    ...common,
    subject_reference: {
      kind: 'experience.guide', id: ids.propertyIds[index], version: 1,
      relation: 'publish', request_version: 1,
    },
  } : { contract_version: 'core-transaction-command.v1', ...common };
}

async function resolveCurrentAuthority(scope, request) {
  counters.authority += 1;
  await scope.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
    sub: actor, role: 'authenticated', aal: 'aal2',
  })]);
  return resolveAuthority(scope, request);
}

function replayDecision(scope, commandValue, authority, receipt, providerCode, evaluatedAt,
  decision = 'accepted', denialReason = null) {
  return {
    contract_version: 'core-transaction-replay-provider-decision.v1',
    decision_id: randomUUID(),
    provider_code: providerCode,
    database_transaction_id: scope.database_transaction_id,
    transaction_id: commandValue.transaction_id,
    command_id: commandValue.command_id,
    workspace_id: commandValue.workspace_id,
    actor_id: commandValue.actor_id,
    context_id: commandValue.context_id,
    authority_decision_id: authority.decision_id,
    authority_version: authority.authority_version,
    attempt: scope.attempt,
    receipt_id: receipt.receipt_id,
    receipt_contract_version: receipt.contract_version,
    command_hash: coreTransactionReplayCommandHashV1(commandValue),
    receipt_hash: coreTransactionReplayReceiptHashV1(receipt),
    evaluated_at: new Date(evaluatedAt).toISOString(),
    read_only: true,
    decision,
    denial_reason: denialReason,
  };
}

function providers(profile, options = {}) {
  const index = profile === 'ce' ? 0 : 1;
  const providerCode = profile === 'ce'
    ? 'ce-guide-lifecycle-provider.v1'
    : 'documents-workspace-binding-writer.v1';
  const expectedName = profile === 'ce'
    ? `Replay CE ${options.commandId}`
    : `Replay Documents ${options.commandId}`;
  const result = {
    ...(profile === 'ce' ? { provider_code: providerCode } : { replay_provider_code: providerCode }),
    replay_policy: 'provider_current_state_required',
    resolveAuthority: resolveCurrentAuthority,
    async validateProviders(scope, commandValue, authority) {
      counters.fresh[profile] += 1;
      const state = await scope.query(`select id::text,status,clock_timestamp()::text as now
        from portfolio.properties where id=$1 and tenant_id=$2`,
      [ids.propertyIds[index], scope.tenant_id]);
      if (profile === 'documents') return state.rowCount === 1 && authority.decision === 'allowed';
      return {
        contract_version: 'core-transaction-provider-evidence.v1',
        evidence_id: randomUUID(),
        provider_code: providerCode,
        transaction_id: commandValue.transaction_id,
        command_id: commandValue.command_id,
        workspace_id: commandValue.workspace_id,
        actor_id: commandValue.actor_id,
        context_id: commandValue.context_id,
        authority_decision_id: authority.decision_id,
        authority_version: authority.authority_version,
        attempt: scope.attempt,
        subject_reference: commandValue.subject_reference,
        evaluated_at: new Date(state.rows[0].now).toISOString(),
        source_disclosure: 'status_only',
        source_reference: null,
        decision: 'accepted',
        denial_reason: null,
        reference_state: 'available',
        current_actor_can_read: true,
      };
    },
    async validateReplay(scope, commandValue, authority, receipt) {
      counters.replay[profile] += 1;
      options.attempts?.push(scope.attempt);
      options.authorityDecisions?.push(authority.decision_id);
      if (options.entered && scope.attempt === 1) options.entered();
      let state;
      try {
        state = await scope.query(`select id::text,name,status,clock_timestamp()::text as now,
            txid_current()::text as transaction_id
          from portfolio.properties where id=$1 and tenant_id=$2 for share`,
        [commandValue.aggregate_id, scope.tenant_id]);
      } catch (error) {
        if (error?.code) options.errorCodes?.push(error.code);
        throw error;
      }
      assert.equal(state.rows[0]?.transaction_id, scope.database_transaction_id);
      assert.equal(scope.transaction_id, commandValue.transaction_id);
      assert.equal(scope.workspace_id, commandValue.workspace_id);
      assert.equal(scope.actor_id, commandValue.actor_id);
      let decision = state.rowCount === 1 && state.rows[0].status === 'active'
        && state.rows[0].name === expectedName && receipt.mutation_id === commandValue.aggregate_id
        ? 'accepted' : 'denied';
      let denialReason = decision === 'accepted' ? null : 'REPLAY_STATE_CHANGED';
      if (options.denialReason) {
        decision = 'denied';
        denialReason = options.denialReason;
      }
      const evidence = replayDecision(scope, commandValue, authority, receipt, providerCode,
        state.rows[0]?.now ?? new Date().toISOString(), decision, denialReason);
      if (options.malformedDecision) evidence.receipt_hash = '0'.repeat(64);
      return evidence;
    },
    async mutate(scope, commandValue) {
      counters.mutation[profile] += 1;
      const updated = await scope.query(`update portfolio.properties set name=$2
        where id=$1 and tenant_id=$3 returning id::text`,
      [commandValue.aggregate_id, expectedName, scope.tenant_id]);
      if (updated.rowCount !== 1) throw new Error('replay_profile_mutation_failed');
      return { mutation_id: updated.rows[0].id };
    },
  };
  if (options.missingCapability) delete result.validateReplay;
  if (options.missingPolicy) delete result.replay_policy;
  if (options.authorityOnly) {
    delete result.replay_policy;
    delete result.replay_provider_code;
    delete result.validateReplay;
  }
  return result;
}

async function effects(commandValue) {
  const key = `core-tx.v1:${commandValue.workspace_id}:${commandValue.idempotency_key}`;
  return (await pool.query(`select
      (select count(*)::int from platform.idempotency_keys where tenant_id=$1 and key=$2) idempotency,
      (select xmin::text from platform.idempotency_keys where tenant_id=$1 and key=$2) idempotency_xmin,
      (select md5(response_ref::text) from platform.idempotency_keys where tenant_id=$1 and key=$2) receipt_hash,
      (select count(*)::int from audit.events where tenant_id=$1 and request_id=$3) audit,
      (select count(*)::int from platform.outbox_events where tenant_id=$1 and trace_id=$3) outbox,
      (select name from portfolio.properties where id=$4) domain_state`,
  [ids.tenantId, key, commandValue.command_id, commandValue.aggregate_id])).rows[0];
}

async function assertReplayDenial(commandValue, provider, expectedCode) {
  const before = await effects(commandValue);
  const beforeMutations = { ...counters.mutation };
  const result = await host.execute(commandValue, provider);
  assert.equal(result.status, 'denied');
  assert.equal(result.code, expectedCode);
  assert.deepEqual(await effects(commandValue), before);
  assert.deepEqual(counters.mutation, beforeMutations);
}

try {
  await pool.query('insert into auth.users(id,email) values($1,$2)', [
    actor, `core-replay-hook-${randomUUID()}@example.invalid`,
  ]);
  ids = await driver.setup({ userId: actor, runId: randomUUID(), target: 'local' });
  const authorityVersion = await revision();

  const ceCommand = command('ce', authorityVersion);
  const ceProvider = providers('ce', { commandId: ceCommand.command_id });
  let ceCommitted;
  await check('CE profile commits through the existing Core host and ledgers', async () => {
    ceCommitted = await host.execute(ceCommand, ceProvider);
    assert.equal(ceCommitted.status, 'committed');
    const state = await effects(ceCommand);
    assert.equal(state.idempotency, 1);
    assert.ok(state.idempotency_xmin);
    assert.ok(state.receipt_hash);
    assert.equal(state.audit, 1);
    assert.equal(state.outbox, 1);
    assert.equal(state.domain_state, `Replay CE ${ceCommand.command_id}`);
  });

  await check('CE exact replay runs only the current-state hook after authority and receipt matching', async () => {
    const before = await effects(ceCommand);
    const beforeCounters = structuredClone(counters);
    const replay = await host.execute(ceCommand, providers('ce', { commandId: ceCommand.command_id }));
    assert.equal(replay.status, 'exact_replay');
    assert.deepEqual(replay.receipt, ceCommitted.receipt);
    assert.deepEqual(await effects(ceCommand), before);
    assert.equal(counters.authority, beforeCounters.authority + 1);
    assert.equal(counters.replay.ce, beforeCounters.replay.ce + 1);
    assert.equal(counters.fresh.ce, beforeCounters.fresh.ce);
    assert.equal(counters.mutation.ce, beforeCounters.mutation.ce);
  });

  const documentsCommand = command('documents', authorityVersion);
  const documentsProvider = providers('documents', { commandId: documentsCommand.command_id });
  let documentsCommitted;
  await check('Documents V1 profile consumes the same typed replay hook without another host', async () => {
    documentsCommitted = await host.execute(documentsCommand, documentsProvider);
    assert.equal(documentsCommitted.status, 'committed');
    const before = await effects(documentsCommand);
    const beforeFresh = counters.fresh.documents;
    const beforeMutation = counters.mutation.documents;
    const replay = await host.execute(documentsCommand, providers('documents', {
      commandId: documentsCommand.command_id,
    }));
    assert.equal(replay.status, 'exact_replay');
    assert.deepEqual(replay.receipt, documentsCommitted.receipt);
    assert.deepEqual(await effects(documentsCommand), before);
    assert.equal(counters.fresh.documents, beforeFresh);
    assert.equal(counters.mutation.documents, beforeMutation);
  });

  await check('required replay capability missing or unmarked fails closed with zero write', async () => {
    await assertReplayDenial(documentsCommand, providers('documents', {
      commandId: documentsCommand.command_id, missingCapability: true,
    }), 'PROVIDER_UNAVAILABLE');
    await assertReplayDenial(documentsCommand, providers('documents', {
      commandId: documentsCommand.command_id, missingPolicy: true,
    }), 'PROVIDER_UNAVAILABLE');
    await assertReplayDenial(documentsCommand, providers('documents', {
      commandId: documentsCommand.command_id, authorityOnly: true,
    }), 'PROVIDER_UNAVAILABLE');
  });

  await check('provider denial and stale provider evidence are bounded replay conflicts', async () => {
    for (const denialReason of ['REPLAY_DISCLOSURE_DENIED', 'STALE_PROVIDER_EVIDENCE']) {
      await assertReplayDenial(ceCommand, providers('ce', {
        commandId: ceCommand.command_id, denialReason,
      }), 'REPLAY_CONFLICT');
    }
  });

  await check('malformed typed hook decision is unavailable and writes nothing', async () => {
    await assertReplayDenial(ceCommand, providers('ce', {
      commandId: ceCommand.command_id, malformedDecision: true,
    }), 'PROVIDER_UNAVAILABLE');
  });

  await check('malformed stored receipt conflicts before the replay hook and writes nothing', async () => {
    const key = `core-tx.v1:${ceCommand.workspace_id}:${ceCommand.idempotency_key}`;
    const beforeReplayCalls = counters.replay.ce;
    try {
      const malformed = structuredClone(ceCommitted.receipt);
      malformed.replay_validation.provider_code = 'substituted.provider';
      await pool.query(`update platform.idempotency_keys set response_ref=$3::jsonb
        where tenant_id=$1 and key=$2`, [ids.tenantId, key, JSON.stringify(malformed)]);
      await assertReplayDenial(ceCommand, providers('ce', {
        commandId: ceCommand.command_id,
      }), 'REPLAY_CONFLICT');
      assert.equal(counters.replay.ce, beforeReplayCalls);
    } finally {
      await pool.query(`update platform.idempotency_keys set response_ref=$3::jsonb
        where tenant_id=$1 and key=$2`, [ids.tenantId, key, JSON.stringify(ceCommitted.receipt)]);
    }
  });

  await check('real PostgreSQL 40001 reaches Core and retries the hook in a fresh attempt', async () => {
    const blocker = await pool.connect();
    const attempts = [];
    const authorityDecisions = [];
    const errorCodes = [];
    let entered;
    const hookEntered = new Promise(resolve => { entered = resolve; });
    const before = await effects(ceCommand);
    const beforeFresh = counters.fresh.ce;
    const beforeMutation = counters.mutation.ce;
    try {
      await blocker.query('begin');
      await blocker.query('update portfolio.properties set name=name where id=$1', [ceCommand.aggregate_id]);
      const replayPending = host.execute(ceCommand, providers('ce', {
        commandId: ceCommand.command_id, attempts, authorityDecisions, errorCodes, entered,
      }));
      await hookEntered;
      await blocker.query('commit');
      const replay = await replayPending;
      assert.equal(replay.status, 'exact_replay');
      assert.deepEqual(errorCodes, ['40001']);
      assert.deepEqual(attempts, [1, 2]);
      assert.equal(new Set(authorityDecisions).size, 2);
      const after = await effects(ceCommand);
      assert.equal(after.idempotency, before.idempotency);
      assert.equal(after.idempotency_xmin, before.idempotency_xmin);
      assert.equal(after.receipt_hash, before.receipt_hash);
      assert.equal(after.audit, before.audit);
      assert.equal(after.outbox, before.outbox);
      assert.equal(after.domain_state, before.domain_state);
      assert.equal(counters.fresh.ce, beforeFresh);
      assert.equal(counters.mutation.ce, beforeMutation);
    } finally {
      await blocker.query('rollback').catch(() => {});
      blocker.release();
    }
  });

  await check('revoked current authority denies before hook and adds no replay effects', async () => {
    await driver.revoke({ authority: ids });
    const before = await effects(ceCommand);
    const beforeHook = counters.replay.ce;
    const result = await host.execute(ceCommand, providers('ce', { commandId: ceCommand.command_id }));
    assert.equal(result.status, 'denied');
    assert.equal(result.code, 'AUTHORITY_DENIED');
    assert.equal(Object.hasOwn(result, 'authority'), false);
    assert.equal(counters.replay.ce, beforeHook);
    assert.deepEqual(await effects(ceCommand), before);
  });
} finally {
  await pool.end();
}

console.log(`Core transaction replay provider hook PostgreSQL: ${checks}/${checks} PASS`);
