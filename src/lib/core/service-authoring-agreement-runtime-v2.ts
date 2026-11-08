/** Explicit server-owned authoring/Quote composition. Default Request untouched. */
import 'server-only';
import type {Pool} from 'pg';
import {createCoreFunctionalCommandRuntimeV1,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {coreTransactionCommandV2Schema,type CoreTransactionProvidersV2} from './postgres-transaction-host-v1';
export const CORE_SERVICE_AUTHORING_AGREEMENT_RUNTIME_V2='core-service-authoring-agreement-runtime.v2' as const;
export const CORE_SERVICE_AUTHORING_AGREEMENT_RUNTIME_BINDING=null;
function buildAuthoringRuntime(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1;request:Request}>){
 const runtime=createCoreFunctionalCommandRuntimeV1({...options,offering:null,agreement_family:'authoring'});
 let selected:Readonly<{context_id:string;workspace_id:string}>|null=null,busy=false;
 return Object.freeze({contract_version:CORE_SERVICE_AUTHORING_AGREEMENT_RUNTIME_V2,readers:runtime.readers,
  host:Object.freeze({contract_version:'core-transaction-host.v1' as const,async execute(value:unknown,providers:CoreTransactionProvidersV2){
   if(options.request.signal.aborted||busy)throw Error('authoring_request_unavailable');
   const c=coreTransactionCommandV2Schema.parse(value);
   const offering=c.module_code==='services_catalog'&&c.aggregate_type==='service_offering'
    &&((c.permission_code==='services.catalog.manage'&&['service.create_offering','service.transition_offering'].includes(c.evaluation_purpose))
      ||(c.permission_code==='services.catalog.publish'&&c.evaluation_purpose==='service.transition_offering'));
   const quote=c.module_code==='services_orders'&&c.permission_code==='services.quotes.manage'&&c.evaluation_purpose==='service.create_quote'&&c.aggregate_type==='service_quote';
   if(!offering&&!quote)throw Error('authoring_command_profile_mismatch');
   if(selected&&(selected.context_id!==c.context_id||selected.workspace_id!==c.workspace_id))throw Error('authoring_request_scope_mismatch');
   selected??=Object.freeze({context_id:c.context_id,workspace_id:c.workspace_id});busy=true;
   try{return await runtime.host.execute(c,providers);}finally{busy=false;}
  }}),
 });
}

/** The actual SERVICE resolver and its source.bind(request) must share the same
 * canonical capture. Request identity is server-local, never a request header.
 * This caches a composition, not an allow/session/receipt. Every execute/replay
 * still reauthenticates and creates its own live C03 scope/attempt.
 */
const compositions=new WeakMap<Request,{pool:Pool;target:string;value:ReturnType<typeof buildAuthoringRuntime>}>();
export function createCoreServiceAuthoringAgreementRuntimeV2(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1;request:Request}>){
 const target=JSON.stringify(Object.fromEntries(Object.entries(options.target).sort(([a],[b])=>a.localeCompare(b))));
 const old=compositions.get(options.request);
 if(old){if(old.pool!==options.pool||old.target!==target)throw Error('authoring_request_target_mismatch');return old.value;}
 const value=buildAuthoringRuntime(options);compositions.set(options.request,{pool:options.pool,target,value});return value;
}
