// Actual owner read/API/component, controlled SQL/HTTP/DOM. NOT native PG/Auth/browser.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { fixture, id, scope, loader } from './lib/airprop-listing-flow-test-fixture.mjs';
import { createAirpropR2ReadFixture } from './lib/airprop-r2-test-fixture.mjs';
const require = createRequire(import.meta.url), { NextRequest } = require('next/server');
const load = loader({ 'server-only': {} });
let groups = 0;
const check = async (name, run) => { await run(); console.log('PASS', ++groups, name); };
const get = () => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope));
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';
const beforeIndex = process.argv.indexOf('--predecessor-read-source');
if (beforeIndex >= 0) await check('BEFORE actual predecessor mapper permits actions without any stored binding witness', async () => {
  const mod = new Module(resolve('src/lib/airprop/listing-flow-read-v1.ts'));
  mod.filename = resolve('src/lib/airprop/listing-flow-read-v1.ts');
  mod.require = name => name === 'zod' ? require('zod') : name === '../core/airprop-companion-mapping-v1'
    ? load('src/lib/core/airprop-companion-mapping-v1.ts') : load('src/lib/airprop/listing-flow-contract-v1.ts');
  mod._compile(ts.transpileModule(readFileSync(process.argv[beforeIndex + 1], 'utf8'), {
    fileName: 'predecessor.ts', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, mod.filename);
  const f = fixture(); delete f.state.row.selected_binding;
  const rows = await mod.exports.readListingFlow(f.read, f.state.actor, scope);
  assert.equal(rows[0].actions.edit_listing, 'allowed');
});
if (!only || only === 'source') {
  for (const state of ['bound', 'legacy', 'stale', 'invalid', 'unavailable']) await check('GET200 independent read and exact action gate for ' + state, async () => {
    const f = fixture();
    if (state === 'legacy') f.state.row.selected_binding = { state: 'legacy' };
    if (state === 'stale') f.state.row.selected_binding.value.selection.resource_version--;
    if (state === 'invalid') f.state.row.selected_binding.value.context_id = id(99);
    if (state === 'unavailable') delete f.state.row.selected_binding;
    const r = await f.api.GET(get()), body = await r.json(); assert.equal(r.status, 200);
    assert.equal(body.listings[0].binding_state, state); assert.equal(body.can_edit, state === 'bound');
    assert.ok(Object.values(body.listings[0].actions).every(action => action === (state === 'bound' ? 'allowed' : 'unavailable')));
    assert.equal(Object.hasOwn(body.listings[0], 'selected_binding'), false); assert.equal(f.state.writes, 0);
  });
  await check('bound record is NOT permission; denied/missing action projection remains denied/unavailable', async () => {
    const f = fixture(); f.state.manage = false; let body = await (await f.api.GET(get())).json();
    assert.equal(body.listings[0].binding_state, 'bound'); assert.equal(body.can_edit, false);
    assert.equal(body.listings[0].actions.edit_listing, 'denied');
    f.state.manage = true; f.state.row.action_projections = []; body = await (await f.api.GET(get())).json();
    assert.equal(body.can_edit, false); assert.equal(body.listings[0].actions.edit_listing, 'unavailable');
    f.state.readDenied = true; assert.equal((await f.api.GET(get())).status, 403);
  });
}
if (!only || only === 'native') {
  // Core R2 intentionally rejects the old model's fabricated read scope. Use
  // the actual host/selector now; no historical positive is relabelled as R2.
  await check('R2 missing storage adoption keeps genuine authorized read available with no table probe', async () => {
    const f = createAirpropR2ReadFixture();
    const rows = await f.native.createListingNativeReadV1(f.host, f.producer)(id(3), scope);
    const mapped = await f.load('src/lib/airprop/listing-flow-read-v1.ts').readListingFlow(async () => rows, id(3), scope);
    assert.equal(mapped[0].binding_state, 'unavailable'); assert.equal(mapped[0].actions.edit_listing, 'unavailable');
    assert.equal(f.x.calls.some(q => q.text.includes('listing_selected_bindings_v1')), false);
  });
  await check('R2 configured binding storage cannot bypass closed Core SQL admission', async () => {
    const f = createAirpropR2ReadFixture(), reader = f.load('src/lib/airprop/listing-selected-binding-v1.ts').readListingSelectedBindingV1;
    await assert.rejects(f.native.createListingNativeReadV1(f.host, f.producer, reader)(id(3), scope), e => e.code === 'READ_QUERY_NOT_ADMITTED');
    assert.equal(f.x.calls.some(q => q.text.includes('listing_selected_bindings_v1')), false);
    assert.equal(f.x.calls.some(q => q.text === 'commit'), false);
  });
  await check('R2 read selector refuses copied/model scope instead of accepting fabricated command evidence', async () => {
    const f = createAirpropR2ReadFixture(); let actual;
    await f.host.withScope(id(3), scope, async s => { actual = s; return null; });
    const select = f.load('src/lib/core/current-unit-property-read-selector-v1.ts').selectCurrentUnitPropertyForReadV1;
    await assert.rejects(select({ ...actual }, { property_id: id(8), unit_id: id(9) }));
  });
}

if (!only || only === 'mounted') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' }), saved = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
  let f, calls, lang, loseReply = false, key = 0;
  const originalFetch = globalThis.fetch;
  const context = { useCustomerContext: () => ({ active: { ...scope, membership_id: id(40) }, loading: false, error: null, registerUnsavedGuard: () => () => {} }) };
  const component = loader({ './CustomerContextProvider': context })('src/components/customer/CustomerAirpropListings.tsx').CustomerAirpropListings;
  const button = text => Array.from(document.querySelectorAll('button')).find(b => b.textContent === text);
  const labels = { ro: { edit: 'Salvează perioada', refresh: 'Verifică din nou', bound: /Selecția salvată corespunde/, legacy: /Anunțul istoric/, stale: /Selecția salvată nu mai/, invalid: /Selecția salvată nu poate/, unavailable: /Înregistrarea selecției/ },
    en: { edit: 'Save availability', refresh: 'Check again', bound: /The saved selection matches/, legacy: /historical listing/, stale: /saved selection no longer/, invalid: /saved selection could not/, unavailable: /selection record is unavailable/ },
    fa: { edit: 'ذخیره بازه', refresh: 'بررسی دوباره', bound: /انتخاب ذخیره‌شده با این نسخه/, legacy: /آگهی تاریخی/, stale: /انتخاب ذخیره‌شده با نسخه/, invalid: /انتخاب ذخیره‌شده قابل بررسی نیست/, unavailable: /رکورد انتخاب در دسترس نیست/ } };
  const click = async el => { assert.ok(el); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
  const select = async value => act(async () => { const el = document.querySelector('select'); el.value = value; el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  const render = () => act(async () => root.render(React.createElement(component, { key: ++key, lang, contextId: id(1), workspaceId: id(2), membershipId: id(40), registerDraftGuard: () => () => {} })));
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, ...options }); assert.ok(String(url).startsWith('/api/customer/v2/airprop/listings'));
    const request = new NextRequest('https://cladora.test' + url, { ...options, headers: { Origin: 'https://cladora.test', ...options.headers } });
    if (options.method !== 'POST') return f.api.GET(request);
    const response = await f.api.POST(request);
    if (loseReply) { loseReply = false; throw Error('SYNTHETIC_LOST_REPLY'); }
    return response;
  };
  try {
    for (lang of ['ro', 'en', 'fa']) for (const state of ['bound', 'legacy', 'stale', 'invalid', 'unavailable']) await check('mounted ' + lang + '/' + state + ': readable, accurate message, safe action and no navigation POST', async () => {
      await act(async () => root.render(null)); sessionStorage.clear(); f = fixture(); calls = [];
      if (state === 'legacy') f.state.row.selected_binding = { state: 'legacy' };
      if (state === 'stale') f.state.row.selected_binding.value.spec_version = 3;
      if (state === 'invalid') f.state.row.selected_binding = { state: 'record', value: {} };
      if (state === 'unavailable') delete f.state.row.selected_binding;
      await render(); await select(id(30));
      assert.match(document.body.textContent, /Apartament sintetic Unirii/); assert.match(document.body.textContent, labels[lang][state]);
      assert.equal(button(labels[lang].edit).disabled, state !== 'bound');
      if (state !== 'bound') await click(button(labels[lang].edit));
      await select('unavailable-listing'); assert.equal(document.querySelector('select').value, '');
      assert.equal(document.querySelector('h3'), null); assert.equal(calls.filter(c => c.method === 'POST').length, 0);
      assert.doesNotMatch(document.body.textContent, /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|private-evidence|private-source/);
      assert.equal(document.querySelector('section').dir, lang === 'fa' ? 'rtl' : 'ltr');
    });
    await check('mounted refresh to stale binding preserves dirty input, blocks action and produces no POST', async () => {
      await act(async () => root.render(null)); sessionStorage.clear(); f = fixture(); calls = []; lang = 'en'; await render(); await select(id(30));
      const el = document.querySelectorAll('input')[2]; await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, 'Preserved original reason');
        el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      f.state.row.selected_binding.value.selection.relationship_version++;
      await click(button(labels.en.refresh)); assert.equal(document.querySelectorAll('input')[2].value, 'Preserved original reason');
      assert.equal(button(labels.en.edit).disabled, true); assert.match(document.body.textContent, labels.en.stale);
      assert.equal(calls.filter(c => c.method === 'POST').length, 0);
    });
    await check('UNKNOWN survives legacy-binding GET; later bound higher-version read permits only original explicit retry', async () => {
      await act(async () => root.render(null)); sessionStorage.clear(); f = fixture(); calls = []; lang = 'en'; await render(); await select(id(30));
      const el = document.querySelectorAll('input')[2]; await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, 'Original uncertain request');
        el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
      loseReply = true; await click(button(labels.en.edit));
      const original = calls.find(c => c.method === 'POST').body, storageKey = sessionStorage.key(0), journal = sessionStorage.getItem(storageKey);
      const valid = structuredClone(f.state.row.selected_binding); f.state.row.selected_binding = { state: 'legacy' };
      await click(button(labels.en.refresh)); assert.equal(sessionStorage.getItem(storageKey), journal);
      assert.equal(button('Retry the same request').disabled, true); assert.equal(calls.filter(c => c.method === 'POST').length, 1);
      f.state.row.selected_binding = valid; await click(button(labels.en.refresh));
      assert.equal(sessionStorage.getItem(storageKey), journal); assert.equal(button('Retry the same request').disabled, false);
      assert.equal(calls.filter(c => c.method === 'POST').length, 1);
      await click(button('Retry the same request')); const posts = calls.filter(c => c.method === 'POST');
      assert.equal(posts.length, 2); assert.equal(posts[1].body, original); assert.equal(f.state.writes, 1);
      assert.equal(sessionStorage.getItem(storageKey), null);
    });
  } finally {
    await act(async () => root.unmount()); globalThis.fetch = originalFetch;
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    dom.window.close();
  }
}
console.log(JSON.stringify({ groups, layer: 'CONTROLLED_SOURCE_API_SQL_DOM', native: 'NOT_RUN_NOT_PASS', browser: 'BLOCKED_TOOL_PLATFORM_OWNS_REAL_EXECUTION' }));
