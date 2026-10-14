import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { createB2Loader } from './lib/airprop-b2-test-loader.mjs';

const { handleAirpropB2ReadHttpV1 } = createB2Loader()(
  'src/lib/airprop/artifact-b2-read-http-v1.ts',
);
const source = readFileSync(new URL(
  '../src/lib/airprop/artifact-b2-read-http-v1.ts', import.meta.url,
), 'utf8');
const production = readFileSync(new URL(
  '../src/app/api/customer/v2/airprop/artifact-b2/route.ts', import.meta.url,
), 'utf8');
assert.match(source, /createAirpropB2Api/);
assert.match(source, /AIRPROP_UNIT_SCOPE_UNRESOLVED/);
assert.doesNotMatch(source, /service_role|SUPABASE_DB_URL|grant\s+execute/i);
assert.match(production, /runtime:\s*null/);
assert.match(production, /portfolio:\s*null/);
assert.equal(existsSync(new URL(
  '../src/app/api/customer/v2/airprop/portfolio/route.ts', import.meta.url,
)), false);

const id = () => randomUUID();
const contextId = id();
const workspaceIds = [id(), id()];
const propertyIds = [id(), id()];
const sessionFor = actor_id => ({
  source: 'supabase_verified_bearer', actor_id, assurance_level: 'aal2',
  access_token: `local.${actor_id}.verified-aal2-token-material`,
});
const view = (propertyId, actionLinks = []) => ({
  version: 1,
  idempotent: true,
  as_of: new Date().toISOString(),
  properties: propertyId ? [{
    mandate_request_id: id(),
    property: { id: propertyId, label: `Property ${propertyId.slice(0, 8)}` },
    owner: { party_id: id(), label: 'Fixture owner' },
    scope: { capabilities: ['owner_reporting'] },
    valid_from: '2026-01-01',
    valid_to: '2027-01-01',
    status: 'accepted',
    action_links: actionLinks,
  }] : [],
  operations: { detail_owner: 'Operations', mode: 'canonical_references_only' },
  finance: {
    detail_owner: 'Finance', mode: 'not_connected',
    reason: 'canonical_receipt_contract_unavailable',
  },
});
const request = (workspaceId = workspaceIds[0], token = 'primary', headers = {}) => new Request(
  `http://127.0.0.1:41792/isolated/airprop/portfolio?context_id=${contextId}&workspace_id=${workspaceId}`,
  { headers: { authorization: `Bearer ${token.padEnd(24, 'x')}`, ...headers } },
);
const actorByToken = new Map([
  ['primary'.padEnd(24, 'x'), id()],
  ['secondary'.padEnd(24, 'x'), id()],
]);
const auth = async req => {
  const token = req.headers.get('authorization')?.slice('Bearer '.length);
  const actor = actorByToken.get(token);
  return actor ? sessionFor(actor) : null;
};
let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
}

await check('authorized empty is a 200 projection and unavailable remains 503', async () => {
  const empty = await handleAirpropB2ReadHttpV1(request(), {
    authenticate: auth,
    portfolio: () => ({ rpc: async () => ({ data: view(null), error: null }) }),
  });
  assert.equal(empty.status, 200);
  const emptyBody = await empty.json();
  assert.deepEqual(emptyBody.view.properties, []);
  assert.equal(emptyBody.commands, null);
  assert.equal(emptyBody.can_edit, false);
  assert.equal(emptyBody.state, 'pre_activation');

  const unavailable = await handleAirpropB2ReadHttpV1(request(), {
    authenticate: auth,
    portfolio: () => ({ rpc: async () => ({ data: null, error: { code: 'closed' } }) }),
  });
  assert.equal(unavailable.status, 503);
  assert.equal('view' in await unavailable.json(), false);
});

await check('auth, AAL and exact query gates fail before portfolio access', async () => {
  let calls = 0;
  const portfolio = () => ({ rpc: async () => { calls += 1; return { data: view(null), error: null }; } });
  assert.equal((await handleAirpropB2ReadHttpV1(request(workspaceIds[0], 'unknown'), {
    authenticate: auth, portfolio,
  })).status, 401);
  assert.equal((await handleAirpropB2ReadHttpV1(request(workspaceIds[0], 'primary'), {
    authenticate: async req => ({ ...(await auth(req)), assurance_level: 'aal1' }), portfolio,
  })).status, 403);
  const extra = new Request(`${request().url}&actor_id=${actorByToken.values().next().value}`, {
    headers: request().headers,
  });
  assert.equal((await handleAirpropB2ReadHttpV1(extra, { authenticate: auth, portfolio })).status, 400);
  assert.equal(calls, 0);
});

await check('Context/Workspace property scope stays explicit and cross-Workspace fails closed', async () => {
  const calls = [];
  const response = await handleAirpropB2ReadHttpV1(request(workspaceIds[0]), {
    authenticate: auth,
    portfolio: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        if (args.p_workspace_id !== workspaceIds[0]) return { data: null, error: { code: 'denied' } };
        return { data: view(propertyIds[0]), error: null };
      },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).view.properties[0].property.id, propertyIds[0]);
  assert.deepEqual(calls, [{
    name: 'read_airprop_management_portfolio_v1',
    args: { p_context_id: contextId, p_workspace_id: workspaceIds[0] },
  }]);
  const cross = await handleAirpropB2ReadHttpV1(request(workspaceIds[1]), {
    authenticate: auth,
    portfolio: () => ({ rpc: async () => ({ data: null, error: { code: 'denied' } }) }),
  });
  assert.equal(cross.status, 503);
});

await check('unit-linked rows remain unavailable until Core resolves move/revoke semantics', async () => {
  const action = {
    action_link_id: id(), core_record_type: 'maintenance.work_order', core_record_id: id(),
    unit_id: id(), source_status_snapshot: 'scheduled', linked_at: new Date().toISOString(),
  };
  const response = await handleAirpropB2ReadHttpV1(request(), {
    authenticate: auth,
    portfolio: () => ({ rpc: async () => ({ data: view(propertyIds[0], [action]), error: null }) }),
  });
  assert.equal(response.status, 503);
  assert.equal('view' in await response.json(), false);
});

await check('concurrent actor switch keeps late responses bound to their request session', async () => {
  let entered;
  const firstEntered = new Promise(resolve => { entered = resolve; });
  let release;
  const firstRelease = new Promise(resolve => { release = resolve; });
  const primaryActor = actorByToken.get('primary'.padEnd(24, 'x'));
  const secondaryActor = actorByToken.get('secondary'.padEnd(24, 'x'));
  const dependencies = {
    authenticate: auth,
    portfolio: session => ({
      rpc: async () => {
        if (session.actor_id === primaryActor) {
          entered();
          await firstRelease;
          return { data: view(propertyIds[0]), error: null };
        }
        assert.equal(session.actor_id, secondaryActor);
        return { data: view(propertyIds[1]), error: null };
      },
    }),
  };
  const latePrimary = handleAirpropB2ReadHttpV1(request(workspaceIds[0], 'primary'), dependencies);
  await firstEntered;
  const currentSecondary = await handleAirpropB2ReadHttpV1(
    request(workspaceIds[1], 'secondary'), dependencies,
  );
  assert.equal((await currentSecondary.json()).view.properties[0].property.id, propertyIds[1]);
  release();
  const primary = await latePrimary;
  assert.equal((await primary.json()).view.properties[0].property.id, propertyIds[0]);
});

console.log(`AIRPROP loopback read HTTP contract: ${checks}/${checks} PASS (SYNTHETIC boundary; REAL_LOCAL evidence separate).`);
