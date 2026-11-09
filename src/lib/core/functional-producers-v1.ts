import {createCoreServiceOfferingReviseSourcePortV1} from './service-offering-revise-source-port-v1';
/** Actual same-scope Core producers. No alternate authority, store or transport. */
import {randomUUID} from 'node:crypto';
import {canonicalResourceReferenceV1InputSchema,canonicalResourceReferenceV1Schema,
 type CanonicalResourceReferenceV1Input} from './resource-contracts-v1';
import {createCoreS01AuthorityCaptureV1,createCoreS01ProviderAgreementReaderV1,createCoreS01AuthoringAgreementReaderV2} from './service-s01/provider-agreement-reader-v1';
import {createCoreS01OfferingDisclosurePolicyV1,CORE_S01_OFFERING_SOURCE_PIN,
 type CoreS01ServiceOfferingBindingV1} from './service-s01/offering-disclosure-policy-v1';
import {projectServiceOfferingDisclosureSourceV1,createServiceOfferingDisclosureCanDiscloseV1,
 serviceOfferingDisclosureBindingV1Schema} from '../customer/service-offering-disclosure-source-v1';
import {bindCanonicalCurrentAuthorityObservationV1} from './current-authority-transaction-port-v1';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
export const CORE_FUNCTIONAL_PRODUCERS_V1='core-functional-producers.v1' as const;
export const CORE_FUNCTIONAL_DW02_SQL='select customer_api.resolve_canonical_resource_reference_v1($1::uuid,$2::uuid,$3::text,$4::uuid,$5::integer,$6::text,$7::text) as reference';
export function createCoreFunctionalProducersV1(offeringValue:CoreS01ServiceOfferingBindingV1|null,family:'request'|'authoring'|'revise'='request'){
 const binding=offeringValue===null?null:Object.freeze(serviceOfferingDisclosureBindingV1Schema.parse(offeringValue));
 const capture=createCoreS01AuthorityCaptureV1();
 const revise=family==='revise'?createCoreServiceOfferingReviseSourcePortV1():null;
 const authorityRequestFor=(scope:CoreTransactionScopeV1)=>({...capture.authorityRequestFor(scope),
  decision_id:randomUUID(),evaluation_purpose:'service.create_request'});
 // This is a REQUEST only. S01 and the real SERVICE projector both re-evaluate
 // it via the canonical provider in this same live read/mutation scope; no
 // preflight decision is relabelled as a command-authority receipt.
 const policy=createCoreS01OfferingDisclosurePolicyV1(binding===null?null:{pin:CORE_S01_OFFERING_SOURCE_PIN,binding,
  projectServiceOfferingDisclosureSourceV1,createServiceOfferingDisclosureCanDiscloseV1,authorityRequestFor});
 const reader=family==='authoring'?createCoreS01AuthoringAgreementReaderV2({source:{contract:'core-provider-agreement-store.v1',date_policy:'utc_start_inclusive_end_exclusive.operational.v1'},authorityRequestFor:scope=>capture.authorityRequestFor(scope)}):createCoreS01ProviderAgreementReaderV1({source:binding===null?null:{contract:'core-provider-agreement-store.v1',
  date_policy:'utc_start_inclusive_end_exclusive.operational.v1'},authorityRequestFor,offeringPolicy:policy});
 return Object.freeze({resolveAuthority:revise?.resolveAuthority??capture.resolveAuthority,readers:Object.freeze({...(revise?{readCurrentOfferingRevisionForAuthoringV1:revise.readCurrentOfferingRevisionForAuthoringV1}:{}),resolveProviderAgreement:revise?.resolveProviderAgreement??reader,
  async resolveCanonicalResource(scope:CoreTransactionScopeV1,value:CanonicalResourceReferenceV1Input){
   const input=canonicalResourceReferenceV1InputSchema.parse(value),request=authorityRequestFor(scope);
   if(input.context_id!==request.context_id||input.workspace_id!==scope.workspace_id
    ||input.permission_code!==request.permission_code||input.resource_type!=='unit')throw new Error('canonical_resource_scope_denied');
   const before=bindCanonicalCurrentAuthorityObservationV1(request,await capture.resolveAuthority(scope,request));
   if(before.decision!=='allowed')throw new Error('canonical_resource_scope_denied');
   const identity={...scope},rows=await scope.query(CORE_FUNCTIONAL_DW02_SQL,[input.context_id,input.workspace_id,input.resource_type,
    input.resource_id,input.resource_version,input.permission_code,input.purpose]);
   if(rows.rowCount!==1||rows.rows.length!==1)throw new Error('canonical_resource_source_unavailable');
   const answer=canonicalResourceReferenceV1Schema.parse(rows.rows[0].reference);
   const after=bindCanonicalCurrentAuthorityObservationV1(request,await capture.resolveAuthority(scope,request));
   if(after.decision!=='allowed'||Object.keys(identity).some(key=>scope[key as keyof typeof scope]!==identity[key as keyof typeof scope]))throw new Error('canonical_resource_scope_denied');
   if(answer.reference_status!=='withheld'&&(answer.tenant_id!==scope.tenant_id||answer.workspace_id!==scope.workspace_id
    ||answer.resource_id!==input.resource_id||answer.resource_type!=='unit'))throw new Error('canonical_resource_source_unavailable');
   // Existing DW02 owns real Unit/version/mandate/disclosure. No invented ID,
   // label, revision=timestamp fallback, party, representation or permission.
   return answer;
  },
 })});
}
