import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// Render the actual client component. Only navigation and HTTP are replaced;
// deferred HTTP responses exercise the same React effects as the live panel.
const require = createRequire(import.meta.url);
const filename = fileURLToPath(new URL('../src/components/owner/OwnerPortfolioPanel.tsx', import.meta.url));
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const componentModule = new Module(filename);
componentModule.filename = filename;
componentModule.paths = Module._nodeModulePaths(fileURLToPath(new URL('..', import.meta.url)));
const labelModule = new Module(filename);
labelModule._compile(ts.transpileModule(readFileSync(new URL('../src/lib/owner-portfolio/labels.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
componentModule.require = id => id === '@/components/dashboard-lab/DashboardTransport' ? {useDashboardFetch:()=>globalThis.fetch,useDashboardPreview:()=>false,DashboardLink:({children,...props})=>React.createElement('a',props,children)} : id === '@/lib/owner-portfolio/labels' ? labelModule.exports : id === './OwnerOverviewPanel' ? {OwnerOverviewPanel:()=>null} : id === '@/components/auth/SignOutButton' ? {SignOutButton:()=>null} : id === 'next/link'
  ? { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }
  : require(id);
componentModule._compile(compiled, filename);
const { OwnerPortfolioPanel } = componentModule.exports;
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.FormData = dom.window.FormData;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const units = ['A', 'B', 'C'].map(id => ({ id, building_label: 'Building', unit_label: id, address_text: 'Address', usage_kind: 'residential' }));
const pending = [];
globalThis.fetch = (url, options = {}) => new Promise(resolve => pending.push({ url: String(url), options, resolve }));
const findRequest = predicate => {
  const index = pending.findIndex(predicate);
  assert.notEqual(index, -1, 'Expected HTTP request');
  return pending.splice(index, 1)[0];
};
const reply = async (request, data, ok = true) => {
  await act(async () => request.resolve({ ok, json: async () => data }));
};
const unitRequest = id => findRequest(r => r.url.includes(`unit_id=${id}`) && !r.url.includes('/charges'));
const chargeRequest = id => findRequest(r => r.url.includes(`/charges?private_unit_id=${id}`));
const dataFor = id => ({ units, count: 3, leases: [{ id: `lease-${id}`, tenant_label: `Tenant-${id}`, starts_on: '2026-01-01', ends_on: null, monthly_rent: 100, currency: 'RON', status: 'active' }], entries: [{ id: `cash-${id}`, kind: `Cash-${id}`, direction: 'income', amount: 10, currency: 'RON' }] });
const clickUnit = async id => {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes(`Building · ${id}`));
  assert.ok(button);
  await act(async () => button.click());
};
const absent = id => {
  assert.ok(!document.body.textContent.includes(`Tenant-${id}`), `No previous ${id} lease`);
  assert.ok(!document.body.textContent.includes(`Cash-${id}`), `No previous ${id} cash`);
};

for (const lang of ['en', 'ro', 'fa']) {
  pending.length = 0;
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(OwnerPortfolioPanel, { lang })));
  await reply(findRequest(r => r.url.endsWith('/links')), { links: [] });
  await reply(findRequest(r => r.url.includes('/annual')), { groups: [] });
  await reply(findRequest(r => r.url.includes('?offset=0')), { units, count: 3, leases: [], entries: [] });
  await clickUnit('A');
  await reply(unitRequest('A'), dataFor('A'));
  await reply(chargeRequest('A'), { charges: [{ id: 'charge-A', invoice_no: 99123, total: 321, outstanding_amount: 321, currency: 'RON', status: 'issued' }] });
  assert.ok(document.body.textContent.includes('Tenant-A'));
  assert.ok(document.body.textContent.includes(labelModule.exports.ownerLabel(lang,'income')));
  assert.ok(document.body.textContent.includes(labelModule.exports.ownerLabel(lang,'issued')));
  assert.equal(document.querySelector('main').dir,lang==='fa'?'rtl':'ltr');
  assert.ok(document.querySelector('a[href*="format=csv"]').href.includes(`lang=${lang}`));
  assert.ok(document.body.textContent.includes('#99123'));
  document.querySelector('input[name="tenant_label"]').value = 'Unsubmitted tenant A';
  document.querySelector('input[name="memo"]').value = 'Unsubmitted memo A';

  await clickUnit('B');
  absent('A');
  assert.ok(!document.body.textContent.includes('#99123'), 'Previous charge hidden immediately');
  assert.equal(document.querySelector('input[name="tenant_label"]').value, '', 'Lease draft reset');
  assert.equal(document.querySelector('input[name="memo"]').value, '', 'Cash draft reset');
  assert.equal(document.querySelector('fieldset').disabled, true, 'Writes disabled while details load');
  const lateB = unitRequest('B');
  const lateBCharges = chargeRequest('B');
  await clickUnit('C');
  await reply(unitRequest('C'), dataFor('C'));
  await reply(chargeRequest('C'), { charges: [] });
  await reply(lateB, dataFor('B'));
  await reply(lateBCharges, { charges: [{ id: 'late-charge', invoice_no: 77777 }] });
  assert.ok(document.body.textContent.includes('Tenant-C'));
  absent('B');
  assert.ok(!document.body.textContent.includes('#77777'), 'Late charges ignored');

  await clickUnit('B');
  await reply(unitRequest('B'), {}, false);
  await reply(chargeRequest('B'), {}, false);
  absent('C');
  assert.equal(document.querySelector('fieldset').disabled, true, 'Failed reads keep writes disabled');
  assert.ok(document.querySelector('[role="alert"]'));

  await clickUnit('A');
  await reply(unitRequest('A'), dataFor('A'));
  await reply(chargeRequest('A'), { charges: [] });
  const form = document.querySelector('input[name="memo"]').form;
  form.elements.namedItem('amount').value = '25';
  await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  const mutation = findRequest(r => r.options.method === 'POST');
  assert.equal(JSON.parse(mutation.options.body).unit_id, 'A');
  assert.ok([...document.querySelectorAll('button')].filter(b => b.textContent.includes('Building ·')).every(b => b.disabled), 'Unit switching disabled during save');
  await clickUnit('B');
  assert.ok(document.body.textContent.includes('Tenant-A'), 'Pending save stays in original context');
  await reply(mutation, {}, false);
  assert.equal(document.querySelector('fieldset').disabled, false);
  await act(async () => root.unmount());
  console.log(`PASS ${lang}: stale details, draft reset, pending/failed read, late response, save isolation`);
}
dom.window.close();
