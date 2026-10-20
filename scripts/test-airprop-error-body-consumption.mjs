import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createB2Loader } from './lib/airprop-b2-test-loader.mjs';

// Mounted component controls with native Response/ReadableStream objects, not a fetch drain wrapper.
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
const saved = new Map(), originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout, bodyTimers = new Set();
globalThis.setTimeout = (callback, ms, ...args) => {
  const handle = originalSetTimeout(() => { bodyTimers.delete(handle); callback(...args); }, ms);
  if (ms === 1500) bodyTimers.add(handle);
  return handle;
};
globalThis.clearTimeout = handle => { bodyTimers.delete(handle); return originalClearTimeout(handle); };
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root'));
const contextA = '11111111-1111-4111-8111-111111111111', contextB = '11111111-1111-4111-8111-111111111112';
const workspaceA = '22222222-2222-4222-8222-222222222222', workspaceB = '22222222-2222-4222-8222-222222222223';
let active = { context_id: contextA }, passed = 0;
const guards = new Map();
const registerUnsavedGuard = (key, dirty, discard) => {
  if (dirty) guards.set(key, discard); else guards.delete(key);
  return () => { if (guards.get(key) === discard) guards.delete(key); };
};
const b2 = createB2Loader()('src/components/customer/CustomerAirpropB2.tsx');
const load = createB2Loader({
  './CustomerAirpropB2': { CustomerAirpropB2Workspace: () => null },
  './CustomerAirpropUnderwriting': { CustomerAirpropUnderwriting: () => null },
  './CustomerAirpropDiligence': { CustomerAirpropDiligence: () => null },
  './CustomerContextProvider': { useCustomerContext: () => ({ active, registerUnsavedGuard }) },
});
const { CustomerAirpropWorkspace } = load('src/components/customer/CustomerAirpropWorkspace.tsx');
const errorCopy = { en: 'Unable to load this workspace.', ro: 'Workspace-ul nu poate fi încărcat.', fa: 'اطلاعات ورک‌اسپیس دریافت نشد.' };
const unavailable = { en: 'The managed portfolio is currently unavailable.', ro: 'Portofoliul administrat nu este disponibil momentan.', fa: 'سبد تحت مدیریت در حال حاضر در دسترس نیست.' };
const empty = { en: 'No opportunities yet.', ro: 'Nu există încă oportunități.', fa: 'هنوز فرصتی ثبت نشده است.' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const emptyView = { version: 1, idempotent: true, as_of: '2026-10-20T12:00:00Z', properties: [], operations: { detail_owner: 'Operations', mode: 'canonical_references_only' }, finance: { detail_owner: 'Finance', mode: 'not_connected', reason: 'canonical_receipt_contract_unavailable' } };
const success = lane => lane === 'targets' ? json({ workspaces: [workspaceA, workspaceB].map(workspace_id => ({ workspace_id, environment: 'TEST' })) })
  : lane === 'opportunities' ? json({ opportunities: [] })
  : json({ artifact_id: 'AIRPROP-ARTIFACT-B2-20261013-R1', commands: null, can_edit: false, state: 'pre_activation', view: emptyView });
const pathname = url => new URL(url, 'https://cladora.test').pathname;
const laneFor = url => pathname(url).endsWith('/targets') ? 'targets' : pathname(url).endsWith('/artifact-b2') ? 'b2' : 'opportunities';
const render = (lane, lang, key) => act(async () => root.render(lane === 'b2'
  ? React.createElement(b2.CustomerAirpropB2Workspace, { lang, contextId: active.context_id, workspaceId: active.context_id === contextA ? workspaceA : workspaceB, key })
  : React.createElement(CustomerAirpropWorkspace, { lang, key })));
const choose = (value = workspaceA) => act(async () => {
  const select = document.querySelector('label select'); select.value = value;
  select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
});
const unmount = () => act(async () => root.render(null));
function streamed(kind, lane) {
  let index = 0, cancelled = 0, reads = 0;
  const code = lane === 'b2' ? 'AIRPROP_PRE_ACTIVATION' : 'AIRPROP_ACCESS_DENIED', raw = JSON.stringify({ error: { code, message: 'DO_NOT_EXPOSE_BACKEND_TEXT' } });
  const bytes = new TextEncoder().encode(kind === 'html' ? '<html>DO_NOT_EXPOSE_BACKEND_TEXT</html>' : kind === 'truncated' ? raw.slice(0, 20) : kind === 'oversize' ? 'x'.repeat(20000) : raw);
  const chunks = kind === 'empty' ? [] : [bytes.slice(0, 8), bytes.slice(8)];
  const body = kind === 'missing' ? null : new ReadableStream({
    pull(controller) { reads++; if (kind === 'pending' || kind === 'cancel-stall') return; if (kind === 'broken') { controller.error(new Error('synthetic interrupted stream')); return; } if (index < chunks.length) controller.enqueue(chunks[index++]); else controller.close(); },
    cancel() { cancelled++; if (kind === 'cancel-stall') return new Promise(() => {}); },
  }, { highWaterMark: 0 });
  const response = new Response(body, { status: kind === 'server' ? 500 : 403, headers: { 'content-type': kind === 'html' ? 'text/html' : 'application/json' } });
  // A clone would conceal which response was consumed and is explicitly forbidden here.
  response.clone = () => assert.fail('the product must consume the original response, not a clone');
  return { response, cancelled: () => cancelled, reads: () => reads, pending: kind === 'pending' };
}
async function checkError(lane, lang, kind) {
  await unmount(); active = { context_id: contextA };
  const sample = streamed(kind, lane), calls = [];
  globalThis.fetch = async (url, options = {}) => {
    assert.ok(typeof url === 'string' && url.startsWith('/api/customer/'), 'only local mocked component reads');
    assert.equal(options.method ?? 'GET', 'GET'); calls.push({ lane: laneFor(url), options });
    return laneFor(url) === lane ? sample.response : success(laneFor(url));
  };
  await render(lane, lang, `${lane}-${lang}-${kind}`);
  if (lane === 'opportunities') await choose();
  if (kind === 'pending' || kind === 'cancel-stall') await act(async () => delay(1700));
  assert.equal(calls.filter(c => c.lane === lane).length, 1, 'only the original GET is issued');
  if (kind !== 'missing') assert.equal(sample.response.bodyUsed, true, `${lane}/${lang}/${kind}: original error response must be consumed`);
  assert.equal(sample.response.body?.locked ?? false, false, 'no retained reader lock after completion/failure');
  if (kind === 'pending' || kind === 'cancel-stall' || kind === 'oversize') assert.equal(sample.cancelled(), 1, 'deadline/size failure cancels the owned reader');
  assert.equal(bodyTimers.size, 0, 'body deadline timer is cleared');
  assert.ok(document.body.textContent.includes(lane === 'b2' ? unavailable[lang] : errorCopy[lang]), 'localized unavailable state is retained');
  assert.equal(document.body.textContent.includes('DO_NOT_EXPOSE_BACKEND_TEXT'), false);
  if (lane === 'b2') assert.equal(document.querySelectorAll('button,form,input').length, 0, 'B2 stays read-only and pre-activation');
  passed++;
}
async function checkCancellation(lane, lang) {
  await unmount(); active = { context_id: contextA };
  const sample = streamed('pending', lane), calls = [];
  globalThis.fetch = async (url, options = {}) => { calls.push({ lane: laneFor(url), options }); return laneFor(url) === lane ? sample.response : success(laneFor(url)); };
  await render(lane, lang, `cancel-${lane}-${lang}`); if (lane === 'opportunities') await choose();
  await unmount();
  assert.equal(calls.find(c => c.lane === lane).options.signal.aborted, true);
  assert.equal(sample.cancelled(), 1, 'unmount cancels pending error body');
  assert.equal(sample.response.body.locked, false); assert.equal(document.body.textContent, '');
  assert.equal(bodyTimers.size, 0, 'unmount clears body deadline');
  passed++;
}
async function checkLate(lane, lang) {
  await unmount(); active = { context_id: contextA };
  let release; const sample = streamed('denied', lane), calls = [];
  globalThis.fetch = (url, options = {}) => {
    assert.equal(options.method ?? 'GET', 'GET');
    const old = url.includes(contextA); calls.push({ lane: laneFor(url), old, options });
    if (laneFor(url) === lane && old) return new Promise(resolve => { release = () => resolve(sample.response); });
    return Promise.resolve(success(laneFor(url)));
  };
  await render(lane, lang, 'late'); if (lane === 'opportunities') await choose();
  active = { context_id: contextB }; await render(lane, lang, 'late'); if (lane === 'opportunities') await choose();
  assert.equal(calls.find(c => c.lane === lane && c.old).options.signal.aborted, true);
  await act(async () => release());
  assert.equal(sample.cancelled(), 1, 'a late response after abort cancels its original body');
  assert.equal(document.querySelector('[role="alert"]'), null, 'stale error cannot overwrite the current scope');
  if (lane === 'opportunities') assert.ok(document.body.textContent.includes(empty[lang]));
  if (lane === 'b2') assert.equal(document.body.textContent.includes(unavailable[lang]), false, 'current successful B2 view remains');
  assert.equal(calls.filter(c => c.lane === lane && c.old).length, 1); passed++;
}
async function checkRetryAndDraft(lang) {
  await unmount(); sessionStorage.clear(); active = { context_id: contextA };
  const posts = [];
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'POST') {
      posts.push(options.body); if (posts.length === 1) throw new Error('synthetic unknown outcome');
      return json({ version: 2, workspace_id: workspaceA, opportunity_id: contextA, idempotent: true });
    }
    return success(laneFor(url));
  };
  const setInput = (name, value) => {
    const input = document.querySelector(`[name="${name}"]`);
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const click = button => act(async () => button.click());
  const submit = () => act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  const fields = () => ['name', 'city', 'asking_price'].map(name => document.querySelector(`[name="${name}"]`).value);
  await render('opportunities', lang, `retry-${lang}`); await choose();
  await act(async () => { setInput('name', 'Local draft'); setInput('city', 'Cluj'); setInput('asking_price', '12.3000'); });
  await choose(workspaceB);
  assert.ok(document.querySelector('[role="alertdialog"]')); assert.equal(document.querySelector('label select').value, workspaceA);
  await click(document.querySelector('[role="alertdialog"] button'));
  assert.deepEqual(fields(), ['Local draft', 'Cluj', '12.3000']); assert.equal(posts.length, 0);
  await submit(); assert.equal(posts.length, 1); assert.equal(document.querySelector('fieldset').disabled, true);
  const storageKey = `cladora.airprop.pending.v2:${contextA}:${workspaceA}`, frozen = sessionStorage.getItem(storageKey);
  assert.ok(frozen); await choose(workspaceB); await click(document.querySelectorAll('[role="alertdialog"] button')[1]);
  assert.deepEqual(fields(), ['', '', '']); assert.equal(posts.length, 1, 'discard navigation sends no extra POST');
  assert.equal(sessionStorage.getItem(storageKey), frozen, 'navigation preserves the exact pending command');
  await choose(workspaceA); assert.deepEqual(fields(), ['Local draft', 'Cluj', '12.3000']);
  assert.equal(posts.length, 1); await submit(); assert.equal(posts.length, 2); assert.equal(posts[1], posts[0], 'exact mutation retry payload/key unchanged');
  assert.equal(sessionStorage.getItem(storageKey), null); assert.deepEqual(fields(), ['', '', '']); assert.equal(guards.size, 0); passed++;
}
try {
  for (const lang of ['en', 'ro', 'fa']) for (const lane of ['targets', 'opportunities', 'b2']) {
    for (const kind of ['denied', 'server', 'html', 'truncated', 'empty', 'missing', 'oversize', 'broken', 'pending', 'cancel-stall']) await checkError(lane, lang, kind);
    await checkCancellation(lane, lang); await checkLate(lane, lang);
  }
  for (const lang of ['en', 'ro', 'fa']) await checkRetryAndDraft(lang);
  console.log(`PASS ${passed} mounted original-response controls: all three read paths, EN/RO/FA, bounded failures, abort/unmount, late scope and successful destination; no connected DB/Auth proof`);
} finally {
  await unmount(); await act(async () => root.unmount()); globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout;
  for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  dom.window.close();
}
