import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React, { act, useCallback, useEffect, useState } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
const originalFetch = globalThis.fetch;
const saved = new Map();
for (const [key, value] of Object.entries({
  window: dom.window,
  document: dom.window.document,
  sessionStorage: dom.window.sessionStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const loadedModule = new Module(filename);
  loadedModule.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  loadedModule._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loadedModule.exports;
}

const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const contexts = [1, 2].map((n) => ({
  context_id: id(n), membership_id: id(n + 10), tenant_name: `Tenant ${n}`,
  role_code: 'association_admin', role_name: 'Administrator', scope_type: 'tenant', context_label: `Workspace ${n}`,
}));
globalThis.fetch = async (url) => url.includes('/contexts')
  ? { ok: true, json: async () => ({ contexts }) }
  : { ok: true, json: async () => ({ contextId: id(1), context: {}, permissions: [], entitlements: [], modules: [] }) };

const { CustomerContextProvider, useCustomerContext } = load(
  'src/components/customer/CustomerContextProvider.tsx',
  { '@/components/dashboard-lab/DashboardTransport': {
    useDashboardFetch: () => globalThis.fetch,
    useDashboardPreview: () => false,
  } },
);

let discardCount = 0;
function Probe() {
  const state = useCustomerContext();
  const [dirty, setDirty] = useState(false);
  const discard = useCallback(() => { discardCount += 1; setDirty(false); }, []);
  const { registerUnsavedGuard } = state;
  useEffect(() => registerUnsavedGuard('test-form', dirty, discard), [registerUnsavedGuard, state.active?.context_id, dirty, discard]);
  return React.createElement('div', null,
    React.createElement('p', null, `active:${state.active?.context_id ?? 'none'}`),
    React.createElement('p', null, `pending:${state.pendingContextId ?? 'none'}`),
    React.createElement('p', null, `dirty:${String(dirty)}`),
    React.createElement('button', { onClick: () => setDirty(true) }, 'Make unsaved'),
    React.createElement('button', { onClick: () => state.select(id(1)) }, 'Select context 1'),
    React.createElement('button', { onClick: () => state.select(id(2)) }, 'Select context 2'),
    React.createElement('button', { onClick: state.cancelContextChange }, 'Keep editing'),
    React.createElement('button', { onClick: state.confirmContextChange }, 'Discard and switch'),
  );
}

const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root'));
const render = async () => act(async () => root.render(React.createElement(CustomerContextProvider, null, React.createElement(Probe))));
const click = async (name) => act(async () => [...document.querySelectorAll('button')].find((button) => button.textContent === name).click());
const text = () => document.body.textContent;
try {
  await render();
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  assert.match(text(), new RegExp(`active:${id(1)}`), 'provider loads the persisted active context');
  await click('Make unsaved');
  await click('Select context 2');
  assert.match(text(), new RegExp(`active:${id(1)}`), 'active context does not change before a decision');
  assert.match(text(), new RegExp(`pending:${id(2)}`), 'requested context is held pending');
  await click('Keep editing');
  assert.match(text(), new RegExp(`active:${id(1)}`), 'cancel preserves active context');
  assert.match(text(), /dirty:true/, 'cancel preserves unsaved form');
  assert.equal(discardCount, 0);
  await click('Select context 2');
  await click('Discard and switch');
  assert.match(text(), new RegExp(`active:${id(2)}`), 'confirmed discard switches context');
  assert.equal(discardCount, 1, 'registered discard callback runs');
  assert.match(text(), /dirty:false/, 'discard callback clears registered form state');
  assert.equal(discardCount, 1);
  await click('Select context 1');
  assert.match(text(), new RegExp(`active:${id(1)}`), 'clean context changes remain immediate');
  assert.match(text(), /pending:none/, 'clean context changes need no prompt');
  console.log('PASS shared context provider: dirty navigation pauses, cancel retains edits, confirm discards before switching');
} finally {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  dom.window.close();
}
