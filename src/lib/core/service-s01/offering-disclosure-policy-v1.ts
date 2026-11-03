import {z} from 'zod';
import {uuidSchema} from '../../customer/workspace-composition-schema.ts';
import type {CoreTransactionScopeV1} from '../postgres-transaction-host-v1.ts';
import type {ProviderAgreementVerificationV1Input} from '../resource-contracts-v1.ts';
import type {CurrentAuthorityTransactionRequestV1} from '../current-authority-transaction-port-v1.ts';
import {CoreS01UnavailableV1} from './errors-v1.ts';

export const CORE_S01_OFFERING_SOURCE_PIN=Object.freeze({
  commit:'f4e03100c6145c8fcac7f105eb5da4c30a37abb8',
  git_blob:'89e771414eb3193fb93d2df6c2178a95ffa48b6f',
  sha256:'f8667b1d69809d3880e477c5cd7b875db27cf7dd5a78a2fcd0feec796d06bf5b',
  path:'src/lib/customer/service-offering-disclosure-source-v1.ts',
  contract:'service-offering-disclosure-source.v1',
  bytes:18347,
  transitive_helper_path:'src/lib/customer/service-offering-time-precision-v1.ts',
  transitive_helper_contract:'service-offering-time-precision.v1',
  transitive_helper_bytes:2332,
  transitive_helper_git_blob:'bd758c5f53cb26dbc266f54672cef979549ccc8f',
  transitive_helper_sha256:'a14d38abb83b15a39d82d928e1e8e03fbce9939b195cbfea3883aeaa5ed851a2',
});
export const CORE_S01_OFFERING_SOURCE_BINDING=null;
const version=z.number().int().positive().safe();
const stamp=z.iso.datetime({offset:true});
const bindingSchema=z.strictObject({
  contract_version:z.literal('service-offering-disclosure-source.v1'),context_id:uuidSchema,workspace_id:uuidSchema,
  offering_id:uuidSchema,offering_version:version,published_revision_id:uuidSchema,published_revision_version:version,
  provider_party_id:uuidSchema,provider_agreement_id:uuidSchema,provider_agreement_version:version,
  requested_service_scope:z.literal('service.request.create'),permission_code:z.literal('services.orders.request'),
});
export type CoreS01ServiceOfferingBindingV1=z.infer<typeof bindingSchema>;
const disclosedSchema=z.strictObject({
  status:z.literal('disclosed'),contract_version:z.literal('service-offering-disclosure-source.v1'),tenant_id:uuidSchema,
  workspace_id:uuidSchema,offering_id:uuidSchema,offering_version:version,published_revision_id:uuidSchema,
  published_revision_version:version,provider_party_id:uuidSchema,provider_agreement_id:uuidSchema,provider_agreement_version:version,
  requested_service_scope:z.literal('service.request.create'),acquisition_mode:z.enum(['direct','pre_quote','on_site','project']),
  coverage_kind:z.literal('workspace'),revision_status:z.literal('published'),valid_from:stamp,valid_until:stamp.nullable(),
  availability:z.literal('available'),evaluated_at:stamp,agreement_verification:z.literal('not_evaluated'),action_authorization:z.literal('not_evaluated'),
});
export type CoreS01DisclosureDecisionV1={status:'withhold'}|{status:'disclose';provider_party_id:string;offering_id:string;revision_id:string;valid_from:string;valid_until:string|null};
export interface CoreS01OfferingDisclosurePolicyV1 {
  readAndCheck(scope:CoreTransactionScopeV1,input:ProviderAgreementVerificationV1Input):Promise<CoreS01DisclosureDecisionV1>;
}
export interface CoreS01ServiceOfferingSourceV1 {
  pin:typeof CORE_S01_OFFERING_SOURCE_PIN;
  binding:CoreS01ServiceOfferingBindingV1;
  projectServiceOfferingDisclosureSourceV1(scope:CoreTransactionScopeV1,input:ProviderAgreementVerificationV1Input,
    binding:CoreS01ServiceOfferingBindingV1,ports:{authorityRequestFor(scope:CoreTransactionScopeV1,input:ProviderAgreementVerificationV1Input):CurrentAuthorityTransactionRequestV1}):Promise<unknown>;
  createServiceOfferingDisclosureCanDiscloseV1(binding:CoreS01ServiceOfferingBindingV1,
    ports:{authorityRequestFor(scope:CoreTransactionScopeV1,input:ProviderAgreementVerificationV1Input):CurrentAuthorityTransactionRequestV1}):
    (scope:CoreTransactionScopeV1,input:ProviderAgreementVerificationV1Input)=>Promise<'disclose'|'withhold'>;
  authorityRequestFor(scope:CoreTransactionScopeV1,input:ProviderAgreementVerificationV1Input):CurrentAuthorityTransactionRequestV1;
}

/** Trusted server composition only. Module identity must be verified on admission;
 * a pin in a request is not code provenance. Reuses the actual SERVICE projector,
 * never queries its tables, selects an arbitrary Offering, or calls Core S01 again.
 */
export function createCoreS01OfferingDisclosurePolicyV1(source:CoreS01ServiceOfferingSourceV1|null=null):CoreS01OfferingDisclosurePolicyV1 {
  if(source===null)return{async readAndCheck(){throw new CoreS01UnavailableV1('SOURCE_NOT_READY');}};
  if(Object.entries(CORE_S01_OFFERING_SOURCE_PIN).some(([k,v])=>source.pin[k as keyof typeof source.pin]!==v)) {
    throw new CoreS01UnavailableV1('SOURCE_NOT_READY');
  }
  if(typeof source.projectServiceOfferingDisclosureSourceV1!=='function'||typeof source.createServiceOfferingDisclosureCanDiscloseV1!=='function'||typeof source.authorityRequestFor!=='function')throw new CoreS01UnavailableV1('SOURCE_NOT_READY');
  const binding=bindingSchema.parse(structuredClone(source.binding));Object.freeze(binding);
  const ports={authorityRequestFor:source.authorityRequestFor};
  const canDisclose=source.createServiceOfferingDisclosureCanDiscloseV1(binding,ports);
  return{async readAndCheck(scope,input){
    const identity={transaction_id:scope.transaction_id,database_transaction_id:scope.database_transaction_id,
      tenant_id:scope.tenant_id,workspace_id:scope.workspace_id,actor_id:scope.actor_id,attempt:scope.attempt};
    const raw=await source.projectServiceOfferingDisclosureSourceV1(scope,input,binding,ports);
    if(Object.entries(identity).some(([k,v])=>scope[k as keyof typeof identity]!==v))throw new CoreS01UnavailableV1('SOURCE_INVARIANT');
    if(typeof raw!=='object'||raw===null||!('status' in raw))throw new CoreS01UnavailableV1('SOURCE_UNAVAILABLE');
    if(raw.status==='not_ready')throw new CoreS01UnavailableV1('SOURCE_NOT_READY');
    if(raw.status==='withheld'||raw.status==='conflict')return{status:'withhold'};
    const result=disclosedSchema.safeParse(raw);
    if(!result.success)throw new CoreS01UnavailableV1('SOURCE_UNAVAILABLE');
    const value=result.data;
    if(binding.context_id!==input.context_id||binding.workspace_id!==input.workspace_id
      ||value.tenant_id!==scope.tenant_id||value.workspace_id!==scope.workspace_id
      ||value.provider_agreement_id!==input.provider_agreement_id||value.provider_agreement_version!==input.provider_agreement_version
      ||value.provider_party_id!==binding.provider_party_id||value.offering_id!==binding.offering_id
      ||value.offering_version!==binding.offering_version||value.published_revision_id!==binding.published_revision_id
      ||value.published_revision_version!==binding.published_revision_version||input.permission_code!=='services.orders.request'
      ||input.requested_service_scope.length!==1||input.requested_service_scope[0]!==value.requested_service_scope) return{status:'withhold'};
    // Actual SERVICE canDisclose is the final policy operation; errors propagate.
    if(await canDisclose(scope,input)!=='disclose')return{status:'withhold'};
    if(Object.entries(identity).some(([k,v])=>scope[k as keyof typeof identity]!==v))throw new CoreS01UnavailableV1('SOURCE_INVARIANT');
    return{status:'disclose',provider_party_id:value.provider_party_id,offering_id:value.offering_id,
      revision_id:value.published_revision_id,valid_from:value.valid_from,valid_until:value.valid_until};
  }};
}
