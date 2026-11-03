import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import {
  browserContextOptions, browserInputs, closeBrowserResources, configureBrowserContext,
} from './test-pf01-owner-portfolio-local-browser.mjs';
import {
  pf01FreeLoopbackPort, pf01PortIsLive, startPf01OwnedProcess,
  withVerifiedPf01LocalTarget,
} from './lib/pf01-owner-portfolio-local-fixture.mjs';

// Synthetic transport objects ONLY for gate negative controls, never UI acceptance.
const API = 'http://127.0.0.1:54321';
const APP = 'http://127.0.0.1:41793';
const DATABASE = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const ANON = 'synthetic-anon-not-a-credential'.repeat(2);
const ADMIN = 'synthetic-admin-not-a-credential'.repeat(2);
const hash = value => createHash('sha256').update(value).digest('hex');
const env = {
  PF01_LOCAL_TARGET: 'local', PF01_LOCAL_EPHEMERAL: '1', PF01_LOCAL_REAL_AUTH: '1',
  PF01_LOCAL_SUPABASE_URL: API, PF01_LOCAL_DATABASE_URL: DATABASE,
  PF01_LOCAL_ANON_KEY: ANON, PF01_LOCAL_SERVICE_ROLE_KEY: ADMIN,
};
let cases = 0;
for (const key of Object.keys(env)) {
  assert.throws(() => browserInputs({ ...env, [key]: '' }, APP, 'cladora-local'));
  cases += 1;
}
for (const [key, value] of [
  ['PF01_LOCAL_EPHEMERAL', '0'], ['PF01_LOCAL_REAL_AUTH', '0'], ['PF01_LOCAL_TARGET', 'preview'],
  ['PF01_LOCAL_SUPABASE_URL', 'https://backend.example.test'],
  ['PF01_LOCAL_DATABASE_URL', 'postgresql://synthetic@database.example.test/postgres'],
]) {
  assert.throws(() => browserInputs({ ...env, [key]: value }, APP, 'cladora-local'));
  cases += 1;
}
function client(key, admin = false) {
  const auth = { url: `${API}/auth/v1`, headers: { apikey: key } };
  if (admin) auth.admin = { url: auth.url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
  return { supabaseUrl: API, supabaseKey: key, auth };
}
function proof() {
  return { source: 'supabase_local_stack_status', environment: 'local', projectRef: 'cladora-local',
    authTarget: API, databaseTarget: JSON.stringify(['127.0.0.1', '54322', 'postgres', 'postgres']),
    adminKeyHash: hash(ADMIN), actorKeyHash: hash(ANON) };
}
for (const modify of [
  options => { options.ephemeralOptIn = '0'; },
  options => { options.realAuthOptIn = '0'; },
  options => { options.inspectStack = async () => null; },
  options => { options.inspectStack = async () => ({ ...proof(), projectRef: 'wrong-stack' }); },
  options => { options.inspectStack = async () => ({ ...proof(), authTarget: 'http://127.0.0.1:54331' }); },
  options => { options.inspectStack = async () => ({ ...proof(), databaseTarget: 'wrong-database' }); },
  options => { options.actorClient = client('wrong-key-not-a-credential'); },
]) {
  let fixtureWrites = 0;
  let authenticatedNavigation = 0;
  let sqlWrites = 0;
  const options = { ...browserInputs(env, APP, 'cladora-local'), adminClient: client(ADMIN, true), actorClient: client(ANON),
    inspectStack: async () => proof(), pool: { async connect() { return {
      async query(sql) {
        if (/^(insert|update|delete|create|alter|drop|grant|revoke)/i.test(sql.trim())) sqlWrites += 1;
        return sql.startsWith('select current_database')
          ? { rowCount: 1, rows: [{ database_name: 'postgres', transaction_read_only: 'on' }] } : { rows: [] };
      }, release() {},
    }; } } };
  modify(options);
  await assert.rejects(withVerifiedPf01LocalTarget(options, async () => {
    fixtureWrites += 1;
    authenticatedNavigation += 1;
  }));
  assert.equal(fixtureWrites, 0);
  assert.equal(authenticatedNavigation, 0);
  assert.equal(sqlWrites, 0);
  cases += 1;
}
for (const origin of ['https://application.example.test', 'http://user:secret@127.0.0.1:3000', 'http://127.0.0.1:3000/path']) {
  assert.throws(() => browserContextOptions(origin, 'en'));
  cases += 1;
}
const contextOptions = browserContextOptions(APP, 'fa');
assert.deepEqual(Object.keys(contextOptions).sort(), ['acceptDownloads', 'baseURL', 'locale', 'serviceWorkers', 'viewport']);
assert.equal(contextOptions.acceptDownloads, false);
assert.equal(contextOptions.serviceWorkers, 'block');
cases += 1;
let routeHandler;
const stats = { readMethods: {}, authMethods: {}, domainMutationRequests: 0, remoteBackend: 0, externalRequests: 0 };
await configureBrowserContext({ route: async (_, handler) => { routeHandler = handler; } }, { origin: APP, supabaseUrl: API, stats });
for (const [url, method, type, expected] of [
  [`${APP}/api/owner-portfolio/v1/projection`, 'GET', 'fetch', 'continued'],
  [`${APP}/api/owner-portfolio/v1`, 'POST', 'fetch', 'aborted'],
  ['https://remote.example.test/rest/v1/units', 'GET', 'fetch', 'aborted'],
  [`${API}/auth/v1/token`, 'POST', 'fetch', 'continued'],
]) {
  let actual;
  await routeHandler({ request: () => ({ url: () => url, method: () => method, resourceType: () => type }),
    abort: async () => { actual = 'aborted'; }, continue: async () => { actual = 'continued'; } });
  assert.equal(actual, expected);
  cases += 1;
}
assert.equal(stats.remoteBackend, 1);
assert.equal(stats.domainMutationRequests, 1);
assert.equal(stats.authMethods.POST, 1);

const source = await readFile(new URL('./test-pf01-owner-portfolio-local-browser.mjs', import.meta.url), 'utf8');
for (const forbidden of ['page.route(', 'route.fulfill(', '.storageState(', '.screenshot(', '.tracing.', 'recordVideo:', 'recordHar:', 'ignoreHTTPSErrors:', 'serviceRoleKey, options).auth']) {
  assert.equal(source.includes(forbidden), false, 'no browser recording, auth bypass or fabricated local responses');
}
cases += 1;

// Real owned process/port cleanup, with an injected consumer failure.
const port = await pf01FreeLoopbackPort();
let processClosed = false;
const processHandle = await startPf01OwnedProcess({ command: process.execPath,
  args: ['-e', 'require("node:http").createServer((q,s)=>s.end("local-safety")).listen(Number(process.argv[1]),"127.0.0.1")', String(port)],
  cwd: process.cwd(), env: { PATH: process.env.PATH }, port, ready: () => pf01PortIsLive(port) });
try { throw new Error('redacted_safety_failure'); }
catch {}
finally { await processHandle.close(); processClosed = !(await pf01PortIsLive(port)); }
assert.equal(processClosed, true);
cases += 1;
let realBrowserCleanup = 'NOT_RUN_NOT_PASS';
if (process.argv.includes('--real-chromium')) {
  const browser = await chromium.launch({ headless: true });
  const contexts = new Set();
  let contextCreated = false;
  let injectedFailureObserved = false;
  try {
    const context = await browser.newContext(contextOptions);
    contexts.add(context);
    await context.newPage();
    contextCreated = true;
    throw new Error('redacted_safety_failure');
  } catch (error) { injectedFailureObserved = error.message === 'redacted_safety_failure'; }
  finally { await closeBrowserResources(browser, contexts); }
  assert.equal(contextCreated, true);
  assert.equal(injectedFailureObserved, true);
  assert.equal(contexts.size, 0);
  assert.equal(browser.isConnected(), false);
  realBrowserCleanup = 'PASS_REAL_CHROMIUM_CONTEXT_BROWSER_CLOSED';
  cases += 1;
}
console.log(JSON.stringify({ suite: 'CORE-PF01-LOCAL-BROWSER-01-safety', result: 'PASS', cases,
  identity_mismatch_fixture_writes: 0, identity_mismatch_authenticated_navigations: 0,
  context_configuration: 'CREDENTIAL_FREE_NO_RECORDING', remote_backend_rejection: 'PASS',
  owned_process_failure_cleanup: 'PASS', real_browser_failure_cleanup: realBrowserCleanup,
  ui_acceptance: 'SEPARATE_CONNECTED_BROWSER_JOB', production: 'NOT_RUN_NOT_PASS' }, null, 2));
