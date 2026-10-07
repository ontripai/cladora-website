import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const compiled = new Module(filename);
  compiled.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText, filename);
  return compiled.exports;
}
const billingSchemas = load('src/lib/customer/billing-schema.ts');
const synthetic = '80000000-0000-0000-0000-000000000007';
const billInput = {context_id: synthetic, property_id: synthetic, unit_id: synthetic, liable_party_id: synthetic,
  period_start: '2026-09-01', period_end: '2026-09-30', due_on: '2026-10-15',
  lines: [{description: 'TEST ONLY', quantity: 1, unit_price: 1, tax_rate: 0}]};
assert.ok(billingSchemas.createBillRequestSchema.safeParse(billInput).success);
assert.ok(!billingSchemas.createBillRequestSchema.safeParse({...billInput, unit_id: 'SYN-UNIT-001'}).success);
assert.ok(billingSchemas.queryBillingSchema.safeParse({context_id: synthetic}).success);
const dom = new JSDOM('<div id="root"></div>', {url: 'https://cladora.test'});
const saved = new Map();
for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true})) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
}
const originalFetch = globalThis.fetch;
const {createRoot} = require('react-dom/client');
const root = createRoot(document.getElementById('root'));
const settle = () => act(async () => new Promise(resolve => setTimeout(resolve, 180)));
const {CustomerRegistryPicker} = load('src/components/customer/CustomerRegistryPicker.tsx');
let selected;
let requests = [];
let failed = false;
globalThis.fetch = async url => {
  const params = new URL(url, 'https://cladora.test').searchParams;
  requests.push(params);
  return {ok: !failed, json: async () => ({total: 21, rows: params.get('offset') === '20'
    ? [{id: 'unit-21', unit_code: 'A-21', building_name: 'Building'}]
    : [{id: 'unit-1', unit_code: 'A-01', building_name: 'Building'}]})};
};
function Harness({contextId}) {
  const [value, setValue] = React.useState('');
  return React.createElement(CustomerRegistryPicker, {contextId, view: 'units', lang: 'en', title: 'Unit', value,
    onChange: (id, label) => {selected = {id, label}; setValue(id);}});
}
try {
  await act(async () => root.render(React.createElement(Harness, {key: 'first', contextId: 'first'})));
  await settle();
  assert.equal(requests[0].get('context_id'), 'first');
  assert.equal(requests[0].get('view'), 'units');
  let select = document.querySelector('select');
  await act(async () => {select.value = 'unit-1'; select.dispatchEvent(new dom.window.Event('change', {bubbles: true}));});
  assert.deepEqual(selected, {id: 'unit-1', label: 'Building · A-01'});
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Next').click());
  await settle();
  assert.equal(requests.at(-1).get('offset'), '20');
  assert.ok(document.querySelector('select').textContent.includes('A-01'), 'keep the named selection across result pages');
  assert.ok(document.querySelector('select').textContent.includes('A-21'));
  const searchInput = document.querySelector('input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(searchInput, 'A-21');
    searchInput.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
  });
  await settle();
  assert.equal(requests.at(-1).get('query'), 'A-21');
  assert.equal(requests.at(-1).get('offset'), '0');
  failed = true;
  await act(async () => root.render(React.createElement(Harness, {key: 'second', contextId: 'second'})));
  assert.ok(!document.body.textContent.includes('A-01'), 'do not expose previous-context options');
  await settle();
  assert.ok(document.querySelector('select').disabled);
  assert.ok(document.querySelector('[role="alert"]'));

  // Exercise the real billing component: derive property from the selected unit,
  // and ignore a stale unit-detail response after a quick second selection.
  const active = {context_id: 'billing-context', role_code: 'association_admin', tenant_name: 'Pilot'};
  let releaseFirst;
  const firstDetail = new Promise(resolve => {releaseFirst = resolve;});
  globalThis.fetch = async url => {
    if (url.includes('view=unit_detail')) return url.includes('unit_id=second')
      ? {ok: true, json: async () => ({property: {id: 'property-second', name: 'Second Property'}})} : firstDetail;
    return {ok: true, json: async () => ({invoices: [], total: 0, read_only: false})};
  };
  const mockPicker = props => React.createElement('div', null,
    ...['first', 'second'].map(id => React.createElement('button', {key: id, type: 'button', disabled: props.disabled,
      onClick: () => props.onChange(id, id), 'data-choice': `${props.view}:${id}`}, `${props.view}:${id}`)));
  const {CustomerBillingDashboard} = load('src/components/customer/CustomerBillingDashboard.tsx', {
    './CustomerContextProvider': {useCustomerContext: () => ({active})},
    './CustomerRegistryPicker': {CustomerRegistryPicker: mockPicker},
  });
  await act(async () => root.render(React.createElement(CustomerBillingDashboard, {lang: 'en'})));
  await act(async () => new Promise(resolve => setTimeout(resolve, 240)));
  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent.includes('New Draft Bill')).click());
  assert.ok(!document.querySelector('input[placeholder="UUID"]'));
  await act(async () => document.querySelector('[data-choice="units:first"]').click());
  await act(async () => document.querySelector('[data-choice="units:second"]').click());
  assert.ok(document.body.textContent.includes('Second Property'));
  await act(async () => releaseFirst({ok: true, json: async () => ({property: {id: 'property-first', name: 'First Property'}})}));
  assert.ok(!document.body.textContent.includes('First Property'));
  assert.ok(document.querySelector('button[type="submit"]').disabled, 'no submission before liable party selection');
  await act(async () => document.querySelector('[data-choice="parties:first"]').click());
  assert.ok(!document.querySelector('button[type="submit"]').disabled);
  console.log('PASS registry pickers: scoped options, names, pagination, retained choice, failure, context isolation and billing property response race');
} finally {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
  dom.window.close();
}
