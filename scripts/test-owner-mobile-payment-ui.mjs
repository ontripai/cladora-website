import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const filename = fileURLToPath(new URL(path, import.meta.url));
  const mod = new Module(filename);
  mod.require = id => overrides[id] ?? require(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return mod.exports;
}
const attemptModule = load('../src/lib/payments/direct-payment-attempt-v1.ts');
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let active, dashboard, authListener;
let userId = id(1);
const { CustomerBillingDashboard } = load('../src/components/customer/CustomerBillingDashboard.tsx', {
  './CustomerContextProvider': { useCustomerContext: () => ({ active, dashboard }) },
  './CustomerRegistryPicker': { CustomerRegistryPicker: () => null },
  '@/lib/payments/direct-payment-attempt-v1': attemptModule,
  '@/lib/supabase/client': { createClient: () => ({ auth: {
    getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    onAuthStateChange: fn => { authListener = fn; return { data: { subscription: { unsubscribe() {} } } }; },
  } }) },
});
const dom = new JSDOM('<div id="root"></div>', { url: 'http://127.0.0.1:41957' });
const saved = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
  navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, fetch: undefined, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let root, calls, mode, postGate, instructionGate, invoice, canonicalStatus, billingHandler;
const texts = { en: { pay: 'Pay', close: 'Close', retry: 'Check existing payment', card: 'Debit / Credit Card', unknown: 'outcome is unknown' },
  ro: { pay: 'Plătește', close: 'Închide', retry: 'Verifică plata existentă', card: 'Card bancar', unknown: 'este necunoscut' },
  fa: { pay: 'پرداخت', close: 'بستن', retry: 'بررسی پرداخت موجود', card: 'کارت بانکی', unknown: 'نامشخص' } };
let scenarios = 0;
function select(n = 2) { active = { context_id: id(n), membership_id: id(n + 100) }; dashboard = { contextId: active.context_id, workspace_id: id(n + 200) }; }
function makeInvoice(unit = id(3)) { return { id: id(4), invoice_no: 701, unit_id: unit, unit_code: 'A-01', period_start: '2026-01-01', period_end: '2026-01-31', issued_on: null,
  due_on: null, currency: 'RON', subtotal: 10, tax_total: 0, total: 10, status: 'issued', original_amount: 10, paid_amount: 0,
  credited_amount: 0, outstanding_amount: 10, overdue: false, journal_id: null, journal_no: null }; }
async function settle() { await act(async () => { await new Promise(r => setTimeout(r, 5)); }); }
async function mount(lang, configuration = 'ok', unit = id(3)) {
  select(); userId = id(1); calls = []; billingHandler = null; mode = configuration; canonicalStatus = 'created'; invoice = makeInvoice(unit); postGate = deferred(); instructionGate = deferred();
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET', body: init.body });
    if (String(url).includes('/billing?')) return billingHandler ? billingHandler(String(url)) : billingResponse();
    if (init.method === 'POST') {
      if (mode === 'post-hold') await postGate.promise;
      if (mode === 'unknown') throw new TypeError('synthetic transport outcome unknown');
      if (mode === 'setup') return json({ error: { code: 'PAYMENT_SETUP_REQUIRED', message: 'private-debug-not-for-ui' } }, 409);
      return json({ payment_intent_id: id(5), status: 'created' }, 201);
    }
    if (String(url).includes('/bank-instruction?')) {
      if (mode === 'instruction-hold') await instructionGate.promise;
      if (mode === 'masked') return json({ error: { code: 'PAYMENT_DESTINATION_UNAVAILABLE', message: 'private-debug-not-for-ui' } }, 409);
      if (mode === 'instruction-error') return json({ error: { code: 'QUERY_FAILED' } }, 500);
      return json({ association_legal_name: 'SYNTHETIC BANK DESTINATION', bank_name: 'Synthetic', iban: 'RO49AAAA1B31007593840000',
        currency: 'RON', amount: 10, structured_reference: 'SYNTHETIC-REFERENCE', epc_qr_payload: null });
    }
    return json({ payment_intent_id: id(5), status: canonicalStatus, payment_method: 'bank_transfer', expires_at: new Date(Date.now() + 60000).toISOString(), unit_id: id(3), currency: 'RON', amount: 10,
      selected_invoices: [{ invoice_id: id(4), original_amount: 10 }] });
  };
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(CustomerBillingDashboard, { lang })); await new Promise(r => setTimeout(r, 230)); });
  await act(async () => { await new Promise(r => setTimeout(r, 230)); });
}
function button(text, within = document) { const b = [...within.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.getAttribute('aria-label') === text); assert.ok(b, `missing button ${text}`); return b; }
async function click(b, twice = false) { await act(async () => { b.click(); if (twice) b.click(); }); await settle(); }
const posts = () => calls.filter(c => c.method === 'POST');
async function unmount() { await act(async () => root.unmount()); root = null; }
function billingResponse(value = invoice) { return json({ total: 1, invoices: [value], summary: [], aging: [], lines: [], journal: null, read_only: true, limit: 25, offset: 0 }); }
const correctionOnly = process.argv.includes('--review-correction');
const readFenceOnly = process.argv.includes('--read-fence-regressions');
const denialText = {
  en: { refresh: 'Refresh data', error: 'Billing data could not be securely loaded.' },
  ro: { refresh: 'Reîmprospătează datele', error: 'Datele de facturare nu au putut fi încărcate securizat.' },
  fa: { refresh: 'به‌روزرسانی اطلاعات', error: 'بارگذاری امن داده‌های مالی ناموفق بود.' },
};
async function readAgain(lang) {
  await click(button(denialText[lang].refresh));
  await act(async () => { await new Promise(r => setTimeout(r, 230)); });
}
function checkDenied(lang) {
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 0, 'current 401/403 removes invoice detail AND payment presentation');
  assert.equal(document.body.textContent.includes('A-01'), false, 'cached invoice data removed');
  assert.equal(document.body.textContent.includes('SYNTHETIC BANK DESTINATION'), false);
  assert.equal(document.body.textContent.includes('SYNTHETIC-REFERENCE'), false);
  assert.equal(document.querySelector('[data-payment-action]'), null, 'old payment affordance removed');
  assert.equal(document.querySelector('[role="status"]'), null, 'no stale settlement confirmation');
  assert.equal(document.querySelector('[role="alert"]')?.textContent.trim(), denialText[lang].error);
}
async function correctionRegressions(lang) {
  const t = texts[lang];
  for (const httpStatus of [401, 403]) {
    await mount(lang); await click(button('#701'));
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    billingHandler = () => json({ error: { code: 'FORBIDDEN' } }, httpStatus);
    await readAgain(lang); checkDenied(lang); assert.equal(posts().length, 0);
    scenarios++; await unmount();

    // Already visible instruction and invoice detail are both cleared. Reauthorization
    // resumes the SAME known intent, not another POST/key.
    await mount(lang); await click(button('#701')); await click(button(t.pay));
    const key = JSON.parse(posts()[0].body).idempotency_key;
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 2);
    billingHandler = () => json({}, httpStatus); await readAgain(lang); checkDenied(lang);
    billingHandler = null; await readAgain(lang); await click(button(t.pay));
    assert.equal(posts().length, 1); assert.equal(JSON.parse(posts()[0].body).idempotency_key, key);
    assert.match(document.querySelector('[role="dialog"]').textContent, /SYNTHETIC BANK DESTINATION/);
    scenarios++; await unmount();

    await mount(lang, 'instruction-hold'); await click(button(t.pay));
    assert.equal(calls.filter(c => c.url.includes('/bank-instruction?')).length, 1);
    billingHandler = () => json({}, httpStatus); await readAgain(lang); checkDenied(lang);
    instructionGate.resolve(); await settle(); checkDenied(lang);
    mode = 'ok'; billingHandler = null; await readAgain(lang); await click(button(t.pay));
    assert.equal(posts().length, 1, 'late instruction does not reset retained known attempt');
    scenarios++; await unmount();

    await mount(lang, 'unknown'); await click(button(t.pay));
    const unknownPayload = posts()[0].body;
    billingHandler = () => json({}, httpStatus); await readAgain(lang); checkDenied(lang);
    billingHandler = null; await readAgain(lang); await click(button(t.pay));
    assert.equal(posts().length, 1); assert.equal(posts()[0].body, unknownPayload);
    assert.ok(document.querySelector('[role="alert"]').textContent.includes(t.unknown));
    scenarios++; await unmount();

    await mount(lang, 'post-hold'); await click(button(t.pay));
    billingHandler = () => json({}, httpStatus); await readAgain(lang); checkDenied(lang);
    postGate.resolve(); await settle(); checkDenied(lang);
    assert.equal(calls.filter(c => c.url.includes('/bank-instruction?')).length, 0);
    mode = 'ok'; billingHandler = null; await readAgain(lang); await click(button(t.pay));
    assert.equal(posts().length, 1, 'late committed ID retained while its old presentation is fenced');
    assert.match(document.querySelector('[role="dialog"]').textContent, /SYNTHETIC BANK DESTINATION/);
    scenarios++; await unmount();
  }
  for (const denyWhileNewReadPending of [false, true]) {
    await mount(lang);
    const old = deferred(); const newer = deferred();
    billingHandler = () => old.promise;
    await readAgain(lang);
    select(12);
    const other = { ...makeInvoice(), id: id(14), invoice_no: 702, unit_code: 'B-02' };
    billingHandler = () => denyWhileNewReadPending ? newer.promise : billingResponse(other);
    await act(async () => root.render(React.createElement(CustomerBillingDashboard, { lang })));
    await act(async () => { await new Promise(r => setTimeout(r, 230)); });
    if (denyWhileNewReadPending) assert.equal(button(denialText[lang].refresh).disabled, true);
    else assert.ok(document.body.textContent.includes('B-02'));
    old.resolve(json({}, 403)); await settle();
    assert.equal(document.querySelector('[role="alert"]'), null, 'old denial cannot mark current selection denied');
    if (denyWhileNewReadPending) {
      assert.equal(button(denialText[lang].refresh).disabled, true, 'old finally cannot clear newer loading state');
      newer.resolve(billingResponse(other)); await settle();
    }
    assert.ok(document.body.textContent.includes('B-02'));
    assert.ok(document.querySelector('[data-payment-action]'));
    scenarios++; await unmount();
  }
  // Same Context, newer read generation: old denial cannot clear current detail.
  await mount(lang); const old = deferred(); billingHandler = () => old.promise; await readAgain(lang);
  billingHandler = null; await click(button('#701'));
  old.resolve(json({}, 401)); await settle();
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
  assert.ok(document.body.textContent.includes('A-01')); assert.equal(document.querySelector('[role="alert"]'), null);
  scenarios++; await unmount();

  // Same Context after a new Auth generation: old denial/finally cannot clear the new read.
  await mount(lang); const oldAuth = deferred(); billingHandler = () => oldAuth.promise; await readAgain(lang);
  billingHandler = null; userId = id(11);
  await act(async () => authListener('SIGNED_IN', { user: { id: userId } }));
  await act(async () => { await new Promise(r => setTimeout(r, 230)); });
  assert.ok(document.body.textContent.includes('A-01'));
  oldAuth.resolve(json({}, 403)); await settle();
  assert.equal(document.querySelector('[role="alert"]'), null); assert.ok(document.body.textContent.includes('A-01'));
  scenarios++; await unmount();
}

async function readFenceRegressions(lang) {
  // An older successful billing read must not restore a current authoritative denial.
  await mount(lang); const success = deferred(); billingHandler = () => success.promise; await readAgain(lang);
  billingHandler = () => json({}, 403); await click(button('#701')); checkDenied(lang);
  success.resolve(billingResponse()); await settle(); checkDenied(lang);
  scenarios++; await unmount();

  // Generic error/catch/finally from an older read must not affect a newer detail read.
  await mount(lang); const failure = deferred(); billingHandler = () => failure.promise; await readAgain(lang);
  billingHandler = null; await click(button('#701'));
  failure.resolve(json({}, 500)); await settle();
  assert.equal(document.querySelector('[role="alert"]'), null);
  assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
  assert.equal(button(denialText[lang].refresh).disabled, false);
  scenarios++; await unmount();

  // Selection identity is an epoch, not merely an A->B->A tuple string comparison.
  await mount(lang); const previousEpoch = deferred(); billingHandler = () => previousEpoch.promise; await readAgain(lang);
  select(12); await act(async () => root.render(React.createElement(CustomerBillingDashboard, { lang })));
  select(2); await act(async () => root.render(React.createElement(CustomerBillingDashboard, { lang })));
  previousEpoch.resolve(json({}, 401)); await settle();
  assert.equal(document.querySelector('[role="alert"]'), null, 'old A denial cannot act on the new A epoch');
  scenarios++; await unmount();
}

try {
  for (const lang of ['en', 'ro', 'fa']) {
    if (readFenceOnly) { await readFenceRegressions(lang); continue; }
    if (correctionOnly) { await correctionRegressions(lang); continue; }
    const t = texts[lang];
    await mount(lang, 'post-hold');
    await click(button(t.pay), true);
    assert.equal(posts().length, 1, 'double tap synchronously guarded');
    const payload = JSON.parse(posts()[0].body); assert.match(payload.idempotency_key, /^direct-[a-f0-9-]{36}$/);
    postGate.resolve(); await settle();
    let dialog = document.querySelector('[role="dialog"]'); assert.equal(dialog.getAttribute('dir'), lang === 'fa' ? 'rtl' : 'ltr');
    assert.equal(document.activeElement.getAttribute('aria-label'), t.close);
    assert.match(dialog.textContent, /SYNTHETIC BANK DESTINATION/);
    assert.equal(dialog.textContent.includes('private-debug'), false);
    assert.equal(document.querySelectorAll('pre').length, 0, 'RON must not invent EPC QR');
    assert.ok(calls.findIndex(c => /\/intents\/[^/]+\?/.test(c.url)) < calls.findIndex(c => c.url.includes('/bank-instruction?')));
    await click(button(t.card, dialog)); assert.ok(dialog.textContent.includes(lang === 'en' ? 'onboarding' : lang === 'ro' ? 'asocia' : 'کارت'));
    assert.equal(posts().length, 1, 'card tab never creates checkout');
    await act(async () => { dialog.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    assert.equal(document.querySelector('[role="dialog"]'), null);
    scenarios++; await unmount();
    await mount(lang, 'unknown'); await click(button(t.pay));
    assert.ok(document.querySelector('[role="alert"]').textContent.includes(t.unknown));
    await click(button(t.retry)); assert.equal(posts().length, 1); assert.equal(document.body.textContent.includes('SYNTHETIC BANK DESTINATION'), false);
    scenarios++; await unmount();
    await mount(lang, 'instruction-error'); await click(button(t.pay)); assert.equal(posts().length, 1);
    mode = 'ok'; await click(button(t.retry)); assert.equal(posts().length, 1); assert.match(document.querySelector('[role="dialog"]').textContent, /SYNTHETIC BANK DESTINATION/);
    scenarios++; await unmount();
    await mount(lang, 'instruction-error'); await click(button(t.pay));
    canonicalStatus = 'succeeded'; await click(button(t.retry));
    assert.ok(document.querySelector('[role="status"]')); assert.equal(posts().length, 1);
    assert.equal(document.body.textContent.includes('SYNTHETIC BANK DESTINATION'), false);
    scenarios++; await unmount();
    await mount(lang, 'instruction-hold'); await click(button(t.pay));
    select(12); await act(async () => root.render(React.createElement(CustomerBillingDashboard, { lang })));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    instructionGate.resolve(); await settle(); assert.equal(document.body.textContent.includes('SYNTHETIC BANK DESTINATION'), false);
    scenarios++; await unmount();
    await mount(lang, 'ok', null); await click(button(t.pay)); assert.equal(posts().length, 0);
    scenarios++; await unmount();
    await mount(lang, 'ok', '00000000-0000-0000-0000-000000000000');
    await click(button(t.pay)); assert.equal(posts().length, 0);
    scenarios++; await unmount();
    await mount(lang, 'unknown'); await click(button(t.pay));
    await click(button(t.close, document.querySelector('[role="dialog"]'))); await click(button(t.pay));
    assert.equal(posts().length, 1, 'closing/reopening retains unknown immutable attempt');
    scenarios++; await unmount();
    await mount(lang, 'post-hold'); await click(button(t.pay));
    select(12); await act(async () => root.render(React.createElement(CustomerBillingDashboard, { lang })));
    postGate.resolve(); await settle(); assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(calls.some(c => c.url.includes('/bank-instruction?')), false, 'stale UI selection cannot request old instruction');
    scenarios++; await unmount();
    for (const state of ['masked', 'setup']) {
      await mount(lang, state); await click(button(t.pay)); assert.ok(document.querySelector('[role="alert"]'));
      assert.equal(document.body.textContent.includes('private-debug'), false); assert.equal(document.body.textContent.includes('SYNTHETIC BANK DESTINATION'), false);
      scenarios++; await unmount();
    }
    await mount(lang); await click(button(t.pay));
    await act(async () => authListener('SIGNED_OUT', null)); assert.equal(document.querySelector('[role="dialog"]'), null);
    scenarios++; await unmount();
  }
} finally {
  if (root) await act(async () => root.unmount());
  dom.window.close();
  for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; }
}
console.log(JSON.stringify({ suite: readFenceOnly ? 'CORE-MOBILE-PAYMENT-ATTEMPT-01-read-fence' : correctionOnly ? 'CORE-MOBILE-PAYMENT-ATTEMPT-01-review-correction' : 'CORE-MOBILE-PAYMENT-ATTEMPT-01-mounted', result: 'PASS', scenarios, locales: 3,
  provenance: 'actual React component mounted in JSDOM; synthetic Auth/HTTP transport, NOT connected/browser/mobile device acceptance' }));
