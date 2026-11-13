/** SERVICE-only diagnostic boundary, not a dispatch/replay authorization port. */
import 'server-only';
import {z} from 'zod';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import {resolveAuthority} from './current-authority-postgres-provider-v1';
import {currentAuthorityTransactionRequestV1Schema,bindCanonicalCurrentAuthorityObservationV1} from './current-authority-transaction-port-v1';
import {CORE_S01_SQL} from './service-s01/provider-agreement-reader-v1';
export const CORE_SERVICE_ORIGINAL_CURRENT_BOUNDARY_V1='core-service-original-current-boundary.v1' as const;
export const CORE_SERVICE_ORIGINAL_CURRENT_RUNTIME_BINDING=null;
const version=z.coerce.number().int().positive().safe(),uuid=z.string().uuid();
const finalSchema=z.object({database_transaction_id:z.string(),actor_id:uuid,isolation:z.literal('serializable'),
 evaluated_at:z.iso.datetime({offset:true}),allowed:z.boolean(),authority_revision:version});
const closed=(status:'aligned'|'hold'|'denied',code:string,original:number,current:number|null,at:string|null)=>Object.freeze({
 contract_version:CORE_SERVICE_ORIGINAL_CURRENT_BOUNDARY_V1,status,code,original_authority_version:original,
 current_authority_version:current,evaluated_at:at,action_authorization:'not_evaluated' as const,
 dispatch_admitted:false as const,reusable_as_authority:false as const,original_command_rewrite:false as const,
});
/** Invoke only inside the existing host's live same-attempt scope. The incoming
 * request describes the HISTORICAL command. It is not accepted as current allow.
 * Neither aligned nor current-allowed/mismatch enables the existing C03 host.
 */
export async function observeCoreServiceOriginalCurrentBoundaryV1(scope:CoreTransactionScopeV1,value:unknown){
 const original=currentAuthorityTransactionRequestV1Schema.parse(value);
 if(original.actor_id!==scope.actor_id||original.workspace_id!==scope.workspace_id
  ||original.transaction_context.transaction_id!==scope.transaction_id||original.transaction_context.attempt!==scope.attempt
  ||original.transaction_context.isolation_level!=='serializable'||original.transaction_context.lock.workspace_id!==scope.workspace_id
  ||original.transaction_context.lock.aggregate_type!=='service_offering'||original.module_code!=='services_catalog'
  ||!((original.permission_code==='services.catalog.manage'&&['service.create_offering','service.transition_offering','service.revise_offering'].includes(original.evaluation_purpose))
   ||(original.permission_code==='services.catalog.publish'&&original.evaluation_purpose==='service.transition_offering')))throw Error('SERVICE_BOUNDARY_SCOPE_MISMATCH');
 const epochs=await scope.query('select revision::text from app_private.canonical_authority_revision_v1 where singleton for share');
 if(epochs.rowCount!==1||epochs.rows.length!==1)throw Error('SERVICE_BOUNDARY_SOURCE_UNAVAILABLE');
 const currentVersion=version.parse(epochs.rows[0].revision);
 const current={...original,authority_version:currentVersion};
 // Official evaluator and canonical context/actor/entitlement, not a parallel engine.
 const observation=await resolveAuthority(scope,current);
 const decision=bindCanonicalCurrentAuthorityObservationV1(current,observation);
 const answer=await scope.query(CORE_S01_SQL.final,[original.context_id,original.workspace_id,original.permission_code,original.module_code]);
 if(answer.rowCount!==1||answer.rows.length!==1)throw Error('SERVICE_BOUNDARY_SOURCE_UNAVAILABLE');
 const final=finalSchema.parse(answer.rows[0]);
 if(final.database_transaction_id!==scope.database_transaction_id||final.actor_id!==scope.actor_id
  ||final.authority_revision!==currentVersion)throw Error('SERVICE_BOUNDARY_SCOPE_DRIFT');
 if(decision.decision!=='allowed'||!final.allowed)return closed('denied','CURRENT_AUTHORITY_DENIED',original.authority_version,null,null);
 if(original.authority_version!==currentVersion)return closed('hold','ORIGINAL_CURRENT_C03_ABI_REQUIRED',original.authority_version,currentVersion,final.evaluated_at);
 return closed('aligned','EXISTING_C03_RECHECK_REQUIRED',original.authority_version,currentVersion,final.evaluated_at);
}
