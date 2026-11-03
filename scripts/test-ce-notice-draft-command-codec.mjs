// Pure offline tests. No mounted UI, provider/DB/HTTP, storage globals or runtime.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { webcrypto, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.indexOf('--dependencies');
const require = createRequire(path.join(arg < 0 ? root : process.argv[arg + 1], 'package.json'));
const ts = require('typescript');
const schemaPath = 'src/lib/customer/communications-schema.ts';
const codecPath = 'src/lib/customer/notice-draft-command.ts';
function load(relative, mocks = {}) {
  const filename = path.join(root, relative), source = readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  assert.deepEqual(result.diagnostics, []);
  const m = new Module(filename); m.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  m._compile(result.outputText, filename); return m.exports;
}
const schema = load(schemaPath);
const saved = new Map();
for (const name of ['localStorage', 'sessionStorage', 'fetch']) {
  saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('FORBIDDEN_GLOBAL_IO'); } });
}
let c;
try { c = load(codecPath, { './communications-schema': schema }); }
finally { for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } }
const id = n => `22900000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = () => ({ tenant_id: id(1), principal_id: id(2), context_id: id(3), membership_id: id(4), workspace_id: id(5), target: { kind: 'unit', id: id(6) } });
const payload = () => ({ context_id: id(3), title_ro: 'Title', body_ro: 'Body' });
const key = id(7), key2 = id(8), purpose = c.NOTICE_DRAFT_COMMAND;
const make = (s = scope(), k = key, p = payload(), crypto = webcrypto.subtle) => c.prepareNoticeDraftIntent(s, k, p, crypto);
const hash = value => createHash('sha256').update(value).digest('hex');
const absent = intent => ({ v: 1, purpose, scope: intent.scope, key: intent.key, state: 'absent_at_check' });
const receipt = intent => ({ v: 1, purpose, scope: intent.scope, key: intent.key, request_hash: intent.request_hash,
  receipt_id: id(10), notice_id: id(11), success: true, status: 'draft', created_at: '2026-10-23T11:00:00+03:30' });
const committed = intent => ({ state: 'committed', receipt: receipt(intent) });
class Storage {
  data = new Map(); writes = 0; mode = '';
  getItem(k) { if (this.mode === 'read' || (this.mode === 'after-write' && this.writes)) throw new Error('PRIVATE_STORAGE_FAILURE'); return this.data.get(k) ?? null; }
  setItem(k, v) { this.writes++; if (this.mode === 'write') throw new Error('PRIVATE_WRITE_FAILURE'); if (this.mode === 'silent') return; this.data.set(k, this.mode === 'corrupt-write' ? v + 'x' : v); }
}
const pending = (s = new Storage(), binding = scope(), crypto = webcrypto.subtle) => c.createNoticeDraftPending(s, binding, crypto);
const block = result => assert.equal(result.state, 'blocked');
const cases = [], vectors = [];
async function test(name, run) { await run(); cases.push(name); }
// Independently computed with Python hashlib + literal SPEC tuples, without TS
// imports. These constants pin cross-language bytes, not just self-consistency.
const golden = [
  ['defaults', {}, 653, 'e21ebd15a50a72ead615dcaffa491297bed46c9e37c6a00f24ef28c209bba135'],
  ['unicode', { title_ro: 'Ședință', body_ro: 'پیام 😀', title_en: 'A:;N;', title_fa: 'ا\u0654' }, 682, '2adb86eb491fe92decb7642e15356d85abcbedf7c5aedc336322469babae84e5'],
  ['explicit_empty', { title_en: '' }, 655, 'd5c4e462a3124b0a39c679a6dfa3357dfec2e6b3dd35fc96bd24fc6bdb03eb22'],
  ['composed', { title_ro: 'é' }, 650, '079b193d2903687e7dae6d8a3e76332d4ca240c18e6d1b2ff5dfe1a804c30111'],
  ['decomposed', { title_ro: 'e\u0301' }, 651, '72b3c63d5277067698473e29e718090794313919afe9e7fc5aee1b51c1460a48'],
];
for (const [name, change, bytes, expected] of golden) await test(`independent golden ${name}`, async () => {
  const p = { ...payload(), ...change }, canonical = c.canonicalNoticeDraft(scope(), p), intent = await make(scope(), key, p);
  assert.equal(Buffer.byteLength(canonical), bytes); assert.equal(hash(canonical), expected); assert.equal(intent.request_hash, expected);
  vectors.push({ name, bytes, sha256: expected });
});
await test('omission/undefined/default/order equivalence; empty distinct; null rejected', async () => {
  const original = await make();
  const shuffled = { source_module: 'general', body_ro: ' Body ', communication_type: 'general_announcement', title_ro: ' Title ', legal_classification: 'informational_optional', context_id: id(3), title_en: undefined };
  assert.equal((await make(scope(), key2, shuffled)).request_hash, original.request_hash, 'key excluded');
  assert.notEqual((await make(scope(), key, { ...payload(), title_en: '' })).request_hash, original.request_hash);
  assert.equal((await make(scope(), key, { ...payload(), title_en: '   ' })).payload.title_en, '', 'actual schema trims, never silently omits explicit empty string');
  await assert.rejects(make(scope(), key, { ...payload(), title_en: null }), /INVALID_PAYLOAD/);
});
await test('actual schema strict subset; unknown effect fields and invalid enum rejected', async () => {
  for (const extra of [{ token: 'PRIVATE' }, { template_params: {} }, { idempotency_key: key }, { source_entity_id: id(12) }]) await assert.rejects(make(scope(), key, { ...payload(), ...extra }), /INVALID_PAYLOAD/);
  for (const k of ['communication_type', 'legal_classification', 'source_module']) {
    for (const option of schema.createNoticeDraftSchema.shape[k].removeDefault().options) {
      const p = { ...payload(), [k]: option }; assert.equal(schema.createNoticeDraftSchema.safeParse(p).success, true);
      assert.equal((await make(scope(), key, p)).payload[k], option);
    }
    await assert.rejects(make(scope(), key, { ...payload(), [k]: 'invented' }), /INVALID_PAYLOAD/);
  }
});
await test('actual trimmed UTF16 limits, required values and UTF8 supplementary encoding', async () => {
  for (const [field, max] of [['title_ro', 250], ['title_en', 250], ['title_fa', 250], ['body_ro', 20000], ['body_en', 20000], ['body_fa', 20000]]) {
    const valid = { ...payload(), [field]: ` ${'x'.repeat(max)} ` };
    assert.equal((await make(scope(), key, valid)).payload[field].length, max);
    assert.equal(schema.createNoticeDraftSchema.safeParse({ ...payload(), [field]: 'x'.repeat(max + 1) }).success, false);
    await assert.rejects(make(scope(), key, { ...payload(), [field]: 'x'.repeat(max + 1) }), /INVALID_PAYLOAD/);
  }
  for (const field of ['title_ro', 'body_ro']) for (const value of ['', '   ']) await assert.rejects(make(scope(), key, { ...payload(), [field]: value }), /INVALID_PAYLOAD/);
  assert.equal((await make(scope(), key, { ...payload(), title_ro: '😀'.repeat(125) })).payload.title_ro.length, 250);
  await assert.rejects(make(scope(), key, { ...payload(), title_ro: '😀'.repeat(126) }), /INVALID_PAYLOAD/);
  for (const value of ['\ud800', '\udfff', 'x\ud800y']) await assert.rejects(make(scope(), key, { ...payload(), body_ro: value }), /INVALID_TEXT/);
});
// Independent boundary oracles: one supplementary character occupies TWO
// UTF-16 units, combining marks remain distinct, trim changes only the edges.
const utf16Cases = maximum => [
  ['ASCII', 'x'.repeat(maximum)],
  ['emoji', '😀'.repeat(maximum / 2)],
  ['mixed', 'a'.repeat(maximum - 2) + '😀'],
  ['combining', 'e\u0301'.repeat(maximum / 2)],
];
for (const [field, maximum] of [['title_ro', 250], ['title_en', 250], ['title_fa', 250], ['body_ro', 20000], ['body_en', 20000], ['body_fa', 20000]]) await test(`UTF16 ${field}: ASCII/emoji/mixed/combining exact and +1 after trim`, async () => {
  for (const [kind, exact] of utf16Cases(maximum)) for (const padded of [false, true]) {
    assert.equal(exact.length, maximum, `${field}/${kind}: independent UTF16 oracle`);
    const wrap = value => padded ? ` \t\u00a0${value}\r\n\u2003` : value;
    const valid = { ...payload(), [field]: wrap(exact) };
    const parsed = schema.createNoticeDraftSchema.parse(valid);
    assert.equal(parsed[field], exact);
    const intent = await make(scope(), key, valid);
    assert.equal(intent.payload[field], exact);
    assert.equal(intent.request_hash, hash(c.canonicalNoticeDraft(scope(), valid)));
    const over = exact + 'x'; assert.equal(over.length, maximum + 1);
    const invalid = { ...payload(), [field]: wrap(over) };
    assert.equal(schema.createNoticeDraftSchema.safeParse(invalid).success, false);
    assert.throws(() => c.canonicalNoticeDraft(scope(), invalid), /INVALID_PAYLOAD/);
    await assert.rejects(make(scope(), key, invalid), /INVALID_PAYLOAD/);
  }
  if (field.startsWith('title_')) await assert.rejects(make(scope(), key, { ...payload(), [field]: '😀'.repeat(126) }), /INVALID_PAYLOAD/);
  else await assert.rejects(make(scope(), key, { ...payload(), [field]: '😀'.repeat(10001) }), /INVALID_PAYLOAD/);
});
// Same trimmed-string family in the allowed schema file: restore the old unit,
// not a new limit or a code-point exception for cancellation/evidence notes.
const relatedUtf16 = [
  ['draft idempotency_key', schema.createNoticeDraftSchema, payload(), 'idempotency_key', 100],
  ['cancel reason', schema.cancelNoticeSchema, { context_id: id(3) }, 'reason', 1000],
  ['ack checksum', schema.acknowledgeNoticeSchema, { context_id: id(3) }, 'checksum', 128],
  ['ack notes', schema.acknowledgeNoticeSchema, { context_id: id(3) }, 'notes', 500],
  ['evidence reference', schema.recordStatutoryEvidenceSchema, { context_id: id(3), evidence_type: 'noticeboard_posting' }, 'evidence_reference', 250],
  ['evidence checksum', schema.recordStatutoryEvidenceSchema, { context_id: id(3), evidence_type: 'noticeboard_posting', evidence_reference: 'Synthetic' }, 'checksum', 128],
  ['evidence notes', schema.recordStatutoryEvidenceSchema, { context_id: id(3), evidence_type: 'noticeboard_posting', evidence_reference: 'Synthetic' }, 'notes', 1000],
  ['evidence rejection_reason', schema.verifyStatutoryEvidenceSchema, { context_id: id(3), decision: 'rejected' }, 'rejection_reason', 1000],
];
for (const [name, definition, base, field, maximum] of relatedUtf16) await test(`UTF16 related ${name}: same exact/+1 and trim contract`, async () => {
  for (const [, exact] of utf16Cases(maximum)) for (const padded of [false, true]) {
    const wrap = value => padded ? ` \t\u00a0${value}\r\n\u2003` : value;
    assert.equal(exact.length, maximum);
    assert.equal(definition.parse({ ...base, [field]: wrap(exact) })[field], exact);
    const rejected = definition.safeParse({ ...base, [field]: wrap(exact + 'x') });
    assert.equal(rejected.success, false);
    assert.ok(rejected.error.issues.some(issue => issue.code === 'too_big' && issue.maximum === maximum && issue.path[0] === field));
  }
});
await test('UTF16 fix preserves Unicode/NUL/surrogate policy and exact canonical bytes', async () => {
  for (const field of ['title_ro', 'body_ro', 'title_en', 'body_en', 'title_fa', 'body_fa']) {
    for (const value of ['A\u0000B', 'é', 'e\u0301', 'پیام 😀']) {
      const p = { ...payload(), [field]: value };
      assert.equal(schema.createNoticeDraftSchema.parse(p)[field], value);
      const canonical = c.canonicalNoticeDraft(scope(), p);
      assert.equal((await make(scope(), key, p)).request_hash, hash(canonical));
      assert.ok(canonical.includes(`S${Buffer.byteLength(value)}:${value};`));
    }
    for (const value of ['\ud800', '\udfff', 'x\ud800y']) {
      assert.equal(schema.createNoticeDraftSchema.safeParse({ ...payload(), [field]: value }).success, true, 'schema does not invent a Unicode-policy change');
      await assert.rejects(make(scope(), key, { ...payload(), [field]: value }), /INVALID_TEXT/);
    }
  }
});
await test('all effect identity fields bound; incoherent scope/foreign context fail', async () => {
  const original = await make();
  for (const k of ['tenant_id', 'principal_id', 'context_id', 'membership_id', 'workspace_id']) {
    const s = { ...scope(), [k]: id(80) }, p = { ...payload(), context_id: s.context_id };
    assert.notEqual((await make(s, key, p)).request_hash, original.request_hash);
  }
  for (const target of [{ kind: 'property', id: id(6) }, { kind: 'unit', id: id(80) }]) assert.notEqual((await make({ ...scope(), target })).request_hash, original.request_hash);
  for (const bad of [null, { ...scope(), principal_id: 'bad' }, { ...scope(), role: 'admin' }, { ...scope(), target: { kind: 'tenant', id: id(6) } }]) assert.throws(() => c.parseNoticeDraftScope(bad), /INVALID_SCOPE/);
  await assert.rejects(make(scope(), key, { ...payload(), context_id: id(80) }), /FOREIGN_CONTEXT/);
  for (const bad of ['', 'fresh-key', null]) await assert.rejects(make(scope(), bad), /INVALID_KEY/);
  const alpha = '22900000-abcd-4000-8000-00000000abcd';
  const lower = { ...scope(), context_id: alpha, principal_id: alpha };
  const upper = { ...lower, context_id: alpha.toUpperCase(), principal_id: alpha.toUpperCase() };
  const normalized = await make(upper, alpha.toUpperCase(), { ...payload(), context_id: alpha.toUpperCase() });
  assert.equal(normalized.request_hash, (await make(lower, alpha, { ...payload(), context_id: alpha })).request_hash);
  assert.equal(normalized.key, alpha); assert.equal(normalized.payload.context_id, alpha);
  assert.equal(c.parseNoticeDraftScope({ ...scope(), target: { kind: 'tenant', id: id(1) } }).target.kind, 'tenant');
});
await test('every accepted effect-bearing payload field changes the bound hash', async () => {
  const original = await make();
  for (const k of ['title_ro', 'body_ro', 'title_en', 'body_en', 'title_fa', 'body_fa']) assert.notEqual((await make(scope(), key, { ...payload(), [k]: 'Different' })).request_hash, original.request_hash);
  for (const k of ['communication_type', 'legal_classification', 'source_module']) {
    const other = schema.createNoticeDraftSchema.shape[k].removeDefault().options.find(value => value !== original.payload[k]);
    assert.notEqual((await make(scope(), key, { ...payload(), [k]: other })).request_hash, original.request_hash);
  }
});
await test('snapshot cloned before async digest and deeply immutable afterward', async () => {
  const s = scope(), p = payload(); let release;
  const crypto = { digest(algorithm, bytes) { return new Promise(resolve => { release = () => webcrypto.subtle.digest(algorithm, bytes).then(resolve); }); } };
  const work = make(s, key, p, crypto); s.target.id = id(80); p.title_ro = 'Changed'; release();
  const value = await work; assert.equal(value.scope.target.id, id(6)); assert.equal(value.payload.title_ro, 'Title');
  assert.throws(() => { value.payload.body_ro = 'mutation'; }, TypeError);
  assert.throws(() => { value.scope.target.id = id(80); }, TypeError);
});
await test('digest errors are sanitized and do not invent an algorithm fallback', async () => {
  await assert.rejects(make(scope(), key, payload(), { digest() { throw new Error('SECRET'); } }), /^Error: DIGEST_UNAVAILABLE$/);
  await assert.rejects(make(scope(), key, payload(), { digest: async () => new ArrayBuffer(1) }), /INVALID_DIGEST/);
});
await test('strict proposed receipt parser rejects legacy/malformed/foreign results', async () => {
  const intent = await make(); assert.equal(c.parseNoticeDraftReceipt(receipt(intent), intent).notice_id, id(11));
  const bad = [null, [], {}, { success: true, notice_id: id(11), status: 'draft' }, { to_jsonb: receipt(intent) },
    { ...receipt(intent), success: false }, { ...receipt(intent), status: 'published' }, { ...receipt(intent), created_at: 'bad' },
    { ...receipt(intent), v: 2 }, { ...receipt(intent), purpose: 'other' }, { ...receipt(intent), token: 'SECRET' },
    { ...receipt(intent), notice_id: 'bad' }, { ...receipt(intent), key: key2 }, { ...receipt(intent), request_hash: '0'.repeat(64) }];
  for (const field of ['tenant_id', 'principal_id', 'context_id', 'membership_id', 'workspace_id']) bad.push({ ...receipt(intent), scope: { ...scope(), [field]: id(80) } });
  bad.push({ ...receipt(intent), scope: { ...scope(), target: { kind: 'building', id: id(80) } } });
  for (const value of bad) assert.throws(() => c.parseNoticeDraftReceipt(value, intent), /INVALID_RECEIPT|FOREIGN_RECEIPT/);
  for (const expected of [{ ...intent, v: 2 }, { ...intent, purpose: 'other' }, { ...intent, request_hash: 'bad' }]) assert.throws(() => c.parseNoticeDraftReceipt(receipt(intent), expected), /INVALID_INTENT/);
});
await test('inert import performed no IO; initial admission saves minimal metadata first', async () => {
  const s = new Storage(), machine = pending(s), intent = await make(); assert.equal(s.writes, 0); assert.equal(machine.load().state, 'empty');
  const a = await machine.admit(intent); assert.equal(a.state, 'admitted'); assert.equal(s.writes, 1);
  const raw = s.getItem(c.noticeDraftStorageKey(scope())), data = JSON.parse(raw);
  assert.deepEqual(Object.keys(data).sort(), ['key', 'phase', 'purpose', 'request_hash', 'scope', 'v']);
  assert.equal(data.phase, 'unknown'); assert.ok(Buffer.byteLength(raw) < 4096);
  for (const disallowed of ['Title', 'Body', 'payload', 'token']) assert.equal(raw.includes(disallowed), false);
  assert.equal(Object.hasOwn(machine, 'clear'), false); assert.equal(Object.hasOwn(machine, 'remove'), false);
});
await test('synchronous double admission and rehydrated/new-key attempts are blocked', async () => {
  const s = new Storage(), machine = pending(s), intent = await make();
  const result = await Promise.all([machine.admit(intent), machine.admit(intent)]);
  assert.equal(result.filter(x => x.state === 'admitted').length, 1); assert.equal(s.writes, 1);
  block(await machine.admit(await make(scope(), key2)));
  const rehydrated = pending(s); block(await rehydrated.admit(intent)); block(await rehydrated.admit(await make(scope(), key2), { explicit: true, replaceResolved: true }));
});
for (const mode of ['read', 'write', 'silent', 'after-write', 'corrupt-write']) await test(`storage ${mode}: no admission; failure remains blocked`, async () => {
  const s = new Storage(); s.mode = mode; const machine = pending(s), intent = await make();
  block(await machine.admit(intent)); s.mode = ''; s.data.clear(); block(await machine.admit(await make(scope(), key2)));
});
await test('malformed/foreign/versioned/oversized metadata never auto-clears', async () => {
  const source = new Storage(), intent = await make(); await pending(source).admit(intent); const slot = c.noticeDraftStorageKey(scope()), good = JSON.parse(source.getItem(slot));
  const values = ['{broken', 'x'.repeat(4097), JSON.stringify({ ...good, v: 2 }), JSON.stringify({ ...good, phase: 'committed' }),
    JSON.stringify({ ...good, body: 'PRIVATE' }), JSON.stringify({ ...good, scope: { ...good.scope, membership_id: id(80) } }), JSON.stringify({ ...good, key: 'bad' })];
  for (const raw of values) { const s = new Storage(); s.data.set(slot, raw); const m = pending(s); block(m.load()); block(await m.admit(intent)); assert.equal(s.getItem(slot), raw); assert.equal(s.writes, 0); }
});
await test('unknown absent result is not a new-key license; only explicit same snapshot retry', async () => {
  const s = new Storage(), m = pending(s), intent = await make(), first = await m.admit(intent);
  m.mark(intent, 'unknown', first.ticket); const raw = s.getItem(c.noticeDraftStorageKey(scope()));
  assert.equal(m.observeLookup(absent(intent), intent).state, 'same_intent_only'); assert.equal(s.getItem(c.noticeDraftStorageKey(scope())), raw);
  block(await m.admit(await make(scope(), key2), { explicit: true, retryLookup: absent(intent) }));
  block(await m.admit(await make(scope(), key, { ...payload(), body_ro: 'Changed' }), { explicit: true, retryLookup: absent(intent) }));
  block(await m.admit(intent)); const retry = await m.admit(intent, { explicit: true, retryLookup: absent(intent) }); assert.equal(retry.state, 'admitted');
  block(m.mark(intent, 'unknown', first.ticket)); block(await m.admit(intent, { explicit: true, retryLookup: absent(intent) }));
  assert.equal(m.mark(intent, 'unknown', retry.ticket).state, 'pending');
});
for (const phase of ['conflict', 'expired']) await test(`${phase}: late outcome, remount, absence and receipt never rotate/clear`, async () => {
  const s = new Storage(), m = pending(s), intent = await make(), initial = await m.admit(intent);
  assert.equal(m.mark(intent, phase, initial.ticket).state, 'pending'); block(m.mark(intent, 'unknown', initial.ticket));
  const raw = s.getItem(c.noticeDraftStorageKey(scope())); const rehydrated = pending(s);
  block(rehydrated.observeLookup(absent(intent), intent)); block(rehydrated.observeLookup(committed(intent), intent));
  block(await rehydrated.admit(intent, { explicit: true, retryLookup: absent(intent) }));
  block(await rehydrated.admit(await make(scope(), key2), { explicit: true, replaceResolved: true }));
  assert.equal(s.getItem(c.noticeDraftStorageKey(scope())), raw);
});
await test('matched current proposal receipt plus explicit new intent; reload does not trust completion', async () => {
  const s = new Storage(), m = pending(s), intent = await make(), a = await m.admit(intent); m.mark(intent, 'unknown', a.ticket);
  assert.equal(m.observeLookup(committed(intent), intent).state, 'resolved');
  const next = await make(scope(), key2, { ...payload(), title_ro: 'New explicit draft' });
  block(await pending(s).admit(next, { explicit: true, replaceResolved: true })); block(await m.admit(next));
  const approved = await m.admit(next, { explicit: true, replaceResolved: true }); assert.equal(approved.state, 'admitted');
  block(m.mark(intent, 'unknown', a.ticket)); assert.equal(m.load().pending.key, key2);
});
await test('invalid/foreign/absent observation revokes earlier in-memory resolved hint', async () => {
  for (const value of [null, { state: 'committed', receipt: {} }, { ...absent(await make()), key: key2 }, absent(await make())]) {
    const s = new Storage(), m = pending(s), intent = await make(), a = await m.admit(intent); m.mark(intent, 'unknown', a.ticket);
    assert.equal(m.observeLookup(committed(intent), intent).state, 'resolved'); m.observeLookup(value, intent);
    block(await m.admit(await make(scope(), key2), { explicit: true, replaceResolved: true }));
  }
});
await test('retry save failure preserves evidence and cannot return an admission', async () => {
  const s = new Storage(), m = pending(s), intent = await make(), a = await m.admit(intent); m.mark(intent, 'unknown', a.ticket);
  const raw = s.getItem(c.noticeDraftStorageKey(scope())); s.mode = 'write'; block(await m.admit(intent, { explicit: true, retryLookup: absent(intent) }));
  s.mode = ''; assert.equal(s.getItem(c.noticeDraftStorageKey(scope())), raw); block(await m.admit(intent, { explicit: true, retryLookup: absent(intent) }));
});
await test('coherent scope isolation; no authority inferred from valid parsed scope or hash', async () => {
  const s = new Storage(), a = await make(), foreign = await make({ ...scope(), principal_id: id(80) });
  block(await pending(s).admit(foreign)); assert.equal(s.writes, 0);
  const m = pending(s), admitted = await m.admit(a); m.mark(a, 'unknown', admitted.ticket);
  block(m.observeLookup(committed(foreign), a)); assert.equal(m.load().pending.key, key);
});
await test('malformed intent/hash/digest errors do not save or release a different admission', async () => {
  const s = new Storage(), m = pending(s), intent = await make();
  block(await m.admit({ ...intent, request_hash: '0'.repeat(64) })); assert.equal(s.writes, 0);
  block(await m.admit({ ...intent, payload: { ...intent.payload, title_ro: 'Spoofed' } })); assert.equal(s.writes, 0);
  const a = await m.admit(intent); block(m.mark(await make(scope(), key2), 'unknown', a.ticket));
  block(await m.admit(intent)); assert.equal(m.mark(intent, 'unknown', a.ticket).state, 'pending');
  const deniedStorage = new Storage(), failing = pending(deniedStorage, scope(), { digest: async () => { throw new Error('PRIVATE_CRYPTO_FAILURE'); } });
  block(await failing.admit(intent)); assert.equal(deniedStorage.writes, 0);
});
await test('erased storage/new-device boundary is explicitly not a durable server guarantee', async () => {
  const s = new Storage(), m = pending(s); await m.admit(await make()); s.data.clear();
  assert.equal(pending(s).load().state, 'empty'); // cannot reconstruct erased metadata
  assert.equal(typeof m.dispatch, 'undefined'); assert.equal(typeof m.authorize, 'undefined');
});
console.log(JSON.stringify({ task: 'CE-NOTICE-DRAFT-SUBMIT-SAFETY-01/COMMAND-CODEC-SOURCE', result: 'PASS', groups: cases.length, cases,
  zod_version: require('zod/package.json').version, utf16: { title_units: 250, body_units: 20000, fields: 6, related_fields: 8, unit: 'TRIMMED_UTF16_NOT_CODE_POINTS' },
  vectors, evidence: 'PURE_CODEC_ACTUAL_SCHEMA_WEBCRYPTO_FAKE_STORAGE', status: 'SOURCE_PREPARATORY_NOT_WIRED',
  PostgreSQL_Auth_HTTP_UI: 'NOT_RUN_NOT_PASS', retention: 'UNRESOLVED', serverContract: 'PROPOSAL_ONLY' }, null, 2));
