import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const moduleCache = new Map();
function load(url) {
  if (moduleCache.has(url.href)) return moduleCache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  moduleCache.set(url.href, loaded.exports);
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url))
    : require(name), loaded, loaded.exports);
  return loaded.exports;
}

const connectionString = process.env.CE_GUIDE_LIFECYCLE_TEST_DATABASE_URL;
if (!connectionString || process.env.CE_GUIDE_LIFECYCLE_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable CE Guide PostgreSQL target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || !['/postgres', '/ce_guide_lifecycle_test'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

const pool = new pg.Pool({ connectionString, max: 12 });
const lifecycle = load(new URL(
  '../src/lib/community/experience-guide-lifecycle-provider-v1.ts', import.meta.url,
));
const { createCorePostgresTransactionHostV1 } = load(new URL(
  '../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url,
));
const { resolveAuthority } = load(new URL(
  '../src/lib/core/current-authority-postgres-provider-v1.ts', import.meta.url,
));
const host = createCorePostgresTransactionHostV1(pool);
const actor = randomUUID();
const ids = {
  tenantId: randomUUID(),
  membershipId: randomUUID(),
  contextId: randomUUID(),
  workspaceIds: [randomUUID(), randomUUID()],
  propertyIds: [randomUUID(), randomUUID()],
};
let checks = 0;
const calls = { authority: 0, validation: 0, replay: 0, mutation: 0 };

const check = async (name, operation) => {
  await operation();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
};
const revision = async () => Number((await pool.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton',
)).rows[0].revision);
const command = async (guideId, action, expectedVersion, overrides = {}) => {
  const transactionId = randomUUID();
  const commandId = randomUUID();
  const relation = action;
  const purpose = `experience.guide.${action}`;
  const fingerprint = createHash('sha256').update(JSON.stringify({
    guideId, action, expectedVersion, transactionId, commandId,
  })).digest('hex');
  return {
    contract_version: 'core-transaction-command.v2',
    transaction_id: transactionId,
    command_id: commandId,
    context_id: ids.contextId,
    workspace_id: ids.workspaceIds[0],
    actor_id: actor,
    authority_version: await revision(),
    permission_code: 'experience.guide.manage',
    module_code: 'experience_guides',
    evaluation_purpose: purpose,
    aggregate_type: 'experience_guide',
    aggregate_id: guideId,
    aggregate_version: expectedVersion + 1,
    provider_source_ids: [guideId],
    idempotency_key: randomUUID(),
    input_fingerprint: `ceg1:${fingerprint}`,
    subject_reference: {
      kind: 'experience.guide', id: guideId, version: expectedVersion,
      relation, request_version: 1,
    },
    ...overrides,
  };
};
const referenceSourceLocks = (guideId, references) => [guideId,
  ...references.flatMap(reference => [reference.documentId, reference.versionId])];
const providers = (options = {}) => ({
  provider_code: lifecycle.experienceGuideLifecycleProviderCodeV1,
  replay_policy: lifecycle.experienceGuideLifecycleReplayPolicyV1,
  async resolveAuthority(scope, request) {
    calls.authority += 1;
    await scope.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
      sub: actor, role: 'authenticated', aal: 'aal2',
    })]);
    return resolveAuthority(scope, request);
  },
  async validateProviders(scope, ...args) {
    calls.validation += 1;
    options.validationAttempts?.push(scope.attempt);
    try {
      return await lifecycle.validateExperienceGuideLifecycleV1(scope, ...args);
    } catch (error) {
      if (error?.code) options.validationErrorCodes?.push(error.code);
      throw error;
    }
  },
  async validateReplay(scope, ...args) {
    calls.replay += 1;
    options.replayAttempts?.push(scope.attempt);
    if (options.replayEntered && scope.attempt === 1) options.replayEntered();
    try {
      return await lifecycle.validateExperienceGuideLifecycleReplayV1(scope, ...args);
    } catch (error) {
      if (error?.code) options.replayErrorCodes?.push(error.code);
      throw error;
    }
  },
  async mutate(scope, value) {
    calls.mutation += 1;
    const mutation = await lifecycle.mutateExperienceGuideLifecycleV1(scope, value);
    if (options.failAfterMutation) throw new Error('synthetic failure after Guide update');
    if (options.serializationOnce && scope.attempt === 1) {
      throw Object.assign(new Error('synthetic serialization retry'), { code: '40001' });
    }
    return mutation;
  },
});
const insertGuide = async (workspaceId = ids.workspaceIds[0], status = 'draft') => {
  const guideId = randomUUID();
  await pool.query(`insert into experience.guides
    (id,tenant_id,workspace_id,title,audience,status,version,content_version,created_by)
    values($1,$2,$3,'Private synthetic Guide','{"kind":"workspace"}'::jsonb,$4,1,1,$5)`,
  [guideId, ids.tenantId, workspaceId, status, actor]);
  return guideId;
};
const state = async (guideId) => (await pool.query(`select status,version::int,content_version::int,
  title,audience from experience.guides where id=$1`, [guideId])).rows[0];
const effects = async (value) => (await pool.query(`select
  (select count(*)::int from platform.idempotency_keys where tenant_id=$1 and key=$2) idempotency,
  (select count(*)::int from audit.events where tenant_id=$1 and request_id=$3) audit,
  (select count(*)::int from platform.outbox_events where tenant_id=$1 and trace_id=$3) outbox`,
[ids.tenantId, `core-tx.v1:${value.workspace_id}:${value.idempotency_key}`, value.command_id])).rows[0];
const durableDigest = async (value) => (await pool.query(`select
  (select count(*)::int from platform.idempotency_keys where tenant_id=$1 and key=$2) idempotency,
  (select xmin::text from platform.idempotency_keys where tenant_id=$1 and key=$2) idempotency_xmin,
  (select md5(response_ref::text) from platform.idempotency_keys where tenant_id=$1 and key=$2) receipt_hash,
  (select count(*)::int from audit.events where tenant_id=$1 and request_id=$3) audit,
  (select count(*)::int from platform.outbox_events where tenant_id=$1 and trace_id=$3) outbox,
  (select row_to_json(g)::text from (select status,version,content_version
    from experience.guides where id=$4) g) guide_state`,
[ids.tenantId, `core-tx.v1:${value.workspace_id}:${value.idempotency_key}`,
  value.command_id, value.aggregate_id])).rows[0];
const zeroWrite = async (value, expectedCode) => {
  const before = await state(value.aggregate_id);
  const result = await host.execute(value, providers());
  assert.equal(result.status, 'denied');
  if (expectedCode) assert.equal(result.code, expectedCode);
  assert.deepEqual(await effects(value), { idempotency: 0, audit: 0, outbox: 0 });
  assert.deepEqual(await state(value.aggregate_id), before);
  return result;
};
const replayZeroWrite = async (value, expectedCode, provider = providers()) => {
  const before = await durableDigest(value);
  const beforeCalls = { validation: calls.validation, mutation: calls.mutation };
  const result = await host.execute(value, provider);
  assert.equal(result.status, 'denied');
  assert.equal(result.code, expectedCode);
  assert.deepEqual(await durableDigest(value), before);
  assert.equal(calls.validation, beforeCalls.validation);
  assert.equal(calls.mutation, beforeCalls.mutation);
  return result;
};

async function bootstrapDisposablePostgres() {
  const installed = await pool.query("select to_regclass('experience.guides')::text as guide");
  if (installed.rows[0].guide !== null) return;
  await pool.query(`
    do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
    create schema auth; create schema identity; create schema platform; create schema portfolio;
    create schema app_private; create schema customer_api; create schema audit; create schema documents;
    create schema communications;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt()->>'sub')::uuid
    $$;
    create function app_private.customer_mfa_required() returns boolean
      language sql stable as $$ select false $$;

    create table auth.users(
      id uuid primary key,instance_id uuid,aud text,role text,email text,
      created_at timestamptz,updated_at timestamptz
    );
    create table platform.tenants(
      id uuid primary key,legal_name text,registration_number text,status text
    );
    create table platform.customer_workspaces(
      id uuid primary key,tenant_id uuid not null references platform.tenants(id),
      workspace_type text,commercial_owner text,environment text,lifecycle_status text,
      version integer default 1,created_at timestamptz default now(),updated_at timestamptz default now(),
      activated_at timestamptz,suspended_at timestamptz,terminated_at timestamptz,archived_at timestamptz,
      unique(id,tenant_id)
    );
    create table identity.roles(
      id uuid primary key,tenant_id uuid,code text not null,is_system boolean default false
    );
    create table identity.memberships(
      id uuid primary key,tenant_id uuid not null,user_id uuid not null,role_id uuid,
      status text not null,starts_at timestamptz not null,ends_at timestamptz
    );
    create table identity.context_grants(
      id uuid primary key,membership_id uuid not null,tenant_id uuid not null,scope_type text not null,
      property_id uuid,building_id uuid,unit_id uuid,starts_at timestamptz not null,ends_at timestamptz
    );
    create table identity.permissions(
      id uuid primary key default gen_random_uuid(),code text not null unique,
      resource text,action text,description text
    );
    create table identity.role_permissions(
      role_id uuid not null,permission_id uuid not null,effect text not null,
      unique(role_id,permission_id)
    );
    create table platform.module_definitions(
      id uuid primary key default gen_random_uuid(),code text not null,version integer not null,
      name text,labels_json jsonb,description text,category text,is_active boolean,
      lifecycle_status text,sensitivity_level text,requires_aal2 boolean,entitlement_key text,
      config_schema jsonb default '{}'::jsonb,default_config jsonb default '{}'::jsonb,
      published_at timestamptz,valid_from timestamptz default now(),valid_to timestamptz,
      created_at timestamptz default now(),updated_at timestamptz default now(),unique(code,version)
    );
    create table platform.module_permission_bindings(
      id uuid primary key default gen_random_uuid(),module_definition_id uuid not null,
      permission_id uuid not null,binding_version integer default 1,permission_mode text,
      is_assignable_to_local_role boolean,is_delegable boolean,requires_aal2 boolean,
      lifecycle_status text,valid_from timestamptz default now(),valid_to timestamptz,
      unique(module_definition_id,permission_id,binding_version)
    );
    create table platform.workspace_modules(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,customer_workspace_id uuid,
      module_definition_id uuid,module_code text,status text,valid_from timestamptz,valid_to timestamptz,
      activated_at timestamptz,activated_by uuid,reason text
    );
    create table platform.workspace_entitlements(
      id uuid primary key default gen_random_uuid(),customer_workspace_id uuid,entitlement_key text,
      value_type text,boolean_value boolean,numeric_value numeric,override_value_json jsonb,
      override_expires_at timestamptz,valid_from timestamptz,valid_until timestamptz,
      unique(customer_workspace_id,entitlement_key)
    );
    create table platform.workspace_roles(
      id uuid primary key,tenant_id uuid,customer_workspace_id uuid,code text,role_version integer default 1,
      lock_version integer default 1,name text,base_role_id uuid,scope_ceiling text,lifecycle_status text,
      valid_from timestamptz,valid_to timestamptz,created_by uuid,created_at timestamptz default now()
    );
    create table platform.workspace_role_modules(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,workspace_role_id uuid,
      module_definition_id uuid,unique(workspace_role_id,module_definition_id)
    );
    create table platform.workspace_role_permissions(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,workspace_role_id uuid,
      permission_id uuid,effect text,unique(workspace_role_id,permission_id)
    );
    create table platform.workspace_member_roles(
      id uuid primary key,tenant_id uuid,customer_workspace_id uuid,membership_id uuid,
      workspace_role_id uuid,scope_type text,property_id uuid,building_id uuid,unit_id uuid,
      assigned_by_user_id uuid,assigned_by_membership_id uuid,reason text,
      valid_from timestamptz,valid_to timestamptz
    );
    create table platform.property_profiles(id uuid primary key,code text,version integer);
    create table platform.operating_models(id uuid primary key,code text,version integer);
    create table platform.workspace_taxonomy_assignments(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,customer_workspace_id uuid,
      property_profile_id uuid,operating_model_id uuid,status text,valid_from timestamptz,
      valid_to timestamptz,notes text,created_by uuid
    );
    create table platform.module_property_profile_compatibilities(
      id uuid primary key default gen_random_uuid(),module_definition_id uuid,property_profile_id uuid,
      compatibility_level text,reason text,unique(module_definition_id,property_profile_id)
    );
    create table platform.module_operating_model_compatibilities(
      id uuid primary key default gen_random_uuid(),module_definition_id uuid,operating_model_id uuid,
      compatibility_level text,reason text,unique(module_definition_id,operating_model_id)
    );
    create table platform.workspace_property_bindings(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,customer_workspace_id uuid,
      property_id uuid,status text,binding_source text,valid_from timestamptz default now(),
      valid_to timestamptz,created_by uuid
    );
    create table platform.workspace_delegations(
      id uuid primary key,tenant_id uuid,customer_workspace_id uuid,grantee_membership_id uuid,
      grantor_membership_id uuid,lifecycle_status text,valid_from timestamptz,valid_until timestamptz,
      scope_type text,property_id uuid,building_id uuid,unit_id uuid
    );
    create table platform.workspace_delegation_permissions(
      id uuid primary key,delegation_id uuid,module_permission_binding_id uuid,
      module_definition_id uuid,permission_id uuid
    );
    create table platform.workspace_member_role_authority_sources(id uuid primary key);
    create table portfolio.properties(
      id uuid primary key,tenant_id uuid,type text,name text,status text
    );
    create table portfolio.buildings(id uuid primary key,tenant_id uuid,property_id uuid);
    create table portfolio.units(
      id uuid primary key,tenant_id uuid,building_id uuid,status text default 'active'
    );
    create table platform.idempotency_keys(
      tenant_id uuid,actor_id uuid,key text,request_hash text,response_ref jsonb,
      status_code integer,created_at timestamptz default now(),expires_at timestamptz,
      primary key(tenant_id,key)
    );
    create table audit.events(
      id bigint generated always as identity primary key,tenant_id uuid,actor_id uuid,
      action text,entity_type text,entity_id uuid,request_id uuid,after_snapshot jsonb
    );
    create table platform.outbox_events(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,aggregate_type text,
      aggregate_id uuid,aggregate_version bigint,event_type text,payload jsonb,trace_id uuid,
      unique(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type)
    );
    create table documents.documents(
      id uuid primary key,tenant_id uuid,workspace_id uuid,property_id uuid,title text,
      document_type text,classification text,current_version integer default 1,status text default 'active',
      archived_at timestamptz,deleted_at timestamptz,
      disposition_status text default 'retained'
    );
    create table documents.document_versions(
      id uuid primary key,tenant_id uuid,document_id uuid,version integer,object_path text,
      sha256 text,mime_type text,scanning_status text,checksum_status text
    );
    create table documents.access_events(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,document_id uuid
    );
    create table documents.document_links(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,document_id uuid,
      entity_type text,entity_id uuid
    );
    create table documents.document_audit_links(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,document_id uuid
    );
    create table documents.document_permissions(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,document_id uuid,
      membership_id uuid,permission text,valid_from timestamptz,valid_until timestamptz
    );
    create table documents.document_scan_attestations(
      id uuid primary key default gen_random_uuid(),tenant_id uuid,version_id uuid,
      provider text,scan_id uuid,verdict text,content_sha256 text,engine_version text,
      scanned_at timestamptz,recorded_at timestamptz default statement_timestamp()
    );
    create function documents.customer_document_scope_matches(
      p_scope text,p_property uuid,p_building uuid,p_unit uuid,p_target_property uuid
    ) returns boolean language sql stable as $$ select case p_scope
      when 'tenant' then true when 'property' then p_property=p_target_property
      else false end $$;
    create function communications.member_covers_unit(uuid,uuid,uuid)
      returns boolean language sql stable as $$ select false $$;
    create function communications.context_covers_unit(uuid,uuid)
      returns boolean language sql stable as $$ select false $$;
    create function app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)
      returns table(workspace_id uuid,tenant_id uuid,membership_id uuid)
      language sql stable as $$ select null::uuid,null::uuid,null::uuid where false $$;
  `);
  for (const filename of [
    '20261003151649_20261003122445_workspace_native_context_authority_v2.sql',
    '20261012190924_core_canonical_authority_revision_v1.sql',
    '20261014082947_experience_guide_storage_lifecycle_v1.sql',
  ]) {
    await pool.query(readFileSync(new URL(`../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
  }
}

async function setupCanonicalFixture() {
  let baseRole = (await pool.query(`select id from identity.roles
    where code='association_admin' and tenant_id is null`)).rows[0];
  if (!baseRole) {
    baseRole = { id: randomUUID() };
    await pool.query(`insert into identity.roles(id,tenant_id,code,is_system)
      values($1,null,'association_admin',true)`, [baseRole.id]);
  }
  let taxonomy = (await pool.query(`select p.id property_profile_id,o.id operating_model_id
    from platform.property_profiles p cross join platform.operating_models o
    where p.code='residential_condominium' and p.version=1
      and o.code='association_managed' and o.version=1 limit 1`)).rows[0];
  if (!taxonomy) {
    taxonomy = { property_profile_id: randomUUID(), operating_model_id: randomUUID() };
    await pool.query(`insert into platform.property_profiles(id,code,version)
      values($1,'residential_condominium',1)`, [taxonomy.property_profile_id]);
    await pool.query(`insert into platform.operating_models(id,code,version)
      values($1,'association_managed',1)`, [taxonomy.operating_model_id]);
  }
  await pool.query(`insert into platform.tenants(id,legal_name,registration_number,status)
    values($1,'CE Guide disposable tenant',$2,'active')`, [ids.tenantId, `CEG-${randomUUID()}`]);
  for (let index = 0; index < ids.workspaceIds.length; index += 1) {
    await pool.query(`insert into platform.customer_workspaces
      (id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status,activated_at)
      values($1,$2,'OWNER_PORTFOLIO','CE Guide disposable','PILOT','ACTIVE',statement_timestamp())`,
    [ids.workspaceIds[index], ids.tenantId]);
    await pool.query(`insert into portfolio.properties(id,tenant_id,type,name,status)
      values($1,$2,'condominium',$3,'active')`,
    [ids.propertyIds[index], ids.tenantId, `CE Guide property ${index + 1}`]);
    await pool.query(`insert into platform.workspace_property_bindings
      (tenant_id,customer_workspace_id,property_id,status,binding_source,created_by)
      values($1,$2,$3,'active','platform_assignment',$4)`,
    [ids.tenantId, ids.workspaceIds[index], ids.propertyIds[index], actor]);
    await pool.query(`insert into platform.workspace_taxonomy_assignments
      (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,
        valid_from,notes,created_by)
      values($1,$2,$3,$4,'active',statement_timestamp()-interval '1 second',
        'CE Guide disposable taxonomy',$5)`,
    [ids.tenantId, ids.workspaceIds[index], taxonomy.property_profile_id,
      taxonomy.operating_model_id, actor]);
  }
  await pool.query(`insert into identity.memberships
    (id,tenant_id,user_id,role_id,status,starts_at)
    values($1,$2,$3,$4,'active',statement_timestamp()-interval '1 second')`,
  [ids.membershipId, ids.tenantId, actor, baseRole.id]);
  await pool.query(`insert into identity.context_grants
    (id,membership_id,tenant_id,scope_type,starts_at)
    values($1,$2,$3,'tenant',statement_timestamp()-interval '1 second')`,
  [ids.contextId, ids.membershipId, ids.tenantId]);
  return { baseRole, taxonomy };
}

async function installGuideAuthority() {
  const baseRole = (await pool.query(`select id from identity.roles
    where code='association_admin' and tenant_id is null and is_system`)).rows[0];
  assert.ok(baseRole);
  await pool.query(`insert into identity.permissions(code,resource,action,description)
    values('experience.guide.manage','experience.guide','manage','Disposable Guide lifecycle authority')
    on conflict(code) do nothing`);
  await pool.query(`insert into platform.module_definitions
    (code,version,name,labels_json,description,category,is_active,lifecycle_status,
      sensitivity_level,requires_aal2,entitlement_key,published_at)
    values('experience_guides',1,'Experience Guides',
      '{"ro":"Ghiduri","en":"Guides","fa":"راهنماها"}'::jsonb,
      'Disposable CE Guide lifecycle authority','services',true,'published','sensitive',true,
      'module.experience_guides',statement_timestamp())
    on conflict(code,version) do nothing`);
  const moduleDefinition = (await pool.query(`select id,entitlement_key from platform.module_definitions
    where code='experience_guides' and version=1`)).rows[0];
  const permission = (await pool.query(`select id from identity.permissions
    where code='experience.guide.manage'`)).rows[0];
  await pool.query(`insert into platform.module_permission_bindings
    (module_definition_id,permission_id,permission_mode,is_assignable_to_local_role,
      is_delegable,requires_aal2,lifecycle_status)
    values($1,$2,'manage',true,false,true,'active') on conflict do nothing`,
  [moduleDefinition.id, permission.id]);
  await pool.query(`insert into platform.module_property_profile_compatibilities
    (module_definition_id,property_profile_id,compatibility_level,reason)
    select distinct $1::uuid,t.property_profile_id,'compatible','Disposable Guide lifecycle authority'
    from platform.workspace_taxonomy_assignments t where t.customer_workspace_id=any($2::uuid[])
    on conflict(module_definition_id,property_profile_id) do nothing`,
  [moduleDefinition.id, ids.workspaceIds]);
  await pool.query(`insert into platform.module_operating_model_compatibilities
    (module_definition_id,operating_model_id,compatibility_level,reason)
    select distinct $1::uuid,t.operating_model_id,'compatible','Disposable Guide lifecycle authority'
    from platform.workspace_taxonomy_assignments t where t.customer_workspace_id=any($2::uuid[])
    on conflict(module_definition_id,operating_model_id) do nothing`,
  [moduleDefinition.id, ids.workspaceIds]);
  for (let index = 0; index < ids.workspaceIds.length; index += 1) {
    await pool.query(`insert into platform.workspace_modules
      (tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,
        activated_at,activated_by,reason)
      values($1,$2,$3,'experience_guides','active',statement_timestamp()-interval '1 second',
        statement_timestamp(),$4,'Disposable Guide lifecycle authority')`,
    [ids.tenantId, ids.workspaceIds[index], moduleDefinition.id, actor]);
    await pool.query(`insert into platform.workspace_entitlements
      (customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
      values($1,$2,'boolean',true,statement_timestamp()-interval '1 second')`,
    [ids.workspaceIds[index], moduleDefinition.entitlement_key]);
    const workspaceRoleId = randomUUID();
    await pool.query(`insert into platform.workspace_roles
      (id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,
        lifecycle_status,created_by,valid_from)
      values($1,$2,$3,$4,'Disposable Guide manager',$5,'workspace','draft',$6,
        statement_timestamp()-interval '1 second')`,
    [workspaceRoleId, ids.tenantId, ids.workspaceIds[index],
      `ce_guide_${workspaceRoleId.slice(0, 8)}`, baseRole.id, actor]);
    await pool.query(`insert into platform.workspace_role_modules
      (tenant_id,workspace_role_id,module_definition_id) values($1,$2,$3)`,
    [ids.tenantId, workspaceRoleId, moduleDefinition.id]);
    await pool.query(`insert into platform.workspace_role_permissions
      (tenant_id,workspace_role_id,permission_id,effect) values($1,$2,$3,'allow')`,
    [ids.tenantId, workspaceRoleId, permission.id]);
    await pool.query(`update platform.workspace_roles
      set lifecycle_status='published',lock_version=lock_version+1 where id=$1`, [workspaceRoleId]);
    await pool.query(`insert into platform.workspace_member_roles
      (id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
        assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
      values($1,$2,$3,$4,$5,'workspace',$6,$4,'Disposable Guide lifecycle authority',
        statement_timestamp()-interval '1 second')`,
    [randomUUID(), ids.tenantId, ids.workspaceIds[index], ids.membershipId, workspaceRoleId, actor]);
  }
}

async function installDocumentsAuthority() {
  const baseRole = (await pool.query(`select id from identity.roles
    where code='association_admin' and tenant_id is null and is_system`)).rows[0];
  assert.ok(baseRole);
  await pool.query(`insert into identity.permissions(code,resource,action,description)
    values('documents.vault.read','documents.vault','read','Disposable Documents reference authority')
    on conflict(code) do nothing`);
  await pool.query(`insert into platform.module_definitions
    (code,version,name,labels_json,description,category,is_active,lifecycle_status,
      sensitivity_level,requires_aal2,entitlement_key,published_at)
    values('documents',1,'Documents',
      '{"ro":"Documente","en":"Documents","fa":"اسناد"}'::jsonb,
      'Disposable Documents reference authority','documents',true,'published','sensitive',true,
      'module.documents',statement_timestamp())
    on conflict(code,version) do nothing`);
  const moduleDefinition = (await pool.query(`select id,entitlement_key
    from platform.module_definitions where code='documents' and version=1`)).rows[0];
  const permission = (await pool.query(`select id from identity.permissions
    where code='documents.vault.read'`)).rows[0];
  await pool.query(`insert into platform.module_permission_bindings
    (module_definition_id,permission_id,permission_mode,is_assignable_to_local_role,
      is_delegable,requires_aal2,lifecycle_status)
    values($1,$2,'read',true,false,true,'active') on conflict do nothing`,
  [moduleDefinition.id, permission.id]);
  await pool.query(`insert into platform.module_property_profile_compatibilities
    (module_definition_id,property_profile_id,compatibility_level,reason)
    select distinct $1::uuid,t.property_profile_id,'compatible','Disposable Documents authority'
    from platform.workspace_taxonomy_assignments t
    where t.customer_workspace_id=any($2::uuid[])
    on conflict(module_definition_id,property_profile_id) do nothing`,
  [moduleDefinition.id, ids.workspaceIds]);
  await pool.query(`insert into platform.module_operating_model_compatibilities
    (module_definition_id,operating_model_id,compatibility_level,reason)
    select distinct $1::uuid,t.operating_model_id,'compatible','Disposable Documents authority'
    from platform.workspace_taxonomy_assignments t
    where t.customer_workspace_id=any($2::uuid[])
    on conflict(module_definition_id,operating_model_id) do nothing`,
  [moduleDefinition.id, ids.workspaceIds]);
  for (const workspaceId of ids.workspaceIds) {
    await pool.query(`insert into platform.workspace_modules
      (tenant_id,customer_workspace_id,module_definition_id,module_code,status,valid_from,
        activated_at,activated_by,reason)
      values($1,$2,$3,'documents','active',statement_timestamp()-interval '1 second',
        statement_timestamp(),$4,'Disposable Documents reference authority')`,
    [ids.tenantId, workspaceId, moduleDefinition.id, actor]);
    await pool.query(`insert into platform.workspace_entitlements
      (customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
      values($1,$2,'boolean',true,statement_timestamp()-interval '1 second')`,
    [workspaceId, moduleDefinition.entitlement_key]);
    const workspaceRoleId = randomUUID();
    await pool.query(`insert into platform.workspace_roles
      (id,tenant_id,customer_workspace_id,code,name,base_role_id,scope_ceiling,
        lifecycle_status,created_by,valid_from)
      values($1,$2,$3,$4,'Disposable Documents reader',$5,'workspace','draft',$6,
        statement_timestamp()-interval '1 second')`,
    [workspaceRoleId, ids.tenantId, workspaceId,
      `ce_docs_${workspaceRoleId.slice(0, 8)}`, baseRole.id, actor]);
    await pool.query(`insert into platform.workspace_role_modules
      (tenant_id,workspace_role_id,module_definition_id) values($1,$2,$3)`,
    [ids.tenantId, workspaceRoleId, moduleDefinition.id]);
    await pool.query(`insert into platform.workspace_role_permissions
      (tenant_id,workspace_role_id,permission_id,effect) values($1,$2,$3,'allow')`,
    [ids.tenantId, workspaceRoleId, permission.id]);
    await pool.query(`update platform.workspace_roles
      set lifecycle_status='published',lock_version=lock_version+1 where id=$1`, [workspaceRoleId]);
    await pool.query(`insert into platform.workspace_member_roles
      (id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
        assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
      values($1,$2,$3,$4,$5,'workspace',$6,$4,'Disposable Documents reference authority',
        statement_timestamp()-interval '1 second')`,
    [randomUUID(), ids.tenantId, workspaceId, ids.membershipId, workspaceRoleId, actor]);
  }
}

async function addImmutableDocumentReference(guideId, options = {}) {
  const documentId = randomUUID();
  const versionId = randomUUID();
  const stepId = randomUUID();
  const referenceId = randomUUID();
  const sha = createHash('sha256').update(versionId).digest('hex');
  const position = options.position ?? 1;
  const guideVersion = options.guideVersion ?? 1;
  const documentVersion = options.documentVersion ?? 1;
  const currentVersion = options.currentVersion ?? documentVersion;
  const workspaceId = options.workspaceId ?? ids.workspaceIds[0];
  const propertyId = options.propertyId ?? ids.propertyIds[0];
  const scan = options.scan ?? 'clean';
  const checksum = options.checksum ?? 'verified';
  await pool.query(`insert into documents.documents
    (id,tenant_id,workspace_id,property_id,title,document_type,classification,current_version,
      status,archived_at,deleted_at,disposition_status)
    values($1,$2,$3,$4,'Private destination title','ce-guide-test','internal',$5,
      $6,$7,$8,$9)`,
  [documentId, ids.tenantId, workspaceId, propertyId, currentVersion,
    options.status ?? 'active', options.archivedAt ?? null, options.deletedAt ?? null,
    options.dispositionStatus ?? 'retained']);
  await pool.query(`insert into documents.document_versions
    (id,tenant_id,document_id,version,object_path,sha256,mime_type,scanning_status,checksum_status)
    values($1,$2,$3,$4,$5,$6,'application/pdf',$7,$8)`,
  [versionId, ids.tenantId, documentId, documentVersion,
    `${ids.tenantId}/private-${versionId}.pdf`, sha, scan, checksum]);
  if (options.attested !== false) {
    await pool.query(`insert into documents.document_scan_attestations
      (tenant_id,version_id,provider,scan_id,verdict,content_sha256,engine_version,scanned_at)
      values($1,$2,'clamav',$3,$4,$5,'synthetic-clamav',statement_timestamp())`,
    [ids.tenantId, versionId, randomUUID(), scan === 'clean' ? 'clean' : 'quarantined', sha]);
  }
  await pool.query(`insert into experience.guide_steps
    (id,tenant_id,workspace_id,guide_id,guide_version,position,title,body)
    values($1,$2,$3,$4,$5,$6,'Private step','Private body must never enter evidence')`,
  [stepId, ids.tenantId, ids.workspaceIds[0], guideId, guideVersion, position]);
  await pool.query(`insert into experience.guide_references
    (id,tenant_id,workspace_id,guide_id,guide_version,step_id,position,target_type,
      target_id,document_version_id,document_version,safe_label)
    values($1,$2,$3,$4,$5,$6,1,'document',$7,$8,$9,$10)`,
  [referenceId, ids.tenantId, ids.workspaceIds[0], guideId, guideVersion, stepId,
    documentId, versionId, documentVersion, options.safeLabel ?? `Bound document ${position}`]);
  return { documentId, versionId, referenceId, stepId, sha };
}

async function rewriteDocumentWorkspaceForTest(documentId, workspaceId) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("set local session_replication_role='replica'");
    await client.query('update documents.documents set workspace_id=$2 where id=$1',
      [documentId, workspaceId]);
    await client.query('commit');
  } finally {
    await client.query('rollback').catch(() => {});
    client.release();
  }
}

async function waitForQueryLock(fragment) {
  for (let index = 0; index < 300; index += 1) {
    const waiting = await pool.query(`select count(*)::int value from pg_stat_activity
      where datname=current_database() and wait_event_type='Lock' and position($1 in query)>0`,
    [fragment]);
    if (waiting.rows[0].value > 0) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('expected Documents selector row-lock wait');
}

try {
  await bootstrapDisposablePostgres();
  await pool.query(`insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
    values($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,now(),now())`,
  [actor, `ce-guide-${randomUUID()}@example.invalid`]);
  await setupCanonicalFixture();
  await installGuideAuthority();
  await installDocumentsAuthority();

  const guide = await insertGuide();
  let publish;
  let publishResult;
  let unpublish;
  let unpublishResult;
  await check('fresh publish commits exact V to V+1 through the real Core host', async () => {
    publish = await command(guide, 'publish', 1);
    publishResult = await host.execute(publish, providers());
    assert.equal(publishResult.status, 'committed');
    assert.deepEqual(await state(guide), {
      status: 'published', version: 2, content_version: 1,
      title: 'Private synthetic Guide', audience: { kind: 'workspace' },
    });
    assert.deepEqual(await effects(publish), { idempotency: 1, audit: 1, outbox: 1 });
    assert.equal(publishResult.receipt.provider_evidence.provider_code,
      lifecycle.experienceGuideLifecycleProviderCodeV1);
    assert.equal(publishResult.receipt.subject_reference.version, 1);
    assert.equal(publishResult.receipt.aggregate_version, 2);
    assert.equal(publishResult.receipt.replay_validation.provider_code,
      lifecycle.experienceGuideLifecycleProviderCodeV1);
  });
  await check('exact publish replay validates current Guide and returns the stored receipt read-only', async () => {
    const before = await durableDigest(publish);
    const beforeCalls = { ...calls };
    const replay = await host.execute(publish, providers());
    assert.equal(replay.status, 'exact_replay');
    assert.deepEqual(replay.receipt, publishResult.receipt);
    assert.deepEqual(await durableDigest(publish), before);
    assert.equal(calls.authority, beforeCalls.authority + 1);
    assert.equal(calls.replay, beforeCalls.replay + 1);
    assert.equal(calls.validation, beforeCalls.validation);
    assert.equal(calls.mutation, beforeCalls.mutation);
  });
  await check('fresh unpublish is reversible lifecycle, not cancellation', async () => {
    unpublish = await command(guide, 'unpublish', 2);
    unpublishResult = await host.execute(unpublish, providers());
    assert.equal(unpublishResult.status, 'committed');
    assert.equal((await state(guide)).status, 'draft');
    assert.equal((await state(guide)).version, 3);
    assert.deepEqual(await effects(unpublish), { idempotency: 1, audit: 1, outbox: 1 });
    const cancel = await command(guide, 'cancel', 3, {
      evaluation_purpose: 'experience.guide.cancel',
      subject_reference: { kind: 'experience.guide', id: guide, version: 3,
        relation: 'cancel', request_version: 1 },
      aggregate_version: 4,
    });
    await zeroWrite(cancel, 'PROVIDER_UNAVAILABLE');
    assert.equal((await state(guide)).status, 'draft');
  });
  await check('exact unpublish replay validates resulting draft version without another mutation', async () => {
    const before = await durableDigest(unpublish);
    const beforeCalls = { ...calls };
    const replay = await host.execute(unpublish, providers());
    assert.equal(replay.status, 'exact_replay');
    assert.deepEqual(replay.receipt, unpublishResult.receipt);
    assert.deepEqual(await durableDigest(unpublish), before);
    assert.equal(calls.authority, beforeCalls.authority + 1);
    assert.equal(calls.replay, beforeCalls.replay + 1);
    assert.equal(calls.validation, beforeCalls.validation);
    assert.equal(calls.mutation, beforeCalls.mutation);
  });
  await check('later Guide state and version reject the old publish replay with zero writes', async () => {
    await replayZeroWrite(publish, 'REPLAY_CONFLICT');
  });
  await check('historical receipt without replay marker is unavailable and is not upgraded', async () => {
    const key = `core-tx.v1:${unpublish.workspace_id}:${unpublish.idempotency_key}`;
    const historical = structuredClone(unpublishResult.receipt);
    delete historical.replay_validation;
    const beforeReplay = calls.replay;
    try {
      await pool.query(`update platform.idempotency_keys set response_ref=$3::jsonb
        where tenant_id=$1 and key=$2`, [ids.tenantId, key, JSON.stringify(historical)]);
      await replayZeroWrite(unpublish, 'PROVIDER_UNAVAILABLE');
      assert.equal(calls.replay, beforeReplay);
      const stored = (await pool.query(`select response_ref from platform.idempotency_keys
        where tenant_id=$1 and key=$2`, [ids.tenantId, key])).rows[0].response_ref;
      assert.equal(Object.hasOwn(stored, 'replay_validation'), false);
    } finally {
      await pool.query(`update platform.idempotency_keys set response_ref=$3::jsonb
        where tenant_id=$1 and key=$2`, [
        ids.tenantId, key, JSON.stringify(unpublishResult.receipt),
      ]);
    }
  });
  await check('malformed stored receipt is rejected before the Guide replay hook', async () => {
    const key = `core-tx.v1:${unpublish.workspace_id}:${unpublish.idempotency_key}`;
    const malformed = structuredClone(unpublishResult.receipt);
    malformed.provider_evidence.source_reference = { leaked: true };
    const beforeReplay = calls.replay;
    try {
      await pool.query(`update platform.idempotency_keys set response_ref=$3::jsonb
        where tenant_id=$1 and key=$2`, [ids.tenantId, key, JSON.stringify(malformed)]);
      await replayZeroWrite(unpublish, 'REPLAY_CONFLICT');
      assert.equal(calls.replay, beforeReplay);
    } finally {
      await pool.query(`update platform.idempotency_keys set response_ref=$3::jsonb
        where tenant_id=$1 and key=$2`, [
        ids.tenantId, key, JSON.stringify(unpublishResult.receipt),
      ]);
    }
  });
  await check('real PostgreSQL 40001 retries replay in a fresh Core read transaction', async () => {
    const blocker = await pool.connect();
    const replayAttempts = [];
    const replayErrorCodes = [];
    let replayEntered;
    const entered = new Promise(resolve => { replayEntered = resolve; });
    const before = await durableDigest(unpublish);
    const beforeCalls = { validation: calls.validation, mutation: calls.mutation };
    try {
      await blocker.query('begin');
      // Test-only tuple rewrite: preserve every Guide value while creating a
      // genuine concurrent PostgreSQL write against the replay predicate.
      await blocker.query("set local session_replication_role='replica'");
      await blocker.query('update experience.guides set updated_at=updated_at where id=$1', [guide]);
      const pending = host.execute(unpublish, providers({
        replayAttempts, replayErrorCodes, replayEntered,
      }));
      await entered;
      await blocker.query('commit');
      const replay = await pending;
      assert.equal(replay.status, 'exact_replay');
      assert.deepEqual(replayErrorCodes, ['40001']);
      assert.deepEqual(replayAttempts, [1, 2]);
      assert.deepEqual(await durableDigest(unpublish), before);
      assert.equal(calls.validation, beforeCalls.validation);
      assert.equal(calls.mutation, beforeCalls.mutation);
    } finally {
      await blocker.query('rollback').catch(() => {});
      blocker.release();
    }
  });
  await check('revoked current authority denies replay before the provider and writes nothing', async () => {
    const beforeReplay = calls.replay;
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
    [ids.workspaceIds[0]]);
    try {
      await replayZeroWrite(unpublish, 'AUTHORITY_DENIED');
      assert.equal(calls.replay, beforeReplay);
    } finally {
      await pool.query(`update platform.workspace_entitlements set boolean_value=true
        where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
      [ids.workspaceIds[0]]);
    }
  });
  await check('stale exact version and cross-Workspace scope deny with zero writes', async () => {
    await zeroWrite(await command(guide, 'publish', 1), 'PROVIDER_UNAVAILABLE');
    const cross = await command(guide, 'publish', 3, { workspace_id: ids.workspaceIds[1] });
    await zeroWrite(cross, 'PROVIDER_UNAVAILABLE');
  });
  await check('concurrent writers on the same expected version commit exactly once', async () => {
    const concurrentGuide = await insertGuide();
    const left = await command(concurrentGuide, 'publish', 1);
    const right = await command(concurrentGuide, 'publish', 1);
    const results = await Promise.all([host.execute(left, providers()), host.execute(right, providers())]);
    assert.equal(results.filter(result => result.status === 'committed').length, 1);
    assert.equal(results.filter(result => result.status === 'denied').length, 1);
    assert.deepEqual(await state(concurrentGuide), {
      status: 'published', version: 2, content_version: 1,
      title: 'Private synthetic Guide', audience: { kind: 'workspace' },
    });
    const total = (await pool.query(`select count(*)::int value from platform.outbox_events
      where aggregate_type='experience_guide' and aggregate_id=$1 and aggregate_version=2`,
    [concurrentGuide])).rows[0].value;
    assert.equal(total, 1);
  });
  await check('revoked canonical entitlement denies before provider mutation', async () => {
    const revokedGuide = await insertGuide();
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
    [ids.workspaceIds[0]]);
    try {
      await zeroWrite(await command(revokedGuide, 'publish', 1), 'AUTHORITY_DENIED');
    } finally {
      await pool.query(`update platform.workspace_entitlements set boolean_value=true
        where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
      [ids.workspaceIds[0]]);
    }
  });
  await check('failure and serialization retry roll back partial Guide mutation', async () => {
    const failedGuide = await insertGuide();
    const failed = await command(failedGuide, 'publish', 1);
    const result = await host.execute(failed, providers({ failAfterMutation: true }));
    assert.equal(result.status, 'denied');
    assert.equal(result.code, 'TRANSACTION_FAILED');
    assert.equal((await state(failedGuide)).version, 1);
    assert.deepEqual(await effects(failed), { idempotency: 0, audit: 0, outbox: 0 });

    const retriedGuide = await insertGuide();
    const retried = await command(retriedGuide, 'publish', 1);
    const retryResult = await host.execute(retried, providers({ serializationOnce: true }));
    assert.equal(retryResult.status, 'committed');
    assert.equal(retryResult.receipt.authority.transaction_context.attempt, 2);
    assert.equal((await state(retriedGuide)).version, 2);
    assert.deepEqual(await effects(retried), { idempotency: 1, audit: 1, outbox: 1 });
  });
  let referencedLifecycle;
  await check('publish and exact replay validate one and multiple immutable references', async () => {
    const accessBefore = (await pool.query(
      'select count(*)::int value from documents.access_events',
    )).rows[0].value;
    for (const count of [1, 3]) {
      const referenceGuide = await insertGuide();
      const references = [];
      for (let position = count; position >= 1; position -= 1) {
        references.push(await addImmutableDocumentReference(referenceGuide, { position }));
      }
      const value = await command(referenceGuide, 'publish', 1, {
        provider_source_ids: referenceSourceLocks(referenceGuide, references),
      });
      const committed = await host.execute(value, providers());
      assert.equal(committed.status, 'committed');
      const beforeReplay = await durableDigest(value);
      const replay = await host.execute(value, providers());
      assert.equal(replay.status, 'exact_replay');
      assert.deepEqual(replay.receipt, committed.receipt);
      assert.deepEqual(await durableDigest(value), beforeReplay);
      const evidence = committed.receipt.provider_evidence;
      for (const field of ['document_id', 'document_version_id', 'safe_label', 'object_path',
        'body', 'storage_metadata', 'permissions', 'membership_id']) {
        assert.ok(!(field in evidence));
      }
      assert.equal(evidence.source_disclosure, 'status_only');
      assert.equal(evidence.source_reference, null);
      if (count === 3) referencedLifecycle = {
        guideId: referenceGuide, references, publish: value, publishResult: committed,
      };
    }
    const accessAfter = (await pool.query(
      'select count(*)::int value from documents.access_events',
    )).rows[0].value;
    assert.equal(accessAfter, accessBefore);
    const immutable = referencedLifecycle.references[0];
    await assert.rejects(() => pool.query(`update experience.guide_references
      set safe_label='Changed' where id=$1`, [immutable.referenceId]),
    /ce_guide_content_immutable/);
    await assert.rejects(() => pool.query(`delete from experience.guide_references where id=$1`,
      [immutable.referenceId]), /ce_guide_content_immutable/);
  });
  await check('one invalid reference denies the complete publish with zero writes', async () => {
    const referenceGuide = await insertGuide();
    const references = [
      await addImmutableDocumentReference(referenceGuide, { position: 1 }),
      await addImmutableDocumentReference(referenceGuide, { position: 2, scan: 'quarantined' }),
    ];
    const value = await command(referenceGuide, 'publish', 1, {
      provider_source_ids: referenceSourceLocks(referenceGuide, references),
    });
    await zeroWrite(value, 'PROVIDER_UNAVAILABLE');
    assert.equal((await state(referenceGuide)).status, 'draft');
  });
  await check('stale, cross-Workspace, NULL Workspace and missing source lock fail closed', async () => {
    const staleGuide = await insertGuide();
    const stale = await addImmutableDocumentReference(staleGuide);
    await pool.query('update documents.documents set current_version=2 where id=$1', [stale.documentId]);
    await zeroWrite(await command(staleGuide, 'publish', 1, {
      provider_source_ids: referenceSourceLocks(staleGuide, [stale]),
    }), 'PROVIDER_UNAVAILABLE');

    const crossGuide = await insertGuide();
    const cross = await addImmutableDocumentReference(crossGuide);
    await rewriteDocumentWorkspaceForTest(cross.documentId, ids.workspaceIds[1]);
    await zeroWrite(await command(crossGuide, 'publish', 1, {
      provider_source_ids: referenceSourceLocks(crossGuide, [cross]),
    }), 'PROVIDER_UNAVAILABLE');

    const nullGuide = await insertGuide();
    const nullBound = await addImmutableDocumentReference(nullGuide);
    await rewriteDocumentWorkspaceForTest(nullBound.documentId, null);
    await zeroWrite(await command(nullGuide, 'publish', 1, {
      provider_source_ids: referenceSourceLocks(nullGuide, [nullBound]),
    }), 'PROVIDER_UNAVAILABLE');

    const unlockedGuide = await insertGuide();
    const unlocked = await addImmutableDocumentReference(unlockedGuide);
    await zeroWrite(await command(unlockedGuide, 'publish', 1, {
      provider_source_ids: [unlockedGuide, unlocked.documentId],
    }), 'PROVIDER_UNAVAILABLE');
  });
  await check('publish replay rechecks Documents state while unpublish and replay stay target-free', async () => {
    const target = referencedLifecycle.references[0];
    const accessBefore = (await pool.query(`select count(*)::int value
      from documents.access_events where document_id=$1`, [target.documentId])).rows[0].value;
    await pool.query('update documents.documents set deleted_at=statement_timestamp() where id=$1',
      [target.documentId]);
    await replayZeroWrite(referencedLifecycle.publish, 'REPLAY_CONFLICT');

    const unpublishValue = await command(referencedLifecycle.guideId, 'unpublish', 2);
    const unpublishCommitted = await host.execute(unpublishValue, providers());
    assert.equal(unpublishCommitted.status, 'committed');
    assert.equal((await state(referencedLifecycle.guideId)).status, 'draft');
    const replay = await host.execute(unpublishValue, providers());
    assert.equal(replay.status, 'exact_replay');
    assert.deepEqual(replay.receipt, unpublishCommitted.receipt);
    const accessAfter = (await pool.query(`select count(*)::int value
      from documents.access_events where document_id=$1`, [target.documentId])).rows[0].value;
    assert.equal(accessAfter, accessBefore);
  });
  await check('revoked Documents authority denies publish while CE authority remains current', async () => {
    const referenceGuide = await insertGuide();
    const reference = await addImmutableDocumentReference(referenceGuide);
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key='module.documents'`,
    [ids.workspaceIds[0]]);
    try {
      const value = await command(referenceGuide, 'publish', 1, {
        provider_source_ids: referenceSourceLocks(referenceGuide, [reference]),
      });
      await zeroWrite(value, 'PROVIDER_UNAVAILABLE');
    } finally {
      await pool.query(`update platform.workspace_entitlements set boolean_value=true
        where customer_workspace_id=$1 and entitlement_key='module.documents'`,
      [ids.workspaceIds[0]]);
    }
  });
  await check('publish replay after Documents authority revocation denies with zero writes', async () => {
    const referenceGuide = await insertGuide();
    const reference = await addImmutableDocumentReference(referenceGuide);
    const value = await command(referenceGuide, 'publish', 1, {
      provider_source_ids: referenceSourceLocks(referenceGuide, [reference]),
    });
    assert.equal((await host.execute(value, providers())).status, 'committed');
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key='module.documents'`,
    [ids.workspaceIds[0]]);
    try {
      await replayZeroWrite(value, 'AUTHORITY_DENIED');
    } finally {
      await pool.query(`update platform.workspace_entitlements set boolean_value=true
        where customer_workspace_id=$1 and entitlement_key='module.documents'`,
      [ids.workspaceIds[0]]);
    }
  });
  await check('real selector 40001 reaches Core and replay retries in a fresh transaction', async () => {
    const referenceGuide = await insertGuide();
    const reference = await addImmutableDocumentReference(referenceGuide);
    const value = await command(referenceGuide, 'publish', 1, {
      provider_source_ids: referenceSourceLocks(referenceGuide, [reference]),
    });
    const committed = await host.execute(value, providers());
    assert.equal(committed.status, 'committed');
    const blocker = await pool.connect();
    const replayAttempts = [];
    const replayErrorCodes = [];
    const before = await durableDigest(value);
    const accessBefore = (await pool.query(`select count(*)::int value
      from documents.access_events where document_id=$1`, [reference.documentId])).rows[0].value;
    let pending;
    try {
      await blocker.query('begin');
      await blocker.query('update documents.documents set title=title where id=$1',
        [reference.documentId]);
      pending = host.execute(value, providers({ replayAttempts, replayErrorCodes }));
      await waitForQueryLock('from documents.documents d where d.id=$1');
      await blocker.query('commit');
      const replay = await pending;
      assert.equal(replay.status, 'exact_replay');
      assert.deepEqual(replay.receipt, committed.receipt);
      assert.deepEqual(replayErrorCodes, ['40001']);
      assert.deepEqual(replayAttempts, [1, 2]);
      assert.deepEqual(await durableDigest(value), before);
      const accessAfter = (await pool.query(`select count(*)::int value
        from documents.access_events where document_id=$1`, [reference.documentId])).rows[0].value;
      assert.equal(accessAfter, accessBefore);
    } finally {
      await blocker.query('rollback').catch(() => {});
      blocker.release();
      if (pending) await pending;
    }
  });
  await check('accepted evidence is status-only and cannot grant destination access', async () => {
    const privacyGuide = await insertGuide();
    const value = await command(privacyGuide, 'publish', 1);
    const result = await host.execute(value, providers());
    assert.equal(result.status, 'committed');
    const evidence = result.receipt.provider_evidence;
    for (const field of ['title', 'body', 'audience', 'safe_label', 'target_id',
      'document_version_id', 'membership_id', 'participant_id', 'service_id', 'message_id']) {
      assert.ok(!(field in evidence));
    }
    assert.equal(evidence.source_disclosure, 'status_only');
    assert.equal(evidence.source_reference, null);
  });
  await check('aggregate version and immutable identity guards reject direct bypass', async () => {
    const guardedGuide = await insertGuide();
    await assert.rejects(() => pool.query(`update experience.guides
      set status='published' where id=$1`, [guardedGuide]), /ce_guide_exact_version_required/);
    await assert.rejects(() => pool.query(`update experience.guides
      set title='Changed without content version',version=version+1 where id=$1`,
    [guardedGuide]), /ce_guide_lifecycle_transition_invalid/);
    await assert.rejects(() => pool.query('delete from experience.guides where id=$1',
      [guardedGuide]), /ce_guide_delete_prohibited/);
    assert.deepEqual(await state(guardedGuide), {
      status: 'draft', version: 1, content_version: 1,
      title: 'Private synthetic Guide', audience: { kind: 'workspace' },
    });
  });
  await check('storage is closed and public editor/runtime activation remains absent', async () => {
    const access = await pool.query(`select c.relname,c.relrowsecurity,
      has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') authenticated,
      has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') service_role
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='experience' and c.relname in ('guides','guide_steps','guide_references')`);
    assert.equal(access.rowCount, 3);
    for (const row of access.rows) {
      assert.equal(row.relrowsecurity, true);
      assert.equal(row.anon, false);
      assert.equal(row.authenticated, false);
      assert.equal(row.service_role, false);
    }
    const page = readFileSync(new URL(
      '../src/components/customer/CustomerExperienceGuidePage.tsx', import.meta.url,
    ), 'utf8');
    const client = readFileSync(new URL(
      '../src/lib/community/experience-guide-client.ts', import.meta.url,
    ), 'utf8');
    assert.match(page, /commands=\{null\}/);
    assert.match(client, /can_edit:\s*false/);
  });
} finally {
  await pool.end();
}

console.log(`CE Guide lifecycle through Core TX host: ${checks}/${checks} PASS; replay hook and Documents selector consumed, integration inactive`);
