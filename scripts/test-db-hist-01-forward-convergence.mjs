import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const ledgerPath = join(root, 'docs', 'database', 'DB-HIST-01-FORWARD-CONVERGENCE-EXCEPTION-LEDGER.json');
const rolloutPath = join(root, 'docs', 'database', 'DB-HIST-01-FORWARD-CONVERGENCE-ROLLOUT.md');
const candidateName = '20260913132945_romanian_statutory_operational_export_pack_forward_reconciliation_v1.sql';
const candidateSha256 = 'fdff99135db6cba70ff480552aff1e8e24516d79c31b50ee9394293c977d0602';
const hash = (value) => createHash('sha256').update(value).digest('hex');

const migrations = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
// The DB-HIST-01 baseline remains immutable when Artifact A appends eight migrations.
const baseline = migrations.filter((name) => name.slice(0, 14) <= '20261007112219');
assert.equal(baseline.length, 238, 'forward baseline must contain 238 migrations');
const baselineManifest = baseline.map((name) => `${name} ${hash(readFileSync(join(migrationsDir, name)))}\n`).join('');
assert.equal(hash(baselineManifest), 'b66e6fd930fb358e5f5e0fcf21c51020f503a56a250471046c633cba4a709185', 'all 238 baseline migration names and bytes stay immutable');
assert.equal(migrations.length, 246, 'forward package plus Artifact A must contain exactly 246 migrations');
assert.equal(migrations.filter((name) => name === candidateName).length, 1, 'forward migration must occur once');

const versions = migrations.map((name) => name.slice(0, 14));
assert.equal(new Set(versions).size, versions.length, 'migration versions must be unique');

const candidate = readFileSync(join(migrationsDir, candidateName));
assert.equal(hash(candidate), candidateSha256, 'forward migration byte hash');
const candidateSql = candidate.toString('utf8');
assert.doesNotMatch(candidateSql, /\b(?:pm_control|pm_private)\b/i, 'private PM schemas stay outside the product migration');
assert.doesNotMatch(candidateSql, /\b(?:insert\s+into|update|delete\s+from|truncate)\s+supabase_migrations\./i, 'migration history must stay immutable');
assert.doesNotMatch(candidateSql, /\bdrop\s+(?:table|function|procedure|policy|index|trigger)\b/i, 'forward convergence must not remove catalog objects');

const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
assert.equal(ledger.schema_version, 'db_hist_01_public_exception_ledger.v1');
assert.equal(ledger.task_id, 'DB-HIST-01-R8-R1');
assert.equal(ledger.scope, 'public_product_application_migrations');
assert.equal(ledger.status, 'blocked_historical_hash_exceptions');
assert.equal(ledger.candidate.version, '20260913132945');
assert.equal(ledger.candidate.sha256, candidateSha256);
assert.equal(ledger.candidate.strategy, 'forward_only_no_history_repair_or_replay');
assert.equal(ledger.rollout_note, 'docs/database/DB-HIST-01-FORWARD-CONVERGENCE-ROLLOUT.md');
assert.equal(ledger.historical_hash_exception_count, 11);
assert.equal(ledger.entries.length, 11);
assert.equal(ledger.exclusions.private_pm_control_plane_entries.included, false);
assert.equal(ledger.exclusions.remote_statements, false);
assert.equal(ledger.exclusions.object_definitions, false);
assert.equal(ledger.exclusions.private_r4_r7_evidence, false);
assert.equal(ledger.exclusions.live_catalog_residuals, false);

const entryVersions = new Set();
const hexSha256 = /^[0-9a-f]{64}$/;
for (const entry of ledger.entries) {
  assert.match(entry.version, /^\d{14}$/);
  assert.equal(entryVersions.has(entry.version), false, `duplicate exception version ${entry.version}`);
  entryVersions.add(entry.version);
  assert.match(entry.name, /^[a-z0-9_]+$/);
  assert.equal(entry.classification, 'historical_content_exception_forward_converged');
  assert.equal(entry.reason_no_repair, 'immutable_applied_history_forward_only_reconciliation_preserves_audit_ledger');
  for (const key of ['local_sha256', 'remote_sha256', 'desired_state_sha256']) assert.match(entry[key], hexSha256, `${entry.version} ${key}`);
  assert.notEqual(entry.local_sha256, entry.remote_sha256, `${entry.version} must remain an explicit historical mismatch`);
  const file = `${entry.version}_${entry.name}.sql`;
  assert.equal(migrations.includes(file), true, `${file} must remain in the product ledger`);
  assert.equal(hash(readFileSync(join(migrationsDir, file))), entry.local_sha256, `${file} local history hash`);
}

const publicLedgerText = readFileSync(ledgerPath, 'utf8');
assert.doesNotMatch(publicLedgerText, /\b(?:create|alter|drop|grant|revoke)\s+(?:table|function|procedure|policy|index|trigger|schema)\b/i, 'public ledger must not contain object definitions');
assert.doesNotMatch(publicLedgerText, /;/, 'public ledger must not contain SQL statements');

const rolloutNote = readFileSync(rolloutPath, 'utf8');
assert.match(rolloutNote, /20260913132945/);
assert.match(rolloutNote, new RegExp(candidateSha256));
assert.match(rolloutNote, /independent Remote authorization/i);
assert.match(rolloutNote, /not migration repair or replay/i);
assert.doesNotMatch(rolloutNote, /\b(?:create|alter|drop|grant|revoke)\s+(?:table|function|procedure|policy|index|trigger|schema)\b/i, 'rollout note must not contain object definitions');

console.log(`DB-HIST-01 forward convergence public contract passed: ${migrations.length} migrations, ${ledger.entries.length} immutable exceptions, candidate ${candidateSha256}.`);
