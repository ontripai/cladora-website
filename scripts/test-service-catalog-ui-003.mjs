import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
const require = createRequire(import.meta.url);
const cache = new Map();
let active = { context_id: '00000000-0000-0000-0000-000000000001' };
const firstWorkspace = '00000000-0000-0000-0000-000000000010';
const secondWorkspace = '00000000-0000-0000-0000-000000000020';
let calls = [];
let catalogue = [];
let deferred;
let status = 200;
let managementData; let loseResponse = false; let mutationDeferred;
const fetch = async (url, options) => {
  calls.push({ url, options });
  if (url.includes('/workspace/targets')) return Response.json({ workspaces: [firstWorkspace, secondWorkspace].map(workspace_id => ({ workspace_id, workspace_type: 'ASSOCIATION', environment: 'PILOT' })) });
  if (options?.method === 'POST') {
    if (mutationDeferred) return mutationDeferred.promise;
    if (loseResponse) { loseResponse = false; throw new Error('response lost after commit'); }
    return Response.json(url.endsWith('/definitions') || url.endsWith('/management') ? { definition_id: firstWorkspace, active: false, lock_version: 2 } : { offering_id: firstWorkspace, revision_id: secondWorkspace, status: 'draft', lock_version: 1 });
  }
  if (url.includes('/catalog/management')) return Response.json(status === 200 ? managementData : { error: { code: 'FORBIDDEN' } }, { status });
  if (deferred) return deferred.promise;
  return Response.json(status === 200 ? { offerings: catalogue } : { error: { code: 'FORBIDDEN' } }, { status });
};
function load(file) {
  if (!existsSync(file) && file.pathname.endsWith('.ts')) file = new URL(file.href.replace(/\.ts$/, '.tsx'));
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file); const mod = new Module(filename);
  mod.require = name => name.endsWith('CustomerContextProvider') ? { useCustomerContext: () => ({ active }) }
    : name.endsWith('DashboardTransport') ? { useDashboardFetch: () => fetch }
    : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith('.') ? load(new URL(`${name}.ts`, file)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  cache.set(file.href, mod.exports); return mod.exports;
}
const { CustomerServiceCatalog } = load(new URL('../src/components/customer/CustomerServiceCatalog.tsx', import.meta.url));
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
globalThis.FormData = dom.window.FormData; globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
const render = async lang => act(async () => { root.render(React.createElement(CustomerServiceCatalog, { lang })); });
const choose = async workspace => act(async () => { const select = document.querySelector('select'); select.value = workspace; select.dispatchEvent(new window.Event('change', { bubbles: true })); });
const labels = { ro: 'Serviciu publicat', en: 'Published service', fa: 'خدمت منتشرشده' };
const item = { offering_id: firstWorkspace, revision_id: secondWorkspace, labels, description: labels, acquisition_mode: 'direct', price: { kind: 'fixed', amount: '999999999999999.99', currency: 'RON', tax_display: 'included' }, valid_from: '2026-01-01T00:00:00Z', valid_until: null, cancellation_terms: labels, acceptance_criteria: labels };
let cases = 0;
async function check(name, fn) { await fn(); cases++; console.log(`PASS ${name}`); }
try {
  for (const lang of ['ro', 'en', 'fa']) {
    await check(`${lang}: explicit choice, localized service/terms and exact money`, async () => {
      active = { context_id: `00000000-0000-0000-0000-00000000000${lang === 'ro' ? 1 : lang === 'en' ? 2 : 3}` }; catalogue = [item]; calls = [];
      await render(lang); assert.equal(document.querySelector('article'), null); assert.equal(calls.filter(call => call.url.includes('/services/catalog')).length, 0);
      await choose(firstWorkspace); assert.match(document.body.textContent, new RegExp(labels[lang])); assert.match(document.body.textContent, /999999999999999\.99 RON/);
      assert.equal(document.querySelector('section').dir, lang === 'fa' ? 'rtl' : 'ltr');
      assert.equal(document.querySelectorAll('details summary').length, 1);
      const request = calls.find(call => call.url.includes('/services/catalog')); assert.match(request.url, new RegExp(`workspace_id=${firstWorkspace}`)); assert.equal(request.options.cache, 'no-store');
    });
  }
  await check('context change clears old service and workspace selection before next fetch', async () => {
    active = { context_id: '00000000-0000-0000-0000-000000000004' }; await render('en'); assert.equal(document.querySelector('article'), null); assert.equal(document.querySelector('select').value, '');
  });
  await check('workspace change and late response cannot resurrect previous data', async () => {
    let resolve; deferred = { promise: new Promise(done => { resolve = done; }) };
    await choose(firstWorkspace); const obsolete = deferred; deferred = null; catalogue = []; await choose(secondWorkspace);
    assert.equal(document.querySelector('article'), null);
    await act(async () => { resolve(Response.json({ offerings: [item] })); await obsolete.promise; });
    assert.equal(document.querySelector('article'), null); assert.equal(document.querySelector('select').value, secondWorkspace);
  });
  await check('access denial is shown as access denial with no retained data', async () => {
    status = 403; await choose(firstWorkspace); assert.match(document.body.textContent, /Service access is unavailable/); assert.equal(document.querySelector('article'), null);
  });
  const { serviceManagementCopy } = load(new URL('../src/lib/customer/service-catalog-management-copy.ts', import.meta.url));
  const revision = { ...item, document_version_ids: [] }; delete revision.offering_id; delete revision.revision_id;
  const baseManagement = { can_manage: true, can_publish: true, next_after: null, providers: [{ provider_party_id: secondWorkspace, label: 'Provider' }], definitions: [{ definition_id: firstWorkspace, code: 'cleaning', labels, active: true, lock_version: 1 }], offerings: [] };
  const openManagement = async lang => act(async () => { [...document.querySelectorAll('button')].find(button => button.textContent === serviceManagementCopy[lang].title).click(); });
  for (const [index, lang] of ['ro', 'en', 'fa'].entries()) {
    await check(`${lang}: management is explicit and scoped with multilingual forms`, async () => {
      status = 200; managementData = baseManagement; calls = []; active = { context_id: `00000000-0000-0000-0000-00000000010${index + 1}` }; await render(lang); await choose(firstWorkspace);
      assert.equal(calls.filter(call => call.url.includes('/catalog/management')).length, 0); await openManagement(lang);
      assert.equal(document.querySelectorAll('form').length, 2); assert.equal(document.querySelectorAll('textarea').length, 15);
      assert.match(calls.find(call => call.url.includes('/catalog/management')).url, new RegExp(`workspace_id=${firstWorkspace}`));
    });
  }
  const fillOffering = () => {
    const form = document.querySelectorAll('form')[1]; form.elements.definition.value = firstWorkspace; form.elements.provider.value = secondWorkspace;
    for (const field of ['labels', 'description', 'cancellation', 'acceptance']) for (const lang of ['ro', 'en', 'fa']) form.elements[`${field}.${lang}`].value = labels[lang];
    form.elements.amount.value = '999999999999999.99'; form.elements.valid_from.value = '2026-10-03T12:00'; return form;
  };
  await check('lost response retries identical payload and key with exact decimal amount', async () => {
    const form = fillOffering(); calls = []; loseResponse = true;
    await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    assert.match(document.querySelector('[role="alert"]').textContent, new RegExp(serviceManagementCopy.fa.error));
    await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    const writes = calls.filter(call => call.options?.method === 'POST'); assert.equal(writes.length, 2); assert.equal(writes[0].options.body, writes[1].options.body);
    const request = JSON.parse(writes[0].options.body).request; assert.equal(request.revision.price.amount, '999999999999999.99'); assert.equal(request.workspace_id, firstWorkspace); assert.equal(Object.hasOwn(request, 'actor_id'), false); assert.match(document.body.textContent, new RegExp(serviceManagementCopy.fa.success));
  });
  await check('publisher only has no manager forms and self approval button', async () => {
    managementData = { ...baseManagement, can_manage: false, providers: [], offerings: [{ offering_id: firstWorkspace, definition_id: firstWorkspace, provider_party_id: secondWorkspace, lock_version: 2, current_revision_id: secondWorkspace, published_revision_id: null, revisions: [{ revision_id: secondWorkspace, status: 'submitted', revision, can_publish: false }] }] };
    active = { context_id: '00000000-0000-0000-0000-000000000111' }; await render('en'); await choose(firstWorkspace); await openManagement('en');
    assert.equal(document.querySelectorAll('form').length, 0); assert.match(document.body.textContent, new RegExp(serviceManagementCopy.en.separate)); assert.equal([...document.querySelectorAll('button')].some(button => button.textContent === serviceManagementCopy.en.publish), false);
  });
  await check('definition edit sends optimistic version without mutable code', async () => {
    managementData = baseManagement; active = { context_id: '00000000-0000-0000-0000-000000000115' }; await render('en'); await choose(firstWorkspace); await openManagement('en');
    await act(async () => { const select = document.querySelector('select[aria-label="Edit service definitions"]'); select.value = firstWorkspace; select.dispatchEvent(new window.Event('change', { bubbles: true })); });
    const form = [...document.querySelectorAll('form')].find(form => form.elements.active); form.elements.active.checked = false; form.elements.reason.value = 'Disable definition safely'; calls = [];
    await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    const request = JSON.parse(calls.find(call => call.options?.method === 'POST').options.body); assert.equal(request.expected_lock_version, 1); assert.equal(request.active, false); assert.equal(request.definition_id, firstWorkspace); assert.equal(Object.hasOwn(request, 'code'), false);
  });
  await check('management denial retains no manager form', async () => { status = 403; active = { context_id: '00000000-0000-0000-0000-000000000112' }; await render('en'); await choose(firstWorkspace); await openManagement('en'); assert.equal(document.querySelectorAll('form').length, 0); assert.match(document.body.textContent, new RegExp(serviceManagementCopy.en.denied)); });
  await check('context change aborts pending mutation and ignores late success', async () => {
    status = 200; managementData = baseManagement; active = { context_id: '00000000-0000-0000-0000-000000000113' }; await render('en'); await choose(firstWorkspace); await openManagement('en'); const form = fillOffering();
    let resolve; mutationDeferred = { promise: new Promise(done => { resolve = done; }) }; calls = [];
    await act(async () => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
    const write = calls.find(call => call.options?.method === 'POST'); assert.equal(write.options.signal.aborted, false);
    active = { context_id: '00000000-0000-0000-0000-000000000114' }; await render('en'); assert.equal(write.options.signal.aborted, true);
    await act(async () => { resolve(Response.json({ offering_id: firstWorkspace, revision_id: secondWorkspace, status: 'draft', lock_version: 1 })); await mutationDeferred.promise; }); mutationDeferred = null;
    assert.equal(document.querySelectorAll('form').length, 0); assert.equal(document.querySelector('select').value, ''); assert.doesNotMatch(document.body.textContent, new RegExp(serviceManagementCopy.en.success));
  });
  await check('no active context performs no catalogue or target request', async () => { calls = []; active = null; await render('en'); assert.equal(calls.length, 0); assert.match(document.body.textContent, /working context/); });
  console.log(`${cases} SERVICE UI state/isolation scenarios passed`);
} finally { await act(async () => root.unmount()); dom.window.close(); }
