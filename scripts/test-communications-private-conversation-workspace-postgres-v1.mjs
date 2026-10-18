import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.COMM_CONVERSATION_WORKSPACE_TEST_DATABASE_URL;
if (!connectionString || process.env.COMM_CONVERSATION_WORKSPACE_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Communications Workspace target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || !['/postgres', '/communications_workspace_test'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

let adminPool = null;
let isolatedDatabaseName = null;
if (target.pathname === '/postgres') {
  isolatedDatabaseName = `communications_workspace_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  adminPool = new pg.Pool({ connectionString, max: 1 });
  await adminPool.query(`create database "${isolatedDatabaseName}"`);
  target.pathname = `/${isolatedDatabaseName}`;
}

const pool = new pg.Pool({ connectionString: target.toString(), max: 4 });
const tenantId = randomUUID();
const otherTenantId = randomUUID();
const workspaceId = randomUUID();
const otherWorkspaceId = randomUUID();
const archivedWorkspaceId = randomUUID();
const unitId = randomUUID();
const membershipId = randomUUID();
const historicalId = randomUUID();
let checks = 0;
const check = async (name, run) => {
  await run();
  console.log(`ok ${++checks} - ${name}`);
};

function marker(overrides = {}) {
  return JSON.stringify({
    contract_version: 'communications-private-conversation-workspace.v1',
    workspace_id: workspaceId,
    tenant_id: tenantId,
    unit_id: unitId,
    actor_membership_id: membershipId,
    client_request_id: overrides.client_request_id,
    ...overrides,
  });
}

async function trustedInsert(overrides = {}) {
  const client = await pool.connect();
  const { marker_overrides: markerOverrides = {}, ...rowOverrides } = overrides;
  const values = {
    id: randomUUID(), tenant_id: tenantId, workspace_id: workspaceId, unit_id: unitId,
    created_by: membershipId, client_request_id: randomUUID(), ...rowOverrides,
  };
  try {
    await client.query('begin');
    await client.query(`select set_config(
      'communications.private_conversation_workspace_writer_v1',$1,true)`,
    [marker({ ...values, ...markerOverrides })]);
    await client.query(`insert into communications.private_conversations(
      id,tenant_id,workspace_id,unit_id,created_by,client_request_id)
      values($1,$2,$3,$4,$5,$6)`, [values.id, values.tenant_id, values.workspace_id,
      values.unit_id, values.created_by, values.client_request_id]);
    await client.query('commit');
    return values;
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
    create schema platform; create schema communications; create schema app_private;
    create function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
      returns boolean language sql as $$select true$$;
    create table platform.customer_workspaces(
      id uuid primary key,tenant_id uuid not null,lifecycle_status text not null,
      archived_at timestamptz,unique(id,tenant_id));
    create table communications.private_conversations(
      id uuid primary key,tenant_id uuid not null,unit_id uuid not null,
      created_by uuid not null,client_request_id uuid not null,
      created_at timestamptz not null default statement_timestamp());
    grant all on communications.private_conversations to service_role;
  `);
  await pool.query(`insert into platform.customer_workspaces(id,tenant_id,lifecycle_status,archived_at)
    values($1,$2,'ACTIVE',null),($3,$2,'ACTIVE',null),($4,$2,'ACTIVE',clock_timestamp()),
      ($5,$6,'ACTIVE',null)`, [workspaceId, tenantId, otherWorkspaceId, archivedWorkspaceId,
    randomUUID(), otherTenantId]);
  await pool.query(`insert into communications.private_conversations(
    id,tenant_id,unit_id,created_by,client_request_id) values($1,$2,$3,$4,$5)`,
  [historicalId, tenantId, unitId, membershipId, randomUUID()]);

  const beforeAcl = (await pool.query(`select has_table_privilege(
    'service_role','communications.private_conversations','INSERT,UPDATE,DELETE,SELECT') value`)).rows[0].value;
  await pool.query(readFileSync(new URL(
    '../supabase/migrations/20261018140000_communications_private_conversation_workspace_binding_v1.sql',
    import.meta.url), 'utf8'));

  await check('historical conversation remains byte-preserved and NULL-bound', async () => {
    const row = (await pool.query(`select workspace_id,tenant_id::text,unit_id::text,
      created_by::text from communications.private_conversations where id=$1`, [historicalId])).rows[0];
    assert.deepEqual(row, { workspace_id: null, tenant_id: tenantId,
      unit_id: unitId, created_by: membershipId });
  });

  await check('fresh NULL Workspace insert fails closed', async () => {
    await assert.rejects(pool.query(`insert into communications.private_conversations(
      id,tenant_id,unit_id,created_by,client_request_id) values($1,$2,$3,$4,$5)`,
    [randomUUID(), tenantId, unitId, membershipId, randomUUID()]),
    /private_conversation_workspace_binding_required/);
  });

  await check('explicit Workspace without trusted marker fails closed', async () => {
    await assert.rejects(pool.query(`insert into communications.private_conversations(
      id,tenant_id,workspace_id,unit_id,created_by,client_request_id)
      values($1,$2,$3,$4,$5,$6)`, [randomUUID(), tenantId, workspaceId, unitId,
      membershipId, randomUUID()]), /trusted_private_conversation_writer_required/);
  });

  let inserted;
  await check('exact transaction-local marker admits one current Workspace row', async () => {
    inserted = await trustedInsert();
    const row = (await pool.query(`select tenant_id::text,workspace_id::text,unit_id::text,
      created_by::text,client_request_id::text from communications.private_conversations where id=$1`,
    [inserted.id])).rows[0];
    assert.deepEqual(row, { tenant_id: tenantId, workspace_id: workspaceId, unit_id: unitId,
      created_by: membershipId, client_request_id: inserted.client_request_id });
  });

  await check('mismatched marker and archived Workspace both fail closed', async () => {
    await assert.rejects(trustedInsert({ marker_overrides: { workspace_id: otherWorkspaceId } }),
      /trusted_private_conversation_writer_required/);
    await assert.rejects(trustedInsert({ workspace_id: archivedWorkspaceId }),
      /private_conversation_workspace_not_current/);
  });

  await check('canonical and historical Workspace bindings are immutable', async () => {
    await assert.rejects(pool.query(`update communications.private_conversations
      set workspace_id=$2 where id=$1`, [inserted.id, otherWorkspaceId]),
    /private_conversation_workspace_binding_is_immutable/);
    await assert.rejects(pool.query(`update communications.private_conversations
      set workspace_id=$2 where id=$1`, [historicalId, workspaceId]),
    /private_conversation_workspace_binding_is_immutable/);
  });

  await check('D5 leaves S4-owned service_role table ACL unchanged', async () => {
    const afterAcl = (await pool.query(`select has_table_privilege(
      'service_role','communications.private_conversations','INSERT,UPDATE,DELETE,SELECT') value`)).rows[0].value;
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

console.log(`Communications private conversation Workspace PostgreSQL: ${checks}/${checks} PASS`);
