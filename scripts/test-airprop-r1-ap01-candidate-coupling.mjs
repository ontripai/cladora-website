import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server.js';
import { fixture, id, loader, scope } from './lib/airprop-listing-flow-test-fixture.mjs';

// Exercise the application's actual route exports. Both provider ports share
// this controlled state, with no pre-existing listing visible to the reader.
const model = fixture();
const actor = model.state.actor;
const effects = [];
let published = false;
let activeRequest;
let originalWire;
let phase;
let load;
const endpoints = '/api/customer/v2/airprop';
const opportunity = id(50);
const key = 'ap01-publish-001';
const from = model.state.row.available_from;
const versions = { specification_id: id(55), resource_version: 4, party_version: 6, relationship_version: 2 };
const digest = body => createHash('sha256').update(body).digest('hex');

function publishedState() {
  return { row: structuredClone(model.state.row), writes: model.state.writes, effects: [...effects] };
}

load = loader({
  'server-only': {},
  '@/lib/supabase/server': {
    async createClient() {
      const current = activeRequest;
      return {
        auth: { async getClaims() {
          assert.equal(activeRequest, current);
          if (phase === 'publish') assert.equal(current.bodyUsed, true);
          return { data: { claims: { sub: actor, aal: 'aal2' } }, error: null };
        } },
        schema(name) {
          assert.equal(name, 'customer_api');
          return { async rpc(rpc, args) {
            assert.equal(phase, 'publish');
            assert.equal(activeRequest, current);
            assert.equal(rpc, 'publish_airprop_listing_v1');
            assert.deepEqual(args, { p_context_id: scope.context_id, p_workspace_id: scope.workspace_id,
              p_opportunity_id: opportunity, p_property_id: id(8), p_unit_id: id(9), p_kind: 'resale',
              p_available_from: from, p_available_until: null, p_idempotency_key: key });
            assert.equal(published, false);
            published = true;
            effects.push('publish');
            return { data: { version: 1, idempotent: false, listing_id: model.state.row.listing_id, status: 'published' }, error: null };
          } };
        },
      };
    },
  },
  '@/lib/airprop/listing-runtime-binding-v1': {
    async resolveListingRuntimeForRequest(session, selectedScope, request) {
      assert.deepEqual(session, { actor_id: actor, aal: 'aal2' });
      assert.deepEqual(selectedScope, scope);
      if (activeRequest.method === 'GET') {
        assert.equal(request, activeRequest);
      } else {
        const { inspectCoreListingOriginalRequestV1 } = load('src/lib/core/listing-original-wire-handoff-v1.ts');
        const evidence = inspectCoreListingOriginalRequestV1(request);
        assert.equal(request.bodyUsed, true);
        assert.equal(evidence?.wire_utf8, originalWire);
        assert.equal(evidence.http_body_sha256, digest(originalWire));
        assert.equal(evidence.byte_length, Buffer.byteLength(originalWire));
      }
      return {
        async read(readActor, readScope) {
          assert.equal(readActor, actor);
          assert.deepEqual(readScope, scope);
          return published ? model.read(readActor, readScope) : [];
        },
        async control(commandActor, value) {
          assert.equal(commandActor, actor);
          assert.equal(value.command.context_id, scope.context_id);
          assert.equal(value.command.workspace_id, scope.workspace_id);
          assert.equal(value.command.listing_id, model.state.row.listing_id);
          assert.deepEqual(value, JSON.parse(originalWire));
          assert.deepEqual(value.selection.source_versions, { version: 2, ...versions });
          const before = model.state.writes;
          const result = await model.control(commandActor, value);
          if (model.state.writes > before) effects.push(value.command.action);
          return result;
        },
      };
    },
  },
});

const publication = load('src/app/api/customer/v2/airprop/commercial-lifecycle/route.ts');
const listings = load('src/app/api/customer/v2/airprop/listings/route.ts');
const steps = [];
async function post(route, path, payload, step) {
  phase = step;
  originalWire = JSON.stringify(payload, null, 2) + '\n';
  activeRequest = new NextRequest('https://cladora.test' + endpoints + path, {
    method: 'POST', headers: { origin: 'https://cladora.test', 'content-type': 'application/json' },
    body: originalWire,
  });
  const response = await route.POST(activeRequest);
  assert.equal(activeRequest.bodyUsed, true);
  return { http: response.status, body: await response.json() };
}

async function read() {
  phase = 'readback';
  activeRequest = new NextRequest('https://cladora.test' + endpoints + '/listings?' + new URLSearchParams(scope));
  const response = await listings.GET(activeRequest);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.workspace_id, scope.workspace_id);
  assert.equal(body.context_id, scope.context_id);
  return body.listings;
}

assert.deepEqual(await read(), []);
const created = await post(publication, '/commercial-lifecycle', {
  version: 1, ...scope, action: 'publish_listing', property_id: id(8), unit_id: id(9),
  opportunity_id: opportunity, kind: 'resale', available_from: from, available_until: null, idempotency_key: key,
}, 'publish');
assert.equal(created.http, 201);
const listing = created.body.listing_id;
assert.equal(listing, id(30));
async function observe(status, version) {
  const [row, ...others] = await read();
  assert.deepEqual(others, []);
  assert.equal(row.selection.listing_id, listing);
  assert.equal(row.status, status);
  assert.equal(row.selection.listing_version, version);
  assert.equal(row.binding_state, 'bound');
  assert.deepEqual(row.selection.source_versions, { version: 2, ...versions });
  return row.selection;
}
const first = await observe('published', 1);
steps.push({ step: 'publish', http: created.http, listing, version: 1, status: 'published' });

async function control(action, selection, keySuffix, expectedStatus, nextVersion) {
  const value = { contract: 'airprop-listing-flow.v1', selection, command: {
    version: 1, ...scope, action, listing_id: listing, expected_version: selection.listing_version,
    idempotency_key: 'ap01-control-' + keySuffix, reason: 'Controlled lifecycle verification',
    ...(action === 'republish_listing' ? { available_from: from, available_until: null } : {}),
  } };
  const response = await post(listings, '/listings', value, action);
  assert.equal(response.http, expectedStatus, JSON.stringify(response.body));
  if (expectedStatus === 200) {
    assert.equal(response.body.receipt.listing_id, listing);
    assert.equal(response.body.receipt.listing_version, nextVersion);
  } else {
    assert.match(JSON.stringify(response.body), /LISTING_CONFLICT/);
  }
  return response;
}

const withdrawn = await control('withdraw_listing', first, 'withdraw', 200, 2);
assert.equal(withdrawn.body.receipt.status, 'withdrawn');
const second = await observe('withdrawn', 2);
steps.push({ step: 'withdraw', http: withdrawn.http, listing, version: 2, status: 'withdrawn' });

const beforeStale = publishedState();
const stale = await control('republish_listing', first, 'stale', 409);
assert.deepEqual(publishedState(), beforeStale);
assert.equal(model.state.ledger.has('ap01-control-stale'), false);
steps.push({ step: 'stale republish', http: stale.http, expectedVersion: 1, currentVersion: 2, effects: 0 });

const republished = await control('republish_listing', second, 'republish', 200, 3);
assert.equal(republished.body.receipt.status, 'published');
steps.push({ step: 'republish', http: republished.http, listing, version: 3, status: 'published' });
const beforeReadback = publishedState();
await observe('published', 3);
assert.deepEqual(publishedState(), beforeReadback);
assert.deepEqual(effects, ['publish', 'withdraw_listing', 'republish_listing']);
steps.push({ step: 'readback', http: 200, listing, version: 3, status: 'published', effects: 0 });
console.log(JSON.stringify({ result: 'PASS_CONTROLLED_HANDLER_COUPLING', actor, ...scope, steps }, null, 2));
