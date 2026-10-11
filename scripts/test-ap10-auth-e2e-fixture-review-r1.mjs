import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { runAp10AuthE2EFixture } from './lib/ap10-auth-e2e-fixture.mjs';
import { createAp10CoreAuthorityDriver } from './lib/ap10-core-authority-driver.mjs';
import { assertMatchingDisposableIdentity, inspectLocalDisposableStack, targetUrlIdentity } from './lib/ap10-target-identity.mjs';

const api = 'http://127.0.0.1:54321';
const databaseUrl = 'postgresql://postgres:test@127.0.0.1:54322/postgres';
const hash = (text) => createHash('sha256').update(text).digest('hex');
const identity = () => ({ source: 'supabase_local_stack_status', environment: 'local',
  projectRef: 'cladora-local', authTarget: api, databaseTarget: targetUrlIdentity(databaseUrl, 'database'),
  connectedDatabase: 'postgres', transactionReadOnly: 'on',
  adminKeyHash: hash('test-admin-key'), actorKeyHash: hash('test-actor-key') });
let cases = 0;
async function check(name, fn) { await fn(); cases++; console.log(`PASS R1 ${name}`); }

function guarded(proof = identity()) {
  const counts = { authUser: 0, mfaFactor: 0, membership: 0, workspace: 0, databaseRecord: 0, cleanup: 0 };
  const authUser = () => { counts.authUser++; throw new Error('unexpected_auth_side_effect'); };
  const options = { target: 'local', supabaseUrl: api, databaseUrl, projectRef: 'cladora-local', disposableDatabase: true,
    adminClient: { supabaseUrl: api, supabaseKey: 'test-admin-key', auth: { url: `${api}/auth/v1`, admin: { url: `${api}/auth/v1`, headers: { apikey: 'test-admin-key', Authorization: 'Bearer test-admin-key' },
      createUser: authUser, signOut: () => { counts.cleanup++; }, deleteUser: () => { counts.cleanup++; },
    } } },
    actorClient: { supabaseUrl: api, supabaseKey: 'test-actor-key', auth: { url: `${api}/auth/v1`, headers: { apikey: 'test-actor-key' },
      mfa: { enroll: () => { counts.mfaFactor++; } }, signOut: () => { counts.cleanup++; } } },
    authorityDriver: { inspectTarget: async () => proof,
      setup: () => { counts.membership++; counts.workspace++; counts.databaseRecord++; },
      assertAllowed: async () => true, revoke: async () => { counts.cleanup++; }, verifyRevoked: async () => true },
    execute: async () => { throw new Error('unexpected_consumer'); } };
  return { options, counts };
}

for (const [name, change, error] of [
  ['Auth endpoint mismatch', (o) => { o.supabaseUrl = 'http://127.0.0.1:54331'; }, /auth_target_identity_mismatch/],
  ['actual Auth client mismatch', (o) => { o.adminClient.auth.url = 'http://127.0.0.1:54331/auth/v1'; }, /auth_client_target_mismatch/],
  ['actual admin endpoint mismatch', (o) => { o.adminClient.auth.admin.url = 'http://127.0.0.1:54331/auth/v1'; }, /auth_admin_target_mismatch/],
  ['actual admin credential mismatch', (o) => { o.adminClient.auth.admin.headers.Authorization = 'Bearer other-key'; }, /auth_key_target_mismatch/],
  ['missing project ref', (o) => { delete o.projectRef; }, /disposable_environment_identity_mismatch/],
  ['PostgreSQL port mismatch', (o) => { o.databaseUrl = 'postgresql://postgres:test@127.0.0.1:54332/postgres'; }, /database_target_identity_mismatch/],
  ['PostgreSQL database mismatch', (o) => { o.databaseUrl = 'postgresql://postgres:test@127.0.0.1:54322/other'; }, /database_target_identity_mismatch/],
  ['project ref mismatch', (o) => { o.projectRef = 'another-local'; }, /disposable_environment_identity_mismatch/],
  ['admin key mismatch', (o) => { o.adminClient.supabaseKey = 'other-key'; }, /auth_key_target_mismatch/],
  ['actor key mismatch', (o) => { o.actorClient.supabaseKey = 'other-key'; }, /auth_key_target_mismatch/],
]) {
  await check(`${name} creates no Auth/MFA/Membership/Workspace/DB records`, async () => {
    const { options, counts } = guarded(); change(options);
    await assert.rejects(() => runAp10AuthE2EFixture(options), error);
    assert.deepEqual(Object.values(counts), [0, 0, 0, 0, 0, 0]);
  });
}
for (const [name, proof, error] of [
  ['environment mismatch', { ...identity(), environment: 'production' }, /disposable_environment_identity_mismatch/],
  ['connected DB mismatch', { ...identity(), connectedDatabase: 'other' }, /connected_database_identity_mismatch/],
  ['non-read-only probe', { ...identity(), transactionReadOnly: 'off' }, /connected_database_identity_mismatch/],
  ['missing proof', null, /disposable_environment_identity_mismatch/],
  ['untrusted source', { ...identity(), source: 'caller_label' }, /disposable_environment_identity_mismatch/],
]) {
  await check(`${name} has zero side effects including cleanup`, async () => {
    const { options, counts } = guarded(proof);
    await assert.rejects(() => runAp10AuthE2EFixture(options), error);
    assert.ok(Object.values(counts).every((n) => n === 0));
  });
}
await check('test/preview have no unverified provisioning fallback', async () => {
  for (const target of ['test', 'preview']) {
    await assert.rejects(() => inspectLocalDisposableStack(target), /disposable_target_identity_unavailable/);
    const { options, counts } = guarded();
    Object.assign(options, { target, supabaseUrl: 'https://previewref.supabase.co', projectRef: 'previewref', productionProjectRef: 'productionref' });
    await assert.rejects(() => runAp10AuthE2EFixture(options), /disposable_environment_identity_mismatch/);
    assert.ok(Object.values(counts).every((n) => n === 0));
  }
});

await check('matching proof is checked before the first Auth write', async () => {
  const { options, counts } = guarded();
  await assert.rejects(() => runAp10AuthE2EFixture(options), /unexpected_auth_side_effect/);
  assert.equal(counts.authUser, 1); assert.equal(counts.databaseRecord, 0);
});
await check('pinned Supabase SDK endpoints and actual headers satisfy the verifier without network writes', async () => {
  let requests = 0;
  const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: async () => { requests++; throw new Error('unexpected_network'); } } };
  const adminClient = createClient(api, 'test-admin-key', options);
  const actorClient = createClient(api, 'test-actor-key', options);
  assertMatchingDisposableIdentity({ target: 'local', projectRef: 'cladora-local', supabaseUrl: api,
    databaseUrl, adminClient, actorClient, proof: identity() });
  await Promise.all([adminClient.auth.getSession(), actorClient.auth.getSession()]);
  assert.equal(requests, 0);
});
await check('database driver proves the live connection with read-only SQL', async () => {
  const queries = []; let released = false;
  const client = { query: async (sql) => { queries.push(sql); return { rowCount: 1,
    rows: [{ database_name: 'postgres', transaction_read_only: 'on' }] }; }, release: () => { released = true; } };
  const driver = createAp10CoreAuthorityDriver({ connect: async () => client }, { databaseUrl, target: 'local', inspectStack: async () => identity() });
  assert.deepEqual(await driver.inspectTarget(), identity());
  assert.match(queries[0], /^begin read only$/); assert.match(queries[1], /current_database/);
  assert.equal(queries[2], 'rollback'); assert.equal(released, true);
});
await check('mismatched database stops before pool connect', async () => {
  let connects = 0;
  const driver = createAp10CoreAuthorityDriver({ connect: async () => { connects++; } }, {
    databaseUrl: 'postgresql://postgres:test@127.0.0.1:54332/postgres', target: 'local', inspectStack: async () => identity(),
  });
  await assert.rejects(() => driver.inspectTarget(), /database_target_identity_mismatch/); assert.equal(connects, 0);
});

for (const manage of [false, true, null]) {
  await check(`AAL1 manage=${String(manage)} checks both explicit Workspaces fail closed`, async () => {
    const queries = []; let aal = null;
    const client = { query: async (sql, values) => {
      queries.push(sql);
      if (sql.includes('set_config')) aal = JSON.parse(values[0]).aal;
      if (sql.includes('as can_read')) {
        assert.match(sql, /airprop\.asset\.read/); assert.match(sql, /airprop\.asset\.manage/);
        return { rowCount: 2, rows: [1, 2].map(() => ({ can_read: aal === 'aal2', can_manage: aal === 'aal2' ? true : manage })) };
      }
      return { rows: [], rowCount: 0 };
    }, release: () => {} };
    const driver = createAp10CoreAuthorityDriver({ connect: async () => client });
    assert.equal(await driver.assertAllowed({ authority: { contextId: 'context', workspaceIds: ['one', 'two'] }, userId: 'test-user' }), manage === false);
    assert.equal(queries.at(-1), 'rollback');
  });
}
console.log(`${cases} AP10 R1 identity/zero-mutation/AAL1-manage regressions passed`);
