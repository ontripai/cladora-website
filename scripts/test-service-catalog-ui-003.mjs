import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const fetch = async (url, options) => {
  calls.push({ url, options });
  if (url.includes('/workspace/targets')) return Response.json({ workspaces: [firstWorkspace, secondWorkspace].map(workspace_id => ({ workspace_id, workspace_type: 'ASSOCIATION', environment: 'PILOT' })) });
  if (deferred) return deferred.promise;
  return Response.json(status === 200 ? { offerings: catalogue } : { error: { code: 'FORBIDDEN' } }, { status });
};
function load(file) {
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
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  await check('no active context performs no catalogue or target request', async () => { calls = []; active = null; await render('en'); assert.equal(calls.length, 0); assert.match(document.body.textContent, /working context/); });
  console.log(`${cases} SERVICE UI state/isolation scenarios passed`);
} finally { await act(async () => root.unmount()); dom.window.close(); }
