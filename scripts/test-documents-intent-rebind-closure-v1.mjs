import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.DOCUMENTS_INTENT_REBIND_TEST_DATABASE_URL;
if (!connectionString || process.env.DOCUMENTS_INTENT_REBIND_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable target required');
}

const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || target.pathname !== '/postgres') {
  throw new Error('Local disposable PostgreSQL admin database only');
}

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const migrations = [
  'supabase/migrations/20261014083050_document_workspace_binding_writer_v1.sql',
  'supabase/migrations/20261014200948_document_null_workspace_creation_closure_v1.sql',
  'supabase/migrations/20261018094131_documents_canonical_storage_identity_v1.sql',
];
const migrationSql = migrations.map(read);
const executableMigrations = migrationSql.map(sql => sql.replace(/--.*$/gm, '')).join('\n');
const writer = read('src/lib/customer/documents-workspace-binding-writer-v1.ts');
const existingHarness = read('scripts/test-documents-workspace-binding-writer-postgres-v1.mjs');

// The closure must remain prospective. Historical identity is never inferred
// from a property/unit relationship or rewritten by a migration.
assert.doesNotMatch(executableMigrations, /\bupdate\s+documents\.upload_intents\b/i);
assert.doesNotMatch(executableMigrations, /\b(?:unit|property)_id\b[^;]*\bworkspace_id\b/i);
assert.doesNotMatch(writer, /\bfrom\s+[a-z_]+\.(?:units|properties)\b/i);
assert.match(writer, /id,tenant_id,workspace_id,property_id[^]*values\(\$1,\$2,\$3,null/i);
assert.match(existingHarness,
  /historical NULL intent cannot finalize through the bound writer[^]*deniedZeroWrite/i);

function runExistingWriterHarness() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath,
      ['scripts/test-documents-workspace-binding-writer-postgres-v1.mjs'], {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          DOC_WORKSPACE_WRITER_TEST_DATABASE_URL: connectionString,
          DOC_WORKSPACE_WRITER_EPHEMERAL: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { stderr += chunk; process.stderr.write(chunk); });
    child.once('error', reject);
    child.once('close', code => {
      if (code !== 0) {
        reject(new Error(`Documents writer PostgreSQL harness failed (${code})\n${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

const requiredHarnessEvidence = [
  'Core host commits exact Workspace intent and immutable initial version with deferred scan',
  'same-tenant cross-Workspace finalization denies with zero SQL writes',
  'historical NULL intent cannot finalize through the bound writer',
  'exact replay rechecks consumed Documents state after Core authority and skips fresh validation/mutation',
  'committed intent cannot be reopened and changed document denies replay with zero writes',
  'replacement exact replay is read-only and revalidates current state',
  'replacement cross-Workspace finalization denies with zero writes',
];

const bootstrapSql = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
do $$ begin create role cladora_rpc_owner nologin; exception when duplicate_object then null; end $$;
do $$ begin create role cladora_ce_guide_runtime login; exception when duplicate_object then null; end $$;
do $$ begin create role cladora_ce_guide_executor nologin; exception when duplicate_object then null; end $$;
create schema platform;
create schema documents;
create schema app_private;
create function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
returns boolean language sql as $$select true$$;
create type platform.record_status as enum ('draft','active','suspended','archived');
create type documents.classification as enum ('public','internal','confidential','restricted');
create table platform.tenants(id uuid primary key);
create table platform.customer_workspaces(
  id uuid primary key,
  tenant_id uuid not null references platform.tenants(id),
  unique(id,tenant_id)
);
create table documents.documents(
  id uuid primary key,
  tenant_id uuid not null references platform.tenants(id),
  workspace_id uuid,
  property_id uuid,
  title text not null,
  document_type text not null,
  classification documents.classification not null default 'internal',
  current_version integer not null default 1,
  status platform.record_status not null default 'active',
  created_by uuid,
  category text,
  archived_at timestamptz,
  deleted_at timestamptz,
  unique(tenant_id,id)
);
create table documents.document_versions(
  id uuid primary key,
  tenant_id uuid not null references platform.tenants(id),
  document_id uuid not null references documents.documents(id),
  version integer not null,
  object_path text not null,
  sha256 text not null,
  mime_type text not null,
  size_bytes bigint,
  metadata_json jsonb not null default '{}',
  uploaded_by uuid,
  checksum_status text not null default 'verified',
  scanning_status text not null default 'deferred',
  detected_mime_type text,
  unique(document_id,version),
  unique(tenant_id,sha256)
);
create table documents.upload_intents(
  id uuid primary key,
  tenant_id uuid not null references platform.tenants(id),
  context_id uuid not null,
  user_id uuid not null,
  document_id uuid references documents.documents(id),
  bucket_id text not null default 'document-vault',
  object_path text not null unique,
  expected_version integer not null default 1,
  declared_mime_type text not null,
  max_size_bytes bigint not null,
  idempotency_key text,
  nonce text not null default 'fixture',
  status text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  server_auth_hash text not null,
  expires_at timestamptz not null default (clock_timestamp()+interval '15 minutes'),
  consumed_at timestamptz
);
`;

const adminPool = new pg.Pool({ connectionString, max: 1 });
const focusedDatabase = `documents_intent_rebind_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
let focusedPool;
let checks = 0;
const check = async (name, run) => {
  await run();
  console.log(`ok ${++checks} - ${name}`);
};

try {
  await check('existing canonical writer harness retains exact Workspace, cross-Workspace and replay gates', async () => {
    const output = await runExistingWriterHarness();
    for (const evidence of requiredHarnessEvidence) assert.match(output, new RegExp(evidence));
  });

  await adminPool.query(`create database "${focusedDatabase}"`);
  const focusedTarget = new URL(connectionString);
  focusedTarget.pathname = `/${focusedDatabase}`;
  focusedPool = new pg.Pool({ connectionString: focusedTarget.toString(), max: 2 });
  await focusedPool.query(bootstrapSql);
  await focusedPool.query(migrationSql[0]);

  const tenantId = randomUUID();
  const workspaceId = randomUUID();
  const otherWorkspaceId = randomUUID();
  const contextId = randomUUID();
  const actorId = randomUUID();
  const historicalIntentId = randomUUID();
  await focusedPool.query('insert into platform.tenants(id) values($1)', [tenantId]);
  await focusedPool.query(
    'insert into platform.customer_workspaces(id,tenant_id) values($1,$3),($2,$3)',
    [workspaceId, otherWorkspaceId, tenantId]);
  await focusedPool.query(`insert into documents.upload_intents(
      id,tenant_id,context_id,user_id,object_path,declared_mime_type,max_size_bytes,
      status,server_auth_hash)
    values($1,$2,$3,$4,$5,'application/pdf',1024,'authorized',$6)`, [
    historicalIntentId, tenantId, contextId, actorId,
    `${tenantId}/${historicalIntentId}/historical.pdf`, 'a'.repeat(64),
  ]);

  const historicalBefore = (await focusedPool.query(
    'select to_jsonb(ui) value from documents.upload_intents ui where id=$1',
    [historicalIntentId])).rows[0].value;
  await focusedPool.query(migrationSql[1]);
  await focusedPool.query(migrationSql[2]);

  await check('migrations preserve historical NULL identity without default, inference or backfill', async () => {
    const state = (await focusedPool.query(`select workspace_id,prospective_document_id,
        operation_kind,expected_parent_version_id,committed_document_id,committed_version_id
      from documents.upload_intents where id=$1`, [historicalIntentId])).rows[0];
    assert.deepEqual(state, {
      workspace_id: null,
      prospective_document_id: null,
      operation_kind: null,
      expected_parent_version_id: null,
      committed_document_id: null,
      committed_version_id: null,
    });
    const originalProjection = (await focusedPool.query(`select to_jsonb(ui)
        - array['operation_kind','expected_parent_version_id',
          'committed_document_id','committed_version_id','verified_storage_object_id',
          'verified_storage_generation','verified_storage_etag','verified_sha256',
          'verified_size_bytes'] value
      from documents.upload_intents ui where id=$1`, [historicalIntentId])).rows[0].value;
    assert.deepEqual(originalProjection, historicalBefore);
    const defaultExpression = (await focusedPool.query(`select pg_get_expr(d.adbin,d.adrelid) value
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid='documents.upload_intents'::regclass and a.attname='workspace_id'`)).rows[0].value;
    assert.equal(defaultExpression, null);
    const triggerBodies = (await focusedPool.query(`select string_agg(
        pg_get_triggerdef(t.oid)||E'\n'||pg_get_functiondef(t.tgfoid),E'\n') value
      from pg_trigger t where t.tgrelid='documents.upload_intents'::regclass and not t.tgisinternal`)).rows[0].value;
    assert.doesNotMatch(triggerBodies, /\b(?:unit|property)_id\b/i);
  });

  await check('historical NULL upload intent rejects direct rebind with zero writes', async () => {
    const before = (await focusedPool.query(
      'select to_jsonb(ui)::text value from documents.upload_intents ui where id=$1',
      [historicalIntentId])).rows[0].value;
    await assert.rejects(focusedPool.query(`update documents.upload_intents
        set workspace_id=$2,prospective_document_id=$3,operation_kind='new_document'
      where id=$1`, [historicalIntentId, workspaceId, randomUUID()]),
    /document_upload_intent_binding_is_immutable/);
    const after = (await focusedPool.query(
      'select to_jsonb(ui)::text value from documents.upload_intents ui where id=$1',
      [historicalIntentId])).rows[0].value;
    assert.equal(after, before);
  });

  await check('non-NULL upload intent binding is immutable with zero writes', async () => {
    const canonicalIntentId = randomUUID();
    await focusedPool.query(`insert into documents.upload_intents(
        id,tenant_id,context_id,user_id,object_path,declared_mime_type,max_size_bytes,
        status,server_auth_hash,workspace_id,prospective_document_id,operation_kind)
      values($1,$2,$3,$4,$5,'application/pdf',1024,'authorized',$6,$7,$8,'new_document')`, [
      canonicalIntentId, tenantId, contextId, actorId,
      `${tenantId}/${canonicalIntentId}/v1.pdf`, 'b'.repeat(64), workspaceId, randomUUID(),
    ]);
    const before = (await focusedPool.query(
      'select to_jsonb(ui)::text value from documents.upload_intents ui where id=$1',
      [canonicalIntentId])).rows[0].value;
    await assert.rejects(focusedPool.query(
      'update documents.upload_intents set workspace_id=$2 where id=$1',
      [canonicalIntentId, otherWorkspaceId]), /document_upload_intent_binding_is_immutable/);
    const after = (await focusedPool.query(
      'select to_jsonb(ui)::text value from documents.upload_intents ui where id=$1',
      [canonicalIntentId])).rows[0].value;
    assert.equal(after, before);
  });
} finally {
  if (focusedPool) await focusedPool.end();
  await adminPool.query(`drop database if exists "${focusedDatabase}" with (force)`);
  await adminPool.end();
}

console.log(`Documents intent rebind closure: ${checks}/${checks} PASS`);
