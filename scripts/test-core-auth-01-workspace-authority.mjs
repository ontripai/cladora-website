import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE AUTH-01 WORKSPACE AUTHORITY TESTS ===\n');

const schemaPath = 'src/lib/core/workspace-authority-decision-v2.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-AUTH-01-WORKSPACE-AUTHORITY-v2.0.md';
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');

assert.ok(schema.includes('workspace-native-effective-authority.v2'), 'authority decision has a versioned executable schema');
assert.ok(contract.includes('workspace-native-effective-authority.v2'), 'authority decision is documented');

for (const source of [
  'app_private.resolve_workspace_native_context_v2',
  'app_private.check_workspace_native_permission_v2',
  'app_private.check_effective_permission_v2',
]) {
  assert.ok(schema.includes(source) || contract.includes(`\`${source}\``), `${source} remains canonical`);
}

assert.match(schema, /workspace_scope_target_must_match_workspace/, 'Workspace scope cannot target another resource');
assert.match(schema, /evaluator:\s*z\.literal\('app_private\.check_workspace_native_permission_v2'\)/, 'the existing evaluator is pinned');
assert.match(schema, /source_disclosure:\s*z\.literal\('status_only'\)[\s\S]*source_reference:\s*z\.null\(\)/, 'internal authority sources are not disclosed');
assert.match(schema, /current_authority_recheck_required:\s*z\.literal\(true\)[\s\S]*reusable_as_command_authority:\s*z\.literal\(false\)/, 'decision evidence cannot be reused as command authority');
assert.match(schema, /evaluatorAllowed \? 'allowed' : 'denied'/, 'the adapter preserves the canonical evaluator boolean');
assert.match(contract, /boolean false is not expanded into a guessed internal denial reason/, 'denial reasons are not invented');
assert.match(contract, /creates no second membership, role, permission, grant, assignment, delegation, audit, outbox or idempotency source/, 'parallel security foundations are forbidden');
assert.match(contract, /Documentation & PM owns the central manifest/, 'manifest ownership is preserved');

console.log('  ✔ Existing Workspace-native resolution and boolean authority stay canonical.');
console.log('  ✔ Deny reasons and internal authority identifiers are not invented or exposed.');
console.log('  ✔ Point-in-time decisions require command-time authority re-evaluation.');
console.log('  ✔ Resource/domain prerequisites remain independently owned.');

await import('./test-core-com-01-communication-receipt.mjs');
