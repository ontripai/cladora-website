// Real CE page/ContextProvider + real GET/POST handler. ONLY the database/transport
// boundary is synthetic. No server, SQL parser, DB, network, installation or sends.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { webcrypto, createHash } from 'node:crypto';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = process.env.CE011_SOURCE_ROOT ? path.resolve(process.env.CE011_SOURCE_ROOT) : repo;
const cf212 = process.argv.find(flag => ['--cf212', '--cf212-read', '--cf212-uuid'].includes(flag));
const require = createRequire(path.join(repo, 'package.json'));
const ts = require('typescript'), React = require('react'), { act } = React, { JSDOM } = require('jsdom');
export const id = n => `22900000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const response = (data, status = 200) => Response.json(data, { status });
export async function runEventAcceptance({ baselineOnly = false, commandsOnly = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://ce.test/en/app/community/events' });
  const saved = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const originalFetch = globalThis.fetch, originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const timers = new Set(), unhandled = [], listener = e => unhandled.push(e);
  process.on('unhandledRejection', listener);
  let fastTimeout = false;
  globalThis.setTimeout = (fn, ms, ...args) => {
    if (ms !== 15000) return originalSet(fn, ms, ...args);
    const h = originalSet(() => { timers.delete(h); fn(...args); }, fastTimeout ? 30 : ms); timers.add(h); return h;
  };
  globalThis.clearTimeout = h => { timers.delete(h); originalClear(h); };
  const { createRoot } = require('react-dom/client');
  let root, ctx, language = 'en', backend, posts, gets, mode, rpcCalls, auth, dbError, readMode, readWait, commandWait, decodeWait;
  let currentPermissions, dashboardWait, epoch = 0, readScript, probe, poke, caseRpc, pageCase = false;
  const records = new Map(), cache = new Map(), releases = [];
  const defer = () => { let release; const promise = new Promise(resolve => { release = resolve; }); releases.push(release); return { promise, release }; };
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(sourceRoot, relative), m = new Module(filename); cache.set(relative, m);
    const mocks = {
      'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      'next/server.js': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      '@/lib/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => ({ data: auth ? { claims: { sub: id(2) } } : null, error: null }) },
        schema: name => { assert.equal(name, 'customer_api'); return { rpc: mockRpc }; } }) },
      '@/components/dashboard-lab/DashboardTransport': { useDashboardFetch: () => fakeFetch, useDashboardPreview: () => true },
    };
    m.require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/')) return load(`src/${name.slice(2)}${path.extname(name) ? '' : '.ts'}`);
      if (name.startsWith('.')) {
        let relativePath = path.relative(sourceRoot, path.resolve(path.dirname(filename), name));
        if (!path.extname(relativePath)) relativePath += relativePath.includes('/components/') ? '.tsx' : '.ts';
        return load(relativePath);
      }
      return require(name);
    };
    const result = ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    assert.deepEqual(result.diagnostics, []); m._compile(result.outputText, filename); return m.exports;
  }
  const schema = load('src/lib/community/event-interest-schema.ts'), domain = load('src/lib/community/event-interest-domain.ts');
  const client = load('src/lib/community/event-interest-client.ts'), handler = load('src/app/api/customer/v1/community/events/route.ts');
  const provider = load('src/components/customer/CustomerContextProvider.tsx'), page = load('src/components/customer/CustomerEventInterestPage.tsx');
  const A = '22900000-0000-4000-8000-abcdefabcdef', B = id(90), W = '22900000-0000-4000-8000-bcdefabcdefa', M = '22900000-0000-4000-8000-cdefabcdefab';
  const targetMember = '22900000-0000-4000-8000-defabcdefabc';
  const allPermissions = [...schema.ce011Permissions];
  const contexts = [A, B].map((context_id, i) => ({ context_id, membership_id: i ? id(91) : M, tenant_name: 'Synthetic', role_code: 'owner', role_name: 'Owner', scope_type: 'tenant', context_label: 'Synthetic Context' }));
  function authority(command) { return { tenant_id: id(1), context_id: command.context_id, actor_user_id: id(2), membership_id: command.context_id === A ? M : id(91), represented_party_id: null, workspace_id: command.workspace_id,
    membership_active: auth, capability_active: true, capability_code: 'ce.event.basic', module_code: 'community_events', audience_policy_id: id(6), audience_policy_version: 1, audience_result: 'eligible', assurance_level: 'aal1', evaluated_at: '2026-10-26T12:00:00Z', role_codes: ['owner'], permissions: currentPermissions }; }
  function eventItems(workspace) {
    return Object.values(backend.events).filter(e => e.workspace_id.toLowerCase() === workspace.toLowerCase()).map(e => {
      const interest = backend.interests[`${e.id}:${M}`];
      return { event_id: e.id, occurrence_id: e.occurrence_id, workspace_id: e.workspace_id, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at, timezone: e.timezone, status: e.status, version: e.version,
        audience_kind: e.audience.kind, interest_status: interest?.status ?? null, interest_version: interest?.version ?? 0,
        can_publish: currentPermissions.includes('events.event.publish') && e.status === 'draft', can_cancel: currentPermissions.includes('events.event.cancel') && e.status === 'published',
        can_register_interest: currentPermissions.includes('events.interest.manage_self') && e.status === 'published' && interest?.status !== 'interested', can_withdraw_interest: currentPermissions.includes('events.interest.manage_self') && e.status === 'published' && interest?.status === 'interested',
        can_record_attendance: currentPermissions.includes('events.attendance.record') && e.status === 'published', eligible_attendance_members: currentPermissions.includes('events.attendance.record') && e.status === 'published' ? [{ membership_id: targetMember, display_name: 'Named synthetic participant' }] : [] };
    });
  }
  async function mockRpc(name, args) {
    rpcCalls.push({ name, args });
    if (caseRpc) return caseRpc(name, args);
    if (dbError) return { data: null, error: { code: dbError } };
    if (name === 'read_ce_events_v1') {
      if (!currentPermissions.includes('events.event.read')) return { data: null, error: { code: '42501' } };
      const data = { workspace_id: args.p_workspace_id, events: eventItems(args.p_workspace_id) };
      return { data: readMode === 'null' ? null : readMode === 'foreign' ? { ...data, workspace_id: id(999) } : readMode === 'partial' ? { workspace_id: args.p_workspace_id } : data, error: null };
    }
    assert.equal(name, 'command_ce_event_v1'); const command = schema.eventCommandSchema.parse(args.p_request);
    assert.equal('actor_user_id' in command, false);
    const result = domain.applyEventCommand(backend, command, authority(command), '2026-10-26T12:00:00Z', { membership_id: targetMember, workspace_id: command.workspace_id, role_codes: ['owner'], membership_active: true });
    if (!result.ok) return { data: null, error: { code: result.code.includes('DENIED') ? '42501' : '40001' } };
    backend = result.state;
    const savedReceipt = records.get(command.command_id);
    // Exact five fields emitted by proposal lines297-306; this envelope is an
    // explicit fake-DB adapter, not a PostgreSQL/transaction proof.
    const entity_type = ['create_event', 'publish_event', 'cancel_event'].includes(command.type) ? 'event' : command.type.includes('interest') ? 'event_interest' : 'event_attendance';
    const entity_id = savedReceipt?.entity_id ?? (entity_type === 'event' ? command.event_id : command.type === 'correct_attendance' ? command.attendance_id : command.type === 'record_attendance' ? command.command_id : id(50));
    const data = { entity_type, entity_id, version: result.version, command: command.type, replayed: result.replayed };
    records.set(command.command_id, data);
    return { data: mode === 'null' ? null : mode === 'partial' ? { entity_type } : mode === 'foreign_version' ? { ...data, version: data.version + 10 } : data, error: null };
  }
  function request(url, init = {}) {
    const value = new Request(new URL(url, 'http://ce.test'), init);
    value.nextUrl = new URL(value.url); return value;
  }
  async function fakeFetch(input, init = {}) {
    const url = String(input); assert.ok(url.startsWith('/api/customer/v1/'), 'no product network');
    if (url.endsWith('/contexts')) return response({ contexts });
    if (url.startsWith('/api/customer/v1/dashboard')) {
      if (dashboardWait) await dashboardWait;
      const contextId = new URL(url, 'http://ce.test').searchParams.get('context_id');
      return response({ contextId, workspace_id: pageCase ? W.toUpperCase() : W, context: { role_code: 'owner' }, permissions: currentPermissions, entitlements: ['module.community_events'], modules: ['community_events'] });
    }
    if (init.method === 'POST') {
      posts.push({ body: init.body, signal: init.signal });
      if (commandWait) await commandWait;
      if (mode === 'network') throw new Error('PRIVATE_NETWORK');
      if (mode === '500') return response({ error: { message: 'PRIVATE_ERROR' } }, 500);
      if (mode === '401' || mode === '403' || mode === '409') return response({ error: { message: 'PRIVATE_ERROR' } }, +mode);
      const result = await handler.POST(request(url, { ...init, headers: { ...init.headers, Origin: 'http://ce.test' } }));
      if (mode === 'lost') throw new Error('LOST_REPLY_AFTER_FAKE_COMMIT');
      if (decodeWait) return { ok: result.ok, status: result.status, json: async () => { await decodeWait; return result.json(); } };
      return result;
    }
    gets.push(url); if (readScript) return readScript(url, init); if (readWait) await readWait;
    return handler.GET(request(url));
  }
  globalThis.fetch = fakeFetch;
  function Probe() { ctx = provider.useCustomerContext(); return null; }
  function CommitParent() {
    const [version, setVersion] = React.useState(0); poke = () => setVersion(value => value + 1);
    React.useLayoutEffect(() => { probe?.('layout', version); }, [version]);
    React.useEffect(() => { probe?.('passive', version); }, [version]);
    return React.createElement(provider.CustomerContextProvider, null, React.createElement(Probe), React.createElement(page.CustomerEventInterestPage, { lang: language }));
  }
  function tree() { return React.createElement(CommitParent); }
  const tick = (ms = 4) => act(async () => { await new Promise(resolve => originalSet(resolve, ms)); });
  async function flush() { for (let n = 0; n < 7; n++) await tick(); }
  async function render() { await act(async () => root.render(tree())); await flush(); }
  const q = selector => document.querySelector(selector), text = () => document.body.textContent;
  async function edit(node, value) {
    assert.ok(node, 'input exists'); const proto = node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
  }
  async function click(node, count = 1) { assert.ok(node, 'button exists'); await act(async () => { for (let n = 0; n < count; n++) node.click(); }); await flush(); }
  async function submit(form, count = 1) { assert.ok(form, 'form exists'); await act(async () => { for (let n = 0; n < count; n++) form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await flush(); }
  function seed(status = 'published') {
    backend.events[id(10)] = { id: id(10), workspace_id: W, occurrence_id: id(11), community_ref: null, title: 'Synthetic private event', starts_at: '2026-11-01T12:00:00Z', ends_at: '2026-11-01T13:00:00Z', timezone: 'Europe/Bucharest', audience: { kind: 'workspace' }, status, version: 1 };
  }
  const cases = [];
  async function test(name, fn, lang = 'en', setup = () => seed()) {
    if (process.env.CE011_READ_VARIANT && name.startsWith('CF212: READ') && !name.includes('READ ' + process.env.CE011_READ_VARIANT + ' ')) return;
    const affectedControl = name.startsWith('en: seven actual commands') || name.startsWith('all seven HTTP commands deny') || name.startsWith('late JSON after') || name.startsWith('lost reply exact replay after revoke') || name.startsWith('same binding remount') || name.startsWith('bounded timeout remains') || name.startsWith('pre-render admission:') || name.startsWith('refresh admission revoked');
    if (cf212 && !(name.startsWith('CF212:') && (cf212 === '--cf212' || name.includes(cf212.endsWith('read') ? 'READ' : 'UUID'))) && !(cf212 === '--cf212' && affectedControl)) return;
    language = lang; readScript = null; probe = null; caseRpc = null; pageCase = false; contexts[0].context_id = A; contexts[0].membership_id = M; backend = domain.emptyCe011State(); records.clear(); posts = []; gets = []; rpcCalls = []; mode = ''; auth = true; dbError = ''; readMode = ''; readWait = null; commandWait = null; decodeWait = null; dashboardWait = null; currentPermissions = [...allPermissions]; fastTimeout = false; epoch++;
    sessionStorage.clear(); setup(); root = createRoot(q('#root'));
    try { await render(); await fn(); cases.push(name); }
    finally { await act(async () => root.unmount()); for (const release of releases.splice(0)) release(); await flush(); assert.equal(timers.size, 0, `${name}: owned deadlines cleaned`); }
  }
  try {
    for (const late of ['response', 'json']) for (const withPending of [true, false]) for (const refreshCount of [1, 2]) await test(`CF212: READ ${late} ${withPending ? 'pending' : 'admission'} ${refreshCount} refresh commit before passive cleanup cannot restore old data/admission`, async () => {
      let wire, oldSubmit;
      if (withPending) { mode = 'network'; await click(q('[data-event-action="register_interest"]')); wire = posts[0].body; mode = ''; }
      else {
        const form = q('[data-create-event]');
        for (const [field, value] of Object.entries({ title: 'Queued command must stay blocked', starts_at: '2026-11-02T12:00', ends_at: '2026-11-02T13:00', reason: 'Stale owner admission proof' })) await edit(form.querySelector(`[data-create-field="${field}"]`), value);
        const key = Object.keys(form).find(key => key.startsWith('__reactProps$')); oldSubmit = form[key].onSubmit;
      }
      const r1 = defer(), denial = defer(); const ordering = [], visible = []; let number = 0;
      const oldData = { workspace_id: W, events: eventItems(W).map(item => ({ ...item, title: 'OLD_PRIVATE_VISIBLE' })) };
      const oldResponse = { ok: true, status: 200, json: async () => { ordering.push('R1-json-start'); if (late === 'json') await r1.promise; ordering.push('R1-json-decoded'); return oldData; } };
      readScript = async () => {
        number++; ordering.push(`GET-${number}`);
        if (number === 1) { if (late === 'response') await r1.promise; return oldResponse; }
        await denial.promise; return response({ error: { code: 'ACCESS_DENIED' } }, 403);
      };
      await click(q('[data-event-refresh]')); assert.equal(number, 1, 'R1 is pending before second refresh');
      const observer = new dom.window.MutationObserver(() => {
        for (const h of document.querySelectorAll('h2')) if (h.textContent.includes('OLD_PRIVATE_VISIBLE') && !h.closest('[hidden]')) visible.push(h.textContent);
      }); observer.observe(q('#root'), { childList: true, subtree: true, attributes: true, characterData: true });
      probe = (phase, version) => {
        if (version !== 1) return;
        ordering.push(`refresh2-parent-${phase}`);
        if (phase === 'layout') {
          queueMicrotask(async () => { r1.release(); for (let i = 0; i < 12; i++) await Promise.resolve(); ordering.push('stale-continuation-drained-before-passive'); if (oldSubmit) oldSubmit({ preventDefault() {} }); });
          // Consume one Scheduler slice in a real parent layout. This forces a
          // yield without replacing product hooks, React effects or Scheduler.
          const end = performance.now() + 12; while (performance.now() < end) { /* bounded scheduling fixture */ }
        }
      };
      globalThis.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        const refreshButton = q('[data-event-refresh]');
        const propsKey = Object.keys(refreshButton).find(key => key.startsWith('__reactProps$'));
        const actualMountedRefresh = refreshButton[propsKey].onClick;
        assert.equal(typeof actualMountedRefresh, 'function');
        // Invoke the actual mounted callback in the SAME transition as the
        // real parent commit; a DOM click would force a separate discrete lane.
        React.startTransition(() => { for (let n = 0; n < refreshCount; n++) actualMountedRefresh(); poke(); });
        await new Promise(resolve => originalSet(resolve, 90));
        assert.ok(ordering.indexOf('stale-continuation-drained-before-passive') > ordering.indexOf('refresh2-parent-layout'), JSON.stringify(ordering));
        assert.ok(ordering.indexOf('stale-continuation-drained-before-passive') < ordering.indexOf('refresh2-parent-passive'), 'required real before-passive ordering: ' + JSON.stringify(ordering));
        console.error(JSON.stringify({ schedule: late, ordering, visible }));
        assert.deepEqual(visible, [], 'CF01 OLD_PRIVATE_VISIBLE before denial: ' + JSON.stringify(ordering));
        denial.release(); await new Promise(resolve => originalSet(resolve, 30));
        assert.equal(posts.length, withPending ? 1 : 0, 'no admission/POST from old read owner'); if (withPending) assert.equal(posts[0].body, wire); assert.doesNotMatch(text(), /OLD_PRIVATE_VISIBLE/);
      } finally { observer.disconnect(); probe = null; globalThis.IS_REACT_ACT_ENVIRONMENT = true; }
      if (withPending) {
        assert.match(q('[data-command-status]').textContent, /not yet known/);
        readScript = null; await click(q('[data-event-refresh]')); await click(q('[data-command-replay]'));
        assert.equal(posts[1].body, wire, 'read invalidation never rewrites retained pending request');
      }
    });
    await test('CF212: UUID fresh/replay create publish cancel correction preserve exact initial command', async () => {
      const upper = 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', lower = upper.toLowerCase();
      const base = { ...client.newEventCommandIdentity(() => upper), context_id: A, workspace_id: W, event_id: upper, expected_version: 4, reason: 'Case equivalence without changing command' };
      for (const [type, version] of [['create_event',1],['publish_event',5],['cancel_event',5],['correct_attendance',3]]) {
        const command = schema.eventCommandSchema.parse({ ...base, type, ...(type === 'create_event' ? { expected_version: 0, occurrence_id: upper, title: 'Case test', starts_at: '2026-11-01T12:00:00Z', ends_at: '2026-11-01T13:00:00Z', timezone: 'Europe/Bucharest', audience: { kind: 'workspace' } } : {}), ...(type === 'correct_attendance' ? { attendance_id: upper, expected_attendance_version: 2, attended: false, observed_local: '2026-11-01T14:00', timezone: 'Europe/Bucharest' } : {}) });
        const before = JSON.stringify(command);
        for (const replayed of [false, true]) assert.equal(client.parseEventCommandResult({ entity_type: type === 'correct_attendance' ? 'event_attendance' : 'event', entity_id: lower, version, command: type, replayed }, command).entity_id, lower);
        assert.equal(JSON.stringify(command), before);
      }
    });
    await test('CF212: UUID session/route fresh and replay preserve original wire/key/body/fingerprint input', async () => {
      const upper = 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', lower = upper.toLowerCase();
      for (const type of ['create_event', 'publish_event', 'cancel_event', 'correct_attendance']) {
        const input = { ...client.newEventCommandIdentity(() => upper), context_id: A.toUpperCase(), workspace_id: W.toUpperCase(), event_id: upper, expected_version: 4, reason: 'Preserve original case fingerprint', type,
          ...(type === 'create_event' ? { expected_version: 0, occurrence_id: upper, title: 'Case event', starts_at: '2026-11-01T12:00:00Z', ends_at: '2026-11-01T13:00:00Z', timezone: 'Europe/Bucharest', audience: { kind: 'workspace' } } : {}),
          ...(type === 'correct_attendance' ? { attendance_id: upper, expected_attendance_version: 2, attended: true, observed_local: '2026-11-01T14:00', timezone: 'Europe/Bucharest' } : {}) };
        const expectedWire = JSON.stringify(schema.eventCommandSchema.parse(input));
        const expectedHash = createHash('sha256').update(expectedWire).digest('hex');
        const seen = [], owner = {}; let attempt = 0, accepted = 0;
        caseRpc = async (name, args) => {
          assert.equal(name, 'command_ce_event_v1'); assert.deepEqual(args.p_request, JSON.parse(expectedWire));
          assert.equal(createHash('sha256').update(JSON.stringify(args.p_request)).digest('hex'), expectedHash);
          return { data: { entity_type: type === 'correct_attendance' ? 'event_attendance' : 'event', entity_id: lower, version: type === 'create_event' ? 1 : type === 'correct_attendance' ? 3 : 5, command: type, replayed: true }, error: null };
        };
        const session = client.createEventCommandSession({ contextId: A, workspaceId: W, owner: () => owner, onState() {}, accepted() { accepted++; }, denied() {}, fetch: async (url, init) => {
          seen.push(init.body); if (attempt++ === 0) return response({}, 500);
          return handler.POST(request(url, { ...init, headers: { ...init.headers, Origin: 'http://ce.test' } }));
        } });
        assert.equal(await session.send(input), false); assert.equal(session.getState().phase, 'unknown');
        assert.equal(session.getState().pending.wire, expectedWire); assert.equal(session.getState().pending.command.context_id, input.context_id);
        assert.equal(await session.replay(), true); assert.deepEqual(seen, [expectedWire, expectedWire]); assert.equal(accepted, 1);
        assert.equal(session.getState().receipt.entity_id, lower); assert.equal(JSON.stringify(schema.eventCommandSchema.parse(input)), expectedWire);
        assert.equal(createHash('sha256').update(seen[1]).digest('hex'), expectedHash, 'comparison never rewrites fingerprint input');
      }
    });
    await test('CF212: UUID GET Workspace mixed case, duplicate identity and foreign/malformed/type/version negatives', async () => {
      const mixed = { workspace_id: W.toUpperCase(), events: eventItems(W) };
      assert.equal(client.eventReadResponseSchema.safeParse(mixed).success, true);
      const event = { ...mixed.events[0], event_id: 'abcdefab-cdef-4abc-8def-abcdefabcdef' }, duplicate = { ...event, event_id: event.event_id.toUpperCase() };
      assert.equal(client.eventReadResponseSchema.safeParse({ ...mixed, events: [event, duplicate] }).success, false);
      const member = event.eligible_attendance_members[0];
      assert.equal(client.eventReadResponseSchema.safeParse({ ...mixed, events: [{ ...event, eligible_attendance_members: [member, { ...member, membership_id: member.membership_id.toUpperCase() }] }] }).success, false);
      caseRpc = async (name, args) => { assert.equal(name, 'read_ce_events_v1'); assert.equal(args.p_workspace_id, W.toUpperCase()); return { data: { workspace_id: W, events: eventItems(W) }, error: null }; };
      const result = await handler.GET(request(`/api/customer/v1/community/events?context_id=${A.toUpperCase()}&workspace_id=${W.toUpperCase()}`)); assert.equal(result.status, 200);
      assert.equal(client.sameEventUuid(A, A.toUpperCase()), true); assert.equal(client.sameEventUuid('bad', 'BAD'), false); assert.equal(client.sameEventUuid(A, B), false);
      const command = { ...client.newEventCommandIdentity(() => id(31)), type: 'publish_event', context_id: A, workspace_id: W, event_id: 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', expected_version: 2, reason: 'Negative case binding' };
      const receipt = { entity_type: 'event', entity_id: command.event_id.toLowerCase(), version: 3, command: 'publish_event', replayed: false };
      for (const bad of [{ ...receipt, entity_id: B }, { ...receipt, entity_id: 'malformed' }, { ...receipt, entity_type: 'event_interest' }, { ...receipt, command: 'cancel_event' }, { ...receipt, version: 4 }, { ...receipt, replayed: 1 }]) assert.throws(() => client.parseEventCommandResult(bad, command));
      const owner = {}, blocked = client.createEventCommandSession({ contextId: A, workspaceId: W, owner: () => owner, onState() {}, accepted() {}, denied() {}, fetch: () => { throw new Error('must not dispatch'); } });
      assert.equal(await blocked.send({ ...command, context_id: B }), false); assert.equal(blocked.getState().pending, null);
      assert.throws(() => blocked.send({ ...command, context_id: 'bad' }));
    });
    await test('CF212: UUID actual page uppercase Context and Workspace/member case change retain session and named binding', async () => {
      const validEvents = () => eventItems(W).map(event => ({ ...event, event_id: pageCase ? 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF' : 'abcdefab-cdef-4abc-8def-abcdefabcdef', eligible_attendance_members: event.eligible_attendance_members.map(member => ({ ...member, membership_id: pageCase ? targetMember.toUpperCase() : targetMember })) }));
      caseRpc = async (name, args) => {
        if (name === 'read_ce_events_v1') return { data: { workspace_id: W, events: validEvents() }, error: null };
        const command = args.p_request;
        // Typed UUID output simulation only. Original command reaches RPC unchanged;
        // no SQL parser, hash normalization, persistence or permission proof implied.
        return { data: { entity_type: command.type.includes('interest') ? 'event_interest' : 'event_attendance', entity_id: command.type === 'correct_attendance' ? command.attendance_id.toLowerCase() : id(55), version: command.type === 'correct_attendance' ? command.expected_attendance_version + 1 : 1, command: command.type, replayed: true }, error: null };
      };
      await act(async () => ctx.refresh()); await flush();
      assert.ok(q('[data-record-attendance]'), JSON.stringify({ text: text(), gets, rpcCalls, active: ctx.active, dashboard: ctx.dashboard }));
      await edit(q('[data-record-attendance] select'), targetMember.toUpperCase()); await edit(q('[data-record-attendance] input'), '2026-11-01T14:00');
      mode = 'network'; await click(q('[data-event-action="register_interest"]')); const wire = posts[0].body; assert.equal(JSON.parse(wire).context_id, A.toUpperCase());
      pageCase = false; await act(async () => ctx.refresh()); await flush();
      assert.match(q('[data-command-status]').textContent, /not yet known/); assert.equal(q('[data-record-attendance] select').value, targetMember);
      mode = ''; await click(q('[data-command-replay]')); assert.equal(posts[1].body, wire); assert.match(q('[data-command-status]').textContent, /confirmed/);
      await submit(q('[data-record-attendance]')); const record = JSON.parse(posts[2].body); assert.equal(record.target_membership_id, targetMember.toUpperCase(), 'raw form snapshot was not normalized');
      assert.ok(q('[data-correct-attendance]')); assert.match(q('[data-correct-attendance]').textContent, /Named synthetic participant/);
    }, 'en', () => { seed(); pageCase = true; contexts[0].context_id = A.toUpperCase(); contexts[0].membership_id = M.toUpperCase(); });
    if (!commandsOnly) {
    await test('actual page -> handler -> strict projection; named choices, no UUID display', async () => {
      assert.match(text(), /Synthetic private event/); assert.match(text(), /not a booking/); assert.doesNotMatch(text(), new RegExp(id(10)));
      assert.equal(q('select option[value="'+targetMember+'"]').textContent, 'Named synthetic participant');
      await click(q('[data-event-action="register_interest"]'), 2);
      assert.equal(posts.length, 1); const c = JSON.parse(posts[0].body);
      assert.equal(c.expected_version, 1); assert.equal(c.expected_interest_version, 0); assert.equal(c.context_id, A); assert.equal(c.workspace_id, W);
      assert.match(q('[data-command-status]').textContent, /confirmed/);
      assert.equal(backend.audits.length, 1);
    });
    for (const shape of ['null', 'partial', 'foreign']) await test(`strict GET ${shape} never displays private projection`, async () => {
      readMode = shape; await click(q('[data-event-refresh]')); assert.doesNotMatch(text(), /Synthetic private event/);
    });
    await test('missing official RPC yields actionable NOT_READY, no fabricated success', async () => {
      dbError = '42883'; await click(q('[data-event-refresh]')); assert.match(text(), /not been activated/);
    });
    await test('HTTP boundary preserves origin/auth/bodylimit/no-store and strict result', async () => {
      const c = { ...client.newEventCommandIdentity(() => id(33)), type: 'publish_event', context_id: A, workspace_id: W, event_id: id(10), expected_version: 1, reason: 'Synthetic review' };
      for (const [headers, body, status] of [[{ 'Content-Type': 'application/json' }, JSON.stringify(c), 403], [{ Origin: 'http://ce.test', 'Content-Type': 'text/plain' }, '{}', 415], [{ Origin: 'http://ce.test', 'Content-Type': 'application/json' }, 'x'.repeat(17000), 413]]) {
        const result = await handler.POST(request('/api/customer/v1/community/events', { method: 'POST', headers, body })); assert.equal(result.status, status); assert.match(result.headers.get('cache-control'), /no-store, private/);
      }
      auth = false; const result = await handler.GET(request(`/api/customer/v1/community/events?context_id=${A}&workspace_id=${W}`)); assert.equal(result.status, 401);
      auth = true; const result2 = await handler.GET(request(`/api/customer/v1/community/events?context_id=${A}&context_id=${A}&workspace_id=${W}`)); assert.equal(result2.status, 400);
    });
    }
    if (!baselineOnly) {
      await test('all seven HTTP commands deny missing independent permissions with zero fake-domain writes', async () => {
        const base = { ...client.newEventCommandIdentity(() => id(37)), context_id: A, workspace_id: W, event_id: id(10), expected_version: 1, reason: 'Independent permission check' };
        const variants = [
          [{ ...base, type: 'create_event', event_id: id(38), expected_version: 0, occurrence_id: id(39), title: 'Synthetic', starts_at: '2026-11-01T12:00:00Z', ends_at: '2026-11-01T13:00:00Z', timezone: 'Europe/Bucharest', audience: { kind: 'workspace' } }, 'events.event.publish'],
          [{ ...base, type: 'publish_event' }, 'events.event.publish'], [{ ...base, type: 'cancel_event' }, 'events.event.cancel'],
          [{ ...base, type: 'register_interest', expected_interest_version: 0 }, 'events.interest.manage_self'],
          [{ ...base, type: 'withdraw_interest', expected_interest_version: 1 }, 'events.interest.manage_self'],
          [{ ...base, type: 'record_attendance', target_membership_id: targetMember, observed_local: '2026-11-01T14:00', timezone: 'Europe/Bucharest' }, 'events.attendance.record'],
          [{ ...base, type: 'correct_attendance', attendance_id: id(55), expected_attendance_version: 1, attended: false, observed_local: '2026-11-01T14:00', timezone: 'Europe/Bucharest' }, 'events.attendance.correct'],
        ];
        backend.attendance[id(55)] = { id: id(55), event_id: id(10), workspace_id: W, membership_id: targetMember, attended: true, observed_local: '2026-11-01T14:00', timezone: 'Europe/Bucharest', version: 1 };
        for (const [command, permission] of variants) {
          currentPermissions = allPermissions.filter(p => p !== permission);
          const before = JSON.stringify(backend);
          const result = await handler.POST(request('/api/customer/v1/community/events', { method: 'POST', headers: { Origin: 'http://ce.test', 'Content-Type': 'application/json' }, body: JSON.stringify(command) }));
          assert.equal(result.status, 403, command.type); assert.equal(JSON.stringify(backend), before, command.type + ': zero fake-domain writes');
        }
      });
      await test('all seven command result contracts reject null/partial/foreign version/type and wrong known IDs', async () => {
        const base = { ...client.newEventCommandIdentity(() => id(33)), context_id: A, workspace_id: W, event_id: id(10), expected_version: 2, reason: 'Synthetic result oracle' };
        const variants = [
          [{ ...base, type: 'create_event', expected_version: 0, occurrence_id: id(11), title: 'Synthetic', starts_at: '2026-11-01T12:00:00Z', ends_at: '2026-11-01T13:00:00Z', timezone: 'Europe/Bucharest', audience: { kind: 'workspace' } }, 'event', id(10), 1],
          [{ ...base, type: 'publish_event' }, 'event', id(10), 3], [{ ...base, type: 'cancel_event' }, 'event', id(10), 3],
          [{ ...base, type: 'register_interest', expected_interest_version: 0 }, 'event_interest', id(50), 1],
          [{ ...base, type: 'withdraw_interest', expected_interest_version: 1 }, 'event_interest', id(50), 2],
          [{ ...base, type: 'record_attendance', target_membership_id: targetMember, observed_local: '2026-11-01T14:00', timezone: 'Europe/Bucharest' }, 'event_attendance', id(55), 1],
          [{ ...base, type: 'correct_attendance', attendance_id: id(55), expected_attendance_version: 3, attended: false, observed_local: '2026-11-01T14:00', timezone: 'Europe/Bucharest' }, 'event_attendance', id(55), 4],
        ];
        for (const [command, entity_type, entity_id, version] of variants) {
          schema.eventCommandSchema.parse(command);
          const expected = { command: command.type, entity_type, entity_id, version, replayed: false };
          assert.deepEqual(client.parseEventCommandResult(expected, command), expected);
          assert.equal(client.parseEventCommandResult({ ...expected, replayed: true }, command).version, version);
          for (const bad of [null, {}, [], { ...expected, version: version + 1 }, { ...expected, command: 'unknown' }, { ...expected, replayed: 'true' }, { ...expected, private: 'SECRET' }, { ...expected, entity_type: 'wrong' }]) assert.throws(() => client.parseEventCommandResult(bad, command));
          if (entity_type === 'event' || command.type === 'correct_attendance') assert.throws(() => client.parseEventCommandResult({ ...expected, entity_id: id(999) }, command));
        }
      });
      for (const lang of ['en', 'ro', 'fa']) await test(`${lang}: seven actual commands; exact versions and independent correction permission`, async () => {
        const create = q('[data-create-event]');
        for (const [field, value] of Object.entries({ title: 'New synthetic event', starts_at: '2026-11-02T12:00', ends_at: '2026-11-02T13:00', reason: 'Create independent base event' })) await edit(create.querySelector(`[data-create-field="${field}"]`), value);
        await submit(create, 2); assert.equal(posts.length, 1); let c = JSON.parse(posts[0].body); assert.equal(c.type, 'create_event'); assert.equal(c.community_ref, null); assert.equal(c.expected_version, 0);
        await click(q('[data-event-action="publish_event"]'), 2);
        await click(q('[data-event-action="register_interest"]'), 2);
        await click(q('[data-event-action="withdraw_interest"]'), 2);
        await edit(q('[data-record-attendance] select'), targetMember); await edit(q('[data-record-attendance] input'), '2026-11-02T14:00'); await submit(q('[data-record-attendance]'), 2);
        assert.ok(q('[data-correct-attendance]')); await edit(q('[data-correct-attendance] textarea'), 'Correct the recorded observation'); await edit(q('[data-correct-attendance] select'), 'false'); await submit(q('[data-correct-attendance]'), 2);
        await click(q('[data-event-action="cancel_event"]'), 2);
        assert.deepEqual(posts.map(p => JSON.parse(p.body).type), ['create_event','publish_event','register_interest','withdraw_interest','record_attendance','correct_attendance','cancel_event']);
        assert.equal(backend.audits.length, 7); assert.equal(q('section').dir, lang === 'fa' ? 'rtl' : 'ltr');
        c = JSON.parse(posts[5].body); assert.equal(c.expected_attendance_version, 1); assert.equal(c.attended, false);
        assert.equal(posts.length, 7, 'sync duplicate events admitted once');
      }, lang, () => {});
      for (const failMode of ['network','500','null','partial','foreign_version']) await test(`UNKNOWN ${failMode}: frozen request, refresh not proof, explicit replay same key/body`, async () => {
        mode = failMode; await click(q('[data-event-action="register_interest"]'), 2); assert.equal(posts.length, 1);
        assert.match(q('[data-command-status]').textContent, /not yet known/); const wire = posts[0].body;
        await click(q('[data-event-refresh]')); assert.match(q('[data-command-status]').textContent, /not yet known/); assert.equal(posts.length, 1);
        mode = ''; await click(q('[data-command-replay]'), 2); assert.equal(posts.length, 2); assert.equal(posts[1].body, wire);
        assert.equal(backend.audits.length, 1); assert.match(q('[data-command-status]').textContent, /confirmed/);
      });
      await test('lost reply exact replay after revoke denies without stale private details or new key', async () => {
        mode = 'lost'; await click(q('[data-event-action="register_interest"]')); assert.equal(backend.audits.length, 1); const wire = posts[0].body;
        mode = ''; currentPermissions = ['events.event.read']; await click(q('[data-command-replay]'));
        assert.equal(posts[1].body, wire); assert.equal(backend.audits.length, 1); assert.doesNotMatch(text(), /Synthetic private event/); assert.ok(q('[data-command-status]').textContent.includes('not yet known'));
      });
      for (const status of ['401','403','409']) await test(`HTTP${status}: preserve submitted input; no automatic retry; denial hides stale data`, async () => {
        mode = status; await edit(q('[data-record-attendance] select'), targetMember); await edit(q('[data-record-attendance] input'), '2026-11-01T14:00'); await submit(q('[data-record-attendance]'));
        assert.equal(posts.length, 1); assert.match(q('[data-command-status]').textContent, /rejected/);
        if (status === '409') { assert.equal(q('[data-record-attendance] input').value, '2026-11-01T14:00'); await click(q('[data-event-refresh]')); assert.equal(posts.length, 1); mode = ''; backend.events[id(10)].version = 2; await click(q('[data-event-refresh]')); await click(q('[data-command-reset]')); await submit(q('[data-record-attendance]')); assert.equal(posts.length, 2); assert.equal(JSON.parse(posts[1].body).expected_version, 2); assert.notEqual(JSON.parse(posts[1].body).command_id, JSON.parse(posts[0].body).command_id); }
        else assert.doesNotMatch(text(), /Synthetic private event/);
        assert.doesNotMatch(text(), /PRIVATE_ERROR/);
      });
      await test('permission independence: record-only has no correction; create is publish permission, not persona', async () => {
        currentPermissions = ['events.event.read', 'events.attendance.record']; await act(async () => ctx.refresh()); await flush();
        assert.equal(q('[data-create-event]'), null); assert.equal(q('[data-correct-attendance]'), null); assert.ok(q('[data-record-attendance]'));
        currentPermissions = ['events.event.read','events.attendance.correct']; await act(async () => ctx.refresh()); await flush();
        assert.equal(q('[data-record-attendance]'), null); assert.ok(q('[data-correction-not-ready]'));
      });
      for (const navigation of ['context','locale','same-tuple-loading','unmount']) await test(`late JSON after ${navigation}: no receipt/success, pending retained, no old finally`, async () => {
        let release; decodeWait = new Promise(resolve => { release = resolve; });
        await click(q('[data-event-action="register_interest"]')); const count = posts.length;
        if (navigation === 'context') await act(async () => ctx.select(B));
        if (navigation === 'locale') { language = 'ro'; await render(); }
        if (navigation === 'same-tuple-loading') { dashboardWait = defer().promise; await act(async () => ctx.refresh()); }
        if (navigation === 'unmount') { await act(async () => root.unmount()); root = { unmount() {} }; }
        release(); await flush(); assert.equal(posts.length, count); assert.doesNotMatch(q('[data-command-status]')?.textContent ?? '', /confirmed|confirmat/);
      });
      await test('refresh admission revoked before render; old action cannot POST', async () => {
        const old = q('[data-event-action="register_interest"]'), refresh = q('[data-event-refresh]');
        readWait = defer().promise;
        await act(async () => { refresh.click(); old.click(); });
        assert.equal(posts.length, 0);
      });
      await test('pre-render admission: edit and second action cannot mutate dispatched snapshot', async () => {
        commandWait = defer().promise; const select = q('[data-record-attendance] select'), input = q('[data-record-attendance] input');
        await edit(select, targetMember); await edit(input, '2026-11-01T14:00');
        const form = q('[data-record-attendance]'), button = q('[data-event-action="register_interest"]');
        await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); button.click();
          Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, '2026-11-01T16:00'); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
        assert.equal(posts.length, 1); assert.equal(JSON.parse(posts[0].body).observed_local, '2026-11-01T14:00');
      });
      await test('bounded timeout remains UNKNOWN; no automatic resend or replacement identity', async () => {
        fastTimeout = true; commandWait = defer().promise; await click(q('[data-event-action="register_interest"]')); await tick(50);
        assert.equal(posts.length, 1); assert.ok(posts[0].signal.aborted); assert.match(q('[data-command-status]').textContent, /not yet known/);
      });
      await test('same binding remount retains pending; explicit same-wire replay after Context return', async () => {
        mode = 'network'; await click(q('[data-event-action="register_interest"]')); const wire = posts[0].body;
        await act(async () => ctx.select(B)); await flush(); await act(async () => ctx.select(A)); await flush();
        assert.match(q('[data-command-status]').textContent, /not yet known/); mode = ''; await click(q('[data-command-replay]')); assert.equal(posts[1].body, wire);
      });
    }
    assert.equal(unhandled.length, 0);
    return { task: cf212 ? 'V14-CE011-CF01-CF02-SUCCESSOR-01' : 'V14-CE011-EXEC-01', selection: cf212 ?? 'existing', source_root: sourceRoot, result: 'PASS', cases, count: cases.length, evidence: 'ACTUAL_PAGE_CONTEXT_PROVIDER_HANDLER_DOMAIN_WITH_FAKE_DB_AND_TRANSPORT_ONLY', cleanup: 'NO_OWNED_TIMERS_OR_UNHANDLED_REJECTIONS', connected: 'NOT_RUN_NOT_PASS' };
  } finally {
    globalThis.fetch = originalFetch; globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; process.off('unhandledRejection', listener);
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    dom.window.close();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await runEventAcceptance({ commandsOnly: process.argv.includes('--commands-only') }), null, 2));
