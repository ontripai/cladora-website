import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server.js';
import { createB2Loader } from './lib/airprop-b2-test-loader.mjs';
import { createB2ContractPool, persistedB2Effects } from './lib/airprop-b2-contract-pool.mjs';
import { createAp10AirpropB2Consumer } from './lib/ap10-airprop-b2-consumer.mjs';

const load = createB2Loader(), { createAirpropB2Api } = load('src/lib/airprop/artifact-b2-api.ts');
const { createAirpropB2Runtime } = load('src/lib/airprop/artifact-b2-runtime.ts');
const { readAirpropB2Portfolio } = load('src/lib/airprop/artifact-b2-portfolio.ts');
const actor = randomUUID(), context = randomUUID(), workspace = randomUUID();
const command = { version: 1, context_id: context, workspace_id: workspace, idempotency_key: 'ap10-b2-test-01', action: 'withdraw_listing', listing_id: randomUUID(), expected_version: 1, reason: 'AP10 B2 contract request' };
const binding = { actor_id: actor, context_id: context, workspace_id: workspace, property_id: randomUUID(), authority_version: 7, aggregate_version: 1, transaction_id: randomUUID(), command_id: randomUUID() };
const request = (body = command, headers = {}) => new NextRequest('https://cladora.test/api/customer/v2/airprop/artifact-b2', {
  method: 'POST', headers: { origin: 'https://cladora.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const composition = extra => ({ session: async () => ({ actor_id: actor, aal: 'aal2' }), runtime: null, portfolio: null, bind: async () => binding, ...extra });
let passed = 0;
async function check(name, run) { await run(); console.log(`ok ${++passed} - ${name}`); }
await check('actual production route stays closed even for an AAL2 claims fixture', async () => {
  const route = createB2Loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: actor, aal: 'aal2' } }, error: null }) } }) } })('src/app/api/customer/v2/airprop/artifact-b2/route.ts');
  assert.deepEqual(Object.keys(route).sort(), ['GET', 'POST']);
  const controls = await (await route.GET()).json(); assert.equal(controls.commands, null); assert.equal(controls.can_edit, false);
  const response = await route.POST(request()); assert.equal(response.status, 403);
  assert.match(JSON.stringify(await response.json()), /AIRPROP_PRE_ACTIVATION/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await route.GET(new NextRequest(`https://cladora.test/api/customer/v2/airprop/artifact-b2?context_id=${context}&workspace_id=${workspace}`))).status, 403);
  assert.equal((await route.GET(new NextRequest(`https://cladora.test/api/customer/v2/airprop/artifact-b2?context_id=${context}&workspace_id=${workspace}&tenant_id=${actor}`))).status, 400);
});
await check('route rejects unauthenticated, AAL1, origin, content type and oversized input', async () => {
  assert.equal((await createAirpropB2Api(composition({ session: async () => null })).POST(request())).status, 401);
  assert.equal((await createAirpropB2Api(composition({ session: async () => ({ actor_id: actor, aal: 'aal1' }) })).POST(request())).status, 403);
  const api = createAirpropB2Api(composition({}));
  assert.equal((await api.POST(request(command, { origin: 'https://hostile.test' }))).status, 403);
  assert.equal((await api.POST(request(command, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await api.POST(request({ ...command, reason: 'x'.repeat(70000) }))).status, 413);
  for (const field of ['actor_id', 'authority_version', 'tenant_id', 'commands', 'can_edit']) {
    assert.equal((await api.POST(request({ ...command, [field]: actor }))).status, 400);
  }
});
await check('AP10 actor/Workspace binding, provider failure and replay conflict preserve zero additional writes', async () => {
  const pool = createB2ContractPool(actor), runtime = createAirpropB2Runtime(pool);
  const api = createAirpropB2Api(composition({ runtime }));
  assert.equal((await api.POST(request({ ...command, workspace_id: randomUUID() }))).status, 403);
  assert.equal(pool.state.connections, 0);
  assert.equal((await createAirpropB2Api(composition({ runtime, bind: async () => ({ ...binding, actor_id: randomUUID() }) })).POST(request())).status, 403);
  pool.state.failure = 'provider';
  const failed = await api.POST(request()); assert.equal(failed.status, 503);
  assert.equal(JSON.stringify(await failed.json()).includes('private_sql_details'), false);
  assert.deepEqual(persistedB2Effects(pool), { domain: 0, audit: 0, outbox: 0, idempotency: 0 });
  pool.state.failure = null; pool.state.gate = true;
  const first = await api.POST(request()); assert.equal(first.status, 201);
  assert.deepEqual(Object.keys(await first.json()).sort(), ['receipt_id', 'status', 'version']);
  const effects = persistedB2Effects(pool);
  assert.equal((await api.POST(request())).status, 200);
  assert.equal((await api.POST(request({ ...command, reason: 'Changed conflicting reason' }))).status, 409);
  pool.state.revoked = true; assert.equal((await api.POST(request())).status, 503);
  assert.deepEqual(persistedB2Effects(pool), effects);
});
await check('read adapter uses only A portfolio RPC and fails closed on malformed/error payloads', async () => {
  const calls = [], gateway = { rpc: async (name, args) => { calls.push({ name, args }); return { data: null, error: { private: 'not disclosed' } }; } };
  const result = await readAirpropB2Portfolio(gateway, { context_id: context, workspace_id: workspace });
  assert.equal(result.status, 'denied'); assert.equal(result.code, 'PROVIDER_UNAVAILABLE');
  assert.deepEqual(calls, [{ name: 'read_airprop_management_portfolio_v1', args: { p_context_id: context, p_workspace_id: workspace } }]);
  assert.equal((await readAirpropB2Portfolio(gateway, { context_id: context, workspace_id: workspace, tenant_id: actor })).code, 'INVALID_REQUEST');
  assert.equal(calls.length, 1);
  assert.equal((await readAirpropB2Portfolio({ rpc: async () => ({ data: {}, error: null }) }, { context_id: context, workspace_id: workspace })).status, 'denied');
});
await check('AP10 execute consumer accepts two Workspaces/two properties/three units and explicit closed gates', async () => {
  const selected = [], ids = [workspace, randomUUID()], fixture = { client: {}, accessToken: 'fixture-not-a-token', contextId: context,
    workspaceIds: ids, propertyIds: [randomUUID(), randomUUID()], unitIds: [randomUUID(), randomUUID(), randomUUID()] };
  const consumer = createAp10AirpropB2Consumer({ readControls: async () => (await createAirpropB2Api(composition({})).GET()).json(),
    readPortfolio: async ({ workspaceId }) => { selected.push(workspaceId); return { status: 'denied', code: 'PROVIDER_UNAVAILABLE' }; } });
  const receipt = await consumer(fixture); assert.deepEqual(selected, ids); assert.equal(receipt.httpAal2, 'NOT_RUN_NOT_PASS');
  assert.equal(receipt.portfolioReads, 0); assert.equal(receipt.portfolioUnavailable, 2);
  await assert.rejects(consumer({ ...fixture, unitIds: [] }), /fixture_invalid/);
  await assert.rejects(createAp10AirpropB2Consumer({ readControls: async () => ({ commands: ['edit'], can_edit: true }), readPortfolio: async () => null })(fixture), /controls_invalid/);
  const openFixture = createAp10AirpropB2Consumer({ readControls: async () => (await createAirpropB2Api(composition({})).GET()).json(),
    readPortfolio: async ({ workspaceId }) => ({ status: 'read', view: { properties: [{ property: { id: fixture.propertyIds[ids.indexOf(workspaceId)] } }] } }) });
  assert.equal((await openFixture(fixture)).portfolioReads, 2);
  await assert.rejects(createAp10AirpropB2Consumer({ readControls: async () => (await createAirpropB2Api(composition({})).GET()).json(),
    readPortfolio: async () => ({ status: 'read', view: { properties: [{ property: { id: randomUUID() } }] } }) })(fixture), /workspace_projection_invalid/);
});
console.log(`PASS ${passed} API/AP10 in-process contract cases; real HTTP/AAL2 NOT_RUN_NOT_PASS`);
