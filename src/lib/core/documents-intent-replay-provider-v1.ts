/** Add canonical plan/current-state replay validation to the existing intent writer. */
import {createHash,randomUUID} from 'node:crypto';
import type {CoreTransactionCommandV1,CoreTransactionProvidersV1} from './postgres-transaction-host-v1';
import {coreTransactionReplayProviderDecisionV1Schema,coreTransactionReplayCommandHashV1,coreTransactionReplayReceiptHashV1} from './transaction-replay-provider-hook-v1';
import {CORE_DOCUMENTS_REPLAY_PROVIDER_V1,CORE_DOCUMENTS_STORED_EXPIRY_SQL_V1} from './documents-replay-only-v1';
export const CORE_DOCUMENTS_INTENT_PLAN_SQL_V1=`select c.command_wire,c.command_sha256,
 c.actor_id::text,c.tenant_id::text,c.workspace_id::text,c.context_id::text,c.intent_id::text,c.document_id::text,
 to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as expires_at
 from platform.document_upload_custody_v1 c where c.actor_id=$1::uuid and c.tenant_id=$2::uuid
 and c.workspace_id=$3::uuid and c.issue_command_id=$4::uuid and c.issue_transaction_id=$5::uuid
 and c.phase in ('sealed','retained','stream_admitted') for share`;
export const CORE_DOCUMENTS_INTENT_REPLAY_SQL_V1=`select c.command_wire,c.command_sha256,
 c.actor_id::text,c.tenant_id::text,c.workspace_id::text,c.context_id::text,c.intent_id::text,c.document_id::text,
 to_char(c.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as expires_at
 from platform.document_upload_custody_v1 c join documents.upload_intents i on i.id=c.intent_id
 and i.tenant_id=c.tenant_id and i.workspace_id=c.workspace_id and i.context_id=c.context_id and i.user_id=c.actor_id
 and i.prospective_document_id=c.document_id and i.operation_kind='new_document' and i.expected_version=1
 and i.bucket_id='document-vault' and i.object_path=c.issue_input->>'object_path'
 and i.declared_mime_type=c.issue_input->>'declared_mime_type' and i.max_size_bytes=(c.issue_input->>'max_size_bytes')::integer
 and i.expires_at=c.expires_at and i.idempotency_key=c.issue_key and i.status in ('authorized','consumed')
 where c.actor_id=$1::uuid and c.tenant_id=$2::uuid and c.workspace_id=$3::uuid
 and c.issue_command_id=$4::uuid and c.issue_transaction_id=$5::uuid for share of c,i`;
export function createCoreDocumentsIntentReplayProvidersV1(command:CoreTransactionCommandV1,base:CoreTransactionProvidersV1):CoreTransactionProvidersV1{
 if(command.permission_code!=='documents.vault.upload'||command.module_code!=='documents'||command.aggregate_type!=='documents.document'||command.evaluation_purpose!=='documents.workspace_upload.intent')return base;
 const read=async(scope:Parameters<CoreTransactionProvidersV1['validateProviders']>[0],sql:string)=>{
  const result=await scope.query(sql,[scope.actor_id,scope.tenant_id,scope.workspace_id,command.command_id,command.transaction_id]);
  if(result.rowCount!==1||result.rows.length!==1)return null;const r=result.rows[0];
  if(r.command_wire!==JSON.stringify(command)||r.command_sha256!==createHash('sha256').update(JSON.stringify(command)).digest('hex')
   ||r.actor_id!==scope.actor_id||r.tenant_id!==scope.tenant_id||r.workspace_id!==command.workspace_id||r.context_id!==command.context_id
   ||r.document_id!==command.aggregate_id||!command.provider_source_ids.includes(r.intent_id))return null;
  return r;
 };
 const wrapped:CoreTransactionProvidersV1={...base,replay_policy:'provider_current_state_required' as const,replay_provider_code:CORE_DOCUMENTS_REPLAY_PROVIDER_V1,
  async validateProviders(scope,actual,authority){return JSON.stringify(actual)===JSON.stringify(command)&&await read(scope,CORE_DOCUMENTS_INTENT_PLAN_SQL_V1)!==null&&await base.validateProviders(scope,actual,authority);},
  async validateReplay(scope,actual,authority,receipt){
   const row=await read(scope,CORE_DOCUMENTS_INTENT_REPLAY_SQL_V1);
   const check=await scope.query(CORE_DOCUMENTS_STORED_EXPIRY_SQL_V1,[row?.expires_at??'1970-01-01T00:00:00.000000Z',command.context_id,command.workspace_id,command.permission_code,command.module_code]);
   const x=check.rows[0],ok=!!row&&JSON.stringify(actual)===JSON.stringify(command)&&receipt.mutation_id===row.intent_id
    &&check.rowCount===1&&check.rows.length===1&&x.unexpired===true&&x.allowed===true&&Object.hasOwn(x,'session_guard')
    &&x.authority_revision===String(command.authority_version)&&x.database_transaction_id===scope.database_transaction_id&&x.observed_actor_id===scope.actor_id;
   const now=await scope.query<{now:string}>('select clock_timestamp()::text as now');
   return coreTransactionReplayProviderDecisionV1Schema.parse({contract_version:'core-transaction-replay-provider-decision.v1' as const,decision_id:randomUUID(),provider_code:CORE_DOCUMENTS_REPLAY_PROVIDER_V1,
    database_transaction_id:scope.database_transaction_id,transaction_id:command.transaction_id,command_id:command.command_id,workspace_id:scope.workspace_id,actor_id:scope.actor_id,context_id:command.context_id,
    authority_decision_id:authority.decision_id,authority_version:authority.authority_version,attempt:scope.attempt,receipt_id:receipt.receipt_id,receipt_contract_version:receipt.contract_version,
    command_hash:coreTransactionReplayCommandHashV1(command),receipt_hash:coreTransactionReplayReceiptHashV1(receipt),evaluated_at:now.rows[0].now,read_only:true as const,
    decision:ok?'accepted' as const:'denied' as const,denial_reason:ok?null:'REPLAY_STATE_CHANGED' as const});
  },
 };
 return Object.freeze(wrapped);
}
