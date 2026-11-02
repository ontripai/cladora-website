import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { admit, sha256 } from './docs-ce012-live-connection-v1/admission.mjs';
import { hash, SCOPED_CATALOG_SQL } from './docs-ce012-live-connection-v1/closure.mjs';
import { preflight } from './docs-ce012-live-connection-v1/measure.mjs';
import { scopeFixture, observerFixture } from './docs-ce012-live-connection-v1/scope-test-fixture.mjs';

// Source/control tests only. Synthetic signatures/catalog objects do not confer
// execution authority or establish PostgreSQL semantics/real owner/role proof.
const root = fileURLToPath(new URL('../', import.meta.url));
let groups = 0;
async function check(name, body) { await body(); console.log(`ok ${++groups} - ${name}`); }
const signedInput = (f, payload = f.payload) => ({ ...f.input, envelope: f.signed(payload) });
await check('DOCS-LIVE-SCOPE-01 counterexample: absent unrelated version with unchanged scoped source/catalog is admitted', async () => {
  const f = scopeFixture();
  assert.ok(f.payload.installation.observed_migration_versions.includes('20261008135433'));
  const originalCatalogHash = f.payload.installation.catalog_sha256;
  for (const versions of [f.payload.installation.observed_migration_versions.filter(v => v !== '20261008135433'), [],
    [...f.payload.installation.observed_migration_versions, '20991231235959']]) {
    const p = structuredClone(f.payload); p.installation.observed_migration_versions = versions;
    const a = admit({ ...signedInput(f, p), root });
    assert.equal(a.review.installation.catalog_sha256, originalCatalogHash);
    const observer = observerFixture(p, f.catalog);
    await preflight(observer, p, f.closure);
    assert.equal(observer.calls, 6, 'no schema_migrations query/equality is used by preflight');
  }
});
await check('metadata absence never excuses missing required function/column/trigger/RLS/role/replay/observer object', async () => {
  const f = scopeFixture();
  assert.ok(f.closure.relations.find(r => r.name === 'platform.idempotency_keys').columns.includes('response_ref'));
  assert.ok(f.closure.relations.find(r => r.name === 'platform.jurisdiction_domain_artifact_receipt_evidence'));
  for (const key of Object.keys(f.catalog.present)) {
    const changed = structuredClone(f.catalog); changed.present[key] = false;
    const p = structuredClone(f.payload); p.installation.observed_migration_versions = [];
    const observer = observerFixture(p, changed);
    await assert.rejects(() => preflight(observer, p, f.closure), e => e.code === `REQUIRED_${key.toUpperCase()}_MISSING`);
  }
});
await check('related schema/RLS/policy/type/owner/effectiveACL/role-edge/replay dependency drift is rejected', async () => {
  const f = scopeFixture();
  for (const key of Object.keys(f.catalog.digests)) {
    const changed = structuredClone(f.catalog); changed.digests[key] = 'c'.repeat(64);
    await assert.rejects(() => preflight(observerFixture(f.payload, changed), f.payload, f.closure),
      e => e.code === 'SCOPED_CATALOG_CHANGED', key);
  }
});
await check('required source function cannot be replaced by a stub even with a newly signed matching catalog seal', () => {
  const f = scopeFixture(), p = structuredClone(f.payload);
  p.installation.catalog_evidence.function_bodies.find(x => x.signature.startsWith('app_private.check_workspace_native_permission_v2(')).body_sha256 = hash('select true');
  p.installation.catalog_sha256 = hash(p.installation.catalog_evidence);
  assert.throws(() => admit(signedInput(f, p)), e => e.code === 'FUNCTION_SOURCE_PREIMAGE_MISMATCH');
});
await check('required source lineage, compatibility and guard300 cannot be omitted or self-relaxed', () => {
  for (const mutate of [p => { p.installation.lineage = []; },
    p => { p.installation.compatibility.unresolved_impacts = ['unknown native owner relationship']; },
    p => { p.installation.compatibility.guard300 = 'relaxed'; },
    p => { p.installation.runtime_closure_sha256 = '0'.repeat(64); }]) {
    const f = scopeFixture(), p = structuredClone(f.payload); mutate(p);
    assert.throws(() => admit(signedInput(f, p)));
  }
});
await check('request/closure/source tamper, invalid signature and expired review remain fail-closed', () => {
  const f = scopeFixture();
  assert.throws(() => admit({ ...signedInput(f), closureBytes: Buffer.from('{}') }), e => e.code === 'RUNTIME_CLOSURE_BYTES_MISMATCH');
  assert.throws(() => admit({ ...signedInput(f), trustedKeySha256: '0'.repeat(64) }), e => e.code === 'COORDINATOR_TRUST_ANCHOR_MISSING');
  assert.throws(() => admit({ ...signedInput(f), envelope: { payload: f.payload, signature: Buffer.alloc(64).toString('base64') } }), e => e.code === 'REVIEW_SIGNATURE_INVALID');
  assert.throws(() => admit({ ...signedInput(f), now: f.input.now + 700000 }), e => e.code === 'REVIEW_EXPIRED_OR_OVERLONG');
});
await check('each repository function body/lineage reconstructs from pinned source; minimum roots do not require listing migration', () => {
  const f = scopeFixture();
  for (const entry of f.closure.functions.filter(x => x.source_kind === 'repository')) {
    const bytes = readFileSync(new URL(`../${entry.source_path}`, import.meta.url));
    assert.equal(sha256(bytes), entry.source_sha256);
    const name = entry.signature.split('(')[0].replace('.', '\\.');
    const pattern = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+${name}\\s*\\([\\s\\S]*?\\)\\s*returns[\\s\\S]*?\\bas\\s+(\\$[\\w]*\\$)([\\s\\S]*?)\\1`, 'ig');
    const definitions = [...bytes.toString().matchAll(pattern)];
    assert.ok(definitions.some(m => sha256(m[2]) === entry.body_sha256), entry.signature);
  }
  assert.equal(f.closure.source_inputs.some(p => p.path.includes('20261008135433')), false);
  assert.ok(f.closure.source_inputs.some(p => p.path.includes('20261025214155')), 'canonical guard300 lineage is retained, not replayed');
  assert.ok(f.closure.required_triggers.some(t => t.name === 'document_workspace_binding_immutable_v1'));
  assert.ok(f.closure.required_triggers.filter(t => t.name.startsWith('canonical_authority_revision_'))
    .every(t => JSON.stringify(t.enabled_modes) === '["A"]'));
});
await check('scoped projection includes actual effective privileges/types/owner/reachability and untouched write/lock/retry controls', () => {
  for (const part of ['has_table_privilege', 'has_column_privilege', 'has_function_privilege', 'has_schema_privilege',
    'has_sequence_privilege', 'pg_get_userbyid', 'pg_auth_members', 'pg_enum', 'pg_constraint', 'pg_depend']) assert.ok(SCOPED_CATALOG_SQL.includes(part));
  assert.equal(SCOPED_CATALOG_SQL.includes('supabase_migrations'), false);
  const live = readFileSync(new URL('./docs-ce012-live-connection-v1/live.mjs', import.meta.url), 'utf8');
  for (const part of ['coreTransactionReplayReceiptHashV1', 'createCorePlatformRoleBoundPoolV1',
    'createCorePostgresTransactionHostV1', 'verifySession', "error.code === '40001'", "scope.attempt === 1"]) assert.ok(live.includes(part));
  const measure = readFileSync(new URL('./docs-ce012-live-connection-v1/measure.mjs', import.meta.url), 'utf8');
  for (const part of ['pg_stat_xact_user_tables', 'pg_blocking_pids', "result.error?.code === '55P03'", 'row_security=off']) assert.ok(measure.includes(part));
});
console.log(JSON.stringify({ contract: 'documents-ce012-runtime-scope-test.v1', groups,
  result: 'PASS_OFFLINE_SCOPE_ONLY', postgres_sql_auth_roles_semantics: 'NOT_RUN_NOT_PASS', full_baseline_11_and_provider_9_plus_7: 'NOT_RERUN' }));
