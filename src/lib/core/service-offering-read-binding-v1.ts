/** Independent optional Offering-management read, on existing C01 transport. */
import 'server-only';
import {z} from 'zod';
import type {Pool} from 'pg';
import type {NextRequest} from 'next/server';
import {createCoreFunctionalCommandRuntimeV1,CoreFunctionalRuntimeUnavailableV1,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {serviceOfferingRevisionSchema} from '../customer/service-catalog-schema';
export class CoreOfferingReadDeniedV1 extends Error{readonly code='42501';constructor(){super('offering_read_access_denied');this.name='CoreOfferingReadDeniedV1';}}
export const CORE_OFFERING_READ_BINDING_V1='core-offering-read-binding.v1' as const;
const selected=z.strictObject({context_id:z.string().uuid(),workspace_id:z.string().uuid()});
// Exact canonical RPC fields only: active/version are not returned by this RPC.
const definitions=z.array(z.strictObject({definition_id:z.string().uuid(),code:z.string(),labels:serviceOfferingRevisionSchema.shape.labels}));
export function createCoreServiceOfferingReadBindingV1(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1}>){
 return Object.freeze({contract_version:CORE_OFFERING_READ_BINDING_V1,async bind(request:NextRequest){
  if(request.signal.aborted)return null;
  const runtime=createCoreFunctionalCommandRuntimeV1({...options,offering:null,request});
  await runtime.verifyServerSession();if(request.signal.aborted)return null;
  let busy=false;
  return Object.freeze({async readDefinitions(value:unknown){
   const selection=selected.parse(value);
   if(request.signal.aborted||busy)throw new Error('offering_read_request_unavailable');busy=true;
   try{const result=await runtime.readServiceApp('definitions',selection);
    if(request.signal.aborted)throw new Error('offering_read_request_unavailable');
    return definitions.parse(result.value);
   }catch(error){if(error instanceof CoreFunctionalRuntimeUnavailableV1&&['SCOPE_DENIED','READ_SCOPE_DENIED'].includes(error.code))throw new CoreOfferingReadDeniedV1();throw error;}finally{busy=false;}
  }});
 }});
}
