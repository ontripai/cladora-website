import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const migrationName = '20261015100000_core_platform_role_bound_pool_v1.sql';
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const implementation = readFileSync('src/lib/core/platform-role-bound-pool-v1.ts', 'utf8');
const consumer = readFileSync('src/lib/community/experience-guide-lifecycle-http-v1.ts', 'utf8');
const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();

// Preserve the historical 296-file inventory and account only for the four
// byte-exact additions accepted by B01/SERVICE297. This is not installed ACL proof.
const reviewedAdditions = {
 '20261022071629_service_quote_request_version_binding_v2.sql':'472f74027b5ccd250432cb1ff16879461f74633808a386498883cfc28dd3d324',
 '20261022071709_ce_notice_ack_read_shape_v1.sql':'76beec0cd96f9dc1c72cd884c073a4c1a58f828a9ead65ab05378f032d2d96e5',
 '20261022082451_core_notice_ack_receipt_replay_v1.sql':'368a8cbfefaa5292eed640789fd811411d2996eee1220cd532cc9efa8026c679',
 '20261025214155_building_setup_command_receipts_v1.sql':'254e17c9e5f21ce4e50786d3325c2cc84759097b16cb53028602d1e8db5e02e3',
};
for (const [name, hash] of Object.entries(reviewedAdditions)) {
 assert.ok(migrations.includes(name), `missing reviewed addition ${name}`);
 assert.equal(createHash('sha256').update(readFileSync(`supabase/migrations/${name}`)).digest('hex'), hash, name);
}
assert.equal(migrations.filter(name => !Object.hasOwn(reviewedAdditions, name)).length, 296);
assert.ok(migrations.includes(migrationName));
assert.match(migration, /create role cladora_ce_guide_runtime\s+login noinherit nosuperuser nobypassrls nocreatedb nocreaterole\s+noreplication password null/i);
assert.match(migration, /create role cladora_ce_guide_executor\s+nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole\s+noreplication password null/i);
assert.match(migration, /grant cladora_ce_guide_executor to cladora_ce_guide_runtime\s+with admin false, inherit false, set true/i);
assert.doesNotMatch(migration, /password\s+'[^']+'/i);
assert.doesNotMatch(migration, /grant\s+.*\b(delete|truncate|create)\b.*cladora_ce_guide_executor/i);
assert.doesNotMatch(migration, /grant\s+(all|execute on all functions)/i);
assert.match(migration, /acquire_core_platform_role_safety_mutation_lock_v1/);
assert.match(migration, /finalize_ce_guide_role_membership_v1/);
assert.match(migration, /core_platform_superuser_finalizer_required/);
assert.match(migration, /pg_advisory_xact_lock_shared/);
assert.match(migration, /pg_database/);
assert.match(migration, /pg_namespace/);
assert.match(migration, /pg_class/);
assert.match(migration, /pg_proc/);
assert.match(migration, /pg_auth_members/);
assert.match(migration, /rolcanlogin/);
assert.match(migration, /inherit_option/);
assert.match(migration, /set_option/);
assert.match(migration, /core_platform_ce_guides_read_v1/);
assert.match(migration, /core_platform_ce_idempotency_insert_v1/);
assert.match(migration, /core_platform_ce_audit_insert_v1/);
assert.match(migration, /core_platform_ce_outbox_insert_v1/);
assert.match(migration, /create view app_private\.confirmed_auth_user_ids_v1\s+with \(security_barrier=true,security_invoker=false\)/i);
assert.match(migration, /grant usage on schema auth to cladora_ce_guide_executor/i);
assert.match(migration, /grant execute on function auth\.uid\(\),auth\.jwt\(\) to cladora_ce_guide_executor/i);
assert.doesNotMatch(migration, /grant select(?:\([^)]*\))? on auth\.users/i);

assert.match(implementation, /core-platform-role-bound-pool\.v1/);
assert.match(implementation, /'direct' \| 'session_pooler'/);
assert.doesNotMatch(implementation, /transaction_pool/);
assert.match(implementation, /set role \$\{profile\.executor_role\}/);
assert.match(implementation, /const ceGuideProfileV1 = Object\.freeze/);
assert.doesNotMatch(implementation, /process\.env|request\.headers|request\.body|service_role|cladora_rpc_owner/);
assert.match(implementation, /assertRuntimeIdentity/);
assert.match(implementation, /assertExecutorIdentity/);
assert.match(implementation, /acquire_ce_guide_role_safety_lease_v1/);
assert.match(implementation, /client\.release\(true\)/);
assert.match(implementation, /reset all/);
assert.match(implementation, /reset role/);

assert.match(consumer, /corePlatformRoleBoundPoolContractV1/);
assert.match(consumer, /request\.cladora\.workspace_id/);
assert.match(consumer, /request\.cladora\.context_id/);
assert.doesNotMatch(consumer, /set role cladora_ce_guide_executor/i);

const governed = [
  'cladora_ce_guide_runtime',
  'cladora_ce_guide_executor',
  'app_private.check_workspace_native_permission_v2',
  'documents.customer_document_scope_matches',
  'communications.member_covers_unit',
  'communications.context_covers_unit',
];
function mutatesGovernedCatalog(sql) {
  return sql.split(';').some(statement => {
    const normalized = statement
      .replace(/^\s*(?:(?:--[^\n]*(?:\n|$))|(?:\/\*[\s\S]*?\*\/\s*))*/, '')
      .trim();
    if (/^(?:grant|revoke)\b/i.test(normalized)) {
      return governed.some(token => normalized.includes(token));
    }
    const target = normalized.match(
      /^(?:create\s+(?:or\s+replace\s+)?|alter\s+|drop\s+)(?:function|procedure|role)\s+(?:if\s+(?:not\s+)?exists\s+)?([a-z0-9_.]+)/i,
    )?.[1];
    return target !== undefined && governed.includes(target);
  });
}
for (const name of migrations.filter(candidate => candidate >= migrationName)) {
  const sql = readFileSync(`supabase/migrations/${name}`, 'utf8');
  if (name === '20261025214155_building_setup_command_receipts_v1.sql') {
    // Its exact seal was checked above. It rejects before any catalog mutation,
    // and has an independent fresh-install role graph, not this baseline's.
    assert.match(sql, /raise exception 'building_g2_inactive_source_only' using errcode='55000'/);
    console.log('G2 inactive source: independent role/catalog proof NOT_RUN_NOT_PASS');
    continue;
  }
  if (!mutatesGovernedCatalog(sql)) continue;
  assert.match(sql, /acquire_core_platform_role_safety_mutation_lock_v1/,
    `${name} mutates protected catalog state without the canonical exclusive lock`);
}

console.log(JSON.stringify({
  contract: 'core-platform-role-bound-pool.v1',
  migration_count: migrations.length,
  migration_sha256: createHash('sha256').update(migration).digest('hex'),
  implementation_sha256: createHash('sha256').update(implementation).digest('hex'),
  connection_models: ['direct', 'session_pooler'],
  transaction_pooling: 'rejected',
}));
