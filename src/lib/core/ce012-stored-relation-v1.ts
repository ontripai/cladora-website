/** Trusted-server, historical read only. No endpoint, host, writer or authority. */
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {
  coreTransactionCommandV2Schema,coreTransactionReceiptV2Schema,
  type CoreTransactionScopeV1,
} from './postgres-transaction-host-v1.ts';
import {coreSubjectReferencesMatch} from './transaction-provider-evidence-v1.ts';
import {coreTransactionReplayReceiptHashV1} from './transaction-replay-provider-hook-v1.ts';
import {
  ce012GuideSaveCommandV1Schema,fingerprintCe012GuideSavePayload,
} from '../community/experience-guide-command-contract.ts';

export const CORE_CE012_STORED_RELATION_V1='core-ce012-stored-relation.v1' as const;
export const CORE_CE012_STORED_RELATION_RUNTIME_BINDING=null;
export const CORE_CE012_STORED_RELATION_DEPENDENCY='DOCS-CE012-CASE-PLAN-01/CE_SAVE_CORE_STORED_RELATION' as const;
const uuid=z.string().uuid().transform(x=>x.toLowerCase());
const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const coreCe012StoredRelationRequestV1Schema=z.strictObject({
  contract:z.literal(CORE_CE012_STORED_RELATION_V1),
  command:coreTransactionCommandV2Schema,
  guide_command:ce012GuideSaveCommandV1Schema,
  expected:z.strictObject({
    core_receipt_id:uuid,core_receipt_hash:digest,ce_save_receipt_id:uuid,
    receipt_hash_contract:z.literal('core-transaction-replay-provider-receipt.v1'),
  }),
});
export type CoreCe012StoredRelationRequestV1=z.infer<typeof coreCe012StoredRelationRequestV1Schema>;
export type CoreCe012StoredRelationResultV1={
  contract:typeof CORE_CE012_STORED_RELATION_V1;
  status:'not_ready'; // Intentionally no ready/authorized variant in this ABI.
  core_status:'matched'|'missing'|'mismatch'|'expired'|'unavailable';
  code:'CE_SAVE_WRITER_BRIDGE_MISSING'|'CORE_RECORD_MISSING'|'BINDING_MISMATCH'|'CORE_RECORD_EXPIRED'|'SOURCE_UNAVAILABLE';
  stored_ce_relation:null;
  action_authorization:'not_evaluated';
};
const answer=(core_status:CoreCe012StoredRelationResultV1['core_status'],code:CoreCe012StoredRelationResultV1['code']):CoreCe012StoredRelationResultV1=>({
  contract:CORE_CE012_STORED_RELATION_V1,status:'not_ready',core_status,code,
  stored_ce_relation:null,action_authorization:'not_evaluated',
});
/** SELECT on the same canonical C03 ledger row. FOR SHARE protects this observation
 * against concurrent row replacement/cleanup until the existing caller settles.
 * The caller supplies the existing host's trusted, read-restricted scope; a JSON
 * receipt, public GET, committed flag or caller callback cannot substitute for it.
 */
export const CORE_CE012_STORED_RELATION_SQL=`select tenant_id::text,actor_id::text,key,
  request_hash,response_ref,
  to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as expires_at,
  txid_current()::text as database_transaction_id,auth.uid()::text as observed_actor_id,
  current_setting('transaction_isolation') as isolation
  from platform.idempotency_keys where tenant_id=$1::uuid and key=$2::text for share`;
const storedRow=z.strictObject({
  tenant_id:uuid,actor_id:uuid,key:z.string(),request_hash:digest,response_ref:z.unknown(),
  expires_at:z.iso.datetime({offset:true}).refine(x=>x.endsWith('Z')),database_transaction_id:z.string().regex(/^[1-9][0-9]*$/),
  observed_actor_id:uuid,isolation:z.literal('serializable'),
});

/** Separate awaited statement: the ledger row lock has already been granted.
 * This scalar statement acquires no new application row locks. Materializing
 * transaction/actor metadata orders those reads before the fresh clock expression.
 * No further SQL/await occurs after this observation on the matched path.
 */
export const CORE_CE012_STORED_EXPIRY_SQL=`select * from (with observed as materialized (
  select txid_current()::text as database_transaction_id,auth.uid()::text as observed_actor_id,
    current_setting('transaction_isolation') as isolation)
  select ($1::timestamptz>clock_timestamp()) as unexpired,
    database_transaction_id,observed_actor_id,isolation from observed) as expiry_observation`;
const expiryObservation=z.strictObject({
  unexpired:z.boolean(),database_transaction_id:z.string().regex(/^[1-9][0-9]*$/),
  observed_actor_id:uuid,isolation:z.literal('serializable'),
});

/** Scope is a private capability from the existing Core host, not public input.
 * This proves only the observed Core record match. It cannot authenticate the
 * missing CE writer relation, current disclosure permission or backend settlement.
 */
export async function readCoreCe012StoredRelationV1(
  scope:CoreTransactionScopeV1,value:unknown,
):Promise<CoreCe012StoredRelationResultV1>{
  const parsed=coreCe012StoredRelationRequestV1Schema.safeParse(value);
  if(!parsed.success)return answer('mismatch','BINDING_MISMATCH');
  const {command,guide_command:guide,expected}=parsed.data;
  const bound={transaction_id:scope.transaction_id,database_transaction_id:scope.database_transaction_id,
    tenant_id:scope.tenant_id,workspace_id:scope.workspace_id,actor_id:scope.actor_id,attempt:scope.attempt};
  const unchanged=()=>Object.entries(bound).every(([k,v])=>scope[k as keyof typeof bound]===v);
  const target=guide.payload.document_target;
  if(!uuid.safeParse(bound.tenant_id).success||!Number.isSafeInteger(bound.attempt)||bound.attempt<1
    ||command.transaction_id!==bound.transaction_id||command.workspace_id!==bound.workspace_id||command.actor_id!==bound.actor_id
    ||target===null||command.context_id!==guide.context_id||command.workspace_id!==guide.workspace_id
    ||command.command_id!==guide.command_id||command.aggregate_id!==guide.guide_id
    ||command.aggregate_type!=='experience_guide'||command.aggregate_version!==guide.expected_guide_version+1
    ||command.permission_code!=='experience.guide.manage'||command.module_code!=='experience_guides'
    ||command.evaluation_purpose!=='experience.guide.command'||command.subject_reference.kind!=='experience.guide'
    ||command.subject_reference.id!==guide.guide_id||command.subject_reference.version!==guide.expected_guide_version
    ||command.subject_reference.relation!=='save_draft'||command.subject_reference.request_version!==1
    ||command.idempotency_key!==guide.idempotency_key||command.input_fingerprint!==guide.payload_fingerprint
    ||fingerprintCe012GuideSavePayload(guide)!==guide.payload_fingerprint
    ||!command.provider_source_ids.includes(target.document_id)||!command.provider_source_ids.includes(target.document_version_id)){
    return answer('mismatch','BINDING_MISMATCH');
  }
  // These are the existing host's parsed-command canonical key and request hash,
  // not replay-command hashing or the Documents compiler's sorted content hash.
  const key=`core-tx.v1:${command.workspace_id}:${command.idempotency_key}`;
  const requestHash=createHash('sha256').update(JSON.stringify(command)).digest('hex');
  try{
    const result=await scope.query(CORE_CE012_STORED_RELATION_SQL,[bound.tenant_id,key]);
    if(!unchanged())return answer('mismatch','BINDING_MISMATCH');
    if(result.rowCount===0&&result.rows.length===0)return answer('missing','CORE_RECORD_MISSING');
    if(result.rowCount!==1||result.rows.length!==1)return answer('unavailable','SOURCE_UNAVAILABLE');
    const row=storedRow.safeParse(result.rows[0]);
    if(!row.success)return answer('unavailable','SOURCE_UNAVAILABLE');
    const r=row.data;
    if(r.tenant_id!==bound.tenant_id||r.actor_id!==bound.actor_id||r.observed_actor_id!==bound.actor_id
      ||r.database_transaction_id!==bound.database_transaction_id||r.key!==key||r.request_hash!==requestHash){
      return answer('mismatch','BINDING_MISMATCH');
    }
    const receipt=coreTransactionReceiptV2Schema.safeParse(r.response_ref);
    if(!receipt.success)return answer('unavailable','SOURCE_UNAVAILABLE');
    const p=receipt.data;
    if(p.receipt_id!==expected.core_receipt_id||coreTransactionReplayReceiptHashV1(p)!==expected.core_receipt_hash
      ||p.workspace_id!==command.workspace_id||p.actor_id!==command.actor_id
      ||p.transaction_id!==command.transaction_id||p.command_id!==command.command_id
      ||p.idempotency_key!==command.idempotency_key||p.input_fingerprint!==command.input_fingerprint
      ||p.aggregate_type!==command.aggregate_type||p.aggregate_id!==command.aggregate_id||p.aggregate_version!==command.aggregate_version
      ||p.authority.context_id!==command.context_id||p.authority.authority_version!==command.authority_version
      ||p.authority.permission_code!==command.permission_code||p.authority.module_code!==command.module_code
      ||p.authority.evaluation_purpose!==command.evaluation_purpose
      ||!coreSubjectReferencesMatch(p.subject_reference,command.subject_reference)){
      return answer('mismatch','BINDING_MISMATCH');
    }
    // Awaiting the first SELECT is the ordering boundary: PostgreSQL has granted
    // FOR SHARE before the second statement can evaluate its fresh server clock.
    // Bind the exact locked timestamp, not a pre-lock boolean or a JS clock.
    const fresh=await scope.query(CORE_CE012_STORED_EXPIRY_SQL,[r.expires_at]);
    if(!unchanged())return answer('mismatch','BINDING_MISMATCH');
    if(fresh.rowCount!==1||fresh.rows.length!==1)return answer('unavailable','SOURCE_UNAVAILABLE');
    const expiry=expiryObservation.safeParse(fresh.rows[0]);
    if(!expiry.success)return answer('unavailable','SOURCE_UNAVAILABLE');
    if(expiry.data.database_transaction_id!==bound.database_transaction_id||expiry.data.observed_actor_id!==bound.actor_id){
      return answer('mismatch','BINDING_MISMATCH');
    }
    if(!expiry.data.unexpired)return answer('expired','CORE_RECORD_EXPIRED');
    // No canonical CE save writer binds mutation_id to expected.ce_save_receipt_id
    // or persists its immutable target relation. Equality must never imply one.
    return answer('matched','CE_SAVE_WRITER_BRIDGE_MISSING');
  }catch(error){
    if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='40001')throw error;
    return answer('unavailable','SOURCE_UNAVAILABLE');
  }
}
