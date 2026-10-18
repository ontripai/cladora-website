import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loadedModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name === 'server-only'
    ? {} : name.startsWith('.')
      ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name),
  loadedModule, loadedModule.exports);
  cache.set(url.href, loadedModule.exports);
  return loadedModule.exports;
}

const {
  createServiceSubjectLinkRequestPoolV1,
  handleServiceSubjectLinkHttpV1,
} = load(new URL('../src/lib/customer/service-request-subject-link-http-v1.ts', import.meta.url));

const source = readFileSync(new URL(
  '../src/lib/customer/service-request-subject-link-http-v1.ts', import.meta.url,
), 'utf8');
assert.match(source, /createCorePostgresTransactionHostV1/);
assert.match(source, /createServiceSubjectLinkCoreProvidersV1/);
assert.match(source, /buildServiceSubjectLinkCoreCommandV1/);
assert.match(source, /createClient/);
assert.match(source, /hasTrustedMutationOrigin/);
assert.doesNotMatch(source, /service_role|SUPABASE_DB_URL|authorization.*header/i);
assert.equal(existsSync(new URL(
  '../src/app/api/customer/v1/services/requests/[id]/subject-links/route.ts', import.meta.url,
)), false, 'isolated handler must not add a production route');

const id = value => `76000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const intent = {
  context_id: id(1), workspace_id: id(2), service_request_id: id(3),
  expected_request_version: 4, reference_kind: 'message', reference_id: id(4),
  source_version: 7, relation: 'conversation', idempotency_key: 'http-subject-link-01',
};
const origin = 'http://127.0.0.1:41791';
const request = (body = intent, headers = {}, path = intent.service_request_id, query = '') => new Request(
  `${origin}/isolated/service-requests/${path}/subject-links${query}`,
  { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body) },
);
let poolCalls = 0;
const unavailablePool = {
  contract_version: 'core-platform-service-subject-link-role-bound-pool.v1',
  connection_model: 'direct',
  async connect() {
    poolCalls += 1;
    throw new Error('database_not_available');
  },
};
const session = (overrides = {}) => ({
  source: 'supabase_verified_session', actor_id: id(5), assurance_level: 'aal2',
  expires_at: Math.floor(Date.now() / 1000) + 300, ...overrides,
});
const call = (req, auth = async () => session()) => handleServiceSubjectLinkHttpV1(
  req, intent.service_request_id, { role_bound_pool: unavailablePool, authenticate: auth },
);

let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
}

await check('cross-origin request is denied before auth or database', async () => {
  let authCalls = 0;
  const response = await call(request(intent, { origin: 'https://attacker.invalid' }),
    async () => { authCalls += 1; return session(); });
  assert.equal(response.status, 403);
  assert.equal(authCalls, 0);
  assert.equal(poolCalls, 0);
});

await check('missing Origin is fail-closed', async () => {
  const response = await call(request(intent, { origin: '' }));
  assert.equal(response.status, 403);
  assert.equal(poolCalls, 0);
});

await check('unknown query parameter is rejected', async () => {
  const response = await call(request(intent, {}, intent.service_request_id, '?actor_id=ignored'));
  assert.equal(response.status, 400);
  assert.equal(poolCalls, 0);
});

await check('strict body rejects actor and authority injection', async () => {
  for (const extra of [{ actor_id: id(9) }, { authority_version: 99 }, { permission_code: 'allow' }]) {
    const response = await call(request({ ...intent, ...extra }));
    assert.equal(response.status, 400);
  }
  assert.equal(poolCalls, 0);
});

await check('path and body Request identities must match', async () => {
  const response = await handleServiceSubjectLinkHttpV1(
    request(intent, {}, id(99)), id(99), {
      role_bound_pool: unavailablePool, authenticate: async () => session(),
    },
  );
  assert.equal(response.status, 400);
  assert.equal(poolCalls, 0);
});

await check('missing session is 401 with no host invocation', async () => {
  const response = await call(request(), async () => null);
  assert.equal(response.status, 401);
  assert.equal(poolCalls, 0);
});

await check('expired session is 401 with no host invocation', async () => {
  const response = await call(request(), async () => session({ expires_at: 1 }));
  assert.equal(response.status, 401);
  assert.equal(poolCalls, 0);
});

await check('verified AAL1 is 403 with no host invocation', async () => {
  const response = await call(request(), async () => session({ assurance_level: 'aal1' }));
  assert.equal(response.status, 403);
  assert.equal(poolCalls, 0);
});

await check('authority failure is bounded and private', async () => {
  const response = await call(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { outcome: 'denied', code: 'AUTHORITY_UNAVAILABLE' });
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(poolCalls, 1);
});

await check('request adapter consumes only the fixed lease and binds six GUCs transaction-locally', async () => {
  const calls = [];
  const identity = {
    claims: '', subject: '', assurance: '', role: '', context: '', workspace: '',
    sqlRole: 'cladora_service_subject_link_executor',
    sessionRole: 'cladora_service_subject_link_runtime',
  };
  let transactionOpen = false;
  const clearLocal = () => Object.assign(identity, {
    claims: '', subject: '', assurance: '', role: '', context: '', workspace: '',
  });
  const raw = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.includes('current_user::text')) return { rows: [{
        current_user: identity.sqlRole, session_user: identity.sessionRole,
      }], rowCount: 1 };
      if (text.startsWith('begin')) transactionOpen = true;
      if (text.includes("set_config('request.jwt.claims',$1,true)")) {
        [identity.claims, identity.subject, identity.assurance, identity.role,
          identity.context, identity.workspace] = values;
      }
      if (text === 'commit' || text === 'rollback') {
        transactionOpen = false;
        clearLocal();
      }
      return { rows: [], rowCount: 0 };
    },
    release(error) { calls.push({ release: { error: error ?? null, identity: { ...identity } } }); },
  };
  const pool = {
    contract_version: 'core-platform-service-subject-link-role-bound-pool.v1',
    connection_model: 'session_pooler',
    async connect() { return raw; },
  };
  const binding = { context_id: intent.context_id, workspace_id: intent.workspace_id };
  const first = await createServiceSubjectLinkRequestPoolV1(pool, session(), binding).connect();
  assert.deepEqual(identity, {
    claims: '', subject: '', assurance: '', role: '', context: '', workspace: '',
    sqlRole: 'cladora_service_subject_link_executor',
    sessionRole: 'cladora_service_subject_link_runtime',
  }, 'Core supplies an already-clean fixed executor lease');
  await first.query('begin isolation level serializable');
  assert.equal(JSON.parse(identity.claims).sub, id(5));
  assert.deepEqual(identity, {
    claims: JSON.stringify({ sub: id(5), role: 'authenticated', aal: 'aal2' }),
    subject: id(5), assurance: 'aal2', role: 'authenticated',
    context: intent.context_id, workspace: intent.workspace_id,
    sqlRole: 'cladora_service_subject_link_executor',
    sessionRole: 'cladora_service_subject_link_runtime',
  });
  await first.query('rollback');
  first.release();
  const secondSession = session({ actor_id: id(6) });
  const second = await createServiceSubjectLinkRequestPoolV1(
    pool, secondSession, binding,
  ).connect();
  await second.query('begin isolation level serializable');
  assert.equal(JSON.parse(identity.claims).sub, id(6));
  assert.equal(JSON.parse(identity.claims).aal, 'aal2');
  assert.equal(identity.subject, id(6));
  assert.equal(identity.assurance, 'aal2');
  assert.equal(identity.role, 'authenticated');
  assert.equal(identity.context, intent.context_id);
  assert.equal(identity.workspace, intent.workspace_id);
  assert.equal(identity.sqlRole, 'cladora_service_subject_link_executor');
  await second.query('commit');
  second.release();
  assert.equal(transactionOpen, false);
  assert.equal(identity.claims, '');
  assert.equal(calls.some(call => call.text === 'reset role'), false,
    'consumer must never reset the Core-owned SQL role');
});

console.log(`SERVICE subject-link isolated HTTP contract: ${checks}/${checks} PASS (synthetic session boundary; no database commit implied).`);
