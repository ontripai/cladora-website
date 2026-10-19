import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const migrationName = '20261018163000_service_subject_link_role_bound_pool_privileged_v1.sql';
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const s4Migration = readFileSync(
  'supabase/migrations/20261018170000_communications_service_role_acl_shutdown_v1.sql',
  'utf8',
);
const stagedLocalReplay = readFileSync(
  'scripts/start-local-supabase-staged-service-s4.sh', 'utf8',
);
const databaseWorkflow = readFileSync('.github/workflows/database-tests.yml', 'utf8');
const ceWorkflow = readFileSync('.github/workflows/ce-community.yml', 'utf8');
const core = readFileSync('src/lib/core/platform-role-bound-pool-v1.ts', 'utf8');
const handler = readFileSync('src/lib/customer/service-request-subject-link-http-v1.ts', 'utf8');
const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();

assert.equal(migrations.length, 278);
assert.equal(migrations.at(-2), migrationName);
assert.equal(migrations.at(-1), '20261018170000_communications_service_role_acl_shutdown_v1.sql');
assert.match(core, /createCorePlatformServiceSubjectLinkRoleBoundPoolV1/);
assert.match(core, /core-platform-service-subject-link-role-bound-pool\.v1/);
assert.match(core, /cladora_service_subject_link_runtime/);
assert.match(core, /cladora_service_subject_link_executor/);
assert.match(core, /assert_service_subject_link_role_safety_v1/);
assert.match(core, /acquire_service_subject_link_role_safety_lease_v1/);
assert.doesNotMatch(core, /process\.env|request\.headers|request\.body/);

assert.match(handler, /CorePlatformServiceSubjectLinkRoleBoundPoolV1/);
assert.match(handler, /role_bound_pool\?:/);
assert.match(handler, /corePlatformServiceSubjectLinkRoleBoundPoolContractV1/);
assert.doesNotMatch(handler, /readonly pool:|Pick<Pool|set role|reset role/i);
for (const setting of [
  'request.jwt.claims',
  'request.jwt.claim.sub',
  'request.jwt.claim.aal',
  'request.jwt.claim.role',
  'request.cladora.context_id',
  'request.cladora.workspace_id',
]) {
  assert.match(handler, new RegExp(`set_config\\('${setting.replaceAll('.', '\\.')}','?\\$[1-6]'?,true\\)`));
}
assert.ok(handler.indexOf("normalized.startsWith('begin')")
  < handler.indexOf('client.query(identitySettingsSql'),
  'all identity settings must be installed only after BEGIN succeeds');
assert.equal(existsSync('src/app/api/customer/v1/services/requests/[id]/subject-links/route.ts'), false);

assert.match(migration, /create role cladora_service_subject_link_runtime\s+login noinherit nosuperuser nobypassrls nocreatedb nocreaterole\s+noreplication password null/i);
assert.match(migration, /create role cladora_service_subject_link_executor\s+nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole\s+noreplication password null/i);
assert.match(migration, /create role cladora_service_subject_link_owner\s+nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole\s+noreplication password null/i);
assert.match(migration, /grant cladora_service_subject_link_owner to %I with admin false, inherit false, set true/i);
assert.match(migration, /set role cladora_service_subject_link_owner/i);
assert.match(migration, /reset role/i);
assert.match(migration, /grant cladora_service_subject_link_executor\s+to cladora_service_subject_link_runtime\s+with admin false, inherit false, set true/i);
assert.match(migration, /owner to cladora_service_subject_link_owner/g);
assert.match(migration, /provider_current_state_required|current-state|current state/i);
assert.match(migration, /finalize_service_subject_link_role_membership_v1/);
assert.match(migration, /create table app_private\.service_subject_link_step_su_02_receipt_v1/i);
assert.doesNotMatch(migration, /service_subject_link_step_su_02_receipt_v1\s+owner to supabase_admin/i);
assert.match(migration, /current_user<>'supabase_admin'/i);
assert.match(migration, /insert into app_private\.service_subject_link_step_su_02_receipt_v1/i);
assert.match(migration, /grant execute on function app_private\.finalize_service_subject_link_role_membership_v1\(\)\s+to supabase_admin/i);
assert.doesNotMatch(migration, /select\s+app_private\.finalize_service_subject_link_role_membership_v1\s*\(\s*\)/i);
assert.doesNotMatch(migration, /revoke[\s\S]{0,180}private_(?:conversations|participants|messages|message_documents)[\s\S]{0,180}service_role/i);
assert.doesNotMatch(migration, /password\s+'[^']+'/i);
assert.match(s4Migration, /service_subject_link_step_su_02_receipt_v1/i);
assert.match(s4Migration, /service_subject_link_step_su_02_receipt_missing_or_untrusted/i);
assert.match(s4Migration, /owner_role\.rolname='supabase_admin'/i);
assert.match(s4Migration, /privilege\.grantee<>relation\.relowner/i);
assert.match(s4Migration, /revoke all privileges on table\s+communications\.private_conversations,\s+communications\.private_participants,\s+communications\.private_messages,\s+communications\.private_message_documents\s+from service_role/i);
assert.doesNotMatch(s4Migration, /\b(?:grant|alter\s+owner|create\s+(?:role|policy)|drop\s+policy|cascade)\b/i);
assert.match(stagedLocalReplay, /CLADORA_LOCAL_STEP_SU_02_AUTHORIZED/);
assert.match(stagedLocalReplay, /service_subject_link_step_su_02_receipt_missing_or_untrusted/);
assert.match(stagedLocalReplay, /run_supabase_silently "Supabase local start" supabase start/);
assert.match(stagedLocalReplay, /"\$@" >"\$supabase_output" 2>&1/);
assert.doesNotMatch(stagedLocalReplay, /^\s*supabase start\s*$/m);
assert.match(stagedLocalReplay, /psql -U supabase_admin -d postgres/i);
assert.match(stagedLocalReplay, /docker exec -e PGPASSWORD=postgres/i);
assert.doesNotMatch(stagedLocalReplay, /PGOPTIONS=/i);
assert.match(stagedLocalReplay, /alter table app_private\.service_subject_link_step_su_02_receipt_v1 owner to supabase_admin; select app_private\.finalize_service_subject_link_role_membership_v1\(\)/i);
assert.doesNotMatch(stagedLocalReplay, /set session authorization/i);
assert.match(stagedLocalReplay, /supabase migration up --local/);
assert.doesNotMatch(stagedLocalReplay, /\bsupabase\s+(?:link|db\s+push|functions\s+deploy)\b/i);
for (const workflow of [databaseWorkflow, ceWorkflow]) {
  assert.match(workflow, /start-local-supabase-staged-service-s4\.sh start/);
  assert.match(workflow, /CLADORA_LOCAL_STEP_SU_02_AUTHORIZED:\s*["']1["']/);
}
assert.match(databaseWorkflow, /SERVICE_SUBJECT_LINK_LOCAL_STEP_SU_02_AND_S4:\s*["']1["']/);
assert.match(databaseWorkflow, /cladora-service-http-postgres/);
assert.match(databaseWorkflow,
  /SOURCE_PG_IMAGE=\$\(docker inspect --format '\{\{\.Config\.Image\}\}' supabase_db_cladora-local\)/);
assert.match(databaseWorkflow,
  /docker run[\s\S]+cladora-service-http-postgres[\s\S]+"\$SOURCE_PG_IMAGE"/);
assert.match(databaseWorkflow,
  /select default_version from pg_available_extensions where name='pgtap'/);
assert.doesNotMatch(databaseWorkflow, /postgres:17-alpine/);

console.log(JSON.stringify({
  contract: 'core-platform-service-subject-link-role-bound-pool.v1',
  migration_count: migrations.length,
  migration_sha256: createHash('sha256').update(migration).digest('hex'),
  core_sha256: createHash('sha256').update(core).digest('hex'),
  handler_sha256: createHash('sha256').update(handler).digest('hex'),
  step_su_02_executed: false,
  activation: false,
}));
