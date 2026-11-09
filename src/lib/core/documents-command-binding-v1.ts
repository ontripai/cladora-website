/** Official request-local Documents C01/C03 port; no custody-store/handle factory. */
import 'server-only';
import {z} from 'zod';
import type {Pool} from 'pg';
import {createCoreFunctionalCommandRuntimeV1,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {coreTransactionCommandV1Schema,type CoreTransactionHostV1,type CoreTransactionProvidersV1} from './postgres-transaction-host-v1';
import {createCoreDocumentsIntentReplayProvidersV1} from './documents-intent-replay-provider-v1';
import {isCoreDocumentsReplayProfileV1} from './documents-replay-only-v1';
export const CORE_DOCUMENTS_COMMAND_BINDING_V1='core-documents-command-binding.v1' as const;
const selection=z.strictObject({context_id:z.string().uuid(),workspace_id:z.string().uuid()});
export function createCoreDocumentsCommandBindingV1(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1}>){
 return Object.freeze({contract_version:CORE_DOCUMENTS_COMMAND_BINDING_V1,async bind(request:Request){
  if(request.signal.aborted)return null;
  const runtime=createCoreFunctionalCommandRuntimeV1({...options,request,offering:null,claim_alias_profile:'documents.v1'});
  await runtime.verifyServerSession();if(request.signal.aborted)return null;
  let bound:Readonly<z.infer<typeof selection>>|null=null,busy=false;
  function pin(v:unknown){const s=selection.parse(v);if(bound&&(s.context_id!==bound.context_id||s.workspace_id!==bound.workspace_id))throw Error('DOCUMENTS_SCOPE_MISMATCH');bound??=Object.freeze(s);return s;}
  async function run<T>(fn:()=>Promise<T>){if(busy||request.signal.aborted)throw Error('DOCUMENTS_REQUEST_UNAVAILABLE');busy=true;try{return await fn();}finally{busy=false;}}
  function parse(v:unknown,p:CoreTransactionProvidersV1){const c=coreTransactionCommandV1Schema.parse(v);if(!isCoreDocumentsReplayProfileV1(c,createCoreDocumentsIntentReplayProvidersV1(c,p)))throw Error('DOCUMENTS_PROFILE_MISMATCH');pin({context_id:c.context_id,workspace_id:c.workspace_id});return c;}
  return Object.freeze({
   resolveIdentity(v:unknown){return run(()=>runtime.resolveCommandIdentity({...pin(v),permission_code:'documents.vault.upload',module_code:'documents'}));},
   host:Object.freeze({contract_version:'core-transaction-host.v1' as const,
    execute:((v:unknown,p:CoreTransactionProvidersV1)=>run(()=>runtime.host.execute(parse(v,p),createCoreDocumentsIntentReplayProvidersV1(parse(v,p),p)))) as CoreTransactionHostV1['execute']}),
   replayHost:Object.freeze({contract_version:'core-transaction-host.v1' as const,
    // Deliberately no fresh fallback. Suitable for adapter.issue recovery only;
    // the Documents adapter mints an exact_replay handle, never this port.
    execute:((v:unknown,p:CoreTransactionProvidersV1)=>run(()=>runtime.executeDocumentsReplayOnly(parse(v,p),createCoreDocumentsIntentReplayProvidersV1(parse(v,p),p)))) as CoreTransactionHostV1['execute']}),
  });
 }});
}
