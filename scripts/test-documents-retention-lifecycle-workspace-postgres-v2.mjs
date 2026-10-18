import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.DOC_RETENTION_LIFECYCLE_TEST_DATABASE_URL;
if (!connectionString || process.env.DOC_RETENTION_LIFECYCLE_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Documents retention target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
    || !['/postgres', '/documents_retention_test'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

let adminPool = null;
let isolatedDatabaseName = null;
if (target.pathname === '/postgres') {
  isolatedDatabaseName = `documents_retention_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  adminPool = new pg.Pool({ connectionString, max: 1 });
  await adminPool.query(`create database "${isolatedDatabaseName}"`);
  target.pathname = `/${isolatedDatabaseName}`;
}

const pool = new pg.Pool({ connectionString: target.toString(), max: 3 });
let checks = 0;
const check = async (name, run) => {
  await run();
  console.log(`ok ${++checks} - ${name}`);
};

const calls = [
  `select documents.place_legal_hold_internal(null,null,null)`,
  `select documents.release_legal_hold_internal(null,null,null)`,
  `select documents.request_disposition_internal(null,null,null)`,
  `select documents.approve_disposition_internal(null,null,null,null)`,
  `select documents.assign_retention_policy_internal(null,null,null,null)`,
  `select customer_api.place_legal_hold_v1(null,null,null)`,
  `select customer_api.release_legal_hold_v1(null,null,null)`,
  `select customer_api.request_document_disposition_v1(null,null,null)`,
  `select customer_api.approve_document_disposition_v1(null,null,null,null)`,
  `select customer_api.assign_retention_policy_v1(null,null,null,null)`,
];

try {
  await pool.query(`
    do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_rpc_owner nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_ce_guide_runtime login; exception when duplicate_object then null; end $$;
    do $$ begin create role cladora_ce_guide_executor nologin; exception when duplicate_object then null; end $$;
    create schema documents; create schema customer_api; create schema app_private;
    create function app_private.acquire_core_platform_role_safety_mutation_lock_v1()
      returns boolean language sql as $$select true$$;
    create table documents.documents(id uuid primary key,status text not null);
    create table documents.legal_holds(id uuid primary key,status text not null);
    create table documents.retention_records(id uuid primary key,status text not null);
    create table documents.disposition_requests(id uuid primary key,status text not null);
    create table documents.lifecycle_events(id uuid primary key,event_type text not null);
    grant select,insert,update,delete on all tables in schema documents to service_role;
  `);
  const ids = Array.from({ length: 5 }, () => randomUUID());
  await pool.query(`insert into documents.documents values($1,'active')`, [ids[0]]);
  await pool.query(`insert into documents.legal_holds values($1,'active')`, [ids[1]]);
  await pool.query(`insert into documents.retention_records values($1,'retained')`, [ids[2]]);
  await pool.query(`insert into documents.disposition_requests values($1,'pending')`, [ids[3]]);
  await pool.query(`insert into documents.lifecycle_events values($1,'baseline')`, [ids[4]]);
  const beforeRows = (await pool.query(`select
      (select count(*) from documents.documents)::integer documents,
      (select count(*) from documents.legal_holds)::integer holds,
      (select count(*) from documents.retention_records)::integer retention,
      (select count(*) from documents.disposition_requests)::integer dispositions,
      (select count(*) from documents.lifecycle_events)::integer lifecycle`)).rows[0];
  const beforeAcl = (await pool.query(`select has_table_privilege(
    'service_role','documents.documents','SELECT,INSERT,UPDATE,DELETE') value`)).rows[0].value;

  await pool.query(readFileSync(new URL(
    '../supabase/migrations/20261018150000_documents_retention_lifecycle_workspace_gate_v2.sql',
    import.meta.url), 'utf8'));

  await check('all ten legacy entrypoints fail closed deterministically', async () => {
    for (const sql of calls) {
      await assert.rejects(pool.query(sql), /canonical_document_retention_preflight_required/);
    }
  });

  await check('failed legacy calls create no hold, retention, disposition or lifecycle write', async () => {
    const afterRows = (await pool.query(`select
        (select count(*) from documents.documents)::integer documents,
        (select count(*) from documents.legal_holds)::integer holds,
        (select count(*) from documents.retention_records)::integer retention,
        (select count(*) from documents.disposition_requests)::integer dispositions,
        (select count(*) from documents.lifecycle_events)::integer lifecycle`)).rows[0];
    assert.deepEqual(afterRows, beforeRows);
  });

  await check('D7 leaves D8-owned Documents table ACL unchanged', async () => {
    const afterAcl = (await pool.query(`select has_table_privilege(
      'service_role','documents.documents','SELECT,INSERT,UPDATE,DELETE') value`)).rows[0].value;
    assert.equal(beforeAcl, true);
    assert.equal(afterAcl, true);
  });

  await check('all legacy functions are invoker-owned and unavailable to runtime roles', async () => {
    const result = await pool.query(`select count(*)::integer count
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('documents','customer_api')
        and p.proname in ('place_legal_hold_internal','release_legal_hold_internal',
          'request_disposition_internal','approve_disposition_internal',
          'assign_retention_policy_internal','place_legal_hold_v1','release_legal_hold_v1',
          'request_document_disposition_v1','approve_document_disposition_v1',
          'assign_retention_policy_v1')
        and pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef
        and p.proconfig=array['search_path=pg_catalog']
        and not has_function_privilege('authenticated',p.oid,'EXECUTE')
        and not has_function_privilege('service_role',p.oid,'EXECUTE')`);
    assert.equal(result.rows[0].count, 10);
  });
} finally {
  await pool.end();
  if (adminPool && isolatedDatabaseName) {
    await adminPool.query(`drop database "${isolatedDatabaseName}" with (force)`);
    await adminPool.end();
  }
}

console.log(`Documents retention/lifecycle Workspace PostgreSQL: ${checks}/${checks} PASS`);
