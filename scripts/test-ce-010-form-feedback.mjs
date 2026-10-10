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
const runtime = path.resolve('work/ce-form-feedback-runtime.mjs');
fs.mkdirSync(path.dirname(runtime), { recursive: true });
fs.writeFileSync(runtime, ts.transpileModule(fs.readFileSync('src/components/customer/CustomerCommunityBase.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText);
const { CustomerCommunityBase } = await import(runtime);
const container = document.getElementById('root');
const root = createRoot(container);
const view = (workspace_id = 'workspace-a') => ({
  community_id: 'community-a', workspace_id, name: 'Named community', audience_label: 'Members',
  can_create_announcement: true, can_decide_reports: true,
  announcements: [{ id: 'announcement-a', title: 'Safety notice', body: 'Use the entrance.', status: 'published', version: 2, can_report: true }],
  reports: [{ id: 'report-a', target_title: 'Safety notice', report_reason: 'Needs review', status: 'open', version: 7 }],
});
const translations = {
  ro: { sending: 'Se trimite…', success: ['Ciorna a fost salvată.', 'Raportarea a fost trimisă.', 'Decizia a fost înregistrată.'], error: 'Datele introduse au fost păstrate.' },
  en: { sending: 'Sending…', success: ['Draft saved.', 'Report sent.', 'Decision recorded.'], error: 'Your input has been preserved.' },
  fa: { sending: 'در حال ارسال…', success: ['پیش‌نویس ذخیره شد.', 'گزارش ارسال شد.', 'تصمیم ثبت شد.'], error: 'ورودی شما حفظ شده است.' },
};
function change(element, value) {
  const proto = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
function submit(form) { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }
let checks = 0;
try {
  for (const [lang, t] of Object.entries(translations)) {
    for (let index = 0; index < 3; index += 1) {
      let pending; const calls = []; let refreshes = 0;
      const command = (input) => { calls.push(input); return new Promise((resolve, reject) => { pending = { resolve, reject }; }); };
      const commands = { createAnnouncement: command, reportContent: command, decideReport: command };
      const render = (workspaceId) => React.createElement(CustomerCommunityBase, { key: `${lang}:${index}`, lang, view: view(workspaceId), commands, onChanged: () => { refreshes += 1; } });
      await act(async () => root.render(render('workspace-a')));
      const form = container.querySelectorAll('form')[index];
      assert.ok(document.getElementById(form.getAttribute('aria-labelledby'))?.textContent, 'each form has an accessible name');
      const status = form.querySelector('[role="status"]');
      assert.equal(status.getAttribute('aria-live'), 'polite');
      const textarea = form.querySelector('textarea');
      await act(async () => {
        change(textarea, 'Keep this exact input');
        if (index > 0) change(form.querySelector('select'), index === 1 ? 'announcement-a' : 'report-a');
      });
      textarea.focus();
      await act(async () => { submit(form); submit(form); });
      assert.equal(calls.length, 1, 'two synchronous submissions issue exactly one command');
      assert.equal(form.getAttribute('aria-busy'), 'true');
      assert.equal(form.querySelector('fieldset').disabled, true, 'all fields are locked while sending');
      assert.equal(status.textContent, t.sending);
      assert.equal(calls[0][index === 0 ? 'body' : 'reason'], 'Keep this exact input');
      if (index === 2) assert.equal(calls[0].expected_version, 7, 'moderation keeps the server version');
      await act(async () => pending.reject(new Error('Transport failed')));
      assert.equal(form.getAttribute('aria-busy'), 'false');
      assert.equal(form.querySelector('fieldset').disabled, false);
      assert.equal(textarea.value, 'Keep this exact input');
      assert.ok(form.querySelector('[role="alert"]').textContent.includes(t.error));
      assert.equal(status.textContent, '', 'failure never announces success');
      assert.equal(refreshes, 0);
      await act(async () => submit(form));
      assert.equal(calls.length, 2, 'retry becomes possible after failure');
      await act(async () => pending.resolve());
      assert.equal(status.textContent, t.success[index]);
      assert.equal(textarea.value, '', 'successful submission clears the sent input');
      assert.equal(form.querySelector('[role="alert"]'), null);
      assert.equal(refreshes, 1, 'only success requests a refresh');
      assert.equal(container.firstElementChild.getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
      await act(async () => root.render(render('workspace-b')));
      assert.equal(container.querySelectorAll('form')[index].querySelector('[role="status"]').textContent, '', 'feedback is reset across Workspace changes');
      checks += 1;
    }
  }
  // A pending command in an old Workspace must not put its success feedback in the new one.
  let finish;
  const commands = { createAnnouncement: () => new Promise((resolve) => { finish = resolve; }) };
  const render = (workspaceId) => React.createElement(CustomerCommunityBase, { key: 'late-response', lang: 'en', view: view(workspaceId), commands });
  await act(async () => root.render(render('workspace-a')));
  await act(async () => { change(container.querySelector('textarea'), 'Old workspace draft'); });
  await act(async () => submit(container.querySelector('form')));
  await act(async () => root.render(render('workspace-b')));
  await act(async () => finish());
  assert.equal(container.querySelector('textarea').value, '');
  assert.equal(container.querySelector('form [role="status"]').textContent, '');
  console.log(`CE010-UX-02 passed: ${checks} locale/form scenarios, pending feedback, duplicate-submit lock, exact payloads, failure preservation, successful retry and Workspace reset including late completion.`);
} finally {
  await act(async () => root.unmount());
  fs.rmSync(runtime, { force: true });
}
