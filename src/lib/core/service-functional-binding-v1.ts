/** Core producer for the exact Service09 request-local binding. No owner file copied. */
import 'server-only';
import {createCoreFunctionalCommandRuntimeV1,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import type {Pool} from 'pg';
import type {CoreTransactionProvidersV1,CoreTransactionProvidersV2,CoreTransactionResultV1,CoreTransactionResultV2} from './postgres-transaction-host-v1';
import {serviceOfferingRequestPreflightInputV1Schema,type ServiceOfferingRequestPreflightInputV1} from '../customer/service-offering-request-flow-contract';
import {serviceOfferingRequestSnapshotV1Schema,type ServiceOfferingRequestFlowPortsV1} from '../customer/service-v14-execution/application-flow';
import type {CoreS01ServiceOfferingBindingV1} from './service-s01/offering-disclosure-policy-v1';
export const CORE15_SERVICE_REQUEST_RUNTIME_V1='core15-service-request-runtime.v1' as const;
export function createCoreServiceFunctionalBindingV1(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1}>){
 return Object.freeze({contract_version:'service-functional-request-runtime.v1' as const,
  core_contract:CORE15_SERVICE_REQUEST_RUNTIME_V1,database_contract:'platform12-service-request-database.v1' as const,
  async bind(request:Request):Promise<ServiceOfferingRequestFlowPortsV1|null>{
   if(request.signal.aborted)return null;
   const discovery=createCoreFunctionalCommandRuntimeV1({...options,offering:null,request});
   await discovery.verifyServerSession();
   let selected:ServiceOfferingRequestPreflightInputV1|null=null;
   let active:ReturnType<typeof createCoreFunctionalCommandRuntimeV1>|null=null;
   let lastClock:string|undefined,busy=false;
   const ensure=()=>{if(request.signal.aborted)throw new Error('service_request_aborted');};
   const scoped=async<T>(operation:()=>Promise<T>)=>{ensure();if(busy)throw new Error('service_request_concurrent_port');busy=true;try{return await operation();}finally{busy=false;}};
   function selection(){if(selected===null)throw new Error('service_request_source_not_loaded');return selected;}
   function runtime(){if(active===null)throw new Error('service_request_source_not_loaded');return active;}
   const same=(input:{context_id:string;workspace_id:string;offering_id:string})=>{
    const s=selection();if(input.context_id!==s.context_id||input.workspace_id!==s.workspace_id||input.offering_id!==s.offering_id)throw new Error('service_request_scope_mismatch');return s;
   };
   function execute(command:unknown,providers:CoreTransactionProvidersV1):Promise<CoreTransactionResultV1>;
   function execute(command:unknown,providers:CoreTransactionProvidersV2):Promise<CoreTransactionResultV2>;
   function execute(command:unknown,providers:CoreTransactionProvidersV1|CoreTransactionProvidersV2):Promise<CoreTransactionResultV1|CoreTransactionResultV2>{
    return scoped(async()=>{const host=runtime().host;return 'provider_code' in providers
     ?host.execute(command,providers as CoreTransactionProvidersV2):host.execute(command,providers as CoreTransactionProvidersV1);});
   }
   const ports:ServiceOfferingRequestFlowPortsV1={
    loadOffering(input){return scoped(async()=>{
     const parsed=serviceOfferingRequestPreflightInputV1Schema.parse(input);
     if(selected)same(parsed);
     // Never parse/consume the HTTP body again; Service09 already validated it.
     // Explicit caller selection is compared against REAL authorized DB snapshot.
     const output=await discovery.withRequestScope({context_id:parsed.context_id,workspace_id:parsed.workspace_id,offering_id:parsed.offering_id},(_scope,p)=>p.loadOffering(parsed));
     lastClock=output.completed_at;
     const snapshot=serviceOfferingRequestSnapshotV1Schema.nullable().parse(output.value);
     if(snapshot===null){active=null;return null;}
     if(snapshot.published_revision_id!==parsed.published_revision_id||snapshot.offering_id!==parsed.offering_id
      ||snapshot.workspace_id!==parsed.workspace_id)throw new Error('service_request_source_mismatch');
     selected=Object.freeze({...parsed});
     const offering:CoreS01ServiceOfferingBindingV1={contract_version:'service-offering-disclosure-source.v1',
      context_id:parsed.context_id,workspace_id:parsed.workspace_id,offering_id:snapshot.offering_id,offering_version:snapshot.offering_version,
      published_revision_id:snapshot.published_revision_id,published_revision_version:snapshot.published_revision_version,
      provider_party_id:snapshot.provider_party_id,provider_agreement_id:snapshot.provider_agreement_id,
      provider_agreement_version:snapshot.provider_agreement_version,requested_service_scope:'service.request.create',permission_code:'services.orders.request'};
     active=createCoreFunctionalCommandRuntimeV1({...options,offering,request});return snapshot;
    });},
    resolvePrincipal(input){return scoped(async()=>{const s=same(input),r=runtime();const output=await r.withRequestScope(
     {context_id:s.context_id,workspace_id:s.workspace_id,offering_id:s.offering_id},(_scope,p)=>p.resolvePrincipal(input));lastClock=output.completed_at;return output.value;});},
    resolveProviderAgreement(input){return scoped(async()=>{const s=selection();if(input.context_id!==s.context_id||input.workspace_id!==s.workspace_id)throw new Error('service_request_scope_mismatch');
     const output=await runtime().withRequestScope({context_id:s.context_id,workspace_id:s.workspace_id,offering_id:s.offering_id},(_scope,p)=>p.resolveProviderAgreement(input));
     lastClock=output.completed_at;return output.value;});},
    resolveCanonicalResource(input){return scoped(async()=>{const s=selection(),r=runtime();if(input.context_id!==s.context_id||input.workspace_id!==s.workspace_id)throw new Error('service_request_scope_mismatch');
     const output=await r.withRequestScope({context_id:s.context_id,workspace_id:s.workspace_id,offering_id:s.offering_id},scope=>r.readers.resolveCanonicalResource(scope,input));lastClock=output.completed_at;return output.value;});},
    transactionalReaders:{resolveProviderAgreement(scope,input){return runtime().readers.resolveProviderAgreement(scope,input);},
     resolveCanonicalResource(scope,input){return runtime().readers.resolveCanonicalResource(scope,input);}},
    host:{execute},
    now(){if(lastClock===undefined)throw new Error('service_request_server_clock_unavailable');return lastClock;},
   };
   return Object.freeze(ports);
  },
 });
}
