/** Fixed Core-owned source composition for the exact SERVICE5ead revise contract. */
import 'server-only';
import {z} from 'zod';
import {createCoreS01AuthorityCaptureV1,createCoreS01AuthoringAgreementReaderV2} from './service-s01/provider-agreement-reader-v1';
import {readCurrentOfferingRevisionForAuthoringV1} from './service-offering-revision-source-v1';
import {readCoreScopedServerClockV1} from './scoped-server-clock-v1';
import type{CoreTransactionScopeV1}from'./postgres-transaction-host-v1';
export const CORE_SERVICE_REVISE_SOURCE_PORT_V1='core-service-revise-source-port.v1' as const;
export const CORE_SERVICE_REVISE_SOURCE_RUNTIME_BINDING=null;
export const CORE_SERVICE_REVISE_OPERATION_ADMISSION=null;
const uuid=z.string().uuid(),version=z.number().int().positive().safe();
// Only fields needed for source binding. SERVICE validates its full command/body.
const input=z.object({contract_version:z.literal('service-offering-revise-contract.v1'),actor_id:uuid,authority_version:version,transaction_id:uuid,command_id:uuid,context_id:uuid,workspace_id:uuid,
 offering_id:uuid,old_revision_id:uuid,expected_offering_lock_version:version,expected_old_revision_version:version,
 provider_party_id:uuid,provider_agreement:z.strictObject({agreement_id:uuid,agreement_version:version})});
const fail=(code:string):never=>{throw Object.assign(Error('SERVICE_REVISE_SOURCE_UNAVAILABLE'),{code});};
export const CORE_SERVICE_REVISE_FRESH_SQL_V1=Object.freeze({
 session:'select app_private.require_request_session_current_at_v1($1::timestamptz)',
 context:`select r.workspace_id::text,r.tenant_id::text,r.membership_id::text,
 auth.jwt()->>'active_membership_id' as bound_membership_id
 from app_private.resolve_workspace_native_context_v2_at_v1($1::uuid,$2::uuid,$3::timestamptz) r`,
 permission:`select app_private.check_workspace_native_permission_v2_at_v1($1::uuid,$2::uuid,'services.catalog.manage','services_catalog',$3::timestamptz) as allowed,
 (select revision::text from app_private.canonical_authority_revision_v1 where singleton) as revision`,
});
/** No caller clock, provider/allow callback or writer injection. Every source
 * invocation requires an official allowed C01 capture for this exact live scope.
 * Integrate via Core's explicit 'revise' family, never relabel Request/Quote.
 */
export function createCoreServiceOfferingReviseSourcePortV1(){
 const capture=createCoreS01AuthorityCaptureV1();
 // Original source identity metadata only, never a reusable current allow.
 const originalSources=new WeakMap<CoreTransactionScopeV1,string>();
 const agreement=createCoreS01AuthoringAgreementReaderV2({source:{contract:'core-provider-agreement-store.v1',date_policy:'utc_start_inclusive_end_exclusive.operational.v1'},authorityRequestFor:scope=>capture.authorityRequestFor(scope)});
 return Object.freeze({contract_version:CORE_SERVICE_REVISE_SOURCE_PORT_V1,resolveAuthority:capture.resolveAuthority,resolveProviderAgreement:agreement,
 async readCurrentOfferingRevisionForAuthoringV1(scope:CoreTransactionScopeV1,value:unknown){
  originalSources.delete(scope);
  const c=input.parse(value),request=capture.authorityRequestFor(scope);
  if(c.actor_id!==scope.actor_id||c.transaction_id!==scope.transaction_id||c.workspace_id!==scope.workspace_id
   ||c.actor_id!==request.actor_id||c.context_id!==request.context_id||c.workspace_id!==request.workspace_id||c.authority_version!==request.authority_version
   ||request.transaction_context.command_id!==c.command_id||request.transaction_context.lock.aggregate_id!==c.offering_id
   ||request.permission_code!=='services.catalog.manage'||request.module_code!=='services_catalog'||request.evaluation_purpose!=='service.revise_offering')fail('42501');
  const found=await readCurrentOfferingRevisionForAuthoringV1(scope,{context_id:c.context_id,workspace_id:c.workspace_id,offering_id:c.offering_id,old_revision_id:c.old_revision_id,
   expected_offering_lock_version:c.expected_offering_lock_version,expected_revision_version:c.expected_old_revision_version,provider_party_id:c.provider_party_id,
   provider_agreement_id:c.provider_agreement.agreement_id,provider_agreement_version:c.provider_agreement.agreement_version},request);
  if(found.source_status!=='matched_private'||!found.source)return fail('55000');
  const row=found.source;
  if(row.revision.status!=='draft'&&row.revision.status!=='submitted')return fail('23505');
  const verified=await agreement(scope,{contract_version:'provider-agreement-verification.v1',context_id:c.context_id,workspace_id:c.workspace_id,
   provider_agreement_id:c.provider_agreement.agreement_id,provider_agreement_version:c.provider_agreement.agreement_version,permission_code:'services.catalog.manage',requested_service_scope:['service.offering.revise']});
  if(verified.agreement_status!=='effective'||verified.provider_party_id!==c.provider_party_id)fail('42501');
  // After all source/S01 waits, sample actual DB time and invoke the accepted
  // entire fresh-time chain. Neither the historical command nor its hash changes.
  const at=await readCoreScopedServerClockV1(scope);
  await scope.query(CORE_SERVICE_REVISE_FRESH_SQL_V1.session,[at]);
  const current=await scope.query(CORE_SERVICE_REVISE_FRESH_SQL_V1.context,[c.context_id,c.workspace_id,at]);
  const bound=z.strictObject({workspace_id:uuid,tenant_id:uuid,membership_id:uuid,bound_membership_id:uuid}).parse(current.rows[0]);
  if(current.rowCount!==1||bound.workspace_id!==scope.workspace_id||bound.tenant_id!==scope.tenant_id||bound.membership_id!==bound.bound_membership_id)fail('42501');
  const permission=await scope.query(CORE_SERVICE_REVISE_FRESH_SQL_V1.permission,[c.context_id,c.workspace_id,at]);
  if(permission.rowCount!==1||permission.rows[0]?.allowed!==true||String(permission.rows[0]?.revision)!==String(c.authority_version))fail('42501');
  originalSources.set(scope,JSON.stringify(c));
  return Object.freeze({contract_version:'service-offering-revise-source.v1' as const,tenant_id:scope.tenant_id,workspace_id:scope.workspace_id,
   offering_id:c.offering_id,old_revision_id:c.old_revision_id,offering_lock_version:row.head.lock_version,old_revision_version:row.revision.revision_version,
   provider_party_id:c.provider_party_id,provider_agreement:Object.freeze({...c.provider_agreement}),status:row.revision.status,
   observed_after_wait_at:at,source_current:true as const});
 },
 /** Bind to the same official runtime capture. Invoke AFTER a relevant writer
  * wait, not as a stale preflight. No old-head lookup: a successful revise
  * has advanced it. Later waits require renewal; this is not a settlement receipt.
  */
 async requireCurrentAgreementAfterWriterWaitV1(scope:CoreTransactionScopeV1,value:unknown):Promise<void>{
  const c=input.parse(value),request=capture.authorityRequestFor(scope);
  if(c.actor_id!==scope.actor_id||c.transaction_id!==scope.transaction_id||c.workspace_id!==scope.workspace_id
   ||c.actor_id!==request.actor_id||c.context_id!==request.context_id||c.workspace_id!==request.workspace_id||c.authority_version!==request.authority_version
   ||request.transaction_context.command_id!==c.command_id||request.transaction_context.lock.aggregate_id!==c.offering_id
   ||request.permission_code!=='services.catalog.manage'||request.module_code!=='services_catalog'||request.evaluation_purpose!=='service.revise_offering')fail('42501');
  if(originalSources.get(scope)!==JSON.stringify(c))fail('42501');
  // The existing canonical S01 reader owns session/current authority, party /
  // Workspace / head / immutable version locks, final DB clock, UTC dates and
  // precise source binding. Never accept caller time, allow or a cached result.
  const current=await agreement(scope,{contract_version:'provider-agreement-verification.v1',context_id:c.context_id,workspace_id:c.workspace_id,
   provider_agreement_id:c.provider_agreement.agreement_id,provider_agreement_version:c.provider_agreement.agreement_version,
   permission_code:'services.catalog.manage',requested_service_scope:['service.offering.revise']});
  if(current.agreement_status!=='effective'||current.tenant_id!==scope.tenant_id||current.workspace_id!==scope.workspace_id
   ||current.provider_party_id!==c.provider_party_id||current.provider_agreement_id!==c.provider_agreement.agreement_id
   ||current.provider_agreement_version!==c.provider_agreement.agreement_version||current.allowed_service_scope.length!==1
   ||current.allowed_service_scope[0]!=='service.offering.revise')fail('42501');
 },
 });
}
