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
const conversationRequestId = randomUUID();
const messageId = randomUUID();
const communicationsRoleId = randomUUID();
const outsideScopeAssignmentId = randomUUID();
const exactScopeAssignmentId = randomUUID();
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
  // Keep the AP10 base persona unchanged. Communications authority must come
  // only from the explicit Workspace role assignment below, so an assignment
  // for a different unit cannot be masked by a broad system-role permission.
  await pool.query(`insert into platform.workspace_entitlements(
      customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
    ) values($1,'module.communications','boolean',true,statement_timestamp()-interval '1 second')`,
  [ids.workspaceIds[0]]);
  await pool.query(`with writer_marker as (
      select set_config('communications.private_conversation_workspace_writer_v1',
        jsonb_build_object(
          'contract_version','communications-private-conversation-workspace.v1',
          'workspace_id',$3::text,'tenant_id',$2::text,'unit_id',$4::text,
          'actor_membership_id',$5::text,'client_request_id',$6::text
        )::text,true)
    )
    insert into communications.private_conversations(
      id,tenant_id,workspace_id,unit_id,created_by,client_request_id)
    select $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid from writer_marker`,
  [conversationId, ids.tenantId, ids.workspaceIds[0], ids.unitIds[0],
    ids.membershipId, conversationRequestId]);
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

  let communicationsModuleId;
  let communicationsPermissionId;
  const installCommunicationsRole = async () => {
    const canonical = await pool.query(`select d.id as module_id,p.id as permission_id
      from platform.module_definitions d
      join platform.module_permission_bindings b on b.module_definition_id=d.id
        and b.lifecycle_status='active' and b.valid_from<=statement_timestamp()
        and (b.valid_to is null or b.valid_to>statement_timestamp())
      join identity.permissions p on p.id=b.permission_id
      where d.code='communications' and d.is_active
        and d.lifecycle_status in ('active','published')
        and d.valid_from<=statement_timestamp()
        and (d.valid_to is null or d.valid_to>statement_timestamp())
        and p.code='communications.feed.read'`);
    assert.equal(canonical.rowCount, 1, 'canonical Communications permission/module binding required');
    communicationsModuleId = canonical.rows[0].module_id;
    communicationsPermissionId = canonical.rows[0].permission_id;
    await pool.query(`insert into platform.workspace_modules(
        tenant_id,customer_workspace_id,module_definition_id,module_code,status,
        valid_from,activated_at,activated_by,reason
      ) values($1,$2,$3,'communications','active',statement_timestamp()-interval '1 second',
        statement_timestamp(),$4,'Communications provider host fixture')`,
    [ids.tenantId, ids.workspaceIds[0], communicationsModuleId, actor]);
    await pool.query(`insert into platform.workspace_roles(
        id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,
        lifecycle_status,created_by,valid_from
      ) select $1,$2,$3,$4,'Communications provider reader',r.id,'workspace',
        'draft',$5,statement_timestamp()-interval '1 second'
      from identity.roles r
      where r.code='association_admin' and r.tenant_id is null and r.is_system`,
    [communicationsRoleId, ids.tenantId, ids.workspaceIds[0],
      `comm_provider_${randomUUID().replaceAll('-', '').slice(0, 16)}`, actor]);
    await pool.query(`insert into platform.workspace_role_modules(
        tenant_id,workspace_role_id,module_definition_id
      ) values($1,$2,$3)`, [ids.tenantId, communicationsRoleId, communicationsModuleId]);
    await pool.query(`insert into platform.workspace_role_permissions(
        tenant_id,workspace_role_id,permission_id,effect
      ) values($1,$2,$3,'allow')`,
    [ids.tenantId, communicationsRoleId, communicationsPermissionId]);
    await pool.query(`update platform.workspace_roles
      set lifecycle_status='published',lock_version=lock_version+1
      where id=$1 and lifecycle_status='draft'`, [communicationsRoleId]);
  };
  const assignCommunicationsUnit = async (assignmentId, unitIndex) => {
    await pool.query(`insert into platform.workspace_member_roles(
        id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,
        scope_type,property_id,building_id,unit_id,assigned_by_user_id,
        assigned_by_membership_id,reason,valid_from
      ) values($1,$2,$3,$4,$5,'unit',$6,$7,$8,$9,$4,
        'Communications provider exact scope fixture',statement_timestamp()-interval '1 second')`, [
      assignmentId, ids.tenantId, ids.workspaceIds[0], ids.membershipId,
      communicationsRoleId, ids.propertyIds[0], ids.buildingIds[0], ids.unitIds[unitIndex], actor,
    ]);
  };
  const assignCommunicationsWorkspace = async assignmentId => {
    await pool.query(`insert into platform.workspace_member_roles(
        id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,
        scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from
      ) values($1,$2,$3,$4,$5,'workspace',$6,$4,
        'Communications provider exact Workspace fixture',statement_timestamp()-interval '1 second')`, [
      assignmentId, ids.tenantId, ids.workspaceIds[0], ids.membershipId,
      communicationsRoleId, actor,
    ]);
  };

  await check('base role and native Workspace without Communications module/permission deny with zero durable effects', async () => {
    const unscoped = await command();
    const before = await effects();
    const beforeMutations = mutations;
    const beforeAuthority = authorityCalls;
    const result = await host.execute(unscoped, providers());
    assert.deepEqual(result, { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    assert.ok(authorityCalls > beforeAuthority, 'Core must recheck current authority before provider denial');
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  });

  await installCommunicationsRole();
  await assignCommunicationsUnit(outsideScopeAssignmentId, 1);
  await check('unit-scoped Communications assignment is insufficient for the Workspace gate', async () => {
    const outsideScope = await command();
    const before = await effects();
    const beforeMutations = mutations;
    const beforeAuthority = authorityCalls;
    const result = await host.execute(outsideScope, providers());
    assert.deepEqual(result, { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    assert.ok(authorityCalls > beforeAuthority, 'Core must recheck current authority before scope denial');
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  });

  await assignCommunicationsWorkspace(exactScopeAssignmentId);

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
  await check('current message with exact Communications authority scope commits typed evidence once', async () => {
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
