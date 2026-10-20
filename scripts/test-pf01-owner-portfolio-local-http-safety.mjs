import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  PF01_PRODUCTION_PROJECT_REF_HASH,
  assertPf01LocalExecutionInputs,
  withVerifiedPf01LocalTarget,
} from './lib/pf01-owner-portfolio-local-fixture.mjs';

const LOCAL_API = 'http://127.0.0.1:54321';
const LOCAL_DATABASE = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const LOCAL_APP = 'http://127.0.0.1:41793';
const LOCAL_PROJECT = 'cladora-local';
const ANON_KEY = `anon-${'a'.repeat(48)}`;
const SERVICE_KEY = `service-${'s'.repeat(48)}`;

const hash = value => createHash('sha256').update(value).digest('hex');

function client(url, key, admin = false) {
  const authUrl = `${url}/auth/v1`;
  const auth = {
    url: authUrl,
    headers: { apikey: key },
    createUser: () => { throw new Error('auth_mutation_must_not_run'); },
  };
  if (admin) {
    auth.admin = {
      url: authUrl,
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      createUser: () => { throw new Error('auth_mutation_must_not_run'); },
    };
  }
  return { supabaseUrl: url, supabaseKey: key, auth };
}

function pool({ database = 'postgres', mutationCounter }) {
  return {
    async connect() {
      return {
        async query(sql) {
          const text = String(sql).trim().toLowerCase();
          if (/^(insert|update|delete|merge|alter|create|drop|grant|revoke|truncate)\b/.test(text)) {
            mutationCounter.count += 1;
            throw new Error('database_mutation_must_not_run');
          }
          if (text.startsWith('select current_database')) {
            return { rowCount: 1, rows: [{ database_name: database, transaction_read_only: 'on' }] };
          }
          return { rowCount: null, rows: [] };
        },
        release() {},
      };
    },
  };
}

function stackProof(overrides = {}) {
  return {
    source: 'supabase_local_stack_status',
    environment: 'local',
    projectRef: LOCAL_PROJECT,
    authTarget: LOCAL_API,
    databaseTarget: JSON.stringify(['127.0.0.1', '54322', 'postgres', 'postgres']),
    adminKeyHash: hash(SERVICE_KEY),
    actorKeyHash: hash(ANON_KEY),
    ...overrides,
  };
}

function baseline(overrides = {}) {
  const mutationCounter = { count: 0 };
  const inspectCounter = { count: 0 };
  const executeCounter = { count: 0 };
  const options = {
    target: 'local',
    ephemeralOptIn: '1',
    realAuthOptIn: '1',
    appOrigin: LOCAL_APP,
    supabaseUrl: LOCAL_API,
    databaseUrl: LOCAL_DATABASE,
    projectRef: LOCAL_PROJECT,
    productionProjectRefHash: PF01_PRODUCTION_PROJECT_REF_HASH,
    anonKey: ANON_KEY,
    serviceRoleKey: SERVICE_KEY,
    adminClient: client(LOCAL_API, SERVICE_KEY, true),
    actorClient: client(LOCAL_API, ANON_KEY),
    pool: pool({ mutationCounter }),
    inspectStack: async () => {
      inspectCounter.count += 1;
      return stackProof();
    },
    ...overrides,
  };
  return { options, mutationCounter, inspectCounter, executeCounter };
}

let cases = 0;

for (const [label, mutate, expected] of [
  ['missing ephemeral opt-in', input => { input.ephemeralOptIn = '0'; }, /pf01_ephemeral_opt_in_required/],
  ['missing real Auth opt-in', input => { input.realAuthOptIn = '0'; }, /pf01_real_auth_opt_in_required/],
  ['non-local target', input => { input.target = 'preview'; }, /pf01_local_target_required/],
  ['non-loopback app', input => { input.appOrigin = 'http://preview.example.test'; }, /app_origin_must_be_loopback/],
  ['non-loopback Auth', input => { input.supabaseUrl = 'https://example.supabase.co'; }, /supabase_url_must_be_loopback/],
  ['non-loopback database', input => { input.databaseUrl = 'postgresql://postgres:test@db.example.test/postgres'; }, /database_url_must_be_loopback/],
  ['Production project ref', input => {
    input.projectRef = 'production-ref-test';
    input.productionProjectRefHash = hash(input.projectRef);
  }, /production_project_prohibited/],
  ['missing local key', input => { input.anonKey = ''; }, /local_key_invalid/],
]) {
  const { options, mutationCounter, inspectCounter, executeCounter } = baseline();
  mutate(options);
  await assert.rejects(
    withVerifiedPf01LocalTarget(options, async () => { executeCounter.count += 1; }),
    expected,
    label,
  );
  assert.equal(inspectCounter.count, 0, `${label}: stack inspection must not run before static rejection`);
  assert.equal(mutationCounter.count, 0, `${label}: database mutations must remain zero`);
  assert.equal(executeCounter.count, 0, `${label}: verified callback must remain blocked`);
  cases += 1;
}

for (const [label, override, expected] of [
  ['stack project mismatch', {
    inspectStack: async () => stackProof({ projectRef: 'different-local' }),
  }, /local_project_identity_mismatch/],
  ['stack Auth mismatch', {
    inspectStack: async () => stackProof({ authTarget: 'http://127.0.0.1:54331' }),
  }, /auth_target_identity_mismatch/],
  ['stack database mismatch', {
    inspectStack: async () => stackProof({ databaseTarget: JSON.stringify(['127.0.0.1', '54332', 'postgres', 'postgres']) }),
  }, /database_target_identity_mismatch/],
  ['connected database mismatch', {
    poolFactory: counter => pool({ database: 'other', mutationCounter: counter }),
  }, /connected_database_identity_mismatch/],
  ['local key mismatch', {
    actorClient: client(LOCAL_API, `other-${'x'.repeat(48)}`),
  }, /auth_key_target_mismatch/],
]) {
  const state = baseline();
  if (override.poolFactory) state.options.pool = override.poolFactory(state.mutationCounter);
  else Object.assign(state.options, override);
  await assert.rejects(
    withVerifiedPf01LocalTarget(state.options, async () => { state.executeCounter.count += 1; }),
    expected,
    label,
  );
  assert.equal(state.mutationCounter.count, 0, `${label}: database mutations must remain zero`);
  assert.equal(state.executeCounter.count, 0, `${label}: verified callback must remain blocked`);
  cases += 1;
}

{
  const state = baseline();
  const result = await withVerifiedPf01LocalTarget(state.options, async identity => {
    state.executeCounter.count += 1;
    assert.equal(identity.environment, 'local');
    assert.equal(identity.projectRef, LOCAL_PROJECT);
    assert.equal(identity.transactionReadOnly, 'on');
    return 'verified';
  });
  assert.equal(result, 'verified');
  assert.equal(state.executeCounter.count, 1);
  assert.equal(state.mutationCounter.count, 0);
  cases += 1;
}

{
  const envSource = await readFile(new URL('../src/lib/supabase/env.ts', import.meta.url), 'utf8');
  assert.match(envSource, /must be an HTTPS Supabase project URL/);
  assert.match(envSource, /url\.endsWith\('\.supabase\.co'\)/);
  assert.throws(() => assertPf01LocalExecutionInputs({
    target: 'local',
    ephemeralOptIn: '1',
    realAuthOptIn: '1',
    appOrigin: LOCAL_APP,
    supabaseUrl: 'https://production-ref-test.supabase.co',
    databaseUrl: LOCAL_DATABASE,
    projectRef: LOCAL_PROJECT,
    productionProjectRefHash: hash('production-ref-test'),
    anonKey: ANON_KEY,
    serviceRoleKey: SERVICE_KEY,
  }), /supabase_url_must_be_loopback/);
  cases += 1;
}

console.log(JSON.stringify({
  suite: 'CORE-PF01-LOCAL-HTTP-PROOF-01-safety',
  cases,
  static_target_gate: 'PASS',
  mismatch_zero_mutation: 'PASS',
  production_project_rejected: 'PASS',
  current_connected_next_local_url: 'BLOCKED_LOCAL_URL_POLICY_NOT_RUN_NOT_PASS',
  remote_mutations: 'NONE',
}, null, 2));
