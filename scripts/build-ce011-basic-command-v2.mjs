/** Source-only derivation of the existing CE011 C03 SQL body. No DB/parser. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
const sourcePath='supabase/proposals/ce_011_event_interest_operational_v1.sql';
const source=readFileSync(sourcePath,'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),'5894363db4fa0fee49737371546e9cd1cbeddb2dcc44723a81cca396004feafc');
function span(start,end){const a=source.indexOf(start),b=source.indexOf(end,a)+end.length;assert.ok(a>=0&&b>a);return source.slice(a,b);}
let audience=span('create function app_private.ce_event_audience_eligible_v1(','\n$$;')
 .replace('ce_event_audience_eligible_v1','ce011_audience_current_v2').replace('language sql stable','language sql volatile').replaceAll('statement_timestamp()','clock_timestamp()');
// A specific role must itself be live, not merely accompanied by some other
// live workspace role. Use the same canonical validity columns as the outer arm.
const roleArm="and wr.lifecycle_status='published' and exists(select 1 from community.event_audience_roles";
assert.equal(audience.split(roleArm).length-1,1);
audience=audience.replace(roleArm,"and wr.lifecycle_status='published' and wr.valid_from<=clock_timestamp() and(wr.valid_to is null or wr.valid_to>clock_timestamp()) and exists(select 1 from community.event_audience_roles");
let command=span('create function customer_api.command_ce_event_v1(','\nend$$;')
 .replace('command_ce_event_v1','command_ce_event_v2').replaceAll('app_private.ce_event_audience_eligible_v1','app_private.ce011_audience_current_v2')
 .replace('v_reason text;v_scope record;', 'v_reason text;v_scope record;v_initial record;v_current record;');
const permission="v_permission:=case when v_command in('create_event','publish_event')";
assert.ok(command.includes(permission));
// New root-key gate. It does not change the original canonical key/hash.
const strict=` if (p_request-array['type','command_id','idempotency_key','context_id','workspace_id','event_id','expected_version','reason']-
  case v_command when 'create_event' then array['occurrence_id','title','starts_at','ends_at','timezone','community_ref','audience']
   when 'register_interest' then array['expected_interest_version'] when 'withdraw_interest' then array['expected_interest_version']
   when 'record_attendance' then array['target_membership_id','observed_local','timezone']
   when 'correct_attendance' then array['attendance_id','expected_attendance_version','attended','observed_local','timezone'] else array[]::text[] end)<>'{}'::jsonb
 then raise exception 'ce_event_invalid_fields' using errcode='22023';end if;\n `;
command=command.replace(' '+permission,strict+permission);
const authorize="select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);";
const first=command.indexOf(authorize);assert.ok(first>=0);
command=command.slice(0,first)+command.slice(first).replace(authorize,authorize+'\n v_initial:=v_scope;\n __CE011_FRESH_GUARD__');
const fresh=`-- Canonical Core primitives; no local evaluator/role grant/allow callback.
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 if v_command='create_event' and exists(select 1 from community.event_audience_members am where am.event_id=v_event_id
  and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 select * into strict v_current from app_private.resolve_workspace_native_context_v2_at_v1(v_context,v_workspace,clock_timestamp());
 if auth.uid() is distinct from v_actor or v_current.tenant_id is distinct from v_initial.tenant_id
  or v_current.membership_id is distinct from v_initial.membership_id
  or v_scope.tenant_id is distinct from v_initial.tenant_id or v_scope.membership_id is distinct from v_initial.membership_id
  or v_scope.represented_party_id is distinct from v_initial.represented_party_id
  or app_private.check_workspace_native_permission_v2_at_v1(v_context,v_workspace,v_permission,'community_events',clock_timestamp()) is not true
 then raise exception 'ce_event_current_authority_denied' using errcode='42501';end if;`;
function injectBefore(needle){assert.ok(command.includes(needle),needle);command=command.replace(needle,'__CE011_FRESH_GUARD__\n '+needle);}
// The exact accepted canonical C03 key/hash and ledger/receipt/audit/outbox
// statements are reused, never wrapped by another idempotency/transaction host.
injectBefore('insert into platform.idempotency_keys(');
const second=command.indexOf(authorize,command.indexOf(authorize)+authorize.length);assert.ok(second>=0);
command=command.slice(0,second)+command.slice(second).replace(authorize,authorize+'\n __CE011_FRESH_GUARD__');
injectBefore("return v_receipt.response_json||jsonb_build_object('replayed',true);");
injectBefore('if v_interest.id is null then insert into community.event_interests');
command=command.replace('v_before:=to_jsonb(v_attendance);update community.event_attendance','v_member_id:=v_attendance.membership_id;\n v_before:=to_jsonb(v_attendance);update community.event_attendance');
injectBefore('v_before:=to_jsonb(v_attendance);update community.event_attendance');
injectBefore('return v_response;');
command=command.replaceAll('__CE011_FRESH_GUARD__',fresh);
// Target audience freshness is separately evaluated for all role/member expiry
// checks using the inherited policy, not a new policy or new authority source.
assert.ok(audience.includes('clock_timestamp()'));assert.ok(!audience.includes('statement_timestamp()'));
const output=`-- CE011 basic-event command v2: INACTIVE source, not a migration/installer.
-- Reuses existing tables, canonical C01/C03 key/hash/receipt/audit/outbox.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $review$ BEGIN RAISE EXCEPTION 'ce011_v2_source_only_no_admission' USING ERRCODE='55000'; END $review$;
${audience}

${command}

REVOKE ALL ON FUNCTION app_private.ce011_audience_current_v2(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION customer_api.command_ce_event_v2(jsonb) FROM PUBLIC,anon,authenticated,service_role;
-- Actual owners/RLS/ACL, recursive helper/session closure and Core request-local
-- profile are separate. No permission/module/entitlement/role seed or grant.
COMMIT;
`;
const arg=process.argv[2];if(process.argv.length!==3||!arg?.startsWith('--output='))throw Error('ONLY_LOCAL_OUTPUT_ALLOWED_NO_INSTALL');
const out=arg.slice(9);assert.ok(path.isAbsolute(out));if(existsSync(out)&&readFileSync(out,'utf8')!==output)throw Error('PRESERVE_EXISTING_OUTPUT_CONFLICT');writeFileSync(out,output);
console.log(JSON.stringify({status:'SOURCE_CANDIDATE_ONLY',bytes:Buffer.byteLength(output),sha256:createHash('sha256').update(output).digest('hex'),SQL:'NOT_RUN'}));
