/** New reference-planner/actual-handler coupling only. No DB/SQL/Auth execution. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nativeRequire = createRequire(import.meta.url);
const calls = [];
let fault = null;
let authenticated = true;
const client = {
  auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: 'synthetic-actor' } : null }, error: null }) },
  schema: (name) => {
    assert.equal(name, 'customer_api');
    return { rpc: async (rpc, args) => {
      calls.push({ rpc, args });
      return { data: fault ? null : { cycle_id: args.p_cycle_id, source_type: args.p_source_type, source_id: args.p_source_id, source_hash: 'synthetic-controlled-hash' }, error: fault };
    } };
  },
};
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const mod = { exports: {} }; cache.set(path, mod);
  const text = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const require = (id) => {
    if (id === '@/lib/supabase/server') return { createClient: async () => client };
    if (!id.startsWith('@/') && !id.startsWith('.')) return nativeRequire(id);
    let p = id.startsWith('@/') ? resolve(root, 'src', id.slice(2)) : resolve(dirname(path), id);
    if (!p.endsWith('.ts')) p += '.ts';
    return load(p);
  };
  new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
  return mod.exports;
}
const { planMonthlySourceCaptureV1: plan } = load(resolve(root, 'src/lib/core/monthly-source-handoff-v1.ts'));
const { POST } = load(resolve(root, 'src/app/api/customer/v1/accounting/monthly-cycles/[id]/[action]/route.ts'));
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (relation) => ({ contract_version: 'monthly-source-reference-handoff.v1', context_id: id(1), cycle_id: id(2), source_relation: relation, source_id: id(3) });
async function dispatch(p) {
  return POST(new Request(`http://localhost${p.request.path}`, {
    method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(p.request.body),
  }), { params: Promise.resolve({ id: id(2), action: 'capture-source' }) });
}
let count = 0;
async function check(name, fn) { await fn(); console.log(`PASS ${++count}: ${name}`); }
for (const [relation, type] of [['utilities.provider_invoices', 'provider_invoice'], ['utilities.meter_readings', 'meter_reading'], ['finance.allocation_runs', 'allocation_run']]) {
  await check(`${relation}: real existing handler, exact capture wire; source remains unverified`, async () => {
    const p = plan(ref(relation));
    assert.equal(p.status, 'request_prepared_source_unverified');
    assert.equal(p.action_authorization, 'not_evaluated');
    const r = await dispatch(p); assert.equal(r.status, 200);
    assert.deepEqual(calls.at(-1), { rpc: 'capture_monthly_cycle_source_v1', args: { p_context_id: id(1), p_cycle_id: id(2), p_source_type: type, p_source_id: id(3) } });
    assert.equal((await r.json()).source_hash, 'synthetic-controlled-hash');
  });
}
await check('maintenance payable cannot become a utilities invoice/capture request', () => {
  const before = calls.length, p = plan(ref('maintenance.vendor_payables'));
  assert.equal(p.status, 'not_ready'); assert.equal(p.request, null);
  assert.equal(p.dependency, 'FINANCE_MAINTENANCE_MONTHLY_SOURCE_BRIDGE_REQUIRED');
  assert.equal(calls.length, before);
});
await check('unknown, work-order-only and consumption source families have no invented capture ABI', () => {
  for (const relation of ['maintenance.work_orders', 'utilities.consumption_periods', 'provider_invoice', 'service.offerings']) assert.throws(() => plan(ref(relation)));
});
await check('caller approvals, amounts, receipt, scope overrides and versions cannot be smuggled', () => {
  for (const [key, value] of Object.entries({ approved: true, amount: '12.00', receipt: {}, workspace_id: id(8), tenant_id: id(9), source_version: 1, source_hash: 'fake', status: 'posted' })) assert.throws(() => plan({ ...ref('utilities.provider_invoices'), [key]: value }));
});
await check('missing/invalid identities and ABI versions fail before any dispatch', () => {
  for (const key of Object.keys(ref('utilities.meter_readings'))) {
    const r = ref('utilities.meter_readings'); delete r[key]; assert.throws(() => plan(r));
  }
  for (const key of ['context_id', 'cycle_id', 'source_id']) assert.throws(() => plan({ ...ref('utilities.meter_readings'), [key]: '../foreign' }));
  assert.throws(() => plan({ ...ref('utilities.meter_readings'), contract_version: 'v0' }));
});
await check('canonical DB denial/not-found/conflict are not source verification or retry success', async () => {
  for (const [code, status] of [['42501', 403], ['P0002', 404], ['40001', 409], ['55000', 422]]) {
    fault = { code, message: 'controlled failure' };
    const before = calls.length, r = await dispatch(plan(ref('utilities.meter_readings')));
    assert.equal(r.status, status); assert.equal(calls.length, before + 1); assert.ok((await r.json()).error);
  }
  fault = null;
});
await check('unverified references confer no authenticated route access', async () => {
  authenticated = false; const before = calls.length;
  assert.equal((await dispatch(plan(ref('utilities.provider_invoices')))).status, 401);
  assert.equal(calls.length, before); authenticated = true;
});
await check('reference planning does not mutate inputs or duplicate requests on its own', () => {
  const input = Object.freeze(ref('utilities.provider_invoices'));
  const before = calls.length;
  assert.deepEqual(plan(input), plan(input)); assert.equal(calls.length, before);
});
await check('declared canonical source files match independently pinned bytes', () => {
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/core/domain-ports-01/finance-monthly-input-27/manifest.json'), 'utf8'));
  for (const pin of manifest.source_pins) {
    const bytes = readFileSync(resolve(root, pin.path));
    assert.equal(bytes.length, pin.bytes, pin.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, pin.path);
  }
});
console.log(JSON.stringify({ result: 'PASS', new_groups: count, proof: 'controlled actual-handler and reference planning only', native: 'NOT_RUN', sql_dispatch: 0 }));
