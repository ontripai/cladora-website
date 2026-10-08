import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE MINIMUM CONSUMER CONTRACT TESTS ===\n');

const path = 'docs/contracts/CLADORA-CORE-MINIMUM-CONSUMER-CONTRACTS-SERVICE-CE-v1.0.md';
assert.ok(fs.existsSync(path), `${path} exists`);
const contract = fs.readFileSync(path, 'utf8');

for (const shared of [
  'workspace-native-authority.v2',
  'resolve_workspace_native_context_v2',
  'check_workspace_native_permission_v2',
  'platform.idempotency_keys',
  'audit.events',
  'platform.outbox_events',
]) {
  assert.ok(contract.includes(shared), `shared infrastructure ${shared} is reused`);
}

for (const moduleCode of ['services_catalog', 'services_orders', 'community_events']) {
  assert.ok(contract.includes(`\`${moduleCode}\``), `module ${moduleCode} is fixed`);
}

for (const permission of [
  'services.catalog.read',
  'services.catalog.manage',
  'services.catalog.publish',
  'services.orders.read',
  'services.orders.request',
  'services.quotes.manage',
  'services.quotes.publish',
]) {
  assert.ok(contract.includes(`\`${permission}\``), `existing permission ${permission} is fixed`);
}

for (const consumerContract of [
  'canonical-resource-reference.v1',
  'provider-agreement-verification.v1',
  'geographic-coverage-resolution.v1',
]) {
  assert.ok(contract.includes(consumerContract), `${consumerContract} is versioned`);
}

assert.match(contract, /CE-011 consumes the existing[\s\S]*C01\/C02\/C03/, 'CE consumes the existing C01/C02/C03 contract');
assert.match(contract, /Event activation has no dependency on Community, SERVICE, Booking, Finance, AIRPROP/, 'CE activation is independent');
assert.match(contract, /Workspace-wide offering work remains unblocked/, 'missing resource resolver does not block all SERVICE work');
assert.match(contract, /Definition drafting that creates no provider claim may continue/, 'missing agreement verifier is narrowly scoped');
assert.match(contract, /Workspace coverage remains unblocked/, 'missing geography resolver is narrowly scoped');
assert.match(contract, /withheld result contains no resource\/source identifier, display value or count/, 'resource withholding blocks references and counts');
assert.match(contract, /all contract\/source references null/, 'contract withholding blocks references');
assert.match(contract, /Withheld results expose no location identifier, source, version or count/, 'geography withholding blocks references and counts');
assert.match(contract, /explicit deny wins/, 'deny precedence is fixed');
assert.match(contract, /replay authorization[\s\S]*never bypasses a fresh authority check|Replay rechecks current authority/, 'replay rechecks current authority');
assert.match(contract, /No new table or parallel evaluator is authorized/, 'parallel infrastructure is forbidden');
assert.doesNotMatch(contract, /unlimited free|unlimited-free|رویداد نامحدود/i, 'forbidden unlimited-event wording is absent');

console.log('  ✔ Existing SERVICE and CE identifiers are pinned.');
console.log('  ✔ Shared authority, idempotency, audit and outbox infrastructure is reused.');
console.log('  ✔ SERVICE blockers are narrow; CE base activation remains independent.');
console.log('  ✔ Withheld disclosure and deny-first replay rules are explicit.');
