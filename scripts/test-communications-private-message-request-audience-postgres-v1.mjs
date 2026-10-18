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
  console.error(`::error title=Communications Request audience Core host regression::${workflowEscape(`${activeCheck}: ${code}: ${message}`)}`);
});

const connectionString = process.env.COMM_REQUEST_AUDIENCE_TEST_DATABASE_URL;
if (!connectionString || process.env.COMM_REQUEST_AUDIENCE_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Communications Request audience target required');
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
  communicationsPrivateMessageRequestAudienceProviderCodeV1,
  resolveCommunicationsPrivateMessageRequestAudienceV1,
} = load(new URL(
  '../src/lib/core/communications-private-message-request-audience-provider-v1.ts', import.meta.url,
));
const {
  resolveCommunicationsPrivateMessageSubjectV1,
} = load(new URL(
  '../src/lib/core/communications-private-message-subject-provider-v1.ts', import.meta.url,
));
const { createAp10CoreAuthorityDriver } = await import('./lib/ap10-core-authority-driver.mjs');

const pool = new pg.Pool({ connectionString, max: 12 });
const host = createCorePostgresTransactionHostV1(pool);
const driver = createAp10CoreAuthorityDriver(pool);
const actor = randomUUID();
const providerUser = randomUUID();
const providerMembershipId = randomUUID();
const conversationId = randomUUID();
const conversationRequestId = randomUUID();
const messageId = randomUUID();
const beneficiaryPartyId = randomUUID();
const providerPartyId = randomUUID();
const unrelatedPartyId = randomUUID();
const vendorId = randomUUID();
const vendorPortalMembershipId = randomUUID();
const definitionId = randomUUID();
const offeringId = randomUUID();
const revisionId = randomUUID();
const requestId = randomUUID();
const samePartyOfferingId = randomUUID();
const samePartyRevisionId = randomUUID();
const samePartyRequestId = randomUUID();
const samePartyConversationId = randomUUID();
const samePartyConversationRequestId = randomUUID();
const samePartyMessageId = randomUUID();
let mutations = 0;
let providerCalls = 0;
let authorityCalls = 0;
let observedBaseEvidenceId = null;
let passed = 0;
const check = async (name, run) => {
  activeCheck = name;
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};

try {
  await pool.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
    actor, `comm-request-actor-${randomUUID()}@example.invalid`,
    providerUser, `comm-request-provider-${randomUUID()}@example.invalid`,
  ]);
  const ids = await driver.setup({ userId: actor, runId: randomUUID(), target: 'local' });
  const systemRole = await pool.query(`select id from identity.roles
    where code='association_admin' and tenant_id is null and is_system`);
  assert.equal(systemRole.rowCount, 1, 'canonical system role required for fixture identities');
  await pool.query('update identity.memberships set role_id=$2 where id=$1', [
    ids.membershipId, systemRole.rows[0].id,
  ]);
  await pool.query(`insert into identity.memberships(
      id,tenant_id,user_id,role_id,status,starts_at
    ) values($1,$2,$3,$4,'active',statement_timestamp()-interval '1 day')`, [
    providerMembershipId, ids.tenantId, providerUser, systemRole.rows[0].id,
  ]);

  await pool.query(`insert into portfolio.parties(id,tenant_id,type,legal_name) values
    ($1,$4,'person','Request beneficiary fixture'),
    ($2,$4,'person','Request provider fixture'),
    ($3,$4,'person','Unrelated audience fixture')`, [
    beneficiaryPartyId, providerPartyId, unrelatedPartyId, ids.tenantId,
  ]);
  await pool.query(`insert into identity.membership_parties(
      membership_id,tenant_id,party_id,valid_from
    ) values($1,$3,$4,statement_timestamp()-interval '1 day'),
      ($2,$3,$5,statement_timestamp()-interval '1 day')`, [
    ids.membershipId, providerMembershipId, ids.tenantId, beneficiaryPartyId, providerPartyId,
  ]);

  await pool.query('begin');
  try {
    await pool.query('set constraints all deferred');
    await pool.query(`insert into service_catalog.definitions(
        id,tenant_id,workspace_id,code,labels
      ) values($1,$2,$3,'comm_request_audience_fixture',$4::jsonb)`, [
      definitionId, ids.tenantId, ids.workspaceIds[0],
      JSON.stringify({ ro: 'Serviciu', en: 'Service', fa: 'خدمت' }),
    ]);
    const terms = {
      labels: { ro: 'Serviciu', en: 'Service', fa: 'خدمت' },
      description: { ro: 'Descriere', en: 'Description', fa: 'شرح' },
      acquisition_mode: 'direct',
      price: { kind: 'fixed', amount: '1.00', currency: 'RON', tax_display: 'included' },
      valid_from: '2026-01-01T00:00:00Z', valid_until: null,
      cancellation_terms: { ro: 'Termeni', en: 'Terms', fa: 'شرایط' },
      acceptance_criteria: { ro: 'Criterii', en: 'Criteria', fa: 'معیارها' },
      document_version_ids: [],
    };
    await pool.query(`insert into service_catalog.offerings(
        id,tenant_id,workspace_id,definition_id,provider_party_id,
        current_revision_id,published_revision_id,created_by
      ) values($1,$2,$3,$4,$5,$6,$6,$7)`, [
      offeringId, ids.tenantId, ids.workspaceIds[0], definitionId,
      providerPartyId, revisionId, actor,
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
      ) values($1,$2,$3,$4,$5,$6,$7,$8,'Communications audience fixture')`, [
      requestId, ids.tenantId, ids.workspaceIds[0], offeringId, revisionId,
      actor, ids.membershipId, beneficiaryPartyId,
    ]);
    await pool.query(`insert into service_catalog.offerings(
        id,tenant_id,workspace_id,definition_id,provider_party_id,
        current_revision_id,published_revision_id,created_by
      ) values($1,$2,$3,$4,$5,$6,$6,$7)`, [
      samePartyOfferingId, ids.tenantId, ids.workspaceIds[0], definitionId,
      beneficiaryPartyId, samePartyRevisionId, actor,
    ]);
    await pool.query(`insert into service_catalog.revisions(
        id,tenant_id,workspace_id,offering_id,commercial_terms,
        valid_from,valid_until,status,created_by
      ) values($1,$2,$3,$4,$5::jsonb,$6,null,'published',$7)`, [
      samePartyRevisionId, ids.tenantId, ids.workspaceIds[0], samePartyOfferingId,
      JSON.stringify(terms), terms.valid_from, actor,
    ]);
    await pool.query(`insert into service_catalog.requests(
        id,tenant_id,workspace_id,offering_id,published_revision_id,
        requester_id,membership_id,beneficiary_party_id,description
      ) values($1,$2,$3,$4,$5,$6,$7,$8,'Same-party audience fixture')`, [
      samePartyRequestId, ids.tenantId, ids.workspaceIds[0], samePartyOfferingId,
      samePartyRevisionId, actor, ids.membershipId, beneficiaryPartyId,
    ]);
    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }

  const installRole = async ({ workspaceId, moduleCode, permissionCode, scope, unitIndex = 0 }) => {
    const canonical = await pool.query(`select d.id as module_id,d.entitlement_key,p.id as permission_id
      from platform.module_definitions d
      join platform.module_permission_bindings b on b.module_definition_id=d.id
        and b.lifecycle_status='active' and b.valid_from<=statement_timestamp()
        and (b.valid_to is null or b.valid_to>statement_timestamp())
      join identity.permissions p on p.id=b.permission_id
      where d.code=$1 and d.is_active and d.lifecycle_status in ('active','published')
        and d.valid_from<=statement_timestamp()
        and (d.valid_to is null or d.valid_to>statement_timestamp()) and p.code=$2`, [
      moduleCode, permissionCode,
    ]);
    assert.equal(canonical.rowCount, 1, `canonical ${moduleCode}/${permissionCode} binding required`);
    const roleId = randomUUID();
    const assignmentId = randomUUID();
    const row = canonical.rows[0];
    await pool.query(`insert into platform.workspace_modules(
        tenant_id,customer_workspace_id,module_definition_id,module_code,status,
        valid_from,activated_at,activated_by,reason
      ) select $1,$2,$3,$4,'active',statement_timestamp()-interval '1 second',
        statement_timestamp(),$5,'Communications Request audience fixture'
      where not exists(select 1 from platform.workspace_modules
        where tenant_id=$1 and customer_workspace_id=$2
          and module_definition_id=$3 and status='active')`, [
      ids.tenantId, workspaceId, row.module_id, moduleCode, actor,
    ]);
    await pool.query(`insert into platform.workspace_entitlements(
        customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from
      ) select $1,$2,'boolean',true,statement_timestamp()-interval '1 second'
      where not exists(select 1 from platform.workspace_entitlements
        where customer_workspace_id=$1 and entitlement_key=$2
          and valid_from<=statement_timestamp()
          and (valid_until is null or valid_until>statement_timestamp()))`, [
      workspaceId, row.entitlement_key,
    ]);
    await pool.query(`insert into platform.workspace_roles(
        id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,
        lifecycle_status,created_by,valid_from
      ) values($1,$2,$3,$4,'Communications Request audience role',$5,'workspace',
        'draft',$6,statement_timestamp()-interval '1 second')`, [
      roleId, ids.tenantId, workspaceId,
      `comm_request_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
      systemRole.rows[0].id, actor,
    ]);
    await pool.query(`insert into platform.workspace_role_modules(
        tenant_id,workspace_role_id,module_definition_id
      ) values($1,$2,$3)`, [ids.tenantId, roleId, row.module_id]);
    await pool.query(`insert into platform.workspace_role_permissions(
        tenant_id,workspace_role_id,permission_id,effect
      ) values($1,$2,$3,'allow')`, [ids.tenantId, roleId, row.permission_id]);
    await pool.query(`update platform.workspace_roles
      set lifecycle_status='published',lock_version=lock_version+1 where id=$1`, [roleId]);
    if (scope === 'workspace') {
      await pool.query(`insert into platform.workspace_member_roles(
          id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,
          scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from
        ) values($1,$2,$3,$4,$5,'workspace',$6,$4,
          'Communications Request audience fixture',statement_timestamp()-interval '1 second')`, [
        assignmentId, ids.tenantId, workspaceId, ids.membershipId, roleId, actor,
      ]);
    } else {
      await pool.query(`insert into platform.workspace_member_roles(
          id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,
          scope_type,property_id,building_id,unit_id,assigned_by_user_id,
          assigned_by_membership_id,reason,valid_from
        ) values($1,$2,$3,$4,$5,'unit',$6,$7,$8,$9,$4,
          'Communications Request audience fixture',statement_timestamp()-interval '1 second')`, [
        assignmentId, ids.tenantId, workspaceId, ids.membershipId, roleId,
        ids.propertyIds[unitIndex > 1 ? 1 : 0], ids.buildingIds[unitIndex > 1 ? 1 : 0],
        ids.unitIds[unitIndex], actor,
      ]);
    }
  };

  // Test-only registration of the shared integration profile. Production
  // ownership and activation stay outside this inactive provider package.
  await pool.query(`insert into identity.permissions(code,resource,action,description)
    values('services.orders.subject_link','services.orders','subject_link',
      'Link an authorized subject to a service Request transaction')
    on conflict(code) do nothing`);
  await pool.query(`insert into platform.module_permission_bindings(
      module_definition_id,permission_id,permission_mode,is_delegable,requires_aal2
    ) select m.id,p.id,'manage',false,true
      from platform.module_definitions m cross join identity.permissions p
      where m.code='services_orders' and m.version=1
        and p.code='services.orders.subject_link'
        and not exists(select 1 from platform.module_permission_bindings b
          where b.module_definition_id=m.id and b.permission_id=p.id
            and b.lifecycle_status='active'
            and b.valid_from<=statement_timestamp()
            and (b.valid_to is null or b.valid_to>statement_timestamp()))
    on conflict(module_definition_id,permission_id,binding_version) do nothing`);

  await installRole({
    workspaceId: ids.workspaceIds[0], moduleCode: 'communications',
    permissionCode: 'communications.feed.read', scope: 'unit', unitIndex: 0,
  });
  await installRole({
    workspaceId: ids.workspaceIds[0], moduleCode: 'services_orders',
    permissionCode: 'services.orders.read', scope: 'workspace',
  });
  await installRole({
    workspaceId: ids.workspaceIds[0], moduleCode: 'services_orders',
    permissionCode: 'services.orders.subject_link', scope: 'workspace',
  });
  await installRole({
    workspaceId: ids.workspaceIds[1], moduleCode: 'services_orders',
    permissionCode: 'services.orders.read', scope: 'workspace',
  });
  await installRole({
    workspaceId: ids.workspaceIds[1], moduleCode: 'services_orders',
    permissionCode: 'services.orders.subject_link', scope: 'workspace',
  });

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
    select $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid from writer_marker`, [
    conversationId, ids.tenantId, ids.workspaceIds[0], ids.unitIds[0],
    ids.membershipId, conversationRequestId,
  ]);
  await pool.query(`insert into communications.private_participants(conversation_id,membership_id)
    values($1,$2),($1,$3)`, [conversationId, ids.membershipId, providerMembershipId]);
  await pool.query(`insert into communications.private_messages(
      id,conversation_id,sender_id,client_request_id,body
    ) values($1,$2,$3,$4,'Private audience fixture body')`, [
    messageId, conversationId, ids.membershipId, randomUUID(),
  ]);
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
    select $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid from writer_marker`, [
    samePartyConversationId, ids.tenantId, ids.workspaceIds[0], ids.unitIds[0],
    ids.membershipId, samePartyConversationRequestId,
  ]);
  await pool.query(`insert into communications.private_participants(conversation_id,membership_id)
    values($1,$2)`, [samePartyConversationId, ids.membershipId]);
  await pool.query(`insert into communications.private_messages(
      id,conversation_id,sender_id,client_request_id,body
    ) values($1,$2,$3,$4,'Same-party private audience fixture body')`, [
    samePartyMessageId, samePartyConversationId, ids.membershipId, randomUUID(),
  ]);
  await pool.query(`insert into maintenance.vendors(id,tenant_id,party_id,status)
    values($1,$2,$3,'approved')`, [vendorId, ids.tenantId, unrelatedPartyId]);
  await pool.query(`insert into maintenance.vendor_portal_memberships(
      id,tenant_id,vendor_id,membership_id,status,verified_by
    ) values($1,$2,$3,$4,'invited',$5)`, [
    vendorPortalMembershipId, ids.tenantId, vendorId, providerMembershipId, actor,
  ]);

  const revision = async () => Number((await pool.query(
    'select revision::text from app_private.canonical_authority_revision_v1 where singleton',
  )).rows[0].revision);
  const command = async ({ workspaceId = ids.workspaceIds[0], messageVersion = 1,
    resultVersion = 2, aggregateId = requestId, subjectMessageId = messageId,
    ...overrides } = {}) => ({
    contract_version: 'core-transaction-command.v2',
    transaction_id: randomUUID(), command_id: randomUUID(),
    context_id: ids.contextId, workspace_id: workspaceId, actor_id: actor,
    authority_version: await revision(), permission_code: 'services.orders.subject_link',
    module_code: 'services_orders', evaluation_purpose: 'service.request.subject_link',
    aggregate_type: 'service_request', aggregate_id: aggregateId,
    aggregate_version: resultVersion, provider_source_ids: [subjectMessageId],
    idempotency_key: randomUUID(), input_fingerprint: 'sha256:0123456789abcdef',
    subject_reference: {
      kind: 'message', id: subjectMessageId, version: messageVersion,
      relation: 'subject_link', request_version: messageVersion,
    },
    ...overrides,
  });
  const providers = ({ captureBaseEvidence = false } = {}) => ({
      provider_code: communicationsPrivateMessageRequestAudienceProviderCodeV1,
      async resolveAuthority(scope, request) {
        authorityCalls += 1;
        await scope.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
          sub: actor, role: 'authenticated', aal: 'aal2',
        })]);
        return resolveAuthority(scope, request);
      },
      async validateProviders(scope, cmd, authority) {
        providerCalls += 1;
        if (captureBaseEvidence) {
          const baseEvidence = await resolveCommunicationsPrivateMessageSubjectV1(
            scope, cmd, authority,
          );
          observedBaseEvidenceId = baseEvidence.evidence_id;
        }
        return resolveCommunicationsPrivateMessageRequestAudienceV1(scope, cmd, authority);
      },
      async mutate(_scope, cmd) {
        mutations += 1;
        return { mutation_id: cmd.aggregate_id };
      },
    });
  const effects = async () => (await pool.query(`select
      (select count(*)::int from platform.idempotency_keys where tenant_id=$1) idempotency,
      (select count(*)::int from audit.events where tenant_id=$1) audit,
      (select count(*)::int from platform.outbox_events where tenant_id=$1) outbox,
      (select to_jsonb(r) from service_catalog.requests r where id=$2) request,
      (select to_jsonb(m) - 'body' from communications.private_messages m where id=$3) message`, [
    ids.tenantId, requestId, messageId,
  ])).rows[0];
  const expectZeroWriteDenial = async (cmd, expectedProviderDelta = 1) => {
    const before = await effects();
    const beforeMutations = mutations;
    const beforeProviders = providerCalls;
    const result = await host.execute(cmd, providers());
    assert.deepEqual(result, { status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
    assert.equal(providerCalls, beforeProviders + expectedProviderDelta);
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  };

  const acceptedCommand = await command();
  let committed;
  await check('beneficiary and provider audience commits status-only evidence through the real Core host', async () => {
    const beforeMutations = mutations;
    committed = await host.execute(acceptedCommand, providers({ captureBaseEvidence: true }));
    assert.equal(committed.status, 'committed');
    assert.equal(mutations, beforeMutations + 1);
    assert.equal(committed.receipt.provider_evidence.provider_code,
      communicationsPrivateMessageRequestAudienceProviderCodeV1);
    assert.equal(committed.receipt.provider_evidence.decision, 'accepted');
    assert.equal(committed.receipt.authority.permission_code, 'services.orders.subject_link');
    assert.equal(committed.receipt.authority.module_code, 'services_orders');
    assert.equal(committed.receipt.authority.evaluation_purpose, 'service.request.subject_link');
    assert.ok(observedBaseEvidenceId);
    assert.notEqual(committed.receipt.provider_evidence.evidence_id, observedBaseEvidenceId);
    const evidence = JSON.stringify(committed.receipt.provider_evidence);
    for (const forbidden of [
      'body', 'sender_id', 'conversation_id', 'unit_id', 'membership_id', 'participant',
      beneficiaryPartyId, providerPartyId, ids.membershipId, providerMembershipId,
    ]) assert.equal(evidence.includes(forbidden), false, forbidden);
  });

  await check('beneficiary-only audience denies with zero durable write', async () => {
    await pool.query(`update communications.private_participants
      set joined_at=(select sent_at+interval '1 second'
        from communications.private_messages where id=$2)
      where conversation_id=$1 and membership_id=$3`, [
      conversationId, messageId, providerMembershipId,
    ]);
    await expectZeroWriteDenial(await command());
    await pool.query(`update communications.private_participants
      set joined_at=(select sent_at-interval '1 second'
        from communications.private_messages where id=$2)
      where conversation_id=$1 and membership_id=$3`, [
      conversationId, messageId, providerMembershipId,
    ]);
  });

  await check('provider-only audience denies with zero durable write', async () => {
    await pool.query(`update communications.private_participants
      set joined_at=(select sent_at+interval '1 second'
        from communications.private_messages where id=$2)
      where conversation_id=$1 and membership_id=$3`, [
      conversationId, messageId, ids.membershipId,
    ]);
    await expectZeroWriteDenial(await command());
    await pool.query(`update communications.private_participants
      set joined_at=(select sent_at-interval '1 second'
        from communications.private_messages where id=$2)
      where conversation_id=$1 and membership_id=$3`, [
      conversationId, messageId, ids.membershipId,
    ]);
  });

  await check('one audience identity is sufficient when beneficiary and provider party IDs match', async () => {
    const result = await host.execute(await command({
      aggregateId: samePartyRequestId,
      subjectMessageId: samePartyMessageId,
    }), providers());
    assert.equal(result.status, 'committed');
    assert.equal(result.receipt.provider_evidence.decision, 'accepted');
  });

  await check('exact replay rechecks authority and adds no durable write', async () => {
    const before = await effects();
    const beforeMutations = mutations;
    const beforeProviders = providerCalls;
    const beforeAuthority = authorityCalls;
    const replay = await host.execute(acceptedCommand, providers());
    assert.equal(replay.status, 'exact_replay');
    assert.deepEqual(replay.receipt, committed.receipt);
    assert.ok(authorityCalls > beforeAuthority);
    assert.equal(providerCalls, beforeProviders);
    assert.equal(mutations, beforeMutations);
    assert.deepEqual(await effects(), before);
  });

  await check('unrelated current participant party denies with zero durable write', async () => {
    await pool.query('update identity.membership_parties set party_id=$2 where membership_id=$1', [
      providerMembershipId, unrelatedPartyId,
    ]);
    await expectZeroWriteDenial(await command());
    await pool.query('update identity.membership_parties set party_id=$2 where membership_id=$1', [
      providerMembershipId, providerPartyId,
    ]);
  });

  await check('revoked message participant denies with zero durable write', async () => {
    await pool.query(`update communications.private_participants
      set revoked_at=clock_timestamp() where conversation_id=$1 and membership_id=$2`, [
      conversationId, providerMembershipId,
    ]);
    await expectZeroWriteDenial(await command());
    await pool.query(`update communications.private_participants set revoked_at=null
      where conversation_id=$1 and membership_id=$2`, [conversationId, providerMembershipId]);
  });

  await check('missing participant-party mapping denies with zero durable write', async () => {
    await pool.query('delete from identity.membership_parties where membership_id=$1', [providerMembershipId]);
    await expectZeroWriteDenial(await command());
    await pool.query(`insert into identity.membership_parties(
        membership_id,tenant_id,party_id,valid_from
      ) values($1,$2,$3,statement_timestamp()-interval '1 day')`, [
      providerMembershipId, ids.tenantId, providerPartyId,
    ]);
  });

  await check('ambiguous canonical party mappings deny with zero durable write', async () => {
    await pool.query(`update maintenance.vendor_portal_memberships
      set status='active',accepted_at=(select sent_at-interval '1 second'
        from communications.private_messages where id=$2),revoked_at=null where id=$1`, [
      vendorPortalMembershipId, messageId,
    ]);
    await expectZeroWriteDenial(await command());
    await pool.query(`update maintenance.vendor_portal_memberships
      set status='revoked',revoked_at=clock_timestamp() where id=$1`, [vendorPortalMembershipId]);
  });

  await check('stale message version denies with zero durable write', async () => {
    await expectZeroWriteDenial(await command({ messageVersion: 2 }));
  });

  await check('stale Request version is bounded and writes nothing', async () => {
    await expectZeroWriteDenial(await command({ resultVersion: 3 }));
  });

  await check('cross-Workspace command reaches the provider and denies with zero durable write', async () => {
    await expectZeroWriteDenial(await command({ workspaceId: ids.workspaceIds[1] }));
  });

  await check('private audience resolver has no public or API-role execution grant', async () => {
    const acl = await pool.query(`select
      has_function_privilege('public','communications.resolve_private_message_request_audience_current_v2(uuid,uuid,uuid,uuid,bigint,uuid,bigint)','execute') as public,
      has_function_privilege('anon','communications.resolve_private_message_request_audience_current_v2(uuid,uuid,uuid,uuid,bigint,uuid,bigint)','execute') as anon,
      has_function_privilege('authenticated','communications.resolve_private_message_request_audience_current_v2(uuid,uuid,uuid,uuid,bigint,uuid,bigint)','execute') as authenticated,
      has_function_privilege('service_role','communications.resolve_private_message_request_audience_current_v2(uuid,uuid,uuid,uuid,bigint,uuid,bigint)','execute') as service_role`);
    assert.deepEqual(acl.rows[0], {
      public: false, anon: false, authenticated: false, service_role: false,
    });
  });

  console.log(`Communications Request audience through Core TX host: ${passed}/${passed} PASS`);
} finally {
  await pool.end();
}
