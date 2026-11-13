/** Private Documents-only recovery over the existing C03 record, never a writer. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { coreTransactionReceiptV1Schema, type CoreTransactionCommandV1, type CoreTransactionProvidersV1, type CoreTransactionScopeV1 } from './postgres-transaction-host-v1';
export const CORE_DOCUMENTS_REPLAY_ONLY_V1 = 'core-documents-replay-only.v1' as const;
export const CORE_DOCUMENTS_REPLAY_PROVIDER_V1 = 'documents-workspace-binding-writer.v1' as const;
export function isCoreDocumentsReplayProfileV1(c: CoreTransactionCommandV1, p: CoreTransactionProvidersV1) {
 const upload=c.permission_code==='documents.vault.upload' && ['documents.workspace_upload.intent','documents.workspace_upload.finalize'].includes(c.evaluation_purpose) && p.replay_provider_code===CORE_DOCUMENTS_REPLAY_PROVIDER_V1;
 const download=c.permission_code==='documents.vault.read' && c.evaluation_purpose==='documents.vault.download.current_clean' && p.replay_provider_code==='documents-vault-download-exact-workspace.v2';
 return (upload||download) && c.module_code === 'documents'
  && c.aggregate_type === 'documents.document'
  && p.replay_policy === 'provider_current_state_required'
  && typeof p.validateReplay === 'function' && p.terminal_checkpoint === undefined;
}
export const CORE_DOCUMENTS_STORED_RECEIPT_SQL_V1 = `select tenant_id::text,actor_id::text,key,request_hash,response_ref,
 to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as expires_at,
 txid_current()::text as database_transaction_id,auth.uid()::text as observed_actor_id,
 current_setting('transaction_isolation') as isolation
 from platform.idempotency_keys where tenant_id=$1::uuid and key=$2::text for share`;
export const CORE_DOCUMENTS_STORED_EXPIRY_SQL_V1 = `select * from (with observed as materialized (
 select txid_current()::text as database_transaction_id,auth.uid()::text as observed_actor_id,
 current_setting('transaction_isolation') as isolation,
 app_private.require_request_session_current_at_v1(clock_timestamp()) as session_guard,
 app_private.check_workspace_native_permission_v2($2::uuid,$3::uuid,$4::text,$5::text) as allowed,
 (select revision::text from app_private.canonical_authority_revision_v1 where singleton) as authority_revision)
 select ($1::timestamptz>clock_timestamp()) as unexpired,database_transaction_id,observed_actor_id,isolation,session_guard,allowed,authority_revision from observed) as expiry_observation`;
const stamp=z.iso.datetime({offset:true}).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
export async function readCoreDocumentsReplayOnlyV1(scope: CoreTransactionScopeV1,c: CoreTransactionCommandV1) {
 const identity=JSON.stringify([scope.actor_id,scope.tenant_id,scope.workspace_id,scope.transaction_id,scope.database_transaction_id,scope.attempt]);
 const unchanged=()=>identity===JSON.stringify([scope.actor_id,scope.tenant_id,scope.workspace_id,scope.transaction_id,scope.database_transaction_id,scope.attempt]);
 if(c.actor_id!==scope.actor_id||c.workspace_id!==scope.workspace_id||c.transaction_id!==scope.transaction_id)return null;
 const key=`core-tx.v1:${c.workspace_id}:${c.idempotency_key}`,hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 const rows=await scope.query(CORE_DOCUMENTS_STORED_RECEIPT_SQL_V1,[scope.tenant_id,key]);
 if(!unchanged()||rows.rowCount!==1||rows.rows.length!==1)return null;
 const row=rows.rows[0],parsed=coreTransactionReceiptV1Schema.safeParse(row.response_ref);
 if(!parsed.success||!stamp.safeParse(row.expires_at).success||row.key!==key||row.request_hash!==hash
  ||row.tenant_id!==scope.tenant_id||row.actor_id!==scope.actor_id||row.observed_actor_id!==scope.actor_id
  ||row.database_transaction_id!==scope.database_transaction_id||row.isolation!=='serializable')return null;
 const r=parsed.data,a=r.authority;
 if(r.actor_id!==c.actor_id||r.workspace_id!==c.workspace_id||r.transaction_id!==c.transaction_id||r.command_id!==c.command_id
  ||r.idempotency_key!==c.idempotency_key||r.input_fingerprint!==c.input_fingerprint||r.aggregate_type!==c.aggregate_type
  ||r.aggregate_id!==c.aggregate_id||r.aggregate_version!==c.aggregate_version||a.context_id!==c.context_id
  ||a.authority_version!==c.authority_version||a.permission_code!==c.permission_code||a.module_code!==c.module_code
  ||a.evaluation_purpose!==c.evaluation_purpose||r.replay_validation?.provider_code!==(c.permission_code==='documents.vault.read'?'documents-vault-download-exact-workspace.v2':CORE_DOCUMENTS_REPLAY_PROVIDER_V1))return null;
 // Separate awaited clock after row-lock wait, no JS wall clock or replacement TTL.
 const check=await scope.query(CORE_DOCUMENTS_STORED_EXPIRY_SQL_V1,[row.expires_at,c.context_id,c.workspace_id,c.permission_code,c.module_code]);
 if(!unchanged()||check.rowCount!==1||check.rows.length!==1)return null;
 const x=check.rows[0];
 if(x.unexpired!==true||x.allowed!==true||!Object.hasOwn(x,'session_guard')||x.authority_revision!==String(c.authority_version)||x.observed_actor_id!==scope.actor_id||x.database_transaction_id!==scope.database_transaction_id||x.isolation!=='serializable')return null;
 return r;
}
