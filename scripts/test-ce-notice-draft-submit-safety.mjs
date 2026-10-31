// Actual composer + ContextProvider, synthetic DOM/transport only; no server/DB/Auth/send.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { fixture, makeLoader, scope as commandScope } from './test-ce-notice-draft-command-route.mjs';
const cf01 = process.argv.includes('--cf01');
const connected = process.argv.includes('--connected') || cf01;
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '8c8225fb3297035a2349357bd968d60779388063';
const baselineIndex = process.argv.indexOf('--baseline');
const baselineFile = baselineIndex < 0 ? null : process.argv[baselineIndex + 1];
if (baselineIndex >= 0) assert.ok(baselineFile, '--baseline requires a source snapshot from the exact BASE');
const require = createRequire(path.join(process.env.CE_TEST_DEPENDENCY_ROOT ?? rootPath, 'package.json'));
const ts = require('typescript'), React = require('react'), { act } = React, { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://ce.test/en/app/communications' });
Object.defineProperty(dom.window, 'crypto', { configurable: true, value: webcrypto });
const globals = new Map();
for (const [k, v] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
  globals.set(k, Object.getOwnPropertyDescriptor(globalThis, k)); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
const originalFetch = globalThis.fetch, originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
const timers = new Set(), unhandled = [], onUnhandled = e => unhandled.push(e);
process.on('unhandledRejection', onUnhandled);
let fastTimeout = false;
globalThis.setTimeout = (fn, ms, ...args) => {
  if (ms !== 15000) return originalSet(fn, ms, ...args);
  const h = originalSet(() => { timers.delete(h); fn(...args); }, fastTimeout ? 35 : ms); timers.add(h); return h;
};
globalThis.clearTimeout = h => { timers.delete(h); originalClear(h); };
const { createRoot } = require('react-dom/client');
function load(relative, mocks = {}, composer = false) {
  const filename = path.join(rootPath, relative), m = new Module(filename);
  let source = composer && baselineFile ? readFileSync(baselineFile, 'utf8') : readFileSync(filename, 'utf8');
  // Expose the actual private composer for callback/lifetime tests, without replacing its code.
  if (composer) source += '\nexport { CreateNoticeModal as TestComposer };\n';
  const result = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } });
  assert.deepEqual(result.diagnostics, []); m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  m._compile(result.outputText, filename); return m.exports;
}
const provider = load('src/components/customer/CustomerContextProvider.tsx', {
  '@/components/dashboard-lab/DashboardTransport': { useDashboardFetch: () => globalThis.fetch, useDashboardPreview: () => false },
});
const { TestComposer, CustomerCommunicationsDashboard } = load('src/components/customer/CustomerCommunicationsDashboard.tsx', {
  '@/lib/customer/notice-draft-transport': makeLoader()('src/lib/customer/notice-draft-transport.ts'),
  './CustomerContextProvider': provider, 'next/link': { __esModule: true, default: ({ children, ...p }) => React.createElement('a', p, children) },
}, true);
const { createNoticeDraftSchema } = load('src/lib/customer/communications-schema.ts');
const id = n => `22900000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = connected ? id(3) : id(1), B = id(80);
const contexts = [A, B].map((context_id, i) => ({ context_id, membership_id: connected && i === 0 ? id(4) : id(10 + i), role_code: 'association_admin', role_name: 'Synthetic admin', tenant_name: 'Synthetic', scope_type: 'unit', context_label: context_id }));
const receipt = { success: true, notice_id: id(30), status: 'draft' };
const response = (data, status = 201) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
let backend, durableCalls = [], strict = false, cf01Case = false;
let bootstrapMode = '', bootstrapWait = null, legacyWait = null, legacyRpcCalls = [];
const legacyHandler = makeLoader({
  '@/lib/supabase/server': { createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: id(2) } }, error: null }) },
    schema: name => { assert.equal(name, 'customer_api'); return { rpc: async (name, args) => {
      legacyRpcCalls.push({ name, args }); if (legacyWait) await legacyWait;
      return { data: receipt, error: null };
    } }; },
  }) }, 'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
})('src/app/api/customer/v1/communications/notices/route.ts');
let root, ctx, created = 0, closed = 0, posts = [], allPosts = [], reads = [], lang = 'en', integrated = false, show;
globalThis.fetch = (input, options = {}) => {
  const url = new URL(String(input), dom.window.location.origin);
  assert.equal(url.origin, dom.window.location.origin, 'no external transport');
  if (url.pathname.endsWith('/notice-draft-commands')) {
    durableCalls.push({ url, options });
    if (cf01Case && url.searchParams.get('action') === 'scope') return (async () => {
      if (bootstrapWait) await bootstrapWait;
      if (bootstrapMode === 'throw') throw new Error('PRIVATE_BOOTSTRAP');
      if (bootstrapMode === '503') return Response.json({ error: { code: 'UNKNOWN', message: 'bounded' } }, { status: 503 });
      if (bootstrapMode === 'malformed') return Response.json({ unexpected: true });
      return backend.fetch(url.pathname + url.search, options);
    })();
    if (connected) return backend.fetch(url.pathname + url.search, options);
    return Promise.resolve(Response.json({ v: 1, scope: { tenant_id: id(1), principal_id: id(2), context_id: A,
      membership_id: contexts[0].membership_id, workspace_id: id(5), target: { kind: 'unit', id: id(6) } } }));
  }
  if ((options.method ?? 'GET') === 'POST') {
    assert.equal(url.pathname, '/api/customer/v1/communications/notices', 'only draft route allowed');
    if (cf01Case) {
      posts.push({ url, options });
      return legacyHandler.POST(new Request(url, { ...options, headers: { ...options.headers, origin: url.origin } }));
    }
    return new Promise((resolve, reject) => { const p = { url, options, resolve, reject }; posts.push(p); allPosts.push(p); });
  }
  reads.push(url);
  if (url.pathname.endsWith('/contexts')) return Promise.resolve(response({ contexts }, 200));
  if (url.pathname.endsWith('/dashboard')) return Promise.resolve(response({}, 200));
  assert.equal(url.pathname, '/api/customer/v1/communications/notices');
  return Promise.resolve(response({ total: 0, rows: [] }, 200));
};
function Probe() { ctx = provider.useCustomerContext(); return null; }
function Harness({ language }) {
  const context = provider.useCustomerContext(); const [visible, setVisible] = React.useState(true); show = setVisible;
  const close = React.useCallback(() => { closed++; setVisible(false); }, []);
  const onCreated = React.useCallback(() => { created++; setVisible(false); }, []);
  return React.createElement('div', { dir: language === 'fa' ? 'rtl' : 'ltr' },
    visible && context.active ? React.createElement(TestComposer, { key: JSON.stringify(context.active), lang: language, close, onCreated }) : null);
}
const tick = (ms = 12) => act(async () => { await new Promise(r => originalSet(r, ms)); });
async function render(next = lang) {
  lang = next;
  await act(async () => root.render(React.createElement(strict ? React.StrictMode : React.Fragment, null, React.createElement(provider.CustomerContextProvider, null,
    React.createElement(Probe), integrated ? React.createElement(CustomerCommunicationsDashboard, { lang }) : React.createElement(Harness, { language: lang })))));
  await tick();
}
async function mount() { root = createRoot(document.getElementById('root')); await render(); if (integrated) await tick(170); }
async function unmount() { if (root) { await act(async () => root.unmount()); root = null; } }
const modal = () => document.querySelector('[role="dialog"]');
const form = () => modal().querySelector('form');
const submitButton = () => modal().querySelector('button[type="submit"]');
async function edit(node, value) {
  const proto = node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
}
async function fill() { await edit(modal().querySelector('input[required]'), 'Synthetic title RO'); await edit(modal().querySelector('textarea[required]'), 'Synthetic body RO'); }
async function submit(times = 1) {
  const f = form(); await act(async () => { for (let i = 0; i < times; i++) f.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await tick();
}
async function finish(data = receipt, status = 201) { await act(async () => posts.at(-1).resolve(response(data, status))); await tick(); }
async function close() { await act(async () => modal().querySelector('button[aria-label]').click()); await tick(); }
const text = () => document.body.textContent;
const statusText = () => modal()?.querySelector('[role="status"]')?.textContent ?? '';
const unknownCopy = { en: 'The request result is not yet known', ro: 'Rezultatul cererii nu este încă cunoscut', fa: 'نتیجه درخواست هنوز مشخص نیست' };
const cases = [];
const fields = () => {
  const inputs = [...form().querySelectorAll('input')], bodies = [...modal().querySelectorAll('textarea')];
  return { title_ro: inputs[0], body_ro: bodies[0], title_en: inputs[1], body_en: bodies[1], title_fa: inputs[2], body_fa: bodies[2] };
};
const payload = () => JSON.parse(posts.at(-1).options.body);
const validPayload = () => {
  const result = createNoticeDraftSchema.safeParse(payload());
  assert.equal(result.success, true, 'actual outgoing payload must satisfy actual route schema');
  return result.data;
};
async function choose(node, value) { await act(async () => { node.value = value; node.dispatchEvent(new dom.window.Event('change', { bubbles: true })); }); }
async function test(name, fn, language = 'en', integration = false, prepare = async () => {}) {
  if (cf01 && !name.startsWith('CF01:')) return;
  cf01Case = name.startsWith('CF01:');
  await unmount(); dom.window.sessionStorage.clear(); dom.window.localStorage.clear(); backend = fixture(); durableCalls = []; strict = false; bootstrapMode = ''; bootstrapWait = null; legacyWait = null; legacyRpcCalls = []; posts = []; allPosts = []; reads = []; created = 0; closed = 0; fastTimeout = false; lang = language; integrated = integration;
  const cleanup = await prepare();
  await mount();
  try { await fn(); cases.push(name); }
  finally { await unmount(); if (typeof cleanup === 'function') cleanup(); for (const p of allPosts) p.resolve(response(receipt)); await tick(); assert.equal(timers.size, 0, `${name}: no owned deadline leak`); }
}
try {
  if (!connected) {
  for (const language of ['en', 'ro', 'fa']) {
    for (const blank of ['', ' \n ']) await test(`${language}: blank translations omitted, actual schema accepts outgoing payload`, async () => {
      await fill(); for (const key of ['title_en', 'body_en', 'title_fa', 'body_fa']) await edit(fields()[key], blank);
      await submit(2); assert.equal(posts.length, 1); validPayload();
      for (const key of ['title_en', 'body_en', 'title_fa', 'body_fa']) assert.equal(Object.hasOwn(payload(), key), false);
      await finish(); assert.equal(created, 1);
    }, language);
    await test(`${language}: nonempty translations trim and preserve exact meaning`, async () => {
      await fill(); const values = { title_en: '  English title  ', body_en: ' English body\n', title_fa: ' عنوان فارسی ', body_fa: ' متن فارسی ' };
      for (const [key, value] of Object.entries(values)) await edit(fields()[key], value);
      await submit(); validPayload(); for (const [key, value] of Object.entries(values)) assert.equal(payload()[key], value.trim());
      assert.equal(payload().communication_type, 'general_announcement'); assert.equal(payload().legal_classification, 'informational_optional');
      await finish();
    }, language);
    for (const filled of ['title_en', 'body_en', 'title_fa', 'body_fa']) await test(`${language}: mixed optional translation ${filled} is preserved alone`, async () => {
      await fill(); for (const key of ['title_en', 'body_en', 'title_fa', 'body_fa']) await edit(fields()[key], key === filled ? ' Nonempty translation ' : '   ');
      await submit(); validPayload();
      for (const key of ['title_en', 'body_en', 'title_fa', 'body_fa']) {
        assert.equal(Object.hasOwn(payload(), key), key === filled);
        if (key === filled) assert.equal(payload()[key], 'Nonempty translation');
      }
      await finish();
    }, language);
    await test(`${language}: every selectable enum equals and passes actual schema; no semantic remap`, async () => {
      const keys = ['communication_type', 'legal_classification', 'source_module'];
      const values = keys.map((key, i) => {
        const actual = [...modal().querySelectorAll('select')[i].options].map(o => o.value);
        assert.deepEqual([...actual].sort(), [...createNoticeDraftSchema.shape[key].removeDefault().options].sort());
        return actual;
      });
      let completed = 0;
      for (let i = 0; i < keys.length; i++) for (const value of values[i]) {
        if (completed) { await act(async () => show(true)); await tick(); }
        await fill(); await choose(modal().querySelectorAll('select')[i], value);
        await submit(2); assert.equal(posts.length, completed + 1); validPayload(); assert.equal(payload()[keys[i]], value);
        await finish(); assert.equal(created, ++completed);
      }
    }, language);
  }
  for (const [key, max] of [['title_ro', 250], ['body_ro', 20000], ['title_en', 250], ['body_en', 20000], ['title_fa', 250], ['body_fa', 20000]]) {
    await test(`${key}: exact maximum and trimming accepted by actual outgoing schema`, async () => {
      await fill(); assert.equal(fields()[key].maxLength, max);
      await edit(fields()[key], ` ${'x'.repeat(max)} `); await submit(); validPayload(); assert.equal(payload()[key].length, max); await finish();
    });
    await test(`${key}: overlong value blocked before dispatch; corrective submit guarded`, async () => {
      await fill(); await edit(fields()[key], 'x'.repeat(max + 1));
      const rejected = { context_id: A, title_ro: 'Title', body_ro: 'Body', [key]: fields()[key].value };
      assert.equal(createNoticeDraftSchema.safeParse(rejected).success, false);
      await submit(2); assert.equal(posts.length, 0); assert.equal(created, 0); assert.equal(submitButton().disabled, false);
      assert.ok(statusText()); await edit(fields()[key], 'Corrected'); await submit(2); assert.equal(posts.length, 1); validPayload(); await finish();
    });
  }
  for (const key of ['title_ro', 'body_ro']) await test(`${key}: empty/whitespace required text fails without a request`, async () => {
    await fill(); for (const value of ['', ' \n ']) {
      await edit(fields()[key], value); await submit(2); assert.equal(posts.length, 0);
      assert.equal(createNoticeDraftSchema.safeParse({ context_id: A, title_ro: 'Title', body_ro: 'Body', [key]: value }).success, false);
    }
    await fill(); await submit(); validPayload(); await finish();
  });
  for (const key of ['title_ro', 'body_ro']) await test(`${key}: one trimmed character satisfies actual minimum`, async () => {
    await fill(); await edit(fields()[key], ' x '); await submit(); validPayload(); assert.equal(payload()[key], 'x'); await finish();
  });
  for (let i = 0; i < 3; i++) await test(`malformed enum${i}: foreign option cannot dispatch or remap`, async () => {
    await fill(); const select = modal().querySelectorAll('select')[i];
    const option = document.createElement('option'); option.value = 'unsupported_contract_value'; option.textContent = 'Synthetic invalid option'; select.append(option);
    await choose(select, option.value); await submit(); assert.equal(posts.length, 0); assert.equal(created, 0);
  });
  if (!process.argv.includes('--payload-only')) {
  for (const language of ['en', 'ro', 'fa']) {
    await test(`${language}: synchronous double-submit -> one POST and canonical completion`, async () => {
      await fill(); await submit(2); assert.equal(posts.length, 1);
      assert.equal(JSON.parse(posts[0].options.body).title_ro, 'Synthetic title RO');
      await finish(); assert.equal(created, 1); assert.equal(modal(), null);
    }, language);
    await test(`${language}: frozen submitted body; controls lock; locale cannot replay`, async () => {
      await fill(); await submit(); const body = posts[0].options.body;
      assert.equal(modal().querySelector('fieldset').disabled, true);
      await edit(modal().querySelector('input[required]'), 'Different pending edit');
      await render(language === 'fa' ? 'ro' : 'fa'); await submit(2);
      assert.equal(posts.length, 1); assert.equal(posts[0].options.body, body);
      assert.equal(JSON.parse(body).context_id, A); assert.equal(JSON.parse(body).title_ro, 'Synthetic title RO');
      await finish(); assert.equal(created, 1);
    }, language);
    for (const failure of ['network', 500, 503, 408, 429]) await test(`${language}: ${failure} unknown retains draft and blocks repeat`, async () => {
      await fill(); await submit();
      if (failure === 'network') { await act(async () => posts[0].reject(new Error('RAW_SENSITIVE_ERROR'))); await tick(); }
      else await finish({ error: { message: 'RAW_SENSITIVE_ERROR' } }, failure);
      assert.ok(statusText().includes(unknownCopy[language])); assert.equal(created, 0);
      assert.equal(modal().querySelector('input[required]').value, 'Synthetic title RO');
      assert.equal(modal().querySelector('textarea[required]').value, 'Synthetic body RO');
      assert.equal(submitButton().disabled, true); assert.equal(text().includes('RAW_SENSITIVE_ERROR'), false);
      await submit(2); await render('en'); await submit(); assert.equal(posts.length, 1);
    }, language);
    for (const status of [401, 403, 409, 400, 422, 413, 415]) await test(`${language}: HTTP${status} distinct from uncertainty, no raw error`, async () => {
      await fill(); await submit(); await finish({ error: { message: 'RAW_SENSITIVE_ERROR' } }, status);
      assert.ok(statusText()); assert.equal(statusText().includes(unknownCopy[language]), false); assert.equal(text().includes('RAW_SENSITIVE_ERROR'), false);
      assert.equal(created, 0); assert.equal(modal().querySelector('input[required]').value, 'Synthetic title RO');
      if ([400, 422, 413, 415].includes(status)) {
        assert.equal(submitButton().disabled, false); await edit(modal().querySelector('input[required]'), 'Corrected title');
        await submit(2); assert.equal(posts.length, 2); assert.equal(JSON.parse(posts[1].options.body).title_ro, 'Corrected title');
        await finish(); assert.equal(created, 1);
      } else { assert.equal(submitButton().disabled, true); await submit(2); assert.equal(posts.length, 1); }
    }, language);
    await test(`${language}: dirty Context guard cancel/confirm, late response fenced`, async () => {
      await fill(); await submit(); await act(async () => ctx.select(B)); await tick();
      assert.equal(ctx.active.context_id, A); assert.equal(ctx.pendingContextId, B);
      await act(async () => ctx.cancelContextChange()); assert.equal(ctx.active.context_id, A); assert.ok(modal());
      await act(async () => ctx.select(B)); await act(async () => ctx.confirmContextChange()); await tick();
      assert.equal(ctx.active.context_id, B); assert.equal(modal(), null); assert.equal(posts[0].options.signal.aborted, true);
      await finish(); assert.equal(created, 0); assert.equal(modal(), null); assert.equal(posts.length, 1);
    }, language);
    await test(`${language}: keyboard/RTL/live status; Escape cancels owned work`, async () => {
      await fill(); await submit(); assert.equal(document.querySelector('#root > div').dir, language === 'fa' ? 'rtl' : 'ltr');
      assert.ok(modal().querySelector('[role="status"][aria-live="polite"]'));
      assert.equal(modal().querySelector('input[dir="rtl"]').dir, 'rtl');
      const f = [...modal().querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')];
      // The shared dialog helper is unchanged; verify its existing boundary behavior.
      f.at(-1).focus(); await act(async () => modal().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
      assert.equal(document.activeElement, f[0]);
      await act(async () => modal().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
      assert.equal(modal(), null); assert.equal(closed, 1); assert.equal(posts[0].options.signal.aborted, true);
      posts[0].reject(new Error('late rejection')); await tick(); assert.equal(created, 0);
    }, language);
  }
  for (const bad of [null, {}, [], false, { success: false, notice_id: id(30), status: 'draft' }, { ...receipt, notice_id: 'foreign' }, { ...receipt, status: 'published' }, { success: true, status: 'draft' }, { to_jsonb: receipt }]) {
    await test(`malformed success ${JSON.stringify(bad)}`, async () => {
      await fill(); await submit(); await finish(bad); assert.equal(created, 0); assert.ok(statusText().includes(unknownCopy.en));
      await submit(); assert.equal(posts.length, 1);
    });
  }
  await test('invalid JSON success is unknown', async () => {
    await fill(); await submit(); await act(async () => posts[0].resolve({ ok: true, status: 201, json: async () => { throw new Error('JSON'); } }));
    await tick(); assert.equal(created, 0); assert.ok(statusText().includes(unknownCopy.en));
  });
  for (const navigate of ['close', 'context']) for (const outcome of ['valid', 'reject']) await test(`delayed body ${outcome} after ${navigate} cannot notify or complete`, async () => {
    await fill(); await submit(); let resolveBody, rejectBody;
    await act(async () => posts[0].resolve({ ok: true, status: 201, json: () => new Promise((r, j) => { resolveBody = r; rejectBody = j; }) }));
    if (navigate === 'close') await close();
    else { await act(async () => ctx.select(B)); await act(async () => ctx.confirmContextChange()); await tick(); }
    await act(async () => outcome === 'valid' ? resolveBody(receipt) : rejectBody(new Error('late body failure'))); await tick();
    assert.equal(created, 0); assert.equal(modal(), null); assert.equal(posts.length, 1);
  });
  await test('bounded timeout does not prove server cancellation or unlock retry', async () => {
    fastTimeout = true; await fill(); await submit(); await tick(65);
    assert.equal(posts[0].options.signal.aborted, true); assert.ok(statusText().includes(unknownCopy.en));
    await submit(); assert.equal(posts.length, 1); await finish(); assert.equal(created, 0); assert.ok(statusText().includes(unknownCopy.en));
  });
  await test('actual parent integration closes and refreshes only on canonical creation', async () => {
    const create = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create Official Notice'); assert.ok(create);
    await act(async () => create.click()); await tick(); await fill(); const count = reads.length;
    await submit(2); assert.equal(posts.length, 1); await finish(); await tick(170);
    assert.equal(modal(), null); assert.ok(reads.length > count, 'actual onCreated triggers read refresh');
  }, 'en', true);
  await test('component-lifetime boundary: close/reopen intentionally does not promise deduplication', async () => {
    await fill(); await submit(); await act(async () => posts[0].reject(new Error('unknown'))); await tick();
    assert.ok(statusText().includes('duplicates are possible')); await close();
    await act(async () => show(true)); await tick(); await fill(); assert.equal(submitButton().disabled, false);
    assert.equal(posts.length, 1, 'reopen never sends automatically');
  });
  await test('injected fixture failure cleans deadline/controller and observes late rejection', async () => {
    await fill(); await submit(); assert.equal(timers.size, 1);
    try { throw new Error('CE_INJECTED'); } catch (e) { assert.equal(e.message, 'CE_INJECTED'); } finally { await unmount(); }
    assert.equal(posts[0].options.signal.aborted, true); assert.equal(timers.size, 0); posts[0].reject(new Error('late')); await tick();
  });
  }
  }
  if (connected) {
    const enable = async () => { await act(async () => modal().querySelector('[data-durable-mode]').click()); await tick(); };
    const commandPosts = () => durableCalls.filter(c => c.options.method === 'POST');
    const stateText = () => modal()?.querySelector('[data-durable-status]')?.textContent ?? '';
    const check = async () => { const b = modal().querySelector('[data-durable-check]'); assert.ok(b); await act(async () => b.click()); await tick(); };
    const retry = async (count = 1) => { const b = modal().querySelector('[data-durable-retry]'); assert.ok(b); await act(async () => { for (let i = 0; i < count; i++) b.click(); }); await tick(); };
    for (const language of ['en', 'ro', 'fa']) {
      await test(`${language}: real composer -> new handler -> guarded command; double submit one POST/onCreated`, async () => {
        await fill(); await enable(); await submit(2); await tick(20);
        assert.equal(commandPosts().length, 1); assert.equal(posts.length, 0); assert.equal(created, 1); assert.equal(modal(), null); assert.equal(backend.effects, 1);
        const input = JSON.parse(commandPosts()[0].options.body); assert.equal(input.p_context_id, A); assert.equal(input.p_payload.scope.membership_id, id(4));
      }, language);
      await test(`${language}: lost reply -> pending -> lookup committed -> explicit recovered result`, async () => {
        backend.loseReply = true; await fill(); await enable(); await submit(2); await tick(15);
        assert.equal(created, 0); assert.equal(commandPosts().length, 1); assert.equal(backend.effects, 1);
        const retained = dom.window.localStorage.getItem(dom.window.localStorage.key(0));
        assert.equal(submitButton().disabled, true); assert.equal(modal().querySelector('[data-durable-mode]').disabled, true);
        await submit(2); assert.equal(commandPosts().length, 1); await check();
        assert.ok(modal().querySelector('[data-durable-result]')); assert.equal(dom.window.localStorage.getItem(dom.window.localStorage.key(0)), retained);
        await act(async () => modal().querySelector('[data-durable-result]').click()); await tick(); assert.equal(created, 1); assert.equal(posts.length, 0);
      }, language);
      await test(`${language}: authorized absence only explicit same key/hash retry, no second intent`, async () => {
        backend.commandMode = 'missing'; await fill(); await enable(); await submit();
        const old = commandPosts()[0].options.body; backend.commandMode = ''; await check();
        assert.equal(commandPosts().length, 1); assert.ok(modal().querySelector('[data-durable-retry]'));
        await edit(fields().title_ro, 'Edited field must not change existing snapshot'); await retry(2); await tick();
        assert.equal(commandPosts().length, 2); assert.equal(commandPosts()[1].options.body, old); assert.equal(backend.effects, 1); assert.equal(created, 1);
      }, language);
      await test(`${language}: retained pending survives close/remount; re-entry must match hash`, async () => {
        backend.commandMode = 'missing'; await fill(); await enable(); await submit(); const old = commandPosts()[0].options.body;
        await close(); await act(async () => show(true)); await tick(20);
        assert.equal(modal().querySelector('[data-durable-mode]').checked, true); assert.equal(commandPosts().length, 1);
        backend.commandMode = ''; await fill(); await edit(fields().title_ro, 'wrong re-entry'); await check(); await retry();
        assert.equal(commandPosts().length, 1); await edit(fields().title_ro, 'Synthetic title RO'); await check(); await retry(); await tick();
        assert.equal(commandPosts().length, 2); assert.equal(commandPosts()[1].options.body, old); assert.equal(created, 1);
      }, language);
      await test(`${language}: keyboard/RTL live recovery, no unsafe mode switch or legacy resend`, async () => {
        backend.commandMode = 'missing'; await fill(); await enable(); await submit();
        assert.equal(document.querySelector('#root > div').dir, language === 'fa' ? 'rtl' : 'ltr');
        assert.ok(modal().querySelector('[data-durable-status][aria-live="polite"]')); assert.equal(modal().querySelector('input[dir="rtl"]').dir, 'rtl');
        const controls = [...modal().querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')];
        controls.at(-1).focus(); await act(async () => modal().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
        assert.equal(document.activeElement, controls[0]);
        await act(async () => modal().dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
        assert.equal(modal(), null); assert.equal(closed, 1); assert.equal(created, 0); assert.equal(posts.length, 0); assert.ok(dom.window.localStorage.length);
      }, language);
      await test(`${language}: legacy choice retains actual old outgoing schema, response and double-submit guard`, async () => {
        await fill(); await submit(2); assert.equal(posts.length, 1); assert.equal(commandPosts().length, 0); validPayload(); await finish(); assert.equal(created, 1);
      }, language);
    }
    for (const mode of ['conflict', 'expiry', 'denied', 'malformed', 'foreign']) await test(`mounted ${mode}: bounded UI, retained pending, no fallback/retry`, async () => {
      backend.commandMode = mode; await fill(); await enable(); await submit(); await tick();
      assert.equal(created, 0); assert.ok(stateText()); assert.ok(!text().includes('PRIVATE')); assert.equal(posts.length, 0);
      await submit(2); assert.equal(commandPosts().length, 1); assert.ok(dom.window.localStorage.length);
      assert.equal(Boolean(modal().querySelector('[data-durable-retry]')), false);
    });
    for (const navigate of ['close', 'context', 'unmount']) await test(`mounted late reply after ${navigate}: no feedback/onCreated or pending loss`, async () => {
      let release; backend.deferred = new Promise(resolve => { release = resolve; });
      await fill(); await enable(); await submit(); const saved = dom.window.localStorage.getItem(dom.window.localStorage.key(0));
      if (navigate === 'close') await close();
      else if (navigate === 'context') { await act(async () => ctx.select(B)); await act(async () => ctx.confirmContextChange()); await tick(); }
      else await unmount();
      release(); await tick(30); assert.equal(created, 0); assert.equal(dom.window.localStorage.getItem(dom.window.localStorage.key(0)), saved); assert.equal(posts.length, 0);
    });
    await test('mounted timeout late reply remains UNKNOWN until current lookup', async () => {
      fastTimeout = true; let release; backend.deferred = new Promise(resolve => { release = resolve; });
      await fill(); await enable(); await submit(); await tick(60); assert.equal(created, 0); assert.ok(modal().querySelector('[data-durable-check]'));
      release(); await tick(15); assert.equal(created, 0); assert.equal(commandPosts().length, 1);
      backend.deferred = null; await check(); assert.ok(modal().querySelector('[data-durable-result]')); assert.equal(backend.effects, 1);
    });
    await test('StrictMode actual consumer cleanup/remount: no mount POST, one explicit command', async () => {
      await unmount(); strict = true; await mount(); await tick(20); assert.equal(commandPosts().length, 0);
      await fill(); await enable(); await submit(2); await tick(20); assert.equal(commandPosts().length, 1); assert.equal(created, 1);
    });
    await test('mounted projection drift after reopen retains original pending and blocks both protocols', async () => {
      backend.loseReply = true; await fill(); await enable(); await submit(); await close();
      const saved = dom.window.localStorage.getItem(dom.window.localStorage.key(0)), dashboard = backend.dashboard;
      backend.dashboard = () => ({ ...dashboard(), workspace_id: id(99) });
      await act(async () => show(true)); await tick(20); await fill(); await submit();
      assert.equal(commandPosts().length, 1); assert.equal(posts.length, 0); assert.equal(submitButton().disabled, true);
      assert.equal(modal().querySelector('[data-durable-mode]').checked, true);
      assert.equal(dom.window.localStorage.getItem(dom.window.localStorage.key(0)), saved);
      backend.dashboard = dashboard; await check(); assert.ok(modal().querySelector('[data-durable-result]'));
    });
    await test('protocol-switch race before admission: one synchronous gate covers both paths', async () => {
      await unmount(); let release;
      const gate = new Promise(resolve => { release = resolve; });
      Object.defineProperty(dom.window, 'crypto', { configurable: true, value: {
        randomUUID: () => webcrypto.randomUUID(), subtle: { digest: async (...args) => { await gate; return webcrypto.subtle.digest(...args); } },
      } });
      await mount(); await fill(); await enable();
      await act(async () => {
        form().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
        modal().querySelector('[data-durable-mode]').click();
        form().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      });
      assert.equal(posts.length, 0); assert.equal(commandPosts().length, 0);
      assert.equal(modal().querySelector('[data-durable-mode]').checked, true);
      release(); await tick(25); assert.equal(posts.length, 0); assert.equal(commandPosts().length, 1); assert.equal(created, 1);
      Object.defineProperty(dom.window, 'crypto', { configurable: true, value: webcrypto });
    });
    await test('browser storage failure blocks before command and preserves draft fields', async () => {
      await unmount(); const original = dom.window.Storage.prototype.setItem;
      dom.window.Storage.prototype.setItem = function(key, value) {
        if (key.startsWith(backend.codec.NOTICE_DRAFT_COMMAND)) throw new Error('PRIVATE_STORAGE');
        return original.call(this, key, value);
      };
      try {
        await mount(); await fill(); await enable(); await submit();
        assert.equal(commandPosts().length, 0); assert.equal(posts.length, 0); assert.equal(fields().title_ro.value, 'Synthetic title RO');
        assert.ok(stateText()); assert.ok(!text().includes('PRIVATE'));
      } finally { dom.window.Storage.prototype.setItem = original; }
    });
    await test('corrupt metadata locks both modes and is not cleared', async () => {
      await unmount(); const slot = backend.codec.noticeDraftStorageKey({ tenant_id: id(1), principal_id: id(2), context_id: A, membership_id: id(4), workspace_id: id(5), target: { kind: 'unit', id: id(6) } });
      dom.window.localStorage.setItem(slot, '{bad'); await mount(); await fill(); await submit(); assert.equal(submitButton().disabled, true);
      assert.equal(posts.length, 0); assert.equal(commandPosts().length, 0); assert.equal(dom.window.localStorage.getItem(slot), '{bad');
    });
    await test('actual parent integration: durable matching response closes and refreshes existing notice read', async () => {
      await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create Official Notice').click());
      await tick(); await fill(); await enable(); const before = reads.length; await submit(2); await tick(175);
      assert.equal(modal(), null); assert.ok(reads.length > before); assert.equal(backend.effects, 1);
    }, 'en', true);
    // CF01: run only the separation/fence delta, NOT the predecessor33 cases.
    async function seedPending(phase = 'unknown', binding = commandScope()) {
      const intent = await backend.make(undefined, id(7), binding);
      const engine = backend.codec.createNoticeDraftPending(dom.window.localStorage, binding, webcrypto.subtle);
      const admission = await engine.admit(intent); assert.equal(admission.state, 'admitted'); engine.mark(intent, phase, admission.ticket);
    }
    const retainedBytes = () => Object.keys(dom.window.localStorage).sort().map(key => [key, dom.window.localStorage.getItem(key)]);
    for (const mode of ['throw', '503', 'malformed']) {
      for (const language of ['en', 'ro', 'fa']) await test(`CF01: ${language} ${mode} optional bootstrap permits exactly one actual legacy handler POST`, async () => {
        assert.equal(modal().querySelector('[data-durable-mode]').checked, false);
        assert.equal(submitButton().disabled, false); assert.equal(modal().querySelector('[data-durable-status]'), null);
        await fill(); await submit(2); await tick(); assert.equal(posts.length, 1); assert.equal(commandPosts().length, 0);
        assert.equal(legacyRpcCalls.length, 1); assert.equal(legacyRpcCalls[0].name, 'create_notice_draft_v1');
        assert.equal(legacyRpcCalls[0].args.p_context_id, A); assert.equal(legacyRpcCalls[0].args.p_title_en, null);
        assert.equal(legacyRpcCalls[0].args.p_idempotency_key, null); assert.equal(created, 1); assert.equal(modal(), null);
      }, language, false, async () => { bootstrapMode = mode; });
      for (const kind of ['unknown', 'inaccessible', 'corrupt', 'ambiguous', 'incomplete']) {
        let saved;
        await test(`CF01: ${mode} bootstrap + ${kind} local storage blocks both paths, retains bytes`, async () => {
          await fill(); await submit(2); assert.equal(posts.length, 0); assert.equal(commandPosts().length, 0);
          assert.equal(legacyRpcCalls.length, 0); assert.equal(created, 0); assert.equal(submitButton().disabled, true);
          if (kind !== 'inaccessible') assert.deepEqual(retainedBytes(), saved);
          assert.equal(fields().title_ro.value, 'Synthetic title RO'); assert.ok(!text().includes('PRIVATE'));
        }, 'en', false, async () => {
          bootstrapMode = mode;
          if (['unknown', 'inaccessible', 'ambiguous'].includes(kind)) await seedPending();
          if (kind === 'ambiguous') await seedPending('unknown', { ...commandScope(), workspace_id: id(99) });
          if (kind === 'corrupt') dom.window.localStorage.setItem(backend.codec.noticeDraftStorageKey(commandScope()), '{bad');
          if (kind === 'incomplete') dom.window.localStorage.setItem('unrelated', 'keep');
          saved = retainedBytes();
          if (kind === 'inaccessible') {
            const original = dom.window.Storage.prototype.getItem;
            dom.window.Storage.prototype.getItem = function(key) { if (this === dom.window.localStorage) throw new Error('PRIVATE_STORAGE'); return original.call(this, key); };
            return () => { dom.window.Storage.prototype.getItem = original; assert.deepEqual(retainedBytes(), saved); };
          }
          if (kind === 'incomplete') {
            const original = dom.window.Storage.prototype.key;
            dom.window.Storage.prototype.key = function(index) { return this === dom.window.localStorage ? null : original.call(this, index); };
            return () => { dom.window.Storage.prototype.key = original; assert.deepEqual(retainedBytes(), saved); };
          }
        });
      }
      await test(`CF01: selected durable ${mode} bootstrap has no legacy fallback or automatic retry`, async () => {
        await fill(); await enable(); await submit(2); await tick();
        assert.equal(posts.length, 0); assert.equal(commandPosts().length, 0); assert.equal(created, 0);
        assert.equal(modal().querySelector('[data-durable-mode]').checked, true); assert.ok(stateText());
      }, 'en', false, async () => { bootstrapMode = mode; });
    }
    for (const phase of ['conflict', 'expired']) {
      let saved;
      await test(`CF01: ${phase} retained metadata blocks both choices despite failed bootstrap`, async () => {
        await fill(); await submit(2); assert.equal(posts.length, 0); assert.equal(commandPosts().length, 0); assert.deepEqual(retainedBytes(), saved);
      }, 'en', false, async () => { await seedPending(phase); saved = retainedBytes(); bootstrapMode = '503'; });
    }
    await test('CF01: fresh local check at legacy admission rejects UNKNOWN added after empty bootstrap', async () => {
      assert.equal(submitButton().disabled, false); await seedPending(); const saved = retainedBytes();
      await fill(); await submit(2); assert.equal(posts.length, 0); assert.equal(commandPosts().length, 0); assert.deepEqual(retainedBytes(), saved);
    }, 'en', false, async () => { bootstrapMode = 'throw'; });
    let bootstrapResume;
    await test('CF01: legacy remains available before bootstrap finishes; late bootstrap cannot weaken legacy in-flight fence', async () => {
      let finishLegacy; legacyWait = new Promise(resolve => { finishLegacy = resolve; });
      await fill(); await submit(2); assert.equal(posts.length, 1); assert.equal(legacyRpcCalls.length, 1);
      assert.equal(commandPosts().length, 0); assert.equal(created, 0); assert.equal(submitButton().disabled, true);
      bootstrapMode = 'malformed'; bootstrapResume(); await tick();
      await act(async () => modal().querySelector('[data-durable-mode]').click()); await submit();
      assert.equal(posts.length, 1); assert.equal(commandPosts().length, 0);
      finishLegacy(); await tick(); assert.equal(created, 1);
    }, 'en', false, async () => { bootstrapWait = new Promise(resolve => { bootstrapResume = resolve; }); });
    for (const mode of ['missing', 'malformed']) await test(`CF01: selected durable command ${mode} keeps pending and never falls back`, async () => {
      await fill(); await enable(); await submit(2); const saved = retainedBytes();
      await submit(2); await act(async () => modal().querySelector('[data-durable-mode]').click()); await submit();
      assert.equal(commandPosts().length, 1); assert.equal(posts.length, 0); assert.equal(legacyRpcCalls.length, 0);
      assert.equal(created, 0); assert.deepEqual(retainedBytes(), saved); assert.equal(modal().querySelector('[data-durable-mode]').checked, true);
    }, 'en', false, async () => { backend.commandMode = mode; });
    await test('CF01: synchronous durable admission await blocks protocol switch and double event with empty storage', async () => {
      let release; const gate = new Promise(resolve => { release = resolve; });
      await unmount(); Object.defineProperty(dom.window, 'crypto', { configurable: true, value: { randomUUID: () => webcrypto.randomUUID(),
        subtle: { digest: async (...args) => { await gate; return webcrypto.subtle.digest(...args); } } } });
      await mount(); await fill(); await enable();
      await act(async () => { form().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
        modal().querySelector('[data-durable-mode]').click(); form().dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
      assert.equal(dom.window.localStorage.length, 0); assert.equal(posts.length, 0); assert.equal(commandPosts().length, 0);
      release(); await tick(30); assert.equal(commandPosts().length, 1); assert.equal(posts.length, 0); assert.equal(created, 1);
      Object.defineProperty(dom.window, 'crypto', { configurable: true, value: webcrypto });
    });
    for (const navigate of ['close', 'context']) {
      let resume;
      await test(`CF01: ${navigate} during optional bootstrap ignores late response and preserves pending`, async () => {
        const saved = retainedBytes();
        if (navigate === 'close') await close();
        else { await act(async () => ctx.select(B)); await act(async () => ctx.confirmContextChange()); await tick(); }
        resume(); await tick(25); assert.equal(created, 0); assert.equal(posts.length, 0); assert.equal(commandPosts().length, 0);
        assert.deepEqual(retainedBytes(), saved);
      }, 'en', false, async () => { await seedPending(); bootstrapWait = new Promise(resolve => { resume = resolve; }); });
    }
    await test('CF01: healthy durable lost reply -> lookup/absence -> explicit same snapshot retry still succeeds', async () => {
      backend.commandMode = 'missing'; await fill(); await enable(); await submit(); const original = commandPosts()[0].options.body;
      backend.commandMode = ''; await check(); assert.equal(commandPosts().length, 1); await retry(2); await tick();
      assert.equal(commandPosts().length, 2); assert.equal(commandPosts()[1].options.body, original); assert.equal(backend.effects, 1); assert.equal(created, 1); assert.equal(posts.length, 0);
    });
  }

  if (cf01) assert.ok(cases.length > 0);
  assert.deepEqual(unhandled, []);
  console.log(JSON.stringify({ task: 'CE-NOTICE-DRAFT-SUBMIT-SAFETY-01', base: BASE, selection: cf01 ? 'PM123_CF01_DELTA_ONLY' : 'EXISTING_SELECTION', result: 'PASS', groups: cases.length, cases,
    evidence: 'ACTUAL_COMPOSER_PROVIDER_PARENT_AND_OUTGOING_SCHEMA_MOCKED_TRANSPORT',
    cleanup: cases.some(name => name.startsWith('injected fixture failure')) ? 'NORMAL_AND_INJECTED_PASS' : 'NORMAL_PASS', unhandled: 0,
    PostgreSQL_Auth_HTTP_browser: 'NOT_RUN_NOT_PASS', durableDeduplication: connected ? 'CONNECTED_SOURCE_FAKE_TRANSPORT_ONLY_LIVE_NOT_RUN' : 'LEGACY_HAS_NO_DURABLE_GUARANTEE' }, null, 2));
} finally {
  await unmount(); for (const p of allPosts) p.resolve(response(receipt)); await tick();
  globalThis.fetch = originalFetch; globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear;
  process.removeListener('unhandledRejection', onUnhandled); dom.window.close();
  for (const [k, v] of globals) { if (v) Object.defineProperty(globalThis, k, v); else delete globalThis[k]; }
}
