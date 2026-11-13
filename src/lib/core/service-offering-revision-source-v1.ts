/** Core-owned private source candidate. No revise writer, runtime or public projection. */
import 'server-only';
import {z} from 'zod';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import {currentAuthorityTransactionRequestV1Schema} from './current-authority-transaction-port-v1';
import {observeCoreServiceOriginalCurrentBoundaryV1} from './service-original-current-boundary-v1';
import {serviceOfferingRevisionSchema} from '../customer/service-catalog-schema';
import {serviceOfferingCoverageSchema,serviceEligibilityPolicySchema} from '../customer/service-offering-v14-schema';
import {parseServiceOfferingInstantMicrosV1} from '../customer/service-offering-time-precision-v1';
export const CORE_SERVICE_OFFERING_REVISION_SOURCE_V1='core-service-offering-revision-source.v1' as const;
export const CORE_SERVICE_OFFERING_REVISION_SOURCE_RUNTIME_BINDING=null;
const uuid=z.string().uuid(),v=z.number().int().positive().safe(),dbv=z.coerce.number().int().positive().safe(),stamp=z.iso.datetime({offset:true});
export const coreServiceOfferingRevisionExpectedV1Schema=z.strictObject({context_id:uuid,workspace_id:uuid,offering_id:uuid,old_revision_id:uuid,
 expected_offering_lock_version:v,expected_revision_version:v,provider_party_id:uuid,provider_agreement_id:uuid,provider_agreement_version:v});
export const CORE_SERVICE_REVISION_SOURCE_SQL_V1=Object.freeze({
 head:`select id::text,tenant_id::text,workspace_id::text,definition_id::text,provider_party_id::text,lock_version::text,current_revision_id::text,published_revision_id::text
 from service_catalog.offerings where tenant_id=$1::uuid and workspace_id=$2::uuid and id=$3::uuid for share`,
 revision:`select id::text,tenant_id::text,workspace_id::text,offering_id::text,revision_version::text,provider_agreement_id::text,provider_agreement_version::text,
 status,commercial_terms,coverage,eligibility,to_char(valid_from at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as valid_from,
 case when valid_until is null then null else to_char(valid_until at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as valid_until
 from service_catalog.revisions where tenant_id=$1::uuid and workspace_id=$2::uuid and offering_id=$3::uuid and id=$4::uuid for share`,
});
const head=z.strictObject({id:uuid,tenant_id:uuid,workspace_id:uuid,definition_id:uuid,provider_party_id:uuid,lock_version:dbv,current_revision_id:uuid,published_revision_id:uuid.nullable()});
const revision=z.strictObject({id:uuid,tenant_id:uuid,workspace_id:uuid,offering_id:uuid,revision_version:dbv,provider_agreement_id:uuid,provider_agreement_version:dbv,
 status:z.enum(['draft','submitted','published','suspended','archived']),commercial_terms:serviceOfferingRevisionSchema,coverage:serviceOfferingCoverageSchema,
 eligibility:serviceEligibilityPolicySchema,valid_from:stamp,valid_until:stamp.nullable()});
const closed=(reason:string)=>Object.freeze({contract_version:CORE_SERVICE_OFFERING_REVISION_SOURCE_V1,status:'not_ready' as const,source_status:'unavailable' as const,
 reason,source:null,projection:null,action_authorization:'not_evaluated' as const,dispatch_admitted:false as const});
/** Expected identity is a comparison target only. All content comes from locked
 * canonical rows, and authorization is renewed after the final source wait.
 * There is deliberately no mutation or host-execute method in this export.
 */
export async function readCurrentOfferingRevisionForAuthoringV1(scope:CoreTransactionScopeV1,expectedValue:unknown,requestValue:unknown){
 const expected=coreServiceOfferingRevisionExpectedV1Schema.parse(expectedValue),request=currentAuthorityTransactionRequestV1Schema.parse(requestValue);
 if(request.context_id!==expected.context_id||request.workspace_id!==expected.workspace_id||request.permission_code!=='services.catalog.manage'
  ||request.module_code!=='services_catalog'||request.evaluation_purpose!=='service.revise_offering'||request.transaction_context.lock.aggregate_id!==expected.offering_id)throw Error('SERVICE_REVISION_SCOPE_MISMATCH');
 const before=await observeCoreServiceOriginalCurrentBoundaryV1(scope,request);
 if(before.status!=='aligned')return closed(before.code);
 const h=await scope.query(CORE_SERVICE_REVISION_SOURCE_SQL_V1.head,[scope.tenant_id,scope.workspace_id,expected.offering_id]);
 if(h.rowCount!==1||h.rows.length!==1){const final=await observeCoreServiceOriginalCurrentBoundaryV1(scope,request);return closed(final.status==='aligned'?'SOURCE_ABSENT_OR_AMBIGUOUS':final.code);}
 const parsedHead=head.safeParse(h.rows[0]);
 if(!parsedHead.success){await observeCoreServiceOriginalCurrentBoundaryV1(scope,request);return closed('SOURCE_MALFORMED_OR_UNVERSIONED');}
 const hs=parsedHead.data;
 const r=await scope.query(CORE_SERVICE_REVISION_SOURCE_SQL_V1.revision,[scope.tenant_id,scope.workspace_id,expected.offering_id,expected.old_revision_id]);
 // Even a missing/malformed/mismatching source is not used to skip final authority.
 const after=await observeCoreServiceOriginalCurrentBoundaryV1(scope,request);
 if(after.status!=='aligned'||!after.evaluated_at)return closed(after.code);
 if(r.rowCount!==1||r.rows.length!==1)return closed('SOURCE_ABSENT_OR_AMBIGUOUS');
 const parsedRevision=revision.safeParse(r.rows[0]);
 if(!parsedRevision.success)return closed('SOURCE_MALFORMED_OR_UNVERSIONED');
 const rs=parsedRevision.data;
 if(hs.tenant_id!==scope.tenant_id||rs.tenant_id!==scope.tenant_id||hs.workspace_id!==scope.workspace_id||rs.workspace_id!==scope.workspace_id
  ||hs.id!==expected.offering_id||rs.offering_id!==hs.id||hs.current_revision_id!==expected.old_revision_id||rs.id!==expected.old_revision_id
  ||hs.lock_version!==expected.expected_offering_lock_version||rs.revision_version!==expected.expected_revision_version
  ||hs.provider_party_id!==expected.provider_party_id||rs.provider_agreement_id!==expected.provider_agreement_id||rs.provider_agreement_version!==expected.provider_agreement_version)return closed('SOURCE_BINDING_DRIFT');
 // Revise authoring: source_current is the exact current draft/submitted head,
 // not availability of its OLD commercial terms. Other read/publish ports do not use this path.
 if(!['draft','submitted'].includes(rs.status)
  ||parseServiceOfferingInstantMicrosV1(rs.valid_from)!==parseServiceOfferingInstantMicrosV1(rs.commercial_terms.valid_from)
  ||(rs.valid_until===null)!==(rs.commercial_terms.valid_until===null)
  ||(rs.valid_until!==null&&parseServiceOfferingInstantMicrosV1(rs.valid_until)!==parseServiceOfferingInstantMicrosV1(rs.commercial_terms.valid_until!)))return closed('SOURCE_STATUS_OR_CONTENT_INVALID');
 return Object.freeze({...closed('SERVICE_REVISE_PLAN_WRITER_HOST_ABI_REQUIRED'),source_status:'matched_private' as const,
  source:structuredClone({head:hs,revision:rs,checked_at:after.evaluated_at}),provider_agreement_verification:'not_evaluated' as const,reusable_as_authority:false as const});
}
