import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20260922184500_retention_operations_read_model_dry_run.sql', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/app/api/platform/v1/retention-operations/dry-run/route.ts', import.meta.url), 'utf8');
const contract = readFileSync(new URL('../src/lib/platform/retention-operations.ts', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/components/platform/OperationalRetentionPanel.tsx', import.meta.url), 'utf8');

const preview = migration.match(/create or replace function platform\.preview_retention_workers_v1[\s\S]*?\n\$\$;\n/)?.[0];
assert.ok(preview, 'worker preview RPC exists');

for (const forbidden of [
  /insert\s+into/i,
  /update\s+[a-z_]/i,
  /delete\s+from/i,
  /claim_purge_execution_v1/i,
  /claim_kms_dispatch_v1/i,
  /storage\.objects/i,
  /record_kms_provider_callback_v1/i,
]) {
  assert.equal(forbidden.test(preview), false, `dry-run RPC excludes ${forbidden}`);
}

for (const invariant of [
  "'database_mutated', false",
  "'storage_delete_api_called', false",
  "'kms_provider_called', false",
  "'claims_acquired', false",
]) {
  assert.ok(preview.includes(invariant), `dry-run emits ${invariant}`);
}

assert.match(migration, /digest\(j\.object_path, 'sha256'\)/, 'storage path is represented only by a fingerprint');
assert.match(migration, /provider_reference_recorded/, 'KMS projection exposes presence instead of provider reference');
assert.doesNotMatch(
  api,
  /create(?:Admin|ServiceRole)Client|service[_-]?role|\.remove\s*\(|\.delete\s*\(/i,
  'HTTP dry-run route has no privileged or deletion client',
);
assert.match(api, /assertSafeDryRun\(data\)/, 'HTTP route fail-closes on unsafe dry-run response');
assert.match(contract, /DRY_RUN_SAFETY_INVARIANT_FAILED/, 'client contract rejects violated invariants');
assert.match(panel, /No DB writes|بدون نوشتن DB/, 'UI states the no-side-effect contract');
assert.doesNotMatch(panel, /object_path(?!_fingerprint)/, 'UI never expects a raw storage path');

console.log('Retention operations dry-run contract passed: no mutation, deletion, claim, or KMS dispatch path.');
