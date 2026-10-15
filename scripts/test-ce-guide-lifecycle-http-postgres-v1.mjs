import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import ts from 'typescript';

const connectionString = process.env.CE_GUIDE_LIFECYCLE_HTTP_TEST_DATABASE_URL;
if (!connectionString || process.env.CE_GUIDE_LIFECYCLE_HTTP_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable CE Guide HTTP PostgreSQL target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || target.pathname !== '/postgres') throw new Error('Local disposable PostgreSQL only');

const authUrl = process.env.CE_GUIDE_LIFECYCLE_HTTP_SUPABASE_URL;
const anonKey = process.env.CE_GUIDE_LIFECYCLE_HTTP_ANON_KEY;
const serviceRoleKey = process.env.CE_GUIDE_LIFECYCLE_HTTP_SERVICE_ROLE_KEY;
if (!authUrl || !anonKey || !serviceRoleKey
  || process.env.CE_GUIDE_LIFECYCLE_HTTP_REAL_AAL2_REQUIRED !== '1') {
  throw new Error('Real local Supabase Auth and AAL2 evidence are required');
}
const authTarget = new URL(authUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(authTarget.hostname)) {
  throw new Error('Local disposable Supabase Auth only');
}

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

const runtime = load(new URL(
  '../src/lib/community/experience-guide-lifecycle-http-v1.ts', import.meta.url,
));
const corePlatform = load(new URL(
  '../src/lib/core/platform-role-bound-pool-v1.ts', import.meta.url,
));
const pool = new pg.Pool({ connectionString, max: 12 });
const catalogAdminConnection = new URL(connectionString);
catalogAdminConnection.username = 'supabase_admin';
const catalogAdminPool = new pg.Pool({
  connectionString: catalogAdminConnection.toString(), max: 1,
});
const catalogAdmin = await catalogAdminPool.query(`select current_user,
  rolsuper from pg_roles where rolname=current_user`);
assert.deepEqual(catalogAdmin.rows, [{ current_user: 'supabase_admin', rolsuper: true }]);
let runtimePool;
let runtimeConnection;
const authAdmin = createSupabaseClient(authUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const createdAuthUsers = [];
let activeCheck = 'fixture setup';
let passed = 0;
const check = async (name, operation) => {
  activeCheck = name;
  await operation();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
};
process.on('uncaughtExceptionMonitor', error => {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const detail = `${activeCheck}: ${error?.code ?? 'NO_SQLSTATE'}: ${error.message}`
    .replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.error(`::error title=CE Guide inactive HTTP PostgreSQL::${detail}`);
});

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.replaceAll('=', '').replaceAll(' ', '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('invalid_totp_secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, at = Date.now()) {
  const counter = BigInt(Math.floor(at / 30_000));
  const input = Buffer.alloc(8);
  input.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret)).update(input).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}

async function createActualAal2Session() {
  const email = `ce-guide-http-${randomUUID()}@example.invalid`;
  const password = `A2-${randomUUID()}-z9!`;
  const created = await authAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('auth_user_creation_failed');
  createdAuthUsers.push(created.data.user.id);
  const auth = createSupabaseClient(authUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const signedIn = await auth.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error('aal1_sign_in_failed');
  const aal1 = {
    access_token: signedIn.data.session.access_token,
    refresh_token: signedIn.data.session.refresh_token,
  };
  const enrolled = await auth.auth.mfa.enroll({
    factorType: 'totp', friendlyName: `ce-guide-${randomUUID()}`,
  });
  if (enrolled.error || !enrolled.data) throw enrolled.error ?? new Error('totp_enrollment_failed');
  let verified = await auth.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id, code: totp(enrolled.data.totp.secret),
  });
  if (verified.error) {
    verified = await auth.auth.mfa.challengeAndVerify({
      factorId: enrolled.data.id, code: totp(enrolled.data.totp.secret, Date.now() + 30_000),
    });
  }
  if (verified.error) throw verified.error;
  const current = await auth.auth.getSession();
  const assurance = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
  if (current.error || !current.data.session || assurance.error
    || assurance.data.currentLevel !== 'aal2') throw new Error('verified_aal2_session_required');
  return {
    actor_id: created.data.user.id,
    aal1,
    aal2: {
      access_token: current.data.session.access_token,
      refresh_token: current.data.session.refresh_token,
    },
  };
}

const actualAuth = await createActualAal2Session();
const sessions = new Map([['aal1', actualAuth.aal1], ['aal2', actualAuth.aal2]]);
async function authenticate(request) {
  const mode = /(?:^|;\s*)ce_session=(aal1|aal2)(?:;|$)/.exec(
    request.headers.get('cookie') ?? '',
  )?.[1];
  const tokens = sessions.get(mode);
  if (!tokens) return null;
  const auth = createSupabaseClient(authUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const installed = await auth.auth.setSession(tokens);
  if (installed.error) return null;
  const [{ data: userData, error: userError }, { data: sessionData, error: sessionError },
    { data: assurance, error: assuranceError }] = await Promise.all([
    auth.auth.getUser(), auth.auth.getSession(), auth.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const expiresAt = sessionData.session?.expires_at;
  if (userError || sessionError || assuranceError || !userData.user || !sessionData.session
    || sessionData.session.user.id !== userData.user.id || !Number.isSafeInteger(expiresAt)
    || !assurance?.currentLevel) return null;
  return {
    source: 'supabase_verified_session', actor_id: userData.user.id,
    assurance_level: assurance.currentLevel, expires_at: expiresAt,
  };
}

const fixture = (await pool.query(`select g.id::text guide_id,g.version::int,g.workspace_id::text,
    g.tenant_id::text,m.id::text membership_id,m.user_id::text fixture_actor_id,
    c.id::text context_id,
    e.entitlement_key
  from experience.guides g
  join platform.tenants t on t.id=g.tenant_id and t.legal_name='CE Guide disposable tenant'
  join identity.memberships m on m.tenant_id=g.tenant_id and m.user_id=g.created_by
    and m.status='active'
  join identity.context_grants c on c.membership_id=m.id and c.tenant_id=m.tenant_id
  join platform.workspace_entitlements e on e.customer_workspace_id=g.workspace_id
    and e.entitlement_key='module.experience_guides' and e.boolean_value=true
  where g.status='published'
    and exists(select 1 from experience.guide_references r
      join documents.documents d on d.id=r.target_id and d.tenant_id=r.tenant_id
        and d.workspace_id=r.workspace_id and d.status='active'
        and d.archived_at is null and d.deleted_at is null
      join documents.document_versions v on v.id=r.document_version_id
        and v.document_id=d.id and v.version=r.document_version
        and v.version=d.current_version and v.scanning_status='clean'
        and v.checksum_status='verified'
      where r.guide_id=g.id and r.guide_version=g.content_version)
  order by g.created_at desc,g.id limit 1`)).rows[0];
if (!fixture) {
  throw new Error('Run the targeted CE Guide lifecycle PostgreSQL fixture before this harness');
}
await pool.query('update identity.memberships set user_id=$2 where id=$1', [
  fixture.membership_id, actualAuth.actor_id,
]);

let initialAuthPrivileges;
let installedExecutionBoundary = false;

function disposableRoleBoundPool(delegate, hooks = {}) {
  const bound = corePlatform.createCorePlatformRoleBoundPoolV1({
    runtime_pool: delegate,
    connection_model: 'direct',
  });
  if (!hooks.afterBegin) return bound;
  return {
    contract_version: bound.contract_version,
    connection_model: bound.connection_model,
    async connect() {
      const client = await bound.connect();
      const wrapped = Object.create(client);
      wrapped.query = async (text, values) => {
        const normalized = typeof text === 'string' ? text.trim().toLowerCase() : '';
        const result = await client.query(text, values);
        if (normalized.startsWith('begin')) await hooks.afterBegin();
        return result;
      };
      wrapped.release = error => client.release(error);
      return wrapped;
    },
  };
}
async function installDisposableExecutionBoundary() {
  const administrator = await pool.query('select current_user');
  assert.ok(['postgres', 'supabase_admin'].includes(administrator.rows[0].current_user),
    'fixed local fixture administrator required');
  assert.equal((await catalogAdminPool.query(
    'select app_private.finalize_ce_guide_role_membership_v1() finalized',
  )).rows[0].finalized, true);
  const existingRole = await pool.query(`select count(*)::int count from pg_roles
    where rolname in ('cladora_ce_guide_executor','cladora_ce_guide_runtime')`);
  assert.equal(existingRole.rows[0].count, 2, 'installed role-bound boundary required');
  installedExecutionBoundary = true;
  const runtimePassword = `Ce-${randomUUID()}-local`;
  const escapedRuntimePassword = runtimePassword.replaceAll("'", "''");
  await catalogAdminPool.query(
    `alter role cladora_ce_guide_runtime password '${escapedRuntimePassword}'`,
  );
  runtimeConnection = new URL(connectionString);
  runtimeConnection.username = 'cladora_ce_guide_runtime';
  runtimeConnection.password = runtimePassword;
  runtimePool = new pg.Pool({ connectionString: runtimeConnection.toString(), max: 12 });
  const authPrivileges = (await pool.query(`select
    has_schema_privilege('cladora_ce_guide_executor','auth','USAGE') as schema_usage,
    has_function_privilege('cladora_ce_guide_executor','auth.uid()','EXECUTE') as uid_execute,
    has_function_privilege('cladora_ce_guide_executor','auth.jwt()','EXECUTE') as jwt_execute`)).rows[0];
  initialAuthPrivileges = structuredClone(authPrivileges);
  assert.deepEqual(authPrivileges, {
    schema_usage: false, uid_execute: true, jwt_execute: true,
  });
  await pool.query(`create or replace function app_private.ce_guide_http_raise_40001_v1()
    returns void language plpgsql security invoker set search_path=pg_catalog as $fn$
    begin raise exception using errcode='40001',message='disposable genuine serialization'; end $fn$`);
  await pool.query(`grant execute on function app_private.ce_guide_http_raise_40001_v1()
    to cladora_ce_guide_executor`);
  const ownerBoundary = await pool.query(`select
    has_schema_privilege('cladora_ce_guide_executor','auth','USAGE') as auth_usage`);
  assert.deepEqual(ownerBoundary.rows[0], { auth_usage: false });
  const verification = await disposableRoleBoundPool(runtimePool).connect();
  try {
    await verification.query('begin');
    const boundary = await verification.query(`select current_user,session_user,
      has_schema_privilege(current_user,'auth','USAGE') as auth_usage`);
    assert.deepEqual(boundary.rows[0], {
      current_user: 'cladora_ce_guide_executor', session_user: 'cladora_ce_guide_runtime',
      auth_usage: false,
    });
    await verification.query('rollback');
  } catch (error) {
    await verification.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    verification.release();
  }
}

async function removeDisposableExecutionBoundary() {
  await pool.query('drop function if exists app_private.ce_guide_http_raise_40001_v1()');
  if (installedExecutionBoundary) {
    if (runtimePool) {
      await runtimePool.end();
      runtimePool = undefined;
    }
    await catalogAdminPool.query('alter role cladora_ce_guide_runtime password null');
    const restoredAuthPrivileges = (await pool.query(`select
      has_schema_privilege('cladora_ce_guide_executor','auth','USAGE') as schema_usage,
      has_function_privilege('cladora_ce_guide_executor','auth.uid()','EXECUTE') as uid_execute,
      has_function_privilege('cladora_ce_guide_executor','auth.jwt()','EXECUTE') as jwt_execute`)).rows[0];
    assert.deepEqual(restoredAuthPrivileges, initialAuthPrivileges);
  }
}

function faultPool(delegate, mode) {
  let injected = false;
  return {
    async connect() {
      const client = await delegate.connect();
      const wrapped = Object.create(client);
      wrapped.query = async (text, values) => {
        const normalized = typeof text === 'string' ? text.trim().toLowerCase() : '';
        if (!injected && mode === 'serialization'
          && normalized.includes('select g.version::text,g.content_version::text,g.status')) {
          injected = true;
          await client.query('select app_private.ce_guide_http_raise_40001_v1()');
        }
        if (!injected && mode === 'ack_loss' && normalized === 'commit') {
          injected = true;
          await client.query(text, values);
          throw Object.assign(new Error('disposable acknowledgement loss'), { code: 'ECONNRESET' });
        }
        return client.query(text, values);
      };
      wrapped.release = error => client.release(error);
      return wrapped;
    },
    wasInjected: () => injected,
  };
}

function diagnosticPool(delegate) {
  return {
    contract_version: 'core-platform-role-bound-pool.v1',
    async connect() {
      const client = await delegate.connect();
      const wrapped = Object.create(client);
      let sourceLockRole = 'UNPROBED';
      wrapped.query = async (text, values) => {
        const normalized = typeof text === 'string' ? text.toLowerCase() : '';
        try {
          if (normalized.includes('cross join app_private.canonical_authority_revision_v1')) {
            const probe = await client.query(`select current_user,
              has_schema_privilege(current_user,'auth','USAGE') auth_usage`);
            sourceLockRole = `${probe.rows[0]?.current_user ?? 'UNKNOWN'}:${
              probe.rows[0]?.auth_usage === true ? 'AUTH_USAGE' : 'AUTH_DENIED'}`;
          }
          return client.query(text, values);
        } catch (error) {
          const operation = /^\s*([a-z]+)/i.exec(normalized)?.[1]?.toUpperCase() ?? 'QUERY';
          const boundary = normalized.includes("set_config('request.jwt.claims'")
            ? 'IDENTITY_BINDING'
            : normalized.includes('cross join app_private.canonical_authority_revision_v1')
              ? 'SOURCE_LOCK_PREFLIGHT'
              : normalized.includes('from platform.customer_workspaces')
                ? 'CORE_WORKSPACE_LOCK'
                : normalized.includes('from app_private.canonical_authority_revision_v1')
                  ? 'CORE_AUTHORITY_REVISION'
                  : 'CORE_OR_PROVIDER';
          const deniedObject = typeof error.message === 'string'
            ? /permission denied for (?:table|schema|function) ([a-z_][a-z0-9_.]*)/i.exec(
              error.message,
            )?.[1] : undefined;
          console.error(`::error title=CE Guide disposable SQL boundary::${boundary}/${operation}: ${error.code ?? 'NO_SQLSTATE'}:${deniedObject ?? 'OBJECT_UNAVAILABLE'}:${sourceLockRole}`);
          throw error;
        }
      };
      wrapped.release = error => client.release(error);
      return wrapped;
    },
  };
}

let defaultRoleBoundPool;
let activeRoleBoundPool;
const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const origin = `http://${incoming.headers.host}`;
    const request = new Request(`${origin}${incoming.url}`, {
      method: incoming.method, headers: incoming.headers,
      body: Buffer.concat(chunks).length ? Buffer.concat(chunks) : undefined,
    });
    const response = await runtime.handleExperienceGuideLifecycleHttpV1(request, {
      role_bound_pool: activeRoleBoundPool, authenticate,
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(await response.text());
  } catch (error) {
    outgoing.writeHead(500, { 'content-type': 'application/json' });
    outgoing.end(JSON.stringify({ outcome: 'denied', code: 'HARNESS_FAILURE' }));
    throw error;
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
async function post(body, mode = 'aal2') {
  const response = await fetch(`${origin}/isolated/experience/guides/lifecycle`, {
    method: 'POST', headers: {
      origin, 'content-type': 'application/json', cookie: `ce_session=${mode}`,
    }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
const value = (operation, expectedVersion, key, overrides = {}) => ({
  context_id: fixture.context_id, workspace_id: fixture.workspace_id,
  guide_id: fixture.guide_id, expected_version: expectedVersion, operation,
  idempotency_key: key, ...overrides,
});
const guideState = async () => (await pool.query(
  'select status,version::int from experience.guides where id=$1', [fixture.guide_id],
)).rows[0];
const effects = async key => (await pool.query(`select
  (select count(*)::int from platform.idempotency_keys where tenant_id=$1 and key=$2) idempotency,
  (select count(*)::int from audit.events where tenant_id=$1 and entity_id=$3) audit,
  (select count(*)::int from platform.outbox_events where tenant_id=$1
    and aggregate_id=$3) outbox`, [fixture.tenant_id,
  `core-tx.v1:${fixture.workspace_id}:${key}`, fixture.guide_id])).rows[0];

async function assertUnsafeExecutorDenies(label, makeUnsafe, restore) {
  const before = await guideState();
  const key = `ce-role-${label}-${randomUUID()}`;
  const beforeEffects = await effects(key);
  try {
    await makeUnsafe();
    const denied = await post(value('unpublish', before.version, key));
    assert.deepEqual(denied, {
      status: 503, body: { outcome: 'denied', code: 'GUIDE_RUNTIME_UNAVAILABLE' },
    });
    assert.deepEqual(await guideState(), before);
    assert.deepEqual(await effects(key), beforeEffects);
  } finally {
    await restore();
  }
}

let executionBoundaryAttempted = false;
try {
  executionBoundaryAttempted = true;
  await installDisposableExecutionBoundary();
  defaultRoleBoundPool = diagnosticPool(disposableRoleBoundPool(runtimePool));
  activeRoleBoundPool = defaultRoleBoundPool;
  await check('fixed executor is NOLOGIN and has no powerful attributes, ownership or membership', async () => {
    const role = await pool.query(`select not rolcanlogin as nologin,not rolsuper as nosuperuser,
      not rolbypassrls as nobypassrls,not rolcreatedb as nocreatedb,
      not rolcreaterole as nocreaterole,not rolreplication as noreplication,
      not exists(select 1 from pg_auth_members membership
        where membership.member=role.oid) as no_inherited_membership
      from pg_roles role where rolname='cladora_ce_guide_executor'`);
    assert.deepEqual(role.rows, [{
      nologin: true, nosuperuser: true, nobypassrls: true, nocreatedb: true,
      nocreaterole: true, noreplication: true, no_inherited_membership: true,
    }]);
  });

  await check('all unsafe executor attributes deny with zero writes', async () => {
    await assertUnsafeExecutorDenies('login',
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor login'),
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor nologin'));
    await assertUnsafeExecutorDenies('superuser',
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor superuser'),
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor nosuperuser'));
    await assertUnsafeExecutorDenies('bypassrls',
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor bypassrls'),
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor nobypassrls'));
    await assertUnsafeExecutorDenies('createdb',
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor createdb'),
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor nocreatedb'));
    await assertUnsafeExecutorDenies('createrole',
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor createrole'),
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor nocreaterole'));
    await assertUnsafeExecutorDenies('replication',
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor replication'),
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor noreplication'));
  });

  await check('database, schema, table, sequence and function ownership deny with zero writes', async () => {
    const cases = [
      {
        label: 'database',
        make: () => catalogAdminPool.query('create database ce_guide_executor_probe owner cladora_ce_guide_executor'),
        restore: () => catalogAdminPool.query('drop database if exists ce_guide_executor_probe'),
      },
      {
        label: 'schema',
        make: () => catalogAdminPool.query('create schema ce_guide_executor_probe authorization cladora_ce_guide_executor'),
        restore: () => catalogAdminPool.query('drop schema if exists ce_guide_executor_probe cascade'),
      },
      {
        label: 'table',
        make: () => catalogAdminPool.query(`create table public.ce_guide_executor_probe_table(id integer);
          alter table public.ce_guide_executor_probe_table owner to cladora_ce_guide_executor`),
        restore: () => catalogAdminPool.query('drop table if exists public.ce_guide_executor_probe_table'),
      },
      {
        label: 'sequence',
        make: () => catalogAdminPool.query(`create sequence public.ce_guide_executor_probe_sequence;
          alter sequence public.ce_guide_executor_probe_sequence owner to cladora_ce_guide_executor`),
        restore: () => catalogAdminPool.query('drop sequence if exists public.ce_guide_executor_probe_sequence'),
      },
      {
        label: 'function',
        make: () => catalogAdminPool.query(`create function public.ce_guide_executor_probe_function()
          returns integer language sql as 'select 1';
          alter function public.ce_guide_executor_probe_function() owner to cladora_ce_guide_executor`),
        restore: () => catalogAdminPool.query('drop function if exists public.ce_guide_executor_probe_function()'),
      },
    ];
    for (const candidate of cases) {
      await assertUnsafeExecutorDenies(candidate.label, candidate.make, candidate.restore);
    }
  });

  await check('direct membership in an object owner denies with zero writes', async () => {
    await catalogAdminPool.query(`create role cladora_ce_guide_owner_probe nologin nosuperuser nobypassrls;
      create table public.ce_guide_owner_probe_table(id integer);
      alter table public.ce_guide_owner_probe_table owner to cladora_ce_guide_owner_probe`);
    try {
      await assertUnsafeExecutorDenies('direct-owner-membership',
        () => catalogAdminPool.query('grant cladora_ce_guide_owner_probe to cladora_ce_guide_executor'),
        () => catalogAdminPool.query('revoke cladora_ce_guide_owner_probe from cladora_ce_guide_executor'));
    } finally {
      await catalogAdminPool.query(`alter table public.ce_guide_owner_probe_table owner to supabase_admin;
        drop table public.ce_guide_owner_probe_table;
        drop role cladora_ce_guide_owner_probe`);
    }
  });

  await check('direct membership in an otherwise unprivileged LOGIN role denies', async () => {
    await catalogAdminPool.query(`create role cladora_ce_guide_login_probe
      login nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit`);
    try {
      await assertUnsafeExecutorDenies('direct-login-membership',
        () => catalogAdminPool.query(
          'grant cladora_ce_guide_login_probe to cladora_ce_guide_executor',
        ),
        () => catalogAdminPool.query(
          'revoke cladora_ce_guide_login_probe from cladora_ce_guide_executor',
        ));
    } finally {
      await catalogAdminPool.query('drop role cladora_ce_guide_login_probe');
    }
  });

  await check('transitive membership in an otherwise unprivileged LOGIN role denies', async () => {
    await catalogAdminPool.query(`create role cladora_ce_guide_mid_probe
        nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit;
      create role cladora_ce_guide_login_probe
        login nosuperuser nobypassrls nocreatedb nocreaterole noreplication noinherit`);
    try {
      await assertUnsafeExecutorDenies('transitive-login-membership', async () => {
        await catalogAdminPool.query(`grant cladora_ce_guide_login_probe
            to cladora_ce_guide_mid_probe;
          grant cladora_ce_guide_mid_probe to cladora_ce_guide_executor`);
      }, async () => {
        await catalogAdminPool.query(`revoke cladora_ce_guide_mid_probe
            from cladora_ce_guide_executor;
          revoke cladora_ce_guide_login_probe from cladora_ce_guide_mid_probe`);
      });
    } finally {
      await catalogAdminPool.query(`drop role cladora_ce_guide_mid_probe;
        drop role cladora_ce_guide_login_probe`);
    }
  });

  await check('transitive membership in owner, SUPERUSER and BYPASSRLS roles denies', async () => {
    const cases = [
      { label: 'owner', attributes: 'nosuperuser nobypassrls', owns: true },
      { label: 'superuser', attributes: 'superuser nobypassrls', owns: false },
      { label: 'bypassrls', attributes: 'nosuperuser bypassrls', owns: false },
    ];
    for (const candidate of cases) {
      await catalogAdminPool.query(`create role cladora_ce_guide_mid_probe nologin nosuperuser nobypassrls;
        create role cladora_ce_guide_danger_probe nologin ${candidate.attributes}`);
      if (candidate.owns) {
        await catalogAdminPool.query(`create sequence public.ce_guide_chain_probe_sequence;
          alter sequence public.ce_guide_chain_probe_sequence owner to cladora_ce_guide_danger_probe`);
      }
      try {
        await assertUnsafeExecutorDenies(`chain-${candidate.label}`, async () => {
          await catalogAdminPool.query(`grant cladora_ce_guide_danger_probe to cladora_ce_guide_mid_probe;
            grant cladora_ce_guide_mid_probe to cladora_ce_guide_executor`);
        }, async () => {
          await catalogAdminPool.query(`revoke cladora_ce_guide_mid_probe from cladora_ce_guide_executor;
            revoke cladora_ce_guide_danger_probe from cladora_ce_guide_mid_probe`);
        });
      } finally {
        if (candidate.owns) {
          await catalogAdminPool.query(`alter sequence public.ce_guide_chain_probe_sequence owner to supabase_admin;
            drop sequence public.ce_guide_chain_probe_sequence`);
        }
        await catalogAdminPool.query(`drop role cladora_ce_guide_mid_probe;
          drop role cladora_ce_guide_danger_probe`);
      }
    }
  });

  await check('missing fixed executor is a bounded zero-write denial', async () => {
    await assertUnsafeExecutorDenies('missing',
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor rename to cladora_ce_guide_executor_missing'),
      () => catalogAdminPool.query('alter role cladora_ce_guide_executor_missing rename to cladora_ce_guide_executor'));
  });

  await check('real local Auth distinguishes AAL1 and verified TOTP AAL2 before checkout', async () => {
    const before = await guideState();
    const key = `ce-aal1-${randomUUID()}`;
    const beforeEffects = await effects(key);
    const denied = await post(value('unpublish', before.version, key), 'aal1');
    assert.deepEqual(denied, { status: 403, body: { outcome: 'denied', code: 'AAL2_REQUIRED' } });
    assert.deepEqual(await guideState(), before);
    assert.deepEqual(await effects(key), beforeEffects);
  });

  const unpublishKey = `ce-unpublish-${randomUUID()}`;
  let unpublish;
  await check('loopback HTTP commits target-free unpublish through the real Core host', async () => {
    const before = await guideState();
    assert.equal(before.status, 'published');
    unpublish = value('unpublish', before.version, unpublishKey);
    const result = await post(unpublish);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.outcome, 'committed');
    assert.deepEqual(Object.keys(result.body).sort(), ['guide_version', 'outcome', 'receipt_id']);
    assert.deepEqual(await guideState(), { status: 'draft', version: before.version + 1 });
  });

  await check('exact replay is stable and a changed payload fails closed', async () => {
    const beforeEffects = await effects(unpublishKey);
    const replay = await post(unpublish);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.outcome, 'exact_replay');
    assert.deepEqual(await effects(unpublishKey), beforeEffects);
    const state = await guideState();
    const conflict = await post(value('publish', state.version, unpublishKey));
    assert.deepEqual(conflict, {
      status: 409, body: { outcome: 'denied', code: 'IDEMPOTENCY_CONFLICT' },
    });
    assert.deepEqual(await guideState(), state);
  });

  let publish;
  await check('publish resolves immutable Documents references without response disclosure', async () => {
    const before = await guideState();
    publish = value('publish', before.version, `ce-publish-${randomUUID()}`);
    const result = await post(publish);
    assert.equal(result.status, 200);
    assert.equal(result.body.outcome, 'committed');
    assert.equal(JSON.stringify(result.body).includes('document'), false);
    assert.equal(JSON.stringify(result.body).includes('membership'), false);
    assert.deepEqual(await guideState(), { status: 'published', version: before.version + 1 });
    const replay = await post(publish);
    assert.equal(replay.body.outcome, 'exact_replay');
  });

  await check('stale and cross-Workspace requests deny with zero durable effects', async () => {
    const before = await guideState();
    const staleKey = `ce-stale-${randomUUID()}`;
    const staleBefore = await effects(staleKey);
    const stale = await post(value('unpublish', before.version - 1, staleKey));
    assert.equal(stale.status, 403);
    assert.deepEqual(await guideState(), before);
    assert.deepEqual(await effects(staleKey), staleBefore);
    const crossKey = `ce-cross-${randomUUID()}`;
    const crossBefore = await effects(crossKey);
    const cross = await post(value('unpublish', before.version, crossKey, {
      workspace_id: randomUUID(),
    }));
    assert.equal(cross.status, 403);
    assert.deepEqual(await guideState(), before);
    assert.deepEqual(await effects(crossKey), crossBefore);
  });

  await check('revoked current authority denies before mutation and leaves no key', async () => {
    const before = await guideState();
    const key = `ce-revoked-${randomUUID()}`;
    const beforeEffects = await effects(key);
    await pool.query(`update platform.workspace_entitlements set boolean_value=false
      where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
    [fixture.workspace_id]);
    try {
      const result = await post(value('unpublish', before.version, key));
      assert.equal(result.status, 403);
      assert.deepEqual(await guideState(), before);
      assert.deepEqual(await effects(key), beforeEffects);
    } finally {
      await pool.query(`update platform.workspace_entitlements set boolean_value=true
        where customer_workspace_id=$1 and entitlement_key='module.experience_guides'`,
      [fixture.workspace_id]);
    }
  });

  await check('genuine PostgreSQL 40001 is retried by Core in a fresh transaction', async () => {
    const before = await guideState();
    const fault = faultPool(runtimePool, 'serialization');
    activeRoleBoundPool = diagnosticPool(disposableRoleBoundPool(fault));
    const result = await post(value('unpublish', before.version, `ce-40001-${randomUUID()}`));
    activeRoleBoundPool = defaultRoleBoundPool;
    assert.equal(fault.wasInjected(), true);
    assert.equal(result.status, 200);
    assert.equal(result.body.outcome, 'committed');
    assert.deepEqual(await guideState(), { status: 'draft', version: before.version + 1 });
  });

  await check('commit acknowledgement loss returns 202 and same request reads exact receipt', async () => {
    const before = await guideState();
    const key = `ce-unknown-${randomUUID()}`;
    const effectsBefore = await effects(key);
    const requestValue = value('publish', before.version, key);
    const fault = faultPool(runtimePool, 'ack_loss');
    activeRoleBoundPool = diagnosticPool(disposableRoleBoundPool(fault));
    const pending = await post(requestValue);
    activeRoleBoundPool = defaultRoleBoundPool;
    assert.equal(fault.wasInjected(), true);
    assert.deepEqual(pending, {
      status: 202, body: { outcome: 'pending', code: 'READBACK_REQUIRED' },
    });
    assert.deepEqual(await guideState(), { status: 'published', version: before.version + 1 });
    const effectsAfterCommit = await effects(key);
    assert.deepEqual(effectsAfterCommit, {
      idempotency: effectsBefore.idempotency + 1,
      audit: effectsBefore.audit + 1,
      outbox: effectsBefore.outbox + 1,
    });
    const readback = await post(requestValue);
    assert.equal(readback.status, 200);
    assert.equal(readback.body.outcome, 'exact_replay');
    assert.deepEqual(await effects(key), effectsAfterCommit);
  });

  await check('poisoned pooled identity is scrubbed on checkout and release', async () => {
    const isolatedPool = new pg.Pool({ connectionString: runtimeConnection.toString(), max: 1 });
    const poison = await isolatedPool.connect();
    try {
      await poison.query('set role cladora_ce_guide_executor');
      await poison.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({
        sub: randomUUID(), role: 'authenticated', aal: 'aal1',
      })]);
    } finally {
      poison.release();
    }
    const before = await guideState();
    const key = `ce-poison-${randomUUID()}`;
    const effectsBefore = await effects(key);
    activeRoleBoundPool = diagnosticPool(disposableRoleBoundPool(isolatedPool));
    const denied = await post(value('unpublish', before.version - 1, key));
    activeRoleBoundPool = defaultRoleBoundPool;
    assert.equal(denied.status, 403);
    assert.deepEqual(await guideState(), before);
    assert.deepEqual(await effects(key), effectsBefore);
    const client = await isolatedPool.connect();
    try {
      const state = await client.query(`select current_user,session_user,
        current_setting('request.jwt.claims',true) claims,
        current_setting('request.jwt.claim.sub',true) subject,
        current_setting('request.jwt.claim.aal',true) aal`);
      assert.equal(state.rows[0].current_user, 'cladora_ce_guide_runtime');
      assert.equal(state.rows[0].session_user, 'cladora_ce_guide_runtime');
      assert.ok(!state.rows[0].claims);
      assert.ok(!state.rows[0].subject);
      assert.ok(!state.rows[0].aal);
    } finally {
      client.release();
      await isolatedPool.end();
    }
  });
} finally {
  activeRoleBoundPool = undefined;
  await new Promise(resolve => server.close(resolve));
  if (executionBoundaryAttempted) await removeDisposableExecutionBoundary();
  await pool.query('update identity.memberships set user_id=$2 where id=$1', [
    fixture.membership_id, fixture.fixture_actor_id,
  ]);
  const teardown = await pool.query(`select
    (select count(*)::int from pg_roles where rolname like 'cladora_ce_guide_%probe%'
      or rolname in ('cladora_ce_guide_executor','cladora_ce_guide_runtime')) fixture_roles,
    (select count(*)::int from pg_database where datname='ce_guide_executor_probe') fixture_databases,
    (select count(*)::int from pg_namespace where nspname='ce_guide_executor_probe') fixture_schemas,
    (select count(*)::int from pg_class where relname like 'ce_guide_%probe%') fixture_classes,
    (select count(*)::int from pg_proc where proname like 'ce_guide_%probe%') fixture_functions`);
  assert.deepEqual(teardown.rows[0], {
    fixture_roles: 2, fixture_databases: 0,
    fixture_schemas: 0, fixture_classes: 0, fixture_functions: 0,
  });
  for (const userId of createdAuthUsers) {
    await authAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
  await catalogAdminPool.end();
  await pool.end();
}

console.log(`CE Guide inactive HTTP through Auth/TOTP and Core TX host: ${passed}/${passed} PASS; production wiring remains closed`);
