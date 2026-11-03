import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, Module } from 'node:module';
import { resolve } from 'node:path';

const migration = readFileSync('supabase/migrations/20261021085559_assets_current_authority_v1.sql', 'utf8');
const history = readFileSync('supabase/migrations/20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql', 'utf8');
const definition = /CREATE OR REPLACE FUNCTION assets\.check_asset_caller_v1\([\s\S]*?\$function\$;/g;
const before = [...history.matchAll(definition)].at(-1)?.[0];
assert.ok(before, 'exact last historical definition found');
const after = [...migration.matchAll(definition)];
assert.equal(after.length, 1, 'one existing function only');
const guard = /  -- BEGIN current-authority guard:[\s\S]*?  -- END current-authority guard\.\n\n/;
assert.ok(guard.test(after[0][0]));
assert.equal(after[0][0].replace(guard, ''), before,
  'signature, nine-field result, existing MFA/permission checks, volatility, definer and path remain byte-identical');
assert.doesNotMatch(migration, /\b(?:grant|revoke|alter|drop)\s|create\s+(?:table|type|schema|role|policy)\b/i);
for (const alias of ['g', 'm']) {
  assert.ok(migration.includes(`${alias}.starts_at <= statement_timestamp()`));
  assert.ok(migration.includes(`(${alias}.ends_at is null or ${alias}.ends_at > statement_timestamp())`));
}
const probe = readFileSync('supabase/tests/215_assets_actual_role_probe_v1_test.sql', 'utf8');
assert.equal(createHash('sha256').update(probe).digest('hex'),
  '0ef1f5bc3e8a07f08826b551ab908ac21ea83d39494520aa6ec2884f9d3716fa',
  'all 72 exact-head runtime assertions, including the four demonstrated failures, remain byte-identical');

// Actual Next GET + actual validation/error mapper; only Auth/RPC is mocked.
// No server, network, DB, Auth service, environment file or mutation is used.
const requireDependency = createRequire(resolve(process.env.ADVISOR_TEST_DEPENDENCY_ROOT ?? process.cwd(), 'package.json'));
const ts = requireDependency('typescript');
const { NextRequest } = requireDependency('next/server');
let claims, reply, calls;
const modules = new Map();
function loadTs(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const loaded = new Module(filename);
  modules.set(filename, loaded);
  loaded.require = specifier => {
    if (specifier === '@/lib/supabase/server') return { createClient: async () => ({
      auth: { getClaims: async () => { calls.push({ kind: 'auth' }); return claims; } },
      schema: schema => {
        assert.equal(schema, 'customer_api');
        return { rpc: async (name, args) => {
          assert.equal(name, 'get_asset_detail_v1', 'no mutation RPC allowed');
          calls.push({ kind: 'rpc', name, args });
          return reply;
        } };
      },
    }) };
    if (specifier.startsWith('@/')) return loadTs(resolve('src', `${specifier.slice(2)}.ts`));
    return requireDependency(specifier);
  };
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename, reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics, []);
  loaded._compile(compiled.outputText, filename);
  return loaded.exports;
}
const { GET } = loadTs(resolve('src/app/api/customer/v1/assets/[id]/route.ts'));
const actor = '21700000-0000-4000-8000-000000000001';
const context = '21700000-0000-4000-8000-000000000040';
const asset = '21700000-0000-4000-8000-000000000200';
let cases = 0;
const reset = () => {
  calls = [];
  claims = { data: { claims: { sub: actor } }, error: null };
  reply = { data: { id: asset, name: 'Synthetic asset' }, error: null };
};
async function request(query = `context_id=${context}`) {
  const response = await GET(new NextRequest(`http://127.0.0.1/api/customer/v1/assets/${asset}?${query}`),
    { params: Promise.resolve({ id: asset }) });
  assert.equal(response.headers.get('Cache-Control'), 'no-store, private');
  assert.equal(response.headers.get('Vary'), 'Cookie');
  cases++;
  return { status: response.status, body: await response.json() };
}
for (const name of ['Asset RO Ș', 'دارایی مالک', 'Owner asset']) {
  reset(); reply.data.name = name;
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, reply.data);
  assert.deepEqual(calls.at(-1).args, { p_context_id: context, p_asset_id: asset });
}
for (const scenario of ['context-expired', 'context-future', 'member-expired', 'member-future',
  'context-revoked', 'member-revoked', 'foreign-actor', 'foreign-tenant', 'missing-permission']) {
  reset();
  reply = { data: { id: asset, secret: 'must-not-project' },
    error: { code: '42501', message: `ACCESS_DENIED: User context invalid or inactive (${scenario})` } };
  const response = await request();
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
  assert.ok(!JSON.stringify(response.body).includes('must-not-project'));
  assert.ok(!JSON.stringify(response.body).includes(scenario), 'authority details sanitized');
}
for (const query of ['', 'context_id=invalid']) {
  reset(); const response = await request(query);
  assert.equal(response.status, 400); assert.deepEqual(calls, []);
}
for (const auth of [{ data: { claims: null }, error: null }, { data: null, error: { message: 'expired session' } }]) {
  reset(); claims = auth;
  assert.equal((await request()).status, 401);
  assert.equal(calls.filter(x => x.kind === 'rpc').length, 0);
}
// Same exact request after a revoke must be evaluated again, never cached.
reset(); assert.equal((await request()).status, 200);
reply = { data: null, error: { code: '42501', message: 'ACCESS_DENIED: User context invalid or inactive' } };
assert.equal((await request()).status, 403);
assert.equal((await request()).status, 403);
assert.equal(calls.filter(x => x.kind === 'rpc').length, 3);
console.log(JSON.stringify({ suite: 'assets-current-authority', sourceDelta: 'PASS',
  exactOriginalPgTapAssertionsPreserved: 72, actualGetHandlerCases: cases,
  boundary: 'MOCKED_AUTH_AND_RPC', postgres: 'NOT_RUN_NOT_PASS', mutations: 0 }));
