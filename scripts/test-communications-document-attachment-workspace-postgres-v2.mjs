import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.COMM_ATTACHMENT_WORKSPACE_TEST_DATABASE_URL;
if (!connectionString || process.env.COMM_ATTACHMENT_WORKSPACE_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Communications attachment target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || !['/postgres', '/communications_attachment_test'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

let adminPool = null;
let isolatedDatabaseName = null;
if (target.pathname === '/postgres') {
  isolatedDatabaseName = `communications_attachment_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  adminPool = new pg.Pool({ connectionString, max: 1 });
  await adminPool.query(`create database "${isolatedDatabaseName}"`);
  target.pathname = `/${isolatedDatabaseName}`;
}

const pool = new pg.Pool({ connectionString: target.toString(), max: 4 });
const tenantId = randomUUID(), workspaceId = randomUUID(), otherWorkspaceId = randomUUID();
const actorMembershipId = randomUUID(), participantMembershipId = randomUUID();
const conversationId = randomUUID(), nullConversationId = randomUUID();
const messageId = randomUUID(), nullMessageId = randomUUID();
const documentId = randomUUID(), otherDocumentId = randomUUID(), staleDocumentId = randomUUID();
const versionId = randomUUID(), otherVersionId = randomUUID(), staleVersionId = randomUUID();
const attestationId = randomUUID(), otherAttestationId = randomUUID();
let checks = 0;
const check = async (name, run) => {
  await run();
  console.log(`ok ${++checks} - ${name}`);
};

function marker(values) {
  return JSON.stringify({
    contract_version: 'communications-document-attachment-workspace.v2',
    tenant_id: tenantId,
    workspace_id: workspaceId,
    conversation_id: conversationId,
    message_id: messageId,
    document_id: documentId,
    version_id: versionId,
    attached_by: actorMembershipId,
    ...values,
  });
}

async function insertAttachment(values = {}, markerValues = {}) {
  const row = {
    id: randomUUID(), conversation_id: conversationId, message_id: messageId,
    document_id: documentId, version_id: versionId, attached_by: actorMembershipId,
    ...values,
  };
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (markerValues !== null) {
      await client.query(`select set_config(
        'communications.document_attachment_workspace_gate_v2',$1,true)`,
      [marker({ ...row, ...markerValues })]);
    }
    await client.query(`insert into communications.private_message_documents(
      id,conversation_id,message_id,document_id,version_id,attached_by)
      values($1,$2,$3,$4,$5,$6)`, [row.id, row.conversation_id, row.message_id,
      row.document_id, row.version_id, row.attached_by]);
    await client.query('commit');
    return row;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await pool.query(`
    do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_rpc_owner nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_ce_guide_runtime login; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_ce_guide_executor nologin; exception when duplicate_object then null; end $$;
    create schema platform; create schema identity; create schema documents;
    create schema communications; create schema customer_api; create schema app_private;
    create type platform.record_status as enum ('active','inactive');
    create function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
      returns boolean language sql as $$select true$$;
    create table identity.memberships(id uuid primary key);
    create table communications.private_conversations(
      id uuid primary key,tenant_id uuid not null,workspace_id uuid);
    create table communications.private_messages(
      id uuid primary key,conversation_id uuid not null,sender_id uuid not null,
      version bigint not null,lifecycle_state text not null);
    create table communications.private_participants(
      conversation_id uuid not null,membership_id uuid not null,revoked_at timestamptz,
      primary key(conversation_id,membership_id));
    create table documents.documents(
      id uuid primary key,tenant_id uuid not null,workspace_id uuid not null,
      status platform.record_status not null,archived_at timestamptz,deleted_at timestamptz,
      current_version bigint not null);
    create table documents.document_versions(
      id uuid primary key,tenant_id uuid not null,document_id uuid not null,
      version bigint not null,checksum_status text not null,scanning_status text not null,
      sha256 text not null);
    create table documents.document_scan_attestations(
      id uuid primary key,tenant_id uuid not null,version_id uuid not null,
      provider text not null,verdict text not null,content_sha256 text not null);
    create table documents.document_permissions(
      id uuid primary key,tenant_id uuid not null,document_id uuid not null,
      membership_id uuid,permission text not null,valid_from timestamptz not null,
      valid_until timestamptz);
    create table communications.private_message_documents(
      id uuid primary key,conversation_id uuid not null,message_id uuid not null,
      document_id uuid not null,version_id uuid not null,attached_by uuid not null,
      unique(message_id,document_id,version_id));
    create function communications.validate_private_attachment()
      returns trigger language plpgsql as $$begin return new; end$$;
    create trigger private_attachment_integrity before insert or update
      on communications.private_message_documents for each row
      execute function communications.validate_private_attachment();
    create function communications.private_document_member_grant(uuid,uuid,uuid)
      returns boolean language sql as $$select false$$;
    grant all on communications.private_message_documents to service_role;
  `);

  await pool.query(`insert into identity.memberships(id) values($1),($2)`,
  [actorMembershipId, participantMembershipId]);
  await pool.query(`insert into communications.private_conversations(id,tenant_id,workspace_id)
    values($1,$2,$3),($4,$2,null)`, [conversationId, tenantId, workspaceId, nullConversationId]);
  await pool.query(`insert into communications.private_messages(
      id,conversation_id,sender_id,version,lifecycle_state)
    values($1,$2,$3,3,'available'),($4,$5,$3,1,'available')`,
  [messageId, conversationId, actorMembershipId, nullMessageId, nullConversationId]);
  await pool.query(`insert into communications.private_participants(
      conversation_id,membership_id,revoked_at)
    values($1,$2,null),($1,$3,null),($4,$2,null),($4,$3,null)`,
  [conversationId, actorMembershipId, participantMembershipId, nullConversationId]);
  await pool.query(`insert into documents.documents(
      id,tenant_id,workspace_id,status,archived_at,deleted_at,current_version)
    values($1,$2,$3,'active',null,null,4),
      ($4,$2,$5,'active',null,null,1),($6,$2,$3,'active',null,null,2)`,
  [documentId, tenantId, workspaceId, otherDocumentId, otherWorkspaceId, staleDocumentId]);
  await pool.query(`insert into documents.document_versions(
      id,tenant_id,document_id,version,checksum_status,scanning_status,sha256)
    values($1,$2,$3,4,'verified','clean',$4),
      ($5,$2,$6,1,'verified','clean',$7),
      ($8,$2,$9,1,'verified','clean',$10)`,
  [versionId, tenantId, documentId, 'a'.repeat(64), otherVersionId, otherDocumentId,
    'b'.repeat(64), staleVersionId, staleDocumentId, 'c'.repeat(64)]);
  await pool.query(`insert into documents.document_scan_attestations(
      id,tenant_id,version_id,provider,verdict,content_sha256)
    values($1,$2,$3,'clamav','clean',$4),($5,$2,$6,'clamav','clean',$7)`,
  [attestationId, tenantId, versionId, 'a'.repeat(64), otherAttestationId,
    otherVersionId, 'b'.repeat(64)]);
  await pool.query(`insert into documents.document_permissions(
      id,tenant_id,document_id,membership_id,permission,valid_from,valid_until)
    values($1,$2,$3,$4,'view',clock_timestamp()-interval '1 hour',null),
      ($5,$2,$3,$6,'view',clock_timestamp()-interval '1 hour',null)`,
  [randomUUID(), tenantId, documentId, actorMembershipId, randomUUID(), participantMembershipId]);

  const beforeAcl = (await pool.query(`select has_table_privilege(
    'service_role','communications.private_message_documents','INSERT,UPDATE,DELETE,SELECT') value`)
  ).rows[0].value;
  await pool.query(readFileSync(new URL(
    '../supabase/migrations/20261018143000_communications_document_attachment_workspace_gate_v2.sql',
    import.meta.url), 'utf8'));

  await check('exact marker and equal Workspaces admit one attachment', async () => {
    const inserted = await insertAttachment();
    assert.equal((await pool.query(`select count(*)::integer count
      from communications.private_message_documents where id=$1`, [inserted.id])).rows[0].count, 1);
  });

  await check('missing or mismatched canonical marker fails closed with zero writes', async () => {
    const before = (await pool.query(`select count(*)::integer count
      from communications.private_message_documents`)).rows[0].count;
    await assert.rejects(insertAttachment({ id: randomUUID() }, null),
      /canonical_private_attachment_writer_required/);
    await assert.rejects(insertAttachment({ id: randomUUID() }, { workspace_id: otherWorkspaceId }),
      /canonical_private_attachment_writer_required/);
    assert.equal((await pool.query(`select count(*)::integer count
      from communications.private_message_documents`)).rows[0].count, before);
  });

  await check('same-tenant cross-Workspace document fails closed with zero writes', async () => {
    await assert.rejects(insertAttachment({ id: randomUUID(), document_id: otherDocumentId,
      version_id: otherVersionId }, { document_id: otherDocumentId, version_id: otherVersionId }),
    /private_attachment_workspace_mismatch/);
  });

  await check('historical NULL conversation cannot receive an attachment', async () => {
    await assert.rejects(insertAttachment({ id: randomUUID(), conversation_id: nullConversationId,
      message_id: nullMessageId }, { conversation_id: nullConversationId, message_id: nullMessageId }),
    /private_attachment_workspace_mismatch/);
  });

  await check('non-current or unattested version fails closed', async () => {
    await assert.rejects(insertAttachment({ id: randomUUID(), document_id: staleDocumentId,
      version_id: staleVersionId }, { document_id: staleDocumentId, version_id: staleVersionId }),
    /private_attachment_workspace_mismatch/);
  });

  await check('participant grants must pre-exist and D6 never auto-grants', async () => {
    assert.equal((await pool.query(`select communications.private_document_member_grant($1,$2,$3) value`,
    [conversationId, documentId, participantMembershipId])).rows[0].value, true);
    await pool.query(`delete from documents.document_permissions where membership_id=$1`,
    [participantMembershipId]);
    assert.equal((await pool.query(`select communications.private_document_member_grant($1,$2,$3) value`,
    [conversationId, documentId, participantMembershipId])).rows[0].value, false);
    assert.equal((await pool.query(`select count(*)::integer count
      from documents.document_permissions where membership_id=$1`, [participantMembershipId]))
    .rows[0].count, 0);
  });

  await check('legacy entrypoints are zero-write tombstones and S4 ACL is unchanged', async () => {
    const before = (await pool.query(`select count(*)::integer count
      from communications.private_message_documents`)).rows[0].count;
    await assert.rejects(pool.query(
      `select customer_api.attach_private_document_v1(null,null,null,null,null)`),
    /canonical_private_attachment_required/);
    assert.equal((await pool.query(`select count(*)::integer count
      from communications.private_message_documents`)).rows[0].count, before);
    const afterAcl = (await pool.query(`select has_table_privilege(
      'service_role','communications.private_message_documents','INSERT,UPDATE,DELETE,SELECT') value`)
    ).rows[0].value;
    assert.equal(beforeAcl, true);
    assert.equal(afterAcl, true);
  });
} finally {
  await pool.end();
  if (adminPool && isolatedDatabaseName) {
    await adminPool.query(`drop database "${isolatedDatabaseName}" with (force)`);
    await adminPool.end();
  }
}

console.log(`Communications document attachment Workspace PostgreSQL: ${checks}/${checks} PASS`);
