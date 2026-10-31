// Offline callback tests only. No HTTP/provider/DB/storage globals or installation.
// Run: node scripts/test-ce-notice-draft-rpc-input.mjs --dependencies <installed-repo>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.indexOf('--dependencies');
const require = createRequire(path.join(arg < 0 ? root : process.argv[arg + 1], 'package.json'));
const ts = require('typescript');
const codecPath = 'src/lib/customer/notice-draft-command.ts';
const schemaPath = 'src/lib/customer/communications-schema.ts';
const hash = value => createHash('sha256').update(value).digest('hex');
const pins = {
  [codecPath]: '5ee735a969a1fe6a69859712e630d1ee0912e527b8e2bcd5725d9c78eb1337d8',
  [schemaPath]: 'fe4fa811c7bf1ad1f718e4090571c8835bbdef372a4271b63f3340391a0b7aec',
};
for (const [file, expected] of Object.entries(pins)) {
  assert.equal(hash(readFileSync(path.join(root, file))), expected, `READONLY_DEPENDENCY_MISMATCH: ${file}`);
}
function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.deepEqual(compiled.diagnostics, []);
  const loaded = new Module(filename);
  loaded.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  loaded._compile(compiled.outputText, filename);
  return loaded.exports;
}
const saved = new Map();
for (const name of ['fetch', 'localStorage', 'sessionStorage']) {
  saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error('FORBIDDEN_GLOBAL_IO'); } });
}
const cases = [];
async function test(name, run) { await run(); cases.push(name); }
const invalid = { state: 'rejected', code: 'INVALID_COMMAND', dispatched: false };
try {
  const schema = load(schemaPath);
  const codec = load(codecPath, { './communications-schema': schema });
  const guardedModule = load('src/lib/customer/notice-draft-rpc-input.ts');
  assert.deepEqual(Object.keys(guardedModule), ['dispatchNoticeDraftRpcInput']);
  const dispatch = guardedModule.dispatchNoticeDraftRpcInput;
  const id = n => `22900000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const scope = () => ({ tenant_id: id(1), principal_id: id(2), context_id: id(3), membership_id: id(4),
    workspace_id: id(5), target: { kind: 'unit', id: id(6) } });
  const payload = () => ({ context_id: id(3), title_ro: 'Title', body_ro: 'Body' });
  const make = (p = payload(), key = id(7)) => codec.prepareNoticeDraftIntent(scope(), key, p, webcrypto.subtle);
  // Test-only complete JSON envelope; not a claim about installed server ABI or
  // provider-authenticated actor data. The guard does not authorize this scope.
  const args = intent => ({ p_context_id: intent.scope.context_id, p_idempotency_key: intent.key,
    p_payload: { v: intent.v, purpose: intent.purpose, scope: intent.scope,
      payload: intent.payload, request_hash: intent.request_hash } });
  async function rejected(input) {
    let count = 0;
    const result = await dispatch(input, () => { count++; throw new Error('INVALID_DISPATCH'); });
    assert.deepEqual(result, invalid); assert.equal(count, 0); assert.ok(Object.isFrozen(result));
    return result;
  }
  async function admitted(input) {
    let count = 0, seen;
    const token = {};
    const result = await dispatch(input, captured => { count++; seen = captured; return token; });
    assert.equal(count, 1); assert.equal(result.state, 'dispatched'); assert.equal(result.dispatched, true);
    assert.equal(result.value, token); assert.equal(JSON.stringify(seen), JSON.stringify(input));
    return seen;
  }
  await test('sole exported dispatch; no unguarded helper or live client', async () => {
    assert.deepEqual(Object.keys(guardedModule), ['dispatchNoticeDraftRpcInput']);
    await rejected({ safe: 'ok', tail: ['ok', { nested: '\0' }] });
  });
  const freeText = ['title_ro', 'body_ro', 'title_en', 'body_en', 'title_fa', 'body_fa', 'idempotency_key'];
  for (const field of freeText) for (const text of ['\0X', 'X\0Y', 'X\0']) {
    await test(`schema-valid NUL ${field} ${JSON.stringify(text)}`, async () => {
      const parsed = schema.createNoticeDraftSchema.parse({ ...payload(), [field]: text });
      assert.equal(parsed[field], text);
      await rejected({ complete_arguments: parsed });
      if (field !== 'idempotency_key') {
        const intent = await make({ ...payload(), [field]: text });
        const before = JSON.stringify(intent);
        await rejected(args(intent)); assert.equal(JSON.stringify(intent), before);
      }
    });
  }
  for (const placement of ['key', 'value']) await test(`schema template_params NUL ${placement}`, async () => {
    const template_params = placement === 'key' ? { ['a\0b']: 'text' } : { safe: 'a\0b' };
    const parsed = schema.createNoticeDraftSchema.parse({ ...payload(), template_params });
    await rejected({ complete_arguments: parsed });
  });
  for (const value of ['\0', '\0x', 'x\0y', 'x\0']) {
    for (const where of ['value', 'key', 'array', 'nested']) await test(`recursive ${where} ${JSON.stringify(value)}`, () =>
      rejected(where === 'value' ? value : where === 'key' ? { [value]: 1 }
        : where === 'array' ? [1, value] : { a: [{ b: { [value]: value } }] }));
  }
  for (const raw of ['"\\u0000x"', '"x\\u0000y"', '"x\\u0000"', '{"a\\u0000b":"ok"}', '[{"a":"\\u0000"}]']) {
    await test(`JSON decoded escape ${raw}`, () => rejected(JSON.parse(raw)));
  }
  for (const bad of ['\ud800', '\udfff', '\ud800x', 'x\udfff', '\ud800\ud800', '\udfff\udc00']) {
    for (const where of ['value', 'key']) await test(`unpaired UTF16 ${where} ${JSON.stringify(bad)}`, () =>
      rejected(where === 'value' ? { a: [bad] } : { a: [{ [bad]: 'ok' }] }));
  }
  for (const text of ['\\u0000', 'x\\u0000y', 'Ședință', 'پیام', '😀', 'e\u0301', 'é', 'ا\u0654', '']) {
    await test(`exact accepted codec text ${JSON.stringify(text)}`, async () => {
      const intent = await make({ ...payload(), title_en: text, body_fa: text });
      const original = JSON.stringify(intent), canonical = codec.canonicalNoticeDraft(intent.scope, intent.payload);
      const outbound = args(intent), encoded = JSON.stringify(outbound), captured = await admitted(outbound);
      assert.equal(JSON.stringify(captured), encoded);
      assert.equal(captured.p_payload.payload.title_en, text);
      assert.equal(captured.p_payload.request_hash, intent.request_hash);
      assert.equal(hash(canonical), intent.request_hash);
      assert.equal(codec.canonicalNoticeDraft(captured.p_payload.scope, captured.p_payload.payload), canonical);
      assert.equal(JSON.stringify(intent), original);
      await admitted({ [text]: [text] });
    });
  }
  await test('empty/absent post-schema optionals distinct, canonical/hash never rebuilt', async () => {
    const absent = await make(), empty = await make({ ...payload(), title_en: '' });
    assert.notEqual(absent.request_hash, empty.request_hash);
    for (const intent of [absent, empty]) {
      const captured = await admitted(args(intent));
      assert.equal(Object.hasOwn(captured.p_payload.payload, 'title_en'), Object.hasOwn(intent.payload, 'title_en'));
      assert.equal(captured.p_payload.request_hash, intent.request_hash);
    }
  });
  await test('post-schema text is not trimmed/normalized by guard', async () => {
    const input = { text: '  e\u0301 پیام  ', hash: 'untouched opaque bytes' };
    const snapshot = await admitted(input);
    assert.equal(snapshot.text, input.text); assert.equal(snapshot.hash, input.hash);
  });
  const unsupported = [undefined, NaN, Infinity, -Infinity, 1n, Symbol('s'), () => {},
    new Date(), new Map(), new Set(), new String('x'), new Number(1), new Boolean(false),
    /x/, new Uint8Array([1]), new ArrayBuffer(1), Promise.resolve(1), Object.create({ inherited: 1 }),
    new (class { member = 1; })(), new Array(2), Object.assign([1], { extra: 1 }),
    { missing: undefined }, { method() {} }, { toJSON() { throw new Error('NEVER_CALL'); } }];
  for (const [i, value] of unsupported.entries()) await test(`non-JSON/no coercion ${i}`, () => rejected(value));
  await test('nonfinite/unsupported nested values cannot be discarded by serialization', async () => {
    for (const bad of [NaN, Infinity, undefined, 1n, Symbol(), () => {}]) await rejected({ deep: [{ bad }] });
  });
  await test('accessors, symbols and hidden properties rejected without invocation', async () => {
    let calls = 0;
    const getter = {}; Object.defineProperty(getter, 'secret', { enumerable: true, get() { calls++; return 'x'; } });
    const toJSON = {}; Object.defineProperty(toJSON, 'toJSON', { enumerable: true, get() { calls++; return () => ({}); } });
    const setter = {}; Object.defineProperty(setter, 'x', { enumerable: true, set(_) { calls++; } });
    for (const value of [getter, toJSON, setter, Object.defineProperty({}, 'hidden', { value: '\0' }),
      { [Symbol('s')]: 'ok' }, Object.assign([1], { [Symbol('s')]: 1 }),
      Object.defineProperty([1], '0', { get() { calls++; return 1; }, enumerable: true })]) await rejected(value);
    assert.equal(calls, 0);
  });
  await test('live/revoked proxies rejected before any introspection trap', async () => {
    let traps = 0;
    const proxy = new Proxy({}, { getPrototypeOf() { traps++; throw new Error('TRAP'); },
      ownKeys() { traps++; throw new Error('TRAP'); }, get() { traps++; throw new Error('TRAP'); } });
    const revoked = Proxy.revocable([], {}); revoked.revoke();
    await rejected(proxy); await rejected({ a: proxy }); await rejected(revoked.proxy);
    assert.equal(traps, 0);
  });
  await test('cycles rejected; shared acyclic data accepted and deeply frozen', async () => {
    const cyclic = {}; cyclic.self = cyclic; await rejected(cyclic);
    const a = [], b = { a }; a.push(b); await rejected({ a });
    const child = { x: ['valid'] }, captured = await admitted({ a: child, b: child });
    assert.equal(captured.a, captured.b); assert.ok(Object.isFrozen(captured.a.x));
    assert.ok(!Object.isFrozen(child));
  });
  await test('all JSON primitive values preserved; finite is not PostgreSQL numeric proof', async () => {
    const captured = await admitted({ a: null, b: true, c: false, d: 0, e: -0, f: 1.5, g: Number.MAX_VALUE });
    assert.ok(Object.is(captured.e, -0));
  });
  await test('special keys/null prototypes preserved as JSON data, without prototype setter', async () => {
    const value = JSON.parse('{"__proto__":{"safe":true},"constructor":"x","toJSON":"text"}');
    const captured = await admitted(value);
    assert.equal(Object.getPrototypeOf(captured), null);
    assert.equal(captured.__proto__.safe, true);
    const nullPrototype = Object.create(null); nullPrototype.key = ['valid']; await admitted(nullPrototype);
  });
  await test('entire capture synchronous before callback, immutable across await/input mutation', async () => {
    const input = { a: [{ text: 'valid' }], tail: 'valid' }, before = JSON.stringify(input);
    let release, seen, count = 0;
    const latch = new Promise(resolve => { release = resolve; });
    const returned = dispatch(input, async snapshot => {
      seen = snapshot; count++; assert.equal(JSON.stringify(snapshot), before);
      assert.ok(Object.isFrozen(snapshot)); assert.ok(Object.isFrozen(snapshot.a));
      assert.ok(Object.isFrozen(snapshot.a[0]));
      assert.throws(() => { snapshot.a[0].text = 'changed'; }, TypeError);
      assert.throws(() => snapshot.a.push('changed'), TypeError);
      await latch;
      assert.equal(JSON.stringify(snapshot), before); return snapshot;
    });
    assert.equal(count, 1); assert.notEqual(seen, input); assert.ok(!Object.isFrozen(input));
    input.a[0].text = '\0'; input.tail = 'changed'; input.a.push('new'); release();
    const result = await returned; assert.equal(result.value, seen); assert.equal(count, 1);
    // Changed input cannot reuse the previously captured admission.
    await rejected(input);
  });
  await test('valid input descriptors/bytes unchanged; invalid input not sanitized', async () => {
    const input = { a: ['valid'] }, before = Object.getOwnPropertyDescriptors(input);
    await admitted(input); assert.deepEqual(Object.getOwnPropertyDescriptors(input), before);
    const bad = { a: '\0', key: 'unchanged' }; await rejected(bad); assert.equal(bad.a, '\0');
  });
  await test('very deep snapshot is fully checked, not truncated at a recursion limit', async () => {
    const input = {}; let current = input;
    for (let i = 0; i < 5000; i++) { current.next = {}; current = current.next; }
    current.text = '\0'; await rejected(input); current.text = 'ok';
    let count = 0; const result = await dispatch(input, snapshot => {
      count++; for (let i = 0; i < 5000; i++) { assert.ok(Object.isFrozen(snapshot)); snapshot = snapshot.next; }
      assert.equal(snapshot.text, 'ok'); assert.ok(Object.isFrozen(snapshot)); return 'deep';
    }); assert.equal(count, 1); assert.equal(result.value, 'deep');
  });
  await test('sync throw/async rejection propagate original evidence once; no retry', async () => {
    for (const asyncFailure of [false, true]) {
      const error = new Error('OPAQUE_CALLBACK_FAILURE'); let count = 0;
      await assert.rejects(dispatch({ valid: true }, () => {
        count++; if (asyncFailure) return Promise.reject(error); throw error;
      }), value => value === error); assert.equal(count, 1);
    }
  });
  await test('callback UNKNOWN identity preserved; dispatched is not success/commit', async () => {
    const unknown = Object.freeze({ state: 'unknown', evidence: null }); let count = 0;
    const result = await dispatch({ valid: true }, () => { count++; return Promise.resolve(unknown); });
    assert.equal(result.value, unknown); assert.equal(count, 1); assert.equal(Object.hasOwn(result, 'success'), false);
  });
  class Storage {
    data = new Map(); writes = 0;
    getItem(key) { return this.data.get(key) ?? null; }
    setItem(key, value) { this.writes++; this.data.set(key, value); }
  }
  for (const priorValid of [false, true]) for (const different of [false, true]) await test(`retained UNKNOWN unchanged; prior ${priorValid ? 'valid' : 'invalid-looking'}; ${different ? 'different new' : 'same'} key`, async () => {
    const storage = new Storage(), original = await make({ ...payload(), body_ro: priorValid ? 'Earlier valid intent' : 'Earlier intent\0' });
    const pending = codec.createNoticeDraftPending(storage, scope(), webcrypto.subtle);
    const admitted = await pending.admit(original);
    assert.equal(admitted.state, 'admitted'); assert.equal(pending.load().pending.phase, 'unknown');
    const stored = [...storage.data], writes = storage.writes, originalBytes = JSON.stringify(original);
    const newIntent = await make({ ...payload(), body_ro: different ? 'Different invalid\0' : 'Earlier intent\0' }, different ? id(8) : original.key);
    const rejection = await rejected(args(newIntent));
    assert.deepEqual(rejection, invalid); assert.equal(Object.hasOwn(rejection, 'httpStatus'), false);
    assert.deepEqual([...storage.data], stored); assert.equal(storage.writes, writes);
    assert.equal(JSON.stringify(original), originalBytes);
    const retained = pending.load(); assert.equal(retained.state, 'pending');
    assert.equal(retained.pending.phase, 'unknown'); assert.equal(retained.pending.key, original.key);
    assert.equal(retained.pending.request_hash, original.request_hash);
    assert.equal(Object.hasOwn(rejection, 'receipt'), false); assert.equal(Object.hasOwn(rejection, 'absent_at_check'), false);
    // No mark/observeLookup/rotation is called: current rejection cannot resolve
    // a past potentially dispatched attempt. HTTP400 mapping is FUTURE ONLY.
  });
  console.log(JSON.stringify({ status: 'PASS', tests: cases.length, cases, dependencies: pins,
    evidence: 'OFFLINE_ACTUAL_GUARDED_CALLBACK_ONLY',
    transport: 'INACTIVE_UNWIRED', connected: 'NOT_RUN_NOT_PASS',
    gate: 'BEFORE_TRANSPORT_IMPLEMENTATION_GATE_OPEN' }, null, 2));
} finally {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
