import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { fixture, scope, id, loader } from './lib/airprop-listing-flow-test-fixture.mjs';
const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
const saved = new Map(), nativeFetch = globalThis.fetch;
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
let membership = id(40);
let f, readOverride = null, postOverride = null, calls = [], cases = 0, currentApi;
const guards = new Map(), draftGuards = new Map();
const register = map => (key, dirty, clear) => { if (dirty) map.set(key, clear); else map.delete(key); return () => { if (map.get(key) === clear) map.delete(key); }; };
const contextMock = { useCustomerContext: () => ({ active: { ...scope, membership_id: membership }, loading: false, error: null, registerUnsavedGuard: register(guards) }) };
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
const reset = async () => { await act(async () => root.render(null)); sessionStorage.clear(); membership = id(40); guards.clear(); draftGuards.clear(); f = fixture(); currentApi = f.api; calls = []; readOverride = postOverride = null; };
const begin = async (key, lang = 'ro') => { await reset(); await render(key, { lang }); await select(id(30)); };
const reason = 'Motiv sintetic păstrat';
const editReason = () => input(2, reason);
const assertHidden = () => assert.doesNotMatch(document.body.textContent, /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|private-source-marker|private-evidence-marker/);
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';
const check = async (name, fn) => { if (only && !name.includes(only)) return; await fn(); assertHidden(); console.log('PASS', ++cases, name); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

try {
  if (!only) {
  await begin('custody-before'); await editReason();
  postOverride = async () => { throw Error('SYNTHETIC_LOST_REPLY'); };
  await click(button('Salvează perioada'));
  const original = postCalls()[0].body;
  const storageKey = sessionStorage.key(0), record = sessionStorage.getItem(storageKey);
  assert.equal(postCalls().length, 1); sessionStorage.removeItem(storageKey);
  await click(button('Reîncearcă aceeași cerere'));
  if (process.argv.includes('--counterexample-base')) {
    assert.equal(postCalls().length, 2); assert.equal(postCalls()[1].body, original);
    console.log(JSON.stringify({counterexample:'missing durable custody recreated on retry',beforePosts:1,afterPosts:postCalls().length,version:JSON.parse(record).recovery_version,identityStored:!!JSON.parse(record).owner,endpointStored:!!JSON.parse(record).endpoint}));
  } else {
    assert.equal(postCalls().length, 1, 'Missing original custody MUST NOT recreate journal and POST');
    console.log('PASS custody loss blocks retry without restoring journal');
  }
  }
  if (!process.argv.includes('--counterexample-base')) {
    await check('actor witness comes from successful server read only, never denial or stored identity', async () => {
      await reset(); const request = new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope));
      const response = await f.api.GET(request); assert.equal(response.headers.get('x-cladora-listing-actor'), f.state.actor);
      f.state.readDenied = true;
      const denied = await f.api.GET(request); assert.equal(denied.status, 403); assert.equal(denied.headers.get('x-cladora-listing-actor'), null);
    });
    await check('missing server actor witness keeps page readable and send unavailable', async () => {
      await reset(); readOverride = async request => { const response = await currentApi.GET(request); response.headers.delete('x-cladora-listing-actor'); return response; };
      await render('no-actor'); await select(id(30));
      assert.match(document.body.textContent, /Apartament sintetic Unirii/); assert.equal(button('Salvează perioada').disabled, true);
      await click(button('Salvează perioada')); assert.equal(postCalls().length, 0); assert.equal(sessionStorage.length, 0);
    });
    await check('same existing journal v2 pins endpoint, verified actor and membership, exact wire; no credentials', async () => {
      await begin('record'); await editReason(); postOverride = async () => { throw Error('LOST'); };
      await click(button('Salvează perioada'));
      const record = JSON.parse(sessionStorage.getItem(sessionStorage.key(0)));
      assert.deepEqual(record.owner, { context_id: scope.context_id, workspace_id: scope.workspace_id, actor_id: f.state.actor, membership_id: id(40) });
      assert.equal(record.endpoint, '/api/customer/v2/airprop/listings'); assert.equal(record.method, 'POST'); assert.equal(record.recovery_version, 2);
      assert.equal(record.wire, postCalls()[0].body); assert.deepEqual(Object.keys(record).sort(), ['endpoint','method','owner','recovery_version','state','wire']);
      assert.doesNotMatch(JSON.stringify(record), /token|cookie|password|authorization/i);
    });
    await check('lost committed reply -> reload -> higher GET keeps UNKNOWN -> explicit exact retry', async () => {
      await begin('reload'); await editReason(); postOverride = async request => { await currentApi.POST(request); throw Error('LOST_COMMIT'); };
      await click(button('Salvează perioada')); const wire = postCalls()[0].body, key = sessionStorage.key(0), raw = sessionStorage.getItem(key);
      postOverride = null; await render('actual-remount');
      assert.equal(postCalls().length, 1); assert.equal(sessionStorage.getItem(key), raw); assert.ok(button('Reîncearcă aceeași cerere'));
      await click(button('Verifică din nou')); assert.equal(sessionStorage.getItem(key), raw); assert.equal(postCalls().length, 1);
      await click(button('Reîncearcă aceeași cerere')); assert.equal(postCalls()[1].body, wire); assert.equal(f.state.writes, 1); assert.equal(sessionStorage.getItem(key), null);
    });
    await check('hydration is independent from hung GET; no actor witness means no POST', async () => {
      await begin('slow'); await editReason(); postOverride = async () => { throw Error('LOST'); }; await click(button('Salvează perioada'));
      const key = sessionStorage.key(0), raw = sessionStorage.getItem(key), pendingRead = deferred();
      readOverride = () => pendingRead.promise; await render('slow-reload');
      assert.equal(sessionStorage.getItem(key), raw); assert.equal(postCalls().length, 1); assert.match(document.body.textContent, /Rezultatul nu este cunoscut/); assert.equal(button('Reîncearcă aceeași cerere'), undefined);
      readOverride = null; await act(async () => pendingRead.resolve(await currentApi.GET(new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope)))));
      assert.ok(button('Reîncearcă aceeași cerere')); assert.equal(postCalls().length, 1);
    });
    await check('legacy record is retained unverified, never attributed to current actor; reading independent', async () => {
      await reset(); const command = await f.command(), key = `cladora.airprop-listing.v1:${membership}:${scope.context_id}:${scope.workspace_id}`;
      const raw = JSON.stringify({ recovery_version: 1, state: 'uncertain', wire: JSON.stringify(command) }); sessionStorage.setItem(key, raw);
      await render('legacy'); await select(id(30)); assert.equal(sessionStorage.getItem(key), raw); assert.equal(button('Reîncearcă aceeași cerere'), undefined); assert.equal(button('Salvează perioada').disabled, true); assert.equal(postCalls().length, 0);
    });
    await check('foreign actor record cannot be consumed after current successful GET', async () => {
      await begin('actorA'); await editReason(); postOverride = async () => { throw Error('LOST'); }; await click(button('Salvează perioada'));
      const key = sessionStorage.key(0), raw = sessionStorage.getItem(key); f.state.actor = id(99); await render('actorB');
      await select(id(30)); assert.equal(sessionStorage.getItem(key), raw); assert.equal(button('Reîncearcă aceeași cerere'), undefined); assert.equal(button('Salvează perioada').disabled, true); assert.equal(postCalls().length, 1);
    });
    await check('foreign membership and tampered endpoint/scope fail closed without deleting record', async () => {
      await begin('bound'); await editReason(); postOverride = async () => { throw Error('LOST'); }; await click(button('Salvează perioada'));
      const raw = sessionStorage.getItem(sessionStorage.key(0)), record = JSON.parse(raw), owner = record.owner;
      assert.equal(f.contract.readListingRecovery(raw, scope, { ...owner, membership_id: id(99) }).state, 'invalid');
      for (const patch of [{ endpoint: '/different' }, { method: 'DELETE' }, { owner: { ...owner, context_id: id(99) } }]) {
        assert.equal(f.contract.readListingRecovery(JSON.stringify({ ...record, ...patch }), scope, owner).state, 'invalid');
      }
      membership = id(41); const key = `cladora.airprop-listing.v1:${membership}:${scope.context_id}:${scope.workspace_id}`; sessionStorage.setItem(key, raw);
      await render('membershipB', { membershipId: membership }); await select(id(30)); assert.equal(button('Salvează perioada').disabled, true); assert.equal(sessionStorage.getItem(key), raw); assert.equal(postCalls().length, 1);
    });
    await check('quota and corruption block sending but do not erase independent read or draft', async () => {
      await begin('quota'); await editReason(); const native = dom.window.Storage.prototype.setItem;
      dom.window.Storage.prototype.setItem = () => { throw Error('QUOTA'); };
      try { await click(button('Salvează perioada')); } finally { dom.window.Storage.prototype.setItem = native; }
      assert.equal(postCalls().length, 0); assert.equal(document.querySelectorAll('input')[2].value, reason);
      const key = `cladora.airprop-listing.v1:${membership}:${scope.context_id}:${scope.workspace_id}`; sessionStorage.setItem(key, '{corrupt');
      await render('corrupt'); await select(id(30)); assert.equal(button('Salvează perioada').disabled, true); assert.equal(sessionStorage.getItem(key), '{corrupt'); assert.equal(postCalls().length, 0);
    });
    await check('late old decoded receipt cannot clear new membership draft or old journal', async () => {
      await begin('old'); await editReason(); const held = deferred();
      // Capture the valid controlled receipt independently from the transport hold.
      let receipt; postOverride = async request => { receipt = await (await currentApi.POST(request)).json(); return { ok: true, status: 200, json: () => held.promise }; };
      await click(button('Salvează perioada')); const oldKey = sessionStorage.key(0), raw = sessionStorage.getItem(oldKey);
      membership = id(41); f.state.actor = id(99); postOverride = null; await render('new', { membershipId: membership }); await select(id(30)); await editReason();
      await act(async () => held.resolve(receipt)); assert.equal(sessionStorage.getItem(oldKey), raw); assert.equal(document.querySelectorAll('input')[2].value, reason); assert.equal(postCalls().length, 1);
    });
    await check('no result producer/503 and revoke keep original UNKNOWN without inventing reconciliation', async () => {
      await begin('unknown'); await editReason(); postOverride = async () => Response.json({ error: { code: 'LISTING_COMMAND_NOT_READY' } }, { status: 503 });
      await click(button('Salvează perioada')); const key = sessionStorage.key(0), raw = sessionStorage.getItem(key);
      f.state.manage = false; await click(button('Verifică din nou')); assert.equal(button('Reîncearcă aceeași cerere').disabled, true);
      assert.equal(sessionStorage.getItem(key), raw); assert.equal(postCalls().length, 1); assert.equal(f.state.writes, 0);
    });

  }
} finally {
  await act(async () => root.unmount()); globalThis.fetch = nativeFetch;
  for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  dom.window.close();
}
