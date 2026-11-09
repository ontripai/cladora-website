/** Fixed Core terminal reader. Original JSON is comparison data, never authority. */
import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {createCoreServiceReviseQueryCandidateV1,CORE_SERVICE_REVISE_QUERY_V1} from './service-revise-admission-candidate-v1';
import {coreTransactionReceiptV2Schema,type CoreTransactionScopeV1,type CoreTransactionCommandV2,type CoreTransactionReceiptV2} from './postgres-transaction-host-v1';
export const CORE_SERVICE_REVISE_TERMINAL_V1='core-service-revise-terminal.v1' as const;
export const CORE_SERVICE_REVISE_TERMINAL_RUNTIME=null;
export class CoreServiceReviseTerminalFailureV1 extends Error{constructor(readonly reason:'REPLAY_CONFLICT'|'AUTHORITY_DENIED'|'PROVIDER_UNAVAILABLE'){super('SERVICE_REVISE_TERMINAL_DENIED');}}
export const CORE_SERVICE_REVISE_TERMINAL_SQL_V1=Object.freeze({
 effect:`select id::text,offering_id::text,revision_version::text,
 revise_command_id_v1::text as mutation_id,revise_idempotency_key_v1 as idempotency_key,
 revise_input_fingerprint_v1 as input_fingerprint,revise_command_body_v1 as command_body,
 revise_effect_lock_version_v1::text as offering_lock_version
 from service_catalog.revisions where tenant_id=$1::uuid and workspace_id=$2::uuid and id=$3::uuid for share`,
 readback:CORE_SERVICE_REVISE_QUERY_V1.readback,
 final:`with checked as materialized (select app_private.service_offering_revise_assert_current_v1(
 $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::bigint,$6::uuid,$7::uuid,$8::bigint) as at)
 select pg_backend_pid() as backend_pid,txid_current()::text as database_transaction_id,
 auth.uid()::text as actor_id,current_setting('transaction_isolation') as isolation,
 auth.jwt()->>'active_context_id' as context_id,auth.jwt()->>'active_workspace_id' as workspace_id,
 auth.jwt()->>'active_tenant_id' as tenant_id,auth.jwt()->>'active_membership_id' as membership_id,
 (select revision::text from app_private.canonical_authority_revision_v1 where singleton) as authority_revision,
 coalesce((select actor_id=$4::uuid and request_hash=$10 and response_ref=$11::jsonb and expires_at>checked.at
 from platform.idempotency_keys where tenant_id=$3::uuid and key=$9),false) as receipt_matched_unexpired,
 to_char(checked.at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as evaluated_at from checked`,
});
const uuid=z.string().uuid(),v=z.coerce.number().int().positive().safe();
const reference=z.object({new_revision_id:uuid,offering_id:uuid,command_id:uuid,context_id:uuid,workspace_id:uuid,actor_id:uuid,authority_version:v,provider_party_id:uuid,provider_agreement:z.strictObject({agreement_id:uuid,agreement_version:v})});
const effect=z.strictObject({id:uuid,offering_id:uuid,revision_version:v,mutation_id:uuid,idempotency_key:z.string(),input_fingerprint:z.string(),command_body:z.unknown(),offering_lock_version:v});
const observed=z.strictObject({backend_pid:z.number().int().positive(),database_transaction_id:z.string().regex(/^[1-9][0-9]*$/),actor_id:uuid,isolation:z.literal('serializable'),context_id:uuid,workspace_id:uuid,tenant_id:uuid,membership_id:uuid,authority_revision:v,receipt_matched_unexpired:z.boolean(),evaluated_at:z.iso.datetime({offset:true}).refine(t=>t.endsWith('Z'))});
function canonical(x:unknown):string{if(Array.isArray(x))return`[${x.map(canonical).join(',')}]`;if(x!==null&&typeof x==='object')return`{${Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')}}`;return JSON.stringify(x);}
/** Executed by the SAME host after closing provider scope. No caller verifier. */
export async function readCoreServiceReviseTerminalEffectV1(scope:CoreTransactionScopeV1,command:CoreTransactionCommandV2,original:unknown,receiptValue:CoreTransactionReceiptV2){
 const guard=createCoreServiceReviseQueryCandidateV1({scope,core_command:command,original_command:original,provider_code:'service_offering_revise',phase:'replay'}),c=reference.parse(original),receipt=coreTransactionReceiptV2Schema.parse(receiptValue);
 if(receipt.transaction_id!==command.transaction_id||receipt.command_id!==command.command_id||receipt.actor_id!==scope.actor_id||receipt.workspace_id!==scope.workspace_id||receipt.idempotency_key!==command.idempotency_key||receipt.input_fingerprint!==command.input_fingerprint||receipt.provider_evidence.provider_code!=='service_offering_revise'||receipt.mutation_id!==c.command_id)throw new CoreServiceReviseTerminalFailureV1('REPLAY_CONFLICT');
 const locked=await scope.query(CORE_SERVICE_REVISE_TERMINAL_SQL_V1.effect,[scope.tenant_id,scope.workspace_id,c.new_revision_id]);
 if(locked.rowCount!==1||locked.rows.length!==1)throw new CoreServiceReviseTerminalFailureV1('REPLAY_CONFLICT');const row=effect.parse(locked.rows[0]);
 if(row.id!==c.new_revision_id||row.offering_id!==c.offering_id||row.mutation_id!==receipt.mutation_id||row.idempotency_key!==command.idempotency_key||row.input_fingerprint!==command.input_fingerprint||canonical(row.command_body)!==canonical(original))throw new CoreServiceReviseTerminalFailureV1('REPLAY_CONFLICT');
 const request=JSON.stringify({contract_version:'service-offering-revise-writer-request.v1',tenant_id:scope.tenant_id,command:original,input_fingerprint:command.input_fingerprint});guard.assertQuery(CORE_SERVICE_REVISE_TERMINAL_SQL_V1.readback,[request]);
 const read=await scope.query(CORE_SERVICE_REVISE_TERMINAL_SQL_V1.readback,[request]),result=guard.assertResult(read);
 if(!result||result.mutation_id!==receipt.mutation_id||result.revision_id!==row.id||result.revision_version!==row.revision_version||result.offering_lock_version!==row.offering_lock_version)throw new CoreServiceReviseTerminalFailureV1('REPLAY_CONFLICT');
 return Object.freeze({args:Object.freeze([command.context_id,scope.workspace_id,scope.tenant_id,scope.actor_id,command.authority_version,c.provider_party_id,c.provider_agreement.agreement_id,c.provider_agreement.agreement_version,`core-tx.v1:${scope.workspace_id}:${command.idempotency_key}`,createHash('sha256').update(JSON.stringify(command)).digest('hex'),JSON.stringify(receipt)]),effect_sha256:createHash('sha256').update(canonical(row)).digest('hex')});
}
export function assertCoreServiceReviseFinalObservationV1(value:{rowCount:number|null;rows:unknown[]},scope:CoreTransactionScopeV1,command:CoreTransactionCommandV2,backendPid:number){
 if(value.rowCount!==1||value.rows.length!==1)throw new CoreServiceReviseTerminalFailureV1('PROVIDER_UNAVAILABLE');const row=observed.parse(value.rows[0]);
 if(row.backend_pid!==backendPid||row.database_transaction_id!==scope.database_transaction_id||row.actor_id!==scope.actor_id||row.context_id!==command.context_id||row.workspace_id!==scope.workspace_id||row.tenant_id!==scope.tenant_id||row.authority_revision!==command.authority_version)throw new CoreServiceReviseTerminalFailureV1('AUTHORITY_DENIED');
 if(!row.receipt_matched_unexpired)throw new CoreServiceReviseTerminalFailureV1('REPLAY_CONFLICT');return Object.freeze(row);
}
