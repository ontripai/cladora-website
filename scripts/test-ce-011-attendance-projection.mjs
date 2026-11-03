// Focused G1 checks: real page/ContextProvider/GET+POST handlers/domain modules;
// SQL/session rows and network transport are controlled. NO SQL/Auth/native proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), ts = require('typescript'), React = require('react'), { act } = React, { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://ce.test/en/app/community/events' });
const saved = new Map();
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value, writable: true });
}
const { createRoot } = require('react-dom/client');
const id = n => `23900000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const C = id(1), W = id(2), E = id(3), O = id(4), M = id(5), ACTOR = id(6), OTHER = id(7);
const READ = 'events.event.read', CORRECT = 'events.attendance.correct', RECORD = 'events.attendance.record';
const json = (data, status = 200) => Response.json(data, { status });
const cache = new Map(), results = [], deferreds = [], unhandled = [];
let root, context, lang, permissions, auth, backend, rpcCalls, posts, readCalls, forcedError, forcedData, readGate, mode, knownRecord = false;
const listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
const originalFetch = globalThis.fetch;
const contexts = [C, OTHER].map((context_id, i) => ({ context_id, membership_id: i ? id(8) : M, tenant_name: 'Controlled fixture', role_code: 'owner', role_name: 'Owner', scope_type: 'tenant', context_label: 'Fixture' }));
function load(relative) {
  if (cache.has(relative)) return cache.get(relative).exports;
  const filename = path.join(repo, relative), mod = new Module(filename); cache.set(relative, mod);
  const mocks = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => ({ data: auth ? { claims: { sub: ACTOR } } : null, error: null }) }, schema: name => {
      assert.equal(name, 'customer_api'); return { rpc: mockRpc };
    } }) },
    '@/components/dashboard-lab/DashboardTransport': { useDashboardFetch: () => fakeFetch, useDashboardPreview: () => true },
  };
  mod.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}${path.extname(name) ? '' : '.ts'}`);
    if (name.startsWith('.')) { let p = path.relative(repo, path.resolve(path.dirname(filename), name)); if (!path.extname(p)) p += p.includes('/components/') ? '.tsx' : '.ts'; return load(p); }
    return require(name);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  assert.deepEqual(compiled.diagnostics, []); mod._compile(compiled.outputText, filename); return mod.exports;
}
const client = load('src/lib/community/event-interest-client.ts'), projection = load('src/lib/community/event-attendance-client.ts');
const domain = load('src/lib/community/event-interest-domain.ts'), commands = load('src/app/api/customer/v1/community/events/route.ts');
const reads = load('src/app/api/customer/v1/community/events/attendance/route.ts');
const provider = load('src/components/customer/CustomerContextProvider.tsx'), page = load('src/components/customer/CustomerEventInterestPage.tsx');
function seed(status = 'published') {
  backend = domain.emptyCe011State();
  backend.events[E] = { id: E, workspace_id: W, occurrence_id: O, community_ref: null, title: 'Controlled event', status, version: 3,
    starts_at: '2026-11-02T10:00:00Z', ends_at: '2026-11-02T11:00:00Z', timezone: 'Europe/Bucharest', audience: { kind: 'workspace' } };
  for (let i = 0; i < 26; i++) backend.attendance[id(100 + i)] = { id: id(100 + i), event_id: E, workspace_id: W, membership_id: id(200 + i), attended: true, observed_local: '2026-11-02T12:00:00', timezone: 'Europe/Bucharest', version: 2 };
  permissions = [READ, CORRECT]; auth = true; rpcCalls = []; posts = []; readCalls = []; forcedError = null; forcedData = undefined; readGate = null; mode = ''; knownRecord = false;
}
function eventItem() {
  const e = backend.events[E]; return { event_id: E, occurrence_id: O, workspace_id: W, title: e.title, starts_at: e.starts_at, ends_at: e.ends_at,
    timezone: e.timezone, status: e.status, version: e.version, audience_kind: 'workspace', interest_status: null, interest_version: 0,
    can_publish: false, can_cancel: false, can_register_interest: false, can_withdraw_interest: false,
    can_record_attendance: permissions.includes(RECORD) && e.status === 'published',
    eligible_attendance_members: permissions.includes(RECORD) && e.status === 'published' ? [{ membership_id: id(299), display_name: 'New fixture participant' }] : [] };
}
const request = (after = null, limit = 25) => ({ context_id: C, workspace_id: W, event_id: E, occurrence_id: O, expected_event_version: 3, limit, after_attendance_id: after });
function responseFor(r) {
  const rows = Object.values(backend.attendance).sort((a, b) => a.id.localeCompare(b.id)).filter(row => !r.after_attendance_id || row.id > r.after_attendance_id);
  const targets = rows.slice(0, r.limit).map(row => ({ attendance_id: row.id, attendance_version: row.version, membership_id: row.membership_id,
    display_name: row.id === id(999) ? 'New fixture participant' : `Fixture participant ${Number(row.membership_id.slice(-3)) - 199}`, attended: row.attended, observed_local: row.observed_local.length === 16 ? row.observed_local + ':00' : row.observed_local }));
  return { contract: 'ce011-attendance-projection.v1', version: 1, context_id: r.context_id, workspace_id: r.workspace_id, event_id: r.event_id, occurrence_id: r.occurrence_id,
    event_version: backend.events[E].version, event_status: backend.events[E].status, timezone: 'Europe/Bucharest', can_correct: true,
    order: 'attendance_id.asc', limit: r.limit, after_attendance_id: r.after_attendance_id, next_cursor: rows.length > r.limit ? targets.at(-1).attendance_id : null, targets };
}
async function mockRpc(name, args) {
  rpcCalls.push({ name, args });
  const denied = () => ({ data: null, error: { code: '42501', message: 'PRIVATE_DATABASE_DETAIL' } });
  if (!auth || !permissions.includes(READ)) return denied();
  if (name === 'read_ce_events_v1') return { data: { workspace_id: W, events: args.p_context_id === C ? [eventItem()] : [] }, error: null };
  if (name === 'read_ce_event_attendance_v1') {
    if (!permissions.includes(CORRECT)) return denied();
    if (forcedError) return { data: null, error: { code: forcedError, message: 'PRIVATE_DATABASE_DETAIL' } };
    const r = Object.fromEntries(Object.entries(args).map(([key, value]) => [key.slice(2), value]));
    if (r.context_id !== C || r.workspace_id !== W) return denied();
    if (r.expected_event_version !== backend.events[E].version || r.occurrence_id !== O || r.event_id !== E
      || r.after_attendance_id && !backend.attendance[r.after_attendance_id]) return { data: null, error: { code: '40001' } };
    return { data: forcedData === undefined ? responseFor(r) : forcedData, error: null };
  }
  assert.equal(name, 'command_ce_event_v1');
  const c = args.p_request;
  const authority = { tenant_id: id(10), context_id: C, actor_user_id: ACTOR, membership_id: M, represented_party_id: null,
    workspace_id: W, membership_active: auth, capability_active: true, capability_code: 'ce.event.basic', module_code: 'community_events',
    audience_policy_id: id(11), audience_policy_version: 1, audience_result: 'eligible', assurance_level: 'aal1', evaluated_at: '2026-11-02T10:00:00Z', role_codes: [], permissions };
  const row = backend.attendance[c.attendance_id];
  const result = domain.applyEventCommand(backend, c, authority, '2026-11-02T10:00:00Z', { membership_id: row?.membership_id ?? c.target_membership_id, workspace_id: W, role_codes: [], membership_active: true });
  if (!result.ok) return { data: null, error: { code: result.code.includes('DENIED') ? '42501' : '40001' } };
  backend = result.state;
  if (c.type === 'record_attendance' && !result.replayed) {
    // The existing pure model uses command_id for attendance identity; SQL owns
    // its generated ID. The controlled handler returns that model's exact ID.
    knownRecord = true;
  }
  return { data: { entity_type: 'event_attendance', entity_id: c.type === 'record_attendance' ? c.command_id : c.attendance_id, version: result.version, command: c.type, replayed: result.replayed }, error: null };
}
function httpRequest(url, init = {}) { const r = new Request(new URL(url, 'http://ce.test'), init); r.nextUrl = new URL(r.url); return r; }
async function fakeFetch(input, init = {}) {
  const url = String(input); assert.ok(url.startsWith('/api/customer/v1/'), 'no external transport');
  if (url.endsWith('/contexts')) return json({ contexts });
  if (url.startsWith('/api/customer/v1/dashboard')) return json({ contextId: new URL(url, 'http://ce.test').searchParams.get('context_id'), workspace_id: W, permissions, modules: ['community_events'], entitlements: ['module.community_events'], context: { role_code: 'owner' } });
  if (init.method === 'POST') {
    posts.push(init.body); const r = await commands.POST(httpRequest(url, { ...init, headers: { ...init.headers, origin: 'http://ce.test' } }));
    if (mode === 'lost') throw new Error('CONTROLLED_LOST_REPLY'); return r;
  }
  if (url.startsWith('/api/customer/v1/community/events/attendance?')) {
    readCalls.push({ url, signal: init.signal });
    const r = await reads.GET(httpRequest(url));
    const gate = readGate; readGate = null;
    if (gate?.phase === 'response') { await gate.promise; return r; }
    if (gate?.phase === 'json') return { ok: r.ok, status: r.status, json: async () => { await gate.promise; return r.json(); } };
    return r;
  }
  return commands.GET(httpRequest(url));
}
globalThis.fetch = fakeFetch;
function Probe() { context = provider.useCustomerContext(); return null; }
function tree() { return React.createElement(provider.CustomerContextProvider, null, React.createElement(Probe), React.createElement(page.CustomerEventInterestPage, { lang })); }
const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
async function flush() { for (let n = 0; n < 5; n++) await tick(); }
const q = s => document.querySelector(s), text = () => document.body.textContent;
async function edit(node, value) {
  assert.ok(node, 'named input exists'); const proto = node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
}
async function click(node) { assert.ok(node, 'control exists'); await act(async () => node.click()); await flush(); }
async function submit(node) { assert.ok(node, 'correction form exists'); await act(async () => node.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))); await flush(); }
function hold(phase) { let release; const promise = new Promise(resolve => { release = resolve; }); const v = { phase, promise, release }; deferreds.push(v); readGate = v; return v; }
async function mounted(name, fn, { language = 'en', status = 'published', setup = () => {} } = {}) {
  seed(status); lang = language; setup(); root = createRoot(document.getElementById('root'));
  try { await act(async () => root.render(tree())); await flush(); await fn(); results.push(name); }
  finally { await act(async () => root.unmount()); for (const d of deferreds.splice(0)) d.release(); await flush(); }
}
async function selected() { await edit(q('[data-attendance-target]'), id(100)); return q('[data-correct-attendance]'); }
async function fill(form, reason = 'Correct the historical observation') { await edit(form.querySelector('input'), '2026-11-02T12:15'); await edit(form.querySelector('textarea'), reason); await edit(form.querySelector('select'), 'false'); }

try {
  seed();
  const r = request(null, 1), good = responseFor(r);
  assert.deepEqual(projection.parseAttendanceReadResponse(good, r, eventItem()), good);
  assert.equal(projection.attendanceReadRequestSchema.safeParse(request(null, 50)).success, true);
  let invalid = 0;
  for (const change of [
    { contract: 'v2' }, { version: 2 }, { context_id: OTHER }, { workspace_id: OTHER }, { event_id: OTHER }, { occurrence_id: OTHER },
    { event_version: 2 }, { event_status: 'draft' }, { timezone: 'Invalid/Zone' }, { timezone: 'UTC' }, { can_correct: false },
    { order: 'display_name.asc' }, { limit: 2 }, { after_attendance_id: id(101) }, { next_cursor: id(999) }, { private_path: 'PRIVATE' },
    { targets: [{ ...good.targets[0], attendance_version: 0 }] }, { targets: [{ ...good.targets[0], attendance_version: 2147483648 }] },
    { targets: [{ ...good.targets[0], display_name: '' }] }, { targets: [{ ...good.targets[0], display_name: null }] },
    { targets: [{ ...good.targets[0], observed_local: '2026-02-30T12:00:00' }] }, { targets: [{ ...good.targets[0], actor_id: ACTOR }] },
    { targets: [good.targets[0], good.targets[0]] },
  ]) { assert.throws(() => projection.parseAttendanceReadResponse({ ...good, ...change }, r, eventItem())); invalid++; }
  const two = responseFor(request(null, 2));
  assert.throws(() => projection.parseAttendanceReadResponse({ ...two, targets: [...two.targets].reverse() }, request(null, 2)));
  assert.throws(() => projection.parseAttendanceReadResponse({ ...two, targets: [two.targets[0], { ...two.targets[1], membership_id: two.targets[0].membership_id }] }, request(null, 2)));
  assert.equal(client.eventReadResponseSchema.safeParse({ workspace_id: W, events: [{ ...eventItem(), attendance_targets: [] }] }).success, false, 'old read ABI stays strict');
  results.push(`strict additive ABI / ${invalid + 2} malformed, binding, order and version negatives / old read ABI unchanged`);

  let response = await reads.GET(httpRequest(projection.attendanceReadUrl(r)));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private/); assert.match(response.headers.get('cache-control'), /no-store/); assert.equal(response.headers.get('vary'), 'Cookie');
  assert.deepEqual(rpcCalls.at(-1).args, Object.fromEntries(Object.entries(r).map(([k, v]) => [`p_${k}`, v])));
  for (const suffix of ['&unknown=x', '&context_id=' + C, '&after_attendance_id=arbitrary']) assert.equal((await reads.GET(httpRequest(projection.attendanceReadUrl(r) + suffix))).status, 400);
  for (const [key, value] of [['limit', '0'], ['limit', '51'], ['limit', '1.5'], ['limit', 'NaN'], ['expected_event_version', '0'], ['expected_event_version', '2147483648']]) {
    const u = new URL(projection.attendanceReadUrl(r), 'http://ce.test'); u.searchParams.set(key, value); const count = rpcCalls.length;
    assert.equal((await reads.GET(httpRequest(u))).status, 400); assert.equal(rpcCalls.length, count, 'invalid query never reaches RPC');
  }
  auth = false; const calls = rpcCalls.length; assert.equal((await reads.GET(httpRequest(projection.attendanceReadUrl(r)))).status, 401); assert.equal(rpcCalls.length, calls); auth = true;
  for (const [code, status] of [['42883', 503], ['PGRST202', 503], ['42501', 403], ['P0002', 404], ['40001', 409], ['22023', 400], ['XX000', 500]]) {
    forcedError = code; response = await reads.GET(httpRequest(projection.attendanceReadUrl(r))); assert.equal(response.status, status); assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE_DATABASE_DETAIL/);
  }
  forcedError = null; forcedData = { ...good, workspace_id: OTHER }; assert.equal((await reads.GET(httpRequest(projection.attendanceReadUrl(r)))).status, 502);
  results.push('actual GET: exact RPC mapping, bounded query, auth/no-store, missing/stale/denial/redaction and malformed result');

  for (const language of ['en', 'ro', 'fa']) for (const status of ['published', 'cancelled']) await mounted(`${language}/${status}: earlier named target, correct-only, existing lifecycle reason and canonical versions`, async () => {
    assert.equal(q('[data-record-attendance]'), null, 'correction never confers record');
    assert.equal(q('[data-attendance-projection]').dir, language === 'fa' ? 'rtl' : 'ltr');
    assert.equal(q('[data-attendance-target] option[value="' + id(100) + '"]').textContent, 'Fixture participant 1');
    assert.equal(q('[data-correct-attendance]'), null, 'no automatic first target');
    const form = await selected(); assert.match(form.textContent, /Fixture participant 1/); assert.match(form.textContent, /Europe\/Bucharest/);
    for (const value of [C, W, E, O, id(100), id(200)]) assert.equal(text().includes(value), false, 'wire identity is not displayed');
    await fill(form, status === 'cancelled' ? 'short' : 'Valid correction');
    if (status === 'cancelled') {
      assert.equal(form.querySelector('textarea').minLength, 12); await submit(form); assert.equal(posts.length, 0);
      await edit(form.querySelector('textarea'), '😀'.repeat(6)); await submit(form); assert.equal(posts.length, 0, 'six code points do not meet SQL length(reason)>=12 despite twelve UTF-16 units');
      assert.match(q('[data-attendance-projection] [role="status"]').textContent, language === 'fa' ? /۱۲ نویسه/ : /12/);
      assert.equal(form.querySelector('textarea').value, '😀'.repeat(6));
      await edit(form.querySelector('textarea'), 'Correct after event cancellation');
    }
    await submit(form); assert.equal(posts.length, 1);
    const c = JSON.parse(posts[0]); assert.equal(c.type, 'correct_attendance'); assert.equal(c.attendance_id, id(100)); assert.equal(c.expected_attendance_version, 2); assert.equal(c.expected_version, 3); assert.equal(c.timezone, 'Europe/Bucharest');
    assert.equal(backend.attendance[id(100)].version, 3); assert.equal(backend.attendance[id(100)].attended, false); assert.equal(backend.audits[0].policy, status === 'cancelled' ? 'post_cancellation_attendance_correction' : 'standard');
    assert.equal(backend.audits.length, 1); assert.equal(backend.events[E].version, 3); assert.ok(q('[data-command-status]').textContent.length > 0);
  }, { language, status });

  await mounted('record without correct never requests historical target names', async () => {
    assert.ok(q('[data-record-attendance]')); assert.equal(q('[data-attendance-projection]'), null); assert.equal(readCalls.length, 0); assert.equal(q('[data-correct-attendance]'), null);
  }, { setup: () => { permissions = [READ, RECORD]; } });
  await mounted('correct without read cannot disclose event or attendance', async () => { assert.equal(q('[data-attendance-projection]'), null); assert.equal(readCalls.length, 0); assert.equal(posts.length, 0); }, { setup: () => { permissions = [CORRECT]; } });
  await mounted('missing projection remains NOT_READY without UUID/name substitution', async () => { assert.equal(q('[data-attendance-target]'), null); assert.match(text(), /attendance read connection is not available/); assert.equal(posts.length, 0); }, { setup: () => { forcedError = '42883'; } });
  await mounted('live cursor: 25 named rows then last page; stable identity order and no accumulation', async () => {
    assert.equal(q('[data-attendance-target]').options.length, 26); await click(q('[data-attendance-next]'));
    assert.equal(q('[data-attendance-target]').options.length, 2); assert.equal(q('[data-attendance-target]').options[1].value, id(125));
    assert.equal(new URL(readCalls.at(-1).url, 'http://ce.test').searchParams.get('after_attendance_id'), id(124)); assert.equal(q('[data-attendance-next]'), null); assert.doesNotMatch(text(), /Fixture participant 1\b/);
  });
  await mounted('stale attendance version denies existing command and preserves correction draft without automatic retry', async () => {
    const form = await selected(); await fill(form); backend.attendance[id(100)].version++;
    await submit(form); assert.equal(posts.length, 1); assert.equal(backend.audits.length, 0); assert.match(q('[data-command-status]').textContent, /rejected/);
    assert.equal(q('[data-correct-attendance] textarea').value, 'Correct the historical observation'); assert.equal(q('[data-correct-attendance] input').value, '2026-11-02T12:15');
  });
  for (const code of ['40001', '42501']) await mounted(`projection refresh ${code}: stale/revoked names removed and no dispatch`, async () => {
    await selected(); forcedError = code; await click(q('[data-attendance-refresh]')); assert.doesNotMatch(text(), /Fixture participant 1\b/); assert.equal(q('[data-correct-attendance]'), null); assert.equal(posts.length, 0);
  });
  for (const phase of ['response', 'json']) await mounted(`G1 refresh/${phase}: old read cannot restore name/target admission`, async () => {
    const oldForm = await selected(); await fill(oldForm); const old = hold(phase);
    forcedData = responseFor(request()); forcedData.targets[0].display_name = 'Old generation participant';
    // The old form is still attached in this same React batch: this is a real
    // pre-render admission witness, not a submit on a detached DOM node.
    await act(async () => { q('[data-attendance-refresh]').click(); oldForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); await flush();
    assert.equal(posts.length, 0);
    forcedData = responseFor(request()); forcedData.targets[0].display_name = 'Current generation participant';
    await click(q('[data-attendance-refresh]')); await selected();
    await act(async () => old.release()); await flush();
    assert.equal(posts.length, 0); assert.ok(q('[data-attendance-target]')); assert.equal(q('[data-attendance-target]').value, id(100));
    assert.match(text(), /Current generation participant/); assert.doesNotMatch(text(), /Old generation participant/);
  });
  for (const change of ['context', 'locale', 'permission']) await mounted(`late G1 JSON/${change}: old names cannot return`, async () => {
    const old = hold('json'); await click(q('[data-attendance-refresh]'));
    if (change === 'context') await act(async () => context.select(OTHER));
    if (change === 'locale') { lang = 'ro'; forcedError = '42883'; await act(async () => root.render(tree())); }
    if (change === 'permission') { permissions = [READ]; await act(async () => context.refresh()); }
    await flush(); await act(async () => old.release()); await flush(); assert.doesNotMatch(text(), /Fixture participant 1\b/); assert.equal(posts.length, 0);
  });
  await mounted('G1 correction drafts stay target-scoped across selection, Context return and locale replacement', async () => {
    const form = await selected(); await fill(form);
    await edit(q('[data-attendance-target]'), id(101)); assert.equal(q('[data-correct-attendance] textarea').value, '');
    await selected(); assert.equal(q('[data-correct-attendance] textarea').value, 'Correct the historical observation');
    await act(async () => context.select(OTHER)); await flush(); assert.doesNotMatch(text(), /Fixture participant 1\b/);
    await act(async () => context.select(C)); await flush(); await selected();
    assert.equal(q('[data-correct-attendance] input').value, '2026-11-02T12:15');
    lang = 'fa'; await act(async () => root.render(tree())); await flush(); await selected();
    assert.equal(q('[data-correct-attendance] textarea').value, 'Correct the historical observation'); assert.equal(q('[data-attendance-projection]').dir, 'rtl');
  });
  await mounted('cursor and Event-version conflicts are actionable stale projections, never empty success', async () => {
    const u = new URL(projection.attendanceReadUrl(request(id(999))), 'http://ce.test');
    assert.equal((await reads.GET(httpRequest(u))).status, 409);
    backend.events[E].version++; await click(q('[data-attendance-refresh]'));
    assert.match(text(), /version changed/); assert.equal(q('[data-attendance-target]'), null); assert.equal(posts.length, 0);
  });
  await mounted('cross-Workspace read cannot disclose names or create a correction target', async () => {
    const foreign = { ...request(), workspace_id: OTHER };
    const denied = await reads.GET(httpRequest(projection.attendanceReadUrl(foreign))); assert.equal(denied.status, 403);
    assert.doesNotMatch(JSON.stringify(await denied.json()), /Fixture participant|PRIVATE/); assert.equal(posts.length, 0);
  });
  await mounted('G1 target UNKNOWN retains existing exact-wire replay and independent current authority', async () => {
    const form = await selected(); await fill(form); mode = 'lost'; await submit(form); assert.equal(backend.audits.length, 1); const wire = posts[0];
    assert.match(q('[data-command-status]').textContent, /not yet known/); await click(q('[data-event-refresh]')); assert.equal(posts.length, 1);
    mode = ''; await click(q('[data-command-replay]')); assert.equal(posts[1], wire); assert.equal(backend.audits.length, 1);
  });
  await mounted('accepted same-page record→correction remains available when additive read RPC is absent', async () => {
    const form = q('[data-record-attendance]'); await edit(form.querySelector('select'), id(299)); await edit(form.querySelector('input'), '2026-11-02T12:15'); await submit(form);
    assert.equal(knownRecord, true); assert.ok(q('[data-correct-attendance]')); assert.match(q('[data-correct-attendance]').textContent, /New fixture participant/);
  }, { setup: () => { permissions = [READ, RECORD, CORRECT]; forcedError = '42883'; } });

  const sql = fs.readFileSync(path.join(repo, 'supabase/proposals/ce_011_attendance_projection_v1.sql'), 'utf8').replace(/--[^\n]*/g, '');
  assert.equal((sql.match(/create function/gi) ?? []).length, 1);
  assert.match(sql, /ce_event_authorize_v1\(p_context_id,p_workspace_id,'events\.event\.read'\)/);
  assert.match(sql, /ce_event_authorize_v1\(p_context_id,p_workspace_id,'events\.attendance\.correct'\)/);
  assert.match(sql, /v_event\.status not in\('published','cancelled'\)/);
  assert.match(sql, /a\.tenant_id=v_scope\.tenant_id and a\.workspace_id=p_workspace_id/);
  assert.match(sql, /a\.event_id=p_event_id and a\.occurrence_id=p_occurrence_id/);
  assert.match(sql, /order by a\.id limit p_limit\+1/);
  assert.match(sql, /ce_event_audience_eligible_v1\(p_event_id,m\.id\)/);
  assert.doesNotMatch(sql, /\b(insert|update|delete|grant|create table|create policy)\s/i);
  results.push('inactive SQL source structure: one bounded canonical-authority read, exact scope/cursor/audience, no write or positive grant (NOT native execution)');
  assert.equal(unhandled.length, 0);
  console.log(JSON.stringify({ task: 'V14-CE-01 / CE011-ATTENDANCE-PROJECTION-03', result: 'PASS_CONTROLLED', count: results.length, cases: results,
    evidence: 'ACTUAL_PAGE_CONTEXT_PROVIDER_HTTP_HANDLERS_AND_EXISTING_DOMAIN; CONTROLLED_RPC_ROWS_AND_TRANSPORT; SQL_SOURCE_ONLY',
    toolchain: Object.fromEntries(['next','zod','react','typescript'].map(n => [n, require(n + '/package.json').version])),
    connected: 'NOT_RUN_NOT_PASS', native_browser: 'NOT_RUN_NOT_PASS', cleanup: 'ROOTS_UNMOUNTED_DEFERREDS_RELEASED_NO_UNHANDLED_REJECTIONS' }, null, 2));
} finally {
  globalThis.fetch = originalFetch; process.off('unhandledRejection', listener);
  for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; }
  dom.window.close();
}
