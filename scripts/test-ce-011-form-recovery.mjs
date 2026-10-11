import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const runtime = path.resolve('work/ce-event-recovery-runtime.mjs');
fs.mkdirSync(path.dirname(runtime), { recursive: true });
fs.writeFileSync(runtime, ts.transpileModule(fs.readFileSync('src/components/customer/CustomerEventInterest.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText);
const { CustomerEventInterest } = await import(runtime);
const container = document.getElementById('root'); const root = createRoot(container);
const members = [{ membership_id: 'synthetic-member', display_name: 'Ana Popescu' }];
const kinds = ['publish', 'cancel', 'registerInterest', 'withdrawInterest', 'recordAttendance'];
const event = (patch = {}) => ({
  event_id: 'synthetic-event', workspace_id: 'synthetic-workspace', title: 'Named event',
  starts_at: '2026-10-11T12:00:00Z', ends_at: '2026-10-11T13:00:00Z', timezone: 'Europe/Bucharest',
  status: 'published', audience_label: 'Members', version: 3, interest_status: null, interest_version: 2,
  can_publish: true, can_cancel: true, can_register_interest: true, can_withdraw_interest: true, can_record_attendance: true,
  ...patch,
});
const copy = {
  ro: { sending: 'Se trimite…', buttons: ['Publică', 'Anulează evenimentul', 'Sunt interesat(ă)', 'Retrage interesul'], success: ['Evenimentul a fost publicat.', 'Evenimentul a fost anulat.', 'Interesul a fost înregistrat.', 'Interesul a fost retras.', 'Prezența a fost înregistrată.'], error: 'Datele introduse au fost păstrate.', notice: 'Exprimarea interesului nu reprezintă o rezervare și nu garantează accesul.' },
  en: { sending: 'Sending…', buttons: ['Publish', 'Cancel event', 'Register interest', 'Withdraw interest'], success: ['Event published.', 'Event cancelled.', 'Interest registered.', 'Interest withdrawn.', 'Attendance recorded.'], error: 'Your input has been preserved.', notice: 'Registering interest is not a booking and does not guarantee admission.' },
  fa: { sending: 'در حال ارسال…', buttons: ['انتشار', 'لغو رویداد', 'ثبت علاقه', 'لغو علاقه'], success: ['رویداد منتشر شد.', 'رویداد لغو شد.', 'علاقه ثبت شد.', 'علاقه لغو شد.', 'حضور ثبت شد.'], error: 'ورودی شما حفظ شده است.', notice: 'ثبت علاقه به معنی رزرو یا تضمین ورود نیست.' },
};
function change(element, value) {
  const prototype = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
  element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
const submit = (form) => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
const button = (text) => [...container.querySelectorAll('button')].find((item) => item.textContent === text);
let scenarios = 0;
try {
  for (const [lang, t] of Object.entries(copy)) {
    for (let index = 0; index < kinds.length; index += 1) {
      const calls = []; let completion; let refreshed = 0;
      const commands = Object.fromEntries(kinds.map((kind) => [kind, (...input) => {
        calls.push({ kind, input }); return new Promise((resolve, reject) => { completion = { resolve, reject }; });
      }]));
      const render = (patch = {}) => React.createElement(CustomerEventInterest, { key: `${lang}:${index}`, lang, event: event(patch), commands, eligibleAttendanceMembers: members, onChanged: () => { refreshed += 1; } });
      await act(async () => root.render(render()));
      const form = container.querySelector('form'); const select = form.querySelector('select'); const input = form.querySelector('input');
      assert.ok(document.getElementById(form.getAttribute('aria-labelledby'))?.textContent);
      const status = container.querySelector('[role="status"]');
      assert.equal(status.getAttribute('aria-live'), 'polite');
      assert.equal(status.closest('[aria-busy]'), null);
      assert.equal(container.firstElementChild.getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
      assert.equal(container.querySelector('[role="note"]').textContent, t.notice);
      assert.match(form.textContent, /Ana Popescu/); assert.match(form.textContent, /Europe\/Bucharest/);
      assert.doesNotMatch(container.textContent, /synthetic-member|synthetic-event|synthetic-workspace/);
      await act(async () => { change(select, 'synthetic-member'); change(input, '2026-10-11T15:10'); });
      const send = () => index === 4 ? submit(form) : button(t.buttons[index]).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await act(async () => { send(); send(); submit(form); });
      assert.equal(calls.length, 1, 'one synchronous Event lock covers both actions and attendance');
      assert.equal(calls[0].kind, kinds[index]);
      if (index === 4) assert.deepEqual(calls[0].input, [{ event_id: 'synthetic-event', expected_version: 3, membership_id: 'synthetic-member', observed_local: '2026-10-11T15:10', timezone: 'Europe/Bucharest' }]);
      else assert.deepEqual(calls[0].input, index < 2 ? ['synthetic-event', 3] : ['synthetic-event', 3, 2]);
      assert.equal(status.textContent, t.sending);
      assert.equal(form.querySelector('fieldset').disabled, true);
      assert.ok([...container.querySelectorAll('button')].every((item) => item.disabled));
      await act(async () => completion.reject(new Error('VERSION_CONFLICT')));
      assert.ok(container.querySelector('[role="alert"]').textContent.includes(t.error));
      assert.equal(document.getElementById(form.getAttribute('aria-describedby')).getAttribute('role'), 'alert');
      assert.equal(select.value, 'synthetic-member'); assert.equal(input.value, '2026-10-11T15:10');
      assert.equal(status.textContent, ''); assert.equal(refreshed, 0);
      await act(async () => root.render(render({ version: 4, interest_version: 3 })));
      assert.equal(select.value, 'synthetic-member'); assert.equal(input.value, '2026-10-11T15:10');
      await act(async () => send());
      const retried = calls[1].input;
      assert.equal(index === 4 ? retried[0].expected_version : retried[1], 4);
      if (index === 2 || index === 3) assert.equal(retried[2], 3);
      await act(async () => completion.resolve());
      assert.equal(status.textContent, t.success[index]);
      assert.equal(container.querySelector('[role="alert"]'), null);
      assert.equal(refreshed, 1);
      assert.equal(select.value, index === 4 ? '' : 'synthetic-member');
      assert.equal(input.value, index === 4 ? '' : '2026-10-11T15:10');
      await act(async () => root.render(render({ event_id: 'other-event' })));
      assert.equal(container.querySelector('[role="status"]').textContent, '');
      assert.equal(container.querySelector('input').value, '');
      scenarios += 1;
    }
  }
  for (const patch of [{ event_id: 'other-event' }, { workspace_id: 'other-workspace' }]) {
    let finish; let refreshed = 0;
    const commands = { recordAttendance: () => new Promise((resolve) => { finish = resolve; }) };
    const render = (value) => React.createElement(CustomerEventInterest, { key: 'late', lang: 'en', event: event(value), commands, eligibleAttendanceMembers: members, onChanged: () => { refreshed += 1; } });
    await act(async () => root.render(render()));
    await act(async () => { change(container.querySelector('select'), 'synthetic-member'); change(container.querySelector('input'), '2026-10-11T15:10'); });
    await act(async () => submit(container.querySelector('form')));
    await act(async () => root.render(render(patch)));
    await act(async () => finish());
    assert.equal(container.querySelector('[role="status"]').textContent, '');
    assert.equal(container.querySelector('input').value, ''); assert.equal(refreshed, 0, 'discarded Event completion cannot refresh the new view');
  }
  await act(async () => root.render(React.createElement(CustomerEventInterest, { lang: 'en', event: event({ can_publish: false, can_cancel: false, can_register_interest: false, can_withdraw_interest: false, can_record_attendance: false }), commands: {} })));
  assert.equal(container.querySelectorAll('button,form').length, 0, 'unauthorized controls stay hidden');
  console.log(`CE011-UX-02 passed: ${scenarios} locale/action scenarios, named attendance, shared duplicate-submit lock, exact versions/timezone, failure preservation and explicit retry, permission-hidden controls, Event/Workspace reset and discarded completion.`);
} finally {
  await act(async () => root.unmount()); fs.rmSync(runtime, { force: true });
}
