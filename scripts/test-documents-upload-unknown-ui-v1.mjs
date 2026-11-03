import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import ts from 'typescript';

// Actual Dashboard + client ACK parser in ReactDOM/JSDOM. Controlled HTTP and
// identity boundary ONLY: these fixtures are not server/Core/scan/native proof.
const require = createRequire(import.meta.url);
const rootPath = fileURLToPath(new URL('../', import.meta.url));
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' });
const saved = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
  FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
const originalFetch = globalThis.fetch;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let actor = id(1), context, authCallback, calls = [], mode = 'valid', deferredIntent, deferredUpload, deferredList, deferredDownload;
const freshContext = () => ({ active: { context_id: id(2), membership_id: id(3) },
  dashboard: { contextId: id(2), workspace_id: id(4), permissions: ['documents.vault.upload'] } });
const client = { auth: {
  getUser: async () => ({ data: { user: { id: actor } }, error: null }),
  onAuthStateChange: callback => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
} };
const modules = new Map();
function load(path) {
  path = resolve(rootPath, path);
  if (modules.has(path)) return modules.get(path).exports;
  const mod = new Module(path); modules.set(path, mod);
  mod.require = specifier => {
    if (specifier === './CustomerContextProvider') return { useCustomerContext: () => context };
    if (specifier === '@/lib/supabase/client') return { createClient: () => client };
    if (specifier === '@/lib/customer/documents-upload-ui-contract-v1') return load('src/lib/customer/documents-upload-ui-contract-v1.ts');
    if (specifier === '@/lib/customer/documents-upload-snapshot-v1') return load('src/lib/customer/documents-upload-snapshot-v1.ts');
    return require(specifier);
  };
  mod._compile(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, path);
  return mod.exports;
}
const { CustomerDocumentsDashboard } = load('src/components/customer/CustomerDocumentsDashboard.tsx');
const contract = load('src/lib/customer/documents-upload-ui-contract-v1.ts');
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function gate() { let release; const promise = new Promise(r => { release = r; }); return { promise, release }; }
let lastIntent;
function intentAck(body) {
  return { contract_version: 'documents-upload-intent-ack.v1', context_id: body.context_id,
    workspace_id: context.dashboard.workspace_id, actor_id: actor, request_sha256: body.request_sha256,
    idempotency_key: body.idempotency_key, intent_id: id(5), prospective_document_id: id(6) };
}
function finalAck(form, intent = lastIntent) {
  return { contract_version: 'documents-upload-finalization-ack.v1', context_id: intent.context_id,
    workspace_id: intent.workspace_id, actor_id: intent.actor_id, request_sha256: intent.request_sha256,
    intent_id: intent.intent_id, status: mode === 'replay' ? 'exact_replay' : 'committed',
    document_id: id(6), document_version_id: id(7), receipt: {
      contract_version: 'core-transaction-receipt.v1', receipt_id: id(8), workspace_id: intent.workspace_id,
      actor_id: intent.actor_id, aggregate_type: 'documents.document', aggregate_id: id(6), aggregate_version: 1,
      mutation_id: id(7), idempotency_key: form.get('idempotency_key'), committed_at: '2026-11-03T00:00:00Z',
    } };
}
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).includes('/upload-properties')) return response({ properties: [] });
  if (String(url).endsWith('/upload-intent')) {
    const body = JSON.parse(options.body);
    lastIntent = intentAck(body);
    if (deferredIntent) return deferredIntent.promise;
    if (mode === 'lost-intent') throw new Error('PRIVATE RAW FAILURE');
    if (mode === 'maintenance') return response({ error: { code: 'CANONICAL_DOCUMENT_WRITER_UNAVAILABLE', message: 'PRIVATE RAW FAILURE' } }, 503);
    if (mode === 'intent-mismatch') return response({ ...lastIntent, workspace_id: id(99) });
    return response(lastIntent);
  }
  if (String(url).endsWith('/upload')) {
    if (deferredUpload) return deferredUpload.promise;
    if (mode === 'lost') throw new Error('PRIVATE RAW FAILURE');
    if (mode === 'json-lost') return { ok: true, status: 200, json: async () => { throw new Error('body lost'); } };
    if (mode === 'malformed') return response({ document_id: id(6), scan_status: 'clean', committed: true });
    if (mode === 'wrong-receipt') { const ack = finalAck(options.body); ack.receipt.idempotency_key = 'unrelated'; return response(ack); }
    return response(finalAck(options.body));
  }
  if (String(url).endsWith('/download') && deferredDownload) return deferredDownload.promise;
  if (String(url).endsWith('/download')) return response({ download_url: 'https://cladora.test/controlled-download' });
  if (deferredList) return deferredList.promise;
  return response({ rows: [], total: 0, read_only: true, storage_access: false, signed_urls: false });
};
const root = createRoot(document.getElementById('root'));
let caseId = 0;
const tick = () => new Promise(r => setTimeout(r, 0));
const render = async (lang = 'en', key = caseId) => act(async () => root.render(React.createElement(CustomerDocumentsDashboard, { key, lang })));
const text = () => document.body.textContent;
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
const phase = () => document.querySelector('form')?.dataset.uploadPhase;
const posts = () => calls.filter(c => c.options.method === 'POST');
async function start(lang = 'en') {
  caseId++; dom.window.sessionStorage.clear(); context = freshContext(); actor = id(1); mode = 'valid'; calls = []; deferredIntent = deferredUpload = deferredList = deferredDownload = null;
  await render(lang);
  await act(async () => button({ en: 'Upload Document', fa: 'بارگذاری سند جدید', ro: 'Încarcă un document' }[lang]).click());
  const input = document.querySelector('input[type=file]');
  await act(async () => {
    Object.defineProperty(input, 'files', { value: [new dom.window.File(['synthetic'], 'synthetic.txt', { type: 'text/plain' })], configurable: true });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}
async function submit(double = false) {
  await act(async () => {
    const form = document.querySelector('form');
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    if (double) form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
  });
  for (let n = 0; n < 100; n++) {
    if (['idle', 'UNKNOWN', 'NOT_READY', 'confirmed'].includes(phase())
      || (deferredIntent && posts().length >= 1) || (deferredUpload && posts().length >= 2)) return;
    await act(async () => new Promise(r => setTimeout(r, 5)));
  }
  throw new Error(`submit did not settle: ${phase()}`);
}
async function reopen() {
  await act(async () => button('Cancel').click());
  await act(async () => button('Upload Document').click());
}
const results = [];
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
async function check(name, body) { if (only && !name.includes(only)) return; await body(); results.push(name); console.log(`PASS ${name}`); }
try {
  if (!process.argv.includes('--only-download-fence')) {
  await check('same-tick double submit + immutable snapshot + valid ACK registration only', async () => {
    await start(); deferredIntent = gate(); await submit(true);
    assert.equal(posts().length, 1); assert.equal(phase(), 'intent');
    assert.equal(document.querySelector('fieldset').disabled, true);
    const request = JSON.parse(posts()[0].options.body);
    assert.equal(request.title, 'synthetic'); assert.ok(request.idempotency_key);
    await act(async () => { deferredIntent.release(response(lastIntent)); await tick(); });
    assert.equal(posts().length, 2); assert.equal(phase(), 'confirmed');
    const form = posts()[1].options.body;
    const metadata = { context_id: request.context_id, workspace_id: request.workspace_id, filename: request.filename, declared_mime: request.declared_mime,
      size_bytes: request.size_bytes, title: request.title, document_type: request.document_type,
      classification: request.classification, property_id: request.property_id };
    assert.equal(createHash('sha256').update(JSON.stringify(metadata)).digest('hex'), request.request_sha256);
    assert.equal(form.get('request_sha256'), request.request_sha256);
    assert.equal(form.get('intent_id'), lastIntent.intent_id);
    assert.ok(text().includes('does not confirm its contents'));
    await submit(); assert.equal(posts().length, 2);
  });
  for (const failure of ['lost', 'json-lost', 'malformed', 'wrong-receipt', 'lost-intent', 'intent-mismatch']) {
    await check(`${failure}: UNKNOWN retains attempt, no retry/reupload/new key on close/reopen`, async () => {
      await start(); mode = failure; await submit();
      assert.equal(phase(), 'UNKNOWN'); assert.ok(text().includes('Do not upload again'));
      const before = posts().length, first = posts()[0].options.body;
      assert.equal(document.querySelector('fieldset').disabled, true);
      await submit(true); await reopen(); await submit();
      assert.equal(phase(), 'UNKNOWN'); assert.equal(posts().length, before);
      assert.equal(posts()[0].options.body, first);
      assert.ok(!text().includes('PRIVATE RAW FAILURE'));
      assert.ok(!text().includes('File uploaded and registered.'));
    });
  }
  await check('known pre-write maintenance -> NOT_READY, no bytes sent; receipt cannot be inferred', async () => {
    await start(); mode = 'maintenance'; await submit();
    assert.equal(posts().length, 1); assert.equal(phase(), 'NOT_READY');
    assert.ok(text().includes('No file was sent')); await submit(); assert.equal(posts().length, 1);
  });
  for (const change of ['context', 'workspace', 'actor']) {
    await check(`${change} switch fences late ACK and never creates a replacement attempt`, async () => {
      await start(); deferredUpload = gate(); await submit();
      assert.equal(phase(), 'upload'); const ack = finalAck(posts()[1].options.body);
      await act(async () => {
        if (change === 'context') context = { ...freshContext(), active: { context_id: id(20), membership_id: id(21) }, dashboard: { ...context.dashboard, contextId: id(20) } };
        if (change === 'workspace') context = { ...context, dashboard: { ...context.dashboard, workspace_id: id(40) } };
        if (change === 'actor') { actor = id(10); authCallback('SIGNED_IN', { user: { id: actor } }); }
        root.render(React.createElement(CustomerDocumentsDashboard, { key: caseId, lang: 'en' }));
      });
      await act(async () => { deferredUpload.release(response(ack)); await tick(); });
      assert.equal(document.querySelector('form'), null);
      await act(async () => button('Upload Document').click());
      assert.equal(phase(), 'UNKNOWN'); assert.ok(text().includes('attempt is paused'));
      assert.equal(document.querySelector('input[type=text]').value, '');
      await submit(); assert.equal(posts().length, 2);
      assert.ok(!text().includes('File uploaded and registered.'));
    });
  }
  await check('strict ACK binding rejects independent fields, missing/extra/private fields and bare HTTP success', async () => {
    await start(); await submit(); const form = posts()[1].options.body;
    const good = finalAck(form);
    assert.equal(contract.matchesDocumentsUploadFinalizationAckV1(good, lastIntent, form.get('idempotency_key')), true);
    for (const field of ['context_id', 'workspace_id', 'actor_id', 'intent_id', 'document_id', 'document_version_id']) {
      const bad = structuredClone(good); bad[field] = id(99);
      assert.equal(contract.matchesDocumentsUploadFinalizationAckV1(bad, lastIntent, form.get('idempotency_key')), false, field);
    }
    for (const bad of [{ ...good, request_sha256: '0'.repeat(64) }, { ...good, object_path: 'private/path' },
      { ...good, receipt: null }, { ...good, status: 'unknown_commit' }, { ok: true }, null]) {
      assert.equal(contract.matchesDocumentsUploadFinalizationAckV1(bad, lastIntent, form.get('idempotency_key')), false);
    }
  });
  await check('exact-replay ACK is registration only; fresh command after UNKNOWN is unavailable', async () => {
    await start(); mode = 'replay'; await submit(); assert.equal(phase(), 'confirmed'); assert.equal(posts().length, 2);
  });
  for (const lang of ['fa', 'ro']) await check(`${lang} actionable UNKNOWN without raw exception`, async () => {
    await start(lang); mode = 'lost'; await submit(); assert.equal(phase(), 'UNKNOWN');
    assert.ok(text().includes(lang === 'fa' ? 'دوباره بارگذاری نکنید' : 'Nu încărca din nou'));
    assert.ok(!text().includes('PRIVATE RAW FAILURE'));
  });
  await check('late document list from former Workspace is not displayed', async () => {
    await start(); deferredList = gate();
    await act(async () => new Promise(r => setTimeout(r, 170)));
    context = { ...context, dashboard: { ...context.dashboard, workspace_id: id(50) } };
    await render();
    await act(async () => { deferredList.release(response({ rows: [{ id: id(51), title: 'PRIVATE-OLD-SCOPE' }], total: 1 })); await tick(); });
    assert.ok(!text().includes('PRIVATE-OLD-SCOPE'));
  });
  await check('UNKNOWN remount keeps dispatch blocked without persisting file, metadata, keys or receipt', async () => {
    await start(); mode = 'lost'; await submit();
    const recorded = posts().length;
    assert.equal(dom.window.sessionStorage.length, 1);
    assert.equal(dom.window.sessionStorage.getItem('cladora.documents-upload-unresolved.v1'), 'pending');
    caseId++; await render();
    await act(async () => button('Upload Document').click());
    assert.equal(phase(), 'UNKNOWN'); await submit(); assert.equal(posts().length, recorded);
    assert.equal(document.querySelector('input[type=text]').value, '');
  });
  await check('receipt body wait shows finalization, not success; missing receipt becomes UNKNOWN', async () => {
    await start(); const bodyGate = gate(); deferredUpload = gate(); await submit();
    await act(async () => { deferredUpload.release({ ok: true, status: 200, json: () => bodyGate.promise }); await tick(); });
    assert.equal(phase(), 'finalization'); assert.ok(!text().includes('File uploaded and registered.'));
    await act(async () => { bodyGate.release({ committed: true }); await tick(); });
    assert.equal(phase(), 'UNKNOWN'); assert.equal(posts().length, 2);
  });
  await check('missing Workspace or session cannot dispatch; existing accepted read/download remains usable', async () => {
    await start(); context = { ...context, dashboard: { ...context.dashboard, workspace_id: undefined } };
    await render(); await act(async () => button('Upload Document').click()); await submit(); assert.equal(posts().length, 0);
    await start();
    const old = client.auth.getUser;
    client.auth.getUser = async () => ({ data: { user: null }, error: 'synthetic' });
    try { await submit(); assert.equal(posts().length, 0); assert.equal(phase(), 'idle'); }
    finally { client.auth.getUser = old; }
    deferredList = gate();
    await act(async () => new Promise(r => setTimeout(r, 170)));
    await act(async () => {
      deferredList.release(response({ rows: [{ id: id(60), title: 'AUTHORIZED-READ', scanning_status: 'clean' }], total: 1 })); await tick();
    });
    await act(async () => button('Cancel').click());
    assert.ok(text().includes('AUTHORIZED-READ'));
    const opened = []; const originalOpen = window.open; window.open = (...args) => { opened.push(args); };
    try {
      await act(async () => document.querySelector('button[title="Request download"]').click());
      assert.equal(opened.length, 1); assert.equal(opened[0][0], 'https://cladora.test/controlled-download');
    } finally { window.open = originalOpen; }
  });
  }
  await check('late authorized download response after Workspace change does not open URL', async () => {
    await start(); deferredList = gate();
    await act(async () => new Promise(r => setTimeout(r, 170)));
    await act(async () => { deferredList.release(response({ rows: [{ id: id(60), title: 'AUTHORIZED-READ' }], total: 1 })); await tick(); });
    await act(async () => button('Cancel').click());
    deferredDownload = gate(); const opened = []; const originalOpen = window.open;
    window.open = (...args) => { opened.push(args); };
    try {
      await act(async () => document.querySelector('button[title="Request download"]').click());
      context = { ...context, dashboard: { ...context.dashboard, workspace_id: id(90) } }; await render();
      await act(async () => { deferredDownload.release(response({ download_url: 'https://cladora.test/old-private' })); await tick(); });
      assert.equal(opened.length, 0);
    } finally { window.open = originalOpen; }
  });
  // No file bytes, credentials, metadata, identities, keys or raw receipts persist.
  assert.equal(dom.window.localStorage.length, 0);
  for (let i = 0; i < dom.window.sessionStorage.length; i++) {
    assert.equal(dom.window.sessionStorage.key(i), 'cladora.documents-upload-unresolved.v1');
    assert.equal(dom.window.sessionStorage.getItem(dom.window.sessionStorage.key(i)), 'pending');
  }
  for (const path of ['upload-intent/route.ts', 'upload/route.ts', '[id]/download/route.ts']) {
    const relative = `src/app/api/customer/v1/documents/${path}`;
    const { execFileSync } = require('node:child_process');
    const before = execFileSync('git', ['show', `e38b0d39dbb840a508b5e1d47e9d93d3060c6411:${relative}`], { cwd: rootPath });
    assert.equal(readFileSync(resolve(rootPath, relative)).equals(before), true, 'maintenance route unchanged');
  }
  console.log(`PASS ${results.length} targeted mounted/contract groups; controlled HTTP/Auth only; native NOT_RUN_NOT_PASS`);
} finally {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
  for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  dom.window.close();
}
