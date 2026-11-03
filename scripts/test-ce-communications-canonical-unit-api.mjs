/** Independent real GET-handler proof; Supabase auth/RPC boundary is MOCKED.
 * No PostgreSQL execution, SQL authorization, Next server, or connected proof.
 * Run: node scripts/test-ce-communications-canonical-unit-api.mjs
 * An existing dependency tree may be selected with CE_TEST_DEPENDENCY_ROOT.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const requireDependency = createRequire(path.resolve(
  process.env.CE_TEST_DEPENDENCY_ROOT ?? root, 'package.json'));
const ts = requireDependency('typescript');
const { NextRequest } = requireDependency('next/server');
const routePath = path.join(root, 'src/app/api/customer/v1/communications/route.ts');
const source = readFileSync(routePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: routePath,
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics, [], 'real handler transpiles without diagnostics');

// Guard the minimal fix and unchanged authorization body against accidental drift.
const migrationDir = path.join(root, 'supabase/migrations');
const migrations = readdirSync(migrationDir).filter(n => n.endsWith('.sql')).sort();
const definition = /create or replace function communications\.get_customer_communications\([\s\S]*?end \$\$;/i;
const definitions = migrations.flatMap(name => {
  const match = readFileSync(path.join(migrationDir, name), 'utf8').match(definition);
  return match ? [{ name, sql: match[0] }] : [];
});
const candidate = definitions.at(-1);
const previous = definitions.at(-2);
assert.match(candidate.name, /ce_communications_canonical_unit_v1\.sql$/);
assert.equal(previous.name, '20260902074312_customer_password_optional_mfa_policy.sql');
assert.equal(candidate.sql, previous.sql.replace('u.unit_code', 'u.code as unit_code'),
  'only canonical column/alias changes; all authorization and views remain byte-identical');
assert.equal((candidate.sql.match(/u\.code as unit_code/g) ?? []).length, 1);
assert.doesNotMatch(candidate.sql, /u\.unit_code|exception when/i);
const migration = readFileSync(path.join(migrationDir, candidate.name), 'utf8');
assert.equal((migration.match(/create or replace function/gi) ?? []).length, 1);
assert.doesNotMatch(migration, /\b(?:grant|revoke|alter|create table)\b/i,
  'migration preserves ACL/owner and introduces no schema or role changes');

let state;
const calls = [];
const dbBoundary = new Proxy({
  auth: { async getClaims() {
    calls.push(['claims']);
    return state.auth ?? { data: { claims: { sub: '21200000-0000-4000-8000-000000000001' } }, error: null };
  } },
  schema(name) {
    calls.push(['schema', name]);
    assert.equal(name, 'customer_api');
    return { async rpc(name, args) {
      calls.push(['rpc', name, args]);
      assert.equal(name, 'get_communications_v1', 'only existing read gateway may execute');
      return structuredClone(state.rpc);
    } };
  },
}, { get(target, key) {
  if (key === 'then') return undefined; // Async createClient promise assimilation.
  assert.ok(key in target, `unexpected DB boundary/mutation access: ${String(key)}`);
  return target[key];
} });
const routeModule = new Module(routePath);
routeModule.filename = routePath;
routeModule.require = name => name === '@/lib/supabase/server'
  ? { createClient: async () => { calls.push(['client']); return dbBoundary; } }
  : requireDependency(name);
routeModule._compile(compiled.outputText, routePath);
assert.deepEqual(Object.keys(routeModule.exports), ['GET'], 'route exports only GET');
const { GET } = routeModule.exports;
const context = '21200000-0000-4000-8000-000000000040';
const row = {
  id: '21200000-0000-4000-8000-000000000060', name: 'Synthetic canonical channel',
  scope: 'unit', is_private: false, status: 'active', created_at: '2026-10-21T00:00:00Z',
  property_name: 'Synthetic property', building_name: 'Synthetic building',
  unit_code: 'CE-Unit/212-A', member: false,
};
const payload = {
  context: { id: context, role: 'association_admin', scope: 'unit' },
  view: 'channels', total: 1, rows: [row], summary: { channels: 1 },
  detail: null, read_only: true, anonymous_polls_aggregated: true,
  generated_at: '2026-10-21T00:00:00Z',
};
let passed = 0;
async function check(name, { query = `context_id=${context}&view=channels`, rpc = { data: payload, error: null }, auth, status = 200, expected = payload, rpcCount = 1, clientCount = 1, inspect } = {}) {
  calls.length = 0;
  state = { rpc, auth };
  const response = await GET(new NextRequest(`http://ce.test/api/customer/v1/communications?${query}`, { method: 'GET' }));
  assert.equal(response.status, status, name);
  assert.equal(response.headers.get('cache-control'), 'no-store, private', name);
  assert.equal(response.headers.get('pragma'), 'no-cache', name);
  assert.equal(response.headers.get('vary'), 'Cookie', name);
  const body = await response.json();
  assert.deepEqual(body, expected, name);
  assert.equal(calls.filter(c => c[0] === 'rpc').length, rpcCount, name);
  assert.equal(calls.filter(c => c[0] === 'client').length, clientCount, name);
  inspect?.(calls);
  passed++;
  console.log(`PASS ${name}`);
}
await check('exact canonical code and existing row/envelope shape pass through', {
  inspect(calls) { assert.deepEqual(calls.at(-1)[2], {
    p_context_id: context, p_view: 'channels', p_query: null, p_status: null,
    p_from: null, p_to: null, p_limit: 25, p_offset: 0, p_id: null,
  }); },
});
await check('all existing GET filters forwarded', {
  query: `context_id=${context}&view=channels&query=%20CE%20&status=active&from=2026-10-01&to=2026-10-21&limit=5&offset=2&id=${row.id}`,
  inspect(calls) { assert.deepEqual(calls.at(-1)[2], {
    p_context_id: context, p_view: 'channels', p_query: 'CE', p_status: 'active',
    p_from: '2026-10-01', p_to: '2026-10-21', p_limit: 5, p_offset: 2, p_id: row.id,
  }); },
});
for (const unit_code of [null, 'واحد ۲۱۲ / A', 'RO-212/Ș']) {
  const data = { ...payload, rows: [{ ...row, unit_code }] };
  await check(`canonical code ${JSON.stringify(unit_code)} retained without fallback`, { rpc: { data, error: null }, expected: data });
}
for (const query of ['view=channels', 'context_id=invalid&view=channels', `context_id=${context}&view=unknown`, `context_id=${context}&view=channels&limit=101`]) {
  await check(`invalid query rejected: ${query}`, { query, status: 400,
    expected: { error: { code: 'INVALID_COMMUNICATIONS_QUERY' } }, rpcCount: 0, clientCount: 0 });
}
for (const auth of [{ data: null, error: { message: 'synthetic auth failure' } }, { data: { claims: {} }, error: null }]) {
  await check('unauthenticated request cannot reach RPC', { auth, status: 401,
    expected: { error: { code: 'UNAUTHORIZED' } }, rpcCount: 0 });
}
// These labels describe mocked DB denials, not independent authorization proof.
for (const message of ['other_actor', 'context_revoked', 'context_expired', 'mfa_required', 'communications_permission_required', 'communications_entitlement_required']) {
  await check(`mocked DB denial propagates: ${message}`, {
    rpc: { data: null, error: { code: '42501', message } }, status: 403,
    expected: { error: { code: 'COMMUNICATIONS_ACCESS_DENIED' } },
  });
}
await check('undefined_column remains a 500 error, never catch/return []', {
  rpc: { data: null, error: { code: '42703', message: 'column u.unit_code does not exist' } },
  status: 500, expected: { error: { code: 'COMMUNICATIONS_QUERY_FAILED' } },
});
console.log(JSON.stringify({ result: 'PASS', handlerCases: passed,
  realHandler: true, dbBoundary: 'MOCKED_AUTH_AND_RPC', connectedProof: 'NOT_RUN',
  postgresTests: 'NOT_RUN', databaseLint: 'NOT_RUN', mutations: 0,
  note: 'Tenant/private/scope authorization is exercised by separate pgTAP, NOT by this mock.' }, null, 2));
