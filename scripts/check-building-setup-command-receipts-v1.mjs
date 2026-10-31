/** Source invariants, not a PostgreSQL parser/catalog oracle. Never connects. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSource,extractFunction,identity,root,MODULE,MANIFEST,OWNER_DECISION,MIGRATION,NAMING_RECEIPT} from './build-building-setup-command-receipts-source-v1.mjs';
const need=(condition,code)=>{if(!condition)throw Error(code)};
export function assertSourceInvariants(sql,manifest){
 need(!/alter\s+default\s+privileges/i.test(sql),'ND0_DEFAULT_MUTATION');
 need(!/grant\s+[^;]+\bto\s+(?:public|anon|authenticated|service_role|cladora_building_fixture_ops)\b/i.test(sql),'INACTIVE_POSITIVE_GRANT');
 need(!/\b(?:net|http|storage)\s*\.|pg_notify\s*\(|dblink\s*\(/i.test(sql),'EXTERNAL_EFFECT');
 need(!/set\s+constraints\s+all|auth\.(?:users|sessions)\s+[^;]*for\s+(?:update|share|key\s+share)|(?:insert\s+into|update|delete\s+from|alter)\s+auth\./i.test(sql),'MANAGED_AUTH_MUTATION_OR_LOCK');
 need(/raise exception 'building_g2_inactive_source_only' using errcode='55000';/.test(sql)&&/compiled_expected jsonb:=null; role_reference jsonb:=null; custody_reference jsonb:=null; quiescence_reference jsonb:=null;/.test(sql),'INACTIVE_UNCONDITIONAL_GATE');
 need(!/\bcommit\s*;/i.test(sql)&&/rollback;\s*$/.test(sql),'SINGLE_ROLLBACK_FRAME');
 const defs=[...sql.matchAll(/^create (?:or replace )?function ([a-z_]+\.[a-z_0-9]+)\(/gm)].map(m=>m[1]);
 need(new Set(defs).size===defs.length,'DUPLICATE_FUNCTION_DEFINITION');
 need(!defs.some(n=>/fixture|claim_pilot|prepare_building|revoke_building/.test(n)),'OUT_OF_SCOPE_DOMAIN_ROOT');
 const command=extractFunction(sql,'app_private.command_building_setup_v2').text;
 const create=extractFunction(sql,'app_private.create_building_setup_v2').text;
 const lookup=extractFunction(sql,'app_private.get_building_setup_command_receipt_v1').text;
 const binding=extractFunction(sql,'app_private.bind_provisioned_building_workspace_v1').text;
 const cp=extractFunction(sql,'app_private.require_building_setup_command_checkpoint_v1').text;
 const timed=extractFunction(sql,'app_private.require_building_setup_authority_at_v1').text;
 need(/checked_at:=clock_timestamp\(\)/.test(cp)&&/volatile security definer/.test(cp)&&!cp.includes('statement_timestamp()'),'TRUSTED_FRESH_CLOCK');
 need(cp.includes('require_request_session_current_at_v1(checked_at)')&&cp.includes('require_building_setup_authority_at_v1(p_context_id,p_workspace_id,permission,p_action,checked_at)'),'SAME_SNAPSHOT_SESSION_AUTHORITY');
 need(!timed.includes('statement_timestamp()')&&timed.includes('resolve_workspace_native_context_v2_at_v1')&&timed.includes('workspace_member_role_authority_active_v1_at_v1'),'TIMED_NATIVE_BINDING');
 need(command.indexOf('select * into e from platform.building_setup_command_receipts')<command.indexOf('if r.revision<>p_expected_revision'),'REPLAY_BEFORE_STALE');
 need(command.includes("'actor',c.actor_id,'tenant',c.tenant_id,'workspace',c.workspace_id,'run',r.id,")&&command.includes("'expected_revision',p_expected_revision,'units',p_units,'expected_payload_hash',p_expected_payload_hash)::text,'sha256'"),'CANONICAL_REQUEST_HASH');
 need(command.includes("e.input_descriptor is distinct from jsonb_build_object('units',p_units,'expected_payload_hash',p_expected_payload_hash)")&&command.includes('e.context_id<>p_context_id or e.membership_id<>c.membership_id'),'EXACT_REPLAY_INTENT_SCOPE');
 need(command.indexOf('insert into platform.building_setup_command_receipts')<command.indexOf('update platform.building_setup_runs set revision'),'EVIDENCE_BEFORE_STATUS_TRIGGER');
 for(const [code,body,action] of [['COMMAND',command,'p_action'],['CREATE',create,"'create'"]]){
  need(new RegExp(`assert_building_setup_g2_followon_v1\\(\\);\\s*perform app_private.assert_building_setup_command_checkpoint_v1\\(p_context_id,p_workspace_id,${action},initial\\);\\s*return v_receipt;`).test(body),'FINAL_'+code+'_ADMISSION');
  need(body.includes('app_private.require_building_setup_command_checkpoint_v1'),'ENTRY_'+code+'_ADMISSION');
 }
 need(create.includes('existing:=found;')&&create.includes('if existing then')&&create.indexOf('insert into platform.building_setup_command_coverage')>create.indexOf('end if;'),'CREATE_COVERAGE_NOT_ADOPTION');
 need(lookup.includes('for share;')&&lookup.includes("actor_id=(initial->>'actor_id')::uuid")&&lookup.includes("context_id=p_context_id and membership_id=(initial->>'membership_id')::uuid"),'LOOKUP_OWN_SCOPE');
 need(!/setup_record_v2\(|r\.setup_payload|jsonb_agg\(/.test(lookup),'MINIMAL_RECEIPT_DISCLOSURE');
 need(lookup.includes("elsif covered and r.revision=p_expected_revision and p_operation<>'approve'")&&lookup.includes("'outcome','unknown'")&&lookup.includes("'legacy_uncovered'"),'ABSENCE_COVERAGE_NOT_FOREIGN_EXISTENCE');
 need(/assert_building_setup_command_checkpoint_v1\(p_context_id,p_workspace_id,'recover',initial\);\s*if p_operation='approve' then perform app_private.assert_building_setup_command_checkpoint_v1\(p_context_id,p_workspace_id,'approve',initial\); end if;\s*return result;/.test(lookup),'FINAL_LOOKUP_ADMISSION');
 need(binding.includes('setup_g2_provision_frame_required')&&binding.includes('proof.writer_session_id'),'TRUSTED_TRIGGER_FRAME');
 for(const next of ['insert into platform.workspace_property_bindings','insert into identity.context_grants','insert into audit.events']){
  need(new RegExp("assert_building_setup_command_checkpoint_v1\\(proof.context_id,proof.workspace_id,'provision',initial\\);\\s*"+next).test(binding),'BINDING_FOLLOWON_CHECKPOINT');
 }
 need(/assert_building_setup_command_checkpoint_v1\(proof.context_id,proof.workspace_id,'provision',initial\);\s*return new;/.test(binding),'FINAL_BINDING_ADMISSION');
 for(const table of ['platform.building_setup_command_receipt_epochs','platform.building_setup_command_coverage','platform.building_setup_command_receipts']){
  need(sql.includes(`alter table ${table} enable row level security;`)&&sql.includes(`revoke all privileges on table ${table} from public,anon,authenticated,service_role;`),'EVIDENCE_ACL_RLS');
 }
 const added=manifest.objects.new_or_replaced_functions;
 need(Array.isArray(added)&&added.every(sig=>sql.includes(`revoke all privileges on function ${sig} from public,anon,authenticated,service_role;`)),'NEW_FUNCTION_OC1_CLOSURE');
 need(sql.includes("not convalidated")&&sql.includes('tgdeferrable or tginitdeferred')&&sql.includes('setup_g2_unknown_trigger_followon'),'UNKNOWN_FOLLOWON_STOP');
 need(manifest.guarantee.decision===OWNER_DECISION&&manifest.guarantee.tentative_effects_wal_sequence_gaps===true&&manifest.guarantee.last_checkpoint_to_commit_logout_window===true,'OWNER_GUARANTEE_BINDING');
 need(manifest.proofs.compiled_expected===null&&manifest.proofs.role_reference===null&&manifest.proofs.custody_reference===null&&manifest.proofs.quiescence_reference===null&&manifest.proofs.candidate_is_oracle===false,'INDEPENDENT_EXPECTED_NULL');
 need(manifest.naming.filename===MIGRATION.split('/').at(-1)&&manifest.naming.status==='OFFICIAL_CLI_RECEIPT_VERIFIED'
  &&manifest.naming.guessed_timestamp===false&&JSON.stringify(manifest.naming.receipt)===JSON.stringify(NAMING_RECEIPT),'OFFICIAL_NAMING_RECEIPT');
 return{functions:defs.length,source_invariants:'PASS',sql_parse_compile_execution:'NOT_RUN_NOT_PASS'};
}
export function checkDelivery(sql,manifest,{provenance=true}={}){
 const invariant=assertSourceInvariants(sql,manifest);
 need(JSON.stringify(identity(sql))===JSON.stringify(Object.fromEntries(Object.entries(manifest.output).filter(([k])=>k!=='path'))),'OUTPUT_IDENTITY');
 for(const effect of manifest.composition.selected_effects){const bytes=Buffer.from(sql).subarray(effect.output_byte_start,effect.output_byte_start+effect.output_byte_length);need(identity(bytes).sha256===effect.output_sha256,'EFFECT_BYTE_IDENTITY');}
 if(provenance){const rebuilt=buildSource();need(rebuilt.sql===sql,'MISSING_EXTRA_OR_CHANGED_EFFECT');need(JSON.stringify(rebuilt.manifest)===JSON.stringify(manifest),'MANIFEST_REFERENCE_DRIFT');}
 return invariant;
}
export function checkPackaging(sql,manifest,migration){
 need(manifest.status==='SOURCE_LOCAL_DELIVERED'&&manifest.review_status==='INDEPENDENT_SOURCE_REVIEW_REQUIRED'
  &&manifest.installed===false&&manifest.activated===false,'PACKAGING_STATUS_ONLY');
 need(manifest.naming?.filename===MIGRATION.split('/').at(-1)&&manifest.naming.status==='OFFICIAL_CLI_RECEIPT_VERIFIED'
  &&JSON.stringify(manifest.naming.receipt)===JSON.stringify(NAMING_RECEIPT)&&manifest.naming.guessed_timestamp===false,'OFFICIAL_NAMING_RECEIPT');
 need(manifest.migration?.path===MIGRATION&&manifest.migration.equivalent_to===MODULE,'OFFICIAL_MIGRATION_TARGET');
 need(migration===sql,'MIGRATION_MODULE_BYTE_IDENTITY');
 const actual=identity(sql);
 need(['bytes','sha256','git_blob'].every(k=>manifest.migration[k]===actual[k])&&manifest.naming.forward_sql_sha256===actual.sha256,'MIGRATION_FORWARD_IDENTITY');
 need(manifest.proofs.compiled_expected===null&&manifest.proofs.role_reference===null&&manifest.proofs.custody_reference===null&&manifest.proofs.quiescence_reference===null,'INDEPENDENT_EXPECTED_NULL');
 need(sql.includes("raise exception 'building_g2_inactive_source_only' using errcode='55000';")&&!/\bcommit\s*;/i.test(sql)&&/rollback;\s*$/.test(sql),'INACTIVE_PACKAGING_GATES');
 return {packaging:'PASS',path:MIGRATION,...actual,cli_reexecuted:false,sql_parse_compile_execution:'NOT_RUN_NOT_PASS'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sql=readFileSync(resolve(root,MODULE),'utf8'),manifest=JSON.parse(readFileSync(resolve(root,MANIFEST),'utf8'));
 console.log(JSON.stringify({...checkDelivery(sql,manifest),...checkPackaging(sql,manifest,readFileSync(resolve(root,MIGRATION),'utf8'))}));
}
