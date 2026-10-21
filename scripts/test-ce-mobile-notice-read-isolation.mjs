import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

// Actual component + actual ContextProvider; only HTTP and Next Link are mocked.
// Deferred transport deliberately ignores AbortSignal to test stale-body fences.
const baseline = process.argv.includes('--baseline');
const BASE = '0b65fb8bf804631568d8284fbb75a419c8baaa92';
const require = createRequire(import.meta.url);
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/en/app/communications' });
const saved = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
const originalFetch = globalThis.fetch;
const { createRoot } = await import('react-dom/client');
function load(path, mocks, atBase = false) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const source = atBase ? execFileSync('git', ['show', `${BASE}:${path}`], { encoding: 'utf8' }) : readFileSync(filename, 'utf8');
  const mod = new Module(filename);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports;
}
const provider = load('src/components/customer/CustomerContextProvider.tsx', {
  '@/components/dashboard-lab/DashboardTransport': { useDashboardFetch: () => globalThis.fetch, useDashboardPreview: () => false },
});
const { CustomerCommunicationsDashboard } = load('src/components/customer/CustomerCommunicationsDashboard.tsx', {
  './CustomerContextProvider': provider,
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
}, baseline);
const contexts = ['A', 'B'].map((id, i) => ({ context_id: id, membership_id: `member-${id}`,
  tenant_name: `Tenant ${id}`, role_code: i ? 'resident' : 'association_admin',
  role_name: i ? 'Resident' : 'Administrator', scope_type: 'tenant', context_label: id }));
let ctx; let root; let pending = []; let requests = []; let committed = [];
function Probe() {
  ctx = provider.useCustomerContext();
  React.useLayoutEffect(() => { committed.push({ context: ctx.active?.context_id ?? '', text: document.body.textContent }); });
  return null;
}
globalThis.fetch = (input, options = {}) => {
  const url = new URL(String(input), dom.window.location.origin);
  if (url.pathname.endsWith('/contexts')) return Promise.resolve({ ok: true, json: async () => ({ contexts }) });
  if (url.pathname.endsWith('/dashboard')) return Promise.resolve({ ok: true, json: async () => ({ contextId: url.searchParams.get('context_id') }) });
  return new Promise((resolve, reject) => {
    const request = { url, options, resolve, reject }; pending.push(request); requests.push(request);
  });
};
const wait = () => act(async () => { await new Promise(r => setTimeout(r, 180)); });
const text = () => document.body.textContent;
const buttons = () => [...document.querySelectorAll('button')];
const byText = value => { const button = buttons().find(b => b.textContent.trim() === value); assert.ok(button, `button ${value}`); return button; };
const click = button => act(async () => button.click());
const take = predicate => {
  const index = pending.findIndex(predicate); assert.notEqual(index, -1, 'expected mocked read');
  return pending.splice(index, 1)[0];
};
const list = id => take(r => r.url.pathname.endsWith('/notices') && r.url.searchParams.get('context_id') === id);
const detail = id => take(r => r.url.pathname.endsWith(`/notices/${id}`));
const reply = (r, body, ok = true) => act(async () => r.resolve({ ok, json: async () => body }));
const fail = r => act(async () => r.reject(new Error('synthetic offline')));
const tick = () => act(async () => { await new Promise(r => setTimeout(r, 5)); });
const translations = {
  en: { details: 'Details', close: 'Close', refresh: 'Refresh', create: 'Create Official Notice', save: 'Save Notice Draft', evidence: 'Record Physical Evidence', submit: 'Record Evidence', deliveries: 'View Delivery Outbox', approve: 'Approve Notice', next: 'Next page', error: 'Communications could not be loaded.' },
  ro: { details: 'Detalii', close: 'Închide', refresh: 'Reîncarcă', create: 'Creează înștiințare oficială', save: 'Salvează ciornă', evidence: 'Înregistrează dovadă fizică', submit: 'Înregistrează dovadă', deliveries: 'Jurnal trimiteri', approve: 'Aprobă înștiințarea', next: 'Pagina următoare', error: 'Comunicările nu au putut fi încărcate.' },
  fa: { details: 'جزئیات', close: 'بستن', refresh: 'بازخوانی', create: 'ثبت ابلاغیه رسمی جدید', save: 'ذخیره پیش‌نویس ابلاغیه', evidence: 'ثبت مدرک فیزیکی / پستی', submit: 'ثبت شواهد', deliveries: 'کارتابل ارسال‌ها', approve: 'تصویب رسمی ابلاغیه', next: 'صفحه بعد', error: 'دریافت ارتباطات ناموفق بود.' },
};
const mutations = () => requests.filter(r => (r.options.method ?? 'GET') !== 'GET');
const absent = (...values) => values.forEach(value => assert.equal(text().includes(value), false, `hide ${value}`));
async function openDetail(id) {
  const tr = [...document.querySelectorAll('tbody tr')].find(tr => tr.textContent.includes(`Title-${id}`));
  assert.ok(tr, `notice row ${id}`);
  const opener = tr.querySelector('button'); opener.focus();
  await click(opener); await tick(); return opener;
}
const closeDetail = t => click(document.querySelector(`[role="dialog"] button[aria-label="${t.close}"]`));
const refresh = t => click(document.querySelector(`button[aria-label="${t.refresh}"]`));
async function change(input, value) {
  assert.ok(input, 'input exists');
  const proto = input.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}
const submit = form => act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
const row = id => ({ id, title_ro: `Title-${id}`, title_en: `Title-${id}`, title_fa: `Title-${id}`,
  notice_number: 1, communication_type: 'general_announcement', legal_classification: 'informational_optional',
  status: 'published', source_module: 'general', created_at: '2026-01-01T00:00:00Z' });
const payload = (...ids) => ({ total: ids.length, rows: ids.map(row) });
const body = id => ({ notice: { ...row(id), body_ro: `PRIVATE-BODY-${id}`, body_en: `PRIVATE-BODY-${id}`, body_fa: `PRIVATE-BODY-${id}` },
  my_acknowledgement: null, statutory_evidence: [] });
async function mount(lang = 'en', initialView = 'official_notices', waitForReads = true) {
  pending = []; requests = []; committed = []; sessionStorage.clear();
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(provider.CustomerContextProvider, null,
    React.createElement(Probe), React.createElement(CustomerCommunicationsDashboard, { lang, initialView }))));
  if (waitForReads) await wait();
}
async function unmount() { if (root) { await act(async () => root.unmount()); root = null; } }
const select = id => act(async () => ctx.select(id));
try {
  if (baseline) {
    await mount();
    const old = list('A'); await select('B'); await wait();
    await reply(list('B'), payload('CURRENT-B')); await reply(old, payload('LATE-A'));
    assert.ok(text().includes('Title-LATE-A'), 'BASE reproduces late list A replacing list B');
    await unmount(); await mount(); await reply(list('A'), payload('ONE', 'TWO'));
    await click(byText('Details')); const lateDetail = detail('ONE');
    await click(document.querySelector('[role="dialog"] button[aria-label="Close"]'));
    await click(buttons().filter(b => b.textContent === 'Details')[1]);
    await reply(detail('TWO'), body('TWO')); await reply(lateDetail, body('ONE'));
    assert.ok(document.querySelector('[role="dialog"]').textContent.includes('PRIVATE-BODY-ONE'), 'BASE reproduces late detail A replacing detail B');
    console.log(JSON.stringify({ suite: 'CE-MOBILE-NOTICE-READ-ISOLATION-01', base: BASE, provenance: 'MOUNTED_ACTUAL_COMPONENT_REAL_PROVIDER_MOCKED_HTTP', baseline: 'REPRODUCED_LATE_LIST_AND_DETAIL_OVERWRITE' }));
  } else {
    const completed = [];
    for (const lang of ['en', 'ro', 'fa']) {
      const t = translations[lang];
      await mount(lang);
      assert.equal(document.querySelector('#root > div').dir, lang === 'fa' ? 'rtl' : 'ltr');
      const oldA = list('A'); await select('B');
      assert.equal(oldA.options.signal.aborted, true, 'Context switch aborts old list');
      await wait(); const oldB = list('B'); await select('A'); await wait();
      await reply(list('A'), payload('WINNER-A'));
      await reply(oldA, payload('STALE-A')); await fail(oldB);
      assert.ok(text().includes('Title-WINNER-A')); absent('STALE-A', t.error);
      completed.push(`${lang}:rapid-A-B-A-late-success-failure-finally`);

      await refresh(t); absent('Title-WINNER-A'); await wait();
      const denied = list('A'); await reply(denied, {}, false);
      assert.ok(document.querySelector('[role="alert"]')); absent('Title-WINNER-A');
      await refresh(t); await wait(); await fail(list('A'));
      assert.ok(document.querySelector('[role="alert"]'), 'current offline read has an error, not stale content'); absent('Title-WINNER-A');
      await refresh(t); await wait(); await reply(list('A'), payload('ONE', 'TWO'));
      const opener = await openDetail('ONE'); const d1 = detail('ONE');
      await closeDetail(t); assert.equal(document.activeElement, opener, 'close restores opener');
      assert.equal(d1.options.signal.aborted, true);
      await openDetail('TWO'); const d2 = detail('TWO');
      await reply(d2, body('TWO')); await reply(d1, body('ONE'));
      assert.ok(document.querySelector('[role="dialog"]').textContent.includes('PRIVATE-BODY-TWO'));
      absent('PRIVATE-BODY-ONE');
      await closeDetail(t); await openDetail('ONE'); const lateDetailFailure = detail('ONE');
      await closeDetail(t); await openDetail('TWO'); const currentDetail = detail('TWO');
      await fail(lateDetailFailure);
      assert.ok(document.querySelector('[role="dialog"] [role="status"]'), 'late failure/finally cannot clear current detail loading');
      assert.equal(document.querySelector('[role="dialog"] [role="alert"]'), null);
      await reply(currentDetail, body('TWO'));
      const modal = document.querySelector('[role="dialog"]');
      assert.ok(modal.getAttribute('aria-labelledby')); assert.equal(document.activeElement, modal);
      const focusables = [...modal.querySelectorAll('button:not(:disabled),input,select,textarea')];
      focusables.at(-1).focus();
      await act(async () => modal.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
      assert.equal(document.activeElement, focusables[0], 'Tab wraps within notice');
      await act(async () => modal.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
      assert.equal(document.activeElement, focusables.at(-1), 'Shift Tab wraps within notice');
      assert.equal(mutations().length, 0, 'opening/reading never acknowledges or records evidence');
      await click(byText(t.deliveries)); await tick();
      const failedDelivery = take(r => r.url.pathname.endsWith('/deliveries')); await reply(failedDelivery, {}, false);
      assert.ok(document.querySelector('[role="dialog"] [role="alert"]'));
      await click(byText(t.deliveries)); await tick();
      const delivery = take(r => r.url.pathname.endsWith('/deliveries'));
      await closeDetail(t); await openDetail('ONE');
      await reply(detail('ONE'), body('ONE'));
      await reply(delivery, { rows: [{ id: 'late-outbox', destination_masked: 'OLD-DELIVERY-SECRET' }] });
      absent('OLD-DELIVERY-SECRET');
      completed.push(`${lang}:detail-B-wins-delivery-abort-focus-and-zero-mutations`);

      const committedBeforeSwitch = committed.length;
      await select('B'); absent('PRIVATE-BODY-ONE', 'Title-ONE');
      const firstBCommit = committed.slice(committedBeforeSwitch).find(c => c.context === 'B');
      assert.ok(firstBCommit); assert.equal(firstBCommit.text.includes('PRIVATE-BODY-ONE'), false, 'old detail absent at layout commit before passive cleanup');
      assert.equal(firstBCommit.text.includes('Title-ONE'), false, 'old list absent before passive cleanup');
      assert.equal(document.querySelector('[role="dialog"]'), null);
      await wait(); await reply(list('B'), payload('RESIDENT'));
      assert.equal(buttons().some(b => b.textContent === t.create), false, 'resident has no manager create affordance');
      await openDetail('RESIDENT'); const noContextDetail = detail('RESIDENT');
      await select(''); absent('Title-RESIDENT');
      assert.equal(noContextDetail.options.signal.aborted, true);
      await reply(noContextDetail, body('RESIDENT')); await wait();
      absent('PRIVATE-BODY-RESIDENT', t.error); assert.equal(document.querySelector('[role="dialog"]'), null);
      assert.equal(mutations().length, 0);
      completed.push(`${lang}:context-removal-no-resurrection-role-from-provider`);

      await select('A'); await wait(); await reply(list('A'), payload('ONE', 'TWO'));
      await openDetail('ONE'); await reply(detail('ONE'), {}, false);
      assert.ok(document.querySelector('[role="dialog"] [role="alert"]'));
      assert.equal(document.querySelector('[role="dialog"]').textContent.includes('PRIVATE-BODY'), false);
      assert.equal(document.querySelector('[role="dialog"]').querySelectorAll('button').length, 1, 'denial leaves only close, not summary-derived actions');
      await closeDetail(t); await openDetail('ONE'); await reply(detail('ONE'), body('TWO'));
      assert.ok(document.querySelector('[role="dialog"] [role="alert"]'), 'mismatched notice identity fails closed');
      absent('PRIVATE-BODY-TWO');
      await closeDetail(t); await openDetail('ONE');
      const redacted = body('ONE'); redacted.notice.title_ro = 'CURRENT-SERVER-TITLE';
      redacted.notice.title_en = null; redacted.notice.title_fa = null;
      await reply(detail('ONE'), redacted);
      assert.ok(document.querySelector('[role="dialog"]').textContent.includes('CURRENT-SERVER-TITLE'));
      assert.equal(document.querySelector('[role="dialog"]').textContent.includes('Title-ONE'), false, 'missing translation does not revive an older summary');
      await closeDetail(t);
      // Fence body decoding too, not merely arrival of fetch headers.
      await refresh(t); await wait(); const decoding = list('A'); let resolveBody;
      await act(async () => decoding.resolve({ ok: true, json: () => new Promise(resolve => { resolveBody = resolve; }) }));
      await select('B'); await wait();
      await act(async () => resolveBody(payload('DECODED-OLD-A')));
      absent('DECODED-OLD-A'); assert.ok(document.querySelector('[role="status"]'), 'old completion cannot clear current loading');
      await reply(list('B'), {}, false); assert.ok(document.querySelector('[role="alert"]'));
      completed.push(`${lang}:denied-mismatched-redacted-detail-and-late-body-decoding`);

      await select('A'); await wait(); await reply(list('A'), payload('ONE'));
      await click(byText(t.create));
      const createModal = document.querySelector('[role="dialog"]');
      const titleInput = createModal.querySelector('input[required]');
      const bodyInput = createModal.querySelector('textarea[required]');
      await change(titleInput, 'UNSAVED-TITLE'); await change(bodyInput, 'UNSAVED-BODY');
      await refresh(t); await wait(); await reply(list('A'), payload('ONE'));
      assert.equal(titleInput.value, 'UNSAVED-TITLE'); assert.equal(bodyInput.value, 'UNSAVED-BODY');
      await select('B'); assert.equal(ctx.active.context_id, 'A'); assert.equal(ctx.pendingContextId, 'B');
      await act(async () => ctx.cancelContextChange()); assert.equal(titleInput.value, 'UNSAVED-TITLE');
      assert.equal(mutations().length, 0, 'draft typing/refresh/context request is not submission');
      await submit(createModal.querySelector('form'));
      const save = take(r => r.options.method === 'POST');
      assert.equal(save.url.pathname, '/api/customer/v1/communications/notices');
      assert.deepEqual(JSON.parse(save.options.body), { context_id: 'A', title_ro: 'UNSAVED-TITLE', body_ro: 'UNSAVED-BODY',
        title_en: null, body_en: null, title_fa: null, body_fa: null, communication_type: 'general_announcement',
        legal_classification: 'informational_optional', source_module: 'general' });
      await reply(save, { error: { message: 'MOCK-SAVE-DENIED' } }, false);
      assert.equal(titleInput.value, 'UNSAVED-TITLE'); assert.ok(text().includes('MOCK-SAVE-DENIED'));
      await select('B'); await act(async () => ctx.confirmContextChange());
      assert.equal(ctx.active.context_id, 'B'); assert.equal(document.querySelector('[role="dialog"]'), null);
      completed.push(`${lang}:manager-draft-refresh-keep-explicit-submit-payload-discard`);

      await wait(); await reply(list('B'), payload('OTHER')); await select('A'); await wait();
      await reply(list('A'), payload('ONE', 'TWO')); await openDetail('ONE'); await reply(detail('ONE'), body('ONE'));
      await click(byText(t.evidence));
      let evidenceForm = document.querySelector('[role="dialog"] form');
      await change(evidenceForm.querySelector('input[placeholder^="e.g."]'), 'UNSAVED-REFERENCE');
      assert.ok([...document.querySelectorAll('button[aria-pressed]')].every(b => b.disabled), 'dirty evidence draft prevents silent view disposal');
      assert.equal(document.querySelector('form input').disabled, true, 'dirty evidence draft keeps filter changes from disposing it');
      assert.equal(document.querySelector(`button[aria-label="${t.refresh}"]`).disabled, false, 'read-only refresh remains available');
      await refresh(t); absent('PRIVATE-BODY-ONE'); await wait(); await reply(list('A'), payload('ONE', 'TWO'));
      await reply(detail('ONE'), body('ONE')); evidenceForm = document.querySelector('[role="dialog"] form');
      assert.equal(evidenceForm.querySelector('input[placeholder^="e.g."]').value, 'UNSAVED-REFERENCE');
      await select('B'); assert.equal(ctx.active.context_id, 'A');
      await act(async () => ctx.cancelContextChange());
      const beforeEvidence = mutations().length; await submit(evidenceForm);
      const evidence = take(r => r.options.method === 'POST');
      assert.equal(mutations().length, beforeEvidence + 1);
      assert.equal(evidence.url.pathname, '/api/customer/v1/communications/notices/ONE/evidence');
      const evidencePayload = JSON.parse(evidence.options.body);
      assert.equal(evidencePayload.context_id, 'A'); assert.equal(evidencePayload.evidence_type, 'noticeboard_posting');
      assert.equal(evidencePayload.evidence_reference, 'UNSAVED-REFERENCE'); assert.equal(evidencePayload.notes, null);
      assert.ok(Number.isFinite(Date.parse(evidencePayload.occurred_at)));
      await fail(evidence); assert.equal(evidenceForm.querySelector('input[placeholder^="e.g."]').value, 'UNSAVED-REFERENCE');
      // Closing is explicit; a late mutation must not refresh/announce in a new notice.
      await submit(evidenceForm); const lateMutation = take(r => r.options.method === 'POST');
      await closeDetail(t); await openDetail('ONE'); await reply(detail('ONE'), body('ONE'));
      const requestCount = requests.length; await reply(lateMutation, {}); await wait();
      assert.equal(requests.length, requestCount, 'unmounted action callback cannot refresh current notice');
      completed.push(`${lang}:evidence-draft-preserved-explicit-only-write-late-action-fence`);

      await closeDetail(t); await openDetail('ONE');
      const operatorDetail = body('ONE'); operatorDetail.notice.status = 'draft';
      operatorDetail.statutory_evidence = [{ id: 'evidence-one', evidence_type: 'noticeboard_posting', evidence_reference: 'SERVER-REF',
        occurred_at: '2026-01-01T00:00:00Z', verification_status: 'pending_verification', verified_at: null, notes: null }];
      await reply(detail('ONE'), operatorDetail);
      const beforeAction = mutations().length;
      assert.ok(text().includes('SERVER-REF'));
      await click(byText(t.approve));
      const approval = take(r => r.url.pathname.endsWith('/approve'));
      assert.equal(mutations().length, beforeAction + 1);
      assert.deepEqual(JSON.parse(approval.options.body), { context_id: 'A', comments: 'Approved via Customer Portal' });
      await reply(approval, { error: { message: 'MOCK-OPERATOR-DENIED' } }, false);
      assert.ok(text().includes('MOCK-OPERATOR-DENIED'), 'operator failure feedback retained in current notice');
      await closeDetail(t); await openDetail('TWO');
      await reply(detail('TWO'), body('TWO'));
      absent('MOCK-OPERATOR-DENIED', 'SERVER-REF');
      completed.push(`${lang}:explicit-manager-approval-contract-feedback-isolation`);
      await refresh(t); await wait(); const lateAfterListDenial = detail('TWO');
      await reply(list('A'), {}, false);
      await reply(lateAfterListDenial, body('TWO'));
      absent('PRIVATE-BODY-TWO', 'Title-TWO');
      assert.ok(document.querySelector('[role="dialog"] [role="alert"]'));
      await closeDetail(t); await refresh(t); await wait(); await reply(list('A'), payload('ONE', 'TWO'));
      completed.push(`${lang}:list-denial-suppresses-late-detail-and-summary`);

      await openDetail('ONE'); const outstandingDetail = detail('ONE');
      await refresh(t); await wait(); const outstandingList = list('A'); const refreshingDetail = detail('ONE');
      await unmount(); assert.equal(outstandingDetail.options.signal.aborted, true); assert.equal(outstandingList.options.signal.aborted, true); assert.equal(refreshingDetail.options.signal.aborted, true);
      await reply(outstandingDetail, body('UNMOUNTED')); await fail(refreshingDetail); await fail(outstandingList);
      assert.equal(document.getElementById('root').textContent, '');
      completed.push(`${lang}:unmount-aborts-readers-no-state-resurrection`);

      await mount(lang, 'notifications');
      const generic = id => take(r => r.url.pathname.endsWith('/communications') && r.url.searchParams.get('context_id') === id);
      const noticeRow = { ...row('NOTIFICATION'), title: 'GENERIC-PRIVATE-NOTIFICATION', payload: { secret: 'HIDDEN-PAYLOAD' },
        email: 'HIDDEN-EMAIL', user_id: 'HIDDEN-USER', unread: true };
      await reply(generic('A'), { total: 41, rows: [noticeRow], summary: { channels: 2, published_posts: 3, open_polls: 4, unread_notifications: 5 } });
      await click(byText(t.details));
      assert.ok(document.querySelector('[role="dialog"]').textContent.includes('GENERIC-PRIVATE-NOTIFICATION'));
      absent('HIDDEN-PAYLOAD', 'HIDDEN-EMAIL', 'HIDDEN-USER');
      const scroller = document.querySelector('[role="region"]'); assert.equal(scroller.tabIndex, 0); assert.ok(scroller.getAttribute('aria-label'));
      const statusInput = document.querySelectorAll('form input')[1];
      await change(statusInput, 'published'); absent('GENERIC-PRIVATE-NOTIFICATION');
      assert.equal(document.querySelector('[role="dialog"]'), null);
      await wait(); const filtered = generic('A'); assert.equal(filtered.url.searchParams.get('status'), 'published');
      await reply(filtered, { total: 41, rows: [{ ...noticeRow, title: 'FILTERED-NOTIFICATION' }] });
      await click(document.querySelector(`button[aria-label="${t.next}"]`)); absent('FILTERED-NOTIFICATION');
      await wait(); const paged = generic('A'); assert.equal(paged.url.searchParams.get('offset'), '20');
      await reply(paged, { total: 41, rows: [{ ...noticeRow, title: 'PAGE-TWO' }] });
      await change(document.querySelector('form input'), '  query term  '); await submit(document.querySelector('form')); absent('PAGE-TWO');
      await wait(); const searched = generic('A'); assert.equal(searched.url.searchParams.get('query'), 'query term'); assert.equal(searched.url.searchParams.get('offset'), '0');
      await reply(searched, { total: 0, rows: [] });
      await change(document.querySelector('input[type="date"]'), '2026-01-01'); await wait();
      const dated = generic('A'); assert.equal(dated.url.searchParams.get('from'), '2026-01-01');
      await reply(dated, { total: 1, rows: [{ ...noticeRow, title: 'DATE-SCOPE-PRIVATE' }] });
      const officialLabel = { en: 'Official Notices', ro: 'Avizier & Înștiințări', fa: 'ابلاغیه‌های رسمی' }[lang];
      await click(byText(officialLabel)); absent('DATE-SCOPE-PRIVATE'); await wait(); await reply(list('A'), payload('NEW-VIEW'));
      assert.equal(mutations().length, 0, 'notification details/filter/page/view do not mark read or acknowledge');
      completed.push(`${lang}:notification-redaction-view-filter-query-date-page-isolation`);
      await unmount();
      await mount(lang, 'official_notices', false); await unmount(); await wait();
      assert.equal(requests.length, 0, 'unmount cancels owned debounce before transport starts');
      completed.push(`${lang}:unmount-clears-owned-debounce-timer`);
    }
    console.log(JSON.stringify({ suite: 'CE-MOBILE-NOTICE-READ-ISOLATION-01', status: 'PASS',
      provenance: 'MOUNTED_ACTUAL_COMPONENT_REAL_CONTEXT_PROVIDER_MOCKED_DEFERRED_HTTP', scenarios: completed,
      real_http_db_auth: 'NOT_RUN', physical_android_iphone: 'NOT_RUN', viewport_layout: 'NOT_RUN_JSDOM_IS_NOT_LAYOUT' }, null, 2));
  }
} finally {
  await unmount(); globalThis.fetch = originalFetch;
  for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  dom.window.close();
}
