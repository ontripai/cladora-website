import assert from 'node:assert/strict';

import {
  AP10_AUTH_FIXTURE_VERSION,
  assertDisposableNonProductionTarget,
  generateTotp,
  runAp10AuthE2EFixture,
} from './lib/ap10-auth-e2e-fixture.mjs';

let cases = 0;
async function check(name, fn) {
  await fn();
  cases += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function clients(events) {
  const session = (aal) => ({ access_token: `private-${aal}-token`, user: { id: 'synthetic-user' } });
  return {
    adminClient: {
      auth: {
        admin: {
          async createUser(input) {
            events.push('create-user');
            assert.equal(input.app_metadata.fixture, 'cladora_ap10_synthetic_fixture');
            assert.match(input.email, /@fixture\.invalid$/);
            return { data: { user: { id: 'synthetic-user' } }, error: null };
          },
          async signOut(token, scope) {
            events.push('global-sign-out');
            assert.equal(token, 'private-aal2-token');
            assert.equal(scope, 'global');
            return { data: {}, error: null };
          },
          async deleteUser(userId, soft) {
            events.push('soft-delete-user');
            assert.equal(userId, 'synthetic-user');
            assert.equal(soft, true);
            return { data: {}, error: null };
          },
        },
      },
    },
    actorClient: {
      auth: {
        async signInWithPassword() {
          events.push('sign-in');
          return { data: { session: session('aal1') }, error: null };
        },
        mfa: {
          async enroll() {
            events.push('mfa-enroll');
            return { data: { id: 'factor-1', totp: { secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' } }, error: null };
          },
          async challengeAndVerify({ factorId, code }) {
            events.push('mfa-verify');
            assert.equal(factorId, 'factor-1');
            assert.match(code, /^\d{6}$/);
            return {
              data: {
                access_token: 'private-aal2-token',
                refresh_token: 'private-aal2-refresh-token',
                user: { id: 'synthetic-user' },
              },
              error: null,
            };
          },
          async getAuthenticatorAssuranceLevel(token) {
            events.push('aal-inspect');
            assert.equal(token, 'private-aal2-token');
            return { data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null };
          },
          async unenroll({ factorId }) {
            events.push('mfa-unenroll');
            assert.equal(factorId, 'factor-1');
            return { data: {}, error: null };
          },
        },
        async setSession({ access_token: accessToken, refresh_token: refreshToken }) {
          events.push('aal2-session-install');
          assert.equal(accessToken, 'private-aal2-token');
          assert.equal(refreshToken, 'private-aal2-refresh-token');
          return { data: { session: session('aal2') }, error: null };
        },
        async signOut({ scope }) {
          events.push('local-sign-out');
          assert.equal(scope, 'local');
          return { error: null };
        },
      },
    },
  };
}

function authority(events) {
  return {
    async setup({ accessToken }) {
      events.push('authority-setup');
      assert.equal(accessToken, 'private-aal2-token');
      return {
        contextId: 'context-1',
        workspaceIds: ['workspace-1', 'workspace-2'],
        propertyIds: ['property-1', 'property-2'],
        unitIds: ['unit-1', 'unit-2', 'unit-3'],
      };
    },
    async assertAllowed() {
      events.push('authority-assert-allowed');
      return true;
    },
    async revoke() {
      events.push('authority-revoke');
    },
    async verifyRevoked() {
      events.push('authority-verify-revoked');
      return true;
    },
  };
}

await check('RFC 6238 TOTP vector is deterministic', async () => {
  assert.equal(generateTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000, { digits: 8 }), '94287082');
});

await check('local target requires loopback and explicit disposable database', async () => {
  assert.deepEqual(assertDisposableNonProductionTarget({
    target: 'local',
    supabaseUrl: 'http://127.0.0.1:54321',
    disposableDatabase: true,
  }), { target: 'local', targetRef: 'local', teardownRequired: true });
  assert.throws(() => assertDisposableNonProductionTarget({
    target: 'local',
    supabaseUrl: 'https://example.supabase.co',
    disposableDatabase: true,
  }), /local_target_must_use_loopback/);
  assert.throws(() => assertDisposableNonProductionTarget({
    target: 'local',
    supabaseUrl: 'http://localhost:54321',
    disposableDatabase: false,
  }), /ephemeral_database_required/);
});

await check('test and preview reject a production project ref', async () => {
  assert.throws(() => assertDisposableNonProductionTarget({
    target: 'preview',
    supabaseUrl: 'https://previewref.supabase.co',
    projectRef: 'previewref',
    productionProjectRef: 'previewref',
    disposableDatabase: true,
  }), /production_project_prohibited/);
  assert.throws(() => assertDisposableNonProductionTarget({
    target: 'production',
    supabaseUrl: 'https://productionref.supabase.co',
    projectRef: 'productionref',
    productionProjectRef: 'productionref',
    disposableDatabase: true,
  }), /production_target_prohibited/);
});

await check('AAL2 session and authority are established before the consumer and cleaned after it', async () => {
  const events = [];
  const auth = clients(events);
  const receipt = await runAp10AuthE2EFixture({
    target: 'local',
    supabaseUrl: 'http://127.0.0.1:54321',
    disposableDatabase: true,
    ...auth,
    authorityDriver: authority(events),
    runId: 'deterministic-run-1',
    now: () => 59_000,
    execute: async ({ accessToken, workspaceIds, unitIds }) => {
      events.push('consumer');
      assert.equal(accessToken, 'private-aal2-token');
      assert.equal(workspaceIds.length, 2);
      assert.equal(unitIds.length, 3);
      return { accidentallyUnsafe: accessToken };
    },
  });
  assert.equal(receipt.fixtureVersion, AP10_AUTH_FIXTURE_VERSION);
  assert.equal(receipt.cleanup, 'verified');
  assert.equal(receipt.consumer, 'passed');
  assert.doesNotMatch(JSON.stringify(receipt), /private-|factor-|synthetic-user|context-|workspace-|unit-/);
  assert.deepEqual(events, [
    'create-user',
    'sign-in',
    'mfa-enroll',
    'mfa-verify',
    'aal2-session-install',
    'aal-inspect',
    'authority-setup',
    'authority-assert-allowed',
    'consumer',
    'authority-revoke',
    'mfa-unenroll',
    'global-sign-out',
    'local-sign-out',
    'soft-delete-user',
    'authority-verify-revoked',
  ]);
});

await check('consumer failure still performs the complete cleanup chain', async () => {
  const events = [];
  const auth = clients(events);
  await assert.rejects(() => runAp10AuthE2EFixture({
    target: 'local',
    supabaseUrl: 'http://localhost:54321',
    disposableDatabase: true,
    ...auth,
    authorityDriver: authority(events),
    runId: 'deterministic-run-2',
    execute: async () => {
      events.push('consumer-failure');
      throw new Error('expected_consumer_failure');
    },
  }), /expected_consumer_failure/);
  for (const expected of [
    'authority-revoke',
    'mfa-unenroll',
    'global-sign-out',
    'local-sign-out',
    'soft-delete-user',
    'authority-verify-revoked',
  ]) assert.ok(events.includes(expected), `${expected} must run`);
});

await check('cleanup failure is never hidden behind a successful receipt', async () => {
  const events = [];
  const auth = clients(events);
  const driver = authority(events);
  driver.verifyRevoked = async () => false;
  await assert.rejects(() => runAp10AuthE2EFixture({
    target: 'local',
    supabaseUrl: 'http://localhost:54321',
    disposableDatabase: true,
    ...auth,
    authorityDriver: driver,
    runId: 'deterministic-run-3',
    execute: async () => {},
  }), /ap10_fixture_cleanup_failed/);
});

process.stdout.write(`${cases} AP10 synthetic AAL2 fixture cases passed\n`);
