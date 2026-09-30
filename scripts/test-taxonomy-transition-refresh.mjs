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
let success;
let transitions;
let reads;
const taxonomy = {has_assignment: false, status: 'unclassified', workspace_id: 'workspace'};
const transport = async (url, options) => {
  if (options?.method === 'POST') {
    assert.equal(JSON.parse(options.body).context_id, 'property-context');
    return {ok: success, json: async () => success ? {data: {}} : {error: {code: 'EXPECTED_ASSIGNMENT_CONFLICT'}}};
  }
  if (url.includes('/options?')) return {ok: true, json: async () => ({data: {
    profiles: [{code: 'residential', name: 'Residential'}],
    operating_models: [{code: 'association', name: 'Association'}],
    compatibilities: [{profile_code: 'residential', operating_model_code: 'association', compatibility_level: 'compatible'}],
  }})};
  reads++;
  return {ok: true, json: async () => ({data: taxonomy})};
};
const filename = fileURLToPath(new URL('../src/components/workspace/WorkspaceTaxonomyCard.tsx', import.meta.url));
const compiled = new Module(filename);
compiled.require = id => id === '@/components/dashboard-lab/DashboardTransport' ? {useDashboardFetch: () => transport} : require(id);
compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
}}).outputText, filename);
const {WorkspaceTaxonomyCard} = compiled.exports;
const root = createRoot(document.getElementById('root'));
try {
  for (const outcome of [true, false]) {
    success = outcome; transitions = 0; reads = 0;
    await act(async () => root.render(React.createElement(WorkspaceTaxonomyCard, {
      key: String(outcome), taxonomy, contextId: 'property-context', countryCode: 'RO', lang: 'en', canManage: true,
      onTransition: () => transitions++,
    })));
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent.includes('Manage Classification')).click());
    const form = document.querySelector('form');
    assert.ok(form, 'editable taxonomy form must be available');
    await act(async () => form.dispatchEvent(new dom.window.Event('submit', {bubbles: true, cancelable: true})));
    assert.equal(transitions, outcome ? 1 : 0, 'refresh parent only after a successful transition');
    assert.equal(reads, outcome ? 1 : 0, 'reload authoritative taxonomy on success');
    assert.ok(document.body.textContent.includes(outcome ? 'applied successfully' : 'modified concurrently'));
  }
  console.log('PASS taxonomy transition: successful mutation reloads classification and refreshes composition; conflict keeps form without refresh');
} finally {
  await act(async () => root.unmount());
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  dom.window.close();
}
