import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireDependency = createRequire(path.join(root, 'package.json'));
const ts = requireDependency('typescript');
const id = value => `10000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const timestamp = '2026-11-03T12:00:00.123456+00:00';

function makeLoader(overrides = {}) {
  const cache = new Map();
  const load = relative => {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const instance = new Module(filename);
    cache.set(filename, instance);
    instance.require = specifier => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        const base = specifier.startsWith('@/')
          ? path.join(root, 'src', specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(existsSync);
        assert.ok(resolved, `dependency not found: ${specifier}`);
        return load(resolved);
      }
      return requireDependency(specifier);
    };
    const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    assert.deepEqual(output.diagnostics, []);
    instance._compile(output.outputText, filename);
    return instance.exports;
  };
  return load;
}

const labels = { ro: 'Întreținere sigură', en: 'Safe maintenance', fa: 'نگهداری ایمن' };
const revision = {
  labels,
  description: { ro: 'Descriere multilinie\nvalidă', en: 'Valid multiline\ndescription', fa: 'شرح معتبر\nچندخطی' },
  acquisition_mode: 'pre_quote',
  price: { kind: 'unit', amount: '123456789012345.123456', currency: 'RON', unit_code: 'hour', tax_display: 'excluded' },
  valid_from: timestamp,
  valid_until: null,
  cancellation_terms: { ro: 'Anulare cu notificare', en: 'Cancellation with notice', fa: 'لغو با اطلاع قبلی' },
  acceptance_criteria: { ro: 'Confirmare scrisă', en: 'Written confirmation', fa: 'تأیید کتبی' },
  document_version_ids: [],
};

const routes = [
  {
    name: 'self-person', path: 'src/app/api/customer/v1/services/self-person/route.ts', max: 2 * 1024,
    rpc: 'register_service_self_person_v1',
    body: { context_id: id(1), workspace_id: id(2), name: 'نام معتبر Ștefan', valid_until: timestamp, confirm_self: true, idempotency_key: 'self-person-0001' },
  },
  {
    name: 'catalog', path: 'src/app/api/customer/v1/services/catalog/route.ts', max: 256 * 1024,
    rpc: 'mutate_service_catalog_v1',
    body: { kind: 'create', request: { context_id: id(1), workspace_id: id(2), definition_id: id(3), provider_party_id: id(4), revision, idempotency_key: 'catalog-create-0001' } },
  },
  {
    name: 'catalog-management', path: 'src/app/api/customer/v1/services/catalog/management/route.ts', max: 8 * 1024,
    rpc: 'update_service_definition_v1',
    body: { context_id: id(1), workspace_id: id(2), definition_id: id(3), expected_lock_version: 7, labels, active: true, reason: 'Actualizare controlată نگهداری', idempotency_key: 'catalog-manage-0001' },
  },
  {
    name: 'catalog-definitions', path: 'src/app/api/customer/v1/services/catalog/definitions/route.ts', max: 8 * 1024,
    rpc: 'create_service_definition_v1',
    body: { context_id: id(1), workspace_id: id(2), code: 'safe_maintenance', labels, idempotency_key: 'catalog-definition-0001' },
  },
  {
    name: 'requests', path: 'src/app/api/customer/v1/services/requests/route.ts', max: 32 * 1024,
    rpc: 'create_service_request_v1',
    body: { context_id: id(1), workspace_id: id(2), offering_id: id(3), published_revision_id: id(4), beneficiary_party_id: id(5), description: 'Solicitare validă\nدرخواست معتبر\nValid request', idempotency_key: 'service-request-0001' },
  },
  {
    name: 'quotes', path: 'src/app/api/customer/v1/services/quotes/route.ts', max: 40 * 1024,
    rpc: 'create_service_quote_draft_v2',
    body: { context_id: id(1), workspace_id: id(2), request_id: id(3), expected_request_version: 9, published_revision_id: id(4), scope: 'Domeniu exact\nدامنه دقیق\nExact scope', total_minor: '900719925474099312', currency: 'RON', payer_shares: [{ party_id: id(5), amount_minor: '900719925474099312' }], valid_until: timestamp, idempotency_key: 'service-quote-0001' },
  },
  {
    name: 'quote-publications', path: 'src/app/api/customer/v1/services/quotes/publications/route.ts', max: 2 * 1024,
    rpc: 'publish_service_quote_v1',
    body: { context_id: id(1), workspace_id: id(2), quote_id: id(3), expected_version: 9, idempotency_key: 'quote-publication-0001' },
  },
];

function responseFor(name) {
  return name === 'publish_service_quote_v1'
    ? { quote_id: id(3), version: 10, status: 'presented' }
    : { ok: true };
}

function fixture(route) {
  const calls = [];
  const client = {
    auth: { getClaims: async () => ({ data: { claims: { sub: id(99), aal: 'aal2' } }, error: null }) },
    schema(schema) {
      assert.equal(schema, 'customer_api');
      return { rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: responseFor(name), error: null };
      } };
    },
  };
  const nextResponse = { json: (data, init) => Response.json(data, init) };
  const load = makeLoader({
    '@/lib/supabase/server': { createClient: async () => client },
    'next/server': { NextResponse: nextResponse },
    'next/server.js': { NextResponse: nextResponse },
  });
  return { calls, handler: load(route.path).POST };
}

function request(body, headers = {}, chunks = null) {
  const url = 'https://service.test/api/customer/v1/services/test';
  const init = {
    method: 'POST',
    headers: { origin: 'https://service.test', 'content-type': 'application/json; charset=utf-8', ...headers },
  };
  if (chunks) {
    init.body = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    init.duplex = 'half';
  } else {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const value = new Request(url, init);
  Object.defineProperty(value, 'nextUrl', { value: new URL(url) });
  return value;
}

const encoder = new TextEncoder();
const cases = [];
for (const route of routes) {
  const source = readFileSync(path.join(root, route.path), 'utf8');
  assert.match(source, new RegExp(`const MAX_BODY_BYTES = ${route.max / 1024} \\* 1024`));
  assert.match(source, /parseJsonWithLimit<unknown>\(request, MAX_BODY_BYTES\)/);
  assert.doesNotMatch(source, /request\.json\(/);

  {
    const f = fixture(route);
    const response = await f.handler(request(route.body));
    assert.equal(response.status, 200, `${route.name}: valid payload`);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].name, route.rpc);
    if (route.name === 'catalog') {
      assert.equal(f.calls[0].args.p_kind, route.body.kind);
      assert.deepEqual(f.calls[0].args.p_request, route.body.request);
    } else {
      assert.deepEqual(f.calls[0].args.p_request, route.body);
    }
    cases.push(`${route.name}: valid UTF-8 and exact RPC arguments`);
  }

  for (const [name, value] of [
    ['malformed JSON', request('{')],
    ['declared oversized', request('{}', { 'content-length': String(route.max + 1) })],
    ['actual oversized without Content-Length', request(null, {}, [new Uint8Array(route.max + 1).fill(120)])],
    ['multi-chunk oversized with spoofed Content-Length', request(null, { 'content-length': '1' }, [
      new Uint8Array(Math.floor(route.max / 2)).fill(120),
      new Uint8Array(route.max - Math.floor(route.max / 2) + 1).fill(120),
    ])],
  ]) {
    const f = fixture(route);
    const response = await f.handler(value);
    assert.equal(response.status, name === 'malformed JSON' ? 400 : 413, `${route.name}: ${name}`);
    assert.equal(f.calls.length, 0, `${route.name}: rejected body must not reach business RPC`);
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.equal(response.headers.get('vary'), 'Cookie');
    const result = await response.json();
    assert.equal(result.error.code, name === 'malformed JSON' ? 'INVALID_REQUEST' : 'PAYLOAD_TOO_LARGE');
    cases.push(`${route.name}: ${name}`);
  }
}

assert.equal(cases.length, 35);
console.log(JSON.stringify({
  suite: 'SERVICE-HTTP-BODY-BOUNDS-10',
  status: 'PASS',
  tests: cases.length,
  cases,
  proof: 'OFFLINE_REAL_ROUTE_WITH_CONTROLLED_RPC_BOUNDARY',
  native_database_auth: 'NOT_RUN_NOT_PASS',
}, null, 2));
