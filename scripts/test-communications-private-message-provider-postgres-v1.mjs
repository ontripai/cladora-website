import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';

let activeCheck = 'fixture setup';
const workflowEscape = value => String(value).replaceAll('%', '%25')
  .replaceAll('\r', '%0D').replaceAll('\n', '%0A');
process.on('uncaughtExceptionMonitor', error => {
  const code = typeof error?.code === 'string' ? error.code : 'NO_SQLSTATE';
  const message = error instanceof Error ? error.message : 'unknown_failure';
  console.error(`::error title=Communications Core TX host regression::${workflowEscape(`${activeCheck}: ${code}: ${message}`)}`);
});

const connectionString = process.env.COMM_MESSAGE_PROVIDER_TEST_DATABASE_URL;
if (!connectionString || process.env.COMM_MESSAGE_PROVIDER_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Communications provider target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || !['/communications_message_provider_test', '/postgres'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loadedModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name),
  loadedModule, loadedModule.exports);
  cache.set(url.href, loadedModule.exports);
  return loadedModule.exports;
}

const { resolveAuthority } = load(new URL('../src/lib/core/current-authority-postgres-provider-v1.ts', import.meta.url));
const { createCorePostgresTransactionHostV1 } = load(new URL('../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url));
const {
  communicationsPrivateMessageProviderCodeV1,
  resolveCommunicationsPrivateMessageSubjectV1,
} = load(new URL('../src/lib/core/communications-private-message-subject-provider-v1.ts', import.meta.url));
const { createAp10CoreAuthorityDriver } = await import('./lib/ap10-core-authority-driver.mjs');

const pool = new pg.Pool({ connectionString, max: 8 });
// Every Core attempt uses a real PostgreSQL session. This temp function lets the
// provider query raise a real 40001 without adding a repository/runtime object.
const hostPool = {
  async connect() {
    const client = await pool.connect();
    await client.query(`create or replace function pg_temp.comm_raise_serialization_v1()
      returns void language plpgsql as $$ begin
        raise exception 'synthetic_serialization_failure' using errcode='40001';
      end $$`);
    return client;
  },
};
const host = createCorePostgresTransactionHostV1(hostPool);
const driver = createAp10CoreAuthorityDriver(pool);
const actor = randomUUID();
const conversationId = randomUUID();
const messageId = randomUUID();
let mutations = 0;
let providerCalls = 0;
let authorityCalls = 0;
let passed = 0;
const check = async (name, run) => {
  activeCheck = name;
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

try {
  await pool.query('insert into auth.users(id,email) values($1,$2)', [
    actor, `comm-provider-${randomUUID()}@example.invalid`,
  ]);
  const ids = await driver.setup({ userId: actor, runId: randomUUID(), target: 'local' });
  // AP10 intentionally begins with a tenant-wide context and AIRPROP system
  // persona. Private-message discovery rejects tenant-wide scope, so this
  // integration fixture narrows that same canonical membership and context to
  // the exact property while preserving AP10's Workspace-local Core authority.
  await pool.query(`update identity.memberships set role_id=(
      select id from identity.roles
      where code='association_admin' and tenant_id is null and is_system
    ) where id=$1`, [ids.membershipId]);
  await pool.query(`update identity.context_grants set
      scope_type='property',property_id=$2,building_id=null,unit_id=null
    where id=$1`, [ids.contextId, ids.propertyIds[0]]);
  await pool.query(`insert into platform.workspace_entitlements(
      customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
    ) values($1,'module.communications','boolean',true,statement_timestamp()-interval '1 second')`,
  [ids.workspaceIds[0]]);
  await pool.query(`insert into communications.private_conversations(
      id,tenant_id,unit_id,created_by,client_request_id
    ) values($1,$2,$3,$4,$5)`,
  [conversationId, ids.tenantId, ids.unitIds[0], ids.membershipId, randomUUID()]);
  await pool.query(`insert into communications.private_participants(conversation_id,membership_id)
    values($1,$2)`, [conversationId, ids.membershipId]);
  await pool.query(`insert into communications.private_messages(
      id,conversation_id,sender_id,client_request_id,body
    ) values($1,$2,$3,$4,'Host-level private body')`,
  [messageId, conversationId, ids.membershipId, randomUUID()]);

  const revision = async () => Number((await pool.query(
    'select revision::text from app_private.canonical_authority_revision_v1 where singleton',
  )).rows[0].revision);
  let aggregateVersion = 0;
  const command = async ({ subjectVersion = 1, ...overrides } = {}) => ({
    contract_version: 'core-transaction-command.v2',
    transaction_id: randomUUID(),
    command_id: randomUUID(),
    context_id: ids.contextId,
    workspace_id: ids.workspaceIds[0],
    actor_id: actor,
    authority_version: await revision(),
    permission_code: 'airprop.asset.manage',
    module_code: 'airprop_commercial',
    evaluation_purpose: 'communications.message.subject_test',
    aggregate_type: 'property',
    aggregate_id: ids.propertyIds[0],
    aggregate_version: ++aggregateVersion,
    provider_source_ids: [messageId],
    idempotency_key: randomUUID(),
    input_fingerprint: 'sha256:0123456789abcdef',
    subject_reference: {
      kind: 'message', id: messageId, version: subjectVersion,
      relation: 'subject_link', request_version: subjectVersion,
    },
    ...overrides,
  });
  const providers = ({ serializationOnce = false } = {}) => {
    let serializationInjected = false;
    return {
      provider_code: communicationsPrivateMessageProviderCodeV1,
      async resolveAuthority(scope, request) {
        authorityCalls += 1;
        await scope.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
          sub: actor, role: 'authenticated', aal: 'aal2',
        })]);
        return resolveAuthority(scope, request);
      },
      async validateProviders(scope, cmd, authority) {
        providerCalls += 1;
        if (serializationOnce && !serializationInjected) {
          serializationInjected = true;
          const failingScope = Object.freeze({
            ...scope,
            query: () => scope.query('select pg_temp.comm_raise_serialization_v1()'),
          });
          return resolveCommunicationsPrivateMessageSubjectV1(failingScope, cmd, authority);
        }
        return resolveCommunicationsPrivateMessageSubjectV1(scope, cmd, authority);
      },
      async mutate(scope, cmd) {
        mutations += 1;
        await scope.query('update portfolio.properties set name=$2 where id=$1', [
          cmd.aggregate_id, `Communications host ${cmd.command_id}`,
        ]);
        return { mutation_id: cmd.aggregate_id };
      },
    };
  };
  const effects = async () => (await pool.query(`select
      (select count(*)::int from platform.idempotency_keys where tenant_id=$1) idempotency,
      (select count(*)::int from audit.events where tenant_id=$1) audit,
      (select count(*)::int from platform.outbox_events where tenant_id=$1) outbox,
      (select to_jsonb(p) from portfolio.properties p where id=$2) property,
      (select to_jsonb(m) from communications.private_messages m where id=$3) message`,
  [ids.tenantId, ids.propertyIds[0], messageId])).rows[0];

  await check('stale subject is bounded after current authority with zero durable effects', async () => {
    const stale = await command({ subjectVersion: 2 });
    const before = await effects();
    const beforeMutations = mutations;
    const beforeAuthority = authorityCalls;
    const result = await host.execute(stale, providers());
    assert.deepEqual(result, { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    assert.ok(authorityCalls > beforeAuthority, 'Current authority must be rechecked before subject denial');
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  });

  const current = await command();
  let committed;
  await check('current message and authority commit typed provider evidence once', async () => {
    const beforeMutations = mutations;
    committed = await host.execute(current, providers());
    assert.equal(committed.status, 'committed');
    assert.equal(mutations, beforeMutations + 1);
    assert.equal(committed.receipt.provider_evidence.provider_code,
      communicationsPrivateMessageProviderCodeV1);
    assert.equal(committed.receipt.provider_evidence.decision, 'accepted');
    assert.deepEqual(committed.receipt.subject_reference, current.subject_reference);
    assert.equal(committed.receipt.authority.decision, 'allowed');
  });

  await check('exact replay rechecks authority and creates no additional durable effect', async () => {
    const before = await effects();
    const beforeMutations = mutations;
    const beforeProviders = providerCalls;
    const beforeAuthority = authorityCalls;
    const replay = await host.execute(current, providers());
    assert.equal(replay.status, 'exact_replay');
    assert.deepEqual(replay.receipt, committed.receipt);
    assert.ok(authorityCalls > beforeAuthority);
    assert.equal(providerCalls, beforeProviders);
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  });

  await check('real PostgreSQL 40001 propagates through adapter and Core retries fresh', async () => {
    const retry = await command();
    const beforeMutations = mutations;
    const beforeProviders = providerCalls;
    const result = await host.execute(retry, providers({ serializationOnce: true }));
    assert.equal(result.status, 'committed');
    assert.equal(providerCalls, beforeProviders + 2);
    assert.equal(mutations, beforeMutations + 1);
    assert.equal(result.receipt.provider_evidence.decision, 'accepted');
    assert.equal(result.receipt.authority.transaction_context.attempt, 2);
  });

  console.log(`Communications provider through Core TX host: ${passed}/${passed} PASS`);
} finally {
  await pool.end();
}
