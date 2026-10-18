import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.COMM_CURRENTNESS_TEST_DATABASE_URL;
if (!connectionString || process.env.COMM_CURRENTNESS_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Communications currentness target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || !['/postgres', '/communications_currentness_test'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

let adminPool = null;
let isolatedDatabaseName = null;
if (target.pathname === '/postgres') {
  isolatedDatabaseName = `communications_currentness_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  adminPool = new pg.Pool({ connectionString, max: 1 });
  await adminPool.query(`create database "${isolatedDatabaseName}"`);
  target.pathname = `/${isolatedDatabaseName}`;
}

const pool = new pg.Pool({ connectionString: target.toString(), max: 3 });
const actorId = randomUUID(), membershipId = randomUUID(), tenantId = randomUUID();
const contextId = randomUUID(), workspaceId = randomUUID(), otherWorkspaceId = randomUUID();
const conversationId = randomUUID(), nullConversationId = randomUUID();
const messageId = randomUUID(), nullMessageId = randomUUID();
let checks = 0;
const check = async (name, run) => {
  await run();
  console.log(`ok ${++checks} - ${name}`);
};

try {
  await pool.query(`
    do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_rpc_owner nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_ce_guide_runtime login; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_ce_guide_executor nologin; exception when duplicate_object then null; end $$;
    create schema auth; create schema app_private; create schema platform; create schema communications;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(auth.jwt()->>'sub','')::uuid
    $$;
    create function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
      returns boolean language sql as $$select true$$;
    create function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)
      returns boolean language sql stable as $$select true$$;
    create table platform.customer_workspaces(
      id uuid primary key,tenant_id uuid not null,lifecycle_status text not null,
      archived_at timestamptz);
    create table platform.workspace_entitlements(
      customer_workspace_id uuid not null,entitlement_key text not null,
      valid_from timestamptz not null,valid_until timestamptz,
      override_value_json jsonb,override_expires_at timestamptz,boolean_value boolean);
    create table communications.private_conversations(
      id uuid primary key,tenant_id uuid not null,workspace_id uuid);
    create table communications.private_messages(
      id uuid primary key,conversation_id uuid not null,sender_id uuid not null,
      version bigint not null,lifecycle_state text not null);
    create table communications.private_participants(
      conversation_id uuid not null,membership_id uuid not null,revoked_at timestamptz,
      primary key(conversation_id,membership_id));
    create function communications.context_membership(p_context_id uuid)
      returns uuid language sql stable as $$
        select case when p_context_id='${contextId}'::uuid and auth.uid()='${actorId}'::uuid
          then '${membershipId}'::uuid else null::uuid end
      $$;
    create function communications.resolve_private_message_request_audience_v1(
      uuid,uuid,uuid,uuid,bigint,uuid,bigint
    ) returns table(decision text,denial_reason text,current_actor_can_read boolean,
      request_party_audience_only boolean,evaluated_at timestamptz)
      language sql volatile as $$select 'accepted',null::text,true,true,clock_timestamp()$$;
  `);
  await pool.query(`insert into platform.customer_workspaces values
    ($1,$2,'ACTIVE',null),($3,$2,'ACTIVE',null)`, [workspaceId, tenantId, otherWorkspaceId]);
  await pool.query(`insert into platform.workspace_entitlements(
      customer_workspace_id,entitlement_key,valid_from,boolean_value)
    values($1,'module.communications',clock_timestamp()-interval '1 hour',true),
      ($2,'module.communications',clock_timestamp()-interval '1 hour',true)`,
  [workspaceId, otherWorkspaceId]);
  await pool.query(`insert into communications.private_conversations values
    ($1,$2,$3),($4,$2,null)`, [conversationId, tenantId, workspaceId, nullConversationId]);
  await pool.query(`insert into communications.private_messages values
    ($1,$2,$3,3,'available'),($4,$5,$3,1,'available')`,
  [messageId, conversationId, membershipId, nullMessageId, nullConversationId]);
  await pool.query(`insert into communications.private_participants values
    ($1,$2,null),($3,$2,null)`, [conversationId, membershipId, nullConversationId]);
  await pool.query(readFileSync(new URL(
    '../supabase/migrations/20261018153000_communications_private_message_currentness_gate_v2.sql',
    import.meta.url), 'utf8'));
  await pool.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({
    sub: actorId, role: 'authenticated', aal: 'aal2',
  })]);

  const currentness = async (workspace = workspaceId, message = messageId, version = 3) =>
    (await pool.query(`select * from communications.resolve_private_message_currentness_v2(
      $1,$2,$3,$4,$5)`, [contextId, workspace, actorId, message, version])).rows[0];

  await check('exact physical Workspace and current message are accepted', async () => {
    const row = await currentness();
    assert.equal(row.decision, 'accepted');
    assert.equal(row.workspace_id, workspaceId);
    assert.equal(row.message_id, messageId);
    assert.equal(row.message_version, '3');
  });

  await check('cross-Workspace and historical NULL conversations fail closed', async () => {
    assert.deepEqual((await currentness(otherWorkspaceId)).decision, 'denied');
    assert.deepEqual((await currentness(workspaceId, nullMessageId, 1)).decision, 'denied');
  });

  await check('stale version is bounded independently from authority denial', async () => {
    const row = await currentness(workspaceId, messageId, 2);
    assert.equal(row.decision, 'denied');
    assert.equal(row.denial_reason, 'STALE_SUBJECT');
  });

  await check('revoked participant and unavailable lifecycle fail closed', async () => {
    await pool.query(`update communications.private_participants set revoked_at=clock_timestamp()
      where conversation_id=$1 and membership_id=$2`, [conversationId, membershipId]);
    assert.equal((await currentness()).decision, 'denied');
    await pool.query(`update communications.private_participants set revoked_at=null
      where conversation_id=$1 and membership_id=$2`, [conversationId, membershipId]);
    await pool.query(`update communications.private_messages set lifecycle_state='quarantined'
      where id=$1`, [messageId]);
    assert.equal((await currentness()).decision, 'denied');
    await pool.query(`update communications.private_messages set lifecycle_state='available'
      where id=$1`, [messageId]);
  });

  await check('audience V2 accepts only after physical currentness', async () => {
    const accepted = (await pool.query(`select *
      from communications.resolve_private_message_request_audience_current_v2(
        $1,$2,$3,$4,$5,$6,$7)`, [contextId, workspaceId, actorId, messageId, 3,
      randomUUID(), 1])).rows[0];
    assert.equal(accepted.decision, 'accepted');
    const denied = (await pool.query(`select *
      from communications.resolve_private_message_request_audience_current_v2(
        $1,$2,$3,$4,$5,$6,$7)`, [contextId, otherWorkspaceId, actorId, messageId, 3,
      randomUUID(), 1])).rows[0];
    assert.equal(denied.decision, 'denied');
  });

  await check('V2 entrypoints remain ungranted before S3/S5', async () => {
    const acl = await pool.query(`select
      has_function_privilege('authenticated',
        'communications.resolve_private_message_currentness_v2(uuid,uuid,uuid,uuid,bigint)',
        'execute') currentness,
      has_function_privilege('service_role',
        'communications.resolve_private_message_request_audience_current_v2(uuid,uuid,uuid,uuid,bigint,uuid,bigint)',
        'execute') audience`);
    assert.deepEqual(acl.rows[0], { currentness: false, audience: false });
  });
} finally {
  await pool.end();
  if (adminPool && isolatedDatabaseName) {
    await adminPool.query(`drop database "${isolatedDatabaseName}" with (force)`);
    await adminPool.end();
  }
}

console.log(`Communications private-message currentness PostgreSQL: ${checks}/${checks} PASS`);
