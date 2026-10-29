// Actual mounted CE page, ContextProvider and HTTP handlers. All Auth/RPC,
// publication/audience and durable effects below are explicitly TEST ORACLES.
// No server, SQL, network, installation or real persistence/authorization proof.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { webcrypto } from 'node:crypto';
import { fixture, makeLoader, requireDependency, id } from './test-ce-notice-draft-command-route.mjs';
const React = requireDependency('react'), { act } = React;
const { JSDOM } = requireDependency('jsdom');
const ts = requireDependency('typescript');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://ce.test/en/app/communications' });
Object.defineProperty(dom.window, 'crypto', { configurable: true, value: webcrypto });
const saved = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const originalFetch = globalThis.fetch;
const { createRoot } = requireDependency('react-dom/client');
let f, root, context, language, calls, oracle, lateDetail;
const knownAck = { id: id(41), acknowledged_at: '2026-10-28T08:00:00Z' };
const next = { NextResponse: { json: (data, init) => Response.json(data, init) } };
const provider = makeLoader({ '@/components/dashboard-lab/DashboardTransport': {
  useDashboardFetch: () => globalThis.fetch, useDashboardPreview: () => false,
} })('src/components/customer/CustomerContextProvider.tsx');
const mocks = { './CustomerContextProvider': provider,
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) } };
let Page;
const baseIndex = process.argv.indexOf('--baseline');
if (baseIndex >= 0) {
  // Before/after witness uses the actual original component, never a copied implementation.
  const filename = process.argv[baseIndex + 1]; assert.ok(filename);
  const mod = new Module(filename), loader = makeLoader(mocks);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name]
    : name === '@/lib/customer/notice-draft-transport' ? loader('src/lib/customer/notice-draft-transport.ts') : requireDependency(name);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  Page = mod.exports.CustomerCommunicationsDashboard;
} else Page = makeLoader(mocks)('src/components/customer/CustomerCommunicationsDashboard.tsx').CustomerCommunicationsDashboard;
const notice = () => ({ id: id(21), notice_number: 17, title_ro: 'Canonical server title', body_ro: 'Canonical server body',
  title_en: null, body_en: null, title_fa: null, body_fa: null, communication_type: 'general_announcement',
  legal_classification: 'informational_optional', source_module: 'general', status: oracle.published ? 'published' : oracle.approved ? 'approved' : 'draft',
  requires_statutory_evidence: false, published_at: oracle.published ? '2026-10-28T08:00:00Z' : null, created_at: '2026-10-28T07:00:00Z' });
const readClient = { auth: { getClaims: async () => ({ data: oracle.auth ? { claims: { sub: id(2) } } : null, error: null }) },
  schema(name) { assert.equal(name, 'customer_api'); return { async rpc(name, args) {
    calls.push({ name, args }); assert.equal(args.p_context_id, id(3));
    if (!oracle.allowed) return { data: null, error: { code: '42501', message: 'PRIVATE_ACCESS_DENIED' } };
    if (['approve_notice_v1', 'publish_notice_v1'].includes(name)) {
      assert.equal(args.p_notice_id, id(21));
      if (name === 'approve_notice_v1') oracle.approved = true;
      else { assert.equal(oracle.approved, true); oracle.published = true; }
      return { data: { success: true, notice_id: id(21), status: name === 'approve_notice_v1' ? 'approved' : 'published' }, error: null };
    }
    assert.ok(['get_notice_detail_v1', 'get_official_notices_v1', 'get_communications_v1'].includes(name), 'only existing read RPCs; no mutation');
    if (name === 'get_communications_v1') return { data: { total: 0, rows: [] }, error: null };
    const n = notice();
    if (name === 'get_official_notices_v1') return { data: { total: oracle.hasNotice ? 1 : 0, rows: oracle.hasNotice ? [n] : [] }, error: null };
    assert.equal(args.p_notice_id, id(21));
    const data = { notice: { ...n, id: oracle.foreign ? id(99) : n.id }, my_acknowledgement: oracle.ack ? knownAck : null, statutory_evidence: [] };
    if (lateDetail) await lateDetail;
    return { data, error: null };
  } }; } };
const readLoader = makeLoader({ '@/lib/supabase/server': { createClient: async () => readClient }, 'next/server': next });
const listRoute = readLoader('src/app/api/customer/v1/communications/notices/route.ts');
const communicationsRoute = readLoader('src/app/api/customer/v1/communications/route.ts');
const actionRoutes = Object.fromEntries(['approve', 'publish'].map(action => [action, readLoader(`src/app/api/customer/v1/communications/notices/[id]/${action}/route.ts`)]));
const detailRoute = readLoader('src/app/api/customer/v1/communications/notices/[id]/route.ts');
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input), 'https://ce.test'); assert.equal(url.origin, 'https://ce.test');
  if (url.pathname.endsWith('/notice-draft-commands')) return f.fetch(url.pathname + url.search, options);
  if (options.method === 'POST') {
    const action = url.pathname.split('/').at(-1); assert.ok(Object.hasOwn(actionRoutes, action), 'only explicit existing approve/publish actions; no legacy or acknowledgement POST');
    return actionRoutes[action].POST(new Request(url, { ...options, headers: { ...options.headers, origin: url.origin } }), { params: Promise.resolve({ id: id(21) }) });
  }
  assert.ok(!options.method || options.method === 'GET');
  if (url.pathname.endsWith('/contexts')) return Response.json({ contexts: [f.context()] });
  if (url.pathname.endsWith('/dashboard')) return Response.json(f.dashboard());
  const req = new Request(url, options); Object.defineProperty(req, 'nextUrl', { value: url });
  const response = url.pathname.endsWith('/communications') ? await communicationsRoute.GET(req)
    : url.pathname.endsWith('/notices') ? await listRoute.GET(req)
    : await detailRoute.GET(req, { params: Promise.resolve({ id: url.pathname.split('/').at(-1) }) });
  assert.equal(response.headers.get('cache-control'), 'no-store, private'); return response;
};
function Probe() { context = provider.useCustomerContext(); return null; }
const wait = (ms = 30) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
async function mount(lang = 'en', initialView = 'official_notices') {
  language = lang; root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(provider.CustomerContextProvider, null,
    React.createElement(Probe), React.createElement(Page, { lang, initialView })))); await wait(220);
}
async function unmount() { if (root) { await act(async () => root.unmount()); root = null; } }
const click = async node => { assert.ok(node, 'required user control exists'); await act(async () => node.click()); await wait(); };
const dialog = () => document.querySelector('[role="dialog"]');
const composer = () => dialog()?.querySelector('form');
async function openComposer() { await click([...document.querySelectorAll('button')].find(b => b.textContent.trim() === ({ en: 'Create Official Notice', ro: 'Creează înștiințare oficială', fa: 'ثبت ابلاغیه رسمی جدید' }[language]))); }
async function input(node, value) {
  const proto = node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
async function fill() { await input(composer().querySelector('input[required]'), 'Synthetic title RO'); await input(composer().querySelector('textarea[required]'), 'Synthetic body RO'); }
async function save() {
  const form = composer(); await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await wait();
}
const posts = () => f.calls.filter(c => c.name === 'create_notice_draft_command_v1');
const retained = () => Object.keys(dom.window.localStorage).sort().map(k => [k, dom.window.localStorage.getItem(k)]);
async function start() { await openComposer(); await fill(); await click(dialog().querySelector('[data-durable-mode]')); }
async function openSaved() { await click(document.querySelector('[data-notice-open-saved]')); await wait(200); }
const cases = [];
async function test(name, run) {
  await unmount(); dom.window.localStorage.clear(); dom.window.sessionStorage.clear(); f = fixture(); calls = []; lateDetail = null;
  oracle = { auth: true, allowed: true, hasNotice: false, published: false, ack: false, foreign: false };
  try { await run(); cases.push(name); } finally { await unmount(); }
}
try {
  for (const lang of ['en', 'ro', 'fa']) {
    await test(`${lang}: canonical command receipt opens exact fresh server detail from current page`, async () => {
      await mount(lang, 'channels'); await start(); await save(); oracle.hasNotice = true;
      assert.equal(posts().length, 1); assert.equal(f.effects, 1); assert.equal(composer(), undefined);
      assert.ok(document.querySelector('[data-notice-open-saved]'), 'canonical receipt must hand off its exact notice identity');
      assert.ok(!document.body.textContent.includes('Synthetic body RO'), 'snapshot text is not an authorized detail');
      await openSaved(); assert.ok(dialog().textContent.includes('Canonical server body'));
      assert.equal(calls.filter(c => c.name === 'get_notice_detail_v1').at(-1).args.p_notice_id, id(21));
      assert.equal(document.querySelector('[dir="rtl"]') !== null, lang === 'fa');
    });
    await test(`${lang}: lost reply and full provider remount use existing lookup without another POST`, async () => {
      await mount(lang); await start(); f.loseReply = true; await save(); const before = retained();
      assert.equal(posts().length, 1); assert.equal(f.effects, 1); await unmount(); await mount(lang); await openComposer();
      assert.equal(dialog().querySelector('[data-durable-mode]').checked, true); assert.deepEqual(retained(), before);
      await click(dialog().querySelector('[data-durable-check]')); assert.equal(posts().length, 1);
      await click(dialog().querySelector('[data-durable-result]')); assert.deepEqual(retained(), before);
      oracle.hasNotice = true; await openSaved(); assert.ok(dialog().textContent.includes('Canonical server body'));
    });
    await test(`${lang}: explicit absence retry keeps original key/hash/body and canonical handoff`, async () => {
      await mount(lang); await start(); f.commandMode = 'missing'; await save();
      const original = posts()[0].serialized; await unmount(); await mount(lang); await openComposer();
      f.commandMode = ''; await click(dialog().querySelector('[data-durable-check]')); assert.equal(posts().length, 1);
      await fill(); await click(dialog().querySelector('[data-durable-retry]')); assert.equal(posts().length, 2);
      assert.equal(posts()[1].serialized, original); assert.equal(f.effects, 1);
      assert.ok(document.querySelector('[data-notice-open-saved]'));
    });
  }
  for (const denied of ['auth', 'allowed', 'foreign']) await test(`current ${denied} rejects recovered target content without resending`, async () => {
    await mount(); await start(); await save(); oracle.hasNotice = true;
    if (denied === 'foreign') oracle.foreign = true; else oracle[denied] = false;
    await openSaved(); assert.ok(!dialog().textContent.includes('Canonical server body')); assert.ok(dialog().querySelector('[role="alert"]'));
    assert.equal(posts().length, 1); assert.equal(f.effects, 1);
  });
  await test('workspace drift with same Context clears saved handoff and fences late detail', async () => {
    await mount(); await start(); await save(); oracle.hasNotice = true;
    let release; lateDetail = new Promise(resolve => { release = resolve; }); await click(document.querySelector('[data-notice-open-saved]'));
    const dashboard = f.dashboard; f.dashboard = () => ({ ...dashboard(), workspace_id: id(99) });
    await act(async () => context.refresh()); await wait(); release(); await wait(220);
    assert.equal(document.querySelector('[data-notice-open-saved]'), null); assert.equal(dialog(), null);
    assert.ok(!document.body.textContent.includes('Canonical server body')); assert.equal(posts().length, 1);
  });
  for (const mode of ['conflict', 'expiry', 'malformed', 'foreign']) await test(`command ${mode} has no canonical handoff or legacy fallback`, async () => {
    await mount(); await start(); f.commandMode = mode; await save();
    const before = retained(); assert.equal(posts().length, 1); assert.equal(document.querySelector('[data-notice-open-saved]'), null);
    await save(); assert.equal(posts().length, 1); assert.deepEqual(retained(), before);
  });
  await test('recipient denied read exposes no private body or existing acknowledgement', async () => {
    oracle.allowed = false; oracle.hasNotice = true; oracle.published = true; oracle.ack = true;
    await mount(); assert.ok(!document.body.textContent.includes('Canonical server body'));
    assert.ok(!document.body.textContent.includes(knownAck.acknowledged_at)); assert.equal(posts().length, 0);
  });
  await test('created canonical draft -> explicit existing approve/publish handlers -> recipient existing receipt', async () => {
    await mount(); await start(); await save(); oracle.hasNotice = true; await openSaved();
    const press = async text => click([...dialog().querySelectorAll('button')].find(b => b.textContent.trim() === text));
    await press('Approve Notice'); await wait(200); assert.equal(oracle.approved, true); assert.equal(oracle.published, false);
    await press('Publish and fix the recipient list'); await wait(200); assert.equal(oracle.published, true);
    assert.equal(calls.filter(c => c.name === 'approve_notice_v1').length, 1);
    assert.equal(calls.filter(c => c.name === 'publish_notice_v1').length, 1);
    await unmount(); const old = f.context, dashboard = f.dashboard;
    f.context = () => ({ ...old(), role_code: 'owner' });
    f.dashboard = () => { const d = dashboard(); return { ...d, persona: 'owner', context: { ...d.context, role_code: 'owner' } }; };
    oracle.ack = true; await mount(); await click([...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Details')); await wait();
    assert.ok(dialog().textContent.includes('Canonical server body')); assert.ok(dialog().textContent.includes('Acknowledged'));
    assert.equal(posts().length, 1); assert.equal(f.effects, 1);
  });
  await test('published authorized recipient reads existing receipt without create or acknowledgement mutation', async () => {
    const old = f.context, dashboard = f.dashboard;
    f.context = () => ({ ...old(), role_code: 'owner' });
    f.dashboard = () => { const d = dashboard(); return { ...d, persona: 'owner', context: { ...d.context, role_code: 'owner' } }; };
    oracle.hasNotice = true; oracle.published = true; oracle.ack = true; await mount();
    assert.equal([...document.querySelectorAll('button')].some(b => b.textContent.includes('Create Official Notice')), false);
    await click([...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Details')); await wait();
    assert.ok(dialog().textContent.includes('Canonical server body')); assert.ok(dialog().textContent.includes('Acknowledged'));
    assert.equal(posts().length, 0); assert.equal(f.effects, 0); assert.ok(![...dialog().querySelectorAll('button')].some(b => b.textContent.trim() === 'Confirm receipt'));
  });
  console.log(JSON.stringify({ task: '253-3', status: 'PASS', groups: cases.length, cases,
    proof: 'MOUNTED_REAL_PROVIDER_PAGE_AND_HANDLERS_FAKE_AUTH_RPC_ONLY', zod: requireDependency('zod/package.json').version,
    SQL_Auth_persistence_actual_browser: 'NOT_RUN_NOT_PASS', publication_and_audience: 'TEST_ORACLE_NOT_RUNTIME_PROOF' }, null, 2));
} finally {
  await unmount(); globalThis.fetch = originalFetch; dom.window.close();
  for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
