/** Fixed Core-owned host hook. No injectable operation/allow/time or settlement API. */
import type {CoreTransactionScopeV1,CoreTransactionCommandV2,CoreTransactionReceiptV2} from './postgres-transaction-host-v1';
import {createCoreCe012TerminalAuthorityPortV1,CORE_CE012_TERMINAL_SQL} from './ce012-terminal-authority-port-v1';
import {CORE_CE012_SAVE_RELATION_SQL} from './ce012-combined-stored-relation-v1';
import {observeCoreDocumentsJointCandidateV1} from './ce012-documents-joint-candidate-v1';
import {coreTransactionReplayReceiptHashV1} from './transaction-replay-provider-hook-v1';

export const CORE_CE012_HOST_TERMINAL_CHECKPOINT_V1='core-ce012-host-terminal-checkpoint.v1' as const;
export async function runCoreCe012HostTerminalCheckpointV1(scope:CoreTransactionScopeV1,command:CoreTransactionCommandV2,receipt:CoreTransactionReceiptV2,jointReplay=false){
  const session=await scope.query(CORE_CE012_TERMINAL_SQL.session);
  if(session.rowCount!==1||session.rows.length!==1||!Object.hasOwn(session.rows[0],'session_guard'))throw new Error('core_terminal_session_unavailable');
  const key=`core-tx.v1:${command.workspace_id}:${command.idempotency_key}`;
  const selected=await scope.query(CORE_CE012_SAVE_RELATION_SQL,[scope.tenant_id,scope.workspace_id,key]);
  if(selected.rowCount!==1||selected.rows.length!==1)throw new Error('core_terminal_relation_unavailable');
  const row=selected.rows[0];
  const input={
    contract:'core-ce012-stored-relation.v1',command,guide_command:row.guide_command,
    expected:{core_receipt_id:receipt.receipt_id,core_receipt_hash:coreTransactionReplayReceiptHashV1(receipt),
      ce_save_receipt_id:row.ce_receipt?.receipt_id,receipt_hash_contract:'core-transaction-replay-provider-receipt.v1'},
  };
  const port=createCoreCe012TerminalAuthorityPortV1(scope,input);
  try{
    const result=await port.checkpoint();
    if(result.core_status!=='observed'||!result.observation)throw new Error('core_terminal_checkpoint_unavailable');
    const actual=port.inspect(result.observation);
    if(actual.status!=='core_observed_not_ready')throw new Error('core_terminal_checkpoint_invalidated');
    // Core10's subset remains NOT_READY for D02/D03/D04. This is only an actual
    // internally obtained observation to correlate with host lifecycle/response.
    const joint=jointReplay?await observeCoreDocumentsJointCandidateV1(scope,input,actual.binding):null;
    return Object.freeze({...(joint?{joint}:{}),contract:CORE_CE012_HOST_TERMINAL_CHECKPOINT_V1,binding:actual.binding,evaluated_at:actual.evaluated_at,
      authority:'not_ready' as const,documents_projection:null});
  }finally{port.close();}
}
