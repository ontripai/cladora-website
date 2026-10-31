// Actual exported route/handler + accepted guard/codec; offline fake user client.
// No server, network, PostgreSQL, installed transaction or real authorization proof.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { createHash, webcrypto } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const depIndex = process.argv.indexOf('--dependencies');
export const dependencyRoot = process.env.CE_TEST_DEPENDENCY_ROOT ?? (depIndex < 0 ? root : process.argv[depIndex + 1]);
export const requireDependency = createRequire(path.join(dependencyRoot, 'package.json'));
const ts = requireDependency('typescript');
const pins = {
  'src/lib/customer/notice-draft-command.ts': '5ee735a969a1fe6a69859712e630d1ee0912e527b8e2bcd5725d9c78eb1337d8',
  'src/lib/customer/notice-draft-rpc-input.ts': '6981fac49d7420113e60b20f33febd29333616f92a5689c67d503740a506a062',
  'src/lib/customer/communications-schema.ts': 'fe4fa811c7bf1ad1f718e4090571c8835bbdef372a4271b63f3340391a0b7aec',
};
export function makeLoader(overrides = {}) {
  for (const [p, hash] of Object.entries(pins)) assert.equal(createHash('sha256').update(readFileSync(path.join(root, p))).digest('hex'), hash);
  const cache = new Map();
  const load = relative => {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const instance = new Module(filename); cache.set(filename, instance);
    instance.require = id => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id.startsWith('.') || id.startsWith('@/')) {
        const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(filename), id);
        const resolved = [base, base + '.ts', base + '.tsx'].find(existsSync);
        assert.ok(resolved, `READONLY_DEPENDENCY_MISSING: ${id}`); return load(resolved);
      }
      return requireDependency(id);
    };
    const output = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    assert.deepEqual(output.diagnostics, []); instance._compile(output.outputText, filename); return instance.exports;
  };
  return load;
}
export const id = n => `22900000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const scope = () => ({ tenant_id: id(1), principal_id: id(2), context_id: id(3), membership_id: id(4), workspace_id: id(5), target: { kind: 'unit', id: id(6) } });
export const payload = () => ({ context_id: id(3), title_ro: 'Synthetic title RO', body_ro: 'Synthetic body RO' });
export function fixture() {
  const source = makeLoader(); const codec = source('src/lib/customer/notice-draft-command.ts');
  const guard = source('src/lib/customer/notice-draft-rpc-input.ts');
  const guardSnapshots = [], calls = [], commands = new Map();
  const f = { codec, calls, commands, effects: 0, auth: true, mode: '', commandMode: '', lookupMode: '', guardSnapshots, deferred: null };
  function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); for (const x of Object.values(value)) frozen(x); } }
  const context = () => ({ context_id: id(3), membership_id: id(4), tenant_id: id(1), tenant_name: 'Synthetic', role_code: 'association_admin', role_name: 'Admin',
    scope_type: 'unit', property_id: null, building_id: null, unit_id: id(6), context_label: 'Synthetic unit', starts_at: '2026-01-01T00:00:00Z', ends_at: null });
  f.context = context;
  f.dashboard = () => ({ version: 1, persona: 'association_admin', contextId: id(3), context: { id: id(3), tenant_id: id(1), tenant_name: 'Synthetic',
    role_code: 'association_admin', role_name: 'Admin', scope_type: 'unit', property_id: null, building_id: null, unit_id: id(6) }, workspace_id: id(5),
    capabilities: [], sections: [], permissions: [], entitlements: [], modules: [], kpis: {}, generated_at: '2026-10-24T00:00:00Z' });
  const client = { auth: { getClaims: async () => ({ data: f.auth ? { claims: { sub: id(2) } } : null, error: null }) },
    schema(name) { assert.equal(name, 'customer_api'); return { async rpc(name, args) {
      frozen(args); assert.ok(guardSnapshots.includes(args), 'every REAL client.rpc call receives exact accepted guard snapshot');
      calls.push({ name, args, serialized: JSON.stringify(args) });
      if (f.mode === 'unavailable') return { data: null, error: { code: 'PGRST202', message: 'PRIVATE_UNAVAILABLE' } };
      if (f.mode === 'denied') return { data: null, error: { code: '42501', message: 'PRIVATE_DENIAL' } };
      if (name === 'list_contexts_v1') return { data: f.mode === 'expired' ? [] : [context()], error: null };
      if (name === 'get_dashboard_v1') { const data = f.dashboard(); if (f.mode === 'drift') data.context.unit_id = id(99); return { data, error: null }; }
      const lookup = name === 'get_notice_draft_command_v1', mode = lookup ? f.lookupMode : f.commandMode;
      assert.ok(lookup || name === 'create_notice_draft_command_v1', 'no legacy fallback');
      assert.deepEqual(Object.keys(args), lookup ? ['p_context_id', 'p_idempotency_key'] : ['p_context_id', 'p_idempotency_key', 'p_payload']);
      if (mode && ['conflict', 'expiry', 'generic22023', 'generic55000', 'denied', 'missing'].includes(mode)) {
        return { data: null, error: { code: mode === 'denied' ? '42501' : mode === 'missing' ? 'PGRST202' : mode.includes('55000') || mode === 'expiry' ? '55000' : '22023',
          message: mode === 'conflict' ? 'COMMAND_CONFLICT' : mode === 'expiry' ? 'COMMAND_EXPIRED' : 'PRIVATE_ERROR' } };
      }
      if (f.deferred) await f.deferred;
      const key = args.p_idempotency_key;
      let receipt = commands.get(key);
      if (!lookup && !receipt) {
        f.effects++; receipt = { v: 1, purpose: codec.NOTICE_DRAFT_COMMAND, scope: args.p_payload.scope, key,
          request_hash: args.p_payload.request_hash, receipt_id: id(20), notice_id: id(21), success: true, status: 'draft', created_at: '2026-10-24T00:00:00Z' };
        commands.set(key, receipt);
      }
      if (mode === 'malformed') return { data: { success: true }, error: null };
      if (mode === 'foreign') receipt = { ...receipt, scope: { ...scope(), principal_id: id(99) } };
      const data = lookup ? receipt ? { state: 'committed', receipt } : { v: 1, purpose: codec.NOTICE_DRAFT_COMMAND, scope: scope(), key, state: 'absent_at_check' } : receipt;
      return { data, error: null };
    } }; },
  };
  const guarded = { ...guard, dispatchNoticeDraftRpcInput: (input, callback) => guard.dispatchNoticeDraftRpcInput(input, snapshot => { guardSnapshots.push(snapshot); return callback(snapshot); }) };
  const load = makeLoader({ '@/lib/supabase/server': { createClient: async () => client }, './notice-draft-rpc-input': guarded,
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } } });
  f.route = load('src/app/api/customer/v1/communications/notice-draft-commands/route.ts');
  f.legacy = load('src/app/api/customer/v1/communications/notices/route.ts');
  f.load = load;
  f.make = (p = payload(), key = id(7), s = scope()) => codec.prepareNoticeDraftIntent(s, key, p, webcrypto.subtle);
  f.envelope = intent => ({ p_context_id: intent.scope.context_id, p_idempotency_key: intent.key,
    p_payload: { v: 1, purpose: intent.purpose, scope: intent.scope, payload: intent.payload, request_hash: intent.request_hash } });
  f.request = async (body, query = '', headers = {}) => {
    const request = body === undefined ? new Request('https://ce.test/api/customer/v1/communications/notice-draft-commands' + query, { headers })
      : new Request('https://ce.test/api/customer/v1/communications/notice-draft-commands' + query, { method: 'POST', headers: { origin: 'https://ce.test', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) });
    return f.route[request.method](request);
  };
  f.fetch = async (url, init = {}) => {
    assert.ok(String(url).startsWith('/api/customer/v1/communications/notice-draft-commands'), 'durable HTTP never legacy');
    const request = new Request(new URL(url, 'https://ce.test'), { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), origin: 'https://ce.test' } });
    const response = await f.route[request.method](request);
    if (f.loseReply && request.method === 'POST') { f.loseReply = false; throw new Error('LOST_REPLY'); }
    return response;
  };
  return f;
}
export async function runRouteTests() {
  const tests = []; const test = async (name, run) => { await run(); tests.push(name); };
  await test('real Node route, authenticated valid server projection; no client authority', async () => {
    const f = fixture(), res = await f.request(undefined, `?action=scope&context_id=${id(3)}`);
    assert.equal(f.route.runtime, 'nodejs'); assert.equal(res.status, 200); assert.deepEqual(await res.json(), { v: 1, scope: scope() });
    assert.deepEqual(f.calls.map(c => c.name), ['list_contexts_v1', 'get_dashboard_v1']);
    for (const [key, expected] of Object.entries({ 'cache-control': 'no-store, private', pragma: 'no-cache', vary: 'Cookie' })) assert.equal(res.headers.get(key), expected);
  });
  for (const mode of ['drift', 'expired', 'unavailable', 'denied']) await test(`projection ${mode} fails closed`, async () => {
    const f = fixture(); f.mode = mode; const r = await f.request(f.envelope(await f.make()));
    assert.ok([403, 503].includes(r.status)); assert.equal(f.effects, 0); assert.ok(!JSON.stringify(await r.json()).includes('PRIVATE'));
  });
  await test('no identity: no projection or product dispatch', async () => {
    const f = fixture(); f.auth = false; assert.equal((await f.request(f.envelope(await f.make()))).status, 401); assert.equal(f.calls.length, 0);
  });
  for (const field of ['tenant_id', 'principal_id', 'membership_id', 'workspace_id']) await test(`spoofed ${field} rejected against server projection`, async () => {
    const f = fixture(), intent = await f.make(payload(), id(7), { ...scope(), [field]: id(99) });
    assert.equal((await f.request(f.envelope(intent))).status, 403); assert.equal(f.effects, 0);
  });
  await test('command exact ABI, same frozen serialized snapshot; create replay and read-only committed lookup', async () => {
    const f = fixture(), input = f.envelope(await f.make());
    const a = await f.request(input), r = await a.json(); assert.equal(a.status, 201);
    assert.deepEqual(await (await f.request(input)).json(), r); assert.equal(f.effects, 1);
    const read = await f.request(undefined, `?action=lookup&context_id=${id(3)}&key=${id(7)}&request_hash=${r.request_hash}`);
    assert.deepEqual(await read.json(), { state: 'committed', receipt: r }); assert.equal(f.effects, 1);
    assert.equal(f.calls.filter(c => c.name === 'get_notice_draft_command_v1').length, 1);
  });
  await test('RO/FA/nonBMP/combining/literal backslash text retains exact codec hash through actual handler', async () => {
    const f = fixture(), intent = await f.make({ ...payload(), title_ro: 'Ședință', title_fa: 'ا\u0654', body_fa: 'پیام 😀 e\u0301', title_en: '\\u0000' });
    const r = await f.request(f.envelope(intent)); assert.equal(r.status, 201); const receipt = await r.json();
    assert.equal(receipt.request_hash, intent.request_hash);
    assert.equal(f.calls.at(-1).args.p_payload.payload.title_en, '\\u0000');
    assert.equal(f.calls.at(-1).args.p_payload.payload.body_fa, intent.payload.body_fa);
  });
  for (const bad of [new Uint8Array([123,34,120,34,58,34,0xc0,0xaf,34,125]), '{', '{"x":"\\u0000"}', '{"x\\u0000":"text"}', '{"x":"\\ud800"}', '{"x":"\\udfff"}']) {
    await test(`strict byte/decoded JSON rejection ${tests.length}`, async () => {
      const f = fixture(); const r = await f.request(bad); assert.equal(r.status, 400); assert.equal(f.calls.length, 0);
    });
  }
  for (const mutate of [x => x.extra = true, x => x.p_payload.permission = true, x => x.p_payload.payload.extra = 'x',
    x => x.p_payload.request_hash = '0'.repeat(64), x => x.p_payload.payload.title_ro += ' ', x => x.p_context_id = id(9)]) {
    await test(`extra/hash/context/normalization mismatch ${tests.length}`, async () => {
      const f = fixture(), input = f.envelope(await f.make()); const x = JSON.parse(JSON.stringify(input)); mutate(x);
      assert.equal((await f.request(x)).status, 400); assert.equal(f.calls.length, 0);
    });
  }
  await test('stream actual byte limit independent of Content-Length; cancel reader', async () => {
    const f = fixture(); let cancels = 0;
    const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(270000)); }, cancel() { cancels++; } });
    const request = new Request('https://ce.test/api/customer/v1/communications/notice-draft-commands', { method: 'POST', headers: { origin: 'https://ce.test', 'content-type': 'application/json', 'content-length': '1' }, body: stream, duplex: 'half' });
    assert.equal((await f.route.POST(request)).status, 413); assert.equal(cancels, 1); assert.equal(f.calls.length, 0);
  });
  for (const q of [`?action=lookup&context_id=${id(3)}&key=%ED%A0%80&request_hash=${'0'.repeat(64)}`, `?action=scope&context_id=${id(3)}&context_id=${id(3)}`,
    `?action=scope&context_id=${id(3)}&tenant_id=${id(1)}`, `?action=scope&context_id=%ZZ`, `?action=scope&context_id=${id(3)}%00`, `?action=scope&context_id=${'x'.repeat(1100)}`]) {
    await test(`strict query malformed/extra/duplicate ${tests.length}`, async () => { const f = fixture(); assert.equal((await f.request(undefined, q)).status, 400); assert.equal(f.calls.length, 0); });
  }
  await test('origin/media rejection before product dispatch', async () => {
    const f = fixture(), body = f.envelope(await f.make());
    assert.equal((await f.request(body, '', { origin: 'https://foreign.test' })).status, 403);
    assert.equal((await f.request(body, '', { 'content-type': 'text/plain' })).status, 415); assert.equal(f.calls.length, 0);
  });
  await test('actual legacy POST/GET keep flat/null ABI and original result independently of durable route', async () => {
    const calls = [], receipt = { success: true, status: 'draft', notice_id: id(21) };
    const client = { auth: { getClaims: async () => ({ data: { claims: { sub: id(2) } }, error: null }) },
      schema: name => { assert.equal(name, 'customer_api'); return { rpc: async (name, args) => { calls.push({ name, args }); return { data: name === 'create_notice_draft_v1' ? receipt : { rows: [], total: 0 }, error: null }; } }; } };
    const legacy = makeLoader({ '@/lib/supabase/server': { createClient: async () => client },
      'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } } })('src/app/api/customer/v1/communications/notices/route.ts');
    const request = new Request('https://ce.test/api/customer/v1/communications/notices', { method: 'POST', headers: { origin: 'https://ce.test', 'content-type': 'application/json' }, body: JSON.stringify(payload()) });
    const response = await legacy.POST(request); assert.equal(response.status, 201); assert.deepEqual(await response.json(), receipt);
    assert.equal(calls[0].name, 'create_notice_draft_v1'); assert.equal(calls[0].args.p_idempotency_key, null); assert.equal(calls[0].args.p_title_en, null);
    assert.deepEqual(calls[0].args.p_template_params, {});
    const read = new Request(`https://ce.test/api/customer/v1/communications/notices?context_id=${id(3)}`);
    Object.defineProperty(read, 'nextUrl', { value: new URL(read.url) }); const result = await legacy.GET(read);
    assert.equal(result.status, 200); assert.equal(calls[1].name, 'get_official_notices_v1'); assert.equal(calls[1].args.p_limit, 25); assert.equal(calls[1].args.p_status, null);
  });
  for (const [mode, status] of [['conflict', 409], ['expiry', 409], ['generic22023', 503], ['generic55000', 503], ['missing', 503], ['malformed', 503], ['foreign', 503], ['denied', 403]]) {
    await test(`bounded exact domain mapping ${mode}`, async () => {
      const f = fixture(); f.commandMode = mode;
      const r = await f.request(f.envelope(await f.make())); assert.equal(r.status, status); assert.ok(!JSON.stringify(await r.json()).includes('PRIVATE'));
      assert.ok(!f.calls.some(c => c.name === 'create_notice_draft_v1'));
    });
  }
  console.log(JSON.stringify({ suite: 'PM121 actual exported route', status: 'PASS', tests: tests.length, cases: tests, proof: 'OFFLINE_FAKE_CLIENT_ONLY', connected: 'NOT_RUN_NOT_PASS' }, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await runRouteTests();
