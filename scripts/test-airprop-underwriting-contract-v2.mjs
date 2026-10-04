import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = mkdtempSync(join(root, '.airprop-underwriting-test-'));
let passed = 0;
const check = (name, test) => { test(); passed++; console.log(`ok ${passed} - ${name}`); };
try {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
    '--strict', '--skipLibCheck', '--esModuleInterop', '--target', 'ES2020',
    '--module', 'commonjs', '--moduleResolution', 'node', '--outDir', output,
    'src/lib/airprop/underwriting-contract-v2.ts', 'src/lib/airprop/underwriting-idempotency-v2.ts',
  ], { cwd: root, stdio: 'inherit' });
  const require = createRequire(import.meta.url);
  const { createAirpropUnderwritingV2Schema: schema, calculateAirpropUnderwritingV2: calculate } = require(join(output, 'underwriting-contract-v2.js'));
  const { describeAirpropUnderwritingIdempotencyV2: describe } = require(join(output, 'underwriting-idempotency-v2.js'));
  const workspace = 'a1111111-1111-4111-8111-111111111111';
  const second = 'b2222222-2222-4222-8222-222222222222';
  const tenant = 'c3333333-3333-4333-8333-333333333333';
  const actor = 'd4444444-4444-4444-8444-444444444444';
  const opportunity = 'e5555555-5555-4555-8555-555555555555';
  const scope = { tenant_id: tenant, workspace_id: workspace, actor_id: actor };
  const assumptions = { acquisition_cost: '200000', annual_rent: '12000', annual_opex: '2000', currency: 'EUR' };
  const base = { version: 2, context_id: tenant, workspace_id: workspace, opportunity_id: opportunity,
    idempotency_key: 'underwriting-test-0001', expected_version: 0, assumptions };
  const withAssumptions = patch => ({ ...base, assumptions: { ...assumptions, ...patch } });
  check('native envelope requires no physical anchor', () => assert.equal(schema.parse(base).assumptions.acquisition_cost, '200000.0000'));
  check('annual NOI and fractional yields match known values', () => assert.deepEqual(calculate(assumptions, 'EUR'), {
    annual_noi: '10000.0000', gross_yield: '0.06000000', net_yield: '0.05000000', currency: 'EUR',
  }));
  check('four-place subtraction remains exact above JS safe integers', () => assert.deepEqual(calculate({
    acquisition_cost: '9999999999999999.9999', annual_rent: '9999999999999999.9999', annual_opex: '9999999999999999.9998', currency: 'RON',
  }, 'RON'), { annual_noi: '0.0001', gross_yield: '1.00000000', net_yield: '0.00000000', currency: 'RON' }));
  const vectors = [
    ['3', '1', '0.33333333'], ['6', '1', '0.16666667'], ['200000000', '1', '0.00000001'],
    ['200000001', '1', '0.00000000'], ['200000000', '3', '0.00000002'],
    ['0.0001', '9999999999999999.9999', '99999999999999999999.00000000'],
    ['0.0001', '0.0001', '1.00000000'], ['1', '0', '0.00000000'],
  ];
  for (const [cost, rent, expected] of vectors) check(`exact ratio ${rent}/${cost}`, () => {
    const result = calculate({ acquisition_cost: cost, annual_rent: rent, annual_opex: '0', currency: 'EUR' }, 'EUR');
    assert.equal(result.gross_yield, expected); assert.equal(result.net_yield, expected);
  });
  check('rent entirely spent on opex yields zero NOI', () => assert.equal(calculate({ ...assumptions, annual_opex: '12000' }, 'EUR').net_yield, '0.00000000'));
  check('scaling all monetary inputs preserves ratios', () => {
    const result = calculate({ ...assumptions, acquisition_cost: '20', annual_rent: '1.2', annual_opex: '0.2' }, 'EUR');
    assert.equal(result.net_yield, '0.05000000'); assert.equal(result.gross_yield, '0.06000000');
  });
  for (const value of ['-1', '1.00001', '10000000000000000', '1e3', '01', '.1', '1.', '1,50', ' 1', 'NaN', 'Infinity', '', 12000, null]) {
    check(`invalid money ${JSON.stringify(value)} rejected in every field`, () => {
      for (const field of ['acquisition_cost', 'annual_rent', 'annual_opex']) assert.equal(schema.safeParse(withAssumptions({ [field]: value })).success, false);
    });
  }
  for (const patch of [{ acquisition_cost: '0' }, { annual_opex: '12000.0001' }, { currency: 'USD' }, { currency: 'eur' }, { annual_rent: undefined }]) {
    check(`invalid assumptions ${JSON.stringify(patch)}`, () => assert.equal(schema.safeParse(withAssumptions(patch)).success, false));
  }
  check('no implicit exchange rate or unknown currency', () => {
    assert.throws(() => calculate(assumptions, 'RON'), /currency_mismatch/);
    for (const value of ['USD', undefined, { currency: 'EUR' }]) assert.throws(() => calculate(assumptions, value));
  });
  for (const field of ['tenant_id', 'actor_id', 'created_by', 'status', 'input_hash', 'results', 'approved', 'property_id', 'country_pack']) {
    check(`client-owned field ${field} rejected`, () => {
      assert.equal(schema.safeParse({ ...base, [field]: actor }).success, false);
      assert.equal(schema.safeParse(withAssumptions({ [field]: actor })).success, false);
    });
  }
  for (const expected_version of [-1, 1.5, '1', 2147483647, null, undefined, Infinity, NaN]) check(`invalid version ${String(expected_version)}`, () => assert.equal(schema.safeParse({ ...base, expected_version }).success, false));
  check('largest accepted version leaves room for next SQL integer', () => assert.equal(schema.parse({ ...base, expected_version: 2147483646 }).expected_version, 2147483646));
  for (const patch of [{ version: 1 }, { workspace_id: null }, { context_id: 'fake' }, { opportunity_id: undefined }, { idempotency_key: 'short' }, { idempotency_key: 'bad/key0001' }, { idempotency_key: 'a'.repeat(129) }]) check('invalid envelope rejected', () => assert.equal(schema.safeParse({ ...base, ...patch }).success, false));
  const descriptor = describe(base, scope);
  check('canonical money and object order preserve both hashes', () => assert.deepEqual(describe({ ...base, assumptions: {
    currency: 'EUR', annual_opex: '2000.0000', annual_rent: '12000.00', acquisition_cost: '200000.0',
  } }, scope), descriptor));
  check('equivalent current context keeps business hashes', () => assert.deepEqual(describe({ ...base, context_id: second }, scope), descriptor));
  check('expected version changes request identity but preserves content identity', () => {
    const next = describe({ ...base, expected_version: 1 }, scope);
    assert.notEqual(next.request_hash, descriptor.request_hash); assert.equal(next.input_hash, descriptor.input_hash);
  });
  check('actor changes request identity without rewriting content', () => {
    const next = describe(base, { ...scope, actor_id: second });
    assert.notEqual(next.request_hash, descriptor.request_hash); assert.equal(next.input_hash, descriptor.input_hash);
  });
  for (const patch of [{ acquisition_cost: '200000.0001' }, { annual_rent: '12000.0001' }, { annual_opex: '2000.0001' }, { currency: 'RON' }]) check('changed assumptions change both hashes', () => {
    const changed = describe(withAssumptions(patch), scope);
    assert.notEqual(changed.input_hash, descriptor.input_hash); assert.notEqual(changed.request_hash, descriptor.request_hash);
  });
  check('opportunity IDs isolate persisted commands', () => {
    const changed = describe({ ...base, opportunity_id: second }, scope);
    assert.notEqual(changed.persistence_key, descriptor.persistence_key); assert.notEqual(changed.request_hash, descriptor.request_hash);
  });
  check('workspaces isolate keys and request hashes', () => {
    const changed = describe({ ...base, workspace_id: second }, { ...scope, workspace_id: second });
    assert.notEqual(changed.persistence_key, descriptor.persistence_key); assert.notEqual(changed.request_hash, descriptor.request_hash);
  });
  check('tenant is separately scoped in canonical retry store', () => assert.notEqual(describe(base, { ...scope, tenant_id: second }).tenant_id, descriptor.tenant_id));
  check('resolved/request workspace mismatch rejected', () => assert.throws(() => describe(base, { ...scope, workspace_id: second }), /target_mismatch/));
  check('untrusted resolved scope is structurally rejected', () => {
    assert.throws(() => describe(base, { ...scope, tenant_id: 'fake' }));
    assert.throws(() => describe(base, { ...scope, actor_id: undefined }));
    assert.throws(() => describe(base, { ...scope, permission: true }));
  });
  check('PostgreSQL pilot UUIDs and uppercase IDs accepted and normalized', () => {
    const pilot = '00000000-0000-0000-0000-000000000007';
    assert.equal(schema.parse({ ...base, context_id: pilot }).context_id, pilot);
    assert.deepEqual(describe({ ...base, workspace_id: workspace.toUpperCase(), opportunity_id: opportunity.toUpperCase() }, { ...scope, actor_id: actor.toUpperCase() }), descriptor);
  });
  check('reparsed output and unchanged inputs retain identity', () => {
    const before = JSON.stringify(base); assert.deepEqual(describe(schema.parse(base), scope), descriptor);
    calculate(assumptions, 'EUR'); assert.equal(JSON.stringify(base), before);
  });
  check('retry key does not collide with existing v1/v2 create namespace', () => assert.equal(descriptor.persistence_key, `airprop.underwriting.create.v2/${workspace}/${opportunity}/underwriting-test-0001`));
  console.log(`AIRPROP underwriting v2: ${passed} behavioral checks passed`);
} finally {
  rmSync(output, { recursive: true, force: true });
}
