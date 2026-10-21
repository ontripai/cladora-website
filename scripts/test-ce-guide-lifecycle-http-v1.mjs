import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
let authFixture;
const supabaseStub = { createClient: async () => ({ auth: authFixture }) };

function load(url) {
  if (url.pathname.endsWith('/src/lib/supabase/server.ts')) return supabaseStub;
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  cache.set(url.href, loaded.exports);
  new Function('require', 'module', 'exports', compiled.outputText)(name => {
    if (name === 'server-only') return {};
    return name.startsWith('.')
      ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name);
  }, loaded, loaded.exports);
  cache.set(url.href, loaded.exports);
  return loaded.exports;
}

const runtimeUrl = new URL(
  '../src/lib/community/experience-guide-lifecycle-http-v1.ts', import.meta.url,
);
const lifecycleUrl = new URL(
  '../src/lib/community/experience-guide-lifecycle-provider-v1.ts', import.meta.url,
);
const runtime = load(runtimeUrl);
const lifecycle = load(lifecycleUrl);
const source = readFileSync(runtimeUrl, 'utf8');
const roleBoundPoolSource = readFileSync(new URL(
  '../src/lib/core/platform-role-bound-pool-v1.ts', import.meta.url,
), 'utf8');
const postgresHarness = readFileSync(new URL(
  './test-ce-guide-lifecycle-http-postgres-v1.mjs', import.meta.url,
), 'utf8');
const page = readFileSync(new URL(
  '../src/components/customer/CustomerExperienceGuidePage.tsx', import.meta.url,
), 'utf8');
const projection = readFileSync(new URL(
  '../src/lib/community/experience-guide-client.ts', import.meta.url,
), 'utf8');
const route = readFileSync(new URL(
  '../src/app/api/customer/v1/experience/guides/route.ts', import.meta.url,
), 'utf8');
const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);
const migrationNames = readdirSync(migrationDirectory);
const migrationSource = migrationNames.map(name => readFileSync(
  new URL(name, migrationDirectory), 'utf8',
)).join('\n');

assert.match(source, /createCorePostgresTransactionHostV1/);
assert.match(source, /createExperienceGuideLifecycleCoreProvidersV1/);
assert.match(source, /corePlatformRoleBoundPoolContractV1/);
assert.match(roleBoundPoolSource, /core-platform-role-bound-pool\.v1/);
assert.match(roleBoundPoolSource, /cladora_ce_guide_executor/);
assert.match(roleBoundPoolSource, /cladora_ce_guide_runtime/);
assert.match(source, /current_user::text as current_user,session_user::text as session_user/);
assert.doesNotMatch(source, /set\s+(?:local\s+)?role|with recursive\s+target_role|pg_catalog\.pg_auth_members/i);
assert.doesNotMatch(source, /cladora_rpc_owner|service_role|SUPABASE_DB|customer_api|command_ce_guide_v1|read_ce_guides_v1|resolve_ce_guide_reference_v1/i);
assert.match(postgresHarness, /createCorePlatformRoleBoundPoolV1/);
assert.match(migrationSource, /create role cladora_ce_guide_executor/i);
assert.match(migrationSource, /create role cladora_ce_guide_runtime/i);
assert.doesNotMatch(route, /experience-guide-lifecycle-http-v1/);
assert.match(page, /commands=\{null\}/);
assert.match(projection, /can_edit:\s*false/);
assert.equal(migrationNames.length, 290);
assert.equal(migrationNames.some(name => /runtime_wiring|lifecycle_http/i.test(name)), false);

const id = value => `75000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const requestValue = {
  context_id: id(1), workspace_id: id(2), guide_id: id(3), expected_version: 7,
  operation: 'publish', idempotency_key: 'ce-guide-http-01',
};
const trusted = {
  actor_id: id(4), authority_version: 9,
  provider_source_ids: [id(6), id(5), id(6), id(3)],
};

let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
}

await check('command mapping is stable, exact-versioned and source locked', async () => {
  const left = runtime.buildExperienceGuideLifecycleCoreCommandV1(requestValue, trusted);
  const right = runtime.buildExperienceGuideLifecycleCoreCommandV1(requestValue, trusted);
  assert.deepEqual(left, right);
  assert.equal(left.contract_version, 'core-transaction-command.v2');
  assert.equal(left.actor_id, trusted.actor_id);
  assert.equal(left.authority_version, 9);
  assert.equal(left.aggregate_version, 8);
  assert.equal(left.evaluation_purpose, 'experience.guide.publish');
  assert.deepEqual(left.subject_reference, {
    kind: 'experience.guide', id: id(3), version: 7, relation: 'publish', request_version: 1,
  });
  assert.deepEqual(left.provider_source_ids, [id(3), id(5), id(6)]);
  assert.match(left.input_fingerprint, /^ceg1:[0-9a-f]{64}$/);
});

await check('unpublish is target-free and has an independent stable profile', async () => {
  const command = runtime.buildExperienceGuideLifecycleCoreCommandV1({
    ...requestValue, operation: 'unpublish', idempotency_key: 'ce-guide-http-02',
  }, { ...trusted, provider_source_ids: [id(3)] });
  assert.equal(command.evaluation_purpose, 'experience.guide.unpublish');
  assert.equal(command.subject_reference.relation, 'unpublish');
  assert.deepEqual(command.provider_source_ids, [id(3)]);
  assert.throws(() => runtime.buildExperienceGuideLifecycleCoreCommandV1({
    ...requestValue, operation: 'unpublish', idempotency_key: 'ce-guide-http-03',
  }, trusted), /target_free/);
});

await check('public schema rejects actor, authority, transaction and evidence injection', async () => {
  for (const extra of [
    { actor_id: id(8) }, { authority_version: 99 }, { transaction_id: id(9) },
    { provider_evidence: {} }, { execution_role: 'postgres' },
  ]) {
    assert.equal(runtime.experienceGuideLifecycleHttpRequestV1Schema.safeParse({
      ...requestValue, ...extra,
    }).success, false);
  }
});

await check('provider factory directly consumes Core authority and CE lifecycle functions', async () => {
  const providers = runtime.createExperienceGuideLifecycleCoreProvidersV1();
  assert.equal(providers.provider_code, lifecycle.experienceGuideLifecycleProviderCodeV1);
  assert.equal(providers.replay_policy, lifecycle.experienceGuideLifecycleReplayPolicyV1);
  assert.equal(providers.validateProviders, lifecycle.validateExperienceGuideLifecycleV1);
  assert.equal(providers.validateReplay, lifecycle.validateExperienceGuideLifecycleReplayV1);
  assert.equal(providers.mutate, lifecycle.mutateExperienceGuideLifecycleV1);
});

await check('bounded result mapping exposes only outcome, receipt and resulting version', async () => {
  const receipt = {
    receipt_id: id(10), aggregate_version: 8, secret: 'PRIVATE_GUIDE_BODY',
  };
  for (const status of ['committed', 'exact_replay']) {
    const response = runtime.experienceGuideLifecycleHttpResponseV1({ status, receipt });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      outcome: status, receipt_id: id(10), guide_version: 8,
    });
  }
  const pending = runtime.experienceGuideLifecycleHttpResponseV1({
    status: 'unknown_commit', code: 'READBACK_REQUIRED',
  });
  assert.equal(pending.status, 202);
  assert.deepEqual(await pending.json(), { outcome: 'pending', code: 'READBACK_REQUIRED' });
  const conflict = runtime.experienceGuideLifecycleHttpResponseV1({
    status: 'denied', code: 'REPLAY_CONFLICT', authority: { secret: 'PRIVATE_AUTHORITY_ROW' },
  });
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { outcome: 'denied', code: 'IDEMPOTENCY_CONFLICT' });
  const denied = runtime.experienceGuideLifecycleHttpResponseV1({
    status: 'denied', code: 'PROVIDER_UNAVAILABLE', authority: { membership_id: id(99) },
  });
  assert.equal(denied.status, 403);
  assert.equal(JSON.stringify(await denied.json()).includes(id(99)), false);
});

const origin = 'http://127.0.0.1:41792';
const request = (body = requestValue, headers = {}, query = '') => new Request(
  `${origin}/isolated/experience/guides/lifecycle${query}`,
  { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body) },
);
const session = overrides => ({
  source: 'supabase_verified_session', actor_id: id(4), assurance_level: 'aal2',
  expires_at: Math.floor(Date.now() / 1000) + 300, ...overrides,
});
let poolCalls = 0;
const unavailablePool = {
  contract_version: 'core-platform-role-bound-pool.v1',
  async connect() { poolCalls += 1; throw new Error('unavailable'); },
};
const call = (req, authenticate = async () => session()) => runtime.handleExperienceGuideLifecycleHttpV1(
  req, { role_bound_pool: unavailablePool, authenticate },
);

await check('origin, strict input and session failures happen before database checkout', async () => {
  let authCalls = 0;
  assert.equal((await call(request(requestValue, { origin: 'https://attacker.invalid' }),
    async () => { authCalls += 1; return session(); })).status, 403);
  assert.equal(authCalls, 0);
  assert.equal((await call(request({ ...requestValue, actor_id: id(8) }))).status, 400);
  assert.equal((await call(request(requestValue, {}, '?authority=allow'))).status, 400);
  assert.equal((await call(request(), async () => null)).status, 401);
  assert.equal((await call(request(), async () => session({ expires_at: 1 }))).status, 401);
  assert.equal((await call(request(), async () => session({ assurance_level: 'aal1' }))).status, 403);
  assert.equal(poolCalls, 0);
});

await check('database unavailability is bounded after verified AAL2', async () => {
  const response = await call(request());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { outcome: 'denied', code: 'GUIDE_RUNTIME_UNAVAILABLE' });
  assert.equal(poolCalls, 1);
});

await check('missing or non-canonical role-bound capability fails closed without checkout', async () => {
  for (const role_bound_pool of [null, {
    contract_version: 'consumer-role-pool.v1',
    async connect() { poolCalls += 1; throw new Error('must_not_connect'); },
  }]) {
    const response = await runtime.handleExperienceGuideLifecycleHttpV1(request(), {
      role_bound_pool, authenticate: async () => session(),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      outcome: 'denied', code: 'GUIDE_RUNTIME_UNAVAILABLE',
    });
  }
  assert.equal(poolCalls, 1);
});

await check('Supabase adapter requires matching current user, session, expiry and MFA assurance', async () => {
  const actor = id(11);
  authFixture = {
    getUser: async () => ({ data: { user: { id: actor } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: actor }, expires_at: Math.floor(Date.now() / 1000) + 300 } }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal2' }, error: null }) },
  };
  assert.deepEqual(await runtime.authenticateExperienceGuideLifecycleServerSessionV1(request()), {
    source: 'supabase_verified_session', actor_id: actor, assurance_level: 'aal2',
    expires_at: (await authFixture.getSession()).data.session.expires_at,
  });
  authFixture = { ...authFixture,
    getSession: async () => ({ data: { session: { user: { id: id(12) }, expires_at: Math.floor(Date.now() / 1000) + 300 } }, error: null }),
  };
  assert.equal(await runtime.authenticateExperienceGuideLifecycleServerSessionV1(request()), null);
});

await check('request pool requires the exact role-bound identity and scrubs only request claims', async () => {
  const calls = [];
  const identity = {
    claims: 'poisoned', subject: id(90), assurance: 'aal1', role: 'poisoned',
    currentUser: 'cladora_ce_guide_executor', sessionUser: 'cladora_ce_guide_runtime',
  };
  const raw = {
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.includes("set_config('request.jwt.claims',$1,true)")) {
        [identity.claims, identity.subject, identity.assurance, identity.role] = values;
      }
      if (text.includes("set_config('request.jwt.claims','',false)")) {
        identity.claims = ''; identity.subject = ''; identity.assurance = ''; identity.role = '';
      }
      if (text.includes('current_user::text as current_user')) {
        return { rows: [{
          current_user: identity.currentUser, session_user: identity.sessionUser,
        }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release(error) { calls.push({ release: error ?? null, identity: { ...identity } }); },
  };
  const pool = {
    contract_version: 'core-platform-role-bound-pool.v1',
    async connect() { return raw; },
  };
  const wrapped = await runtime.createExperienceGuideLifecycleRequestPoolV1(
    pool, session(),
  ).connect();
  assert.deepEqual(identity, {
    claims: '', subject: '', assurance: '', role: '',
    currentUser: 'cladora_ce_guide_executor', sessionUser: 'cladora_ce_guide_runtime',
  });
  await wrapped.query('begin isolation level serializable');
  assert.equal(JSON.parse(identity.claims).sub, id(4));
  assert.equal(identity.assurance, 'aal2');
  const identityIndex = calls.findIndex(call => call.text?.includes("set_config('request.jwt.claims',$1,true)"));
  const roleChecks = calls
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.text?.includes('current_user::text as current_user'));
  assert.ok(roleChecks.length >= 2);
  assert.ok(roleChecks[1].index < identityIndex);
  assert.equal(calls.some(call => /set\s+(?:local\s+)?role/i.test(call.text)), false);
  await wrapped.query('rollback');
  wrapped.release();
  assert.deepEqual(identity, {
    claims: '', subject: '', assurance: '', role: '',
    currentUser: 'cladora_ce_guide_executor', sessionUser: 'cladora_ce_guide_runtime',
  });

  Object.assign(identity, { claims: 'other', subject: id(91), assurance: 'aal1', role: 'bad' });
  const uncertain = await runtime.createExperienceGuideLifecycleRequestPoolV1(
    pool, session({ actor_id: id(13) }),
  ).connect();
  await uncertain.query('begin isolation level serializable');
  uncertain.release(true);
  const release = calls.filter(call => Object.hasOwn(call, 'release')).at(-1);
  assert.equal(release.release, true, 'unknown/open transaction connection must be destroyed');
});

await check('mismatched or unreadable role-bound identity destroys the lease before BEGIN', async () => {
  for (const mode of ['current_user', 'session_user', 'identity_error']) {
    const calls = [];
    let destroyed = false;
    const raw = {
      async query(text) {
        calls.push(text);
        if (text.includes('current_user::text as current_user')) {
          if (mode === 'identity_error') throw new Error('identity_unavailable');
          return { rows: [{
            current_user: mode === 'current_user' ? 'postgres' : 'cladora_ce_guide_executor',
            session_user: mode === 'session_user' ? 'postgres' : 'cladora_ce_guide_runtime',
          }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release(error) { destroyed = error === true; },
    };
    await assert.rejects(() => runtime.createExperienceGuideLifecycleRequestPoolV1(
      { contract_version: 'core-platform-role-bound-pool.v1', async connect() { return raw; } },
      session(),
    ).connect());
    assert.equal(calls.some(text => /set\s+(?:local\s+)?role/i.test(text)), false);
    assert.equal(calls.some(text => text.includes("set_config('request.jwt.claims',$1,true)")), false);
    assert.equal(destroyed, true);
  }
});

console.log(`CE Guide lifecycle inactive HTTP contract: ${checks}/${checks} PASS; route/UI/grants remain closed`);
