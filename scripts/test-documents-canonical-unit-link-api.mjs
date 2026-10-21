import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const { NextRequest } = require('next/server');

let claimsResult = { data: { claims: { sub: '21300000-0000-4000-8000-000000000001' } }, error: null };
let rpcResult;
let calls = [];

function loadRoute() {
  const filename = fileURLToPath(new URL('../src/app/api/customer/v1/documents/route.ts', import.meta.url));
  const compiled = new Module(filename);
  compiled.require = (specifier) => {
    if (specifier === '@/lib/supabase/server') {
      return {
        createClient: async () => ({
          auth: {
            getClaims: async () => {
              calls.push({ operation: 'getClaims' });
              return claimsResult;
            },
          },
          schema: (schemaName) => {
            calls.push({ operation: 'schema', schemaName });
            return {
              rpc: async (rpcName, args) => {
                calls.push({ operation: 'rpc', rpcName, args });
                return rpcResult;
              },
            };
          },
        }),
      };
    }
    return require(specifier);
  };
  compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText, filename);
  return compiled.exports;
}

const route = loadRoute();
const contextId = '21300000-0000-4000-8000-000000000070';
const safePayload = {
  context: { id: contextId, role: 'property_manager', scope: 'property' },
  view: 'links',
  total: 1,
  rows: [{
    id: '21300000-0000-4000-8000-000000000100',
    document_title: 'Authorized Unit Document',
    entity_type: 'portfolio.unit',
    entity_label: 'CANON-UNIT-01',
    relation_type: 'attachment',
    created_at: '2026-10-21T00:00:00.000Z',
  }],
  summary: { documents: 1, published: 0, legal_hold: 0, expiring: 0 },
  detail: null,
  read_only: true,
  storage_access: false,
  signed_urls: false,
  generated_at: '2026-10-21T00:00:00.000Z',
};

function request(query = `context_id=${contextId}&view=links&limit=25&offset=0`) {
  return new NextRequest(`https://cladora.test/api/customer/v1/documents?${query}`);
}

function assertPrivateNoCache(response) {
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('vary'), 'Cookie');
}

async function check(name, run) {
  calls = [];
  await run();
  console.log(`PASS ${name}`);
}

assert.equal(typeof route.GET, 'function');
assert.equal(route.POST, undefined, 'Documents list route exposes no mutation handler');

await check('real GET delegates exact bounded link query and returns canonical Unit label', async () => {
  rpcResult = { data: safePayload, error: null };
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  assertPrivateNoCache(response);
  assert.deepEqual(await response.json(), safePayload);
  assert.deepEqual(calls, [
    { operation: 'getClaims' },
    { operation: 'schema', schemaName: 'customer_api' },
    {
      operation: 'rpc',
      rpcName: 'get_documents_v1',
      args: {
        p_context_id: contextId,
        p_view: 'links',
        p_query: null,
        p_status: null,
        p_classification: null,
        p_from: null,
        p_to: null,
        p_limit: 25,
        p_offset: 0,
        p_id: null,
      },
    },
  ]);
  const body = JSON.stringify(safePayload);
  for (const forbidden of ['object_path', 'sha256', 'raw_audit', 'audit_event_id', 'storage_object_id']) {
    assert.equal(body.includes(forbidden), false, `${forbidden} must not cross the link API boundary`);
  }
  assert.equal(calls.some(({ operation }) => ['insert', 'update', 'delete', 'from', 'storage'].includes(operation)), false);
});

await check('invalid input is fail-closed before auth or RPC', async () => {
  rpcResult = { data: safePayload, error: null };
  const response = await route.GET(request(`context_id=${contextId}&view=links&limit=101`));
  assert.equal(response.status, 400);
  assertPrivateNoCache(response);
  assert.deepEqual(await response.json(), { error: { code: 'INVALID_DOCUMENT_QUERY' } });
  assert.deepEqual(calls, []);
});

await check('missing actor is fail-closed before RPC', async () => {
  claimsResult = { data: { claims: {} }, error: null };
  const response = await route.GET(request());
  assert.equal(response.status, 401);
  assertPrivateNoCache(response);
  assert.deepEqual(await response.json(), { error: { code: 'UNAUTHORIZED' } });
  assert.deepEqual(calls, [{ operation: 'getClaims' }]);
  claimsResult = { data: { claims: { sub: '21300000-0000-4000-8000-000000000001' } }, error: null };
});

await check('revoked or expired authority is sanitized as access denied', async () => {
  rpcResult = {
    data: null,
    error: {
      code: '42501',
      message: 'customer_context_access_denied private/authorized.pdf deadbeef',
      details: 'documents.document_versions object_path sha256',
    },
  };
  const response = await route.GET(request());
  assert.equal(response.status, 403);
  assertPrivateNoCache(response);
  const body = await response.json();
  assert.deepEqual(body, { error: { code: 'DOCUMENT_ACCESS_DENIED' } });
  assert.equal(JSON.stringify(body).includes('private/authorized.pdf'), false);
  assert.equal(JSON.stringify(body).includes('sha256'), false);
  assert.equal(calls.filter(({ operation }) => operation === 'rpc').length, 1);
});

await check('unexpected database failure is sanitized and remains no-cache', async () => {
  rpcResult = {
    data: null,
    error: {
      code: '42703',
      message: 'column u.unit_code does not exist',
      details: 'private database metadata',
    },
  };
  const response = await route.GET(request());
  assert.equal(response.status, 500);
  assertPrivateNoCache(response);
  const body = await response.json();
  assert.deepEqual(body, { error: { code: 'DOCUMENT_QUERY_FAILED' } });
  assert.equal(JSON.stringify(body).includes('unit_code'), false);
  assert.equal(JSON.stringify(body).includes('42703'), false);
});

console.log('Documents canonical Unit link API: 5/5 PASS');
