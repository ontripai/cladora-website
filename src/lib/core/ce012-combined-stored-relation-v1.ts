/** Inactive integrity composition only. No writer, authority or custody claim. */
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {
  coreCe012StoredRelationRequestV1Schema,readCoreCe012StoredRelationV1,
  CORE_CE012_STORED_RELATION_SQL,
} from './ce012-stored-relation-v1';
import {coreTransactionCommandV2Schema,coreTransactionReceiptV2Schema,type CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import {coreTransactionReplayReceiptHashV1} from './transaction-replay-provider-hook-v1';
import {ce012GuideSaveCommandV1Schema,ce012GuideCommandReceiptV1Schema} from '../community/experience-guide-command-contract';

export const CORE_CE012_COMBINED_RELATION_V1='core-ce012-combined-stored-relation.v1' as const;
export const CORE_CE012_COMBINED_RELATION_RUNTIME_BINDING=null;
export const CORE_CE012_COMBINED_CE_SOURCE='d767e84a6d8489ee731f64eb5c8b38f29d35a7fe';
const provider='documents-ce012-reference-provider.v1';
const uuid=z.string().uuid().transform(x=>x.toLowerCase());
const digest=z.string().regex(/^[a-f0-9]{64}$/);
/** Core-owned projection of the pinned CE proposal's actual store ABI. This is
 * neither the legacy table nor a caller-supplied reader/verifier/module callback.
 */
export const CORE_CE012_SAVE_RELATION_SQL=`select tenant_id::text,workspace_id::text,actor_id::text,
  membership_id::text,canonical_key,command_hash,command_json,guide_command,ce_receipt,
  mutation_id::text,database_transaction_id from experience.guide_save_receipts_v1
  where tenant_id=$1::uuid and workspace_id=$2::uuid and canonical_key=$3::text for share`;
const rowSchema=z.strictObject({tenant_id:uuid,workspace_id:uuid,actor_id:uuid,membership_id:uuid,
  canonical_key:z.string(),command_hash:digest,command_json:z.unknown(),guide_command:z.unknown(),ce_receipt:z.unknown(),
  mutation_id:uuid,database_transaction_id:z.string().regex(/^[1-9][0-9]*$/)});
export interface CoreCe012CombinedRelationV1 {
  contract:typeof CORE_CE012_COMBINED_RELATION_V1;
  status:'not_ready';
  integrity:'matched_candidate'|'mismatch'|'unavailable'|'expired';
  current_disclosure:'not_evaluated';custody:'not_proven';native_deferred_check:'not_run';
  stored_ce_relation:null;action_authorization:'not_evaluated';
}
const result=(integrity:CoreCe012CombinedRelationV1['integrity']):CoreCe012CombinedRelationV1=>({
  contract:CORE_CE012_COMBINED_RELATION_V1,status:'not_ready',integrity,current_disclosure:'not_evaluated',
  custody:'not_proven',native_deferred_check:'not_run',stored_ce_relation:null,action_authorization:'not_evaluated',
});

/** Order: canonical C03 SHARE -> CE SHARE/full candidate bindings -> OFFICIAL
 * Core reader/fresh expiry LAST. No await follows its matched result. Current
 * disclosure/custody/joint acceptance are separate gates, never caller callbacks.
 */
export async function readCoreCe012CombinedRelationV1(scope:CoreTransactionScopeV1,value:unknown):Promise<CoreCe012CombinedRelationV1>{
  const input=coreCe012StoredRelationRequestV1Schema.safeParse(value);
  if(!input.success)return result('mismatch');
  const {command,guide_command:guide,expected}=input.data;
  const identity={transaction_id:scope.transaction_id,database_transaction_id:scope.database_transaction_id,
    tenant_id:scope.tenant_id,workspace_id:scope.workspace_id,actor_id:scope.actor_id,attempt:scope.attempt};
  const unchanged=()=>Object.entries(identity).every(([k,v])=>scope[k as keyof typeof identity]===v);
  if(command.transaction_id!==identity.transaction_id||command.workspace_id!==identity.workspace_id
    ||command.actor_id!==identity.actor_id||!uuid.safeParse(identity.tenant_id).success)return result('mismatch');
  const key=`core-tx.v1:${command.workspace_id}:${command.idempotency_key}`;
  const hash=createHash('sha256').update(JSON.stringify(command)).digest('hex');
  try{
    // Actual C03 response_ref is read, never supplied as purported storage proof.
    const ledger=await scope.query(CORE_CE012_STORED_RELATION_SQL,[identity.tenant_id,key]);
    if(!unchanged())return result('mismatch');
    if(ledger.rowCount!==1||ledger.rows.length!==1)return result('unavailable');
    const l=ledger.rows[0],core=coreTransactionReceiptV2Schema.safeParse(l.response_ref);
    if(!core.success)return result('unavailable');
    if(l.tenant_id!==identity.tenant_id||l.actor_id!==identity.actor_id||l.key!==key||l.request_hash!==hash
      ||l.database_transaction_id!==identity.database_transaction_id||l.observed_actor_id!==identity.actor_id||l.isolation!=='serializable'
      ||core.data.receipt_id!==expected.core_receipt_id||coreTransactionReplayReceiptHashV1(core.data)!==expected.core_receipt_hash)return result('mismatch');
    const rows=await scope.query(CORE_CE012_SAVE_RELATION_SQL,[identity.tenant_id,identity.workspace_id,key]);
    if(!unchanged())return result('mismatch');
    if(rows.rowCount!==1||rows.rows.length!==1)return result('unavailable');
    const parsed=rowSchema.safeParse(rows.rows[0]);if(!parsed.success)return result('unavailable');
    const row=parsed.data;
    const storedCommand=coreTransactionCommandV2Schema.safeParse(row.command_json),storedGuide=ce012GuideSaveCommandV1Schema.safeParse(row.guide_command);
    const ce=ce012GuideCommandReceiptV1Schema.safeParse(row.ce_receipt);
    if(!storedCommand.success||!storedGuide.success||!ce.success)return result('unavailable');
    const r=ce.data,c=core.data,target=guide.payload.document_target;
    if(row.tenant_id!==identity.tenant_id||row.workspace_id!==identity.workspace_id||row.actor_id!==identity.actor_id
      ||row.canonical_key!==key||row.command_hash!==hash||JSON.stringify(storedCommand.data)!==JSON.stringify(command)
      ||JSON.stringify(storedGuide.data)!==JSON.stringify(guide)||r.receipt_id!==expected.ce_save_receipt_id
      ||row.mutation_id!==c.mutation_id||c.authority.decision_id!==r.core_decision_id
      ||c.provider_evidence.provider_code!==provider||c.replay_validation?.provider_code!==provider
      ||r.command_id!==guide.command_id||r.context_id!==guide.context_id||r.workspace_id!==guide.workspace_id
      ||r.guide_id!==guide.guide_id||r.previous_guide_version!==guide.expected_guide_version
      ||r.resulting_guide_version!==command.aggregate_version||r.payload_fingerprint!==guide.payload_fingerprint
      ||r.idempotency_key!==guide.idempotency_key||target===null||r.document_target===null
      ||r.document_target.document_id!==target.document_id||r.document_target.document_version_id!==target.document_version_id
      ||r.document_target.document_version!==target.document_version)return result('mismatch');
    // Safe label may be Documents' neutral projection, not the original label.
    // Original full payload is bound above. No label or receipt is disclosed here.
    // Historical original DB transaction ID is NOT the new read transaction ID.
    const final=await readCoreCe012StoredRelationV1(scope,input.data);
    if(!unchanged())return result('mismatch');
    if(final.core_status==='expired')return result('expired');
    if(final.core_status!=='matched')return result(final.core_status==='mismatch'?'mismatch':'unavailable');
    // No native constraint firing/custody/current-disclosure or joint approval is
    // implied by this candidate integrity match; Docs historical slots stay blocked.
    return result('matched_candidate');
  }catch(error){
    if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='40001')throw error;
    return result('unavailable');
  }
}

/** Explicit disclosure-fenced revision. V1 remains byte-for-byte compatible:
 * matching the private readers is integrity evidence, never terminal authority.
 * No official joint Core/Docs post-wait checkpoint exists in the pinned inputs;
 * there is deliberately no callback/allow flag or stored-label fallback here.
 */
export const CORE_CE012_COMBINED_DISCLOSURE_V2='core-ce012-combined-stored-relation.v2' as const;
export interface CoreCe012CombinedDisclosureV2 extends Omit<CoreCe012CombinedRelationV1,'contract'> {
  contract:typeof CORE_CE012_COMBINED_DISCLOSURE_V2;
  reader_policy:'original_actor_only';
  checkpoint_scope:'stored_integrity_and_receipt_expiry_only';
  terminal_authority_checkpoint:'not_ready';
  documents_disclosure_projection:null;
  disclosure_status:'not_ready';
  disclosure_dependency:'joint_core_documents_terminal_checkpoint';
}
export async function readCoreCe012CombinedDisclosureV2(scope:CoreTransactionScopeV1,value:unknown):Promise<CoreCe012CombinedDisclosureV2>{
  const integrity=await readCoreCe012CombinedRelationV1(scope,value);
  // No later CE/Docs wait is treated as covered by V1's earlier expiry sample.
  // The only outward projection is null until the official joint gate is supplied
  // and independently accepted. Historical receipt/fingerprint are never rewritten.
  return {...integrity,contract:CORE_CE012_COMBINED_DISCLOSURE_V2,reader_policy:'original_actor_only',
    checkpoint_scope:'stored_integrity_and_receipt_expiry_only',terminal_authority_checkpoint:'not_ready',
    documents_disclosure_projection:null,disclosure_status:'not_ready',
    disclosure_dependency:'joint_core_documents_terminal_checkpoint'};
}
