import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Offline source guard only: no DB client, subprocess, network, Auth or Docker.
const options = process.argv.slice(2);
assert.ok(options.length <= 1 && options.every(x => ['--source-check', '--help'].includes(x)),
  'Only --source-check / --help; runtime requires a separately authorized disposable target');
if (options.includes('--help')) {
  console.log('node scripts/test-building-setup-authority-v2.mjs --source-check');
  console.log('Runtime after authorized capacity/lease/integration: reserved pgTAP test 220.');
  console.log('SQL-session JWT FIXTURE and mounted test consumer are not Auth/HTTP/process acceptance.');
} else {
  const migration = await readFile(new URL('../supabase/migrations/20261021111641_building_setup_authority_v2.sql', import.meta.url), 'utf8');
  const sql = await readFile(new URL('../supabase/tests/220_building_setup_authority_v2_test.sql', import.meta.url), 'utf8');
  const statements = migration.replace(/--[^\n]*/g, '');
  assert.match(statements, /^begin;/);
  assert.match(statements, /commit;\s*$/);
  assert.match(statements, /building_setup_module_definition_conflict/);
  assert.match(statements, /building_setup_module_binding_conflict/);
  assert.match(statements, /building_setup_taxonomy_compatibility_conflict/);
  assert.match(statements, /building_setup_private_boundary_conflict/);
  assert.match(statements, /building_setup_read_boundary_conflict/);
  assert.match(statements, /resolve_workspace_native_context_v2\(p_context_id,p_workspace_id\)/);
  assert.match(statements, /check_workspace_native_permission_v2\(/);
  assert.match(statements, /workspace_member_role_authority_active_v1\(/);
  assert.match(statements, /a\.authority_policy_version=2/);
  assert.match(statements, /a\.scope_type='workspace'/);
  assert.match(statements, /a\.valid_to<=reviewer_end/);
  assert.match(statements, /building_setup_native_assignment_required/);
  assert.match(statements, /from public,anon,authenticated,service_role/);
  assert.match(statements, /grant execute on function app_private\.can_read_building_setup_v2\(uuid,uuid\) to authenticated/);
  assert.equal((statements.match(/create function /g) ?? []).length, 2);
  assert.equal((statements.match(/security definer set search_path=pg_catalog/g) ?? []).length, 2);
  assert.doesNotMatch(statements, /create (?:or replace )?function (?:customer_api\.|app_private\.(?:resolve_|check_|claim_|assign_))/i);
  assert.doesNotMatch(statements, /(?:insert into|update|delete from) (?:identity\.|platform\.(?:workspace_modules|workspace_entitlements|workspace_member_roles|pilot_setup_reviewers))/i);
  assert.doesNotMatch(statements, /grant\s+(?:all|select)|to public|disable row level|row_security\s*=\s*off/i);
  assert.match(sql, /SQL-session JWT FIXTURE only/);
  assert.match(sql, /set local row_security=on/);
  assert.match(sql, /row_security_active\('platform.building_setup_runs'::regclass\)/);
  assert.match(sql, /current_user::text,'authenticated'/);
  assert.match(sql, /customer_api\.claim_pilot_setup_reviewer_v1\(/);
  assert.match(sql, /customer_api\.assign_workspace_role_v2\(/);
  assert.match(sql, /customer_api\.revoke_workspace_role_assignment_v2\(/);
  assert.match(sql, /authority_policy_version=2/);
  assert.match(sql, /source_kind='identity_role'/);
  assert.match(sql, /p\.proowner=\(select proowner/);
  assert.match(sql, /has_function_privilege/);
  assert.match(sql, /data\/audit\/receipts\/timestamps unchanged/);
  assert.match(sql, /select \* from finish\(\);\s*rollback;\s*$/);
  const testStatements = sql.replace(/--[^\n]*/g, '');
  assert.doesNotMatch(testStatements, /insert into platform\.workspace_member_role(?:s|_authority_sources)\b/i);
  assert.doesNotMatch(testStatements, /assign_workspace_role_v1\(|disable trigger|disable row level|row_security\s*=\s*off|select (?:skip|todo)\(/i);
  assert.doesNotMatch(testStatements, /create (?:or replace )?function (?:app_private|customer_api|platform|identity)\./i);
  const cases = ['receipt_expired', 'receipt_revoked', 'context_expired', 'context_future',
    'member_expired', 'member_future', 'member_revoked', 'basis_expired', 'basis_revoked',
    'basis_future', 'assignment_ended', 'grantor_member_expired', 'grantor_member_revoked',
    'grantor_context_expired', 'grantor_context_future', 'module_deactivated',
    'entitlement_missing', 'aal1', 'unauthenticated', 'permission_deny', 'role_archived',
    'receipt_cap_shortened', 'basis_cap_shortened', 'binding_deprecated', 'canonical_revoke'];
  for (const scenario of cases) {
    assert.ok(sql.includes('savepoint bs_' + scenario + ';'), scenario);
    assert.ok(sql.includes('rollback to bs_' + scenario + ';'), scenario + ' rollback');
    assert.ok(sql.includes('release savepoint bs_' + scenario + ';'), scenario + ' release');
  }
  console.log(JSON.stringify({
    task: 'CORE-BUILDING-SETUP-AUTHORITY-01', sourceGuards: 'PASS', denialScenarios: cases.length,
    provenance: 'offline source inspection only', runtime: 'NOT_RUN_NOT_PASS',
    signedAuthJwt: 'NOT_RUN_NOT_PASS', actualProcessRpcHttp: 'NOT_RUN_NOT_PASS',
  }));
}
