#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.COMM_MESSAGE_VERSION_TEST_DATABASE_URL;
if (!connectionString || process.env.COMM_MESSAGE_VERSION_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Communications database target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || !['/communications_message_version_test', '/postgres'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

const pool = new pg.Pool({ connectionString, max: 4 });
const ids = Object.fromEntries([
  'actor', 'peer', 'tenant', 'propertyA', 'propertyB', 'buildingA', 'buildingB',
  'unitA', 'unitB', 'membershipA', 'membershipB', 'workspaceA', 'workspaceB',
  'bindingA', 'bindingB', 'conversationA', 'conversationB', 'message', 'requestA',
  'requestB', 'messageRequest',
].map(key => [key, randomUUID()]));
let passed = 0;
const check = async (name, run) => {
  await run();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};
const sqlState = async (run, expected) => {
  try {
    await run();
    assert.fail(`Expected SQLSTATE ${expected}`);
  } catch (error) {
    assert.equal(error.code, expected);
  }
};
const row = async () => (await pool.query(
  `select id,conversation_id,body,version::text,lifecycle_state
     from communications.private_messages where id=$1`, [ids.message],
)).rows[0];
const effects = async () => (await pool.query(
  `select
     (select count(*)::int from communications.private_messages where id=$2) messages,
     (select count(*)::int from audit.events where tenant_id=$1) audit,
     (select count(*)::int from platform.outbox_events where tenant_id=$1) outbox,
     (select count(*)::int from platform.idempotency_keys where tenant_id=$1) idempotency`,
  [ids.tenant, ids.message],
)).rows[0];

try {
  await pool.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
    ids.actor, `comm-writer-${randomUUID()}@example.invalid`, ids.peer,
    `comm-peer-${randomUUID()}@example.invalid`,
  ]);
  await pool.query("insert into identity.profiles(user_id,display_name) values($1,'Actor'),($2,'Peer')", [ids.actor, ids.peer]);
  await pool.query(`insert into platform.tenants(id,legal_name,registration_number,status)
    values($1,'Communications version concurrency',$2,'active')`, [ids.tenant, `COMM-${randomUUID()}`]);
  await pool.query(`insert into portfolio.properties(id,tenant_id,type,name,status) values
    ($1,$3,'condominium','Primary','active'),($2,$3,'condominium','Other','active')`,
  [ids.propertyA, ids.propertyB, ids.tenant]);
  await pool.query(`insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
    ($1,$3,$4,'A','Primary building'),($2,$3,$5,'B','Other building')`,
  [ids.buildingA, ids.buildingB, ids.tenant, ids.propertyA, ids.propertyB]);
  await pool.query(`insert into portfolio.units(id,tenant_id,building_id,code) values
    ($1,$3,$4,'1'),($2,$3,$5,'2')`, [ids.unitA, ids.unitB, ids.tenant, ids.buildingA, ids.buildingB]);
  await pool.query(`insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
    select $1,$2,$3,r.id,'active',statement_timestamp()-interval '1 day'
    from identity.roles r where r.code='association_admin' and r.tenant_id is null and r.is_system`,
  [ids.membershipA, ids.tenant, ids.actor]);
  await pool.query(`insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
    select $1,$2,$3,r.id,'active',statement_timestamp()-interval '1 day'
    from identity.roles r where r.code='association_admin' and r.tenant_id is null and r.is_system`,
  [ids.membershipB, ids.tenant, ids.peer]);
  await pool.query(`insert into platform.customer_workspaces
    (id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
    ($1,$3,'ASSOCIATION','Primary','ACTIVE'),($2,$3,'ASSOCIATION','Other','ACTIVE')`,
  [ids.workspaceA, ids.workspaceB, ids.tenant]);
  await pool.query(`insert into platform.workspace_property_bindings
    (id,tenant_id,customer_workspace_id,property_id,status,binding_source) values
    ($1,$3,$4,$6,'active','migration_verified'),($2,$3,$5,$7,'active','migration_verified')`,
  [ids.bindingA, ids.bindingB, ids.tenant, ids.workspaceA, ids.workspaceB, ids.propertyA, ids.propertyB]);
  await pool.query(`insert into communications.private_conversations
    (id,tenant_id,unit_id,created_by,client_request_id) values
    ($1,$3,$4,$6,$7),($2,$3,$5,$6,$8)`, [ids.conversationA, ids.conversationB,
    ids.tenant, ids.unitA, ids.unitB, ids.membershipA, ids.requestA, ids.requestB]);
  await pool.query(`insert into communications.private_participants(conversation_id,membership_id) values
    ($1,$2),($1,$3)`, [ids.conversationA, ids.membershipA, ids.membershipB]);
  await pool.query(`insert into communications.private_messages
    (id,conversation_id,sender_id,client_request_id,body) values($1,$2,$3,$4,'Initial body')`,
  [ids.message, ids.conversationA, ids.membershipA, ids.messageRequest]);

  await check('two exact-version writers produce one success and one stale result', async () => {
    const update = body => pool.query(
      `update communications.private_messages set body=$2,version=2
       where id=$1 and version=1 returning body,version::text`, [ids.message, body],
    );
    const before = await effects();
    const results = await Promise.all([update('Writer A'), update('Writer B')]);
    assert.deepEqual(results.map(result => result.rowCount).sort(), [0, 1]);
    assert.equal((await row()).version, '2');
    assert.deepEqual(await effects(), before);
  });

  await check('stale unconditional writer fails closed with zero additional writes', async () => {
    const beforeRow = await row();
    const before = await effects();
    await sqlState(() => pool.query(
      `update communications.private_messages set body='Stale writer',version=2 where id=$1`,
      [ids.message],
    ), '23514');
    assert.deepEqual(await row(), beforeRow);
    assert.deepEqual(await effects(), before);
  });

  await check('body and lifecycle changes require the exact next version', async () => {
    await sqlState(() => pool.query(
      `update communications.private_messages set lifecycle_state='quarantined' where id=$1`,
      [ids.message],
    ), '23514');
    await pool.query(
      `update communications.private_messages set body='Versioned body',version=3 where id=$1 and version=2`,
      [ids.message],
    );
    await pool.query(
      `update communications.private_messages set lifecycle_state='quarantined',version=4
       where id=$1 and version=3`, [ids.message],
    );
    assert.deepEqual((({ version, lifecycle_state }) => ({ version, lifecycle_state }))(await row()),
      { version: '4', lifecycle_state: 'quarantined' });
  });

  await check('physical delete and cross-Workspace identity move fail closed', async () => {
    const before = await row();
    const beforeEffects = await effects();
    await sqlState(() => pool.query('delete from communications.private_messages where id=$1', [ids.message]), '42501');
    await sqlState(() => pool.query(
      `update communications.private_messages set conversation_id=$2,version=5 where id=$1`,
      [ids.message, ids.conversationB],
    ), '23514');
    assert.deepEqual(await row(), before);
    assert.deepEqual(await effects(), beforeEffects);
  });

  await check('delete/reinsert cannot reset version or change Workspace', async () => {
    const before = await row();
    await sqlState(() => pool.query(
      `insert into communications.private_messages
        (id,conversation_id,sender_id,client_request_id,body)
       values($1,$2,$3,$4,'Replacement')`,
      [ids.message, ids.conversationB, ids.membershipA, randomUUID()],
    ), '23505');
    assert.deepEqual(await row(), before);
  });

  console.log(`Communications message version concurrency: ${passed}/${passed} PASS`);
} finally {
  await pool.end();
}
