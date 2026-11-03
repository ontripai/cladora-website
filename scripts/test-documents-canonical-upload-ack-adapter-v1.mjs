import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { createDocumentsUploadAckSqlModelV1 } from './lib/documents-upload-ack-sql-model-v1.mjs';

// Actual UI -> adapter -> functional commands/builders/providers -> actual Core
// host + canonical authority provider. Only Auth/Storage/SQL transport is modeled.
// No caller/mock host receipt generator, live SQL, native permission or scan proof.
const require = createRequire(import.meta.url), cache = new Map();
const rootPath = fileURLToPath(new URL('../', import.meta.url));
let browserContext, browserAuth;
function load(path) {
  path = resolve(rootPath, path);
  if (cache.has(path)) return cache.get(path).exports;
  const mod = new Module(path); cache.set(path, mod);
  mod.require = specifier => {
    if (specifier === 'server-only') return {}; // Node-only test runner, not a browser import.
    if (specifier === './CustomerContextProvider') return { useCustomerContext: () => browserContext };
    if (specifier === '@/lib/supabase/client') return { createClient: () => browserAuth };
    if (specifier.startsWith('@/')) return load(`src/${specifier.slice(2)}.ts`);
    if (specifier.startsWith('.')) return load(resolve(path, '..', specifier.endsWith('.ts') ? specifier : `${specifier}.ts`));
    return require(specifier);
  };
  mod._compile(ts.transpileModule(readFileSync(path, 'utf8'), { fileName: path, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, path);
  return mod.exports;
}
const core = load('src/lib/core/postgres-transaction-host-v1.ts');
const api = load('src/lib/customer/documents-canonical-upload-ack-adapter-v1.ts');
const snap = load('src/lib/customer/documents-upload-snapshot-v1.ts');
const ui = load('src/lib/customer/documents-upload-ui-contract-v1.ts');
const id = n => `93000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = { actor: id(1), context: id(2), workspace: id(3), tenant: id(4), intent: id(5), document: id(6), version: id(7), object: id(8), module: id(9), outbox: id(10), other: id(99) };
const bytes = Buffer.from('synthetic');
const sha = value => createHash('sha256').update(value).digest('hex');
const initialSnapshot = { context_id: ids.context, workspace_id: ids.workspace, filename: 'synthetic.txt',
  declared_mime: 'text/plain', size_bytes: bytes.length, title: 'synthetic', document_type: 'general', classification: 'internal', property_id: null };
function fixture() {
  const db = createDocumentsUploadAckSqlModelV1(ids);
  const state = { actor: ids.actor, session: id(11), exp: Math.floor(Date.now() / 1000) + 3600, aal: 'aal2',
    authError: false, verifyUnavailable: false, nonOverwritable: true, generation: 'generation-1', verifyCalls: 0, onVerify: null };
  const sessionClient = { auth: {
    async getUser() { return { error: state.authError ? Error('private') : null, data: { user: { id: state.actor } } }; },
    async getClaims() { return { error: null, data: { claims: { sub: state.actor, session_id: state.session, exp: state.exp, aal: state.aal } } }; },
  } };
  const intentPlan = { snapshot: { ...initialSnapshot }, input: { contract_version: 'documents-new-document-intent.v1', context_id: ids.context, workspace_id: ids.workspace,
    intent_id: ids.intent, prospective_document_id: ids.document, filename: 'synthetic.txt', object_path: `${ids.tenant}/${ids.intent}/v1.txt`,
    declared_mime_type: 'text/plain', max_size_bytes: bytes.length, expires_at: new Date(Date.now() + 300000).toISOString(), idempotency_key: 'docs13-intent-key' },
    context: { transaction_id: id(12), command_id: id(13), authority_version: 7 } };
  const finalPlan = { input: { contract_version: 'documents-initial-version.v1', context_id: ids.context, workspace_id: ids.workspace,
    intent_id: ids.intent, document_id: ids.document, version_id: ids.version, title: 'synthetic', document_type: 'general', classification: 'internal', idempotency_key: 'docs13-final-key' },
    context: { transaction_id: id(14), command_id: id(15), authority_version: 7 } };
  const adapter = api.createDocumentsCanonicalUploadAckAdapterV1({ host: core.createCorePostgresTransactionHostV1(db.pool), sessionClient,
    async verifyStoredObject(target) {
      state.verifyCalls++;
      if (state.onVerify) await state.onVerify();
      if (state.verifyUnavailable) throw Error('private provider unavailable');
      return { ...target, storage_object_id: ids.object, generation_capability: 'exposed', storage_generation: state.generation,
        etag_capability: 'exposed', storage_etag: 'etag-1', sha256: sha(bytes), size_bytes: bytes.length,
        detected_mime_type: 'text/plain', non_overwritable: state.nonOverwritable };
    } });
  const request = extra => {
    const snapshot = { ...initialSnapshot, ...extra };
    return { ...snapshot, idempotency_key: intentPlan.input.idempotency_key, request_sha256: sha(snap.serializeDocumentsUploadSnapshotV1(snapshot)) };
  };
  const finalRequest = extra => ({ ...request(), intent_id: ids.intent, idempotency_key: finalPlan.input.idempotency_key, ...extra });
  return { db, state, adapter, intentPlan, finalPlan, request, finalRequest };
}
let passed = 0;
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
async function check(name, fn) { if (only && !name.includes(only)) return; await fn(); passed++; console.log(`PASS ${name}`); }
async function issued(f) {
  const result = await f.adapter.issue(f.request(), f.intentPlan);
  assert.equal(result.status, 'ACK', JSON.stringify({ result, tail: f.db.calls.slice(-5) })); assert.ok('finalize' in result); return result;
}
await check('real existing host emits issue/finalize receipts and bounded schema-compatible ACKs; scan stays deferred', async () => {
  const f = fixture(), ticket = await issued(f);
  assert.equal(ui.documentsUploadIntentAckV1Schema.safeParse(ticket.ack).success, true);
  const final = await ticket.finalize(f.finalRequest(), f.finalPlan);
  assert.equal(final.status, 'ACK');
  assert.equal(ui.matchesDocumentsUploadFinalizationAckV1(final.ack, ticket.ack, f.finalPlan.input.idempotency_key), true);
  const state = f.db.read(), receipt = state.keys.get(`core-tx.v1:${ids.workspace}:${f.finalPlan.input.idempotency_key}`).response_ref;
  assert.equal(final.ack.receipt.receipt_id, receipt.receipt_id);
  assert.equal(final.ack.document_version_id, receipt.mutation_id);
  assert.equal(receipt.command_id, f.finalPlan.context.command_id);
  assert.match(receipt.input_fingerprint, /^docwf1:/);
  assert.equal(state.versions.get(ids.version).scan, 'deferred');
  assert.doesNotMatch(JSON.stringify(final.ack), /object_path|storage_|audit_|outbox_|authority|fingerprint|clean|download/);
  assert.deepEqual(f.db.counts(), [1, 1, 1, 2, 2, 2, 1]);
});
await check('strict caller actor/receipt/result/committed injection and correlation/scope/ID mismatch have no modeled durable delta', async () => {
  for (const extra of [{ receipt: {} }, { result: { status: 'committed' } }, { committed: true }, { actor_id: ids.other },
    { request_sha256: '0'.repeat(64) }, { workspace_id: ids.other }, { context_id: ids.other }]) {
    const f = fixture(), result = await f.adapter.issue({ ...f.request(), ...extra }, f.intentPlan);
    assert.equal(result.status, 'DENIED'); assert.deepEqual(f.db.counts(), [0, 0, 0, 0, 0, 0, 0]);
  }
  const f = fixture(), ticket = await issued(f), before = f.db.counts();
  for (const extra of [{ receipt: {} }, { committed: true }, { intent_id: ids.other }, { title: 'changed' }, { workspace_id: ids.other }]) {
    const result = await ticket.finalize(f.finalRequest(extra), f.finalPlan);
    assert.equal(result.status, 'DENIED'); assert.deepEqual(f.db.counts(), before);
  }
});
await check('shared serializer ignores object key insertion order, preserves bytes and requires explicit Workspace; unsupported property is not dropped', async () => {
  const f = fixture(), s = initialSnapshot;
  assert.equal(snap.serializeDocumentsUploadSnapshotV1(Object.fromEntries(Object.entries(s).reverse())), snap.serializeDocumentsUploadSnapshotV1(s));
  assert.throws(() => snap.serializeDocumentsUploadSnapshotV1({ ...s, workspace_id: undefined }));
  assert.equal((await f.adapter.issue(f.request({ property_id: ids.other }), f.intentPlan)).status, 'DENIED');
  assert.deepEqual(f.db.counts(), [0, 0, 0, 0, 0, 0, 0]);
});
await check('canonical provider rejects revoked authority, stale revision, DB actor mismatch and non-AAL2; server session is mandatory', async () => {
  for (const alter of [f => { f.db.control.revoked = true; }, f => { f.db.control.allowed = false; },
    f => { f.db.control.revision = 8; }, f => { f.db.control.actor = ids.other; }, f => { f.db.control.aal = 'aal1'; },
    f => { f.state.authError = true; }, f => { f.state.aal = 'aal1'; }, f => { f.state.exp = 1; }]) {
    const f = fixture(); alter(f); const result = await f.adapter.issue(f.request(), f.intentPlan);
    assert.notEqual(result.status, 'ACK'); assert.deepEqual(f.db.counts(), [0, 0, 0, 0, 0, 0, 0]);
  }
});
await check('unknown COMMIT does not ACK, retry automatically or return a finalization closure', async () => {
  const f = fixture(); f.db.control.commitLoss = true;
  const result = await f.adapter.issue(f.request(), f.intentPlan);
  assert.equal(result.status, 'UNKNOWN'); assert.equal(result.ack, null); assert.equal('finalize' in result, false);
  assert.equal(f.db.calls.filter(c => c.text === 'begin isolation level serializable').length, 1);
  assert.equal(f.db.counts()[0], 1, 'ACK loss can leave a committed intent; do NOT call this zero-write');
  const g = fixture(), ticket = await issued(g); g.db.control.commitLoss = true;
  const final = await ticket.finalize(g.finalRequest(), g.finalPlan); assert.equal(final.status, 'UNKNOWN');
  assert.equal(g.db.counts()[1], 1, 'unknown finalization can have durable model effects; only authorized same-command recovery may resolve');
  const changed = structuredClone(g.finalPlan); changed.input.idempotency_key = 'a-new-key';
  assert.equal((await ticket.finalize(g.finalRequest({ idempotency_key: 'a-new-key' }), changed)).status, 'DENIED');
});
await check('unavailable/measurement-only verifier, changed session/expiry after wait and revoke before host all suppress ACK', async () => {
  for (const alter of [f => { f.state.verifyUnavailable = true; }, f => { f.state.nonOverwritable = false; },
    f => { f.state.onVerify = async () => { f.state.session = ids.other; }; },
    f => { f.state.onVerify = async () => { f.state.exp = 1; }; },
    f => { f.state.onVerify = async () => { f.db.control.revoked = true; }; },
    f => { f.state.onVerify = async () => { f.db.control.providerExpired = true; }; }]) {
    const f = fixture(), ticket = await issued(f), before = f.db.counts(); alter(f);
    const result = await ticket.finalize(f.finalRequest(), f.finalPlan);
    assert.notEqual(result.status, 'ACK'); assert.equal(result.ack, null); assert.deepEqual(f.db.counts(), before);
  }
});
await check('actual host exact replay has no duplicate modeled effects; retained finalization fingerprint cannot drift', async () => {
  const f = fixture(), ticket = await issued(f);
  assert.equal((await ticket.finalize(f.finalRequest(), f.finalPlan)).status, 'ACK');
  const before = f.db.counts(), replay = await ticket.finalize(f.finalRequest(), f.finalPlan);
  assert.equal(replay.status, 'ACK'); assert.equal(replay.ack.status, 'exact_replay'); assert.deepEqual(f.db.counts(), before);
  f.state.generation = 'changed-generation';
  assert.equal((await ticket.finalize(f.finalRequest(), f.finalPlan)).status, 'UNKNOWN'); assert.deepEqual(f.db.counts(), before);
});
await check('wrong actual mutation return and independent server-plan ID mismatch cannot project success', async () => {
  const f = fixture(); f.db.control.wrongMutation = true;
  assert.equal((await f.adapter.issue(f.request(), f.intentPlan)).status, 'UNKNOWN');
  const g = fixture(), ticket = await issued(g), before = g.db.counts();
  for (const field of ['document_id', 'intent_id', 'workspace_id']) {
    const plan = structuredClone(g.finalPlan); plan.input[field] = ids.other;
    assert.equal((await ticket.finalize(g.finalRequest(), plan)).status, 'DENIED'); assert.deepEqual(g.db.counts(), before);
  }
  g.db.control.wrongMutation = true;
  assert.equal((await ticket.finalize(g.finalRequest(), g.finalPlan)).status, 'UNKNOWN');
});
await check('only existing host retries controlled40001 with the same command/key/fingerprint', async () => {
  const f = fixture(); f.db.control.retry40001 = true;
  await issued(f); assert.equal(f.db.calls.filter(c => c.text === 'begin isolation level serializable').length, 2);
  assert.deepEqual(f.db.counts(), [1, 0, 0, 1, 1, 1, 0]);
});

await check('added exact-scope reconciliation with recomputed caller hash, unavailable intent expiry after external wait', async () => {
  for (const extra of [{ workspace_id: ids.other }, { context_id: ids.other }, { filename: 'different.txt' }, { size_bytes: 99 }, { title: 'different', classification: 'public' }]) {
    const f = fixture(); assert.equal((await f.adapter.issue(f.request(extra), f.intentPlan)).status, 'DENIED');
    assert.deepEqual(f.db.counts(), [0, 0, 0, 0, 0, 0, 0]);
  }
  const f = fixture(); f.intentPlan.input.workspace_id = ids.other; f.intentPlan.snapshot.workspace_id = ids.other;
  assert.equal((await f.adapter.issue(f.request({ workspace_id: ids.other }), f.intentPlan)).status, 'DENIED');
  assert.deepEqual(f.db.counts(), [0, 0, 0, 0, 0, 0, 0]);
  const g = fixture(), ticket = await issued(g), before = g.db.counts(), originalNow = Date.now;
  g.state.onVerify = async () => { Date.now = () => originalNow() + 360000; };
  try { assert.equal((await ticket.finalize(g.finalRequest(), g.finalPlan)).status, 'UNKNOWN'); assert.deepEqual(g.db.counts(), before); }
  finally { Date.now = originalNow; }
});
await check('added concurrent finalization and changed server key/command/version never mint another attempt', async () => {
  const f = fixture(), ticket = await issued(f); let release;
  const hold = new Promise(r => { release = r; }); f.state.onVerify = async () => hold;
  const first = ticket.finalize(f.finalRequest(), f.finalPlan);
  assert.equal((await ticket.finalize(f.finalRequest(), f.finalPlan)).status, 'UNKNOWN');
  release(); assert.equal((await first).status, 'ACK');
  const before = f.db.counts();
  for (const mutate of [p => { p.context.command_id = ids.other; }, p => { p.input.version_id = ids.other; },
    p => { p.input.idempotency_key = 'another-key'; }]) {
    const plan = structuredClone(f.finalPlan); mutate(plan);
    const result = await ticket.finalize(f.finalRequest({ idempotency_key: plan.input.idempotency_key }), plan);
    assert.equal(result.status, 'DENIED'); assert.deepEqual(f.db.counts(), before);
  }
});

await check('mounted UI -> private adapter -> actual Core host at modeled SQL boundary; no caller receipt', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' }), saved = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const oldFetch = globalThis.fetch, f = fixture(); let ticket, posts = 0;
  browserContext = { active: { context_id: ids.context, membership_id: id(20) }, dashboard: { contextId: ids.context, workspace_id: ids.workspace, permissions: ['documents.vault.upload'] } };
  browserAuth = { auth: { getUser: async () => ({ data: { user: { id: ids.actor } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
  const answer = value => ({ ok: value.status === 'ACK', status: value.status === 'ACK' ? 200 : 409, json: async () => value.ack ?? { status: value.status } });
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/upload-properties')) return { ok: true, json: async () => ({ properties: [] }) };
    if (String(url).endsWith('/upload-intent')) {
      posts++; const raw = JSON.parse(options.body);
      // This is a synthetic trusted server plan producer, not browser evidence.
      f.intentPlan.input.idempotency_key = raw.idempotency_key;
      ticket = await f.adapter.issue(raw, f.intentPlan); return answer(ticket);
    }
    if (String(url).endsWith('/upload')) {
      posts++; const raw = Object.fromEntries([...options.body.entries()].filter(([key]) => key !== 'file'));
      raw.size_bytes = Number(raw.size_bytes); raw.property_id = JSON.parse(raw.property_id);
      f.finalPlan.input.idempotency_key = raw.idempotency_key;
      return answer(await ticket.finalize(raw, f.finalPlan));
    }
    return { ok: true, json: async () => ({ rows: [], total: 0 }) };
  };
  const { CustomerDocumentsDashboard } = load('src/components/customer/CustomerDocumentsDashboard.tsx');
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(CustomerDocumentsDashboard, { lang: 'en' })));
    const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
    await act(async () => button('Upload Document').click());
    await act(async () => {
      const input = document.querySelector('input[type=file]');
      Object.defineProperty(input, 'files', { value: [new dom.window.File([bytes], 'synthetic.txt', { type: 'text/plain' })] });
      input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      const form = document.querySelector('form');
      // Change state commits before submit, just as file selection precedes click.
      assert.ok(form);
    });
    await act(async () => document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    for (let i = 0; i < 100 && document.querySelector('form')?.dataset.uploadPhase !== 'confirmed'; i++) {
      await act(async () => new Promise(r => setTimeout(r, 5)));
    }
    assert.equal(document.querySelector('form').dataset.uploadPhase, 'confirmed');
    assert.equal(posts, 2); assert.deepEqual(f.db.counts(), [1, 1, 1, 2, 2, 2, 1]);
    assert.equal(f.db.read().versions.get(ids.version).scan, 'deferred');
  } finally {
    await act(async () => root.unmount()); globalThis.fetch = oldFetch;
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    dom.window.close();
  }
});
console.log(`PASS ${passed} adapter/coupling groups; modeled SQL/Auth/Storage only; native NOT_RUN_NOT_PASS`);
