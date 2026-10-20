import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { browserInputs, browserContextOptions, configureBrowserContext, closeBrowserResources } from './test-pf01-owner-portfolio-local-browser.mjs';
import { executeVerifiedDenial, sessionCookies, requireError } from './test-ce-airprop-local-browser-denial.mjs';

const APP = 'http://127.0.0.1:41793'; const API = 'http://127.0.0.1:54321';
const ANON = 'synthetic-ce-anon-not-credential'.repeat(2); const ADMIN = 'synthetic-ce-admin-not-credential'.repeat(2);
const hash = value => createHash('sha256').update(value).digest('hex');
const env = { PF01_LOCAL_TARGET: 'local', PF01_LOCAL_EPHEMERAL: '1', PF01_LOCAL_REAL_AUTH: '1',
  PF01_LOCAL_SUPABASE_URL: API, PF01_LOCAL_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  PF01_LOCAL_ANON_KEY: ANON, PF01_LOCAL_SERVICE_ROLE_KEY: ADMIN };
let checks = 0;
for (const [name, value] of [...Object.keys(env).map(name => [name, '']),
  ['PF01_LOCAL_TARGET', 'preview'], ['PF01_LOCAL_EPHEMERAL', '0'], ['PF01_LOCAL_REAL_AUTH', '0'],
  ['PF01_LOCAL_SUPABASE_URL', 'https://remote.invalid'], ['PF01_LOCAL_DATABASE_URL', 'postgresql://remote.invalid/postgres']]) {
  let effects = 0;
  assert.throws(() => { browserInputs({ ...env, [name]: value }, APP, 'cladora-local'); effects += 1; });
  assert.equal(effects, 0); checks += 1;
}
function client(key, admin = false) {
  const auth = { url: `${API}/auth/v1`, headers: { apikey: key } };
  if (admin) auth.admin = { url: auth.url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
  return { supabaseUrl: API, supabaseKey: key, auth };
}
const proof = () => ({ source: 'supabase_local_stack_status', environment: 'local', projectRef: 'cladora-local',
  authTarget: API, databaseTarget: JSON.stringify(['127.0.0.1', '54322', 'postgres', 'postgres']),
  adminKeyHash: hash(ADMIN), actorKeyHash: hash(ANON) });
for (const modify of [
  o => { o.ephemeralOptIn = '0'; }, o => { o.realAuthOptIn = '0'; },
  o => { o.inspectStack = async () => null; },
  o => { o.inspectStack = async () => ({ ...proof(), projectRef: 'wrong-stack' }); },
  o => { o.inspectStack = async () => ({ ...proof(), authTarget: 'http://127.0.0.1:54331' }); },
  o => { o.inspectStack = async () => ({ ...proof(), databaseTarget: 'wrong-database' }); },
  o => { o.actorClient = client('different-key-not-credential'); },
]) {
  let mutations = 0; let authenticatedNavigation = 0; let sqlWrites = 0;
  const options = { ...browserInputs(env, APP, 'cladora-local'), adminClient: client(ADMIN, true), actorClient: client(ANON),
    inspectStack: async () => proof(), pool: { async connect() { return {
      async query(sql) {
        if (/^(insert|update|delete|create|alter|drop|grant|revoke)/i.test(sql.trim())) sqlWrites += 1;
        return sql.startsWith('select current_database') ? { rowCount: 1, rows: [{ database_name: 'postgres', transaction_read_only: 'on' }] } : { rows: [] };
      }, release() {},
    }; } } };
  modify(options);
  await assert.rejects(executeVerifiedDenial(options, async () => { mutations += 1; authenticatedNavigation += 1; }));
  assert.equal(mutations, 0); assert.equal(authenticatedNavigation, 0); assert.equal(sqlWrites, 0); checks += 1;
}
const opts = browserContextOptions(APP, 'fa');
assert.deepEqual(Object.keys(opts).sort(), ['acceptDownloads', 'baseURL', 'locale', 'serviceWorkers', 'viewport']);
assert.throws(() => sessionCookies('admin=synthetic', APP));
assert.throws(() => sessionCookies('sb-local=synthetic', 'https://remote.invalid'));
checks += 3;
let handler;
const stats = { readMethods: {}, authMethods: {}, domainMutationRequests: 0, remoteBackend: 0, externalRequests: 0 };
await configureBrowserContext({ route: async (_, fn) => { handler = fn; } }, { origin: APP, supabaseUrl: API, stats });
for (const [url, method, expected] of [
  [`${APP}/api/customer/v1/workspace/targets`, 'GET', 'continued'],
  [`${APP}/api/customer/v2/airprop/opportunities`, 'POST', 'aborted'],
  ['https://remote.invalid/rest/v1/units', 'GET', 'aborted'],
]) {
  let result;
  await handler({ request: () => ({ url: () => url, method: () => method, resourceType: () => 'fetch' }),
    abort: async () => { result = 'aborted'; }, continue: async () => { result = 'continued'; } });
  assert.equal(result, expected); checks += 1;
}
for (const result of [{ status: 500, body: { error: { code: 'AIRPROP_REQUEST_FAILED' } } },
  { status: 403, body: { error: { code: 'MFA_REQUIRED' } } }]) {
  assert.throws(() => requireError(result, 403, 'AIRPROP_ACCESS_DENIED')); checks += 1;
}
requireError({ status: 403, body: { error: { code: 'AIRPROP_ACCESS_DENIED' } } }, 403, 'AIRPROP_ACCESS_DENIED'); checks += 1;
const source = await readFile(new URL('./test-ce-airprop-local-browser-denial.mjs', import.meta.url), 'utf8');
for (const forbidden of ['route.fulfill(', '.storageState(', '.screenshot(', '.tracing.', 'recordVideo:', 'recordHar:', 'page.setContent(']) assert.equal(source.includes(forbidden), false);
checks += 1;
let cleanup = 'NOT_RUN_NOT_PASS';
if (process.argv.includes('--real-chromium')) {
  const browser = await chromium.launch({ headless: true }); const contexts = new Set();
  let injected = false;
  try {
    const context = await browser.newContext(opts); contexts.add(context); await context.newPage();
    throw new Error('redacted-ce-injected-failure');
  } catch (error) { injected = error.message === 'redacted-ce-injected-failure'; }
  finally { await closeBrowserResources(browser, contexts); }
  assert.equal(injected, true); assert.equal(contexts.size, 0); assert.equal(browser.isConnected(), false);
  cleanup = 'PASS_REAL_BROWSER_CONTEXTS_CLOSED'; checks += 1;
}
console.log(JSON.stringify({ suite: 'CE-AIRPROP-denial-safety', status: 'PASS', checks,
  rejected_target_fixture_mutations: 0, rejected_target_authenticated_navigation: 0,
  denial_not_runtime_failure: 'VERIFIED', browser_failure_cleanup: cleanup,
  connected_acceptance: 'SEPARATE_REAL_BROWSER_JOB' }, null, 2));
