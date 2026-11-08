import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
const overrides = new Map();

function modulePath(filename) {
  if (extname(filename)) return filename;
  return `${filename}.ts`;
}

function load(filename) {
  filename = modulePath(filename);
  if (overrides.has(filename)) return overrides.get(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  if (filename.endsWith('.json')) {
    const mod = { exports: JSON.parse(readFileSync(filename, 'utf8')) };
    cache.set(filename, mod);
    return mod.exports;
  }
  const mod = { exports: {} };
  cache.set(filename, mod);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    },
  }).outputText;
  const localRequire = specifier => specifier === 'server-only'
    ? {}
    : specifier.startsWith('@/')
      ? load(resolve(root, 'src', specifier.slice(2)))
      : specifier.startsWith('.')
        ? load(resolve(dirname(filename), specifier))
        : require(specifier);
  new Function('require', 'module', 'exports', compiled)(localRequire, mod, mod.exports);
  return mod.exports;
}

const applicationPath = resolve(root, 'src/lib/customer/service-v14-execution/application-flow.ts');
const application = load(applicationPath);
let preflightDispatches = 0;
let submitDispatches = 0;
overrides.set(applicationPath, {
  ...application,
  async preflightServiceOfferingRequestV1() {
    preflightDispatches += 1;
    return {
      status: 'ready',
      contract: 'service-offering-request-flow.v1',
      source_kind: 'workspace',
      resources: [],
    };
  },
  async submitServiceOfferingRequestV1() {
    submitDispatches += 1;
    return { status: 'unknown', code: 'READBACK_REQUIRED' };
  },
});

let authMode = 'anonymous';
const actorA = '00000008-0000-4000-8000-000000000008';
const actorB = '00000009-0000-4000-8000-000000000009';
const claims = sub => ({
  sub,
  session_id: '00000010-0000-4000-8000-000000000010',
  exp: 1_900_000_000,
  role: 'authenticated',
  aal: 'aal2',
});
function controlledAuthClient() {
  if (authMode === 'transport') {
    return { auth: {
      getUser: async () => { throw new Error('private auth transport detail'); },
      getClaims: async () => ({ data: { claims: claims(actorA) }, error: null }),
    } };
  }
  if (authMode === 'anonymous') {
    return { auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getClaims: async () => ({ data: { claims: claims(actorA) }, error: null }),
    } };
  }
  if (authMode === 'expired') {
    return { auth: {
      getUser: async () => ({ data: { user: { id: actorA } }, error: null }),
      getClaims: async () => ({ data: null, error: new Error('expired private detail') }),
    } };
  }
  const subject = authMode === 'mismatch' ? actorB : actorA;
  return { auth: {
    getUser: async () => ({ data: { user: { id: actorA } }, error: null }),
    getClaims: async () => ({ data: { claims: claims(subject) }, error: null }),
  } };
}

overrides.set(resolve(root, 'src/lib/core/functional-request-auth-v1.ts'), {
  createCoreFunctionalRequestAuthV1: () => controlledAuthClient(),
});
overrides.set(resolve(root, 'src/lib/supabase/env.ts'), {
  getPublicSupabaseEnv: () => ({
    url: 'http://127.0.0.1:55421',
    publishableKey: 'controlled-browser-safe-key',
  }),
});
overrides.set(resolve(root, 'src/lib/supabase/server.ts'), {
  createClient: async () => controlledAuthClient(),
});

const { createCoreServiceFunctionalBindingV1 } = load(
  resolve(root, 'src/lib/core/service-functional-binding-v1.ts'),
);
const { createServiceOfferingRequestFlowHandlers } = load(
  resolve(root, 'src/lib/customer/service-v14-execution/http.ts'),
);
const { NextRequest } = require('next/server');

let poolCheckouts = 0;
const pool = {
  options: {
    host: '127.0.0.1',
    port: 55422,
    database: 'postgres',
    user: 'cladora_core_runtime',
    connectionTimeoutMillis: 5_000,
    query_timeout: 15_000,
  },
  async connect() {
    poolCheckouts += 1;
    throw new Error('controlled test must not reach PostgreSQL');
  },
};
const target = {
  contract: 'core-functional-development-target.v1',
  backend_id: `core15-dev:${'a'.repeat(32)}`,
  purpose: 'owned-isolated-persistent-development',
  host: '127.0.0.1',
  port: 55422,
  database_name: 'postgres',
  database_oid: 16_384,
  runtime_role: 'cladora_core_runtime',
  auth_origin: 'http://127.0.0.1:55421',
};
const binding = createCoreServiceFunctionalBindingV1({ pool, target });
const handlers = createServiceOfferingRequestFlowHandlers(request => binding.bind(request));

const ids = {
  context: '00000001-0000-4000-8000-000000000001',
  workspace: '00000002-0000-4000-8000-000000000002',
  offering: '00000003-0000-4000-8000-000000000003',
  revision: '00000004-0000-4000-8000-000000000004',
  beneficiary: '00000005-0000-4000-8000-000000000005',
};
const query = new URLSearchParams({
  context_id: ids.context,
  workspace_id: ids.workspace,
  offering_id: ids.offering,
  published_revision_id: ids.revision,
});
const body = {
  context_id: ids.context,
  workspace_id: ids.workspace,
  offering_id: ids.offering,
  published_revision_id: ids.revision,
  beneficiary_party_id: ids.beneficiary,
  resource: null,
  description: 'Controlled service request',
  idempotency_key: 'service-http-auth-classification-01',
};
const getRequest = () => new NextRequest(`http://localhost/api/customer/v1/services/offering-request-flow?${query}`);
const postRequest = (value = body, headers = {}) => new NextRequest(
  'http://localhost/api/customer/v1/services/offering-request-flow',
  { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) },
);
async function expectFailure(response, status, code) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: { code } });
}

for (const mode of ['anonymous', 'expired', 'mismatch']) {
  authMode = mode;
  const before = { poolCheckouts, preflightDispatches, submitDispatches };
  await expectFailure(await handlers.GET(getRequest()), 401, 'UNAUTHORIZED');
  await expectFailure(await handlers.POST(postRequest()), 401, 'UNAUTHORIZED');
  assert.deepEqual(
    { poolCheckouts, preflightDispatches, submitDispatches },
    before,
    `${mode} must be rejected before pool checkout or business dispatch`,
  );
}

authMode = 'transport';
await expectFailure(await handlers.GET(getRequest()), 503, 'RUNTIME_BINDING_INACTIVE');
await expectFailure(await handlers.POST(postRequest()), 503, 'RUNTIME_BINDING_INACTIVE');
assert.equal(poolCheckouts, 0);
assert.equal(preflightDispatches, 0);
assert.equal(submitDispatches, 0);

const inactive = createServiceOfferingRequestFlowHandlers(null);
await expectFailure(await inactive.GET(getRequest()), 503, 'RUNTIME_BINDING_INACTIVE');
await expectFailure(await inactive.POST(postRequest()), 503, 'RUNTIME_BINDING_INACTIVE');

const messageOnly = createServiceOfferingRequestFlowHandlers(async () => {
  throw new Error('AUTHENTICATION_REQUIRED');
});
await expectFailure(await messageOnly.GET(getRequest()), 503, 'RUNTIME_BINDING_INACTIVE');
const getterCode = createServiceOfferingRequestFlowHandlers(async () => {
  throw Object.defineProperty({}, 'code', {
    get() { return 'AUTHENTICATION_REQUIRED'; },
  });
});
await expectFailure(await getterCode.POST(postRequest()), 503, 'RUNTIME_BINDING_INACTIVE');

let guardedResolverCalls = 0;
const guarded = createServiceOfferingRequestFlowHandlers(async () => {
  guardedResolverCalls += 1;
  throw new Error('must not resolve invalid input');
});
await expectFailure(
  await guarded.GET(new NextRequest('http://localhost/api/customer/v1/services/offering-request-flow?workspace_id=bad')),
  400,
  'INVALID_REQUEST',
);
await expectFailure(await guarded.POST(postRequest(body, { origin: 'https://foreign.invalid' })), 403, 'INVALID_ORIGIN');
await expectFailure(
  await guarded.POST(new NextRequest('http://localhost/api/customer/v1/services/offering-request-flow', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  })),
  400,
  'INVALID_REQUEST',
);
assert.equal(guardedResolverCalls, 0, 'input guards must run before runtime binding');

authMode = 'valid';
const ready = await handlers.GET(getRequest());
assert.equal(ready.status, 200);
assert.deepEqual(await ready.json(), {
  status: 'ready',
  contract: 'service-offering-request-flow.v1',
  source_kind: 'workspace',
  resources: [],
});
await expectFailure(await handlers.POST(postRequest()), 503, 'READBACK_REQUIRED');
assert.equal(preflightDispatches, 1);
assert.equal(submitDispatches, 1);
assert.equal(poolCheckouts, 0, 'controlled successful dispatch must not touch native PostgreSQL');

console.log(JSON.stringify({
  task: 'SERVICE-HTTP-AUTH-CLASSIFICATION-01',
  cases: 17,
  auth_rejection_pool_checkouts: 0,
  auth_rejection_business_dispatches: 0,
  controlled_handler_core_binding: 'PASS',
  native_auth_db: 'NOT_RUN_NOT_PASS',
}));
