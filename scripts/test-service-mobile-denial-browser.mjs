import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createConnection } from 'node:net';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, expect } = require('@playwright/test');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');

// Real Chromium + actual React consumer/providers + actual compiled stylesheet.
// The HTTP transport and all records are synthetic, task-owned, and loopback-only.
// This does not start Next, authenticate, contact an API/DB, or use Docker.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const component = join(root, 'src/components/customer/CustomerServiceRequests.tsx');
const contextProvider = join(root, 'src/components/customer/CustomerContextProvider.tsx');
const transportProvider = join(root, 'src/components/dashboard-lab/DashboardTransport.tsx');
const pilot = join(root, 'src/components/customer/ServicePilotSelfPerson.tsx');
const globals = join(root, 'src/styles/globals.css');
const injectFailure = process.argv.includes('--inject-failure');
const hash = value => createHash('sha256').update(value).digest('hex');
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const ids = {
  contexts: { A: uuid(101), B: uuid(102), C: uuid(103) },
  workspaces: { A: uuid(201), B: uuid(202), C: uuid(203) },
  party: uuid(301), offering: uuid(401), revision: uuid(501), result: uuid(701),
};
const copy = {
  en: { title: 'Service requests', offering: 'Service', beneficiary: 'Request for', description: 'Describe the request', submit: 'Send request', retry: 'Retry the same request', success: 'Request received; no payment obligation was created.', unknown: 'The result is unknown.' },
  ro: { title: 'Cereri de servicii', offering: 'Serviciu', beneficiary: 'Cerere pentru', description: 'Descrie cererea', submit: 'Trimite cererea', retry: 'Reîncearcă aceeași cerere', success: 'Cerere primită; nu s-a creat o obligație de plată.', unknown: 'Rezultatul este necunoscut.' },
  fa: { title: 'درخواست خدمات', offering: 'خدمت', beneficiary: 'درخواست برای', description: 'شرح درخواست', submit: 'ارسال درخواست', retry: 'تکرار همان درخواست', success: 'درخواست دریافت شد؛ تعهد پرداختی ایجاد نشد.', unknown: 'نتیجه مشخص نیست' },
};
const receipt = {
  suite: 'SERVICE-MOBILE-DENIAL-BROWSER-01',
  provenance: 'ACTUAL_REACT_CONSUMER_CONTEXT_AND_TRANSPORT_PROVIDERS_CSS_SYNTHETIC_LOOPBACK_HTTP',
  real_next_api_rpc_db_auth: 'NOT_RUN', physical_device: 'NOT_RUN', wcag_complete: 'NOT_RUN',
  cases: [], network: { reads: 0, synthetic_posts: 0, synthetic_commits: 0, external_attempts: 0 }, runtime_errors: [],
};
let browser; let compiler; let server; let temp; let origin; let deadline; let aborted = false; let activeFixture;
const contexts = new Set(); const releases = new Set();
const componentSource = await readFile(component, 'utf8');
const line = needle => `src/components/customer/CustomerServiceRequests.tsx:${componentSource.split('\n').findIndex(value => value.includes(needle)) + 1}`;
const location = {
  consumer: line('export function CustomerServiceRequests'),
  read: line('void fetch(`/api/customer/v1/services/requests?'),
  denial: line('response.status===401||response.status===403'),
  history: line('data.requests.map'), retry: line('let command=pending'),
};

function fixtureState() {
  return {
    requestStatus: new Map(), hold: null, delayNextPost: false, historyStatus: 0,
    posts: [], commits: 0, results: new Map(),
  };
}
function createHold(contextKey) {
  let release; let started;
  const startedPromise = new Promise(resolveStarted => { started = resolveStarted; });
  const promise = new Promise(resolveRelease => {
    release = () => { releases.delete(release); resolveRelease(); };
    releases.add(release);
  });
  return { contextKey, promise, release, started, startedPromise, used: false };
}
function contextKey(value) {
  return Object.entries(ids.contexts).find(([, id]) => id === value)?.[0] ?? 'UNKNOWN';
}
function readFixture(key) {
  const longPrivate = `PRIVATE-SYNTHETIC-${key}-${'UnbrokenHistory'.repeat(22)}`;
  return {
    can_request: true,
    beneficiaries: [{ party_id: ids.party, label: `Synthetic beneficiary ${key}` }],
    requests: [{ request_id: uuid(600 + key.charCodeAt(0)), offering_id: ids.offering, revision_id: ids.revision,
      description: longPrivate, status: 'submitted', created_at: '2026-10-21T00:00:00.000Z' }],
  };
}
function sendJson(res, status, body) {
  if (res.destroyed || res.writableEnded) return;
  res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
const bounded = (promise, ms, label) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); })]).finally(() => clearTimeout(timer));
};
async function executable() {
  // Hosted Ubuntu runners provide native Chrome alongside a Chromium snap launcher.
  // Prefer an installed native browser; do not download a browser or retry launches.
  for (const path of [chromium.executablePath(), '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    try { await access(path); return path; } catch { /* No download or substitution. */ }
  }
  throw new Error('COMPATIBLE_BROWSER_UNAVAILABLE_NO_INSTALL_ATTEMPT');
}
async function build() {
  temp = await mkdtemp(join(tmpdir(), 'service-mobile-denial-'));
  const entry = join(temp, 'entry.tsx');
  const loader = join(temp, 'typescript-loader.cjs');
  await writeFile(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  await writeFile(entry, `import React from 'react';
import {createRoot} from 'react-dom/client';
import {DashboardTransportProvider} from ${JSON.stringify(transportProvider)};
import {CustomerContextProvider,useCustomerContext} from ${JSON.stringify(contextProvider)};
import {CustomerServiceRequests} from ${JSON.stringify(component)};
const ids=${JSON.stringify(ids)};
let timeoutNextPost=false;
window.__fixtureTimeoutNextPost=()=>{timeoutNextPost=true;};
const transport=async(input,init)=>{
  if((init?.method??'GET').toUpperCase()==='POST'&&timeoutNextPost){
    timeoutNextPost=false;
    const timeout=AbortSignal.timeout(120);
    const signal=init?.signal?AbortSignal.any([init.signal,timeout]):timeout;
    return fetch(input,{...init,signal});
  }
  return fetch(input,init);
};
const offerings=[{offering_id:ids.offering,revision_id:ids.revision,labels:{en:'Synthetic service',ro:'Serviciu sintetic',fa:'خدمت آزمایشی'},acquisition_mode:'pre_quote'}];
function Fixture(){
  const context=useCustomerContext();const active=context.active;const key=active?Object.entries(ids.contexts).find(([,id])=>id===active.context_id)?.[0]:null;
  const workspace=key?ids.workspaces[key]:null;
  return <><nav aria-label="Synthetic Context controls">{Object.entries(ids.contexts).map(([label,id])=><button type="button" key={id} data-fixture-context={label} onClick={()=>context.select(id)} style={{minHeight:44,minWidth:44}}>{label}</button>)}<output data-fixture-active>{key??'none'}</output></nav>
  {active&&workspace?<CustomerServiceRequests key={active.context_id+':'+workspace} contextId={active.context_id} workspaceId={workspace} lang={document.documentElement.lang} offerings={offerings}/>:null}</>;
}
const root=createRoot(document.getElementById('root'));window.disposeServiceControl=()=>root.unmount();root.render(<DashboardTransportProvider value={transport}><CustomerContextProvider><Fixture/></CustomerContextProvider></DashboardTransportProvider>);`);
  const webpack = require('next/dist/compiled/webpack/webpack').webpack;
  const moduleRoots = [...new Set([join(root, 'node_modules'), ...(require.resolve.paths('react') ?? [])])];
  compiler = webpack({ mode: 'development', devtool: false, target: 'web', entry,
    output: { path: temp, filename: 'control.js' },
    plugins: [new webpack.ProvidePlugin({ process: require.resolve('next/dist/build/polyfills/process') })],
    resolve: { extensions: ['.tsx', '.ts', '.js', '.json'], modules: moduleRoots, alias: { '@': join(root, 'src') } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: [{ loader }] }] },
  });
  await bounded(new Promise((resolveBuild, reject) => compiler.run((error, stats) => {
    if (error || stats.hasErrors()) reject(new Error(`STANDALONE_WEBPACK_BUILD_FAILED:${stats?.toString({ all: false, errors: true }) ?? error?.message}`));
    else resolveBuild();
  })), 60_000, 'STANDALONE_BUILD_TIMEOUT');
  await bounded(new Promise((resolveClose, reject) => compiler.close(error => error ? reject(error) : resolveClose())), 5000, 'COMPILER_CLOSE_TIMEOUT');
  compiler = null;
  const config = require(join(root, 'tailwind.config.js'));
  const css = await postcss([tailwindcss({ ...config, content: [component, contextProvider, transportProvider, pilot, entry] })])
    .process(await readFile(globals, 'utf8'), { from: globals });
  const js = await readFile(join(temp, 'control.js'));
  receipt.inputs = {
    consumer_sha256: hash(componentSource), context_provider_sha256: hash(await readFile(contextProvider)),
    transport_provider_sha256: hash(await readFile(transportProvider)), global_css_sha256: hash(await readFile(globals)),
    compiled_css_sha256: hash(css.css), playwright: require('@playwright/test/package.json').version,
  };
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/control.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(js); return; }
      if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css); return; }
      if (['/en', '/ro', '/fa'].includes(url.pathname)) {
        const lang = url.pathname.slice(1);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'");
        res.end(`<!doctype html><html lang="${lang}" dir="${lang === 'fa' ? 'rtl' : 'ltr'}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>SERVICE synthetic browser control</title><link rel="stylesheet" href="/style.css"></head><body><main id="root"></main><script src="/control.js"></script></body></html>`); return;
      }
      if (!url.pathname.startsWith('/api/')) { res.statusCode = 404; res.end(); return; }
      const state = activeFixture;
      if (!state) { sendJson(res, 503, { error: { code: 'FIXTURE_NOT_READY' } }); return; }
      if (req.method === 'GET') {
        receipt.network.reads++;
        if (url.pathname.endsWith('/contexts')) {
          sendJson(res, 200, { contexts: Object.entries(ids.contexts).map(([key, context_id]) => ({ context_id, membership_id: uuid(800 + key.charCodeAt(0)), tenant_name: `Synthetic ${key}`, role_code: 'member', role_name: 'Member', scope_type: 'tenant', context_label: key })) }); return;
        }
        if (url.pathname.endsWith('/dashboard')) { sendJson(res, 200, { contextId: url.searchParams.get('context_id') }); return; }
        if (url.pathname.endsWith('/services/requests')) {
          const key = contextKey(url.searchParams.get('context_id'));
          if (state.hold && state.hold.contextKey === key && !state.hold.used) {
            state.hold.used = true; state.hold.started(); await state.hold.promise;
          }
          const status = state.historyStatus || state.requestStatus.get(key) || 0;
          if (status) { sendJson(res, status, { error: { code: 'SYNTHETIC_BOUNDED_DENIAL' } }); return; }
          sendJson(res, 200, readFixture(key)); return;
        }
        sendJson(res, 404, { error: { code: 'SYNTHETIC_UNKNOWN_READ' } }); return;
      }
      if (req.method === 'POST' && url.pathname.endsWith('/services/requests')) {
        const command = JSON.parse(await readBody(req)); receipt.network.synthetic_posts++; state.posts.push(command);
        let result = state.results.get(command.idempotency_key);
        if (!result) { result = { request_id: ids.result, status: 'submitted' }; state.results.set(command.idempotency_key, result); state.commits++; receipt.network.synthetic_commits++; }
        if (state.delayNextPost) { state.delayNextPost = false; await new Promise(resolveDelay => setTimeout(resolveDelay, 500)); }
        sendJson(res, 200, result); return;
      }
      sendJson(res, 405, { error: { code: 'SYNTHETIC_METHOD_DENIED' } });
    } catch (error) {
      if (!res.destroyed) sendJson(res, 500, { error: { code: 'SYNTHETIC_FIXTURE_ERROR' } });
      receipt.runtime_errors.push({ name: error.name, surface: 'fixture-server' });
    }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000;
  await bounded(new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); }), 5000, 'OWNED_LOOPBACK_BIND_TIMEOUT');
  origin = `http://127.0.0.1:${server.address().port}`;
}

async function geometry(page, width) {
  return page.evaluate(expectedWidth => {
    const measure = () => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth });
    const production = measure(); const previous = document.body.style.overflow;
    document.body.style.overflow = 'visible'; const unclipped = measure(); document.body.style.overflow = previous;
    const section = document.querySelector('section');
    return { expectedWidth, production, unclipped, section: section ? { client: section.clientWidth, scroll: section.scrollWidth } : null };
  }, width);
}
async function runCase(lang, width) {
  const t = copy[lang]; const record = { lang, viewport: { width, height: 760 }, checks: [], measurements: {} };
  receipt.cases.push(record); activeFixture = fixtureState();
  const context = await browser.newContext({ viewport: record.viewport, screen: record.viewport, deviceScaleFactor: 1,
    locale: lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US', hasTouch: width < 768,
    serviceWorkers: 'block', acceptDownloads: false });
  contexts.add(context);
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', error => receipt.runtime_errors.push({ lang, width, name: error.name, surface: 'page' }));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { receipt.network.external_attempts++; await route.abort(); return; }
    await route.continue();
  });
  const check = async (name, source, test) => {
    try { await test(); record.checks.push({ name, status: 'PASS' }); }
    catch (error) { record.checks.push({ name, status: 'FAIL', source, error: error.message.replace(/\u001b\[[0-9;]*m/g, '').slice(0, 500) }); }
  };
  const goto = async () => {
    activeFixture.requestStatus.clear(); activeFixture.hold = null; activeFixture.historyStatus = 0;
    await page.goto(`${origin}/${lang}`);
    await expect(page.locator('[data-fixture-active]')).toHaveText('A');
    await expect(page.getByRole('heading', { name: t.title })).toBeVisible();
    await expect(page.getByText('PRIVATE-SYNTHETIC-A-', { exact: false })).toBeVisible();
  };
  const product = () => page.locator('section').filter({ has: page.getByRole('heading', { name: t.title }) });
  const fields = () => ({ offering: product().locator('select').nth(0), beneficiary: product().locator('select').nth(1), description: product().locator('textarea') });
  const fill = async description => {
    const controls = fields();
    await controls.offering.selectOption(ids.offering);
    await controls.beneficiary.selectOption(ids.party);
    await controls.description.fill(description);
  };
  const denialRace = async status => {
    await goto(); const before = activeFixture.posts.length;
    const hold = createHold('B'); activeFixture.hold = hold;
    await page.locator('[data-fixture-context="B"]').click(); await bounded(hold.startedPromise, 5000, 'LATE_B_READ_NOT_STARTED');
    activeFixture.requestStatus.set('C', status);
    await page.locator('[data-fixture-context="C"]').click();
    await expect(page.locator('[data-fixture-active]')).toHaveText('C');
    await expect(product().getByRole('status')).toBeVisible();
    await expect(product().locator('select')).toHaveCount(0); await expect(product().locator('textarea')).toHaveCount(0);
    assert.equal((await page.locator('body').innerText()).includes('PRIVATE-SYNTHETIC-'), false, 'current denial clears all prior sensitive history');
    hold.release(); await page.waitForTimeout(180);
    assert.equal((await page.locator('body').innerText()).includes('PRIVATE-SYNTHETIC-B-'), false, 'late obsolete B response cannot restore data');
    assert.equal(activeFixture.posts.length, before, 'context navigation/denial emitted no mutation');
  };
  try {
    await goto();
    await check('mobile-geometry-direction-labels-touch-and-keyboard-focus', location.consumer, async () => {
      const m = await geometry(page, width); record.measurements.geometry = m;
      for (const mode of ['production', 'unclipped']) assert.ok(m[mode].document <= width + 1 && m[mode].body <= width + 1, `${mode} page overflow ${JSON.stringify(m[mode])}`);
      assert.ok(m.section && m.section.scroll <= m.section.client + 1, `component overflow ${JSON.stringify(m.section)}`);
      assert.equal(await product().getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
      const field = fields();
      const controls = [field.offering, field.beneficiary, field.description, page.getByRole('button', { name: t.submit, exact: true })];
      const labelText = await Promise.all([field.offering, field.beneficiary, field.description].map(control => control.evaluate(element => element.labels?.[0]?.innerText ?? '')));
      assert.ok(labelText[0].includes(t.offering) && labelText[1].includes(t.beneficiary) && labelText[2].includes(t.description), `meaningful labels missing ${JSON.stringify(labelText)}`);
      for (const control of controls) {
        await expect(control).toBeVisible(); const box = await control.boundingBox(); assert.ok(box, 'control bounding box');
        assert.ok(box.x >= -1 && box.x + box.width <= width + 1 && box.y >= -1 && box.y + box.height <= 761, `control occluded ${JSON.stringify(box)}`);
        assert.ok(box.width >= 44 && box.height >= 44, `touch target ${box.width}x${box.height}`);
      }
      await controls[0].focus(); await page.keyboard.press('Tab'); await expect(controls[1]).toBeFocused();
      const focus = await controls[1].evaluate(element => { const style = getComputedStyle(element); return { visible: element.matches(':focus-visible'), outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow }; });
      assert.ok(focus.visible && ((focus.outline !== 'none' && focus.width !== '0px') || focus.shadow !== 'none'), `keyboard focus not visibly styled ${JSON.stringify(focus)}`);
      await page.keyboard.press('Shift+Tab'); await expect(controls[0]).toBeFocused();
      record.measurements.keyboard = 'REAL_CHROMIUM_TAB_SHIFT_TAB_FOCUS_VISIBLE';
    });
    await check('401-current-denial-clears-sensitive-state-and-wins-late-response', location.read, async () => denialRace(401));
    await check('403-current-denial-clears-sensitive-state-and-wins-late-response', location.read, async () => denialRace(403));
    await check('confirmed-post-survives-denied-history-without-resubmit', location.denial, async () => {
      activeFixture = fixtureState(); await goto(); activeFixture.historyStatus = 403;
      await fill(`CONFIRMED-${lang}-${width}`); await page.getByRole('button', { name: t.submit, exact: true }).click();
      await expect(product().getByRole('status').filter({ hasText: t.success })).toBeVisible();
      await expect(product().locator('select')).toHaveCount(0); await expect(product().locator('textarea')).toHaveCount(0);
      assert.equal(activeFixture.posts.length, 1); assert.equal(activeFixture.commits, 1);
      await page.waitForTimeout(150); assert.equal(activeFixture.posts.length, 1, 'denied history refresh must not resubmit confirmed command');
    });
    await check('timeout-retry-preserves-exact-key-and-payload-with-one-commit', location.retry, async () => {
      activeFixture = fixtureState(); await goto(); activeFixture.delayNextPost = true;
      await fill(`TIMEOUT-${lang}-${width}`); await page.evaluate(() => window.__fixtureTimeoutNextPost());
      await page.getByRole('button', { name: t.submit, exact: true }).click(); await expect(product().getByText(t.unknown, { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: t.retry, exact: true })).toBeVisible();
      await page.getByRole('button', { name: t.retry, exact: true }).click();
      await expect(product().getByRole('status').filter({ hasText: t.success })).toBeVisible();
      assert.equal(activeFixture.posts.length, 2); assert.deepEqual(activeFixture.posts[1], activeFixture.posts[0]);
      assert.equal(activeFixture.posts[1].idempotency_key, activeFixture.posts[0].idempotency_key); assert.equal(activeFixture.commits, 1);
    });
    await check('resize-navigation-and-denial-never-auto-submit', location.consumer, async () => {
      const before = activeFixture.posts.length;
      await page.setViewportSize({ width: Math.max(300, width - 1), height: 760 }); await page.setViewportSize(record.viewport);
      activeFixture.requestStatus.clear(); await page.locator('[data-fixture-context="B"]').click(); await expect(page.locator('[data-fixture-active]')).toHaveText('B');
      await expect(page.getByText('PRIVATE-SYNTHETIC-B-', { exact: false })).toBeVisible();
      activeFixture.requestStatus.set('C', 403); await page.locator('[data-fixture-context="C"]').click(); await expect(product().getByRole('status')).toBeVisible();
      assert.equal(activeFixture.posts.length, before); assert.equal(receipt.network.external_attempts, 0);
    });
  } finally {
    for (const release of [...releases]) release();
    try { await page.evaluate(() => window.disposeServiceControl()); } catch { /* Page/browser may already be closing. */ }
    await context.close(); contexts.delete(context);
  }
}

const cancel = () => { aborted = true; for (const release of [...releases]) release(); void browser?.close(); };
process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
try {
  deadline = setTimeout(cancel, 300_000);
  const path = await executable(); receipt.browser_executable = path; await build();
  browser = await chromium.launch({ executablePath: path, headless: true, timeout: 20_000 }); receipt.browser = browser.version();
  if (injectFailure) { const context = await browser.newContext(); contexts.add(context); await context.newPage(); throw new Error('INJECTED_OWNED_RESOURCE_FAILURE'); }
  for (const lang of ['en', 'ro', 'fa']) for (const width of [320, 390, 768]) {
    if (aborted) throw new Error('BOUNDED_PROOF_DEADLINE_OR_SIGNAL');
    await runCase(lang, width);
  }
  receipt.status = receipt.cases.some(testCase => testCase.checks.some(check => check.status === 'FAIL')) || receipt.runtime_errors.length || receipt.network.external_attempts
    ? 'FAILED_NOT_PASS' : 'PASS_SYNTHETIC_BROWSER_CONTROL_ONLY';
} catch (error) {
  receipt.status = injectFailure && error.message === 'INJECTED_OWNED_RESOURCE_FAILURE' ? 'INJECTED_FAILURE_AWAITING_CLEANUP' : 'BLOCKED_OR_RUNTIME_FAILURE_NOT_PASS';
  receipt.failure = { name: error.name, message: error.message.slice(0, 700) };
} finally {
  clearTimeout(deadline); const cleanup = [];
  for (const release of [...releases]) release();
  receipt.contexts_before_final_cleanup = contexts.size;
  for (const context of contexts) try { await bounded(context.close(), 5000, 'CONTEXT_CLOSE_TIMEOUT'); assert.equal(context.pages().length, 0); } catch { cleanup.push('CONTEXT_CLOSE_FAILED'); }
  contexts.clear();
  if (browser) try { await bounded(browser.close(), 5000, 'BROWSER_CLOSE_TIMEOUT'); assert.equal(browser.isConnected(), false); receipt.browser_closed = true; } catch { cleanup.push('BROWSER_CLOSE_FAILED'); }
  if (compiler) try { await bounded(new Promise(resolveClose => compiler.close(resolveClose)), 5000, 'COMPILER_CLOSE_TIMEOUT'); } catch { cleanup.push('COMPILER_CLOSE_FAILED'); }
  if (server) try {
    server.closeAllConnections(); await bounded(new Promise(resolveClose => server.close(resolveClose)), 5000, 'SERVER_CLOSE_TIMEOUT'); assert.equal(server.listening, false);
    if (origin) await bounded(new Promise((resolveProbe, reject) => {
      const socket = createConnection({ host: '127.0.0.1', port: Number(new URL(origin).port) });
      socket.once('connect', () => { socket.destroy(); reject(new Error('OWNED_PORT_STILL_LIVE')); });
      socket.once('error', error => { socket.destroy(); if (error.code === 'ECONNREFUSED') resolveProbe(); else reject(error); });
      socket.setTimeout(800, () => { socket.destroy(); reject(new Error('OWNED_PORT_PROBE_TIMEOUT')); });
    }), 1000, 'OWNED_PORT_PROBE_TIMEOUT');
    receipt.owned_port_closed = true;
  } catch { cleanup.push('OWNED_SERVER_CLOSE_FAILED'); }
  if (temp) try { await rm(temp, { recursive: true, force: true }); await assert.rejects(access(temp), { code: 'ENOENT' }); receipt.owned_temp_removed = true; } catch { cleanup.push('OWNED_TEMP_CLEANUP_FAILED'); }
  process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
  receipt.cleanup = cleanup.length ? cleanup : 'PASS_OWNED_BROWSER_CONTEXT_SERVER_TIMERS_TEMP';
  if (cleanup.length || aborted) receipt.status = 'FAILED_NOT_PASS';
  else if (receipt.status === 'INJECTED_FAILURE_AWAITING_CLEANUP') receipt.status = 'PASS_INJECTED_FAILURE_CLEANUP_ONLY';
  console.log(JSON.stringify(receipt, null, 2));
}
if (!['PASS_SYNTHETIC_BROWSER_CONTROL_ONLY', 'PASS_INJECTED_FAILURE_CLEANUP_ONLY'].includes(receipt.status)) process.exitCode = 1;
