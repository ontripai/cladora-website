import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (!existsSync(file) && file.pathname.endsWith('.ts')) file = new URL(file.href.replace(/\.ts$/, '.tsx'));
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file); const mod = new Module(filename);
  mod.require = name => name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith('.') ? load(new URL(`${name}.ts`, file)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  cache.set(file.href, mod.exports); return mod.exports;
}

const { ServiceResourcePicker } = load(new URL('../src/components/customer/ServiceResourcePicker.tsx', import.meta.url));
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
const first = { resource_id: '00000000-0000-4000-8000-000000000001', resource_version: 4, resource_type: 'unit' };
const second = { resource_id: '00000000-0000-4000-8000-000000000002', resource_version: 2, resource_type: 'vehicle' };
const resources = [
  { reference: first, label: 'Apartament 1204', detail: 'Turn A' },
  { reference: second, label: 'Volvo XC60', detail: null },
];
let selected = null;
const render = async (lang, error = null) => act(async () => root.render(React.createElement(ServiceResourcePicker, {
  lang, resources, value: selected, error, onChange: value => { selected = value; },
})));

try {
  for (const [lang, expected] of [['ro', 'Alege resursa'], ['en', 'Choose the resource'], ['fa', 'منبع را انتخاب کنید']]) {
    selected = null; await render(lang);
    const select = document.querySelector('select');
    assert.equal(select.options[0].textContent, expected);
    assert.equal(document.querySelector('fieldset').dir, lang === 'fa' ? 'rtl' : 'ltr');
    assert.match(select.className, /w-full/);
    assert.doesNotMatch(document.body.textContent, /00000000-0000/);
  }
  const select = document.querySelector('select');
  select.value = `${first.resource_id}:${first.resource_version}`;
  await act(async () => select.dispatchEvent(new window.Event('change', { bubbles: true })));
  assert.deepEqual(selected, first);
  await render('fa', 'دسترسی این منبع تغییر کرده است؛ منبع دیگری انتخاب کنید.');
  assert.equal(document.querySelector('select').value, `${first.resource_id}:${first.resource_version}`);
  assert.equal(document.querySelector('select').getAttribute('aria-invalid'), 'true');
  assert.match(document.querySelector('[role="alert"]').textContent, /دسترسی/);
  assert.doesNotMatch(document.body.textContent, /00000000-0000/);
  console.log('PASS V14 SERVICE named resource picker: RO/EN/FA, RTL, mobile width, accessible error and retained selection');
} finally {
  await act(async () => root.unmount()); dom.window.close();
}
