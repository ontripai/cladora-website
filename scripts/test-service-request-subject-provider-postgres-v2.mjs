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
  console.error(`::error title=SERVICE Request Core provider regression::${workflowEscape(`${activeCheck}: ${code}: ${message}`)}`);
});

const connectionString = process.env.SERVICE_REQUEST_PROVIDER_TEST_DATABASE_URL;
if (!connectionString || process.env.SERVICE_REQUEST_PROVIDER_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable SERVICE Request provider target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || target.pathname !== '/postgres') {
  throw new Error('Local disposable Supabase PostgreSQL only');
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

const { resolveAuthority } = load(new URL(
  '../src/lib/core/current-authority-postgres-provider-v1.ts', import.meta.url,
));
const { createCorePostgresTransactionHostV1 } = load(new URL(
  '../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url,
));
const {
  resolveServiceRequestSubjectProviderV2,
  serviceRequestSubjectProviderCodeV2,
} = load(new URL('../src/lib/customer/service-request-subject-provider-v2.ts', import.meta.url));
const { createAp10CoreAuthorityDriver } = await import('./lib/ap10-core-authority-driver.mjs');

const pool = new pg.Pool({ connectionString, max: 12 });
const hostPool = {
  async connect() {
    const client = await pool.connect();
    await client.query(`create or replace function pg_temp.service_request_raise_serialization_v2()
      returns void language plpgsql as $$ begin
        raise exception 'synthetic_serialization_failure' using errcode='40001';
      end $$`);
    return client;
  },
};
const host = createCorePostgresTransactionHostV1(hostPool);
const driver = createAp10CoreAuthorityDriver(pool);
const actor = randomUUID();
const beneficiaryPartyId = randomUUID();
const definitionId = randomUUID();
const offeringId = randomUUID();
const revisionId = randomUUID();
const requestId = randomUUID();
const serviceRoleId = randomUUID();
const serviceAssignmentId = randomUUID();
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
    actor, `service-request-provider-${randomUUID()}@example.invalid`,
  ]);
  const ids = await driver.setup({ userId: actor, runId: randomUUID(), target: 'local' });

  const canonical = await pool.query(`select d.id as module_id,p.id as permission_id
    from platform.module_definitions d
    join platform.module_permission_bindings b on b.module_definition_id=d.id
      and b.lifecycle_status='active' and b.valid_from<=statement_timestamp()
      and (b.valid_to is null or b.valid_to>statement_timestamp())
    join identity.permissions p on p.id=b.permission_id
    where d.code='services_orders' and d.is_active
      and d.lifecycle_status in ('active','published')
      and d.valid_from<=statement_timestamp()
      and (d.valid_to is null or d.valid_to>statement_timestamp())
      and p.code='services.orders.read'`);
  assert.equal(canonical.rowCount, 1, 'canonical SERVICE permission/module binding required');
  const serviceModuleId = canonical.rows[0].module_id;
  const servicePermissionId = canonical.rows[0].permission_id;

  await pool.query('begin');
  try {
    await pool.query('set constraints all deferred');
    await pool.query(`insert into portfolio.parties(id,tenant_id,type,legal_name)
      values($1,$2,'person','SERVICE Request provider beneficiary')`,
    [beneficiaryPartyId, ids.tenantId]);
    await pool.query(`insert into identity.membership_parties(
        membership_id,tenant_id,party_id,valid_from
      ) values($1,$2,$3,statement_timestamp()-interval '1 day')`,
    [ids.membershipId, ids.tenantId, beneficiaryPartyId]);
    await pool.query(`insert into service_catalog.definitions(
        id,tenant_id,workspace_id,code,labels
      ) values($1,$2,$3,'provider_fixture',$4::jsonb)`, [
      definitionId, ids.tenantId, ids.workspaceIds[0],
      JSON.stringify({ ro: 'Serviciu', en: 'Service', fa: 'خدمت' }),
    ]);
    const terms = {
      labels: { ro: 'Serviciu', en: 'Service', fa: 'خدمت' },
      description: { ro: 'Descriere', en: 'Description', fa: 'شرح' },
      acquisition_mode: 'direct',
      price: { kind: 'fixed', amount: '120.50', currency: 'RON', tax_display: 'included' },
      valid_from: '2026-01-01T00:00:00Z',
      valid_until: null,
      cancellation_terms: { ro: 'Termeni', en: 'Terms', fa: 'شرایط' },
      acceptance_criteria: { ro: 'Criterii', en: 'Criteria', fa: 'معیارها' },
      document_version_ids: [],
    };
    await pool.query(`insert into service_catalog.offerings(
        id,tenant_id,workspace_id,definition_id,provider_party_id,
        current_revision_id,published_revision_id,created_by
      ) values($1,$2,$3,$4,$5,$6,$6,$7)`, [
      offeringId, ids.tenantId, ids.workspaceIds[0], definitionId,
      beneficiaryPartyId, revisionId, actor,
    ]);
    await pool.query(`insert into service_catalog.revisions(
        id,tenant_id,workspace_id,offering_id,commercial_terms,
        valid_from,valid_until,status,created_by
      ) values($1,$2,$3,$4,$5::jsonb,$6,null,'published',$7)`, [
      revisionId, ids.tenantId, ids.workspaceIds[0], offeringId,
      JSON.stringify(terms), terms.valid_from, actor,
    ]);
    await pool.query(`insert into service_catalog.requests(
        id,tenant_id,workspace_id,offering_id,published_revision_id,
        requester_id,membership_id,beneficiary_party_id,description
      ) values($1,$2,$3,$4,$5,$6,$7,$8,'Inactive Core host provider fixture')`, [
      requestId, ids.tenantId, ids.workspaceIds[0], offeringId, revisionId,
      actor, ids.membershipId, beneficiaryPartyId,
    ]);
    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }

  const installServiceAuthority = async () => {
    await pool.query(`insert into platform.workspace_modules(
        tenant_id,customer_workspace_id,module_definition_id,module_code,status,
        valid_from,activated_at,activated_by,reason
      ) values($1,$2,$3,'services_orders','active',statement_timestamp()-interval '1 second',
        statement_timestamp(),$4,'SERVICE Request provider host fixture')`,
    [ids.tenantId, ids.workspaceIds[0], serviceModuleId, actor]);
    await pool.query(`insert into platform.workspace_entitlements(
        customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
      ) values($1,'module.services_orders','boolean',true,statement_timestamp()-interval '1 second')`,
    [ids.workspaceIds[0]]);
    await pool.query(`insert into platform.workspace_roles(
        id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,
        lifecycle_status,created_by,valid_from
      ) select $1,$2,$3,$4,'SERVICE Request provider reader',r.id,'workspace',
        'draft',$5,statement_timestamp()-interval '1 second'
      from identity.roles r
      where r.code='association_admin' and r.tenant_id is null and r.is_system`, [
      serviceRoleId, ids.tenantId, ids.workspaceIds[0],
      `service_request_${randomUUID().replaceAll('-', '').slice(0, 16)}`, actor,
    ]);
    await pool.query(`insert into platform.workspace_role_modules(
        tenant_id,workspace_role_id,module_definition_id
      ) values($1,$2,$3)`, [ids.tenantId, serviceRoleId, serviceModuleId]);
    await pool.query(`insert into platform.workspace_role_permissions(
        tenant_id,workspace_role_id,permission_id,effect
      ) values($1,$2,$3,'allow')`, [ids.tenantId, serviceRoleId, servicePermissionId]);
    await pool.query(`update platform.workspace_roles
      set lifecycle_status='published',lock_version=lock_version+1
      where id=$1 and lifecycle_status='draft'`, [serviceRoleId]);
    await pool.query(`insert into platform.workspace_member_roles(
        id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,
        scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from
      ) values($1,$2,$3,$4,$5,'workspace',$6,$4,
        'SERVICE Request provider host fixture',statement_timestamp()-interval '1 second')`, [
      serviceAssignmentId, ids.tenantId, ids.workspaceIds[0], ids.membershipId,
      serviceRoleId, actor,
    ]);
  };

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
    permission_code: 'services.orders.read',
    module_code: 'services_orders',
    evaluation_purpose: 'service.request.subject_context',
    aggregate_type: 'property',
    aggregate_id: ids.propertyIds[0],
    aggregate_version: ++aggregateVersion,
    provider_source_ids: [requestId],
    idempotency_key: randomUUID(),
    input_fingerprint: 'sha256:0123456789abcdef',
    subject_reference: {
      kind: 'service_request', id: requestId, version: subjectVersion,
      relation: 'request_party', request_version: subjectVersion,
    },
    ...overrides,
  });
  const providers = ({ serializationOnce = false } = {}) => {
    let serializationInjected = false;
    return {
      provider_code: serviceRequestSubjectProviderCodeV2,
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
            query: () => scope.query('select pg_temp.service_request_raise_serialization_v2()'),
          });
          return resolveServiceRequestSubjectProviderV2(failingScope, cmd, authority);
        }
        return resolveServiceRequestSubjectProviderV2(scope, cmd, authority);
      },
      async mutate(scope, cmd) {
        mutations += 1;
        await scope.query('update portfolio.properties set name=$2 where id=$1', [
          cmd.aggregate_id, `SERVICE Request host ${cmd.command_id}`,
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
      (select to_jsonb(r) from service_catalog.requests r where id=$3) request,
      (select to_jsonb(mp) from identity.membership_parties mp where membership_id=$4) party_binding`, [
    ids.tenantId, ids.propertyIds[0], requestId, ids.membershipId,
  ])).rows[0];

  await check('missing services.orders.read/services_orders authority denies before provider with zero effects', async () => {
    const denied = await command();
    const before = await effects();
    const beforeMutations = mutations;
    const result = await host.execute(denied, providers());
    assert.equal(result.status, 'denied');
    assert.equal(result.code, 'AUTHORITY_DENIED');
    assert.equal(result.authority?.decision, 'denied');
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  });

  await installServiceAuthority();

  await check('stale Request version is bounded by provider and writes nothing', async () => {
    const stale = await command({ subjectVersion: 2 });
    const before = await effects();
    const beforeMutations = mutations;
    const result = await host.execute(stale, providers());
    assert.deepEqual(result, { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  });

  await check('revoked beneficiary mapping denies in the same transaction with zero effects', async () => {
    await pool.query(`update identity.membership_parties
      set valid_until=statement_timestamp()-interval '1 second' where membership_id=$1`,
    [ids.membershipId]);
    const denied = await command();
    const before = await effects();
    const beforeMutations = mutations;
    const result = await host.execute(denied, providers());
    assert.deepEqual(result, { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
    await pool.query('update identity.membership_parties set valid_until=null where membership_id=$1',
      [ids.membershipId]);
  });

  const current = await command();
  let committed;
  await check('current own-Request commits strict provider evidence through the real Core host', async () => {
    const beforeMutations = mutations;
    committed = await host.execute(current, providers());
    assert.equal(committed.status, 'committed');
    assert.equal(mutations, beforeMutations + 1);
    assert.equal(committed.receipt.provider_evidence.provider_code, serviceRequestSubjectProviderCodeV2);
    assert.equal(committed.receipt.provider_evidence.decision, 'accepted');
    assert.deepEqual(committed.receipt.subject_reference, current.subject_reference);
  });

  await check('exact replay rechecks current authority and creates no duplicate effect', async () => {
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

  await check('changed subject replay conflicts before provider and writes nothing', async () => {
    const changed = {
      ...current,
      subject_reference: { ...current.subject_reference, version: 2, request_version: 2 },
    };
    const before = await effects();
    const beforeMutations = mutations;
    const beforeProviders = providerCalls;
    const result = await host.execute(changed, providers());
    assert.deepEqual(result, { status: 'denied', code: 'REPLAY_CONFLICT' });
    assert.equal(providerCalls, beforeProviders);
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  });

  await check('stale-after-lock is observed after fresh Core retry and remains zero-write', async () => {
    const writer = await pool.connect();
    let pending;
    try {
      await writer.query('begin');
      await writer.query('select app_private.lock_service_request_version_v1($1,$2,1)', [
        ids.workspaceIds[0], requestId,
      ]);
      await writer.query(`update service_catalog.requests
        set description='Advanced while provider waited',version=2 where id=$1`, [requestId]);
      const stale = await command({ subjectVersion: 1 });
      const before = await effects();
      const beforeMutations = mutations;
      const beforeAuthority = authorityCalls;
      pending = host.execute(stale, providers());
      let waiting = false;
      for (let index = 0; index < 200; index += 1) {
        const state = await pool.query(`select count(*)::int as n from pg_stat_activity
          where datname=current_database() and wait_event_type='Lock'
            and query like '%resolve_service_request_subject_provider_v2%'`);
        if (state.rows[0].n > 0) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true, 'provider must wait on the Request row lock');
      await writer.query('commit');
      const result = await pending;
      assert.deepEqual(result, { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
      assert.ok(authorityCalls > beforeAuthority, 'Core must use a fresh authority check');
      assert.equal(mutations, beforeMutations);
      const after = await effects();
      assert.equal(after.idempotency, before.idempotency);
      assert.equal(after.audit, before.audit);
      assert.equal(after.outbox, before.outbox);
      assert.deepEqual(after.property, before.property);
      assert.equal(Number(after.request.version), 2);
    } finally {
      await writer.query('rollback');
      writer.release();
      if (pending) await pending;
    }
  });

  await check('real 40001 reaches Core and retries with fresh authority and provider state', async () => {
    const retry = await command({ subjectVersion: 2 });
    const beforeMutations = mutations;
    const beforeProviders = providerCalls;
    const beforeAuthority = authorityCalls;
    const result = await host.execute(retry, providers({ serializationOnce: true }));
    assert.equal(result.status, 'committed');
    assert.equal(providerCalls, beforeProviders + 2);
    assert.ok(authorityCalls >= beforeAuthority + 2);
    assert.equal(mutations, beforeMutations + 1);
    assert.equal(result.receipt.authority.transaction_context.attempt, 2);
    assert.equal(result.receipt.provider_evidence.attempt, 2);
  });

  await check('private resolver has no public, authenticated or service-role execution', async () => {
    const acl = await pool.query(`select
      has_function_privilege('public','app_private.resolve_service_request_subject_provider_v2(uuid,uuid,uuid,uuid,bigint)','execute') as public,
      has_function_privilege('anon','app_private.resolve_service_request_subject_provider_v2(uuid,uuid,uuid,uuid,bigint)','execute') as anon,
      has_function_privilege('authenticated','app_private.resolve_service_request_subject_provider_v2(uuid,uuid,uuid,uuid,bigint)','execute') as authenticated,
      has_function_privilege('service_role','app_private.resolve_service_request_subject_provider_v2(uuid,uuid,uuid,uuid,bigint)','execute') as service_role`);
    assert.deepEqual(acl.rows[0], {
      public: false, anon: false, authenticated: false, service_role: false,
    });
  });

  console.log(`SERVICE Request provider through Core TX host: ${passed}/${passed} PASS`);
} finally {
  await pool.end();
}
