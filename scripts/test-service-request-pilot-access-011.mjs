import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url)); const mod = new Module(filename);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const id = '80000000-0000-0000-0000-000000000002';
let authorized = true, aal2 = true, role = true, assigned = true, queries = [];
let results = { customer_workspaces_v1: { data: { id, environment: 'PILOT', lifecycle_status: 'ACTIVE' }, error: null }, workspace_entitlements_v1: { data: null, error: null } };
const { GET } = load('src/app/api/platform/v1/workspaces/[id]/service-request-access/route.ts', {
  '@/lib/platform/auth': { getPlatformAuthContext: async () => ({ isAuthorized: authorized, platformUser: authorized ? {} : null }), hasPlatformAal2: () => aal2, hasPlatformRole: () => role, hasWorkspaceAssignment: () => assigned },
  '@/lib/supabase/server': { createClient: async () => ({ schema: schema => { assert.equal(schema, 'customer_api'); return { from: table => { const query = { table, filters: [] }; queries.push(query); const chain = { select: fields => { query.fields = fields; return chain; }, eq: (key, value) => { query.filters.push([key, value]); return chain; }, maybeSingle: async () => results[table] }; return chain; } }; } }) },
});
const read = value => GET(new Request('https://cladora.test'), { params: Promise.resolve({ id: value ?? id }) });
for (const [variable, status] of [['authorized', 401], ['aal2', 403], ['role', 403], ['assigned', 403]]) {
  queries = [];
  if (variable === 'authorized') authorized = false; if (variable === 'aal2') aal2 = false; if (variable === 'role') role = false; if (variable === 'assigned') assigned = false;
  assert.equal((await read()).status, status); assert.equal(queries.length, 0);
  authorized = aal2 = role = assigned = true;
}
queries = []; assert.equal((await read('invalid')).status, 400); assert.equal(queries.length, 0);
let response = await read(); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
assert.deepEqual((await response.json()).entitlement, null);
assert.deepEqual(queries[0].filters, [['id', id]]); assert.deepEqual(queries[1].filters, [['customer_workspace_id', id], ['entitlement_key', 'module.services_orders']]);
results.customer_workspaces_v1 = { data: null, error: null }; assert.equal((await read()).status, 404);
results.customer_workspaces_v1 = { data: null, error: { message: 'private details' } }; response = await read(); assert.equal(response.status, 500); assert.equal(JSON.stringify(await response.json()).includes('private details'), false);
console.log('PASS service access gateway: authentication, MFA, roles, assignment, canonical pilot UUID, exact filters, missing workspace, sanitized failure, no-store');

const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true });
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const { ServiceCatalogPilotAccessDialog: Dialog } = load('src/components/platform/ServiceCatalogPilotAccessDialog.tsx');
const root = createRoot(document.getElementById('root'));
const workspace = { id, environment: 'PILOT', lifecycle_status: 'ACTIVE', commercial_owner: 'Pilot owner', tenant_legal_name: 'Pilot association' };
let data, writes, failRead, lost, generation = 0, pending;
const reset = () => { data = { workspace, entitlement: null }; writes = []; failRead = false; lost = false; pending = null; };
globalThis.fetch = async (url, options) => {
  if (options?.method === 'PUT') {
    assert.equal(url, `/api/platform/v1/workspaces/${id}/entitlements/module.services_orders`);
    const body = JSON.parse(options.body); writes.push(body);
    data.entitlement = { ...body, valid_from: '2026-01-01T00:00:00Z', valid_until: null };
    if (lost) { lost = false; throw new Error('response lost after save'); }
    return Response.json({ entitlement: data.entitlement });
  }
  if (pending) return pending.promise;
  if (failRead) return Response.json({ error: {} }, { status: 403 });
  assert.equal(options.cache, 'no-store'); return Response.json(data);
};
const render = async lang => act(async () => { root.render(React.createElement(Dialog, { key: ++generation, workspace, lang, mode: 'requests', onClose: () => {} })); });
const localInput = timestamp => { const date = new Date(timestamp); return new Date(timestamp - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const prepare = async () => act(async () => {
  document.querySelector('textarea').value = 'Explicit controlled SERVICE pilot test';
  document.querySelector('input[name=expires]').value = localInput(Date.now() + 12 * 3600000);
  document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
});
const save = async () => act(async () => { document.querySelectorAll('button')[1].click(); });
for (const lang of ['ro', 'en', 'fa']) {
  reset(); await render(lang); assert.equal(document.querySelector('dialog').open, true); assert.equal(document.querySelector('dialog').dir, lang === 'fa' ? 'rtl' : 'ltr');
  await prepare(); assert.equal(writes.length, 0); assert.equal(document.querySelector('form'), null);
  await save(); assert.equal(writes.length, 1); assert.equal(writes[0].boolean_value, false); assert.equal(writes[0].override_value_json, true);
  assert.ok(Math.abs(Date.parse(writes[0].override_expires_at) - Date.now() - 12 * 3600000) < 65000);
  assert.ok(document.querySelector('[role="status"]'));
}
reset(); failRead = true; await render('en'); assert.equal(document.querySelector('form'), null); assert.equal(writes.length, 0);
for (const fixture of [
  { ...workspace, environment: 'PRODUCTION' }, { ...workspace, lifecycle_status: 'SUSPENDED' },
]) { reset(); data.workspace = fixture; await render('en'); assert.equal(document.querySelector('form'), null); }
reset(); data.entitlement = { value_type: 'boolean', boolean_value: true }; await render('en'); assert.equal(document.querySelector('form'), null);
reset(); await render('en'); await prepare(); data.entitlement = { value_type: 'boolean', boolean_value: true }; await save(); assert.equal(writes.length, 0); assert.match(document.body.textContent, /state changed/);
reset(); await render('en'); await prepare(); lost = true; await save(); assert.equal(writes.length, 1); assert.match(document.body.textContent, /Retry the same decision/);
const expiry = writes[0].override_expires_at; await save(); assert.equal(writes.length, 1); assert.equal(data.entitlement.override_expires_at, expiry); assert.ok(document.querySelector('[role="status"]'));
reset(); let resolve; pending = { promise: new Promise(done => { resolve = done; }) }; await render('en'); pending = null;
await act(async () => { root.render(null); }); await act(async () => { resolve(Response.json({ workspace, entitlement: null })); }); assert.equal(document.querySelector('dialog'), null);
for (const offset of [-3600000, 73 * 3600000]) {
  reset(); await render('en');
  await act(async () => {
    document.querySelector('textarea').value = 'Explicit controlled SERVICE pilot test';
    document.querySelector('input[name=expires]').value = localInput(Date.now() + offset);
    document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.ok(document.querySelector('form')); assert.equal(writes.length, 0);
  assert.match(document.querySelector('[role=alert]').textContent, /future expiry within 72 hours/);
}
await act(async () => root.unmount());
console.log('PASS mounted RO/EN/FA pilot access: explicit review, temporary expiry, fail-closed reads, permanent/non-pilot protection, stale-state recheck, lost-response reconciliation, unmount cleanup');
