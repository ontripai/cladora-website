/** Owner-approved own-party V1 source; native adoption and command authority are separate. */
import 'server-only';
import {randomUUID} from 'node:crypto';
import {describeWorkspaceNativeAuthorityDecisionV2} from './workspace-authority-decision-v2';
import {CORE_LISTING_OWNERSHIP_ADOPTION_SQL_V1} from './listing-ownership-adoption-query-v1';
import {z} from 'zod';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import {checkpointCoreAirpropReadScopeV1,inspectCoreAirpropReadObservationV1,CoreReadHostUnavailableV1} from './airprop-read-host-v1';
import {selectCurrentUnitPropertyForReadV1} from './current-unit-property-read-selector-v1';
import {CORE_LISTING_OWNERSHIP_CANDIDATE_SQL_V1 as SQL} from './listing-ownership-companion-queries-v1';
export const CORE_LISTING_OWNERSHIP_COMPANION_V1='core-listing-ownership-companion.v1' as const;
export const CORE_LISTING_OWNERSHIP_RUNTIME_BINDING=null;
const uuid=z.string().uuid(),stamp=z.iso.datetime({offset:true}).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const version=z.string().regex(/^[1-9][0-9]*$/).transform(Number).refine(Number.isSafeInteger);
const rowSchema=z.strictObject({ownership_id:uuid,ownership_version:version.nullable(),tenant_id:uuid,unit_id:uuid,party_id:uuid,party_version:version.nullable(),party_kind:z.enum(['person','company','association','public_body']),
 resource_label:z.string(),date_zone:z.string(),valid_from:stamp,valid_until:stamp.nullable(),party_link_from:stamp,party_link_until:stamp.nullable()});
const expected=z.strictObject({property_id:uuid,unit_id:uuid,resource_version:z.number().int().positive().safe().optional()});
type Selection=Extract<Awaited<ReturnType<typeof selectCurrentUnitPropertyForReadV1>>,{status:'selected'}>['binding'];
const candidates=new WeakMap<object,{scope:CoreTransactionScopeV1;token:Awaited<ReturnType<typeof checkpointCoreAirpropReadScopeV1>>;binding:Selection;source:z.infer<typeof rowSchema>;checked_at:string;current_until:string}>();
const closed=(reason:string)=>Object.freeze({contract_version:CORE_LISTING_OWNERSHIP_COMPANION_V1,status:'not_ready' as const,reason,projection:null,action_authorization:'not_evaluated' as const,reusable_as_command_authority:false as const});
/** Actual live host + source rows only, no caller allow, receipt or arbitrary verifier. */
export async function readCoreListingOwnershipCandidateV1(scope:CoreTransactionScopeV1,value:unknown){
 const target=expected.parse(value),selected=await selectCurrentUnitPropertyForReadV1(scope,{property_id:target.property_id,unit_id:target.unit_id,expected_resource_version:target.resource_version});
 if(selected.status!=='selected')return closed('UNIT_SPEC_OR_SCOPE_NOT_CURRENT');
 const token=await checkpointCoreAirpropReadScopeV1(scope),before=inspectCoreAirpropReadObservationV1(scope,token);
 if(!before)throw new CoreReadHostUnavailableV1('READ_CHECKPOINT_UNAVAILABLE');
 const adoption=await scope.query(CORE_LISTING_OWNERSHIP_ADOPTION_SQL_V1);
 if(adoption.rowCount!==1||adoption.rows.length!==1||adoption.rows[0].adopted!==true)return closed('CANONICAL_REVISION_WRITER_ADOPTION_REQUIRED');
 const result=await scope.query(SQL,[before.tenant_id,before.workspace_id,before.context_id,before.membership_id,target.unit_id,target.property_id,selected.binding.specification_id]);
 if(result.rowCount!==result.rows.length)throw new CoreReadHostUnavailableV1('LISTING_SOURCE_CARDINALITY');
 if(result.rows.length>100)return closed('SOURCE_SCAN_BOUND_EXCEEDED');
 const rows=result.rows.map(r=>rowSchema.parse(r));
 const finalToken=await checkpointCoreAirpropReadScopeV1(scope),at=inspectCoreAirpropReadObservationV1(scope,finalToken);
 if(!at||at.authority_revision!==before.authority_revision||at.database_transaction_id!==before.database_transaction_id||at.backend_pid!==before.backend_pid)throw new CoreReadHostUnavailableV1('LISTING_SOURCE_SCOPE_DRIFT');
 // Reject unknown civic-date semantics instead of assuming timezone equivalence.
 if(rows.some(r=>r.date_zone!=='UTC'))return closed('OWNERSHIP_DATE_POLICY_ADOPTION_REQUIRED');
 if(rows.some(r=>r.tenant_id!==at.tenant_id||r.unit_id!==target.unit_id))throw new CoreReadHostUnavailableV1('LISTING_SOURCE_FOREIGN');
 const effective=rows.filter(r=>r.valid_from<=at.checked_at&&(r.valid_until===null||r.valid_until>at.checked_at)
  &&r.party_link_from<=at.checked_at&&(r.party_link_until===null||r.party_link_until>at.checked_at));
 if(effective.length!==1)return closed(effective.length?'OWN_PARTY_RELATIONSHIP_AMBIGUOUS':'OWN_PARTY_RELATIONSHIP_ABSENT');
 const r=effective[0];if(r.ownership_version===null||r.party_version===null)return closed('SOURCE_REVISION_NOT_ADOPTED');
 if(!['person','company'].includes(r.party_kind))return closed('PARTY_FAMILY_NOT_ADOPTED');
 if(r.resource_label.trim()!==r.resource_label||r.resource_label.length<1||r.resource_label.length>240||/[\u0000-\u001f\u007f]|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i.test(r.resource_label))return closed('SAFE_SOURCE_LABEL_UNAVAILABLE');
 const futureTransitions=rows.flatMap(row=>[row.valid_from,row.party_link_from]).filter(t=>t>at.checked_at);
 const bounds=[selected.binding.scope_and_binding_until,at.scope_expires_at,...futureTransitions,...[r.valid_until,r.party_link_until].filter((x):x is string=>x!==null)].sort();
 if(bounds[0]<=at.checked_at)return closed('SOURCE_EXPIRED_AFTER_WAIT');
 const candidate=Object.freeze({...closed('PRIVATE_SOURCE_CONTINUITY_NOT_COMMAND_AUTHORITY'),candidate_status:'private_source_matched' as const,current_until:bounds[0]});
 candidates.set(candidate,{scope,token:finalToken,binding:selected.binding,source:r,checked_at:at.checked_at,current_until:bounds[0]});
 return candidate;
}
/** MATCH is private source continuity only, not a current permit or disclosure. */
export function isCoreListingOwnershipCandidateV1(value:unknown){return !!value&&typeof value==='object'&&candidates.has(value);}
/** Owner-approved own-party V1 only. Metadata admission is not native writer/role proof. */
export function createCoreListingOwnershipCompanionV1(){return Object.freeze({
 async readCanonical(scope:CoreTransactionScopeV1,server:{actor_id:string;tenant_id:string;context_id:string;workspace_id:string},row:{property_id:string;unit_id:string},notBefore:string){
  const t=await checkpointCoreAirpropReadScopeV1(scope),s=inspectCoreAirpropReadObservationV1(scope,t);
  if(!s||s.actor_id!==server.actor_id||s.tenant_id!==server.tenant_id||s.context_id!==server.context_id||s.workspace_id!==server.workspace_id||!stamp.safeParse(notBefore).success||s.checked_at<notBefore)throw new CoreReadHostUnavailableV1('LISTING_SOURCE_SCOPE_DRIFT');
  const candidate=await readCoreListingOwnershipCandidateV1(scope,{property_id:row.property_id,unit_id:row.unit_id});
  const actual=candidates.get(candidate),current=actual?inspectCoreAirpropReadObservationV1(scope,actual.token):null;
  if(!actual||!current||actual.scope!==scope||current.checked_at<notBefore)throw new CoreReadHostUnavailableV1('LISTING_CANONICAL_PRODUCER_NOT_READY');
  const r=actual.source,at=current.checked_at,b=actual.binding;
  const authorityRequest={contract_version:'workspace-native-effective-authority.v2' as const,decision_id:randomUUID(),context_id:current.context_id,workspace_id:current.workspace_id,
   permission_code:'airprop.asset.read',module_code:'airprop_commercial',evaluation_purpose:'airprop.portfolio.read',target_scope_type:'workspace' as const,target_scope_id:current.workspace_id};
  // This projects the actual opaque host checkpoint, not a caller boolean or new evaluator.
  const authority=describeWorkspaceNativeAuthorityDecisionV2(authorityRequest,true,at);
  const resource={contract_version:'canonical-resource-reference.v1' as const,context_id:current.context_id,workspace_id:current.workspace_id,resource_type:'unit' as const,
   resource_id:b.unit_id,resource_version:b.resource_version,permission_code:'airprop.asset.read',purpose:'airprop.portfolio.read'};
  const relationship={contract_version:'resource-relationship.v1' as const,relationship_id:r.ownership_id,relationship_version:r.ownership_version!,tenant_id:current.tenant_id,workspace_id:current.workspace_id,
   party_id:r.party_id,party_kind:r.party_kind,resource_type:'unit' as const,resource_id:b.unit_id,relationship_kind:'ownership' as const,scope_codes:['airprop.asset.read'],
   valid_from:r.valid_from,valid_until:r.valid_until,evidence_reference:null,relationship_status:'effective' as const,evaluated_at:at,action_authorization:'not_evaluated' as const};
  return Object.freeze({core:{request:{contract_version:'core-resource-authority.v1',evaluation_time:at,resource,relationship:{relationship_id:r.ownership_id,relationship_version:r.ownership_version,
    relationship_kind:'ownership',required_scope_codes:['airprop.asset.read']},authority:authorityRequest},
   companion:{item_kind:'canonical_resource',source:{source_class:'official_workspace_record',source_reference:'urn:cladora:unit-spec:'+b.specification_id,source_workspace_id:current.workspace_id,source_context_id:current.context_id},
    canonical_reference:{contract_version:'canonical-resource-reference.v1',reference_status:'verified',tenant_id:current.tenant_id,workspace_id:current.workspace_id,resource_type:'unit',resource_id:b.unit_id,
     resource_version:b.resource_version,party_kind:null,display_name:r.resource_label,lifecycle_status:'active',evaluated_at:at,action_authorization:'not_evaluated'},relationship},authority},
   current_until:actual.current_until,source_versions:Object.freeze({specification_id:b.specification_id,resource_version:b.resource_version,party_version:r.party_version,relationship_version:r.ownership_version})});
 },
});}
