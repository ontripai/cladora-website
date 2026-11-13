/** Canonical prepared-plan custody. No receipt/handle reconstructed from JSON. */
import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Pool} from 'pg';
import {coreTransactionCommandV1Schema,type CoreTransactionHostV1} from './postgres-transaction-host-v1';
import {getPublicSupabaseEnv} from '../supabase/env';
import {createCoreFunctionalRequestAuthV1} from './functional-request-auth-v1';
import {createCoreDocumentsCommandBindingV1} from './documents-command-binding-v1';
import type {CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
import {createDocumentsCanonicalUploadAckAdapterV1,type DocumentsCanonicalUploadIntentPlanV1,type DocumentsCanonicalUploadFinalizationPlanV1} from '../customer/documents-canonical-upload-ack-adapter-v1';
import {documentsUploadIntentRequestV1Schema,documentsUploadFinalizationRequestV1Schema,documentsUploadRequestSnapshotV1,serializeDocumentsUploadSnapshotV1} from '../customer/documents-upload-snapshot-v1';
import {documentsNewDocumentIntentV1Schema,documentsInitialVersionV1Schema,buildDocumentsNewDocumentIntentCommandV1,type DocumentsStoredObjectVerifierV1} from '../customer/documents-workspace-binding-writer-v1';
export const CORE_DOCUMENTS_UPLOAD_CUSTODY_V1='core-documents-upload-custody.v1' as const;
export const CORE_DOCUMENTS_UPLOAD_CUSTODY_RUNTIME_BINDING=null;
type Adapter=ReturnType<typeof createDocumentsCanonicalUploadAckAdapterV1>;
type Issued=Extract<Awaited<ReturnType<Adapter['issue']>>,{status:'ACK'}>;
const uuid=z.string().uuid(),revision=z.coerce.number().int().positive().safe();
const stored=z.object({tenant_id:uuid,workspace_id:uuid,context_id:uuid,membership_id:uuid,actor_id:uuid,issue_key:z.string(),request_sha256:z.string(),snapshot:z.unknown(),
 intent_id:uuid,document_id:uuid,version_id:uuid,issue_transaction_id:uuid,issue_command_id:uuid,final_transaction_id:uuid,final_command_id:uuid,
 authority_version:revision,issue_input:documentsNewDocumentIntentV1Schema,command_wire:z.string().nullable(),final_key:z.string().nullable(),final_command_wire:z.string().nullable(),
 phase:z.enum(['prepared','sealed','retained','stream_admitted']),fresh_stream:z.boolean(),fresh_dispatch:z.boolean(),database_oid:z.number().int(),database_name:z.string(),backend_marker:z.string()});
type Stored=z.infer<typeof stored>;
const digest=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
// Cache contains ONLY actual minted handles, never evidence of durable admission.
// Cold process/restart has no fresh stream handle: exact replay recovery only.
// Eviction loses optimization, never changes durable custody or safe hold.
const freshHandles=new WeakMap<Pool,Map<string,{issued:Issued;wire:string;actor:string;signal:AbortSignal}>>();
export async function createCoreDocumentsUploadCustodyV1(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1;request:Request;verifyStoredObject:DocumentsStoredObjectVerifierV1}>){
 const binding=await createCoreDocumentsCommandBindingV1(options).bind(options.request);if(!binding)return null;
 const env=getPublicSupabaseEnv();if(new URL(env.url).origin!==new URL(options.target.auth_origin).origin)throw Error('DOCUMENTS_TARGET_AUTH_MISMATCH');
 const client=await createCoreFunctionalRequestAuthV1(options.request,options.target.auth_origin,env.publishableKey);
 const localMinted=new WeakMap<object,string>();
 const cacheKey=(intent:string)=>digest(JSON.stringify([options.target.backend_id,options.target.database_oid,options.target.database_name,options.target.runtime_role,options.target.auth_origin]))+':'+intent;
 const cache=freshHandles.get(options.pool)??new Map();freshHandles.set(options.pool,cache);
 const remembered=new Map<string,{intent_id:string;request_sha256:string}>();
 const remember=(r:Stored)=>remembered.set(r.document_id,{intent_id:r.intent_id,request_sha256:r.request_sha256});
 const issueOutcomes=new Map<string,string>();
 const issueHost:CoreTransactionHostV1={...binding.host,execute:(async(v:unknown,p:Parameters<CoreTransactionHostV1['execute']>[1])=>{const c=coreTransactionCommandV1Schema.parse(v);
  if(c.evaluation_purpose==='documents.workspace_upload.finalize'){
   const original=remembered.get(c.aggregate_id);if(!original)throw Error('DOCUMENTS_FINAL_ORIGINAL_CUSTODY_MISSING');
   const sealed=await rpc('seal_final',{...original,context_id:c.context_id,workspace_id:c.workspace_id,idempotency_key:c.idempotency_key,command_wire:JSON.stringify(c)});
   if(!sealed||sealed.final_command_wire!==JSON.stringify(c))throw Error('DOCUMENTS_FINAL_WIRE_MISMATCH');
  }
  const r=await binding.host.execute(c,p);if(r.status==='committed'||r.status==='exact_replay')issueOutcomes.set(r.receipt.command_id,r.status);return r;}) as CoreTransactionHostV1['execute']};
 const actual=createDocumentsCanonicalUploadAckAdapterV1({host:issueHost,sessionClient:client,verifyStoredObject:options.verifyStoredObject});
 const recoverHost:CoreTransactionHostV1={execute:((v:unknown,p:Parameters<CoreTransactionHostV1['execute']>[1])=>{
  const command=coreTransactionCommandV1Schema.parse(v);
  if(command.evaluation_purpose==='documents.workspace_upload.intent')return binding.replayHost.execute(command,p);
  if(command.evaluation_purpose==='documents.workspace_upload.finalize')return issueHost.execute(command,p);
  throw Error('DOCUMENTS_RECOVERY_PROFILE_MISMATCH');
 }) as CoreTransactionHostV1['execute']};
 const replay=createDocumentsCanonicalUploadAckAdapterV1({host:recoverHost,sessionClient:client,verifyStoredObject:options.verifyStoredObject});
 let fixedSelection:string|null=null;
 async function rpc(phase:'prepare'|'seal'|'dispatch'|'retain'|'seal_final'|'peek'|'claim'|'resume',request:Record<string,unknown>){
  if(options.request.signal.aborted)throw Error('DOCUMENTS_REQUEST_ABORTED');
  const selection=JSON.stringify([request.context_id,request.workspace_id]);if(fixedSelection!==null&&selection!==fixedSelection)throw Error('DOCUMENTS_SCOPE_MISMATCH');fixedSelection=selection;
  const {data,error}=await client.schema('platform_dev').rpc('document_upload_custody_v1',{p_phase:phase,p_request:request}).abortSignal(AbortSignal.any([options.request.signal,AbortSignal.timeout(15000)]));
  if(error)throw error; // preserve exact40001; no retry/alternate transport.
  if(options.request.signal.aborted)throw Error('DOCUMENTS_REQUEST_ABORTED');if(data===null)return null;
  const row=stored.parse(data);
  if(row.database_oid!==options.target.database_oid||row.database_name!==options.target.database_name||row.backend_marker!==options.target.backend_id
   ||row.context_id!==request.context_id||row.workspace_id!==request.workspace_id||row.request_sha256!==request.request_sha256)throw Error('DOCUMENTS_CUSTODY_TARGET_OR_SCOPE_MISMATCH');
  return row;
 }
 function initial(r:Stored):DocumentsCanonicalUploadIntentPlanV1{return Object.freeze({input:r.issue_input,context:Object.freeze({transaction_id:r.issue_transaction_id,command_id:r.issue_command_id,authority_version:r.authority_version}),snapshot:documentsUploadRequestSnapshotV1(documentsUploadIntentRequestV1Schema.parse({...r.snapshot as object,idempotency_key:r.issue_key,request_sha256:r.request_sha256}))});}
 function final(r:Stored):DocumentsCanonicalUploadFinalizationPlanV1|null{if(!r.final_key)return null;const s=documentsUploadIntentRequestV1Schema.parse({...r.snapshot as object,idempotency_key:r.issue_key,request_sha256:r.request_sha256});return Object.freeze({input:documentsInitialVersionV1Schema.parse({contract_version:'documents-initial-version.v1',context_id:r.context_id,workspace_id:r.workspace_id,intent_id:r.intent_id,document_id:r.document_id,version_id:r.version_id,title:s.title,document_type:s.document_type,classification:s.classification,idempotency_key:r.final_key}),context:Object.freeze({transaction_id:r.final_transaction_id,command_id:r.final_command_id,authority_version:r.authority_version})});}
 const adapter=Object.freeze({async issue(raw:unknown,plan:DocumentsCanonicalUploadIntentPlanV1){
  const req=documentsUploadIntentRequestV1Schema.parse(raw);
  const admitted=await rpc('dispatch',{context_id:req.context_id,workspace_id:req.workspace_id,idempotency_key:req.idempotency_key,request_sha256:req.request_sha256});
  if(!admitted||JSON.stringify(initial(admitted))!==JSON.stringify(plan))return Object.freeze({status:'UNKNOWN' as const,ack:null});
  // Admission is durable BEFORE dispatch. An UNKNOWN/second attempt may only
  // read/replay this same command; no receipt -> hold, never fresh fallback.
  const result=await(admitted.fresh_dispatch?actual:replay).issue(raw,plan);
  if(result.status==='ACK')localMinted.set(result,JSON.stringify(plan));return result;
 }});
 return Object.freeze({contract_version:CORE_DOCUMENTS_UPLOAD_CUSTODY_V1,adapter,
  custody:Object.freeze({
   async prepareIntent(raw:unknown){const req=documentsUploadIntentRequestV1Schema.parse(raw),snapshot=documentsUploadRequestSnapshotV1(req),wire=serializeDocumentsUploadSnapshotV1(snapshot);if(digest(wire)!==req.request_sha256||snapshot.property_id!==null)return null;
    const r=await rpc('prepare',{context_id:req.context_id,workspace_id:req.workspace_id,idempotency_key:req.idempotency_key,request_sha256:req.request_sha256,snapshot,snapshot_wire:wire});if(!r)return null;
    remember(r);const plan=initial(r),cmd=buildDocumentsNewDocumentIntentCommandV1(plan.input,{...plan.context,actor_id:r.actor_id});
    const sealed=await rpc('seal',{context_id:req.context_id,workspace_id:req.workspace_id,idempotency_key:req.idempotency_key,request_sha256:req.request_sha256,command_wire:JSON.stringify(cmd),intent_input_wire:JSON.stringify(plan.input)});
    if(!sealed||sealed.command_wire!==JSON.stringify(cmd))return null;return initial(sealed);
   },
   async retainIssued(raw:unknown,plan:DocumentsCanonicalUploadIntentPlanV1,issued:Issued){const req=documentsUploadIntentRequestV1Schema.parse(raw);if(localMinted.get(issued)!==JSON.stringify(plan))throw Error('DOCUMENTS_HANDLE_NOT_MINTED');
    if(issueOutcomes.get(plan.context.command_id)==='committed'){const wire=JSON.stringify(buildDocumentsNewDocumentIntentCommandV1(plan.input,{...plan.context,actor_id:issued.ack.actor_id}));cache.set(cacheKey(plan.input.intent_id),{issued,wire,actor:issued.ack.actor_id,signal:options.request.signal});if(cache.size>256)cache.delete(cache.keys().next().value!);}
    const r=await rpc('retain',{context_id:req.context_id,workspace_id:req.workspace_id,idempotency_key:req.idempotency_key,request_sha256:req.request_sha256});if(!r||r.phase!=='retained'||issued.ack.intent_id!==r.intent_id||issued.ack.actor_id!==r.actor_id)throw Error('DOCUMENTS_RETAIN_UNKNOWN');

   },
   async takeFreshUpload(raw:unknown){const req=documentsUploadFinalizationRequestV1Schema.parse(raw),r=await rpc('peek',{context_id:req.context_id,workspace_id:req.workspace_id,intent_id:req.intent_id,idempotency_key:req.idempotency_key,request_sha256:req.request_sha256});if(!r)return null;
    const handle=cache.get(cacheKey(r.intent_id));if(!handle||handle.signal.aborted||handle.wire!==r.command_wire||handle.actor!==r.actor_id)return null;
    const claimed=await rpc('claim',{context_id:req.context_id,workspace_id:req.workspace_id,intent_id:req.intent_id,idempotency_key:req.idempotency_key,request_sha256:req.request_sha256});
    if(!claimed?.fresh_stream)return null;cache.delete(cacheKey(r.intent_id));const plan=final(claimed);return plan?Object.freeze({issued:handle.issued,finalization:plan}):null;
   },
   async resumeFinalization(raw:unknown){const req=documentsUploadFinalizationRequestV1Schema.parse(raw),r=await rpc('resume',{context_id:req.context_id,workspace_id:req.workspace_id,intent_id:req.intent_id,idempotency_key:req.idempotency_key,request_sha256:req.request_sha256});if(!r||r.final_key!==req.idempotency_key)return null;
    remember(r);const plan=initial(r),issued=await replay.issue({...plan.snapshot,idempotency_key:r.issue_key,request_sha256:r.request_sha256},plan),finalization=final(r);
    if(issued.status!=='ACK'||!finalization)return null;return Object.freeze({issued,finalization});
   },
  }),
 });
}
