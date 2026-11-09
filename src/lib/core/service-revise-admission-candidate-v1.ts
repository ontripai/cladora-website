/** Inactive closed wire candidate. Valid shape is NOT authority or dispatch permission. */
import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {coreTransactionCommandV2Schema,type CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import {serviceOfferingRevisionSchema} from '../customer/service-catalog-schema';
export const CORE_SERVICE_REVISE_ADMISSION_CANDIDATE_V1='core-service-revise-admission-candidate.v1' as const;
export const CORE_SERVICE_REVISE_PERMIT=null;
export const CORE_SERVICE_REVISE_RUNTIME=null;
export const CORE_SERVICE_REVISE_QUERY_V1=Object.freeze({
 write:'select app_private.apply_service_offering_revision_v1($1::jsonb) as result',
 readback:'select app_private.read_service_offering_revision_result_v1($1::jsonb) as result',
});
const uuid=z.string().uuid(),version=z.number().int().positive().safe();
const agreement=z.strictObject({agreement_id:uuid,agreement_version:version});
// Exact owner wire shape only. Business terms use the EXISTING SERVICE schema.
const originalSchema=z.strictObject({contract_version:z.literal('service-offering-revise-contract.v1'),actor_id:uuid,authority_version:version,transaction_id:uuid,command_id:uuid,context_id:uuid,workspace_id:uuid,offering_id:uuid,old_revision_id:uuid,new_revision_id:uuid,expected_offering_lock_version:version,expected_old_revision_version:version,new_revision_version:version,provider_party_id:uuid,provider_agreement:agreement,revision:serviceOfferingRevisionSchema,idempotency_key:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/)});
const sourceSchema=z.strictObject({contract_version:z.literal('service-offering-revise-source.v1'),tenant_id:uuid,workspace_id:uuid,offering_id:uuid,old_revision_id:uuid,offering_lock_version:version,old_revision_version:version,provider_party_id:uuid,provider_agreement:agreement,status:z.enum(['draft','submitted']),observed_after_wait_at:z.iso.datetime({offset:true}),source_current:z.literal(true)});
const planSchema=z.strictObject({contract_version:z.literal('service-offering-revise-contract.v1'),operation:z.literal('revise_offering'),permission_code:z.literal('services.catalog.manage'),module_code:z.literal('services_catalog'),evaluation_purpose:z.literal('service.revise_offering'),command:originalSchema,source:sourceSchema,input_fingerprint:z.string().regex(/^sha256:[a-f0-9]{64}$/)});
const readSchema=z.strictObject({contract_version:z.literal('service-offering-revise-writer-request.v1'),tenant_id:uuid,command:originalSchema,input_fingerprint:z.string().regex(/^sha256:[a-f0-9]{64}$/)});
const resultSchema=z.strictObject({contract_version:z.literal('service-offering-revise-writer-result.v1'),mutation_id:uuid,offering_id:uuid,offering_lock_version:version,revision_id:uuid,revision_version:version});
const scopeSchema=z.strictObject({transaction_id:uuid,database_transaction_id:z.string().regex(/^[1-9][0-9]*$/),workspace_id:uuid,tenant_id:uuid,actor_id:uuid,attempt:version});
function canonical(value:unknown):string{if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;if(value!==null&&typeof value==='object')return`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')}}`;return JSON.stringify(value);}
function deny():never{throw Object.assign(Error('SERVICE_REVISE_QUERY_CANDIDATE_MISMATCH'),{code:'55000'});}
function identity(scope:CoreTransactionScopeV1){return scopeSchema.parse({transaction_id:scope.transaction_id,database_transaction_id:scope.database_transaction_id,workspace_id:scope.workspace_id,tenant_id:scope.tenant_id,actor_id:scope.actor_id,attempt:scope.attempt});}
/** Trusted-server review capability only. Never accepts caller SQL/allow/clock,
 * performs a query, installs a profile, or enables an existing host. The supplied
 * scope must independently be the official live C03 scope; shape cannot prove it.
 */
export function createCoreServiceReviseQueryCandidateV1(options:Readonly<{scope:CoreTransactionScopeV1;original_command:unknown;core_command:unknown;provider_code:'service_offering_revise';phase:'mutation'|'replay'}>){
 if(options.provider_code!=='service_offering_revise'||!['mutation','replay'].includes(options.phase))deny();
 const scope=options.scope,scopeQuery=scope.query;
 const c=structuredClone(originalSchema.parse(options.original_command)),core=coreTransactionCommandV2Schema.parse(options.core_command),bound=identity(options.scope),phase=options.phase;
 const fingerprint='sha256:'+createHash('sha256').update('service-offering-revise-contract.v1\0').update(canonical(c)).digest('hex');
 if(c.old_revision_id===c.new_revision_id||c.new_revision_version!==c.expected_old_revision_version+1||c.expected_offering_lock_version>=Number.MAX_SAFE_INTEGER||c.expected_old_revision_version>=Number.MAX_SAFE_INTEGER)deny();
 const expected={contract_version:'core-transaction-command.v2',transaction_id:c.transaction_id,command_id:c.command_id,context_id:c.context_id,workspace_id:c.workspace_id,actor_id:c.actor_id,authority_version:c.authority_version,permission_code:'services.catalog.manage',module_code:'services_catalog',evaluation_purpose:'service.revise_offering',aggregate_type:'service_offering',aggregate_id:c.offering_id,aggregate_version:c.expected_offering_lock_version+1,provider_source_ids:[c.old_revision_id,c.provider_agreement.agreement_id].sort(),idempotency_key:c.idempotency_key,input_fingerprint:fingerprint,subject_reference:{kind:'service_offering_revision',id:c.old_revision_id,version:c.expected_old_revision_version,relation:'revision_source',request_version:c.expected_offering_lock_version+1}};
 if(canonical(core)!==canonical(expected)||bound.actor_id!==c.actor_id||bound.workspace_id!==c.workspace_id||bound.transaction_id!==c.transaction_id)deny();
 const checkLive=()=>{if(options.scope!==scope||scope.query!==scopeQuery||canonical(identity(scope))!==canonical(bound))deny();};
 return Object.freeze({contract:CORE_SERVICE_REVISE_ADMISSION_CANDIDATE_V1,permit:null,runtime:null,
  assertQuery(sql:unknown,args:unknown){checkLive();if(typeof sql!=='string'||!Array.isArray(args)||args.length!==1||typeof args[0]!=='string')deny();
   if(sql!==CORE_SERVICE_REVISE_QUERY_V1.write&&sql!==CORE_SERVICE_REVISE_QUERY_V1.readback)deny();
   if((phase==='mutation')!==(sql===CORE_SERVICE_REVISE_QUERY_V1.write))deny();
   const value:unknown=JSON.parse(args[0]);
   if(phase==='replay'){const request=readSchema.parse(value);if(request.tenant_id!==bound.tenant_id||request.input_fingerprint!==fingerprint||canonical(request.command)!==canonical(c))deny();}
   else{const plan=planSchema.parse(value),s=plan.source;
    if(plan.input_fingerprint!==fingerprint||canonical(plan.command)!==canonical(c)||s.tenant_id!==bound.tenant_id||s.workspace_id!==bound.workspace_id||s.offering_id!==c.offering_id||s.old_revision_id!==c.old_revision_id||s.offering_lock_version!==c.expected_offering_lock_version||s.old_revision_version!==c.expected_old_revision_version||s.provider_party_id!==c.provider_party_id||canonical(s.provider_agreement)!==canonical(c.provider_agreement))deny();
   }
   return Object.freeze({phase,operation:'revise_offering' as const,permission_evaluated:false as const,dispatch_permitted:false as const});
  },
  assertResult(value:unknown){checkLive();const wire=z.object({rowCount:z.literal(1),rows:z.tuple([z.strictObject({result:phase==='replay'?resultSchema.nullable():resultSchema})])}).parse(value),result=wire.rows[0].result;
   if(result===null)return null;
   if(result.mutation_id!==c.command_id||result.offering_id!==c.offering_id||result.offering_lock_version!==c.expected_offering_lock_version+1||result.revision_id!==c.new_revision_id||result.revision_version!==c.new_revision_version)deny();return Object.freeze(result);
  },
 });
}
