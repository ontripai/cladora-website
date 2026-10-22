// Actual React consumer + ContextProvider, synthetic HTTP/model only. No DB/Auth/server/browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(process.env.CE_TEST_DEPENDENCY_ROOT ?? rootPath, 'package.json'));
const ts = require('typescript'), React = require('react'), { act } = React, { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://ce.test/en/app/communications' });
const saved = new Map();
for (const [k, v] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k)); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
const originalFetch = globalThis.fetch, originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
const storage = dom.window.Storage.prototype, getItem = storage.getItem, setItem = storage.setItem, removeItem = storage.removeItem;
let fastTimeout = false; const timers = new Set();
globalThis.setTimeout = (fn, ms, ...args) => {
  if (ms !== 15000) return originalSet(fn, ms, ...args);
  const h = originalSet(() => { timers.delete(h); fn(...args); }, fastTimeout ? 25 : ms); timers.add(h); return h;
};
globalThis.clearTimeout = h => { timers.delete(h); originalClear(h); };
const unhandled = []; const onUnhandled = e => unhandled.push(e); process.on('unhandledRejection', onUnhandled);
const { createRoot } = require('react-dom/client');
function load(p, mocks = {}) {
  const filename = path.join(rootPath, p), m = new Module(filename);
  m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  const r = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } });
  assert.deepEqual(r.diagnostics, []); m._compile(r.outputText, filename); return m.exports;
}
const provider = load('src/components/customer/CustomerContextProvider.tsx', {
  '@/components/dashboard-lab/DashboardTransport': { useDashboardFetch: () => globalThis.fetch, useDashboardPreview: () => false },
});
const { CustomerCommunicationsDashboard } = load('src/components/customer/CustomerCommunicationsDashboard.tsx', {
  './CustomerContextProvider': provider, 'next/link': { __esModule: true, default: ({ children, ...p }) => React.createElement('a', p, children) },
});
const id = n => `22700000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = id(1), B = id(2), N = id(10), M = id(11), membership = id(20), tenant = id(30);
const contexts = [A, B].map((context_id, i) => ({ context_id, membership_id: i ? id(21) : membership,
  role_code: 'owner', role_name: 'Owner', tenant_name: 'Synthetic tenant', scope_type: 'unit', context_label: context_id }));
const receipt = { success: true, acknowledgement_id: id(50), acknowledged_at: '2026-10-22T15:14:13+00:00', is_statutory_proof: false };
const ack = { id: id(50), acknowledged_at: receipt.acknowledged_at, notice_id: N, membership_id: membership,
  tenant_id: tenant, acknowledgement_method: 'in_app_click', evidence_checksum: null, notes: null };
const notice = n => ({ id: n, tenant_id: tenant, status: 'published', notice_number: 1,
  title_ro: `PRIVATE-${n}`, title_en: `PRIVATE-${n}`, title_fa: `PRIVATE-${n}`, body_ro: 'PRIVATE-NOTICE-BODY', body_en: 'PRIVATE-NOTICE-BODY', body_fa: 'PRIVATE-NOTICE-BODY',
  communication_type: 'general_announcement', legal_classification: 'informational_optional', source_module: 'general', created_at: '2026-10-22T00:00:00Z' });
const detail = (a = null, n = N) => ({ notice: notice(n), my_acknowledgement: a, statutory_evidence: [] });
const labels = {
  en: { ack: 'Acknowledge Receipt', done: 'Receipt Acknowledged', check: 'Check receipt result', retry: 'Retry same receipt', unknown: 'Receipt outcome is unknown.', close: 'Close' },
  ro: { ack: 'Confirmă primirea', done: 'Primire confirmată', check: 'Verifică rezultatul confirmării', retry: 'Reîncearcă aceeași confirmare', unknown: 'Rezultatul confirmării este necunoscut.', close: 'Închide' },
  fa: { ack: 'اعلام وصول و تأیید دریافت', done: 'وصول تأیید شد', check: 'بررسی نتیجهٔ وصول', retry: 'تلاش مجدد همان وصول', unknown: 'نتیجهٔ ثبت وصول نامشخص است.', close: 'بستن' },
};
let root, ctx, lang = 'en', posts = [], reads = [], queuedGets = [], queuedLists = [], listReads = [], currentAck = null, all = [], cases = [];
const listData = () => ({ total: 2, rows: [notice(N), notice(M)] });
const response = (data, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
globalThis.fetch = (input, options = {}) => {
  const url = new URL(String(input), dom.window.location.origin); const method = options.method ?? 'GET';
  assert.equal(url.origin, dom.window.location.origin, 'no external attempt');
  if (url.pathname.endsWith('/contexts')) return Promise.resolve(response({ contexts }));
  if (url.pathname.endsWith('/dashboard')) return Promise.resolve(response({}));
  if (url.pathname.endsWith('/notices') && method === 'GET') {
    listReads.push({ url, options });
    return queuedLists.length ? queuedLists.shift()(url, options) : Promise.resolve(response(listData()));
  }
  if (method === 'POST') {
    assert.ok(url.pathname.endsWith('/acknowledge'), 'only existing ack mutation permitted');
    return new Promise((resolve, reject) => { const r = { url, options, resolve, reject }; posts.push(r); all.push(r); });
  }
  assert.equal(method, 'GET'); reads.push(url);
  if (queuedGets.length) return queuedGets.shift()(url, options);
  const n = url.pathname.split('/').at(-1);
  return Promise.resolve(response(detail(n === N ? currentAck : null, n)));
};
function Probe() { ctx = provider.useCustomerContext(); return null; }
const tick = (ms = 15) => act(async () => { await new Promise(r => originalSet(r, ms)); });
const text = () => document.body.textContent;
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label || b.getAttribute('aria-label') === label);
const click = async label => { const b = typeof label === 'string' ? button(label) : label; assert.ok(b, `button ${label}`); await act(async () => b.click()); await tick(); };
async function render(next = lang) {
  lang = next;
  await act(async () => root.render(React.createElement(provider.CustomerContextProvider, null,
    React.createElement(Probe), React.createElement(CustomerCommunicationsDashboard, { lang }))));
}
async function mount(next = lang) { root = createRoot(document.getElementById('root')); await render(next); await tick(180); }
async function unmount() { if (root) { await act(async () => root.unmount()); root = null; } }
async function open(n = N) {
  const tr = [...document.querySelectorAll('tbody tr')].find(r => r.textContent.includes(`PRIVATE-${n}`)); assert.ok(tr);
  await click(tr.querySelector('button')); await tick();
}
const key = (context = A, member = membership, n = N) => `cladora:notice-ack:v1:${JSON.stringify([context, member, n])}`;
const pendingRecord = (phase = 'unknown') => ({ v: 1, context: A, membership, notice: N, phase });
const finishPost = async (data = receipt, status = 200, i = posts.length - 1) => { await act(async () => posts[i].resolve(response(data, status))); await tick(); };
const losePost = async () => { await act(async () => posts.at(-1).reject(new Error('synthetic lost response'))); await tick(); };
const hasDone = () => text().includes(labels[lang].done);
async function test(name, fn, language = 'en') {
  await unmount(); storage.getItem = getItem; storage.setItem = setItem; storage.removeItem = removeItem;
  sessionStorage.clear(); posts = []; reads = []; queuedGets = []; queuedLists = []; listReads = []; all = []; currentAck = null; fastTimeout = false;
  await mount(language);
  try { await fn(); cases.push(name); }
  finally { await unmount(); for (const r of all) r.resolve(response(receipt)); await tick(); assert.equal(timers.size, 0, `${name}: timer cleanup`); }
}
try {
  const refresh = async () => { await click(document.querySelector('button[data-notice-refresh]')); await tick(180); };
  const absent = () => { assert.equal(text().includes('PRIVATE-'), false); assert.equal(hasDone(), false); assert.equal(document.querySelector('[role="dialog"]'), null); };
  for (const language of ['en', 'ro', 'fa']) {
    for (const status of [401, 403]) for (const kind of ['POST', 'GET']) {
      if (process.argv.includes('--r1-get') && kind !== 'GET') continue;
      await test(`R1 ${language}: ${kind}${status} -> explicit still-denied/error/restored reads`, async () => {
        await open(); await click(labels[lang].ack);
        if (kind === 'POST') await finishPost({}, status);
        else { await losePost(); queuedGets.push(() => Promise.resolve(response({}, status))); await click(labels[lang].check); }
        absent(); const pending = sessionStorage.getItem(key()); const count = posts.length;
        // A denied refresh must make exactly one new read, with no cache display or loop.
        let resolveList; const before = listReads.length;
        queuedLists.push(() => new Promise(r => { resolveList = r; })); await refresh();
        assert.equal(listReads.length, before + 1, 'explicit same-Context refresh must issue a fresh list GET'); absent();
        assert.equal(listReads.at(-1).url.searchParams.get('context_id'), A);
        assert.equal(listReads.at(-1).options.cache, 'no-store');
        await act(async () => resolveList(response({}, status))); await tick(180); absent();
        assert.equal(listReads.length, before + 1, 'no denied retry loop');
        queuedLists.push(() => Promise.resolve(response({}, 500))); await refresh(); absent();
        queuedLists.push(() => Promise.reject(new Error('R1 modeled read failure'))); await refresh(); absent();
        let obsoleteFetch;
        queuedLists.push(() => new Promise(r => { obsoleteFetch = r; })); await refresh(); absent();
        const obsoleteSignal = listReads.at(-1).options.signal;
        let resolveBody;
        queuedLists.push(() => Promise.resolve({ status: 200, ok: true, json: () => new Promise(r => { resolveBody = r; }) }));
        await refresh(); absent(); assert.equal(sessionStorage.getItem(key()), pending);
        assert.equal(obsoleteSignal.aborted, true);
        await act(async () => obsoleteFetch(response(listData()))); await tick(); absent();
        await act(async () => resolveBody(listData())); await tick(); await open();
        assert.equal(posts.length, count); assert.ok(button(labels[lang].check)); assert.equal(hasDone(), false);
        currentAck = ack; await click(labels[lang].check); assert.ok(hasDone());
        assert.equal(posts.length, count); assert.equal(sessionStorage.getItem(key()), null);
      }, language);
    }
    await test(`R1 ${language}: stale pre-denial list/detail bodies cannot revive data`, async () => {
      await open(); await click(labels[lang].ack); let oldListBody, oldDetailBody;
      queuedLists.push(() => Promise.resolve({ ok: true, status: 200, json: () => new Promise(r => { oldListBody = r; }) }));
      queuedGets.push(() => Promise.resolve({ ok: true, status: 200, json: () => new Promise(r => { oldDetailBody = r; }) }));
      await refresh(); await finishPost({}, 403); absent();
      let fresh; queuedLists.push(() => new Promise(r => { fresh = r; })); await refresh(); absent();
      await act(async () => { oldListBody(listData()); oldDetailBody(detail(ack)); }); await tick(); absent();
      await act(async () => fresh(response(listData()))); await tick(); await open();
      assert.ok(button(labels[lang].check)); assert.equal(hasDone(), false); assert.equal(posts.length, 1);
    }, language);
    await test(`R1 ${language}: timed-out POST body cannot complete after denial/revalidation`, async () => {
      fastTimeout = true; await open(); await click(labels[lang].ack); let oldBody;
      await act(async () => posts[0].resolve({ ok: true, status: 200, json: () => new Promise(r => { oldBody = r; }) }));
      await tick(45); fastTimeout = false;
      queuedGets.push(() => Promise.resolve(response({}, 401))); await click(labels[lang].check); absent();
      await refresh(); await open(); const pending = sessionStorage.getItem(key());
      await act(async () => oldBody(receipt)); await tick();
      assert.equal(hasDone(), false); assert.equal(sessionStorage.getItem(key()), pending); assert.equal(posts.length, 1);
      currentAck = ack; await click(labels[lang].check); assert.ok(hasDone()); assert.equal(posts.length, 1);
    }, language);
    await test(`R1 ${language}: conflict survives refresh/reopen and denial recovery`, async () => {
      await open(); await click(labels[lang].ack); await finishPost({}, 409);
      await refresh(); await click(labels[lang].close); await open();
      queuedGets.push(() => Promise.resolve(response({}, 403))); await click(labels[lang].check); absent();
      const pending = sessionStorage.getItem(key()); assert.equal(JSON.parse(pending).phase, 'conflict');
      await refresh(); await open(); await click(labels[lang].check);
      assert.equal(button(labels[lang].retry), undefined); assert.equal(button(labels[lang].ack)?.disabled, true);
      assert.equal(sessionStorage.getItem(key()), pending); assert.equal(posts.length, 1);
    }, language);
    await test(`R1 ${language}: restored authorized null allows only explicit exact retry`, async () => {
      await open(); await click(labels[lang].ack); const original = posts[0]; await finishPost({}, 403);
      await refresh(); await open(); assert.equal(posts.length, 1);
      await click(labels[lang].check); assert.equal(posts.length, 1);
      await click(labels[lang].retry); assert.equal(posts.length, 2);
      assert.equal(posts[1].url.href, original.url.href); assert.equal(posts[1].options.body, original.options.body);
      await finishPost(); assert.ok(hasDone());
    }, language);
    await test(`R1 ${language}: superseded refresh fetch cannot populate another identity`, async () => {
      await open(); await click(labels[lang].ack); await finishPost({}, 401); let stale;
      queuedLists.push(() => new Promise(r => { stale = r; })); await refresh();
      await act(async () => ctx.select(B)); await tick(180);
      await act(async () => stale(response({ rows: [{ ...notice(N), title_en: 'STALE-OLD', title_ro: 'STALE-OLD', title_fa: 'STALE-OLD' }] }))); await tick();
      assert.equal(text().includes('STALE-OLD'), false); assert.equal(posts.length, 1);
      await open(M); assert.equal(hasDone(), false); assert.equal(button(labels[lang].check), undefined);
      assert.ok(sessionStorage.getItem(key()));
      await act(async () => ctx.select(A)); await tick(180); await open();
      assert.ok(button(labels[lang].check)); assert.equal(posts.length, 1);
    }, language);
  }
  if (!process.argv.includes('--r1')) {
  for (const language of ['en', 'ro', 'fa']) {
    await test(`${language}:valid receipt + no auto POST on locale/refresh`, async () => {
      await open(); assert.equal(document.querySelector('#root > div').dir, language === 'fa' ? 'rtl' : 'ltr');
      await click(labels[lang].ack); assert.equal(posts.length, 1);
      assert.deepEqual(JSON.parse(posts[0].options.body), { context_id: A });
      assert.equal(JSON.parse(sessionStorage.getItem(key())).notice, N);
      await finishPost(); assert.ok(hasDone()); assert.equal(sessionStorage.getItem(key()), null);
      const storedTime = new Intl.DateTimeFormat(language === 'fa' ? 'fa-IR' : language === 'ro' ? 'ro-RO' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(receipt.acknowledged_at));
      assert.ok(text().includes(storedTime));
      await click(document.querySelector('button[data-notice-refresh]')); assert.equal(posts.length, 1);
      await render(language === 'en' ? 'fa' : 'en'); await tick(); assert.equal(posts.length, 1);
    }, language);
    await test(`${language}:modeled committed response lost -> GET own canonical receipt`, async () => {
      await open(); await click(labels[lang].ack); currentAck = ack; await losePost();
      assert.ok(text().includes(labels[lang].unknown)); assert.equal(hasDone(), false);
      await click(labels[lang].check); assert.ok(hasDone()); assert.equal(posts.length, 1);
      assert.equal(sessionStorage.getItem(key()), null);
    }, language);
    await test(`${language}:modeled precommit loss -> GET absence -> explicit same-intent retry`, async () => {
      await open(); await click(labels[lang].ack); const original = posts[0]; await losePost();
      await click(labels[lang].check); assert.equal(posts.length, 1);
      await click(labels[lang].retry); assert.equal(posts.length, 2);
      assert.equal(posts[1].url.href, original.url.href); assert.equal(posts[1].options.body, original.options.body);
      await finishPost(); assert.ok(hasDone());
    }, language);
  }
  for (const bad of [{}, null, { ...receipt, success: false }, { ...receipt, is_statutory_proof: true }, { ...receipt, acknowledgement_id: 'foreign-format' }, { ...receipt, acknowledged_at: 'bad' }]) {
    await test(`invalid 2xx ${JSON.stringify(bad)}`, async () => { await open(); await click(labels.en.ack); await finishPost(bad); assert.equal(hasDone(), false); assert.ok(button(labels.en.check)); assert.ok(sessionStorage.getItem(key())); });
  }
  for (const status of [500, 502, 503]) await test(`POST ${status} unknown`, async () => {
    await open(); await click(labels.en.ack); await finishPost({}, status); assert.equal(hasDone(), false); assert.ok(button(labels.en.check));
  });
  for (const change of [{ membership_id: id(999) }, { notice_id: M }, { tenant_id: id(999) }, { acknowledgement_method: 'offline_form' }, { evidence_checksum: 'changed' }, { notes: '' }]) {
    await test(`GET foreign/evidence mismatch ${JSON.stringify(change)}`, async () => {
      await open(); await click(labels.en.ack); await losePost(); currentAck = { ...ack, ...change };
      await click(labels.en.check); assert.equal(hasDone(), false); assert.equal(button(labels.en.ack)?.disabled, true); assert.equal(posts.length, 1);
    });
  }
  for (const a of [{ to_jsonb: ack }, {}, false]) await test(`GET malformed ${JSON.stringify(a)}`, async () => {
    await open(); await click(labels.en.ack); await losePost(); currentAck = a; await click(labels.en.check); assert.equal(hasDone(), false); assert.equal(posts.length, 1); assert.equal(button(labels.en.ack)?.disabled, true);
  });
  await test('GET wrong notice fails closed', async () => {
    await open(); await click(labels.en.ack); await losePost(); queuedGets.push(() => Promise.resolve(response(detail(ack, M))));
    await click(labels.en.check); assert.equal(hasDone(), false); assert.equal(button(labels.en.ack)?.disabled, true);
  });
  await test('GET 500/network leaves pending and no write', async () => {
    await open(); await click(labels.en.ack); await losePost(); queuedGets.push(() => Promise.resolve(response({}, 500)));
    await click(labels.en.check); queuedGets.push(() => Promise.reject(new Error('synthetic GET offline')));
    await click(labels.en.check); assert.ok(sessionStorage.getItem(key())); assert.equal(posts.length, 1); assert.equal(hasDone(), false);
  });
  for (const status of [401, 403]) for (const kind of ['POST', 'GET']) await test(`${kind} ${status} clears sensitive list/detail`, async () => {
    await open(); await click(labels.en.ack);
    if (kind === 'POST') await finishPost({}, status);
    else { await losePost(); queuedGets.push(() => Promise.resolve(response({}, status))); await click(labels.en.check); }
    assert.equal(document.querySelector('[role="dialog"]'), null); assert.equal(text().includes('PRIVATE-'), false);
    assert.ok(sessionStorage.getItem(key())); assert.equal(posts.length, 1);
  });
  await test('409 remains conflict across close/reopen and null read, no retry', async () => {
    await open(); await click(labels.en.ack); await finishPost({}, 409); await click(labels.en.close); await open();
    await click(labels.en.check); assert.equal(button(labels.en.retry), undefined); assert.equal(button(labels.en.ack)?.disabled, true);
    currentAck = ack; await click(labels.en.check); assert.ok(hasDone()); assert.equal(posts.length, 1);
  });
  await test('synchronous double-click guard', async () => {
    await open(); const b = button(labels.en.ack); await act(async () => { b.click(); b.click(); }); await tick();
    assert.equal(posts.length, 1); await finishPost(); assert.ok(hasDone());
  });
  await test('existing evidence submission remains disabled while receipt is in flight', async () => {
    await open(); await click('Record Physical Evidence');
    const submit = document.querySelector('[role="dialog"] form button[type="submit"]'); assert.ok(submit);
    assert.equal(submit.disabled, false); await click(labels.en.ack); assert.equal(submit.disabled, true);
    await losePost(); assert.equal(submit.disabled, false); assert.equal(posts.length, 1);
  });
  await test('locale switches preserve pending/body without replay', async () => {
    await open(); await click(labels.en.ack); const original = posts[0].options.body; await losePost();
    await render('ro'); await tick(); assert.ok(button(labels.ro.check)); await render('fa'); await tick();
    assert.ok(button(labels.fa.check)); assert.equal(posts.length, 1);
    await click(labels.fa.check); await click(labels.fa.retry); assert.equal(posts[1].options.body, original); await finishPost();
  });
  await test('close/reopen + same-tab reload keep minimal pending, GET only', async () => {
    await open(); await click(labels.en.ack); await losePost(); const raw = sessionStorage.getItem(key());
    assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['context','membership','notice','phase','v']);
    assert.equal(raw.includes('PRIVATE'), false); await click(labels.en.close); await open(); assert.equal(posts.length, 1);
    await unmount(); await mount(); await open(); assert.equal(posts.length, 1); currentAck = ack;
    await click(labels.en.check); assert.ok(hasDone());
  });
  for (const navigate of ['context', 'notice']) await test(`late fetch after ${navigate} navigation cannot restore completion`, async () => {
    await open(); await click(labels.en.ack);
    if (navigate === 'context') { await act(async () => ctx.select(B)); await tick(180); }
    else { await click(labels.en.close); await open(M); }
    await finishPost(); assert.equal(hasDone(), false); assert.equal(posts.length, 1); assert.ok(sessionStorage.getItem(key()));
  });
  await test('delayed POST body after unmount cannot restore feedback or delete pending', async () => {
    await open(); await click(labels.en.ack); let release;
    await act(async () => posts[0].resolve({ status: 200, ok: true, json: () => new Promise(r => { release = r; }) }));
    await click(labels.en.close); await open(M); await act(async () => release(receipt)); await tick();
    assert.equal(hasDone(), false); assert.ok(sessionStorage.getItem(key()));
  });
  await test('GET delayed body after context denial/navigation remains fenced', async () => {
    await open(); await click(labels.en.ack); await losePost(); let release;
    queuedGets.push(() => Promise.resolve({ status: 200, ok: true, json: () => new Promise(r => { release = r; }) }));
    await click(labels.en.check); await act(async () => ctx.select(B)); await tick(180);
    await act(async () => release(detail(ack))); await tick(); assert.equal(hasDone(), false); assert.equal(text().includes('PRIVATE-NOTICE-BODY'), false);
  });
  await test('bounded client timeout keeps unknown; late raw settlement cannot reset check', async () => {
    fastTimeout = true; await open(); await click(labels.en.ack); await tick(45); fastTimeout = false;
    assert.equal(posts[0].options.signal.aborted, true); assert.ok(button(labels.en.check));
    let resolveRead; queuedGets.push(() => new Promise(r => { resolveRead = r; })); await click(labels.en.check);
    await finishPost(); assert.equal(hasDone(), false); await act(async () => resolveRead(response(detail(ack)))); await tick(); assert.ok(hasDone());
  });
  for (const raw of ['{broken', JSON.stringify({ ...pendingRecord(), context: B }), JSON.stringify({ ...pendingRecord(), membership: id(999) }), JSON.stringify({ ...pendingRecord(), notice: M }), JSON.stringify({ ...pendingRecord(), v: 2 })]) {
    await test(`corrupt/foreign storage ${raw}`, async () => {
      await unmount(); sessionStorage.setItem(key(), raw); await mount(); await open();
      assert.equal(button(labels.en.ack)?.disabled, true); assert.equal(posts.length, 0); assert.equal(sessionStorage.getItem(key()), raw);
    });
  }
  for (const failure of ['read', 'write']) await test(`storage ${failure} failure prevents dispatch`, async () => {
    if (failure === 'read') { await unmount(); storage.getItem = function(k) { if (k.startsWith('cladora:notice-ack:')) throw new Error('storage denied'); return getItem.call(this, k); }; await mount(); }
    else storage.setItem = function(k, v) { if (k.startsWith('cladora:notice-ack:')) throw new Error('quota'); return setItem.call(this, k, v); };
    await open(); if (failure === 'write') await click(labels.en.ack);
    assert.equal(button(labels.en.ack)?.disabled, true); assert.equal(posts.length, 0);
  });
  await test('foreign tenant null result cannot authorize retry', async () => {
    await open(); await click(labels.en.ack); await losePost();
    const foreign = detail(null); foreign.notice.tenant_id = id(999);
    queuedGets.push(() => Promise.resolve(response(foreign))); await click(labels.en.check);
    assert.equal(button(labels.en.retry), undefined); assert.equal(posts.length, 1);
  });
  await test('POST malformed JSON body is unknown', async () => {
    await open(); await click(labels.en.ack);
    await act(async () => posts[0].resolve({ status: 200, ok: true, json: async () => { throw new Error('JSON'); } }));
    await tick(); assert.ok(button(labels.en.check)); assert.equal(hasDone(), false);
  });
  await test('GET malformed JSON keeps pending without replay', async () => {
    await open(); await click(labels.en.ack); await losePost();
    queuedGets.push(() => Promise.resolve({ status: 200, ok: true, json: async () => { throw new Error('JSON'); } }));
    await click(labels.en.check); assert.ok(button(labels.en.check)); assert.equal(posts.length, 1);
  });
  await test('GET timeout is bounded; late rejection stays observed', async () => {
    await open(); await click(labels.en.ack); await losePost(); fastTimeout = true; let rejectRead;
    queuedGets.push(() => new Promise((_, reject) => { rejectRead = reject; })); await click(labels.en.check); await tick(45);
    assert.ok(button(labels.en.check)); rejectRead(new Error('late GET rejection')); await tick(); assert.equal(posts.length, 1);
  });
  await test('401 fences a late current-detail refresh body too', async () => {
    await open(); await click(labels.en.ack); let release;
    queuedGets.push(() => new Promise(r => { release = r; }));
    await click(document.querySelector('button[data-notice-refresh]')); await finishPost({}, 401);
    await act(async () => release(response(detail(ack)))); await tick();
    assert.equal(text().includes('PRIVATE-'), false); assert.equal(hasDone(), false);
  });
  await test('returning to old Context performs read-only reconciliation', async () => {
    await open(); await click(labels.en.ack); await losePost();
    await act(async () => ctx.select(B)); await tick(180); await act(async () => ctx.select(A)); await tick(180);
    currentAck = ack; await open(); assert.equal(hasDone(), false); assert.equal(posts.length, 1);
    await click(labels.en.check); assert.ok(hasDone()); assert.equal(posts.length, 1);
  });
  await test('live status and keyboard containment/Escape preserve pending', async () => {
    await open(); await click(labels.en.ack); await losePost();
    const modal = document.querySelector('[role="dialog"]');
    assert.ok(modal.querySelector('[role="status"][aria-live="polite"]'));
    const focusable = [...modal.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
    focusable.at(-1).focus(); await act(async () => modal.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, focusable[0]);
    await act(async () => modal.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, focusable.at(-1));
    await act(async () => modal.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(document.querySelector('[role="dialog"]'), null); assert.ok(sessionStorage.getItem(key())); assert.equal(posts.length, 1);
  });
  await test('failed pending removal preserves recoverability and never replays', async () => {
    await open(); await click(labels.en.ack); currentAck = ack;
    storage.removeItem = function(k) { if (k.startsWith('cladora:notice-ack:')) throw new Error('remove denied'); return removeItem.call(this, k); };
    await finishPost(); assert.ok(hasDone()); assert.ok(sessionStorage.getItem(key()));
    await unmount(); await mount(); await open(); assert.equal(posts.length, 1);
    await click(labels.en.check); assert.ok(hasDone()); assert.equal(posts.length, 1);
  });
  await test('injected fixture failure cleans owned timers/controller then observes late rejection', async () => {
    await open(); await click(labels.en.ack); assert.equal(timers.size, 1);
    try { throw new Error('CE_INJECTED'); } catch (e) { assert.equal(e.message, 'CE_INJECTED'); }
    finally { await unmount(); }
    assert.equal(posts[0].options.signal.aborted, true); assert.equal(timers.size, 0);
    posts[0].reject(new Error('late rejection after cleanup')); await tick();
  });
  }
  assert.deepEqual(unhandled, []); console.log(JSON.stringify({ suite: 'CE-NOTICE-ACK-RESULT-RECOVERY-01', revision: 'R1', result: 'PASS', groups: cases.length, cases,
    boundary: 'ACTUAL_MOUNTED_CONSUMER_PROVIDER_MOCKED_HTTP_AND_MODELED_COMMIT', SQL_Auth_race: 'NOT_RUN_NOT_PASS', realBrowser: 'NOT_RUN_NOT_PASS',
    cleanup: cases.some(name => name.startsWith('injected fixture failure')) ? 'NORMAL_AND_INJECTED_PASS' : 'NORMAL_PASS', unhandled: unhandled.length }, null, 2));
} finally {
  await unmount(); for (const r of all) r.resolve(response(receipt)); await tick();
  storage.getItem = getItem; storage.setItem = setItem; storage.removeItem = removeItem;
  globalThis.fetch = originalFetch; globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear;
  dom.window.close(); process.removeListener('unhandledRejection', onUnhandled);
  for (const [k, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k]; }
}
