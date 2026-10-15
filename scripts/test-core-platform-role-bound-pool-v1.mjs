import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const migrationName = '20261015100000_core_platform_role_bound_pool_v1.sql';
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const implementation = readFileSync('src/lib/core/platform-role-bound-pool-v1.ts', 'utf8');
const consumer = readFileSync('src/lib/community/experience-guide-lifecycle-http-v1.ts', 'utf8');
const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();

assert.equal(migrations.length, 260);
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
assert.match(implementation, /set role \$\{corePlatformCeGuideExecutorRoleV1\}/);
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
for (const name of migrations.filter(candidate => candidate >= migrationName)) {
  const sql = readFileSync(`supabase/migrations/${name}`, 'utf8');
  if (!governed.some(token => sql.includes(token))) continue;
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
