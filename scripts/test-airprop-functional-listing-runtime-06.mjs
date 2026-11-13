// Controlled request-boundary tests only. No issued Auth/SQL/C03 or durable DB proof.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, scope, id } from './lib/airprop-listing-flow-test-fixture.mjs';
import { r2Loader } from './lib/airprop-r2-test-fixture.mjs';
const require = createRequire(import.meta.url), { NextRequest } = require('next/server');
const load = r2Loader({ 'src/lib/supabase/server.ts': { createClient() { throw Error('LIVE_AUTH_FORBIDDEN'); } } });
const { createListingRequestRuntimeResolverV1, resolveListingRuntimeForRequest } = load('src/lib/airprop/listing-runtime-binding-v1.ts');
const get = () => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope));
const post = value => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings', { method: 'POST', headers: { Origin: 'https://cladora.test', 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
let count = 0;
const check = async (name, run) => { await run(); console.log('PASS', ++count, name); };
await check('unconfigured official dependency remains unavailable', async () => {
  assert.equal(await resolveListingRuntimeForRequest({ actor_id: id(3), aal: 'aal2' }, scope, get()), null);
});
await check('resolver null cannot fall back to static fixture ports or dispatch', async () => {
  const f = fixture(); let resolved = 0;
  const api = f.createListingFlowApi({ session: f.session, read: f.read, control: f.control, resolveRuntime: async () => { resolved++; return null; } });
  assert.equal((await api.GET(get())).status, 503); assert.equal((await api.POST(post(await f.command()))).status, 503);
  assert.equal(resolved, 2); assert.equal(f.state.writes, 0); assert.equal(f.state.bridgeCalls, 0);
});
await check('invalid input, unauthenticated and AAL1 reject before runtime checkout', async () => {
  const f = fixture(); let resolved = 0;
  const api = f.createListingFlowApi({ session: f.session, read: null, control: null, resolveRuntime: async () => { resolved++; throw Error(); } });
  assert.equal((await api.POST(post({}))).status, 400);
  assert.equal((await api.GET(new NextRequest(get().url + '&other=1'))).status, 400);
  const command = await f.command(); f.state.aal = 'aal1'; assert.equal((await api.POST(post(command))).status, 403);
  f.state.actor = null; assert.equal((await api.GET(get())).status, 401); assert.equal(resolved, 0);
});
await check('ports resolve afresh with exact actor/scope, no retained request principal', async () => {
  const f = fixture(), seen = [];
  const api = f.createListingFlowApi({ session: f.session, read: null, control: null, resolveRuntime: async (session, selected) => {
    seen.push({ ...session, ...selected }); return { read: f.read, control: null };
  } });
  assert.equal((await api.GET(get())).status, 200); f.state.actor = id(90);
  assert.equal((await api.GET(get())).status, 200);
  assert.deepEqual(seen.map(x => x.actor_id), [id(3), id(90)]);
  assert.ok(seen.every(x => x.context_id === scope.context_id && x.workspace_id === scope.workspace_id));
});
await check('real composition rejects foreign use before Core checkout or control', async () => {
  let checkouts = 0, commands = 0;
  const resolver = createListingRequestRuntimeResolverV1(async (session, selected) => {
    assert.ok(Object.isFrozen(session) && Object.isFrozen(selected));
    return { pool: { connect: async () => { checkouts++; throw Error('NO_DB'); } }, principal: { executor: 'airprop_read_executor', runtime: 'airprop_read_runtime' },
      canonical: { readCanonical: async () => { throw Error('NO_CANONICAL'); } },
      command: { pool: { options: {}, connect: async () => { checkouts++; throw Error('NO_DB'); } }, target: {},
        prepareControl: async () => { commands++; return null; } } };
  });
  const ports = await resolver({ actor_id: id(3), aal: 'aal2' }, scope, get()), f = fixture();
  await assert.rejects(() => ports.read(id(99), scope));
  await assert.rejects(() => ports.read(id(3), { ...scope, workspace_id: id(99) }));
  const request = await f.command();
  assert.equal((await ports.control(id(99), request)).status, 'denied');
  assert.equal((await ports.control(id(3), { ...request, command: { ...request.command, context_id: id(99) } })).status, 'denied');
  assert.equal(checkouts, 0); assert.equal(commands, 0);
});
console.log('Request boundary only:', count, '; native persistence NOT_RUN_NOT_PASS');
