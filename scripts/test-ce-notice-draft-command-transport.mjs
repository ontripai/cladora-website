// Real browser controller -> actual exported handler -> accepted guard -> fake RPC.
// Effects/commit here are TEST ORACLE only. No network/server/browser/SQL runtime.
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { fixture, makeLoader, scope, payload, id, requireDependency } from './test-ce-notice-draft-command-route.mjs';
class Storage {
  data = new Map(); writes = 0; mode = '';
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { if (this.mode === 'read') throw new Error('PRIVATE_STORAGE'); return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.mode === 'write') throw new Error('PRIVATE_STORAGE'); this.writes++; this.data.set(key, this.mode === 'corrupt' ? value + 'x' : value); }
}
const source = makeLoader(), { createNoticeDraftTransport } = source('src/lib/customer/notice-draft-transport.ts');
const cf01 = process.argv.includes('--cf01');
const ts2802 = process.argv.includes('--ts2802');
const disposalRegressions = new Set(['timeout after command may still commit; late R cannot resolve UI; current lookup can', 'close/context/unmount fence: late command response cannot publish or erase pending', 'CF01: disposed/old bootstrap cannot publish, erase evidence or acquire legacy fence']);
const tests = [], test = async (name, run) => { if (ts2802 ? !name.startsWith('TS2802:') && !disposalRegressions.has(name) : cf01 && !name.startsWith('CF01:')) return; await run(); tests.push(name); };
function consumer(f = fixture(), storage = new Storage()) {
  let live = true; const states = [], http = [];
  const c = createNoticeDraftTransport({ storage, crypto: webcrypto, timeoutMs: 30,
    fetch: async (...args) => { http.push(args); return f.fetch(...args); }, isCurrent: () => live, onState: s => states.push(s) });
  return { f, c, storage, states, http, stale() { live = false; c.dispose(); } };
}
async function opened(f, storage) { const x = consumer(f, storage); await x.c.open(id(3), id(4)); return x; }
const phase = x => x.c.getState().phase;
const posts = x => x.http.filter(([, init]) => init?.method === 'POST');
await test('scope -> immutable admission -> one command for synchronous double event -> strict R', async () => {
  const x = await opened(); assert.equal(phase(x), 'ready');
  const p = payload(), a = x.c.send(p), b = x.c.send(p); p.title_ro = 'Changed after capture';
  const results = await Promise.all([a, b]); assert.equal(results.filter(Boolean).length, 1);
  assert.equal(posts(x).length, 1); assert.equal(x.f.effects, 1); assert.equal(phase(x), 'resolved');
  const sent = JSON.parse(posts(x)[0][1].body); assert.equal(sent.p_payload.payload.title_ro, payload().title_ro);
  assert.equal(JSON.parse([...x.storage.data.values()][0]).phase, 'unknown'); x.stale();
});
await test('lost reply -> UNKNOWN -> read-only committed lookup -> original matching R', async () => {
  const x = await opened(); x.f.loseReply = true; await x.c.send(payload()); assert.equal(phase(x), 'unknown');
  const pending = [...x.storage.data]; assert.equal(x.f.effects, 1); await x.c.send(payload()); assert.equal(posts(x).length, 1);
  await x.c.check(); assert.equal(phase(x), 'resolved'); assert.equal(x.f.effects, 1); assert.equal(posts(x).length, 1);
  assert.deepEqual([...x.storage.data], pending); assert.equal(x.c.getState().receipt.notice_id, id(21)); x.stale();
});
await test('absent lookup -> no automatic POST -> explicit same immutable key/hash retry and replay', async () => {
  const x = await opened(); x.f.commandMode = 'missing'; await x.c.send(payload()); const original = posts(x)[0][1].body;
  assert.equal(phase(x), 'unknown'); x.f.commandMode = ''; await x.c.check(); assert.equal(phase(x), 'retry'); assert.equal(posts(x).length, 1);
  const p = { ...payload(), title_ro: 'should not replace captured intent' };
  await Promise.all([x.c.retry(p), x.c.retry(p)]); assert.equal(phase(x), 'resolved');
  assert.equal(posts(x).length, 2); assert.equal(posts(x)[1][1].body, original); assert.equal(x.f.effects, 1); x.stale();
});
await test('remount metadata-only lookup; different re-entry cannot retry or rotate; exact re-entry succeeds', async () => {
  const first = await opened(); first.f.commandMode = 'missing'; await first.c.send(payload()); first.stale();
  const saved = [...first.storage.data], x = await opened(first.f, first.storage); assert.equal(phase(x), 'unknown'); assert.equal(posts(x).length, 0);
  x.f.commandMode = ''; await x.c.check(); assert.equal(phase(x), 'retry');
  await x.c.retry({ ...payload(), title_ro: 'different' }); assert.equal(posts(x).length, 0); assert.deepEqual([...x.storage.data], saved);
  await x.c.check(); await x.c.retry(payload()); assert.equal(phase(x), 'resolved');
  const original = JSON.parse(posts(first)[0][1].body), replay = JSON.parse(posts(x)[0][1].body);
  assert.equal(replay.p_idempotency_key, original.p_idempotency_key); assert.equal(replay.p_payload.request_hash, original.p_payload.request_hash); x.stale();
});
await test('remount committed lookup needs no stored text; explicit new intent needs matching re-entry', async () => {
  const first = await opened(); first.f.loseReply = true; await first.c.send(payload()); first.stale();
  const x = await opened(first.f, first.storage); await x.c.check(); assert.equal(phase(x), 'resolved');
  await x.c.newDraft({ ...payload(), title_ro: 'wrong' }); assert.equal(phase(x), 'resolved'); assert.equal(posts(x).length, 0);
  await x.c.newDraft(payload()); assert.equal(phase(x), 'ready'); await x.c.send({ ...payload(), title_ro: 'explicit new' });
  assert.equal(phase(x), 'resolved'); assert.equal(x.f.effects, 2);
  assert.notEqual(JSON.parse(posts(x)[0][1].body).p_idempotency_key, JSON.parse(posts(first)[0][1].body).p_idempotency_key); x.stale();
});
for (const mode of ['conflict', 'expiry', 'denied', 'malformed', 'foreign', 'generic22023', 'generic55000']) await test(`command ${mode}: preserve pending and never resend/fallback`, async () => {
  const x = await opened(); x.f.commandMode = mode; await x.c.send(payload());
  assert.equal(phase(x), mode === 'conflict' ? 'conflict' : mode === 'expiry' ? 'expired' : mode === 'denied' ? 'blocked' : 'unknown');
  const stored = [...x.storage.data]; await x.c.send(payload()); await x.c.retry(payload());
  assert.equal(posts(x).length, 1); assert.deepEqual([...x.storage.data], stored); assert.ok(!JSON.stringify(x.c.getState()).includes('PRIVATE')); x.stale();
});
for (const mode of ['read', 'write', 'corrupt']) await test(`storage ${mode} blocks before command dispatch`, async () => {
  const storage = new Storage(); storage.mode = mode; const x = await opened(undefined, storage);
  await x.c.send(payload()); assert.equal(phase(x), 'blocked'); assert.equal(posts(x).length, 0); x.stale();
});
await test('corrupt retained metadata remains byte-identical and blocked', async () => {
  const storage = new Storage(), f = fixture(); storage.data.set(f.codec.noticeDraftStorageKey(scope()), '{bad');
  const x = await opened(f, storage); assert.equal(phase(x), 'blocked'); await x.c.send(payload()); assert.equal(posts(x).length, 0);
  assert.deepEqual([...storage.data.values()], ['{bad']); x.stale();
});
await test('prior UNKNOWN + invalid current NUL rejected without clearing earlier evidence', async () => {
  const x = await opened(); x.f.commandMode = 'missing'; await x.c.send({ ...payload(), body_ro: 'old\0' });
  const stored = [...x.storage.data]; assert.equal(phase(x), 'unknown');
  await x.c.send({ ...payload(), body_ro: 'new\0' }); assert.deepEqual([...x.storage.data], stored); assert.equal(posts(x).length, 1); x.stale();
});
await test('timeout after command may still commit; late R cannot resolve UI; current lookup can', async () => {
  const x = await opened(); let release; x.f.deferred = new Promise(r => { release = r; });
  await x.c.send(payload()); assert.equal(phase(x), 'unknown'); assert.equal(posts(x)[0][1].signal.aborted, true);
  release(); await new Promise(r => setTimeout(r, 10)); assert.equal(phase(x), 'unknown');
  x.f.deferred = null; await x.c.check(); assert.equal(phase(x), 'resolved'); assert.equal(x.f.effects, 1); x.stale();
});
await test('close/context/unmount fence: late command response cannot publish or erase pending', async () => {
  const x = await opened(); let release; x.f.deferred = new Promise(r => { release = r; });
  const sending = x.c.send(payload()); await new Promise(r => setTimeout(r, 4)); x.stale(); const count = x.states.length, saved = [...x.storage.data];
  release(); await sending; await new Promise(r => setTimeout(r, 5)); assert.equal(x.states.length, count); assert.deepEqual([...x.storage.data], saved);
});
await test('changed current authority blocks lookup without prior outcome loss; restored authority can reconcile', async () => {
  const x = await opened(); x.f.loseReply = true; await x.c.send(payload()); const stored = [...x.storage.data];
  x.f.mode = 'denied'; await x.c.check(); assert.equal(phase(x), 'blocked'); assert.deepEqual([...x.storage.data], stored);
  x.f.mode = ''; await x.c.check(); assert.equal(phase(x), 'resolved'); x.stale();
});
await test('projection drift on remount cannot hide an old Context key/hash in another scope slot', async () => {
  const first = await opened(); first.f.loseReply = true; await first.c.send(payload()); first.stale();
  const saved = [...first.storage.data], dashboard = first.f.dashboard;
  first.f.dashboard = () => ({ ...dashboard(), workspace_id: id(99) });
  const x = await opened(first.f, first.storage); assert.equal(phase(x), 'blocked');
  assert.equal(x.c.getState().pending.key, JSON.parse(posts(first)[0][1].body).p_idempotency_key);
  await x.c.send(payload()); assert.equal(posts(x).length, 0); assert.deepEqual([...x.storage.data], saved);
  first.f.dashboard = dashboard; await x.c.check(); assert.equal(phase(x), 'resolved'); x.stale();
});
await test('scope mismatch and unavailable projection: no new key/admission/command', async () => {
  const x = consumer(); await x.c.open(id(3), id(99)); assert.equal(phase(x), 'blocked'); await x.c.send(payload()); assert.equal(x.storage.writes, 0); assert.equal(posts(x).length, 0); x.stale();
});
// CE-CT-CF-01 delta only. No accepted owner suite is selected by --cf01.
function failScope(f, mode) {
  const original = f.fetch;
  f.fetch = async (url, init) => {
    if (new URL(url, 'https://ce.test').searchParams.get('action') === 'scope') {
      if (mode === 'throw') throw new Error('PRIVATE_BOOTSTRAP');
      if (mode === '503') return Response.json({ error: { code: 'UNKNOWN', message: 'bounded' } }, { status: 503 });
      if (mode === 'malformed') return Response.json({ v: 1, scope: { wrong: true } });
    }
    return original(url, init);
  };
}
async function seed(f, storage, phase = 'unknown', binding = scope()) {
  const intent = await f.make(payload(), id(7), binding);
  const pending = f.codec.createNoticeDraftPending(storage, binding, webcrypto.subtle), admission = await pending.admit(intent);
  assert.equal(admission.state, 'admitted'); pending.mark(intent, phase, admission.ticket);
}
for (const mode of ['throw', '503', 'malformed']) {
  await test(`CF01: ${mode} bootstrap, readable empty local inventory allows one legacy admission`, async () => {
    const f = fixture(); failScope(f, mode); const x = await opened(f);
    assert.equal(phase(x), 'blocked'); assert.equal(x.c.getState().inventory, 'empty');
    const release = x.c.beginLegacy(); assert.equal(typeof release, 'function'); assert.equal(x.c.beginLegacy(), null);
    assert.equal(x.c.getState().protocolInFlight, 'legacy'); release(); release();
    assert.equal(x.c.getState().protocolInFlight, 'none'); assert.equal(posts(x).length, 0); x.stale();
  });
  for (const kind of ['unknown', 'conflict', 'expired', 'inaccessible', 'corrupt', 'ambiguous', 'incomplete']) {
    await test(`CF01: ${mode} bootstrap with ${kind} inventory never permits legacy or clears evidence`, async () => {
      const f = fixture(), storage = new Storage();
      if (['unknown', 'conflict', 'expired', 'inaccessible', 'ambiguous'].includes(kind)) await seed(f, storage, ['conflict', 'expired'].includes(kind) ? kind : 'unknown');
      if (kind === 'corrupt') storage.data.set(f.codec.noticeDraftStorageKey(scope()), '{bad');
      if (kind === 'ambiguous') await seed(f, storage, 'unknown', { ...scope(), workspace_id: id(99) });
      if (kind === 'inaccessible') storage.mode = 'read';
      if (kind === 'incomplete') { storage.data.set('unrelated', 'keep'); storage.key = () => null; }
      const saved = [...storage.data], writes = storage.writes; failScope(f, mode); const x = await opened(f, storage);
      assert.equal(x.c.beginLegacy(), null); await x.c.send(payload()); assert.equal(posts(x).length, 0);
      assert.notEqual(x.c.getState().inventory, 'empty'); assert.deepEqual([...storage.data], saved); assert.equal(storage.writes, writes); x.stale();
    });
  }
  await test(`CF01: selected durable entry after ${mode} scope failure never dispatches or falls back`, async () => {
    const f = fixture(); failScope(f, mode); const x = await opened(f); await x.c.send(payload());
    assert.equal(posts(x).length, 0); assert.equal(x.storage.writes, 0); assert.equal(phase(x), 'blocked'); x.stale();
  });
}
await test('CF01: legacy needs no completed bootstrap; inspection precedes network and protocol fence survives late readiness', async () => {
  const f = fixture(), storage = new Storage(); let release;
  const wait = new Promise(r => { release = r; }), original = f.fetch;
  const x = consumer(f, storage);
  f.fetch = async (...args) => { assert.equal(x.c.getState().inventory, 'empty'); await wait; return original(...args); };
  const opening = x.c.open(id(3), id(4));
  const finish = x.c.beginLegacy(); assert.equal(typeof finish, 'function'); assert.equal(x.c.getState().protocolInFlight, 'legacy');
  release(); await opening; assert.equal(phase(x), 'ready'); await x.c.send(payload()); assert.equal(posts(x).length, 0);
  finish(); x.stale();
});
await test('CF01: fresh admission rechecks storage after empty bootstrap; new UNKNOWN blocks legacy AND durable', async () => {
  const x = await opened(); await seed(x.f, x.storage); const saved = [...x.storage.data];
  assert.equal(x.c.beginLegacy(), null); assert.equal(x.c.getState().inventory, 'pending');
  await x.c.send(payload()); assert.equal(posts(x).length, 0); assert.deepEqual([...x.storage.data], saved); x.stale();
});
await test('CF01: observed UNKNOWN cannot become empty after external erasure', async () => {
  const f = fixture(), storage = new Storage(); await seed(f, storage); failScope(f, '503'); const x = await opened(f, storage);
  storage.data.clear(); assert.equal(x.c.beginLegacy(), null); assert.equal(x.c.getState().inventory, 'blocked'); x.stale();
});
await test('CF01: digest/admission await synchronously excludes legacy; command failure never releases durable choice', async () => {
  const f = fixture(), storage = new Storage(); let release;
  const wait = new Promise(r => { release = r; }); const x = consumer(f, storage);
  // Recreate with delayed digest, retaining the real controller and codec.
  x.stale(); const states = [];
  const c = createNoticeDraftTransport({ fetch: f.fetch, storage, crypto: { randomUUID: () => webcrypto.randomUUID(),
    subtle: { digest: async (...args) => { await wait; return webcrypto.subtle.digest(...args); } } }, isCurrent: () => true, onState: s => states.push(s) });
  await c.open(id(3), id(4)); f.commandMode = 'missing';
  const sending = c.send(payload()); assert.equal(c.getState().protocolInFlight, 'durable'); assert.equal(c.beginLegacy(), null);
  assert.equal(storage.writes, 0); release(); await sending;
  assert.equal(c.getState().phase, 'unknown'); assert.equal(c.beginLegacy(), null); assert.equal(f.effects, 0); c.dispose();
});
await test('CF01: disposed/old bootstrap cannot publish, erase evidence or acquire legacy fence', async () => {
  const f = fixture(); let release; const wait = new Promise(r => { release = r; }), original = f.fetch;
  f.fetch = async (...args) => { await wait; return original(...args); };
  const x = consumer(f), opening = x.c.open(id(3), id(4)); x.stale(); const count = x.states.length;
  release(); await opening; assert.equal(x.states.length, count); assert.equal(x.c.beginLegacy(), null); assert.equal(x.storage.writes, 0);
});
await test('CF01: healthy durable create/UNKNOWN lookup/exact retry remain connected', async () => {
  const x = await opened(); x.f.commandMode = 'missing'; await x.c.send(payload()); const first = posts(x)[0][1].body;
  x.f.commandMode = ''; await x.c.check(); assert.equal(phase(x), 'retry'); await x.c.retry({ ...payload(), title_ro: 'ignored edits' });
  assert.equal(phase(x), 'resolved'); assert.equal(posts(x)[1][1].body, first); assert.equal(x.f.effects, 1); assert.equal(x.c.beginLegacy(), null); x.stale();
});
if (cf01) assert.ok(tests.length > 0);
if (ts2802) {
  const arg = process.argv.indexOf('--dispose-predecessor');
  assert.ok(arg >= 0 && process.argv[arg + 1], 'EXACT_TOOL_GAP: supply verified accepted predecessor source via --dispose-predecessor');
  const oldText = readFileSync(process.argv[arg + 1], 'utf8');
  assert.equal(createHash('sha256').update(oldText).digest('hex'), 'a5d156b0698b0105eac1373e6c294723c04a4e60233525086e800db6cdd1367c');
  const currentText = readFileSync(new URL('../src/lib/customer/notice-draft-transport.ts', import.meta.url), 'utf8');
  async function observe(text, scenario) {
    const events = [], collections = [], timers = new Map(), states = [];
    // Observe the REAL controller's private live request Set through a native
    // Set subclass; no dispose implementation/predicate is copied or replaced.
    class ObservableSet extends Set {
      constructor(...args) { super(...args); collections.push(this); }
      clear() { if (this === collections[0]) events.push('clear'); return super.clear(); }
    }
    let timerId = 0, completeHttp, calls = 0;
    const ts = requireDependency('typescript'), compiled = ts.transpileModule(text, {
      reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    // ES2022 here is ONLY the Node behavioral loader, not a project typecheck.
    assert.deepEqual(compiled.diagnostics, []);
    const instance = new Module('real-dispose-source.ts');
    const request = name => name === './notice-draft-command' ? source('src/lib/customer/notice-draft-command.ts') : requireDependency(name);
    new Function('exports', 'require', 'module', 'Set', 'setTimeout', 'clearTimeout', compiled.outputText)(
      instance.exports, request, instance, ObservableSet,
      (fn, ms) => { const token = ++timerId; timers.set(token, { fn, ms }); return token; },
      token => { timers.delete(token); },
    );
    const storage = new Storage();
    const c = instance.exports.createNoticeDraftTransport({ storage, crypto: webcrypto,
      isCurrent: () => true, onState: state => states.push(state),
      fetch: async (_url, init) => { calls++; init.signal.addEventListener('abort', () => events.push('real-abort'));
        return new Promise(resolve => { completeHttp = resolve; }); },
    });
    const requests = collections[0], error = new Error('CANCEL_FAILURE');
    if (scenario === 'empty') {
      c.dispose(); assert.equal(c.beginLegacy(), null); await c.open(id(3), id(4));
      return { events, calls, timers: timers.size, writes: storage.writes, setSize: requests.size };
    }
    const opening = c.open(id(3), id(4));
    assert.equal(requests.size, 1); const realCancel = [...requests][0];
    const a = () => events.push('A'), b = () => events.push('B'), added = () => events.push('added');
    if (scenario === 'live-delete-add') {
      requests.add(() => { events.push('mutate'); requests.delete(a); requests.add(added); }); requests.add(a); requests.add(b);
    } else if (scenario === 'delete-reinsert') {
      requests.add(() => { events.push('mutate'); requests.delete(a); requests.add(a); }); requests.add(a); requests.add(b);
    } else if (scenario === 'throw') {
      let first = true;
      requests.add(() => { events.push(first ? 'throw-first' : 'throw-second'); if (first) { first = false; throw error; } }); requests.add(b);
    } else if (scenario === 'reentrant') {
      requests.add(() => { events.push('inner'); if (requests.has(realCancel)) { requests.delete(realCancel); c.dispose(); } }); requests.add(b);
    } else { requests.add(a); requests.add(b); }
    let threw = false;
    try { c.dispose(); } catch (caught) { assert.equal(caught, error); threw = true; }
    await opening;
    if (scenario === 'throw') { assert.equal(threw, true); assert.ok(!events.includes('B')); assert.equal(requests.size, 2); c.dispose(); }
    else assert.equal(threw, false);
    const beforeLate = states.length, retained = [...storage.data];
    completeHttp(Response.json({ v: 1, scope: scope() }));
    await Promise.resolve(); await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(states.length, beforeLate); assert.deepEqual([...storage.data], retained);
    assert.equal(timers.size, 0); assert.equal(requests.size, 0); assert.equal(c.beginLegacy(), null);
    await c.open(id(3), id(4)); assert.equal(calls, 1);
    return { events, calls, threw, states, writes: storage.writes, setSize: requests.size, timers: timers.size };
  }
  for (const scenario of ['empty', 'ordered', 'live-delete-add', 'delete-reinsert', 'throw', 'reentrant']) {
    await test(`TS2802: actual predecessor/candidate dispose ${scenario}`, async () => {
      const before = await observe(oldText, scenario), after = await observe(currentText, scenario);
      assert.deepEqual(after, before);
      if (scenario === 'live-delete-add') assert.deepEqual(after.events, ['real-abort', 'mutate', 'B', 'added', 'clear']);
      if (scenario === 'delete-reinsert') assert.deepEqual(after.events, ['real-abort', 'mutate', 'B', 'A', 'clear']);
      if (scenario === 'ordered') assert.deepEqual(after.events, ['real-abort', 'A', 'B', 'clear']);
    });
  }
  assert.ok(tests.length >= 6);
}

console.log(JSON.stringify({ suite: ts2802 ? 'PM126 TS2802 dispose equivalence' : cf01 ? 'PM123 CE-CT-CF-01 controller delta' : 'PM121 real controller/handler chain', tests: tests.length, status: 'PASS', cases: tests, evidence: 'FAKE_HTTP_AND_RPC_ORACLE_ONLY', live: 'NOT_RUN_NOT_PASS' }, null, 2));
