import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createB2Loader } from './lib/airprop-b2-test-loader.mjs';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' }), saved = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const { createRoot } = await import('react-dom/client');
const { CustomerAirpropB2, CustomerAirpropB2Workspace } = createB2Loader()('src/components/customer/CustomerAirpropB2.tsx');
const originalFetch = globalThis.fetch;
const root = createRoot(document.getElementById('root'));
const property = randomUUID(), owner = randomUUID(), unitIds = [randomUUID(), randomUUID(), randomUUID()];
const view = { version: 1, idempotent: true, as_of: new Date().toISOString(), properties: [{
  mandate_request_id: randomUUID(), property: { id: property, label: 'AP10 managed property' }, owner: { party_id: owner, label: 'AP10 owner' },
  scope: { capabilities: ['owner_reporting', 'maintenance_coordination'] }, valid_from: '2026-01-01', valid_to: '2027-01-01', status: 'accepted',
  action_links: unitIds.map(unit_id => ({ action_link_id: randomUUID(), core_record_type: 'maintenance.work_order', core_record_id: randomUUID(), unit_id,
    source_status_snapshot: 'scheduled', linked_at: new Date().toISOString() })),
}], operations: { detail_owner: 'Operations', mode: 'canonical_references_only' }, finance: { detail_owner: 'Finance', mode: 'not_connected', reason: 'canonical_receipt_contract_unavailable' } };
let passed = 0;
const render = props => act(async () => root.render(React.createElement(CustomerAirpropB2, { lang: 'en', view, commands: null, can_edit: false, ...props })));
try {
  for (const lang of ['en', 'ro', 'fa']) {
    await render({ lang });
    assert.match(document.body.textContent, /AP10 managed property/); assert.match(document.body.textContent, /AP10 owner/);
    assert.equal(document.querySelector('section').dir, lang === 'fa' ? 'rtl' : 'ltr');
    assert.equal(document.querySelectorAll('li').length, 3);
    assert.equal(document.querySelectorAll('button,form,input,textarea,select').length, 0);
    assert.equal(document.body.textContent.includes('owner_reporting'), false);
    for (const id of [property, owner, ...unitIds]) assert.equal(document.body.textContent.includes(id), false);
    assert.ok(document.querySelector('[role="status"]'));
    console.log(`ok ${++passed} - ${lang} real rendered read-only AP10 projection, localized statuses and no raw IDs`);
  }
  for (const props of [{ view: null }, { view: { ...view, finance: { mode: 'connected' } } }, { commands: ['edit'], can_edit: true }, { key: 'different-workspace', view: null }]) {
    await render(props); assert.equal(document.body.textContent.includes('AP10 managed property'), false);
    assert.equal(document.querySelectorAll('button,form,input,textarea,select').length, 0);
  }
  console.log(`ok ${++passed} - null/invalid/forged controls and Workspace remount remove old projection`);
  const calls = [];
  globalThis.fetch = (url, options) => new Promise(resolve => calls.push({ url, options, resolve }));
  const contextId = randomUUID(), workspaces = [randomUUID(), randomUUID()];
  const workspaceRender = workspaceId => act(async () => root.render(React.createElement(CustomerAirpropB2Workspace, { lang: 'en', contextId, workspaceId })));
  await workspaceRender(workspaces[0]); await workspaceRender(workspaces[1]);
  assert.equal(calls.length, 2); assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(calls[1].url.includes(workspaces[1]), true); assert.equal(calls[1].options.method, undefined);
  const response = v => ({ ok: true, json: async () => ({ artifact_id: 'AIRPROP-ARTIFACT-B2-20261013-R1', commands: null, can_edit: false, state: 'pre_activation', view: v }) });
  await act(async () => calls[0].resolve(response(view)));
  assert.equal(document.body.textContent.includes('AP10 managed property'), false, 'late old Workspace response is discarded');
  const currentView = { ...view, properties: [{ ...view.properties[0], property: { id: randomUUID(), label: 'Current Workspace property' } }] };
  await act(async () => calls[1].resolve(response(currentView)));
  assert.match(document.body.textContent, /Current Workspace property/);
  await workspaceRender(workspaces[0]);
  assert.equal(document.body.textContent.includes('Current Workspace property'), false, 'identity change clears immediately');
  await act(async () => calls[2].resolve({ ok: false }));
  assert.equal(document.body.textContent.includes('AP10 managed property'), false);
  assert.match(document.body.textContent, /currently unavailable/);
  console.log(`ok ${++passed} - explicit read-only request, abort, late response suppression, immediate Workspace clearing and provider failure`);
  console.log(`PASS ${passed} rendered B2 locale/UI cases`);
} finally {
  await act(async () => root.unmount()); globalThis.fetch = originalFetch; for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; }
  dom.window.close();
}
