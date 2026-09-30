import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<div id="root"></div>', {url: 'https://cladora.test'});
const saved = new Map();
for (const [key, value] of Object.entries({window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true})) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
}
const originalFetch = globalThis.fetch;
let context;
let holdStatus = 'none';
globalThis.fetch = async () => ({ok: true, json: async () => ({
  rows: [{id: 'doc-1', title: 'TEST DOCUMENT', legal_hold_status: holdStatus, scanning_status: 'clean'}],
  total: 1, read_only: false, storage_access: true, signed_urls: true,
})});
const filename = fileURLToPath(new URL('../src/components/customer/CustomerDocumentsDashboard.tsx', import.meta.url));
const compiled = new Module(filename);
compiled.require = id => id === './CustomerContextProvider' ? {useCustomerContext: () => context} : require(id);
compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
}}).outputText, filename);
const {CustomerDocumentsDashboard} = compiled.exports;
const root = createRoot(document.getElementById('root'));
try {
  let caseId = 0;
  for (const scenario of [
    {permissions: [], upload: false, hold: false},
    {permissions: ['documents.vault.upload'], upload: true, hold: false},
    {permissions: ['documents.vault.hold'], upload: false, hold: true},
    {permissions: ['documents.vault.upload', 'documents.vault.hold'], upload: true, hold: true},
    {permissions: ['documents.vault.upload', 'documents.vault.hold'], stale: true, upload: false, hold: false},
    {missing: true, upload: false, hold: false},
  ]) for (const status of ['none', 'active']) {
    holdStatus = status;
    context = {active: {context_id: 'current-context'}, dashboard: scenario.missing ? null : {
      contextId: scenario.stale ? 'previous-context' : 'current-context', permissions: scenario.permissions,
    }};
    await act(async () => root.render(React.createElement(CustomerDocumentsDashboard, {
      key: ++caseId, lang: 'en', initialDocumentId: 'doc-1',
    })));
    await act(async () => new Promise(resolve => setTimeout(resolve, 180)));
    const buttons = [...document.querySelectorAll('button')].map(button => button.textContent.trim());
    assert.ok(document.body.textContent.includes('TEST DOCUMENT'), 'document detail must load');
    assert.equal(buttons.includes('Upload Document'), scenario.upload);
    assert.equal(buttons.includes(status === 'active' ? 'Release Legal Hold' : 'Place Legal Hold'), scenario.hold);
  }
  console.log('PASS document actions: upload and hold permissions, active/released hold, stale context and missing dashboard (12 rendered cases)');
} finally {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  dom.window.close();
}
