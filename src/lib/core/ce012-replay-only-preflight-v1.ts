/** Read existing C03 only; never reserves, mutates, repairs or invents a receipt. */
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {coreTransactionReceiptV2Schema,type CoreTransactionScopeV1,type CoreTransactionCommandV2} from './postgres-transaction-host-v1';
import {CORE_CE012_STORED_RELATION_SQL,CORE_CE012_STORED_EXPIRY_SQL} from './ce012-stored-relation-v1';
import {coreSubjectReferencesMatch} from './transaction-provider-evidence-v1';
const stamp=z.iso.datetime({offset:true}).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
export async function readCoreCe012ReplayOnlyPreflightV1(scope:CoreTransactionScopeV1,c:CoreTransactionCommandV2){
 const identity=JSON.stringify([scope.actor_id,scope.tenant_id,scope.workspace_id,scope.transaction_id,scope.database_transaction_id,scope.attempt]);
 const unchanged=()=>identity===JSON.stringify([scope.actor_id,scope.tenant_id,scope.workspace_id,scope.transaction_id,scope.database_transaction_id,scope.attempt]);
 const key=`core-tx.v1:${c.workspace_id}:${c.idempotency_key}`,hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
 const result=await scope.query(CORE_CE012_STORED_RELATION_SQL,[scope.tenant_id,key]);
 if(!unchanged()||result.rowCount!==1||result.rows.length!==1)return null;
 const row=result.rows[0],p=coreTransactionReceiptV2Schema.safeParse(row.response_ref);
 if(!p.success||!stamp.safeParse(row.expires_at).success||row.tenant_id!==scope.tenant_id||row.actor_id!==scope.actor_id
  ||row.observed_actor_id!==scope.actor_id||row.database_transaction_id!==scope.database_transaction_id||row.isolation!=='serializable'
  ||row.key!==key||row.request_hash!==hash)return null;
 const r=p.data;
 if(r.actor_id!==c.actor_id||r.workspace_id!==c.workspace_id||r.command_id!==c.command_id||r.transaction_id!==c.transaction_id
  ||r.idempotency_key!==c.idempotency_key||r.input_fingerprint!==c.input_fingerprint||r.aggregate_type!==c.aggregate_type
  ||r.aggregate_id!==c.aggregate_id||r.aggregate_version!==c.aggregate_version||r.authority.context_id!==c.context_id
  ||r.authority.authority_version!==c.authority_version||r.authority.permission_code!==c.permission_code
  ||r.authority.module_code!==c.module_code||r.authority.evaluation_purpose!==c.evaluation_purpose
  ||!coreSubjectReferencesMatch(r.subject_reference,c.subject_reference)
  ||r.provider_evidence.provider_code!=='documents-ce012-reference-provider.v1'
  ||r.replay_validation?.provider_code!=='documents-ce012-reference-provider.v1')return null;
 const observed=await scope.query(CORE_CE012_STORED_EXPIRY_SQL,[row.expires_at]);
 if(!unchanged()||observed.rowCount!==1||observed.rows.length!==1)return null;
 const x=observed.rows[0];
 if(x.unexpired!==true||x.observed_actor_id!==scope.actor_id||x.database_transaction_id!==scope.database_transaction_id||x.isolation!=='serializable')return null;
 return r;
}
