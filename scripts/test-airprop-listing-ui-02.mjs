import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { fixture, scope, id, loader } from './lib/airprop-listing-flow-test-fixture.mjs';
const { NextRequest } = createRequire(import.meta.url)('next/server');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
const saved = new Map(), nativeFetch = globalThis.fetch;
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
let f, readOverride = null, postOverride = null, calls = [], cases = 0, currentApi;
const guards = new Map(), draftGuards = new Map();
const register = map => (key, dirty, clear) => { if (dirty) map.set(key, clear); else map.delete(key); return () => { if (map.get(key) === clear) map.delete(key); }; };
const contextMock = { useCustomerContext: () => ({ active: { ...scope, membership_id: id(40) }, registerUnsavedGuard: register(guards) }) };
const load = loader({ './CustomerContextProvider': contextMock });
const { CustomerAirpropListings } = load('src/components/customer/CustomerAirpropListings.tsx');
const draftRegistration = (dirty, clear) => register(draftGuards)('listing', dirty, clear);
const props = { ...{ lang: 'ro', contextId: scope.context_id, workspaceId: scope.workspace_id, membershipId: id(40) }, registerDraftGuard: draftRegistration };
globalThis.fetch = async (url, options = {}) => {
  assert.ok(String(url).startsWith('/api/customer/'), 'only synthetic relative app transport permitted');
  calls.push({ url, ...options });
  if (String(url).includes('/workspace/targets')) return Response.json({ workspaces: [{ workspace_id: scope.workspace_id, environment: 'PILOT' }, { workspace_id: id(92), environment: 'PILOT' }] });
  if (String(url).includes('/opportunities')) return Response.json({ opportunities: [] });
  assert.ok(String(url).startsWith('/api/customer/v2/airprop/listings'));
  const request = new NextRequest('https://cladora.test' + url, { ...options, headers: { Origin: 'https://cladora.test', ...options.headers } });
  if (options.method === 'POST') return postOverride ? postOverride(request) : currentApi.POST(request);
  return readOverride ? readOverride(request) : currentApi.GET(request);
};
const render = async (key, extra = {}) => act(async () => root.render(React.createElement(CustomerAirpropListings, { ...props, ...extra, key })));
const click = async element => { assert.ok(element); await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))); };
const button = text => Array.from(document.querySelectorAll('button')).find(x => x.textContent === text);
const select = async (value, element = document.querySelector('select')) => act(async () => { element.value = value; element.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
const input = async (index, value, element = document.querySelectorAll('input')[index]) => act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
const postCalls = () => calls.filter(x => x.method === 'POST');
const reset = async () => { await act(async () => root.render(null)); sessionStorage.clear(); guards.clear(); draftGuards.clear(); f = fixture(); currentApi = f.api; calls = []; readOverride = postOverride = null; };
const begin = async (key, lang = 'ro') => { await reset(); await render(key, { lang }); await select(id(30)); };
const reason = 'Motiv sintetic păstrat';
const editReason = () => input(2, reason);
const assertHidden = () => assert.doesNotMatch(document.body.textContent, /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|private-source-marker|private-evidence-marker/);
const check = async (name, fn) => { await fn(); assertHidden(); console.log('PASS', ++cases, name); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
try {
  for (const [lang, edit, withdraw, republish] of [['ro', 'Salvează perioada', 'Retrage anunțul', 'Publică din nou'], ['en', 'Save availability', 'Withdraw listing', 'Publish again'], ['fa', 'ذخیره بازه', 'توقف آگهی', 'انتشار دوباره']]) await check('mounted full edit/pause/republish ' + lang, async () => {
    await begin('flow-' + lang, lang); assert.equal(document.querySelector('section').dir, lang === 'fa' ? 'rtl' : 'ltr');
    assert.match(document.body.textContent, /Apartament sintetic Unirii/);
    for (const action of [edit, withdraw, republish]) {
      await editReason(); await click(button(action)); assert.equal(f.state.writes, postCalls().length);
      await select(id(30));
    }
    assert.equal(f.state.writes, 3); assert.equal(f.state.row.status, 'published');
    for (const call of postCalls()) {
      const request = JSON.parse(call.body); assert.equal(request.selection.resource_version, 4); assert.equal(request.selection.party_id, id(7));
      assert.equal(request.command.context_id, scope.context_id); assert.equal(request.command.workspace_id, scope.workspace_id);
    }
  });
  await check('invalid input and HTTP failure retain draft; exact retry does not rotate wire/key', async () => {
    await begin('uncertain'); await input(2, 'short'); await click(button('Salvează perioada')); assert.equal(postCalls().length, 0);
    await editReason(); postOverride = async () => { throw Error('SYNTHETIC_BEFORE_COMMIT_LOSS'); };
    await click(button('Salvează perioada')); const original = postCalls()[0].body;
    assert.equal(document.querySelectorAll('input')[2].value, reason); assert.ok(guards.size && draftGuards.size);
    postOverride = null; await click(button('Reîncearcă aceeași cerere')); assert.equal(postCalls()[1].body, original); assert.equal(f.state.writes, 1);
  });
  await check('lost committed reply -> remount -> exact same request, modeled write once', async () => {
    await begin('lost'); await editReason(); postOverride = async request => { await currentApi.POST(request); throw Error('SYNTHETIC_LOST_COMMIT_REPLY'); };
    await click(button('Salvează perioada')); const wire = postCalls()[0].body; assert.equal(f.state.writes, 1);
    postOverride = null; await render('reload'); assert.equal(postCalls().length, 1);
    await click(button('Reîncearcă aceeași cerere')); assert.equal(postCalls()[1].body, wire); assert.equal(f.state.writes, 1);
  });
  await check('409 is durably blocked across remount and locale; no new key or POST', async () => {
    await begin('conflict'); await editReason(); f.state.row.listing_version++;
    await click(button('Salvează perioada')); assert.equal(postCalls().length, 1);
    await render('conflict-reload', { lang: 'fa' }); assert.equal(button('تکرار همان درخواست'), undefined); assert.equal(postCalls().length, 1);
    assert.match(document.body.textContent, /مسدود/); assert.equal(f.state.writes, 0);
  });
  await check('latest GET wins; older decoded body cannot restore view after denial', async () => {
    await begin('read-race'); const old = await (await currentApi.GET(new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope)))).json();
    const body = deferred(); readOverride = async () => ({ ok: true, status: 200, json: () => body.promise });
    await click(button('Verifică din nou')); readOverride = null; f.state.readDenied = true;
    await click(button('Verifică din nou')); assert.doesNotMatch(document.body.textContent, /Apartament sintetic Unirii/);
    await act(async () => body.resolve(old)); assert.doesNotMatch(document.body.textContent, /Apartament sintetic Unirii/);
  });
  await check('fresh resource/listing drift preserves typed fields and disables stale command', async () => {
    await begin('drift'); await editReason(); f.state.row.listing_version++;
    await click(button('Verifică din nou')); assert.equal(document.querySelectorAll('input')[2].value, reason);
    assert.equal(button('Salvează perioada').disabled, true); assert.equal(postCalls().length, 0);
    await click(button('Renunță la modificările locale')); await select(id(30)); assert.equal(button('Salvează perioada').disabled, false);
  });
  await check('revoked authority after lost reply: retry denied, old source hidden, no extra modeled write', async () => {
    await begin('revoked'); await editReason(); postOverride = async request => { await currentApi.POST(request); throw Error('SYNTHETIC_LOST_REPLY'); };
    await click(button('Salvează perioada')); f.state.manage = false; postOverride = null;
    await click(button('Reîncearcă aceeași cerere')); assert.equal(f.state.writes, 1);
    assert.doesNotMatch(document.body.textContent, /Apartament sintetic Unirii/); assert.ok(sessionStorage.length);
  });
  await check('storage unavailable prevents dispatch; corrupt/foreign recovery is fail-closed', async () => {
    await begin('storage'); await editReason(); const original = dom.window.Storage.prototype.setItem;
    dom.window.Storage.prototype.setItem = () => { throw Error('SYNTHETIC_STORAGE_FAILURE'); };
    try { await click(button('Salvează perioada')); } finally { dom.window.Storage.prototype.setItem = original; }
    assert.equal(postCalls().length, 0); assert.match(document.body.textContent, /recuperată în siguranță/);
    sessionStorage.setItem(`cladora.airprop-listing.v1:${id(40)}:${scope.context_id}:${scope.workspace_id}`, 'corrupt');
    await render('corrupt'); assert.equal(button('Salvează perioada'), undefined); assert.equal(postCalls().length, 0);
  });
  await check('selection guard Keep/Escape/discard preserves values and has zero mutation', async () => {
    await reset(); const other = structuredClone(f.state.row); other.listing_id = id(31); other.status = 'withdrawn'; other.core.companion.canonical_reference.display_name = 'Apartament sintetic Dorobanți';
    currentApi = f.createListingFlowApi({ session: f.session, read: async (...args) => [...await f.read(...args), other], control: f.control });
    await render('switch'); await select(id(30)); await editReason(); await select(id(31));
    assert.equal(document.querySelector('select').value, id(30)); assert.equal(document.activeElement.textContent, 'Continuă editarea');
    await act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelectorAll('input')[2].value, reason); assert.equal(document.activeElement, document.querySelector('select'));
    await select(id(31)); await click(button('Continuă editarea')); assert.equal(document.querySelectorAll('input')[2].value, reason);
    await select(id(31)); await click(button('Renunță și schimbă anunțul'));
    assert.equal(document.querySelector('select').value, id(31)); assert.equal(document.querySelectorAll('input')[2].value, ''); assert.equal(postCalls().length, 0);
  });
  await check('unmount/scope change fences delayed POST body and never transfers prior party/source', async () => {
    await begin('scope'); await editReason(); const body = deferred();
    postOverride = async request => { const result = await (await currentApi.POST(request)).json(); return { ok: true, status: 200, json: async () => { await body.promise; return result; } }; };
    await click(button('Salvează perioada')); await render('scope', { contextId: id(91), workspaceId: id(92) });
    assert.doesNotMatch(document.body.textContent, /Apartament sintetic Unirii/); await act(async () => body.resolve());
    assert.doesNotMatch(document.body.textContent, /Apartament sintetic Unirii/); assert.equal(postCalls().length, 1);
    assert.ok(sessionStorage.length, 'old command journal must not be cleared by obsolete success');
  });
  await check('read-only producer permits display but never sends commands', async () => {
    await reset(); currentApi = f.createListingFlowApi({ session: f.session, read: f.read, control: null });
    await render('read-only'); await select(id(30)); await editReason(); assert.equal(button('Salvează perioada').disabled, true); assert.equal(postCalls().length, 0);
  });
  await check('synchronous double click dispatches once and unchanged dates preserve exact source precision', async () => {
    await reset(); f.state.row.available_from = '2026-11-02T10:00:31.123456Z'; await render('double'); await select(id(30)); await editReason();
    const target = button('Salvează perioada');
    await act(async () => { target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    assert.equal(postCalls().length, 1); assert.equal(f.state.writes, 1);
    assert.equal(JSON.parse(postCalls()[0].body).command.available_from, '2026-11-02T10:00:31.123456Z');
  });
  await check('locale change keeps draft and pending wire; no automatic POST', async () => {
    await begin('locale'); await editReason(); postOverride = async () => { throw Error('SYNTHETIC_NETWORK_FAILURE'); };
    await click(button('Salvează perioada')); const first = postCalls()[0].body;
    await render('locale', { lang: 'en' }); assert.equal(document.querySelectorAll('input')[2].value, reason); assert.equal(postCalls().length, 1);
    postOverride = null; await click(button('Retry the same request')); assert.equal(postCalls()[1].body, first);
  });
  await check('workspace aggregates Opportunity and Listing draft guards; clearing one cannot erase the other', async () => {
    await reset();
    const realLoad = loader({ './CustomerContextProvider': contextMock,
      './CustomerAirpropB2': { CustomerAirpropB2Workspace: () => null }, './CustomerAirpropValuation': { CustomerAirpropValuation: () => null },
      './CustomerAirpropDiligence': { CustomerAirpropDiligence: () => null }, './CustomerAirpropUnderwriting': { CustomerAirpropUnderwriting: () => null } });
    const { CustomerAirpropWorkspace } = realLoad('src/components/customer/CustomerAirpropWorkspace.tsx');
    await act(async () => root.render(React.createElement(CustomerAirpropWorkspace, { lang: 'ro', key: 'parent' })));
    await select(scope.workspace_id, document.querySelector('select'));
    const listing = Array.from(document.querySelectorAll('section')).find(x => x.getAttribute('aria-label') === 'Anunțuri pentru proprietăți');
    await select(id(30), listing.querySelector('select')); await input(0, reason, listing.querySelectorAll('input')[2]);
    const opportunityName = document.querySelector('input[name="name"]'); await input(0, 'Synthetic opportunity', opportunityName); await input(0, '', opportunityName);
    await select(id(92), document.querySelector('select')); assert.ok(document.querySelector('[role="alertdialog"]'));
    await click(button('Continuă editarea')); assert.equal(listing.querySelectorAll('input')[2].value, reason);
    await select(id(92), document.querySelector('select')); await click(button('Renunță la modificări')); assert.equal(postCalls().length, 0);
    assert.doesNotMatch(document.body.textContent, /Apartament sintetic Unirii/);
  });
  await check('actual ContextProvider protects Listing draft; cancel/confirm never mutate', async () => {
    await reset(); const ordinaryFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).endsWith('/contexts')) return Response.json({ contexts: [1, 91].map(n => ({ context_id: id(n), membership_id: id(n + 40), tenant_name: 'Synthetic tenant', role_code: 'OWNER', role_name: 'Owner', scope_type: 'tenant', context_label: 'Synthetic access' })) });
      if (String(url).includes('/dashboard?')) return Response.json({ modules: [] });
      return ordinaryFetch(url, options);
    };
    try {
      const real = loader({ '@/components/dashboard-lab/DashboardTransport': { useDashboardFetch: () => globalThis.fetch, useDashboardPreview: () => false } });
      const provider = real('src/components/customer/CustomerContextProvider.tsx');
      const component = loader({ './CustomerContextProvider': provider })('src/components/customer/CustomerAirpropListings.tsx');
      function Boundary() {
        const state = provider.useCustomerContext();
        return React.createElement(React.Fragment, null,
          React.createElement('button', { onClick: () => state.select(id(91)) }, 'Change context'),
          React.createElement('button', { onClick: state.cancelContextChange }, 'Cancel context'),
          React.createElement('button', { onClick: state.confirmContextChange }, 'Confirm context'),
          React.createElement('output', { 'data-pending': true }, state.pendingContextId ? 'pending' : 'none'),
          state.active && React.createElement(component.CustomerAirpropListings, { ...props, contextId: state.active.context_id, membershipId: state.active.membership_id }));
      }
      await act(async () => root.render(React.createElement(provider.CustomerContextProvider, null, React.createElement(Boundary))));
      await select(id(30)); await editReason(); await click(button('Change context'));
      assert.equal(document.querySelector('[data-pending]').textContent, 'pending'); assert.equal(document.querySelectorAll('input')[2].value, reason);
      await click(button('Cancel context')); assert.equal(document.querySelector('[data-pending]').textContent, 'none');
      await click(button('Change context')); await click(button('Confirm context'));
      assert.equal(postCalls().length, 0); assert.doesNotMatch(document.body.textContent, /Apartament sintetic Unirii/);
    } finally { globalThis.fetch = ordinaryFetch; }
  });
} finally {
  await act(async () => root.unmount()); globalThis.fetch = nativeFetch;
  for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  dom.window.close();
}
console.log(`${cases}/${cases} PASS_MOUNTED_SYNTHETIC; fake HTTP/Core authorization/receipt storage, not authenticated browser or PostgreSQL`);
