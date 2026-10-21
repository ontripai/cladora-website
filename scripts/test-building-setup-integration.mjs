import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// Offline seam regressions only; never substitute this for actual PostgreSQL.
const dir = 'supabase/migrations';
const names = readdirSync(dir);
const authority = names.filter(x => x.endsWith('_building_setup_authority_v2.sql'));
const process = names.filter(x => x.endsWith('_building_setup_attempt_version_v2.sql'));
assert.equal(authority.length, 1);
assert.equal(process.length, 1);
function audit(a, p, sql, fixture, proof) {
  assert.ok(a < p, 'Core migration must be installed before its process dependency');
  assert.match(sql, /case when p_action='approve' then 'onboarding\.import\.approve' else 'onboarding\.import\.manage' end,p_action/);
  assert.doesNotMatch(sql, /case when p_action in \('approve','provision'\) then/);
  assert.match(sql, /if p_expected_payload_hash is null then raise exception 'setup_precondition_required'/);
  assert.match(sql, /r\.approved_submitted_revision is distinct from r\.submitted_revision/);
  assert.match(sql, /select \* into r from platform\.building_setup_runs[^;]+for update/);
  assert.match(sql, /if r\.last_command_key=p_command_key[\s\S]*return r\.last_command_receipt;[\s\S]*r\.revision<>p_expected_revision/);
  assert.match(fixture, /set local role authenticated;/);
  assert.match(fixture, /select customer_api\.assign_workspace_role_v2\(/);
  assert.match(fixture, /primary_admin_user_id=pg_temp\.bs_id\(1\),primary_admin_membership_id=pg_temp\.bs_id\(90\),\s*primary_admin_accepted_at=/);
  assert.ok(fixture.indexOf('insert into identity.memberships') < fixture.indexOf('update platform.customer_workspaces set'));
  for (const scope of ['tenant', 'property']) assert.ok(fixture.includes(`'${scope}'::identity.scope_type`), 'UNION fixture literals must retain the native enum type');
  assert.doesNotMatch(fixture, /insert\s+into\s+(?:platform\.workspace_member_roles|platform\.workspace_member_role_authority_sources|identity\.role_permissions)/i);
  assert.doesNotMatch(fixture, /create (?:or replace )?function (?:app_private|customer_api)\./i);
  assert.match(proof, /^\\ir fixtures\/building_setup_authority_v2\.inc$/m);
  assert.doesNotMatch(proof, /Core-reviewed leased synthetic fixture required/);
}
const sql = readFileSync(`${dir}/${process[0]}`, 'utf8');
const fixture = readFileSync('supabase/tests/fixtures/building_setup_authority_v2.inc', 'utf8');
const proof = readFileSync('supabase/tests/223_building_setup_command_proof_v2.test.sql', 'utf8');
const authorityTest = readFileSync('supabase/tests/220_building_setup_authority_v2_test.sql', 'utf8');
assert.match(authorityTest, /select plan\(135\);/);
assert.match(authorityTest, /ends_at=clock_timestamp\(\)\+interval '200 milliseconds'/);
assert.match(authorityTest, /select pg_sleep\(0\.25\);/);
assert.doesNotMatch(authorityTest, /disable\s+trigger|session_replication_role/i);
assert.doesNotMatch(authorityTest, /update identity\.memberships set ends_at=statement_timestamp\(\)/);
audit(authority[0], process[0], sql, fixture, proof);
let controls = 0;
for (const args of [
  [process[0], authority[0], sql, fixture, proof],
  [authority[0], process[0], sql.replaceAll("case when p_action='approve' then", "case when p_action in ('approve','provision') then"), fixture, proof],
  [authority[0], process[0], sql.replaceAll('if p_expected_payload_hash is null', 'if false'), fixture, proof],
  [authority[0], process[0], sql.replaceAll('r.revision<>p_expected_revision', 'false'), fixture, proof],
  [authority[0], process[0], sql, `${fixture}\ninsert into platform.workspace_member_roles values(null);`, proof],
  [authority[0], process[0], sql, fixture.replace('primary_admin_membership_id=pg_temp.bs_id(90)', 'primary_admin_membership_id=null'), proof],
  [authority[0], process[0], sql, fixture.replaceAll('::identity.scope_type', ''), proof],
  [authority[0], process[0], sql, fixture, proof.replace('\\ir fixtures/building_setup_authority_v2.inc', '')],
]) { assert.throws(() => audit(...args)); controls++; }
for (const path of ['081_controlled_building_setup_opening_rehearsal.test.sql', '082_building_setup_security_invoker_gateway.test.sql']) {
  const source = readFileSync(`supabase/tests/${path}`, 'utf8');
  assert.match(source, /^\\ir fixtures\/building_setup_authority_v2\.inc$/m);
  assert.match(source, /setup_dual_control_violation/);
  assert.match(source, /no journal/);
}
const runner = readFileSync('scripts/test-building-workspace-onboarding-postgres.mjs', 'utf8');
assert.match(runner, /new URL\('\/postgres',url\)/);
assert.match(runner, /finally\{await source\.end\(\);\}/);
assert.match(runner, /source fixture has no active sessions/);
assert.match(runner, /target\.search/);
assert.doesNotMatch(runner, /pg_terminate_backend|with\s*\(force\)/i);
console.log(JSON.stringify({ suite: 'building-setup-integration-source', result: 'PASS', negative_controls: controls, runtime: 'NOT_RUN_NOT_PASS' }));
