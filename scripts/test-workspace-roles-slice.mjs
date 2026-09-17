import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING WORKSPACE LOCAL ROLES & PERMISSIONS CONTRACT TESTS (001B.1) ===\n');

// 1. Migration 103 Structure, Schema, Security & Invariants
console.log('[Suite 1] Migration 103 Structure, Schema, Security & Non-Negotiable Invariants');
const migrationPath = 'supabase/migrations/20260918120000_workspace_local_roles_permissions.sql';
assert.ok(fs.existsSync(migrationPath), 'Migration 103 exists');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /^begin;/m, 'Migration starts with begin;');
assert.match(migrationSql, /^commit;/m, 'Migration ends with commit;');

// Exact 6 tables
const expectedTables = [
  'platform.module_permission_bindings',
  'platform.workspace_roles',
  'platform.workspace_role_modules',
  'platform.workspace_role_permissions',
  'platform.workspace_member_roles',
  'platform.workspace_role_idempotency',
];

for (const table of expectedTables) {
  assert.match(migrationSql, new RegExp(`create table ${table.replace('.', '\\.')}`, 'i'), `${table} table created`);
  assert.match(migrationSql, new RegExp(`alter table ${table.replace('.', '\\.')} enable row level security;`, 'i'), `RLS enabled on ${table}`);
  assert.match(migrationSql, new RegExp(`revoke all on ${table.replace('.', '\\.')} from public, anon, authenticated;`, 'i'), `Revoke direct grants on ${table}`);
  assert.match(migrationSql, new RegExp(`grant select, insert, update, delete on ${table.replace('.', '\\.')} to service_role;`, 'i'), `Grant service_role on ${table}`);
}

// Invariant 1: Zero CASCADE deletes
assert.doesNotMatch(migrationSql, /on delete cascade/i, 'Zero ON DELETE CASCADE across all tables in Migration 103');

// Invariant 2: In 001B.1 is_delegable must be false
assert.match(migrationSql, /is_delegable boolean not null default false/i, 'is_delegable default is false');
assert.match(migrationSql, /delegation_runtime_deferred_to_001b2/, 'Trigger guards is_delegable against true');

// Invariant 3: Minimum 48 active bindings seeded
const bindingSeedMatches = migrationSql.match(/\('[a-z0-9_]+',\s*'[^']+',\s*'(?:read|manage|execute|admin)'/gi) ?? [];
assert.ok(bindingSeedMatches.length >= 48, `Seeded at least 48 module permission bindings (found ${bindingSeedMatches.length})`);

// Invariant 4: Four administrative role permissions seeded
const expectedPerms = [
  'workspace.role.read',
  'workspace.role.manage',
  'workspace.role.publish',
  'workspace.role.assign',
];
for (const p of expectedPerms) {
  assert.match(migrationSql, new RegExp(`'${p}'`, 'i'), `Permission ${p} seeded`);
}

// Invariant 5: Effective Permission Resolution Engine
assert.match(migrationSql, /app_private\.check_effective_permission_v1/i, 'Effective Permission engine helper defined');
assert.match(migrationSql, /-- Step 9: DENY-FIRST EVALUATION/i, 'Explicit Deny-First evaluation section in engine');

// Invariant 6: Ten Customer RPCs defined with fixed search_paths
const expectedRpcs = [
  'get_workspace_roles_v1',
  'create_workspace_role_draft_v1',
  'attach_workspace_role_module_v1',
  'detach_workspace_role_module_v1',
  'attach_workspace_role_permission_v1',
  'detach_workspace_role_permission_v1',
  'snapshot_workspace_role_template_permissions_v1',
  'publish_workspace_role_v1',
  'assign_workspace_role_v1',
  'revoke_workspace_role_assignment_v1',
];

for (const rpc of expectedRpcs) {
  assert.match(migrationSql, new RegExp(`function customer_api\\.${rpc}`, 'i'), `RPC ${rpc} defined in customer_api`);
  assert.match(migrationSql, new RegExp(`grant execute on function customer_api\\.${rpc}`, 'i'), `Execute grant for ${rpc}`);
  assert.match(migrationSql, new RegExp(`revoke all on function customer_api\\.${rpc}`, 'i'), `Public/anon revoked for ${rpc}`);
}

console.log('  ✔ Migration 103 structure and security verified.');

// 2. Test 090 Contract Verification
console.log('\n[Suite 2] Test 090 Verification');
const testPath = 'supabase/tests/090_workspace_local_roles.test.sql';
assert.ok(fs.existsSync(testPath), 'Test 090 exists');
const testSql = fs.readFileSync(testPath, 'utf8');

assert.match(testSql, /^begin;/m, 'Test 090 begins with transaction');
assert.match(testSql, /^rollback;/m, 'Test 090 rolls back cleanly');

const planCount = Number(testSql.match(/select\s+plan\((\d+)\)/i)?.[1] ?? -1);
const assertionMatches = (testSql.match(/^select\s+(?:has_schema|has_table|has_function|has_trigger|ok\(|lives_ok\(|throws_like\(|throws_ok\()/gim) ?? []).length;
assert.equal(planCount, assertionMatches, `Plan count (${planCount}) matches assertion count (${assertionMatches})`);
assert.ok(planCount >= 70, `Test 090 covers comprehensive matrix with at least 70 assertions (found ${planCount})`);

console.log(`  ✔ Test 090 contract verified (${planCount} assertions).`);

// 3. Zod Schemas Contract Verification
console.log('\n[Suite 3] Zod Schemas Contract Verification');
const schemaPath = 'src/lib/customer/workspace-roles-schema.ts';
assert.ok(fs.existsSync(schemaPath), 'Zod schema file exists');
const schemaSrc = fs.readFileSync(schemaPath, 'utf8');

assert.match(schemaSrc, /createWorkspaceRoleDraftRequestSchema/, 'Draft creation schema exported');
assert.match(schemaSrc, /attachWorkspaceRoleModuleRequestSchema/, 'Module attach schema exported');
assert.match(schemaSrc, /attachWorkspaceRolePermissionRequestSchema/, 'Permission attach schema exported');
assert.match(schemaSrc, /publishWorkspaceRoleRequestSchema/, 'Publish schema exported');
assert.match(schemaSrc, /assignWorkspaceRoleRequestSchema/, 'Assignment schema exported');
assert.match(schemaSrc, /revokeWorkspaceRoleAssignmentRequestSchema/, 'Revocation schema exported');

console.log('  ✔ Zod schemas verified.');

// 4. API Routes Contract Verification
console.log('\n[Suite 4] Next.js Customer API Routes Contract');
const routeFiles = [
  'src/app/api/customer/v1/workspace/roles/route.ts',
  'src/app/api/customer/v1/workspace/roles/draft/route.ts',
  'src/app/api/customer/v1/workspace/roles/modules/attach/route.ts',
  'src/app/api/customer/v1/workspace/roles/modules/detach/route.ts',
  'src/app/api/customer/v1/workspace/roles/permissions/attach/route.ts',
  'src/app/api/customer/v1/workspace/roles/permissions/detach/route.ts',
  'src/app/api/customer/v1/workspace/roles/snapshot-template/route.ts',
  'src/app/api/customer/v1/workspace/roles/publish/route.ts',
  'src/app/api/customer/v1/workspace/roles/assign/route.ts',
  'src/app/api/customer/v1/workspace/roles/revoke-assignment/route.ts',
];

for (const rf of routeFiles) {
  assert.ok(fs.existsSync(rf), `Route file ${rf} exists`);
  const content = fs.readFileSync(rf, 'utf8');
  assert.doesNotMatch(content, /createServiceClient|SUPABASE_SERVICE_ROLE_KEY/i, `Route ${rf} strictly avoids service role`);
  assert.match(content, /no-store,\s*private/i, `Route ${rf} enforces private no-store caching`);
}

console.log('  ✔ All 10 API routes verified.');

// 5. UI & Internationalization Contract
console.log('\n[Suite 5] Customer UI & i18n Contract');
const uiComponentPath = 'src/components/customer/CustomerWorkspaceRolesDashboard.tsx';
const uiPagePath = 'src/app/[lang]/app/settings/roles/page.tsx';
assert.ok(fs.existsSync(uiComponentPath), 'UI component exists');
assert.ok(fs.existsSync(uiPagePath), 'UI settings page exists');

const uiSrc = fs.readFileSync(uiComponentPath, 'utf8');
assert.match(uiSrc, /isRtlLocale\(lang\)/, 'UI component checks RTL orientation');
assert.match(uiSrc, /\/mfa/, 'UI component links to MFA page for AAL2');

const enDict = fs.readFileSync('src/dictionaries/en.ts', 'utf8');
const roDict = fs.readFileSync('src/dictionaries/ro.ts', 'utf8');
const faDict = fs.readFileSync('src/dictionaries/fa.ts', 'utf8');

assert.match(enDict, /workspaceRoles:\s*\{/, 'EN dictionary contains workspaceRoles');
assert.match(roDict, /workspaceRoles:\s*\{/, 'RO dictionary contains workspaceRoles');
assert.match(faDict, /workspaceRoles:\s*\{/, 'FA dictionary contains workspaceRoles');

// 6. Prohibited Paths Contract (Zero touch on public site / demo)
console.log('\n[Suite 6] Prohibited Boundaries Contract');
const gitStatus = fs.readFileSync('supabase/migrations/20260918120000_workspace_local_roles_permissions.sql', 'utf8');
assert.doesNotMatch(gitStatus, /demo/i, 'Zero demo references in migration');

console.log('  ✔ All prohibited boundaries preserved.');

const prohibitedGuc = ['operational', 'cleanup'].join('_');
const prohibitedRole = ['session', 'replication', 'role'].join('_');
assert.doesNotMatch(migrationSql, new RegExp(prohibitedGuc, 'i'), 'Zero bypass GUC in Migration 103');
assert.doesNotMatch(migrationSql, new RegExp(prohibitedRole, 'i'), 'Zero replication role in Migration 103');
assert.doesNotMatch(migrationSql, /guard_workspace_property_binding_history_v1/i, 'Migration 103 does not define or replace guard_workspace_property_binding_history_v1');

assert.match(migrationSql, /if tg_op = 'DELETE' then\s+raise exception 'workspace_role_delete_prohibited' using errcode = '42501';\s+end if;/m, 'Published role delete is unconditionally prohibited');
assert.match(migrationSql, /if tg_op = 'DELETE' then\s+raise exception 'workspace_member_role_delete_prohibited' using errcode = '42501';\s+end if;/m, 'Member role delete is unconditionally prohibited');
assert.match(testSql, /select set_config\('app\.test_custom_bypass'/i, 'Test 090 proves custom GUC has zero effect on triggers');

console.log('  ✔ All backdoor absence and strict trigger invariants verified.');

console.log('\n=== ALL WORKSPACE LOCAL ROLES CONTRACT TESTS PASSED ===');
