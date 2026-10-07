import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = mkdtempSync(join(root, '.airprop-contract-test-'));
let passed = 0;
const check = (name, test) => { test(); passed++; console.log(`ok ${passed} - ${name}`); };
try {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
    '--strict', '--skipLibCheck', '--esModuleInterop', '--target', 'ES2020',
    '--module', 'commonjs', '--moduleResolution', 'node', '--outDir', output,
    'src/lib/airprop/opportunity-contract-v2.ts', 'src/lib/airprop/opportunity-idempotency-v2.ts',
  ], { cwd: root, stdio: 'inherit' });
  const require = createRequire(import.meta.url);
  const { createAirpropOpportunityV2Schema: schema } = require(join(output, 'opportunity-contract-v2.js'));
  const { describeAirpropOpportunityIdempotencyV2: describe } = require(join(output, 'opportunity-idempotency-v2.js'));
  const workspace = 'a1111111-1111-4111-8111-111111111111';
  const secondWorkspace = 'b2222222-2222-4222-8222-222222222222';
  const tenant = 'c3333333-3333-4333-8333-333333333333';
  const context = 'd4444444-4444-4444-8444-444444444444';
  const property = 'e5555555-5555-4555-8555-555555555555';
  const scope = { tenant_id: tenant, workspace_id: workspace };
  const base = { version: 2, context_id: context, workspace_id: workspace,
    idempotency_key: 'opportunity-test-0001',
    payload: { name: 'Opportunity', country_code: 'RO', city: 'București', currency: 'RON', asking_price: '2500' } };
  const withPayload = (patch) => ({ ...base, payload: { ...base.payload, ...patch } });
  const hash = (request) => describe(request, scope).input_hash;

  check('workspace-native input has no fabricated physical anchor', () => {
    const parsed = schema.parse(base);
    assert.equal(parsed.payload.property_id, null);
    assert.equal(parsed.payload.asking_price, '2500.0000');
  });
  check('optional canonical property input is retained', () => assert.equal(schema.parse(withPayload({ property_id: property })).payload.property_id, property));
  check('maximum numeric(20,4) remains exact', () => assert.equal(schema.parse(withPayload({ asking_price: '9999999999999999.9999' })).payload.asking_price, '9999999999999999.9999'));
  check('smallest four-place positive price is retained', () => assert.equal(schema.parse(withPayload({ asking_price: '0.0001' })).payload.asking_price, '0.0001'));
  for (const value of ['0', '0.0000', '-1', '1.23456', '10000000000000000', '1e3', '01', '.1', '1.', '1,50', ' 1', 'NaN', 'Infinity', '', 2500, null]) {
    check(`invalid price ${JSON.stringify(value)} rejected`, () => assert.equal(schema.safeParse(withPayload({ asking_price: value })).success, false));
  }
  for (const field of ['tenant_id', 'actor_id', 'created_by', 'status', 'input_hash', 'approved', 'membership_id']) {
    check(`client-owned authority field ${field} rejected`, () => {
      assert.equal(schema.safeParse({ ...base, [field]: tenant }).success, false);
      assert.equal(schema.safeParse(withPayload({ [field]: tenant })).success, false);
    });
  }
  for (const patch of [{ version: 1 }, { version: '2' }, { workspace_id: undefined }, { workspace_id: property.slice(0, 8) }, { context_id: null }, { idempotency_key: 'short' }, { idempotency_key: 'key with spaces' }, { idempotency_key: 'a'.repeat(129) }]) {
    check(`invalid envelope ${JSON.stringify(patch)} rejected`, () => assert.equal(schema.safeParse({ ...base, ...patch }).success, false));
  }
  for (const patch of [{ country_code: 'US' }, { currency: 'USD' }, { name: '   ' }, { name: 'a'.repeat(161) }, { city: 'a'.repeat(121) }, { name: 'line\nbreak' }, { source_ref: '\u0000bad' }, { source_ref: '' }, { source_ref: 'a'.repeat(501) }, { property_id: '' }, { subject_type: 'unit', subject_id: property }]) {
    check(`invalid payload ${Object.keys(patch).join('/')} rejected`, () => assert.equal(schema.safeParse(withPayload(patch)).success, false));
  }
  check('RO EN FA names remain intact', () => {
    for (const name of ['Oportunitate', 'Workspace opportunity', 'فرصت ورک‌اسپیس']) assert.equal(schema.parse(withPayload({ name })).payload.name, name);
  });
  check('key-order changes preserve retry hash', () => assert.equal(hash(base), hash({ ...base, payload: Object.fromEntries(Object.entries(base.payload).reverse()) })));
  check('equivalent decimal strings preserve retry hash', () => assert.equal(hash(base), hash(withPayload({ asking_price: '2500.00' }))));
  check('omitted and explicit null subject/source preserve retry hash', () => assert.equal(hash(base), hash(withPayload({ property_id: null, source_ref: null }))));
  check('trim and Unicode NFC are canonical', () => assert.equal(hash(withPayload({ name: 'Café' })), hash(withPayload({ name: '  Cafe\u0301  ' }))));
  check('different current context does not change business payload hash', () => assert.equal(hash(base), hash({ ...base, context_id: property })));
  for (const patch of [{ name: 'Changed' }, { city: 'Cluj' }, { currency: 'EUR' }, { asking_price: '2500.0001' }, { property_id: property }, { source_ref: 'evidence-1' }]) {
    check(`changed ${Object.keys(patch)[0]} changes retry hash`, () => assert.notEqual(hash(base), hash(withPayload(patch))));
  }
  check('same key in two workspaces has distinct persistence scope and hash', () => {
    const first = describe(base, scope);
    const second = describe({ ...base, workspace_id: secondWorkspace }, { ...scope, workspace_id: secondWorkspace });
    assert.equal(first.idempotency_key, second.idempotency_key);
    assert.notEqual(first.workspace_id, second.workspace_id);
    assert.notEqual(first.input_hash, second.input_hash);
  });
  check('tenant is a separate component of the persistence key', () => assert.notEqual(describe(base, scope).tenant_id, describe(base, { ...scope, tenant_id: property }).tenant_id));
  check('server-resolved/request workspace mismatch is rejected', () => assert.throws(() => describe(base, { ...scope, workspace_id: secondWorkspace }), /airprop_workspace_target_mismatch/));
  check('invalid server scope cannot produce a key', () => assert.throws(() => describe(base, { ...scope, tenant_id: 'fake' })));
  check('UUID casing is canonical on both sides', () => assert.deepEqual(describe({ ...base, workspace_id: workspace.toUpperCase() }, { tenant_id: tenant.toUpperCase(), workspace_id: workspace }), describe(base, scope)));
  check('v2 namespace is explicit and does not reuse legacy v1 tenant/key identity', () => assert.equal(describe(base, scope).namespace, 'airprop.opportunity.create.v2'));
  check('schema output can be reparsed without changing its hash', () => assert.equal(hash(base), hash(schema.parse(base))));
  check('caller objects are not mutated', () => {
    const before = JSON.stringify(base); describe(base, scope); assert.equal(JSON.stringify(base), before);
  });
  console.log(`AIRPROP opportunity v2: ${passed} behavioral checks passed`);
} finally {
  rmSync(output, { recursive: true, force: true });
}
