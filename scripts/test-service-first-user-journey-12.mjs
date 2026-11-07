import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import ts from 'typescript';

process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY = 'v1';
const require = createRequire(import.meta.url);
const cache = new Map();
const id = value => `${String(value).padStart(8, '0')}-0000-4000-8000-${String(value).padStart(12, '0')}`;
const scopeA = { context_id: id(1), workspace_id: id(11) };
const scopeB = { context_id: id(2), workspace_id: id(12) };
const selections = [
  { ...scopeA, membership_id: id(21), tenant_id: id(31), tenant_name: 'Synthetic A', role_code: 'resident', role_name: 'Resident', workspace_type: 'building', environment: 'PILOT' },
  { ...scopeB, membership_id: id(22), tenant_id: id(32), tenant_name: 'Synthetic B', role_code: 'manager', role_name: 'Manager', workspace_type: 'company', environment: 'PILOT' },
];
const labels = { ro: 'Serviciu real', en: 'Real service', fa: 'خدمت واقعی' };
const offering = { offering_id: id(41), revision_id: id(42), labels, description: labels, acquisition_mode: 'direct', price: { kind: 'quote_required' }, valid_from: '2026-11-01T00:00:00Z', valid_until: null, cancellation_terms: labels, acceptance_criteria: labels };
let bootstrapStatus = 200;
let bootstrapBody = { contract_version: 'core-service-app-read.v1', selections };
let calls = [];
let heldCatalog = null;
let journeyMode = false;
let postMode = 'lost';
const effects = new Set();
const fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).endsWith('/services/command-custody')) return Response.json({ contract: 'service-request-custody-owner.v1', owner: 'a'.repeat(64) });
  if (String(url).endsWith('/services/assembly-bootstrap')) return Response.json(bootstrapStatus === 200 ? bootstrapBody : { error: { code: 'CORE_SERVICE_ASSEMBLY_NOT_READY' } }, { status: bootstrapStatus });
  if (String(url).includes('/workspace/targets')) assert.fail('assembly profile must not use the legacy workspace target route');
  if (String(url).includes('/services/catalog?')) {
    if (heldCatalog && String(url).includes(`workspace_id=${scopeA.workspace_id}`)) return heldCatalog.promise;
    return Response.json({ offerings: String(url).includes(`workspace_id=${scopeA.workspace_id}`) ? [offering] : [] });
  }
  if (String(url).includes('/services/requests?')) return Response.json(journeyMode
    ? { can_request: true, beneficiaries: [{ party_id: id(51), label: 'Synthetic person' }], requests: [] }
    : { can_request: false, beneficiaries: [], requests: [] });
  if (String(url).includes('/services/offering-request-flow?')) return Response.json({
    status: 'ready', contract: 'service-offering-request-flow.v1', source_kind: 'workspace', resources: [],
  });
  if (String(url).endsWith('/services/offering-request-flow') && options.method === 'POST') {
    const body = JSON.parse(options.body);
    if (postMode === 'lost') { effects.add(body.idempotency_key); throw new Error('synthetic lost acknowledgement'); }
    if (postMode === 'readback_required') { effects.add(body.idempotency_key); return Response.json({ error: { code: 'READBACK_REQUIRED' } }, { status: 503 }); }
    if (postMode === 'conflict') return Response.json({ error: { code: 'CONFLICT' } }, { status: 409 });
    effects.add(body.idempotency_key);
    return Response.json({ request_id: id(61), status: 'submitted' });
  }
  return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
};
function load(file) {
  if (!existsSync(file) && file.pathname.endsWith('.ts')) file = new URL(file.href.replace(/\.ts$/, '.tsx'));
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file); const mod = new Module(filename);
  mod.require = name => name.endsWith('CustomerContextProvider') ? { useCustomerContext: () => ({ active: null }) }
    : name.endsWith('DashboardTransport') ? { useDashboardFetch: () => fetch }
    : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith('.') ? load(new URL(/\.[cm]?[jt]sx?$/.test(name) ? name : `${name}.ts`, file)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  cache.set(file.href, mod.exports); return mod.exports;
}
const { CustomerServiceCatalog } = load(new URL('../src/components/customer/CustomerServiceCatalog.tsx', import.meta.url));
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:3008/en/app/services' });
globalThis.FormData = dom.window.FormData; globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root'));
let generation = 0; let cases = 0;
async function render(lang = 'en') {
  await act(async () => root.render(React.createElement(CustomerServiceCatalog, { lang, key: ++generation })));
  const deadline = Date.now() + 3000;
  while (!document.querySelector('select') && !/Services could not be loaded|No workspace can be selected|cannot be safely restored/.test(document.body.textContent)) {
    assert.ok(Date.now() < deadline, 'bounded discovery and custody initialization');
    await act(async () => { await new Promise(done => setTimeout(done, 5)); });
  }
}
const choose = async scope => act(async () => {
  const select = document.querySelector('select');
  select.value = `${scope.context_id}:${scope.workspace_id}`;
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
});
async function check(name, operation) { await operation(); cases++; console.log(`PASS ${name}`); }
async function commandClick(getButton) {
  const before = calls.filter(call => call.options.method === 'POST').length;
  await act(async () => getButton().click());
  const deadline = Date.now() + 3000;
  for (;;) {
    await act(async () => { await new Promise(done => setTimeout(done, 5)); });
    const refresh = [...document.querySelectorAll('button')].find(button => button.textContent === 'Refresh catalogue');
    const button = getButton();
    if (calls.filter(call => call.options.method === 'POST').length > before && ((!button || !button.disabled) || (refresh && !refresh.disabled))) return;
    assert.ok(Date.now() < deadline, 'bounded actual command transport/UI settlement');
  }
}


try {
  await check('official discovery is explicit and does not use ContextProvider targets', async () => {
    calls = []; await render();
    assert.equal(calls.filter(call => call.url.endsWith('/services/assembly-bootstrap')).length, 1);
    assert.equal(calls.some(call => call.url.includes('/workspace/targets')), false);
    assert.equal(calls.some(call => call.url.includes('/services/catalog?')), false);
    const options = [...document.querySelectorAll('option')].map(option => option.textContent);
    assert.ok(options.some(value => value.includes('Synthetic A') && value.includes('Resident') && value.includes('building')));
    assert.equal(document.querySelector('select').value, '', 'a discovered selection is not authority and is never auto-selected');
  });
  await check('selection binds exact Context and Workspace to catalog and request history', async () => {
    calls = []; await choose(scopeA);
    const catalog = calls.find(call => call.url.includes('/services/catalog?'));
    const history = calls.find(call => call.url.includes('/services/requests?'));
    for (const call of [catalog, history]) {
      assert.ok(call); const url = new URL(call.url, dom.window.location.origin);
      assert.equal(url.searchParams.get('context_id'), scopeA.context_id);
      assert.equal(url.searchParams.get('workspace_id'), scopeA.workspace_id);
      assert.equal(call.options.credentials, 'same-origin'); assert.equal(call.options.cache, 'no-store');
    }
    assert.match(document.body.textContent, /Real service/);
    assert.equal([...document.querySelectorAll('button')].some(button => button.textContent?.includes('Manage service catalogue')), false);
  });
  await check('selection replacement fences a delayed prior catalog response', async () => {
    let resolve; heldCatalog = { promise: new Promise(done => { resolve = done; }) };
    await render(); await choose(scopeA); heldCatalog = null; await choose(scopeB);
    assert.equal(document.querySelector('article'), null);
    await act(async () => resolve(Response.json({ offerings: [offering] })));
    assert.equal(document.querySelector('article'), null);
    assert.equal(document.querySelector('select').value, `${scopeB.context_id}:${scopeB.workspace_id}`);
  });
  await check('unavailable or malformed bootstrap fails closed without legacy discovery', async () => {
    bootstrapStatus = 503; calls = []; await render();
    assert.match(document.body.textContent, /Services could not be loaded/);
    assert.equal(calls.some(call => call.url.includes('/workspace/targets')), false);
    bootstrapStatus = 200; bootstrapBody = { contract_version: 'wrong', selections };
    calls = []; await render(); assert.match(document.body.textContent, /Services could not be loaded/);
    assert.equal(calls.some(call => call.url.includes('/workspace/targets')), false);
    bootstrapBody = { contract_version: 'core-service-app-read.v1', selections };
  });
  await check('FA and RO keep explicit discovery usable without fabricated selection', async () => {
    for (const lang of ['fa', 'ro']) {
      await render(lang); assert.equal(document.querySelector('select').value, '');
      assert.equal(document.querySelector('section').dir, lang === 'fa' ? 'rtl' : 'ltr');
      assert.equal(document.querySelector('select').getAttribute('aria-label'), lang === 'fa' ? 'فضای کاری را انتخاب کنید' : 'Alege un spațiu de lucru');
    }
  });
  await check('UNKNOWN command custody blocks selection replacement and preserves the exact retry wire', async () => {
    journeyMode = true; postMode = 'lost'; effects.clear(); calls = [];
    await render(); await choose(scopeA);
    const selects = document.querySelectorAll('select');
    await act(async () => {
      selects[1].value = offering.offering_id;
      selects[1].dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    await act(async () => {
      document.querySelectorAll('select')[2].value = id(51);
      document.querySelectorAll('select')[2].dispatchEvent(new window.Event('change', { bubbles: true }));
      const description = document.querySelector('textarea');
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(
        description, 'Synthetic request with a lost acknowledgement',
      );
      description.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const submit = () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Send request' || button.textContent === 'Retry the same request');
    await commandClick(submit);
    const workspaceSelect = document.querySelector('select[aria-label="Choose a workspace"]');
    assert.equal(workspaceSelect.disabled, true, 'the official selector must hold custody while the command is UNKNOWN');
    const firstPost = calls.find(call => call.options.method === 'POST');
    assert.ok(firstPost); assert.equal(effects.size, 1);

    await act(async () => {
      workspaceSelect.value = `${scopeB.context_id}:${scopeB.workspace_id}`;
      workspaceSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assert.equal(workspaceSelect.value, `${scopeA.context_id}:${scopeA.workspace_id}`, 'A→B cannot unmount the unresolved command owner');
    assert.equal(calls.some(call => call.url.includes(`workspace_id=${scopeB.workspace_id}`)), false);

    postMode = 'success';
    await commandClick(submit);
    const posts = calls.filter(call => call.options.method === 'POST');
    assert.equal(posts.length, 2);
    assert.equal(posts[1].url, firstPost.url);
    assert.equal(posts[1].options.body, firstPost.options.body, 'retry endpoint/body/key must remain byte-identical');
    assert.equal(effects.size, 1, 'same idempotency key models one committed effect');
    assert.equal(workspaceSelect.disabled, false, 'a confirmed result releases selection custody');
    await choose(scopeB);
    assert.equal(workspaceSelect.value, `${scopeB.context_id}:${scopeB.workspace_id}`, 'the next selection is allowed after confirmation');
    journeyMode = false;
  });
  await check('UNKNOWN followed by 409 and refresh keeps command custody until the same wire is confirmed', async () => {
    journeyMode = true; postMode = 'lost'; effects.clear(); calls = [];
    await render(); await choose(scopeA);
    await act(async () => {
      const selects = document.querySelectorAll('select');
      selects[1].value = offering.offering_id; selects[1].dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    await act(async () => {
      const selects = document.querySelectorAll('select');
      selects[2].value = id(51); selects[2].dispatchEvent(new window.Event('change', { bubbles: true }));
      const input = document.querySelector('textarea');
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Synthetic unresolved command');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const commandButton = () => [...document.querySelectorAll('button')].find(button => /Send request|Retry the same request/.test(button.textContent));
    await commandClick(commandButton);
    const first = calls.find(call => call.options.method === 'POST'); assert.ok(first);
    postMode = 'conflict'; await commandClick(commandButton);
    let posts = calls.filter(call => call.options.method === 'POST');
    assert.equal(posts.length, 2); assert.equal(posts[1].url, first.url); assert.equal(posts[1].options.body, first.options.body);
    assert.equal(effects.size, 1);
    const refresh = [...document.querySelectorAll('button')].find(button => button.textContent === 'Refresh catalogue');
    assert.ok(refresh); await act(async () => refresh.click());
    const workspaceSelect = document.querySelector('select[aria-label="Choose a workspace"]');
    assert.equal(workspaceSelect.disabled, true, 'GET refresh cannot resolve an earlier UNKNOWN command');
    assert.equal(commandButton().textContent, 'Retry the same request');
    postMode = 'success'; await commandClick(commandButton);
    posts = calls.filter(call => call.options.method === 'POST');
    assert.equal(posts.length, 3); assert.equal(posts[2].url, first.url); assert.equal(posts[2].options.body, first.options.body);
    assert.equal(effects.size, 1); assert.equal(workspaceSelect.disabled, false);
    journeyMode = false;
  });
  await check('an initial 409 remains definitive and refresh permits a new command identity', async () => {
    journeyMode = true; postMode = 'conflict'; effects.clear(); calls = [];
    await render(); await choose(scopeA);
    await act(async () => {
      const selects = document.querySelectorAll('select');
      selects[1].value = offering.offering_id; selects[1].dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    await act(async () => {
      const selects = document.querySelectorAll('select');
      selects[2].value = id(51); selects[2].dispatchEvent(new window.Event('change', { bubbles: true }));
      const input = document.querySelector('textarea');
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Synthetic initial conflict');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const commandButton = () => [...document.querySelectorAll('button')].find(button => /Send request|Retry the same request/.test(button.textContent));
    await commandClick(commandButton);
    const firstBody = calls.find(call => call.options.method === 'POST').options.body;
    const refresh = [...document.querySelectorAll('button')].find(button => button.textContent === 'Refresh catalogue');
    await act(async () => refresh.click());
    const workspaceSelect = document.querySelector('select[aria-label="Choose a workspace"]');
    assert.equal(workspaceSelect.disabled, false); assert.equal(commandButton().textContent, 'Send request');
    postMode = 'success'; await commandClick(commandButton);
    const posts = calls.filter(call => call.options.method === 'POST');
    assert.equal(posts.length, 2); assert.notEqual(posts[1].options.body, firstBody);
    assert.equal(effects.size, 1); journeyMode = false;
  });
  await check('HTTP 503 READBACK_REQUIRED survives retry conflict and GET refresh until exact confirmation', async () => {
    journeyMode = true; postMode = 'readback_required'; effects.clear(); calls = [];
    await render(); await choose(scopeA);
    await act(async () => {
      const selects = document.querySelectorAll('select');
      selects[1].value = offering.offering_id; selects[1].dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    await act(async () => {
      const selects = document.querySelectorAll('select');
      selects[2].value = id(51); selects[2].dispatchEvent(new window.Event('change', { bubbles: true }));
      const input = document.querySelector('textarea');
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Synthetic HTTP unknown command');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    const commandButton = () => [...document.querySelectorAll('button')].find(button => /Send request|Retry the same request/.test(button.textContent));
    await commandClick(commandButton);
    const first = calls.find(call => call.options.method === 'POST'); assert.ok(first);
    assert.match(document.body.textContent, /result is unknown/);
    postMode = 'conflict'; await commandClick(commandButton);
    const refresh = [...document.querySelectorAll('button')].find(button => button.textContent === 'Refresh catalogue');
    assert.ok(refresh); await act(async () => refresh.click());
    const workspaceSelect = document.querySelector('select[aria-label="Choose a workspace"]');
    assert.equal(workspaceSelect.disabled, true); assert.equal(commandButton().textContent, 'Retry the same request');
    postMode = 'success'; await commandClick(commandButton);
    const posts = calls.filter(call => call.options.method === 'POST');
    assert.equal(posts.length, 3);
    for (const post of posts.slice(1)) { assert.equal(post.url, first.url); assert.equal(post.options.body, first.options.body); }
    assert.equal(effects.size, 1); assert.equal(workspaceSelect.disabled, false);
    journeyMode = false;
  });
  console.log(JSON.stringify({ task: 'SERVICE-FIRST-USER-JOURNEY-12', cases, status: 'PASS', evidence: 'mounted real SERVICE components with controlled HTTP only', native_Auth_DB_restart: 'NOT_RUN_NOT_PASS' }));
} finally {
  await act(async () => root.unmount()); dom.window.close();
}
