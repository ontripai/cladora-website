import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
const file=readdirSync('supabase/migrations').find(f=>f.endsWith('_building_setup_attempt_version_v2.sql'));
const sql=readFileSync(`supabase/migrations/${file}`,'utf8');
function audit(source){
 for(const text of ['require_building_setup_authority_v2(uuid,uuid,text,text)','building_setup_core_dependency_required','creation_request_hash','creation_receipt','submitted_revision','submitted_payload_hash','approved_revision','approved_submitted_revision','approved_payload_hash','last_command_actor','last_command_hash','last_command_receipt','pg_advisory_xact_lock','for update','setup_creation_binding_immutable','case_attempt_binding_immutable','setup_legacy_review_required','setup_revision_conflict','setup_snapshot_conflict','setup_dual_control_violation','setup_precondition_required'])assert.ok(source.includes(text),text);
 assert.match(source,/r\.last_command_key=p_command_key[\s\S]*return r\.last_command_receipt;[\s\S]*r\.revision<>p_expected_revision/);
 assert.match(source,/r\.created_by<>c\.actor_id or r\.customer_workspace_id<>c\.workspace_id or r\.creation_request_hash<>v_hash/);
 assert.match(source,/submitted_revision=case when p_action='submit' then r\.revision\+1/);
 assert.match(source,/approved_revision is distinct from r\.revision/);
 assert.match(source,/created_by=c\.actor_id and idempotency_key=p_idempotency_key/);
 assert.match(source,/customer_api\.create_case_workspace_v1\(p_case_id/,'case domain operation reused');
 assert.match(source,/revoke execute on function customer_api\.create_case_workspace_v1/);
 for(const name of ['create','get','rehearse','submit','approve','provision']){
  assert.match(source,new RegExp(`create function customer_api\\.${name}_building_setup_v2[\\s\\S]*?security invoker set search_path=pg_catalog`));
  assert.match(source,new RegExp(`revoke execute on function customer_api\\.${name}_building_setup_v1`));
 }
 assert.doesNotMatch(source,/create (?:table|policy)|update identity\.|insert into identity\.|create or replace function app_private\.(?:require_setup_context|resolve_workspace_native_context_v2|check_workspace_native_permission_v2)/i);
 assert.doesNotMatch(source,/insert into finance\.journals|update billing\.invoices|update .*set .*creation_request_hash/i);
 assert.match(source,/^begin;/m);assert.match(source,/^commit;/m);
}
audit(sql);
let controls=0;
for(const [from,to] of [['pg_advisory_xact_lock','pg_advisory_lock'],['r.revision<>p_expected_revision','false'],['r.creation_request_hash<>v_hash','false'],['r.approved_revision is distinct from r.revision','false'],['created_by=c.actor_id and idempotency_key=p_idempotency_key','idempotency_key=p_idempotency_key'],['setup_creation_binding_immutable','removed_binding_guard'],['security invoker set search_path=pg_catalog','security definer set search_path=pg_catalog']]){assert.throws(()=>audit(sql.replaceAll(from,to)));controls++;}
console.log(`PASS v2 backend source contract + ${controls} negative controls; SOURCE_ONLY, SQL runtime/concurrency NOT_RUN_NOT_PASS.`);
