// Actual GET handler + mounted actual consumer/provider. Auth/RPC/HTTP are mocked.
// No server, PostgreSQL, Auth service, browser or connected-proof execution.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(process.env.CE_TEST_DEPENDENCY_ROOT ?? root, 'package.json'));
const ts = require('typescript');
const React = require('react');
const { act } = React;
const { JSDOM } = require('jsdom');
const { NextRequest } = require('next/server');
const baseline = process.argv.includes('--baseline');
const PARENT = 'f4e1936bcb56dbd21f206a742305af6518a5abec';
function load(relative, mocks = {}, atParent = false) {
  const filename = path.join(root, relative);
  const source = atParent ? execFileSync('git', ['show', `${PARENT}:${relative}`], { cwd: root, encoding: 'utf8' }) : readFileSync(filename, 'utf8');
  const m = new Module(filename);
  m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  const result = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } });
  assert.deepEqual(result.diagnostics, []);
  m._compile(result.outputText, filename);
  return m.exports;
}
const contextA = '22400000-0000-4000-8000-000000000040';
const contextB = '22400000-0000-4000-8000-000000000041';
const noticeId = '22400000-0000-4000-8000-000000000060';
const ack = { id: '22400000-0000-4000-8000-000000000080', acknowledged_at: '2026-10-22T12:34:56+00:00' };
const row = { id: noticeId, notice_number: 224, status: 'published', source_module: 'general',
  title_ro: 'CE224 Notice', title_en: 'CE224 Notice', title_fa: 'CE224 Notice',
  body_ro: 'CE224 PRIVATE-A', body_en: 'CE224 PRIVATE-A', body_fa: 'CE224 PRIVATE-A',
  communication_type: 'general_announcement', legal_classification: 'informational_optional', created_at: '2026-10-22T00:00:00Z' };
const detail = value => ({ notice: row, my_acknowledgement: value, statutory_evidence: [] });
let dbResult; let authDenied = false; let calls = [];
const route = load('src/app/api/customer/v1/communications/notices/[id]/route.ts', {
  '@/lib/customer/communications-api-helper': load('src/lib/customer/communications-api-helper.ts'),
  '@/lib/supabase/server': { createClient: async () => ({
    auth: { getClaims: async () => authDenied ? { data: null, error: { code: '401' } }
      : { data: { claims: { sub: '22400000-0000-4000-8000-000000000001' } }, error: null } },
    schema: schema => {
      assert.equal(schema, 'customer_api');
      return { rpc: async (name, args) => {
        assert.equal(name, 'get_notice_detail_v1');
        calls.push(args); return structuredClone(dbResult);
      } };
    },
  }) },
});
assert.deepEqual(Object.keys(route), ['GET']);
let handlerCases = 0;
async function get(data, { error = null, query = `context_id=${contextA}`, status = 200, denied = false } = {}) {
  dbResult = { data, error }; authDenied = denied; calls = [];
  const res = await route.GET(new NextRequest(`http://ce224.test/api/customer/v1/communications/notices/${noticeId}?${query}`),
    { params: Promise.resolve({ id: noticeId }) });
  assert.equal(res.status, status);
  assert.equal(res.headers.get('cache-control'), 'no-store, private');
  assert.equal(res.headers.get('vary'), 'Cookie');
  const body = await res.json();
  if (status === 200) {
    assert.deepEqual(body, data);
    assert.deepEqual(calls, [{ p_context_id: contextA, p_notice_id: noticeId }]);
  } else if (status === 400 || status === 401) assert.equal(calls.length, 0);
  handlerCases++;
  return body;
}
const absent = await get(detail(null));
const present = await get(detail(ack));
const malformed = [{ to_jsonb: null }, { to_jsonb: ack }, {}, [], false,
  { id: ack.id }, { ...ack, id: 'not-a-uuid' }, { ...ack, acknowledged_at: 'not-a-date' },
  { ...ack, acknowledged_at: '' }, { ...ack, acknowledged_at: '1' }];
for (const value of malformed) await get(detail(value)); // Handler forwards; consumer must reject.
await get(null, { query: '', status: 400 });
await get(null, { denied: true, status: 401 });
for (const message of ['customer_context_access_denied', 'recipient_record_not_found_for_caller']) {
  const body = await get(null, { error: { code: '42501', message }, status: 403 });
  assert.equal(body.error.code, 'FORBIDDEN');
}
await get(null, { error: { code: '22000', message: 'notice_not_found' }, status: 404 });
await get(null, { error: { code: 'XX000', message: 'synthetic SQL failure' }, status: 500 });

const dom = new JSDOM('<div id="root"></div>', { url: 'http://ce224.test/en/app/communications' });
const descriptors = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const originalFetch = globalThis.fetch;
const { createRoot } = require('react-dom/client');
const provider = load('src/components/customer/CustomerContextProvider.tsx', {
  '@/components/dashboard-lab/DashboardTransport': { useDashboardFetch: () => globalThis.fetch, useDashboardPreview: () => false },
});
const { CustomerCommunicationsDashboard } = load('src/components/customer/CustomerCommunicationsDashboard.tsx', {
  './CustomerContextProvider': provider,
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
}, baseline);
const contexts = [contextA, contextB].map((id, i) => ({ context_id: id, membership_id: `member-${i}`,
  tenant_name: `CE224 Tenant ${i}`, role_code: 'owner', role_name: 'Owner', scope_type: 'unit', context_label: id }));
let currentContext; let mountedRoot; let pending = []; let mutations = 0; let mountedCases = 0;
function Probe() { currentContext = provider.useCustomerContext(); return null; }
globalThis.fetch = (input, options = {}) => {
  const url = new URL(String(input), dom.window.location.origin);
  if ((options.method ?? 'GET') !== 'GET') { mutations++; throw new Error('Unexpected mutation while inspecting receipt'); }
  if (url.pathname.endsWith('/contexts')) return Promise.resolve({ ok: true, json: async () => ({ contexts }) });
  if (url.pathname.endsWith('/dashboard')) return Promise.resolve({ ok: true, json: async () => ({}) });
  return new Promise(resolve => pending.push({ url, options, resolve })); // Intentionally ignores abort.
};
const tick = (ms = 20) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
const take = predicate => { const i = pending.findIndex(predicate); assert.notEqual(i, -1, 'expected mocked read'); return pending.splice(i, 1)[0]; };
const reply = (r, data, ok = true) => act(async () => r.resolve({ ok, json: async () => data }));
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
const tr = {
  en: { details: 'Details', ack: 'Acknowledge Receipt', done: 'Receipt Acknowledged' },
  ro: { details: 'Detalii', ack: 'Confirmă primirea', done: 'Primire confirmată' },
  fa: { details: 'جزئیات', ack: 'اعلام وصول و تأیید دریافت', done: 'وصول تأیید شد' },
};
async function unmount() { if (mountedRoot) { await act(async () => mountedRoot.unmount()); mountedRoot = null; } }
async function open(lang, value, deferred = false) {
  await unmount(); pending = []; sessionStorage.clear();
  mountedRoot = createRoot(document.getElementById('root'));
  await act(async () => mountedRoot.render(React.createElement(provider.CustomerContextProvider, null,
    React.createElement(Probe), React.createElement(CustomerCommunicationsDashboard, { lang }))));
  await tick(180);
  await reply(take(r => r.url.pathname.endsWith('/notices')), { total: 1, rows: [row] });
  const opener = button(tr[lang].details); assert.ok(opener); opener.focus();
  await act(async () => opener.click()); await tick();
  const request = take(r => r.url.pathname.endsWith(`/${noticeId}`));
  if (!deferred) await reply(request, value);
  return request;
}
try {
  if (baseline) {
    await open('en', detail({ to_jsonb: null }));
    assert.ok(document.querySelector('[role="dialog"]').textContent.includes(tr.en.done));
    assert.equal(button(tr.en.ack), undefined, 'PARENT wrongly hides action for nested null wrapper');
    console.log('PARENT_REGRESSION_REPRODUCED: nested null masquerades as acknowledged (mounted, mocked transport).');
  } else {
    for (const lang of ['en', 'ro', 'fa']) {
      await open(lang, absent);
      assert.equal(document.querySelector('#root > div').dir, lang === 'fa' ? 'rtl' : 'ltr');
      assert.ok(button(tr[lang].ack)); assert.equal(button(tr[lang].ack).disabled, false);
      assert.equal(document.querySelector('[role="dialog"]').textContent.includes(tr[lang].done), false);
      mountedCases++;
      await open(lang, present);
      assert.equal(button(tr[lang].ack), undefined);
      const dialog = document.querySelector('[role="dialog"]');
      assert.ok(dialog.textContent.includes(tr[lang].done));
      const expectedDate = new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : lang === 'en' ? 'en-US' : 'ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ack.acknowledged_at));
      assert.equal(dialog.textContent.includes('Invalid Date'), false);
      assert.ok(dialog.textContent.includes(expectedDate), `canonical timestamp rendered in ${lang}`);
      mountedCases++;
      for (const value of malformed) {
        await open(lang, detail(value));
        const action = button(tr[lang].ack); assert.ok(action); assert.equal(action.disabled, true);
        const modal = document.querySelector('[role="dialog"]');
        assert.equal(modal.textContent.includes(tr[lang].done), false);
        assert.ok(modal.querySelector('[role="alert"]'));
        mountedCases++;
      }
      const old = await open(lang, null, true);
      await act(async () => currentContext.select(contextB));
      assert.equal(document.querySelector('[role="dialog"]'), null);
      await reply(old, present); await tick();
      assert.equal(document.body.textContent.includes(tr[lang].done), false);
      assert.equal(document.body.textContent.includes('CE224 PRIVATE-A'), false);
      mountedCases++;
      const denied = await open(lang, null, true);
      await reply(denied, {}, false);
      assert.ok(document.querySelector('[role="dialog"] [role="alert"]'));
      assert.equal(button(tr[lang].ack), undefined);
      mountedCases++;
    }
  }
  assert.equal(mutations, 0);
} finally {
  await unmount(); globalThis.fetch = originalFetch; dom.window.close();
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}
// Full latest RPC body comparison, not an authorization test surrogate.
const directory = path.join(root, 'supabase/migrations');
const defs = readdirSync(directory).sort().flatMap(name => {
  if (!name.endsWith('.sql')) return [];
  const match = readFileSync(path.join(directory, name), 'utf8').match(/create or replace function customer_api\.get_notice_detail_v1\([\s\S]*?\$\$;/i);
  return match ? [{ name, sql: match[0] }] : [];
});
const candidate = defs.at(-1), previous = defs.at(-2);
assert.match(candidate.name, /ce_notice_ack_read_shape_v1\.sql$/);
assert.equal(candidate.sql, previous.sql.replace('v_my_ack record;', 'v_my_ack jsonb;')
  .replace("'my_acknowledgement', to_jsonb(v_my_ack)", "'my_acknowledgement', v_my_ack"));
console.log(JSON.stringify({ suite: 'CE-NOTICE-ACK-READ-SHAPE-01', baseline, handlerCases, mountedCases,
  mutations, provenance: 'ACTUAL_GET_AND_REACT_CONSUMER_PROVIDER_MOCKED_AUTH_RPC_HTTP',
  PostgreSQL: 'NOT_RUN_NOT_PASS', connectedProof: 'NOT_RUN_NOT_PASS' }, null, 2));
