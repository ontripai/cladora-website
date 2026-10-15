import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';

const connectionString = process.env.CORE_PLATFORM_ROLE_BOUND_POOL_TEST_DATABASE_URL;
if (!connectionString || process.env.CORE_PLATFORM_ROLE_BOUND_POOL_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable Core Platform PostgreSQL target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || target.pathname !== '/postgres') throw new Error('Local disposable PostgreSQL only');

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  cache.set(url.href, loaded.exports);
  new Function('require', 'module', 'exports', compiled.outputText)(name => {
    if (name === 'server-only') return {};
    return name.startsWith('.')
      ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const platform = load(new URL(
  '../src/lib/core/platform-role-bound-pool-v1.ts', import.meta.url,
));
const adminConnection = new URL(connectionString);
adminConnection.username = 'supabase_admin';
const adminPool = new pg.Pool({ connectionString: adminConnection.toString(), max: 6 });
const admin = await adminPool.query('select current_user,rolsuper from pg_roles where rolname=current_user');
assert.deepEqual(admin.rows, [{ current_user: 'supabase_admin', rolsuper: true }]);
assert.equal((await adminPool.query(
  'select app_private.finalize_ce_guide_role_membership_v1() finalized',
)).rows[0].finalized, true);
const exactMembership = await adminPool.query(`select granted.rolname granted_role,
  member.rolname member_role,m.admin_option,m.inherit_option,m.set_option
  from pg_auth_members m join pg_roles granted on granted.oid=m.roleid
  join pg_roles member on member.oid=m.member
  where granted.rolname in ('cladora_ce_guide_runtime','cladora_ce_guide_executor')
    or member.rolname in ('cladora_ce_guide_runtime','cladora_ce_guide_executor')`);
assert.deepEqual(exactMembership.rows, [{
  granted_role: 'cladora_ce_guide_executor',
  member_role: 'cladora_ce_guide_runtime',
  admin_option: false, inherit_option: false, set_option: true,
}]);
assert.equal((await adminPool.query(`select
  has_schema_privilege('cladora_ce_guide_executor','auth','USAGE')
    and not has_schema_privilege('cladora_ce_guide_executor','auth','CREATE')
    and has_function_privilege('cladora_ce_guide_executor','auth.uid()','EXECUTE')
    and has_function_privilege('cladora_ce_guide_executor','auth.jwt()','EXECUTE') as exact_auth_acl`)
).rows[0].exact_auth_acl, true);

const runtimePassword = `Core-${randomUUID()}-local`;
const escapedPassword = runtimePassword.replaceAll("'", "''");
await adminPool.query(`alter role cladora_ce_guide_runtime password '${escapedPassword}'`);
const runtimeConnection = new URL(connectionString);
runtimeConnection.username = 'cladora_ce_guide_runtime';
runtimeConnection.password = runtimePassword;
const runtimePool = new pg.Pool({ connectionString: runtimeConnection.toString(), max: 3 });

let checks = 0;
let catalogFingerprint;
async function check(name, operation) {
  await operation();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
}
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitForIdle(pool) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (pool.idleCount > 0 || pool.totalCount === 0) return;
    await delay(10);
  }
  throw new Error('role_bound_pool_cleanup_timeout');
}
const counts = async () => (await adminPool.query(`select
  (select count(*)::int from experience.guides) guides,
  (select count(*)::int from platform.idempotency_keys) idempotency,
  (select count(*)::int from audit.events) audit,
  (select count(*)::int from platform.outbox_events) outbox`)).rows[0];

const direct = platform.createCorePlatformRoleBoundPoolV1({
  runtime_pool: runtimePool, connection_model: 'direct',
});
const session = platform.createCorePlatformRoleBoundPoolV1({
  runtime_pool: runtimePool, connection_model: 'session_pooler',
});

async function roleIdentity(client) {
  return (await client.query('select current_user::text,session_user::text')).rows[0];
}

async function assertExclusiveMutationBlocks(label, statement) {
  const before = await counts();
  const lease = await direct.connect();
  const mutator = await adminPool.connect();
  let mutationSettled = false;
  try {
    await lease.query('begin isolation level serializable');
    assert.equal((await lease.query(
      'select app_private.assert_ce_guide_role_safety_v1() safe',
    )).rows[0].safe, true);
    await mutator.query('begin');
    const mutation = mutator.query(`select app_private.acquire_core_platform_role_safety_mutation_lock_v1(); ${statement}`)
      .then(() => { mutationSettled = true; });
    await delay(150);
    assert.equal(mutationSettled, false, `${label} must wait for the shared lease`);
    assert.deepEqual(await counts(), before);
    await lease.query('rollback');
    lease.release();
    await mutation;
    await mutator.query('rollback');
    assert.deepEqual(await counts(), before);
  } finally {
    await lease.query('rollback').catch(() => undefined);
    lease.release(true);
    await mutator.query('rollback').catch(() => undefined);
    mutator.release();
  }
}

try {
  await check('contract rejects transaction pooling and missing pools', async () => {
    assert.throws(() => platform.createCorePlatformRoleBoundPoolV1({
      runtime_pool: runtimePool, connection_model: 'transaction_pooler',
    }), /connection_model_unsupported/);
    assert.throws(() => platform.createCorePlatformRoleBoundPoolV1({
      runtime_pool: null, connection_model: 'direct',
    }), /runtime_pool_unavailable/);
  });

  await check('direct and session models return the fixed pre-bound identity', async () => {
    for (const pool of [direct, session]) {
      const client = await pool.connect();
      try {
        assert.deepEqual(await roleIdentity(client), {
          current_user: 'cladora_ce_guide_executor',
          session_user: 'cladora_ce_guide_runtime',
        });
        await client.query('begin isolation level serializable');
        assert.deepEqual(await roleIdentity(client), {
          current_user: 'cladora_ce_guide_executor',
          session_user: 'cladora_ce_guide_runtime',
        });
        await client.query('rollback');
      } finally {
        client.release();
      }
    }
  });

  await check('missing actor, Context and Workspace deny with zero writes', async () => {
    const before = await counts();
    const client = await direct.connect();
    try {
      await client.query('begin isolation level serializable');
      const rows = await client.query('select id from experience.guides');
      assert.equal(rows.rowCount, 0);
      await assert.rejects(client.query(`insert into platform.idempotency_keys
        (tenant_id,actor_id,key,request_hash,expires_at)
        values(gen_random_uuid(),gen_random_uuid(),'core-tx.v1:missing:denied','x',now()+interval '1 day')`),
      error => error?.code === '42501');
      await client.query('rollback');
    } finally {
      client.release();
    }
    assert.deepEqual(await counts(), before);
  });

  await check('pooled reuse clears claims and preserves the fixed identity', async () => {
    const first = await session.connect();
    await first.query('begin isolation level serializable');
    await first.query("select set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000001\"}',true)");
    await first.query('rollback');
    first.release();
    await waitForIdle(runtimePool);
    const second = await session.connect();
    try {
      const state = await second.query(`select current_user::text,session_user::text,
        nullif(current_setting('request.jwt.claims',true),'') claims`);
      assert.deepEqual(state.rows, [{
        current_user: 'cladora_ce_guide_executor',
        session_user: 'cladora_ce_guide_runtime', claims: null,
      }]);
    } finally {
      second.release();
    }
  });

  await adminPool.query(`create role cladora_ce_guide_race_probe
    nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
    create table public.cladora_ce_guide_race_probe(id integer);
    create function app_private.cladora_ce_guide_race_probe_v1()
      returns integer language sql security invoker set search_path=pg_catalog as 'select 1'`);

  await check('GRANT membership waits for the role-safety lease', () =>
    assertExclusiveMutationBlocks('membership',
      'grant cladora_ce_guide_race_probe to cladora_ce_guide_executor'));
  await check('ALTER ROLE LOGIN waits for the role-safety lease', () =>
    assertExclusiveMutationBlocks('alter-role',
      'alter role cladora_ce_guide_executor login'));
  await check('ALTER ROLE SUPERUSER waits for the role-safety lease', () =>
    assertExclusiveMutationBlocks('alter-superuser',
      'alter role cladora_ce_guide_executor superuser'));
  await check('ALTER ROLE BYPASSRLS waits for the role-safety lease', () =>
    assertExclusiveMutationBlocks('alter-bypassrls',
      'alter role cladora_ce_guide_executor bypassrls'));
  await check('object ownership waits for the role-safety lease', () =>
    assertExclusiveMutationBlocks('object-owner',
      'alter table public.cladora_ce_guide_race_probe owner to cladora_ce_guide_executor'));
  await check('function ownership waits for the role-safety lease', () =>
    assertExclusiveMutationBlocks('function-owner',
      'alter function app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) owner to supabase_admin'));

  await check('operational roles cannot bypass the mutation protocol', async () => {
    const client = await direct.connect();
    try {
      await assert.rejects(client.query('alter role cladora_ce_guide_executor login'),
        error => error?.code === '42501');
      await assert.rejects(client.query(
        'grant cladora_ce_guide_race_probe to cladora_ce_guide_executor'),
      error => error?.code === '42501');
      await assert.rejects(client.query(
        'alter table public.cladora_ce_guide_race_probe owner to cladora_ce_guide_executor'),
      error => error?.code === '42501');
    } finally {
      client.release(true);
    }
  });

  await check('commit acknowledgement loss poisons and destroys the connection', async () => {
    let injected = false;
    const faultPool = {
      async connect() {
        const client = await runtimePool.connect();
        const wrapped = Object.create(client);
        wrapped.query = async (text, values) => {
          const normalized = typeof text === 'string' ? text.trim().toLowerCase() : '';
          if (!injected && normalized === 'commit') {
            injected = true;
            await client.query(text, values);
            throw Object.assign(new Error('disposable acknowledgement loss'), { code: 'ECONNRESET' });
          }
          return client.query(text, values);
        };
        wrapped.release = error => client.release(error);
        return wrapped;
      },
    };
    const bound = platform.createCorePlatformRoleBoundPoolV1({
      runtime_pool: faultPool, connection_model: 'direct',
    });
    const client = await bound.connect();
    await client.query('begin isolation level serializable');
    await assert.rejects(client.query('commit'), /acknowledgement loss/);
    client.release();
    assert.equal(injected, true);
    await delay(50);
    assert.equal(runtimePool.idleCount, 0);
  });

  await check('probe roles, ownership and membership leave no residue', async () => {
    await adminPool.query(`drop function app_private.cladora_ce_guide_race_probe_v1();
      drop table public.cladora_ce_guide_race_probe;
      drop role cladora_ce_guide_race_probe`);
    const residue = await adminPool.query(`select
      (select count(*)::int from pg_roles where rolname='cladora_ce_guide_race_probe') roles,
      (select count(*)::int from pg_class where relname='cladora_ce_guide_race_probe') relations,
      (select count(*)::int from pg_proc where proname='cladora_ce_guide_race_probe_v1') routines`);
    assert.deepEqual(residue.rows, [{ roles: 0, relations: 0, routines: 0 }]);
  });

  const inventory = await adminPool.query(`with inventory(kind,name,detail) as (
    select 'role',rolname,concat_ws(':',rolcanlogin,rolinherit,rolsuper,rolbypassrls,
      rolcreatedb,rolcreaterole,rolreplication) from pg_roles
      where rolname in ('cladora_ce_guide_runtime','cladora_ce_guide_executor')
    union all select 'membership',granted.rolname||'>'||member.rolname,
      concat_ws(':',m.admin_option,m.inherit_option,m.set_option)
      from pg_auth_members m join pg_roles granted on granted.oid=m.roleid
      join pg_roles member on member.oid=m.member
      where granted.rolname like 'cladora_ce_guide_%'
        or member.rolname like 'cladora_ce_guide_%'
    union all select 'function',p.oid::regprocedure::text,
      pg_get_userbyid(p.proowner)||':'||p.prosecdef::text||':'||p.provolatile::text||':'
        ||coalesce(array_to_string(p.proconfig,','),'')||':'||md5(pg_get_functiondef(p.oid))
      from pg_proc p where p.oid=any(array[
        'auth.uid()'::regprocedure,'auth.jwt()'::regprocedure,
        'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure,
        'documents.customer_document_scope_matches(text,uuid,uuid,uuid,uuid)'::regprocedure,
        'communications.member_covers_unit(uuid,uuid,uuid)'::regprocedure,
        'communications.context_covers_unit(uuid,uuid)'::regprocedure])
    union all select 'policy',schemaname||'.'||tablename||'.'||policyname,
      permissive||':'||array_to_string(roles,',')||':'||cmd||':'
        ||coalesce(qual,'')||':'||coalesce(with_check,'')
      from pg_policies where policyname like 'core_platform_%'
    union all select 'schema_acl',object_schema||'.'||object_name||'.'||grantee,
      privilege_type from information_schema.usage_privileges
      where object_type='SCHEMA' and grantee in
        ('cladora_ce_guide_runtime','cladora_ce_guide_executor','cladora_rpc_owner')
    union all select 'column_acl',table_schema||'.'||table_name||'.'||column_name||'.'||grantee,
      privilege_type from information_schema.column_privileges
      where grantee in ('cladora_ce_guide_runtime','cladora_ce_guide_executor')
    union all select 'routine_acl',routine_schema||'.'||routine_name||'.'||grantee,
      privilege_type from information_schema.routine_privileges
      where grantee in ('cladora_ce_guide_runtime','cladora_ce_guide_executor')
  ) select string_agg(kind||'|'||name||'|'||detail,E'\\n' order by kind,name,detail) data
    from inventory`);
  catalogFingerprint = createHash('sha256').update(inventory.rows[0].data).digest('hex');
} finally {
  await adminPool.query('alter role cladora_ce_guide_runtime password null').catch(() => undefined);
  await runtimePool.end().catch(() => undefined);
  await adminPool.query('drop function if exists app_private.cladora_ce_guide_race_probe_v1()').catch(() => undefined);
  await adminPool.query('drop table if exists public.cladora_ce_guide_race_probe').catch(() => undefined);
  await adminPool.query('drop role if exists cladora_ce_guide_race_probe').catch(() => undefined);
  await adminPool.end();
}

console.log(JSON.stringify({
  contract: 'core-platform-role-bound-pool.v1', checks, passed: checks,
  catalog_sha256: catalogFingerprint,
}));
