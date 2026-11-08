/** Core C01/C03 server port only. AIRPROP owns its actual domain providers. */
import 'server-only';
import {z} from 'zod';
import type {Pool} from 'pg';
import {createCoreFunctionalCommandRuntimeV1,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {coreTransactionCommandV1Schema,coreTransactionCommandV2Schema,type CoreTransactionProvidersV1,type CoreTransactionProvidersV2,type CoreTransactionHostV1} from './postgres-transaction-host-v1';
const selection=z.strictObject({context_id:z.string().uuid(),workspace_id:z.string().uuid()});
export const CORE_LISTING_COMMAND_BINDING_V1='core-listing-command-binding.v1' as const;
export const CORE_LISTING_COMMAND_PROFILE_V1=Object.freeze({permission:'airprop.opportunity.manage',module:'airprop_commercial',purpose:'airprop.b2',aal:'aal2'});
export function createCoreListingCommandBindingV1(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1}>){
 return Object.freeze({contract_version:CORE_LISTING_COMMAND_BINDING_V1,async bind(request:Request){
  if(request.signal.aborted)return null;
  const runtime=createCoreFunctionalCommandRuntimeV1({...options,offering:null,request});
  await runtime.verifyServerSession();if(request.signal.aborted)return null;
  let original:Readonly<{context_id:string;workspace_id:string}>|null=null,busy=false;
  const scope=(value:unknown)=>{const s=selection.parse(value);
   if(original&&(original.context_id!==s.context_id||original.workspace_id!==s.workspace_id))throw new Error('listing_request_scope_mismatch');
   original??=Object.freeze(s);return s;};
  const run=async<T>(fn:()=>Promise<T>)=>{if(request.signal.aborted||busy)throw new Error('listing_request_unavailable');busy=true;try{return await fn();}finally{busy=false;}};
  const execute:CoreTransactionHostV1['execute']=((value:unknown,providers:CoreTransactionProvidersV1|CoreTransactionProvidersV2)=>run(async()=>{
    const c=(value as {contract_version?:unknown})?.contract_version==='core-transaction-command.v1'?coreTransactionCommandV1Schema.parse(value):coreTransactionCommandV2Schema.parse(value);
    if(c.permission_code!=='airprop.opportunity.manage'||c.module_code!=='airprop_commercial'||c.evaluation_purpose!=='airprop.b2')throw new Error('listing_command_profile_mismatch');
    scope({context_id:c.context_id,workspace_id:c.workspace_id});
    return c.contract_version==='core-transaction-command.v1'?runtime.host.execute(c,providers as CoreTransactionProvidersV1):runtime.host.execute(c,providers as CoreTransactionProvidersV2);
  })) as CoreTransactionHostV1['execute'];
  return Object.freeze({
   resolveIdentity(value:unknown){return run(async()=>{
    const s=scope(value),identity=await runtime.resolveCommandIdentity({...s,permission_code:'airprop.opportunity.manage',module_code:'airprop_commercial'});
    if(request.signal.aborted)throw new Error('listing_request_unavailable');return identity;
   });},
   host:Object.freeze({contract_version:'core-transaction-host.v1' as const,execute}),
  });
 }});
}
