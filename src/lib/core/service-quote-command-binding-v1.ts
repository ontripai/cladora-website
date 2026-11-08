/** Request-local Quote identity/C03 transport. SERVICE owns domain providers. */
import 'server-only';
import {z} from 'zod';
import type {Pool} from 'pg';
import {createCoreFunctionalCommandRuntimeV1,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {coreTransactionCommandV2Schema,type CoreTransactionProvidersV2} from './postgres-transaction-host-v1';
const selection=z.strictObject({context_id:z.string().uuid(),workspace_id:z.string().uuid()});
export const CORE_SERVICE_QUOTE_COMMAND_BINDING_V1='core-service-quote-command-binding.v1' as const;
/** Identity is preparation data, not an allow. The same canonical C03 host
 * rechecks the actual command and authority after waits and during replay. */
export function createCoreServiceQuoteCommandBindingV1(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1}>){
 return Object.freeze({contract_version:CORE_SERVICE_QUOTE_COMMAND_BINDING_V1,async bind(request:Request){
  if(request.signal.aborted)return null;
  const runtime=createCoreFunctionalCommandRuntimeV1({...options,offering:null,request});
  await runtime.verifyServerSession();if(request.signal.aborted)return null;
  let original:Readonly<{context_id:string;workspace_id:string}>|null=null,busy=false;
  const scope=(value:unknown)=>{const s=selection.parse(value);
   if(original&&(original.context_id!==s.context_id||original.workspace_id!==s.workspace_id))throw new Error('quote_request_scope_mismatch');
   original??=Object.freeze(s);return s;};
  const run=async<T>(fn:()=>Promise<T>)=>{if(request.signal.aborted||busy)throw new Error('quote_request_unavailable');busy=true;try{return await fn();}finally{busy=false;}};
  return Object.freeze({
   resolveIdentity(value:unknown){return run(async()=>{
    const s=scope(value),identity=await runtime.resolveCommandIdentity({...s,permission_code:'services.quotes.manage',module_code:'services_orders'});
    if(request.signal.aborted)throw new Error('quote_request_unavailable');
    // Explicit structural adapter to SERVICE's accepted identity literal. No
    // actor/profile/epoch/time is accepted from the request or substituted.
    return Object.freeze({...identity,contract_version:'service-quote-command-identity.v1' as const});
   });},
   host:Object.freeze({contract_version:'core-transaction-host.v1' as const,execute(value:unknown,providers:CoreTransactionProvidersV2){return run(async()=>{
    const c=coreTransactionCommandV2Schema.parse(value);
    if(c.permission_code!=='services.quotes.manage'||c.module_code!=='services_orders'||c.evaluation_purpose!=='service.create_quote'||c.aggregate_type!=='service_quote')throw new Error('quote_command_profile_mismatch');
    scope({context_id:c.context_id,workspace_id:c.workspace_id});
    return runtime.host.execute(c,providers);
   });}}),
  });
 }});
}
