import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { browserInputs, browserContextOptions, configureBrowserContext } from './test-pf01-owner-portfolio-local-browser.mjs';
import { bounded, launchOwnedCeBrowser, closeOwnedCeBrowser, observeCeRequests, installCeErrorBodyDrain, cancelCeErrorBodyDrains } from './lib/ce-airprop-local-browser-fixture.mjs';
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
// Deterministic lifecycle controls: never treat stale/aborted headers as denial.
function fakeRequest(workspace = 'selected-workspace') {
  return { url: () => `${APP}/api/customer/v2/airprop/opportunities?context_id=selected-context&workspace_id=${workspace}`,
    method: () => 'GET', failure: () => ({ errorText: 'net::ERR_ABORTED' }) };
}
function fakeResponse(request, body) { return { request: () => request, status: () => 403, body }; }
{
  const context = new EventEmitter(); const events = [];
  const observer = observeCeRequests(context, APP, event => events.push(event), { bodyMs: 20 });
  const stale = fakeRequest(); let staleReads = 0;
  context.emit('request', stale);
  context.emit('response', fakeResponse(stale, async () => { staleReads += 1; return Buffer.from('{}'); }));
  context.emit('requestfailed', stale);
  const current = fakeRequest(); context.emit('request', current);
  context.emit('response', fakeResponse(current, async () => Buffer.from(JSON.stringify({ error: { code: 'AIRPROP_ACCESS_DENIED' } }))));
  context.emit('requestfinished', current);
  const result = await observer.selected({ after: 0, endpoint: 'opportunity', contextId: 'selected-context', workspaceId: 'selected-workspace', ms: 50 });
  requireError(result, 403, 'AIRPROP_ACCESS_DENIED'); assert.equal(staleReads, 0);
  assert.equal(JSON.stringify(events).includes('selected-context'), false);
  assert.equal(JSON.stringify(events).includes('selected-workspace'), false);
  observer.stop(); await observer.drain();
  assert.equal(context.eventNames().length, 0); checks += 1;
}
{
  const context = new EventEmitter(); const observer = observeCeRequests(context, APP);
  const unrelated = { ...fakeRequest(), url: () => `${APP}/api/unrelated/opportunities?context_id=selected-context&workspace_id=selected-workspace` };
  context.emit('request', unrelated);
  context.emit('response', fakeResponse(unrelated, async () => Buffer.from(JSON.stringify({ error: { code: 'AIRPROP_ACCESS_DENIED' } }))));
  context.emit('requestfinished', unrelated);
  await assert.rejects(observer.selected({ after: 0, endpoint: 'opportunity', contextId: 'selected-context', workspaceId: 'selected-workspace', ms: 20 }), error => error.stage === 'current_ui_request_completion');
  observer.stop(); await observer.drain(); checks += 1;
}
{
  const context = new EventEmitter(); const events = [];
  const observer = observeCeRequests(context, APP, event => events.push(event), { bodyMs: 20 });
  const request = fakeRequest(); context.emit('request', request);
  context.emit('response', fakeResponse(request, async () => Buffer.from('{}')));
  await assert.rejects(observer.selected({ after: 0, endpoint: 'opportunity', contextId: 'selected-context', workspaceId: 'selected-workspace', ms: 20 }), error => error.stage === 'current_ui_request_completion');
  assert.ok(events.some(event => event.stage === 'headers_received'));
  assert.equal(events.some(event => event.stage === 'reader_started'), false);
  observer.stop(); await observer.drain(); checks += 1;
}
{
  const context = new EventEmitter(); const events = [];
  let cancelBody;
  const body = new Promise((_, reject) => { cancelBody = () => reject(new Error('context_closed')); });
  const observer = observeCeRequests(context, APP, event => events.push(event), { bodyMs: 20 });
  const request = fakeRequest(); context.emit('request', request);
  context.emit('response', fakeResponse(request, () => body)); context.emit('requestfinished', request);
  await assert.rejects(observer.selected({ after: 0, endpoint: 'opportunity', contextId: 'selected-context', workspaceId: 'selected-workspace', ms: 50 }), error => error.stage === 'selected_response_body');
  assert.ok(events.some(event => event.stage === 'reader_deadline' && event.operation === 'selected_response_body'));
  observer.stop(); cancelBody(); await observer.drain(); assert.equal(context.eventNames().length, 0); checks += 1;
}
{
  const context = new EventEmitter(); const observer = observeCeRequests(context, APP);
  const controller = new AbortController();
  const waiting = observer.selected({ after: 0, endpoint: 'opportunity', contextId: 'selected-context', workspaceId: 'selected-workspace', signal: controller.signal });
  controller.abort(); await assert.rejects(waiting, error => error.name === 'BrowserProofDeadline');
  observer.stop(); await observer.drain(); assert.equal(context.eventNames().length, 0); checks += 1;
}
{
  const controller = new AbortController(); let adds = 0; let removes = 0;
  const add = controller.signal.addEventListener.bind(controller.signal), remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = (...args) => { adds += 1; return add(...args); };
  controller.signal.removeEventListener = (...args) => { removes += 1; return remove(...args); };
  assert.equal(await bounded(async () => 'done', { ms: 20, signal: controller.signal }), 'done');
  assert.equal(adds, removes); checks += 1;
}
{
  let peerClosed = false; let forced = false; let connected = true;
  const processHandle = { exitCode: null, signalCode: null };
  const contexts = new Set([{ close: () => new Promise(() => {}) }, { close: async () => { peerClosed = true; } }]);
  const owned = { process: processHandle, browser: { close: () => new Promise(() => {}), isConnected: () => connected },
    server: { close: () => new Promise(() => {}), kill: async () => { forced = true; connected = false; processHandle.signalCode = 'SIGKILL'; } } };
  const result = await closeOwnedCeBrowser(owned, contexts, { ms: 20 });
  assert.equal(peerClosed, true); assert.equal(forced, true); assert.equal(contexts.size, 0);
  assert.equal(result.mode, 'FORCED_OWNED_TERMINATION_VERIFIED');
  assert.deepEqual(result.errors.sort(), ['CONTEXT_CLOSE_FAILED', 'BROWSER_GRACEFUL_CLOSE_FAILED', 'SERVER_GRACEFUL_CLOSE_FAILED'].sort()); checks += 1;
}
let cleanup = 'NOT_RUN_NOT_PASS'; let forcedCleanup = 'NOT_RUN_NOT_PASS';
if (process.argv.includes('--real-chromium')) {
  const owned = await launchOwnedCeBrowser(chromium); const contexts = new Set();
  let injected = false;
  try {
    const context = await owned.browser.newContext(opts); contexts.add(context); await context.newPage();
    throw new Error('redacted-ce-injected-failure');
  } catch (error) { injected = error.message === 'redacted-ce-injected-failure'; }
  finally {
    const result = await closeOwnedCeBrowser(owned, contexts);
    assert.equal(result.mode, 'GRACEFUL_VERIFIED');
  }
  assert.equal(injected, true); assert.equal(contexts.size, 0); assert.equal(owned.browser.isConnected(), false);
  cleanup = 'PASS_REAL_BROWSER_CONTEXTS_PROCESS_EXIT_VERIFIED'; checks += 1;
  // Real loopback HTTP response, original UI-style fetch deliberately ignores its
  // non-OK body. The passive clone must finish that same request, not issue another.
  const http = createServer((request, response) => {
    if (request.url.startsWith('/api/')) {
      realRequests += 1;
      response.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' });
      response.end(JSON.stringify({ error: { code: 'AIRPROP_ACCESS_DENIED' } }));
    } else { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><title>Local body reader control</title>'); }
  });
  let realRequests = 0;
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const localOrigin = `http://127.0.0.1:${http.address().port}`;
  const bodyOwned = await launchOwnedCeBrowser(chromium); const bodyContexts = new Set();
  try {
    const context = await bodyOwned.browser.newContext(browserContextOptions(localOrigin, 'en')); bodyContexts.add(context);
    const events = []; const observer = observeCeRequests(context, localOrigin, event => events.push(event));
    await installCeErrorBodyDrain(context, event => events.push(event));
    const page = await context.newPage(); await page.goto(localOrigin);
    const result = await page.evaluate(() => fetch('/api/customer/v2/airprop/opportunities?context_id=selected-context&workspace_id=selected-workspace').then(response =>
      ({ status: response.status, realResponse: response instanceof Response, originalBodyUsed: response.bodyUsed })));
    assert.deepEqual(result, { status: 403, realResponse: true, originalBodyUsed: false });
    requireError(await observer.selected({ after: 0, endpoint: 'opportunity', contextId: 'selected-context', workspaceId: 'selected-workspace', ms: 10_000 }), 403, 'AIRPROP_ACCESS_DENIED');
    assert.equal(realRequests, 1, 'passive body observation must never replace the original UI request with a second GET');
    assert.ok(events.some(event => event.stage === 'passive_ui_body_drained'));
    await cancelCeErrorBodyDrains(context); observer.stop(); await observer.drain(); checks += 1;
  } finally {
    await closeOwnedCeBrowser(bodyOwned, bodyContexts);
    await new Promise((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
  }
  const forceOwned = await launchOwnedCeBrowser(chromium); const forceContexts = new Set();
  let peerClosed = false;
  try {
    const stuck = await forceOwned.browser.newContext(opts); await stuck.newPage();
    const peer = await forceOwned.browser.newContext(opts); await peer.newPage();
    forceContexts.add({ close: () => new Promise(() => {}) });
    forceContexts.add({ close: async () => { await peer.close(); peerClosed = true; } });
    const injectedHandles = { process: forceOwned.process,
      browser: { close: () => new Promise(() => {}), isConnected: () => forceOwned.browser.isConnected() },
      server: { close: () => new Promise(() => {}), kill: () => forceOwned.server.kill() } };
    const result = await closeOwnedCeBrowser(injectedHandles, forceContexts, { ms: 500 });
    assert.equal(result.mode, 'FORCED_OWNED_TERMINATION_VERIFIED'); assert.equal(result.errors.length, 3);
    assert.equal(result.process_gone, true); assert.equal(peerClosed, true);
    forcedCleanup = 'PASS_INJECTED_GRACEFUL_FAILURE_FORCE_ONLY_EXACT_OWNED_PROCESS'; checks += 1;
  } finally {
    if (forceOwned.process.exitCode === null && forceOwned.process.signalCode === null) await forceOwned.server.kill();
  }
}
console.log(JSON.stringify({ suite: 'CORE-CE-AIRPROP-recovery-safety', status: 'PASS', checks,
  rejected_target_fixture_mutations: 0, rejected_target_authenticated_navigation: 0,
  lifecycle_deadlines_stale_cancellation_body_and_drain: 'VERIFIED',
  context_failure_does_not_starve_peers: 'VERIFIED', timers_listeners_removed: 'VERIFIED',
  denial_not_runtime_failure: 'VERIFIED', browser_failure_cleanup: cleanup, forced_failure_cleanup: forcedCleanup,
  connected_acceptance: 'SEPARATE_REAL_BROWSER_JOB' }, null, 2));
