import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');

const runtime = path.resolve('work/ce-guide-recovery-runtime.mjs');
fs.mkdirSync(path.dirname(runtime), { recursive: true });
fs.writeFileSync(runtime, ts.transpileModule(fs.readFileSync('src/components/customer/CustomerExperienceGuide.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText);
const { CustomerExperienceGuide } = await import(runtime);

const container = document.getElementById('root');
const root = createRoot(container);
const targets = [
  { id: 'target-document', label: 'Named building rules', type: 'document' },
  { id: 'target-service', label: 'Named concierge service', type: 'service' },
];
const guide = (patch = {}) => ({
  guide_id: 'guide-a',
  workspace_id: 'workspace-a',
  title: 'Arrival guide',
  audience_label: 'Named residents',
  status: 'draft',
  version: 1,
  can_edit: true,
  steps: [{ id: 'step-a', title: 'Arrival step', body: 'Use the main entrance.', references: [{ id: 'opaque-reference', label: 'Safe public reference', href: '/safe-reference' }] }],
  ...patch,
});
const translations = {
  ro: { sending: 'Se trimite…', saved: 'Ciorna ghidului a fost salvată.', error: 'Datele introduse au fost păstrate.', editor: 'Editează ghidul' },
  en: { sending: 'Sending…', saved: 'Guide draft saved.', error: 'Your input has been preserved.', editor: 'Edit guide' },
  fa: { sending: 'در حال ارسال…', saved: 'پیش‌نویس راهنما ذخیره شد.', error: 'ورودی شما حفظ شده است.', editor: 'ویرایش راهنما' },
};

function change(element, value) {
  const prototype = element.tagName === 'SELECT'
    ? dom.window.HTMLSelectElement.prototype
    : element.tagName === 'TEXTAREA'
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}

function submit(form) {
  form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
}

function editorFields() {
  const form = container.querySelector('form');
  const [title, stepTitle] = form.querySelectorAll('input');
  return { form, title, stepTitle, body: form.querySelector('textarea'), target: form.querySelector('select') };
}

let localeScenarios = 0;
try {
  for (const [lang, expected] of Object.entries(translations)) {
    let completion;
    let refreshes = 0;
    const calls = [];
    const commands = {
      saveDraft: (input) => {
        calls.push(input);
        return new Promise((resolve, reject) => { completion = { resolve, reject }; });
      },
    };
    const render = (value) => React.createElement(CustomerExperienceGuide, {
      key: `locale:${lang}`,
      lang,
      guide: value,
      targets,
      commands,
      onChanged: () => { refreshes += 1; },
    });

    await act(async () => root.render(render(guide())));
    let fields = editorFields();
    assert.equal(document.getElementById(fields.form.getAttribute('aria-labelledby')).textContent, expected.editor, 'the Guide form has a localized accessible name');
    const status = fields.form.querySelector('[role="status"]');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(status.closest('fieldset'), null, 'live feedback stays outside disabled controls');
    assert.equal(container.firstElementChild.getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
    assert.match(container.textContent, /Named building rules/);
    assert.match(container.textContent, /Safe public reference/);
    assert.doesNotMatch(container.textContent, /opaque-reference|target-document|guide-a|workspace-a/);

    await act(async () => {
      change(fields.title, 'Dirty guide title');
      change(fields.stepTitle, 'Dirty step title');
      change(fields.body, 'Dirty instructions');
      change(fields.target, 'target-document');
    });

    await act(async () => root.render(render(guide({
      version: 2,
      title: 'Server refresh title',
      steps: [{ id: 'step-a', title: 'Server refresh step', body: 'Server refresh body.', references: [] }],
    }))));
    fields = editorFields();
    assert.deepEqual([fields.title.value, fields.stepTitle.value, fields.body.value, fields.target.value], ['Dirty guide title', 'Dirty step title', 'Dirty instructions', 'target-document'], 'dirty fields survive a same-Guide version refresh');

    await act(async () => { submit(fields.form); submit(fields.form); });
    assert.equal(calls.length, 1, 'two synchronous Guide submissions issue one command');
    assert.deepEqual(calls[0], { guide_id: 'guide-a', title: 'Dirty guide title', step_title: 'Dirty step title', step_body: 'Dirty instructions', target_id: 'target-document' });
    assert.equal(fields.form.querySelector('fieldset').disabled, true);
    assert.equal(fields.form.querySelector('fieldset').getAttribute('aria-busy'), 'true');
    assert.equal(status.textContent, expected.sending);

    await act(async () => completion.reject(new Error('VERSION_CONFLICT')));
    fields = editorFields();
    assert.equal(fields.form.querySelector('fieldset').disabled, false);
    assert.ok(fields.form.querySelector('[role="alert"]').textContent.includes(expected.error));
    assert.deepEqual([fields.title.value, fields.stepTitle.value, fields.body.value, fields.target.value], ['Dirty guide title', 'Dirty step title', 'Dirty instructions', 'target-document']);
    assert.equal(refreshes, 0);

    await act(async () => submit(fields.form));
    assert.equal(calls.length, 2, 'retry is available after failure');
    await act(async () => completion.resolve());
    fields = editorFields();
    assert.equal(fields.form.querySelector('[role="status"]').textContent, expected.saved);
    assert.equal(fields.form.querySelector('[role="alert"]'), null);
    assert.equal(refreshes, 1);

    await act(async () => change(fields.title, 'Newer local title'));
    await act(async () => root.render(render(guide({
      version: 3,
      title: 'Confirmed saved title',
      steps: [{ id: 'step-a', title: 'Confirmed saved step', body: 'Confirmed saved instructions.', references: [] }],
    }))));
    fields = editorFields();
    assert.equal(fields.title.value, 'Newer local title', 'a newer edit is not replaced by the successful save refresh');
    assert.equal(fields.stepTitle.value, 'Confirmed saved step');
    assert.equal(fields.body.value, 'Confirmed saved instructions.');
    assert.equal(fields.target.value, 'target-document', 'the named target remains selected when the read projection cannot identify it safely');

    await act(async () => root.render(render(guide({ workspace_id: 'workspace-b', title: 'Other workspace guide', steps: [{ id: 'step-b', title: 'Other step', body: 'Other instructions.', references: [] }] }))));
    fields = editorFields();
    assert.deepEqual([fields.title.value, fields.stepTitle.value, fields.body.value, fields.target.value], ['Other workspace guide', 'Other step', 'Other instructions.', '']);
    assert.equal(fields.form.querySelector('[role="status"]').textContent, '', 'feedback resets with Workspace identity');
    localeScenarios += 1;
  }

  let nullCompletion;
  const nullCalls = [];
  const nullCommands = { saveDraft: (input) => { nullCalls.push(input); return new Promise((resolve) => { nullCompletion = resolve; }); } };
  await act(async () => root.render(React.createElement(CustomerExperienceGuide, { key: 'null-target', lang: 'en', guide: guide(), targets, commands: nullCommands })));
  await act(async () => submit(editorFields().form));
  assert.equal(nullCalls[0].target_id, null, 'no named target is sent as null');
  await act(async () => nullCompletion());

  for (const identityPatch of [{ workspace_id: 'workspace-later' }, { guide_id: 'guide-later' }]) {
    let finish;
    let refreshes = 0;
    const commands = { saveDraft: () => new Promise((resolve) => { finish = resolve; }) };
    const render = (value) => React.createElement(CustomerExperienceGuide, { key: `late:${JSON.stringify(identityPatch)}`, lang: 'en', guide: value, targets, commands, onChanged: () => { refreshes += 1; } });
    await act(async () => root.render(render(guide())));
    await act(async () => change(editorFields().title, 'Discarded editor title'));
    await act(async () => submit(editorFields().form));
    await act(async () => root.render(render(guide({ ...identityPatch, title: 'Replacement editor' }))));
    await act(async () => finish());
    assert.equal(editorFields().title.value, 'Replacement editor');
    assert.equal(editorFields().form.querySelector('[role="status"]').textContent, '');
    assert.equal(refreshes, 0, 'a discarded editor cannot request refresh or publish feedback');
  }

  await act(async () => root.render(React.createElement(CustomerExperienceGuide, { lang: 'en', guide: guide({ can_edit: false }), targets, commands: { saveDraft: async () => {} } })));
  assert.equal(container.querySelector('form'), null, 'read access does not imply editor authority');
  await act(async () => root.render(React.createElement(CustomerExperienceGuide, { lang: 'en', guide: guide({ can_edit: true }), targets, commands: null })));
  assert.equal(container.querySelector('form'), null, 'a visible Guide without a command adapter remains read-only');

  console.log(`CE012-UX-02 passed: ${localeScenarios} locale scenarios, named/null targets, synchronous duplicate prevention, pending/success feedback, failure retry, same-Guide refresh recovery, successful-save reconciliation, identity reset, discarded completion and permission-hidden editor.`);
} finally {
  await act(async () => root.unmount());
  fs.rmSync(runtime, { force: true });
}
