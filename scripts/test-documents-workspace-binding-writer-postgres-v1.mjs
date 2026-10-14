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
let checks = 0;
const check = async (name, run) => { await run(); console.log(`ok ${++checks} - ${name}`); };
const revision = async () => Number((await pool.query(
  'select revision::text from app_private.canonical_authority_revision_v1 where singleton')).rows[0].revision);

const stateTables = [
  'documents.documents', 'documents.document_versions', 'documents.upload_intents',
  'documents.access_events', 'documents.document_scan_jobs', 'platform.idempotency_keys',
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
  const counters = { authority: 0, validation: 0, mutation: 0 };
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
    sha256: createHash('sha256').update(versionId).digest('hex'), size_bytes: 1024,
    detected_mime_type: 'application/pdf', non_overwritable: true,
  }));
  const context = { transaction_id: randomUUID(), command_id: randomUUID(), actor_id: actor,
    authority_version: await revision() };
  const command = api.buildDocumentsInitialVersionCommandV1(input, context, verified);
  const counters = { authority: 0, validation: 0, mutation: 0 };
  const providers = withSyntheticAal2(
    api.createDocumentsInitialVersionProvidersV1(input, context, verified), counters);
  return { input, verified, context, command, providers, counters };
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
create schema auth; create schema platform; create schema identity; create schema documents;
create schema app_private; create schema audit;
create extension if not exists pgcrypto;
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
create function documents.protect_document_version() returns trigger language plpgsql as $$
begin raise exception using errcode='55000',message='document_versions_are_immutable'; end $$;
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
  const documentsModule = { id: randomUUID(), entitlement_key: 'module.documents' };
  const permission = { id: randomUUID() };
  await pool.query(`insert into platform.module_definitions
    (id,code,is_active,lifecycle_status,valid_from,entitlement_key)
    values($1,'documents',true,'published',clock_timestamp()-interval '1 day',$2)`,
  [documentsModule.id, documentsModule.entitlement_key]);
  await pool.query("insert into identity.permissions(id,code) values($1,'documents.vault.upload')", [permission.id]);
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
    await pool.query(`insert into platform.workspace_member_roles
      (id,customer_workspace_id,membership_id,workspace_role_id,valid_from)
      values($1,$2,$3,$4,clock_timestamp()-interval '1 second')`,
    [randomUUID(), ids.workspaceIds[i], ids.membershipId, workspaceRole]);
  }

  await check('migration is additive, preserves populated NULL rows and performs no backfill', async () => {
    const legacyDocument = randomUUID(), legacyIntent = randomUUID();
    await pool.query(`insert into documents.documents(id,tenant_id,title,document_type,created_by)
      values($1,$2,'Historical document','legacy',$3)`, [legacyDocument, ids.tenantId, actor]);
    await pool.query(`insert into documents.upload_intents
      (id,tenant_id,context_id,user_id,object_path,declared_mime_type,max_size_bytes,status,server_auth_hash)
      values($1,$2,$3,$4,$5,'application/pdf',1024,'authorized',$6)`,
    [legacyIntent, ids.tenantId, ids.contextId, actor, `${ids.tenantId}/${legacyIntent}/legacy.pdf`, 'b'.repeat(64)]);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('drop trigger document_workspace_binding_immutable_v1 on documents.documents');
      await client.query('drop function documents.reject_document_workspace_rebind_v1()');
      await client.query('alter table documents.upload_intents drop column workspace_id, drop column prospective_document_id');
      const rowsBefore = (await client.query(`select
        (select to_jsonb(d) - 'workspace_id' from documents.documents d where id=$1) document,
        (select to_jsonb(ui) from documents.upload_intents ui where id=$2) intent`,
      [legacyDocument, legacyIntent])).rows[0];
      const aclBefore = (await client.query(`select relacl::text,relrowsecurity,relforcerowsecurity
        from pg_class where oid='documents.upload_intents'::regclass`)).rows[0];
      const migration = readFileSync(new URL(
        '../supabase/migrations/20261014083050_document_workspace_binding_writer_v1.sql', import.meta.url), 'utf8')
        .replace(/^begin;\s*/m, '').replace(/^commit;\s*$/m, '');
      await client.query(migration);
      const rowsAfter = (await client.query(`select
        (select to_jsonb(d) from documents.documents d where id=$1) - 'workspace_id' document,
        (select to_jsonb(ui) from documents.upload_intents ui where id=$2) - 'workspace_id' - 'prospective_document_id' intent`,
      [legacyDocument, legacyIntent])).rows[0];
      assert.deepEqual(rowsAfter, rowsBefore);
      assert.deepEqual((await client.query(`select relacl::text,relrowsecurity,relforcerowsecurity
        from pg_class where oid='documents.upload_intents'::regclass`)).rows[0], aclBefore);
      const nulls = (await client.query('select workspace_id,prospective_document_id from documents.upload_intents where id=$1', [legacyIntent])).rows[0];
      assert.deepEqual(nulls, { workspace_id: null, prospective_document_id: null });
    } finally { await client.query('rollback'); client.release(); }
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
  });

  let committed, committedFinal;
  await check('Core host commits exact Workspace intent and immutable initial version with deferred scan', async () => {
    committed = await issueFixture();
    const intentRow = (await pool.query(`select workspace_id::text,prospective_document_id::text,document_id,status
      from documents.upload_intents where id=$1`, [committed.input.intent_id])).rows[0];
    assert.deepEqual(intentRow, { workspace_id: committed.input.workspace_id,
      prospective_document_id: committed.input.prospective_document_id, document_id: null, status: 'authorized' });
    committedFinal = await finalFixture(committed);
    const result = await host.execute(committedFinal.command, committedFinal.providers);
    assert.equal(result.status, 'committed');
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

  await check('current exact replay rechecks Core authority but skips Documents validation and mutation', async () => {
    const replayIssue = await issueFixture();
    const replayFinal = await finalFixture(replayIssue);
    assert.equal((await host.execute(replayFinal.command, replayFinal.providers)).status, 'committed');
    const before = await digest();
    const counters = { ...replayFinal.counters };
    const replay = await host.execute(replayFinal.command, replayFinal.providers);
    assert.equal(replay.status, 'exact_replay');
    assert.ok(replayFinal.counters.authority > counters.authority);
    assert.equal(replayFinal.counters.validation, counters.validation);
    assert.equal(replayFinal.counters.mutation, counters.mutation);
    assert.equal(await digest(), before);
  });
} finally {
  await pool.end();
  if (adminPool && isolatedDatabaseName) {
    await adminPool.query(`drop database "${isolatedDatabaseName}" with (force)`);
    await adminPool.end();
  }
}

console.log(`Documents Workspace binding writer PostgreSQL: ${checks}/${checks} PASS; exact replay remains blocked on CORE-TRANSACTION-REPLAY-PROVIDER-HOOK-01`);
