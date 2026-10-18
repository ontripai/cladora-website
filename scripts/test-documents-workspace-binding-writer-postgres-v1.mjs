import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';

const connectionString = process.env.DOC_WORKSPACE_WRITER_TEST_DATABASE_URL;
if (!connectionString || process.env.DOC_WORKSPACE_WRITER_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || !['/postgres', '/documents_workspace_writer_test'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

let adminPool = null, isolatedDatabaseName = null;
if (target.pathname === '/postgres') {
  isolatedDatabaseName = `documents_workspace_writer_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  adminPool = new pg.Pool({ connectionString, max: 1 });
  await adminPool.query(`create database "${isolatedDatabaseName}"`);
  target.pathname = `/${isolatedDatabaseName}`;
}

const require = createRequire(import.meta.url), cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} }; cache.set(url.href, mod.exports);
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name), mod, mod.exports);
  return mod.exports;
}

const api = load(new URL('../src/lib/customer/documents-workspace-binding-writer-v1.ts', import.meta.url));
const replacementApi = load(new URL(
  '../src/lib/customer/documents-replacement-workspace-writer-v1.ts', import.meta.url));
const promotionApi = load(new URL(
  '../src/lib/customer/documents-replacement-promotion-after-clean-v1.ts', import.meta.url));
const downloadApi = load(new URL(
  '../src/lib/customer/documents-vault-download-exact-workspace-v2.ts', import.meta.url));
const { createCorePostgresTransactionHostV1 } = load(
  new URL('../src/lib/core/postgres-transaction-host-v1.ts', import.meta.url));
const pool = new pg.Pool({ connectionString: target.toString(), max: 16 });
pool.on('error', error => {
  if (error?.code !== '57P01') throw error;
});
const host = createCorePostgresTransactionHostV1(pool);
const actor = randomUUID();
const ids = { tenantId: randomUUID(), contextId: randomUUID(), membershipId: randomUUID(),
  workspaceIds: [randomUUID(), randomUUID()] };
const legacyDocumentId = randomUUID(), legacyIntentId = randomUUID();
let checks = 0;
const check = async (name, run) => { await run(); console.log(`ok ${++checks} - ${name}`); };
const revision = async () => Number((await pool.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton')).rows[0].revision);

const stateTables = [
  'documents.documents', 'documents.document_versions', 'documents.upload_intents',
  'documents.access_events', 'documents.document_scan_jobs',
  'documents.document_scan_attestations', 'platform.idempotency_keys',
  'audit.events', 'platform.outbox_events',
];
async function digest() {
  const values = [];
  for (const table of stateTables) {
    values.push((await pool.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]')::text value from ${table} t`)).rows[0].value);
  }
  return createHash('sha256').update(values.join('\n')).digest('hex');
}

function withSyntheticAal2(providers, counters) {
  return {
    ...providers,
    async resolveAuthority(scope, request) {
      counters.authority += 1;
      await scope.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
        sub: actor, role: 'authenticated', aal: 'aal2',
      })]);
      return providers.resolveAuthority(scope, request);
    },
    async validateProviders(scope, command, authority) {
      counters.validation += 1;
      return providers.validateProviders(scope, command, authority);
    },
    ...(providers.validateReplay ? { async validateReplay(scope, command, authority, receipt) {
      counters.replay += 1;
      return providers.validateReplay(scope, command, authority, receipt);
    } } : {}),
    async mutate(scope, command) {
      counters.mutation += 1;
      return providers.mutate(scope, command);
    },
  };
}

async function issueFixture(workspace = ids.workspaceIds[0], suffix = randomUUID()) {
  const intentId = randomUUID(), documentId = randomUUID();
  const input = {
    contract_version: 'documents-new-document-intent.v1', context_id: ids.contextId,
    workspace_id: workspace, intent_id: intentId, prospective_document_id: documentId,
    filename: 'evidence.pdf', object_path: `${ids.tenantId}/${intentId}/v1.pdf`,
    declared_mime_type: 'application/pdf', max_size_bytes: 4096,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    idempotency_key: `doc-intent-${suffix}`,
  };
  const context = { transaction_id: randomUUID(), command_id: randomUUID(), actor_id: actor,
    authority_version: await revision() };
  const command = api.buildDocumentsNewDocumentIntentCommandV1(input, context);
  const counters = { authority: 0, validation: 0, replay: 0, mutation: 0 };
  const result = await host.execute(command,
    withSyntheticAal2(api.createDocumentsNewDocumentIntentProvidersV1(input, context), counters));
  assert.equal(result.status, 'committed');
  return { input, context, command, result, counters };
}

async function finalFixture(issue, overrides = {}) {
  const versionId = overrides.version_id || randomUUID();
  const input = {
    contract_version: 'documents-initial-version.v1', context_id: ids.contextId,
    workspace_id: issue.input.workspace_id, intent_id: issue.input.intent_id,
    document_id: issue.input.prospective_document_id, version_id: versionId,
    title: 'Bound evidence', document_type: 'general', classification: 'internal',
    idempotency_key: `doc-final-${randomUUID()}`, ...overrides,
  };
  const verified = await api.verifyDocumentsStoredObjectBeforeTransactionV1({
    bucket_id: 'document-vault', object_path: issue.input.object_path,
  }, async targetObject => ({ ...targetObject,
    storage_object_id: randomUUID(), generation_capability: 'not_exposed',
    storage_generation: null, etag_capability: 'not_exposed', storage_etag: null,
    sha256: createHash('sha256').update(versionId).digest('hex'), size_bytes: 1024,
    detected_mime_type: 'application/pdf', non_overwritable: true,
  }));
  const context = { transaction_id: randomUUID(), command_id: randomUUID(), actor_id: actor,
    authority_version: await revision() };
  const command = api.buildDocumentsInitialVersionCommandV1(input, context, verified);
  const counters = { authority: 0, validation: 0, replay: 0, mutation: 0 };
  const providers = withSyntheticAal2(
    api.createDocumentsInitialVersionProvidersV1(input, context, verified), counters);
  return { input, verified, context, command, providers, counters };
}

async function replacementIssueFixture(documentId, parentVersionId, parentVersion = 1) {
  const intentId = randomUUID();
  const input = {
    contract_version: 'documents-replacement-intent.v1', context_id: ids.contextId,
    workspace_id: ids.workspaceIds[0], intent_id: intentId, document_id: documentId,
    expected_parent_version_id: parentVersionId, expected_parent_version: parentVersion,
    filename: 'replacement.pdf',
    object_path: `${ids.tenantId}/${intentId}/v${parentVersion + 1}.pdf`,
    declared_mime_type: 'application/pdf', max_size_bytes: 4096,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    idempotency_key: `doc-replacement-intent-${randomUUID()}`,
  };
  const context = { transaction_id: randomUUID(), command_id: randomUUID(), actor_id: actor,
    authority_version: await revision() };
  const command = replacementApi.buildDocumentsReplacementIntentCommandV1(input, context);
  const counters = { authority: 0, validation: 0, replay: 0, mutation: 0 };
  const providers = withSyntheticAal2(
    replacementApi.createDocumentsReplacementIntentProvidersV1(input, context), counters);
  const result = await host.execute(command, providers);
  assert.equal(result.status, 'committed');
  return { input, context, command, providers, counters, result };
}

async function replacementFinalFixture(issue, overrides = {}) {
  const versionId = overrides.version_id || randomUUID();
  const input = {
    contract_version: 'documents-replacement-candidate.v1', context_id: ids.contextId,
    workspace_id: issue.input.workspace_id, intent_id: issue.input.intent_id,
    document_id: issue.input.document_id,
    parent_version_id: issue.input.expected_parent_version_id,
    parent_version: issue.input.expected_parent_version, version_id: versionId,
    idempotency_key: `doc-replacement-final-${randomUUID()}`, ...overrides,
  };
  const verified = await api.verifyDocumentsStoredObjectBeforeTransactionV1({
    bucket_id: 'document-vault', object_path: issue.input.object_path,
  }, async targetObject => ({ ...targetObject,
    storage_object_id: randomUUID(), generation_capability: 'not_exposed',
    storage_generation: null, etag_capability: 'not_exposed', storage_etag: null,
    sha256: createHash('sha256').update(versionId).digest('hex'), size_bytes: 1024,
    detected_mime_type: 'application/pdf', non_overwritable: true,
  }));
  const context = { transaction_id: randomUUID(), command_id: randomUUID(), actor_id: actor,
    authority_version: await revision() };
  const command = replacementApi.buildDocumentsReplacementCandidateCommandV1(input, context, verified);
  const counters = { authority: 0, validation: 0, replay: 0, mutation: 0 };
  const providers = withSyntheticAal2(
    replacementApi.createDocumentsReplacementCandidateProvidersV1(input, context, verified), counters);
  return { input, verified, context, command, providers, counters };
}

async function attestReplacement(candidate, verdict = 'clean') {
  const attestationId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`insert into documents.document_scan_attestations(
        id,tenant_id,version_id,provider,scan_id,verdict,content_sha256,engine_version,scanned_at)
      values($1,$2,$3,'clamav',$4,$5,$6,'clamav-test-1',clock_timestamp())`, [
      attestationId, ids.tenantId, candidate.input.version_id, randomUUID(), verdict,
      candidate.verified.sha256,
    ]);
    await client.query("select set_config('app.document_scan_attestation_id',$1,true)", [attestationId]);
    await client.query('update documents.document_versions set scanning_status=$2 where id=$1',
      [candidate.input.version_id, verdict]);
    await client.query('commit');
    return attestationId;
  } catch (error) {
    await client.query('rollback'); throw error;
  } finally {
    client.release();
  }
}

async function promotionFixture(candidate, attestationId, overrides = {}) {
  const input = {
    contract_version: 'documents-replacement-promotion-after-clean.v1',
    context_id: ids.contextId, workspace_id: candidate.input.workspace_id,
    intent_id: candidate.input.intent_id, document_id: candidate.input.document_id,
    parent_version_id: candidate.input.parent_version_id,
    parent_version: candidate.input.parent_version,
    candidate_version_id: candidate.input.version_id,
    candidate_version: candidate.input.parent_version + 1,
    attestation_id: attestationId,
    idempotency_key: `doc-replacement-promote-${randomUUID()}`, ...overrides,
  };
  const context = { transaction_id: randomUUID(), command_id: randomUUID(), actor_id: actor,
    authority_version: await revision() };
  const command = promotionApi.buildDocumentsReplacementPromotionAfterCleanCommandV1(
    input, context, candidate.verified);
  const counters = { authority: 0, validation: 0, replay: 0, mutation: 0 };
  const providers = withSyntheticAal2(
    promotionApi.createDocumentsReplacementPromotionAfterCleanProvidersV1(
      input, context, candidate.verified), counters);
  return { input, context, command, providers, counters, verified: candidate.verified };
}

async function downloadFixture(documentId, versionId, expectedCurrentVersion, overrides = {}) {
  const input = {
    contract_version: 'documents-vault-download-exact-workspace.v2',
    context_id: ids.contextId, workspace_id: ids.workspaceIds[0],
    document_id: documentId, version_id: versionId,
    expected_current_version: expectedCurrentVersion,
    idempotency_key: `doc-download-${randomUUID()}`, ...overrides,
  };
  const context = { transaction_id: randomUUID(), command_id: randomUUID(), actor_id: actor,
    authority_version: await revision() };
  const command = downloadApi.buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
  const counters = { authority: 0, validation: 0, replay: 0, mutation: 0 };
  const bundle = downloadApi.createDocumentsVaultDownloadExactWorkspaceProvidersV2(input, context);
  const providers = withSyntheticAal2(bundle.providers, counters);
  return { input, context, command, providers, counters, bundle };
}

async function deniedZeroWrite(candidate, code) {
  const before = await digest();
  const result = await host.execute(candidate.command, candidate.providers);
  assert.equal(result.status, 'denied');
  if (code) assert.equal(result.code, code);
  assert.equal(await digest(), before, 'denial changed durable SQL state');
  return result;
}

const bootstrapSql = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
do $$ begin create role cladora_rpc_owner nologin; exception when duplicate_object then null; end $$;
do $$ begin create role cladora_ce_guide_runtime login; exception when duplicate_object then null; end $$;
do $$ begin create role cladora_ce_guide_executor nologin; exception when duplicate_object then null; end $$;
create schema auth; create schema platform; create schema identity; create schema documents;
create schema customer_api;
create schema app_private; create schema audit;
create extension if not exists pgcrypto;
create function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
returns boolean language sql as $$select true$$;
create type platform.record_status as enum ('draft','active','suspended','archived');
create type documents.classification as enum ('public','internal','confidential','restricted');
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
create table auth.users(id uuid primary key,email text not null);
create table platform.tenants(id uuid primary key);
create table platform.customer_workspaces(
  id uuid primary key,tenant_id uuid not null references platform.tenants(id),
  lifecycle_status text not null default 'ACTIVE',archived_at timestamptz,unique(id,tenant_id)
);
create table identity.memberships(
  id uuid primary key,tenant_id uuid not null,user_id uuid not null references auth.users(id),
  status text not null,starts_at timestamptz not null,ends_at timestamptz
);
create table identity.context_grants(
  id uuid primary key,membership_id uuid not null,tenant_id uuid not null,
  starts_at timestamptz not null,ends_at timestamptz
);
create table identity.permissions(id uuid primary key,code text not null unique);
create table platform.module_definitions(
  id uuid primary key,code text not null,is_active boolean not null,lifecycle_status text not null,
  valid_from timestamptz not null,valid_to timestamptz,entitlement_key text,version integer not null default 1
);
create table platform.workspace_modules(
  customer_workspace_id uuid not null,module_definition_id uuid not null,status text not null,
  valid_from timestamptz not null,valid_to timestamptz
);
create table platform.workspace_entitlements(
  customer_workspace_id uuid not null,entitlement_key text not null,boolean_value boolean,
  valid_from timestamptz not null,valid_until timestamptz
);
create table platform.workspace_roles(
  id uuid primary key,customer_workspace_id uuid not null,lifecycle_status text not null,
  valid_from timestamptz not null,valid_to timestamptz
);
create table platform.workspace_role_modules(workspace_role_id uuid not null,module_definition_id uuid not null);
create table platform.workspace_role_permissions(workspace_role_id uuid not null,permission_id uuid not null,effect text not null);
create table platform.workspace_member_roles(
  id uuid primary key,customer_workspace_id uuid not null,membership_id uuid not null,
  workspace_role_id uuid not null,valid_from timestamptz not null,valid_to timestamptz
);
create table app_private.canonical_authority_revision_v1(singleton boolean primary key default true,revision bigint not null);
insert into app_private.canonical_authority_revision_v1(singleton,revision) values(true,1);
create function app_private.check_workspace_native_permission_v2(
  p_context uuid,p_workspace uuid,p_permission text,p_module text
) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join platform.customer_workspaces w on w.id=p_workspace and w.tenant_id=g.tenant_id
      and w.lifecycle_status='ACTIVE' and w.archived_at is null
    join platform.workspace_member_roles a on a.membership_id=m.id and a.customer_workspace_id=w.id
      and a.valid_from<=clock_timestamp() and (a.valid_to is null or a.valid_to>clock_timestamp())
    join platform.workspace_roles r on r.id=a.workspace_role_id and r.lifecycle_status='published'
      and r.valid_from<=clock_timestamp() and (r.valid_to is null or r.valid_to>clock_timestamp())
    join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id and rp.effect='allow'
    join identity.permissions p on p.id=rp.permission_id and p.code=p_permission
    join platform.module_definitions d on d.code=p_module and d.is_active and d.lifecycle_status='published'
    join platform.workspace_role_modules rm on rm.workspace_role_id=r.id and rm.module_definition_id=d.id
    join platform.workspace_modules wm on wm.customer_workspace_id=w.id and wm.module_definition_id=d.id
      and wm.status='active' and wm.valid_from<=clock_timestamp()
      and (wm.valid_to is null or wm.valid_to>clock_timestamp())
    join platform.workspace_entitlements e on e.customer_workspace_id=w.id
      and e.entitlement_key=d.entitlement_key and e.boolean_value
      and e.valid_from<=clock_timestamp() and (e.valid_until is null or e.valid_until>clock_timestamp())
    where g.id=p_context and m.user_id=auth.uid() and m.status='active'
      and m.starts_at<=clock_timestamp() and (m.ends_at is null or m.ends_at>clock_timestamp())
      and g.starts_at<=clock_timestamp() and (g.ends_at is null or g.ends_at>clock_timestamp()))
$$;
create table platform.idempotency_keys(
  tenant_id uuid not null,actor_id uuid not null,key text not null,request_hash text not null,
  response_ref jsonb,expires_at timestamptz not null,status_code integer,primary key(tenant_id,key)
);
create table audit.events(
  id bigserial primary key,tenant_id uuid not null,actor_id uuid not null,action text not null,
  entity_type text not null,entity_id uuid not null,request_id uuid,after_snapshot jsonb
);
create table platform.outbox_events(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,aggregate_type text not null,
  aggregate_id uuid not null,aggregate_version bigint not null,event_type text not null,payload jsonb not null,trace_id uuid
);
create table documents.documents(
  id uuid primary key,tenant_id uuid not null references platform.tenants(id),property_id uuid,
  title text not null,document_type text not null,classification documents.classification not null default 'internal',
  legal_hold boolean not null default false,current_version integer not null default 1,
  status platform.record_status not null default 'active',created_by uuid references auth.users(id),category text,
  created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,deleted_at timestamptz
);
create table documents.document_versions(
  id uuid primary key,tenant_id uuid not null references platform.tenants(id),
  document_id uuid not null references documents.documents(id),version integer not null,object_path text not null,
  sha256 text not null,mime_type text not null,size_bytes bigint,metadata_json jsonb not null default '{}',
  uploaded_by uuid references auth.users(id),checksum_status text not null default 'verified',
  scanning_status text not null default 'deferred',detected_mime_type text,created_at timestamptz not null default clock_timestamp(),
  unique(document_id,version),unique(tenant_id,sha256)
);
create table documents.upload_intents(
  id uuid primary key,tenant_id uuid not null references platform.tenants(id),context_id uuid not null,
  user_id uuid not null references auth.users(id),document_id uuid references documents.documents(id),
  bucket_id text not null default 'document-vault',object_path text not null unique,expected_version integer not null default 1,
  declared_mime_type text not null,max_size_bytes bigint not null,idempotency_key text,nonce text not null default 'fixture',
  status text not null,attempts integer not null default 0,max_attempts integer not null default 3,
  server_auth_hash text not null,expires_at timestamptz not null default(clock_timestamp()+interval '15 minutes'),
  consumed_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
create table documents.access_events(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,document_id uuid not null,
  version_id uuid,actor_id uuid,action text not null,purpose text,occurred_at timestamptz not null default clock_timestamp()
);
create table documents.document_scan_jobs(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,version_id uuid not null unique,
  state text not null default 'pending'
);
create table documents.document_scan_attestations(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null,version_id uuid not null unique,
  provider text not null check(provider='clamav'),scan_id uuid not null unique,
  verdict text not null check(verdict in ('clean','quarantined')),content_sha256 text not null,
  engine_version text not null,scanned_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp()
);
create function documents.protect_document_version() returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and old.scanning_status in ('deferred','scanning_pending')
    and new.scanning_status in ('clean','quarantined')
    and to_jsonb(new)-'scanning_status'=to_jsonb(old)-'scanning_status'
    and exists(select 1 from documents.document_scan_attestations a
      where a.id::text=current_setting('app.document_scan_attestation_id',true)
        and a.version_id=old.id and a.tenant_id=old.tenant_id
        and a.verdict=new.scanning_status and a.content_sha256=old.sha256)
  then return new; end if;
  raise exception using errcode='55000',message='document_versions_are_immutable';
end $$;
create trigger document_versions_immutable before update or delete on documents.document_versions
for each row execute function documents.protect_document_version();
create function documents.queue_document_scan() returns trigger language plpgsql as $$
begin insert into documents.document_scan_jobs(tenant_id,version_id) values(new.tenant_id,new.id); return new; end $$;
create trigger document_version_scan_queue_insert after insert on documents.document_versions
for each row execute function documents.queue_document_scan();
alter table documents.documents enable row level security;
alter table documents.document_versions enable row level security;
alter table documents.upload_intents enable row level security;
revoke all on documents.documents,documents.document_versions,documents.upload_intents from public,anon,authenticated;
`;

try {
  await pool.query(bootstrapSql);
  for (const migration of ['20261013063739_document_reference_exact_workspace_v1.sql',
    '20261014083050_document_workspace_binding_writer_v1.sql']) {
    await pool.query(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
  }
  await pool.query('insert into auth.users(id,email) values($1,$2)',
    [actor, `doc-writer-${randomUUID()}@example.invalid`]);
  await pool.query('insert into platform.tenants(id) values($1)', [ids.tenantId]);
  await pool.query('insert into platform.customer_workspaces(id,tenant_id) values($1,$3),($2,$3)',
    [ids.workspaceIds[0], ids.workspaceIds[1], ids.tenantId]);
  await pool.query(`insert into identity.memberships(id,tenant_id,user_id,status,starts_at)
    values($1,$2,$3,'active',clock_timestamp()-interval '1 day')`, [ids.membershipId, ids.tenantId, actor]);
  await pool.query(`insert into identity.context_grants(id,membership_id,tenant_id,starts_at)
    values($1,$2,$3,clock_timestamp()-interval '1 day')`, [ids.contextId, ids.membershipId, ids.tenantId]);
  await pool.query(`insert into documents.documents(id,tenant_id,title,document_type,created_by)
    values($1,$2,'Historical document','legacy',$3)`, [legacyDocumentId, ids.tenantId, actor]);
  await pool.query(`insert into documents.upload_intents
    (id,tenant_id,context_id,user_id,object_path,declared_mime_type,max_size_bytes,status,server_auth_hash)
    values($1,$2,$3,$4,$5,'application/pdf',1024,'authorized',$6)`, [
    legacyIntentId, ids.tenantId, ids.contextId, actor,
    `${ids.tenantId}/${legacyIntentId}/legacy.pdf`, 'b'.repeat(64),
  ]);
  const historicalBefore = (await pool.query(`select
    (select to_jsonb(d) from documents.documents d where id=$1) document,
    (select to_jsonb(ui) from documents.upload_intents ui where id=$2) intent`,
  [legacyDocumentId, legacyIntentId])).rows[0];
  await pool.query(readFileSync(new URL(
    '../supabase/migrations/20261014200948_document_null_workspace_creation_closure_v1.sql',
    import.meta.url), 'utf8'));
  await pool.query(readFileSync(new URL(
    '../supabase/migrations/20261018094131_documents_canonical_storage_identity_v1.sql',
    import.meta.url), 'utf8'));
  await pool.query(readFileSync(new URL(
    '../supabase/migrations/20261018130000_documents_replacement_promotion_after_clean_v1.sql',
    import.meta.url), 'utf8'));
  await pool.query(readFileSync(new URL(
    '../supabase/migrations/20261018133000_documents_vault_download_exact_workspace_v2.sql',
    import.meta.url), 'utf8'));
  const documentsModule = { id: randomUUID(), entitlement_key: 'module.documents' };
  const permission = { id: randomUUID() }, readPermission = { id: randomUUID() };
  await pool.query(`insert into platform.module_definitions
    (id,code,is_active,lifecycle_status,valid_from,entitlement_key)
    values($1,'documents',true,'published',clock_timestamp()-interval '1 day',$2)`,
  [documentsModule.id, documentsModule.entitlement_key]);
  await pool.query("insert into identity.permissions(id,code) values($1,'documents.vault.upload')", [permission.id]);
  await pool.query("insert into identity.permissions(id,code) values($1,'documents.vault.read')", [readPermission.id]);
  for (let i = 0; i < 2; i += 1) {
    const workspaceRole = randomUUID();
    await pool.query(`insert into platform.workspace_modules
      (customer_workspace_id,module_definition_id,status,valid_from)
      values($1,$2,'active',clock_timestamp()-interval '1 second')`, [ids.workspaceIds[i], documentsModule.id]);
    await pool.query(`insert into platform.workspace_entitlements
      (customer_workspace_id,entitlement_key,boolean_value,valid_from)
      values($1,$2,true,clock_timestamp()-interval '1 second')`,
    [ids.workspaceIds[i], documentsModule.entitlement_key]);
    await pool.query(`insert into platform.workspace_roles
      (id,customer_workspace_id,lifecycle_status,valid_from)
      values($1,$2,'published',clock_timestamp()-interval '1 second')`, [workspaceRole, ids.workspaceIds[i]]);
    await pool.query('insert into platform.workspace_role_modules(workspace_role_id,module_definition_id) values($1,$2)',
      [workspaceRole, documentsModule.id]);
    await pool.query("insert into platform.workspace_role_permissions(workspace_role_id,permission_id,effect) values($1,$2,'allow')",
      [workspaceRole, permission.id]);
    await pool.query("insert into platform.workspace_role_permissions(workspace_role_id,permission_id,effect) values($1,$2,'allow')",
      [workspaceRole, readPermission.id]);
    await pool.query(`insert into platform.workspace_member_roles
      (id,customer_workspace_id,membership_id,workspace_role_id,valid_from)
      values($1,$2,$3,$4,clock_timestamp()-interval '1 second')`,
    [randomUUID(), ids.workspaceIds[i], ids.membershipId, workspaceRole]);
  }

  await check('closure preserves historical values and leaves every canonical addition NULL', async () => {
    const historicalAfter = (await pool.query(`select
      (select to_jsonb(d) from documents.documents d where id=$1) document,
      (select to_jsonb(ui) from documents.upload_intents ui where id=$2) intent`,
    [legacyDocumentId, legacyIntentId])).rows[0];
    const historicalProjection = structuredClone(historicalAfter);
    const canonicalColumns = [
      'operation_kind', 'expected_parent_version_id', 'committed_document_id',
      'committed_version_id', 'verified_storage_object_id', 'verified_storage_generation',
      'verified_storage_etag', 'verified_sha256', 'verified_size_bytes',
    ];
    for (const column of canonicalColumns) {
      assert.equal(historicalAfter.intent[column], null);
      delete historicalProjection.intent[column];
    }
    assert.deepEqual(historicalProjection, historicalBefore);
    assert.equal(historicalAfter.document.workspace_id, null);
    assert.equal(historicalAfter.intent.workspace_id, null);
    assert.equal(historicalAfter.intent.prospective_document_id, null);
  });

  await check('new NULL document and legacy unbound new-document intent fail with zero writes', async () => {
    const before = await digest();
    await assert.rejects(pool.query(`insert into documents.documents(id,tenant_id,title,document_type,created_by)
      values($1,$2,'Forbidden NULL document','legacy',$3)`, [randomUUID(), ids.tenantId, actor]),
    /document_workspace_binding_required_on_insert/);
    await assert.rejects(pool.query(`insert into documents.upload_intents
      (id,tenant_id,context_id,user_id,object_path,declared_mime_type,max_size_bytes,status,server_auth_hash)
      values($1,$2,$3,$4,$5,'application\/pdf',1024,'authorized',$6)`, [
      randomUUID(), ids.tenantId, ids.contextId, actor,
      `${ids.tenantId}/${randomUUID()}/legacy-new.pdf`, 'c'.repeat(64),
    ]), /document_operation_kind_required/);
    await assert.rejects(pool.query(`update documents.upload_intents
      set status='consumed',consumed_at=clock_timestamp(),attempts=attempts+1 where id=$1`,
    [legacyIntentId]), /document_workspace_binding_required_for_new_intent/);
    assert.equal(await digest(), before);
  });

  await check('RLS and write ACLs remain closed', async () => {
    const rows = await pool.query(`select c.relname,c.relrowsecurity,
      has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE') anon_write,
      has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') authenticated_write
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='documents' and c.relname in ('documents','document_versions','upload_intents')`);
    assert.equal(rows.rowCount, 3);
    for (const row of rows.rows) {
      assert.equal(row.relrowsecurity, true); assert.equal(row.anon_write, false);
      assert.equal(row.authenticated_write, false);
    }
    const functions = await pool.query(`select p.proname,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proacl::text acl
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='documents' and p.proname in
        ('reject_unbound_new_document_intent_v1','require_workspace_bound_document_insert_v1')
      order by p.proname`);
    assert.equal(functions.rowCount, 2);
    for (const fn of functions.rows) {
      assert.equal(fn.owner, 'postgres'); assert.equal(fn.prosecdef, false);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal((await pool.query('select has_function_privilege($1,$2::regprocedure,\'EXECUTE\') allowed',
          [role, `documents.${fn.proname}()`])).rows[0].allowed, false);
      }
    }
  });

  let committed, committedFinal, replayCandidate;
  await check('Core host commits exact Workspace intent and immutable initial version with deferred scan', async () => {
    committed = await issueFixture();
    const intentRow = (await pool.query(`select workspace_id::text,prospective_document_id::text,document_id,status
      from documents.upload_intents where id=$1`, [committed.input.intent_id])).rows[0];
    assert.deepEqual(intentRow, { workspace_id: committed.input.workspace_id,
      prospective_document_id: committed.input.prospective_document_id, document_id: null, status: 'authorized' });
    committedFinal = await finalFixture(committed);
    const result = await host.execute(committedFinal.command, committedFinal.providers);
    assert.equal(result.status, 'committed');
    committedFinal.result = result;
    assert.equal(result.receipt.replay_validation.provider_code,
      api.DOCUMENTS_WORKSPACE_WRITER_REPLAY_PROVIDER_CODE_V1);
    const row = (await pool.query(`select d.workspace_id::text,d.current_version,v.id::text version_id,
      v.scanning_status,v.checksum_status,v.metadata_json,ui.status,ui.consumed_at is not null consumed,
      q.state scan_job_state
      from documents.documents d join documents.document_versions v on v.document_id=d.id
      join documents.upload_intents ui on ui.id=$2
      join documents.document_scan_jobs q on q.version_id=v.id where d.id=$1`,
    [committed.input.prospective_document_id, committed.input.intent_id])).rows[0];
    assert.equal(row.workspace_id, committed.input.workspace_id); assert.equal(row.current_version, 1);
    assert.equal(row.version_id, committedFinal.input.version_id); assert.equal(row.scanning_status, 'deferred');
    assert.equal(row.checksum_status, 'verified'); assert.equal(row.status, 'consumed');
    assert.equal(row.consumed, true); assert.equal(row.scan_job_state, 'pending');
    assert.equal(row.metadata_json.workspace_id, committed.input.workspace_id);
    assert.equal(row.metadata_json.upload_intent_id, committed.input.intent_id);
  });

  await check('document Workspace and initial version provenance are immutable', async () => {
    for (const next of [ids.workspaceIds[1], null]) {
      await assert.rejects(pool.query('update documents.documents set workspace_id=$2 where id=$1',
        [committed.input.prospective_document_id, next]), /document_workspace_binding_is_immutable/);
    }
    const legacy = (await pool.query("select id from documents.documents where title='Historical document'")).rows[0].id;
    await assert.rejects(pool.query('update documents.documents set workspace_id=$2 where id=$1',
      [legacy, ids.workspaceIds[0]]), /document_workspace_binding_is_immutable/);
    await assert.rejects(pool.query("update documents.document_versions set metadata_json='{}' where id=$1",
      [committedFinal.input.version_id]), /document_versions_are_immutable/);
  });

  await check('same-tenant cross-Workspace finalization denies with zero SQL writes', async () => {
    const issue = await issueFixture();
    const candidate = await finalFixture(issue, { workspace_id: ids.workspaceIds[1] });
    await deniedZeroWrite(candidate, 'PROVIDER_UNAVAILABLE');
  });

  await check('historical NULL intent cannot finalize through the bound writer', async () => {
    const legacy = (await pool.query("select id,object_path from documents.upload_intents where workspace_id is null limit 1")).rows[0];
    const fakeIssue = { input: { intent_id: legacy.id, prospective_document_id: randomUUID(),
      workspace_id: ids.workspaceIds[0], object_path: legacy.object_path } };
    await deniedZeroWrite(await finalFixture(fakeIssue), 'PROVIDER_UNAVAILABLE');
  });

  await check('revoked current authority leaves the bound intent unconsumed and produces zero writes', async () => {
    const issue = await issueFixture();
    const candidate = await finalFixture(issue);
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key=$2`, [ids.workspaceIds[0], documentsModule.entitlement_key]);
    await pool.query('update app_private.canonical_authority_revision_v1 set revision=revision+1 where singleton');
    candidate.context.authority_version = await revision();
    candidate.command = api.buildDocumentsInitialVersionCommandV1(candidate.input, candidate.context, candidate.verified);
    candidate.providers = withSyntheticAal2(
      api.createDocumentsInitialVersionProvidersV1(candidate.input, candidate.context, candidate.verified), candidate.counters);
    await deniedZeroWrite(candidate, 'AUTHORITY_DENIED');
    assert.deepEqual((await pool.query('select status,consumed_at from documents.upload_intents where id=$1',
      [issue.input.intent_id])).rows[0], { status: 'authorized', consumed_at: null });
    await pool.query(`update platform.workspace_entitlements set boolean_value=true
      where customer_workspace_id=$1 and entitlement_key=$2`, [ids.workspaceIds[0], documentsModule.entitlement_key]);
    await pool.query('update app_private.canonical_authority_revision_v1 set revision=revision+1 where singleton');
  });

  await check('concurrent fresh finalizations serialize to one document/version/consume', async () => {
    const issue = await issueFixture();
    const first = await finalFixture(issue), second = await finalFixture(issue);
    const outcomes = await Promise.all([
      host.execute(first.command, first.providers), host.execute(second.command, second.providers),
    ]);
    assert.equal(outcomes.filter(value => value.status === 'committed').length, 1);
    assert.equal(outcomes.filter(value => value.status === 'denied').length, 1);
    const counts = (await pool.query(`select
      (select count(*)::int from documents.documents where id=$1) documents,
      (select count(*)::int from documents.document_versions where document_id=$1) versions,
      (select attempts::int from documents.upload_intents where id=$2) attempts`,
    [issue.input.prospective_document_id, issue.input.intent_id])).rows[0];
    assert.deepEqual(counts, { documents: 1, versions: 1, attempts: 1 });
  });

  await check('exact replay rechecks consumed Documents state after Core authority and skips fresh validation/mutation', async () => {
    const replayIssue = await issueFixture();
    replayCandidate = await finalFixture(replayIssue);
    replayCandidate.result = await host.execute(replayCandidate.command, replayCandidate.providers);
    assert.equal(replayCandidate.result.status, 'committed');
    const before = await digest();
    const counters = { ...replayCandidate.counters };
    const replay = await host.execute(replayCandidate.command, replayCandidate.providers);
    assert.equal(replay.status, 'exact_replay', JSON.stringify(replay));
    assert.ok(replayCandidate.counters.authority > counters.authority);
    assert.equal(replayCandidate.counters.replay, counters.replay + 1);
    assert.equal(replayCandidate.counters.validation, counters.validation);
    assert.equal(replayCandidate.counters.mutation, counters.mutation);
    assert.equal(await digest(), before);
  });

  await check('committed intent cannot be reopened and changed document denies replay with zero writes', async () => {
    const beforeReplay = replayCandidate.counters.replay;
    const beforeTamper = await digest();
    await assert.rejects(pool.query(`update documents.upload_intents
      set status='authorized',consumed_at=null,attempts=0 where id=$1`,
    [replayCandidate.input.intent_id]), /upload_intents_canonical_commit_v1/);
    assert.equal(await digest(), beforeTamper);
    await pool.query('update documents.documents set title=$2 where id=$1',
      [replayCandidate.input.document_id, 'Changed after commit']);
    try {
      await deniedZeroWrite(replayCandidate, 'REPLAY_CONFLICT');
    } finally {
      await pool.query('update documents.documents set title=$2 where id=$1',
        [replayCandidate.input.document_id, replayCandidate.input.title]);
    }
    assert.equal(replayCandidate.counters.replay, beforeReplay + 1);
    assert.equal(replayCandidate.counters.validation, 1);
    assert.equal(replayCandidate.counters.mutation, 1);
  });

  await check('historical receipt without replay marker fails unavailable without auto-upgrade', async () => {
    const key = `core-tx.v1:${replayCandidate.command.workspace_id}:${replayCandidate.command.idempotency_key}`;
    const historical = structuredClone(replayCandidate.result.receipt);
    delete historical.replay_validation;
    const beforeReplay = replayCandidate.counters.replay;
    try {
      await pool.query(`update platform.idempotency_keys set response_ref=$3::jsonb
        where tenant_id=$1 and key=$2`, [ids.tenantId, key, JSON.stringify(historical)]);
      await deniedZeroWrite(replayCandidate, 'PROVIDER_UNAVAILABLE');
      assert.equal(replayCandidate.counters.replay, beforeReplay);
      const stored = (await pool.query(`select response_ref from platform.idempotency_keys
        where tenant_id=$1 and key=$2`, [ids.tenantId, key])).rows[0].response_ref;
      assert.equal(Object.hasOwn(stored, 'replay_validation'), false);
    } finally {
      await pool.query(`update platform.idempotency_keys set response_ref=$3::jsonb
        where tenant_id=$1 and key=$2`, [
        ids.tenantId, key, JSON.stringify(replayCandidate.result.receipt),
      ]);
    }
  });

  await check('malformed replay evidence fails unavailable with zero writes', async () => {
    const baseHook = replayCandidate.providers.validateReplay.bind(replayCandidate.providers);
    const malformed = {
      ...replayCandidate,
      providers: { ...replayCandidate.providers, async validateReplay(...args) {
        const decision = await baseHook(...args);
        return { ...decision, receipt_hash: '0'.repeat(64) };
      } },
    };
    await deniedZeroWrite(malformed, 'PROVIDER_UNAVAILABLE');
  });

  await check('real PostgreSQL 40001 retries replay in a fresh Core transaction', async () => {
    const blocker = await pool.connect();
    const attempts = [], errorCodes = [];
    let entered;
    const hookEntered = new Promise(resolve => { entered = resolve; });
    const baseHook = replayCandidate.providers.validateReplay.bind(replayCandidate.providers);
    const retryCandidate = {
      ...replayCandidate,
      providers: { ...replayCandidate.providers, async validateReplay(scope, ...args) {
        attempts.push(scope.attempt);
        if (scope.attempt === 1) entered();
        try { return await baseHook(scope, ...args); } catch (error) {
          if (error?.code) errorCodes.push(error.code);
          throw error;
        }
      } },
    };
    const before = await digest();
    const beforeValidation = replayCandidate.counters.validation;
    const beforeMutation = replayCandidate.counters.mutation;
    try {
      await blocker.query('begin');
      await blocker.query('update documents.documents set title=title where id=$1',
        [replayCandidate.input.document_id]);
      const pending = host.execute(retryCandidate.command, retryCandidate.providers);
      await hookEntered;
      await blocker.query('commit');
      assert.equal((await pending).status, 'exact_replay');
      assert.deepEqual(errorCodes, ['40001']);
      assert.deepEqual(attempts, [1, 2]);
      assert.equal(replayCandidate.counters.validation, beforeValidation);
      assert.equal(replayCandidate.counters.mutation, beforeMutation);
      assert.equal(await digest(), before);
    } finally {
      await blocker.query('rollback').catch(() => {});
      blocker.release();
    }
  });

  await check('revoked authority denies before replay hook with zero writes', async () => {
    const beforeReplay = replayCandidate.counters.replay;
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key=$2`, [
      ids.workspaceIds[0], documentsModule.entitlement_key,
    ]);
    try {
      await deniedZeroWrite(replayCandidate, 'AUTHORITY_DENIED');
      assert.equal(replayCandidate.counters.replay, beforeReplay);
    } finally {
      await pool.query(`update platform.workspace_entitlements set boolean_value=true
        where customer_workspace_id=$1 and entitlement_key=$2`, [
        ids.workspaceIds[0], documentsModule.entitlement_key,
      ]);
    }
  });

  let replacementCommitted;
  await check('replacement candidate commits atomically without promoting current_version', async () => {
    const issue = await replacementIssueFixture(
      committed.input.prospective_document_id, committedFinal.input.version_id);
    replacementCommitted = await replacementFinalFixture(issue);
    replacementCommitted.result = await host.execute(
      replacementCommitted.command, replacementCommitted.providers);
    assert.equal(replacementCommitted.result.status, 'committed');
    assert.equal(replacementCommitted.result.receipt.replay_validation.provider_code,
      replacementApi.DOCUMENTS_REPLACEMENT_WRITER_REPLAY_PROVIDER_CODE_V1);
    const row = (await pool.query(`select d.current_version,v.version,v.scanning_status,
        v.upload_intent_id::text,v.replaces_version_id::text,v.storage_object_id is not null exact_object,
        ui.status,ui.committed_document_id::text,ui.committed_version_id::text,q.state scan_job_state
      from documents.documents d
      join documents.document_versions v on v.document_id=d.id and v.id=$2
      join documents.upload_intents ui on ui.id=$3
      join documents.document_scan_jobs q on q.version_id=v.id
      where d.id=$1`, [committed.input.prospective_document_id,
      replacementCommitted.input.version_id, replacementCommitted.input.intent_id])).rows[0];
    assert.equal(row.current_version, 1); assert.equal(row.version, 2);
    assert.equal(row.scanning_status, 'scanning_pending');
    assert.equal(row.upload_intent_id, replacementCommitted.input.intent_id);
    assert.equal(row.replaces_version_id, committedFinal.input.version_id);
    assert.equal(row.exact_object, true); assert.equal(row.status, 'consumed');
    assert.equal(row.committed_document_id, committed.input.prospective_document_id);
    assert.equal(row.committed_version_id, replacementCommitted.input.version_id);
    assert.equal(row.scan_job_state, 'pending');
  });

  await check('replacement exact replay is read-only and revalidates current state', async () => {
    const before = await digest();
    const beforeCounters = { ...replacementCommitted.counters };
    const replay = await host.execute(replacementCommitted.command, replacementCommitted.providers);
    assert.equal(replay.status, 'exact_replay', JSON.stringify(replay));
    assert.equal(replacementCommitted.counters.replay, beforeCounters.replay + 1);
    assert.equal(replacementCommitted.counters.validation, beforeCounters.validation);
    assert.equal(replacementCommitted.counters.mutation, beforeCounters.mutation);
    assert.equal(await digest(), before);
  });

  await check('replacement cross-Workspace finalization denies with zero writes', async () => {
    const isolated = await issueFixture();
    const initial = await finalFixture(isolated);
    assert.equal((await host.execute(initial.command, initial.providers)).status, 'committed');
    const issue = await replacementIssueFixture(isolated.input.prospective_document_id,
      initial.input.version_id);
    const cross = await replacementFinalFixture(issue, { workspace_id: ids.workspaceIds[1] });
    await deniedZeroWrite(cross, 'PROVIDER_UNAVAILABLE');
    assert.equal((await pool.query('select status from documents.upload_intents where id=$1',
      [issue.input.intent_id])).rows[0].status, 'authorized');
  });

  await check('competing replacement candidates serialize to one version', async () => {
    const isolated = await issueFixture();
    const initial = await finalFixture(isolated);
    assert.equal((await host.execute(initial.command, initial.providers)).status, 'committed');
    const firstIssue = await replacementIssueFixture(isolated.input.prospective_document_id,
      initial.input.version_id);
    const secondIssue = await replacementIssueFixture(isolated.input.prospective_document_id,
      initial.input.version_id);
    const first = await replacementFinalFixture(firstIssue);
    const second = await replacementFinalFixture(secondIssue);
    const outcomes = await Promise.all([
      host.execute(first.command, first.providers), host.execute(second.command, second.providers),
    ]);
    assert.equal(outcomes.filter(value => value.status === 'committed').length, 1);
    assert.equal(outcomes.filter(value => value.status === 'denied').length, 1);
    const state = (await pool.query(`select
        (select count(*)::int from documents.document_versions where document_id=$1 and version=2) versions,
        (select count(*)::int from documents.upload_intents
          where document_id=$1 and operation_kind='replacement_version' and status='consumed') consumed
      `, [isolated.input.prospective_document_id])).rows[0];
    assert.deepEqual(state, { versions: 1, consumed: 1 });
  });

  await check('direct replacement promotion without Core marker is rejected with zero writes', async () => {
    const before = await digest();
    await assert.rejects(pool.query(`update documents.documents set current_version=2
      where id=$1 and current_version=1`, [committed.input.prospective_document_id]),
    /clean_replacement_promotion_required/);
    assert.equal(await digest(), before);
  });

  let promoted;
  await check('exact clean attestation permits one Core CAS promotion', async () => {
    const attestationId = await attestReplacement(replacementCommitted, 'clean');
    promoted = await promotionFixture(replacementCommitted, attestationId);
    promoted.result = await host.execute(promoted.command, promoted.providers);
    assert.equal(promoted.result.status, 'committed', JSON.stringify(promoted.result));
    assert.equal(promoted.result.receipt.replay_validation.provider_code,
      promotionApi.DOCUMENTS_REPLACEMENT_PROMOTION_REPLAY_PROVIDER_CODE_V1);
    const row = (await pool.query(`select d.current_version,v.scanning_status,a.provider,a.verdict,
        a.content_sha256=v.sha256 hash_matches,
        exists(select 1 from documents.access_events e where e.document_id=d.id
          and e.version_id=v.id and e.action='promote_version') event_recorded
      from documents.documents d
      join documents.document_versions v on v.document_id=d.id and v.id=$2
      join documents.document_scan_attestations a on a.id=$3
      where d.id=$1`, [promoted.input.document_id, promoted.input.candidate_version_id,
      promoted.input.attestation_id])).rows[0];
    assert.deepEqual(row, { current_version: 2, scanning_status: 'clean', provider: 'clamav',
      verdict: 'clean', hash_matches: true, event_recorded: true });
  });

  await check('promotion exact replay revalidates attestation and writes nothing', async () => {
    const before = await digest(), counters = { ...promoted.counters };
    const replay = await host.execute(promoted.command, promoted.providers);
    assert.equal(replay.status, 'exact_replay', JSON.stringify(replay));
    assert.equal(promoted.counters.replay, counters.replay + 1);
    assert.equal(promoted.counters.validation, counters.validation);
    assert.equal(promoted.counters.mutation, counters.mutation);
    assert.equal(await digest(), before);
  });

  let authorizedDownload;
  await check('D4 exact current clean download commits one access event and exposes canonical object only', async () => {
    authorizedDownload = await downloadFixture(promoted.input.document_id,
      promoted.input.candidate_version_id, promoted.input.candidate_version);
    const beforeEvents = Number((await pool.query(`select count(*)::int value
      from documents.access_events where document_id=$1 and action='authorized_download'`,
    [promoted.input.document_id])).rows[0].value);
    authorizedDownload.result = await host.execute(
      authorizedDownload.command, authorizedDownload.providers);
    assert.equal(authorizedDownload.result.status, 'committed', JSON.stringify(authorizedDownload.result));
    assert.equal(authorizedDownload.result.receipt.replay_validation.provider_code,
      downloadApi.DOCUMENTS_VAULT_DOWNLOAD_REPLAY_PROVIDER_CODE_V2);
    const exposed = authorizedDownload.bundle.readAuthorizedDownload();
    assert.equal(exposed.document_id, promoted.input.document_id);
    assert.equal(exposed.version_id, promoted.input.candidate_version_id);
    assert.equal(exposed.version, promoted.input.candidate_version);
    assert.equal(exposed.bucket_id, 'document-vault');
    assert.equal(exposed.storage_object_id, promoted.verified.storage_object_id);
    assert.equal(exposed.object_path, promoted.verified.object_path);
    assert.equal(exposed.expires_in_seconds, 60);
    const afterEvents = Number((await pool.query(`select count(*)::int value
      from documents.access_events where document_id=$1 and action='authorized_download'`,
    [promoted.input.document_id])).rows[0].value);
    assert.equal(afterEvents, beforeEvents + 1);
  });

  await check('D4 exact replay rechecks current provider state and creates no second event', async () => {
    const before = await digest(), counters = { ...authorizedDownload.counters };
    const replay = await host.execute(authorizedDownload.command, authorizedDownload.providers);
    assert.equal(replay.status, 'exact_replay', JSON.stringify(replay));
    assert.equal(authorizedDownload.counters.replay, counters.replay + 1);
    assert.equal(authorizedDownload.counters.validation, counters.validation);
    assert.equal(authorizedDownload.counters.mutation, counters.mutation);
    assert.equal(authorizedDownload.bundle.readAuthorizedDownload()?.version_id,
      promoted.input.candidate_version_id);
    assert.equal(await digest(), before);
  });

  await check('D4 stale version and same-tenant cross-Workspace requests deny with zero writes', async () => {
    const stale = await downloadFixture(promoted.input.document_id,
      committedFinal.input.version_id, 1);
    await deniedZeroWrite(stale, 'PROVIDER_UNAVAILABLE');
    const crossWorkspace = await downloadFixture(promoted.input.document_id,
      promoted.input.candidate_version_id, promoted.input.candidate_version,
      { workspace_id: ids.workspaceIds[1] });
    await deniedZeroWrite(crossWorkspace, 'PROVIDER_UNAVAILABLE');
  });

  await check('quarantined replacement cannot promote and produces zero writes', async () => {
    const isolated = await issueFixture();
    const initial = await finalFixture(isolated);
    assert.equal((await host.execute(initial.command, initial.providers)).status, 'committed');
    const issue = await replacementIssueFixture(isolated.input.prospective_document_id,
      initial.input.version_id);
    const candidate = await replacementFinalFixture(issue);
    assert.equal((await host.execute(candidate.command, candidate.providers)).status, 'committed');
    const attestationId = await attestReplacement(candidate, 'quarantined');
    const promotion = await promotionFixture(candidate, attestationId);
    await deniedZeroWrite(promotion, 'PROVIDER_UNAVAILABLE');
    assert.equal((await pool.query('select current_version from documents.documents where id=$1',
      [isolated.input.prospective_document_id])).rows[0].current_version, 1);

    const quarantinedCurrentIssue = await issueFixture();
    const quarantinedCurrent = await finalFixture(quarantinedCurrentIssue);
    assert.equal((await host.execute(quarantinedCurrent.command,
      quarantinedCurrent.providers)).status, 'committed');
    await attestReplacement(quarantinedCurrent, 'quarantined');
    const quarantinedDownload = await downloadFixture(
      quarantinedCurrent.input.document_id, quarantinedCurrent.input.version_id, 1);
    await deniedZeroWrite(quarantinedDownload, 'PROVIDER_UNAVAILABLE');
  });
} finally {
  await pool.end();
  if (adminPool && isolatedDatabaseName) {
    await adminPool.query(`drop database "${isolatedDatabaseName}" with (force)`);
    await adminPool.end();
  }
}

console.log(`Documents Workspace binding writer PostgreSQL: ${checks}/${checks} PASS; Core replay hook consumed`);
