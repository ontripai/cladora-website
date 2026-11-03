/** Fixed private composition of the actual owner factory. No caller callback/module. */
import {createHash,randomUUID} from 'node:crypto';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import type {CoreCe012TerminalBindingV1} from './ce012-terminal-authority-port-v1';
export const CORE_DOCS_JOINT_CANDIDATE_V1='core-documents-joint-candidate.v1' as const;
export const CORE_DOCS_JOINT_RUNTIME_BINDING=null;
export const CORE_DOCS_JOINT_SOURCE='6f69db12455b9c750eae0c2a24c7a7c7faa16d3d';
interface OwnerPort {
 observe():Promise<{documents_status:string;observation:object|null}>;
 inspectPrivate(token:object):{status:string;private_projection?:{target:{document_id:string;document_version_id:string;document_version:number};safe_label:string;reusable_as_command_authority:boolean}};
 close():void;
}
export interface CoreDocumentsJointOwnerModuleV1 {DOCUMENTS_CE012_TARGET_DISCLOSURE_PORT_V1:string;createDocumentsCe012TargetDisclosurePortV1(scope:CoreTransactionScopeV1,input:unknown):OwnerPort;}
export async function observeCoreDocumentsJointCandidateV1(scope:CoreTransactionScopeV1,input:unknown,binding:CoreCe012TerminalBindingV1){
 // Fixed path, no configurable import/registry. The file is supplied by the
 // separately pinned owner assembly, NOT fabricated/copied into this branch.
 const owner:CoreDocumentsJointOwnerModuleV1=await import('../customer/documents-ce012-target-disclosure-port-v1');
 if(owner.DOCUMENTS_CE012_TARGET_DISCLOSURE_PORT_V1!=='documents-ce012-target-disclosure-port.v1'
   ||typeof owner.createDocumentsCe012TargetDisclosurePortV1!=='function')throw new Error('core_docs_joint_export_unavailable');
 const port=owner.createDocumentsCe012TargetDisclosurePortV1(scope,input);
 let held=false;
 try{
  const actual=await port.observe();
  if(actual.documents_status!=='observed'||!actual.observation)throw new Error('core_docs_joint_candidate_unavailable');
  const token=actual.observation,privateValue=port.inspectPrivate(token),projection=privateValue.private_projection;
  const target=binding.target;
  if(privateValue.status!=='private_candidate_not_ready'||!projection||projection.safe_label!=='Document reference'
    ||projection.reusable_as_command_authority!==false||projection.target.document_id!==target.document_id
    ||projection.target.document_version_id!==target.document_version_id||projection.target.document_version!==target.document_version)throw new Error('core_docs_joint_target_mismatch');
  // Creator is the real, fixed imported factory; inspection recognizes its own
  // WeakMap token. Expected scope/command/receipt were checked by its real Core10
  // calls; no caller JSON identity/allowed flag can register this record.
  const descriptor=Object.freeze({contract:CORE_DOCS_JOINT_CANDIDATE_V1,source:CORE_DOCS_JOINT_SOURCE,
   candidate_id:randomUUID(),binding_sha256:createHash('sha256').update(JSON.stringify(binding)).digest('hex'),target:Object.freeze({...target})});
  held=true;
  return Object.freeze({token,descriptor,
   // These functions close over ONLY the actual owner instance, never caller code.
   intact(){const x=port.inspectPrivate(token);return x.status==='private_candidate_not_ready'&&x.private_projection===projection;},
   close(){port.close();},
  });
 }finally{if(!held)port.close();}
}
export type CoreDocumentsJointCandidateV1=Awaited<ReturnType<typeof observeCoreDocumentsJointCandidateV1>>;
