import {z} from 'zod';
import {maintenanceUuidSchema as maintenanceUuid,completeWorkOrderSchema,verifyWorkOrderSchema} from './maintenance-schema';
import {maintenanceTemplateFor} from './maintenance-defaults';

const uuid=maintenanceUuid.refine(value=>value===value.toLowerCase(),'canonical_uuid_required');
export const operationsSaveSchema=z.strictObject({action:z.literal('save'),context_id:uuid,id:uuid,revision:z.number().int().min(0).max(2147483646),asset_id:uuid,vendor_id:uuid,name:z.string().trim().min(1).max(200),anchor:z.iso.date(),unit:z.enum(['days','weeks','months','years']),every:z.number().int().min(1).max(120),enabled:z.boolean(),checklist:z.array(z.string().trim().min(1).max(200)).max(50)}).superRefine((p,c)=>{
 const t=maintenanceTemplateFor(p.name);
 if((p.name.startsWith('CLADORA_PM_')&&!t)||(t&&JSON.stringify(p.checklist)!==JSON.stringify(t.steps.map(s=>s.code)))||(!t&&p.checklist.some(s=>s.startsWith('CLADORA_PM_'))))c.addIssue({code:'custom',message:'invalid_template'});
});
export const operationsGenerateSchema=z.strictObject({action:z.literal('generate'),context_id:uuid,plan_id:uuid,due_on:z.iso.date()});
const common={version:z.literal(1),context_id:uuid,target_id:uuid};
export const operationsIntentV1Schema=z.discriminatedUnion('action',[
 z.strictObject({...common,action:z.literal('save'),expected_status:z.null(),input:operationsSaveSchema}),
 z.strictObject({...common,action:z.literal('generate'),expected_status:z.null(),input:operationsGenerateSchema}),
 z.strictObject({...common,action:z.literal('issue'),expected_status:z.enum(['draft','scheduled']),input:z.strictObject({context_id:uuid})}),
 z.strictObject({...common,action:z.literal('start'),expected_status:z.enum(['assigned','blocked']),input:z.strictObject({context_id:uuid,notes:z.string().trim().max(1000).optional().nullable()})}),
 z.strictObject({...common,action:z.literal('complete'),expected_status:z.literal('in_progress'),input:completeWorkOrderSchema.extend({context_id:uuid,actual_cost:z.number().min(0).max(Number.MAX_SAFE_INTEGER).optional().nullable()}).strict()}),
 z.strictObject({...common,action:z.literal('verify'),expected_status:z.literal('completed'),input:verifyWorkOrderSchema.extend({context_id:uuid}).strict()}),
]).superRefine((p,c)=>{
 if(p.input.context_id!==p.context_id||(p.action==='save'&&p.target_id!==p.input.id)||(p.action==='generate'&&p.target_id!==p.input.plan_id))c.addIssue({code:'custom',message:'intent_binding'});
});
export const checklistNotesV2Schema=z.string().refine(v=>v===v.trim()&&Array.from(v).length>=10&&Array.from(v).length<=2000,'canonical_checklist_notes');
export const operationsChecklistIntentV2Schema=z.strictObject({version:z.literal(2),action:z.literal('record_checklist'),context_id:uuid,target_id:uuid,expected_status:z.literal('in_progress'),input:z.strictObject({context_id:uuid,item_id:uuid,notes:checklistNotesV2Schema})}).superRefine((p,c)=>{
 if(p.input.context_id!==p.context_id)c.addIssue({code:'custom',message:'intent_binding'});
});
export const operationsIntentSchema=z.union([operationsIntentV1Schema,operationsChecklistIntentV2Schema]);
export type OperationsIntent=z.infer<typeof operationsIntentSchema>;
export const operationsEnvelopeSchema=z.strictObject({key:uuid,wire:z.string().max(24000),fingerprint:z.string().regex(/^[0-9a-f]{64}$/)});
export type OperationsEnvelope=z.infer<typeof operationsEnvelopeSchema>;
export const operationsReceiptV1Schema=z.strictObject({contract_version:z.literal('operations-command-receipt.v1'),key:uuid,context_id:uuid,workspace_id:uuid,actor_id:uuid,membership_id:uuid,authority_revision:z.number().int().positive().safe(),request_hash:z.string().regex(/^[0-9a-f]{64}$/),action:z.enum(['save','generate','issue','start','complete','verify']),target_id:uuid,fingerprint:z.string().regex(/^[0-9a-f]{64}$/),outcome:z.enum(['committed','rejected']),result:z.record(z.string(),z.unknown()).nullable(),error_code:z.enum(['22023','40001','42501','P0002']).nullable(),audit_event_id:z.string().regex(/^[1-9][0-9]*$/).nullable(),outbox_event_id:uuid.nullable(),recorded_at:z.iso.datetime({offset:true})}).superRefine((p,c)=>{
 if(p.outcome==='committed'?(!p.result||p.error_code!==null||p.audit_event_id===null||p.outbox_event_id===null):(p.result!==null||p.error_code===null||p.audit_event_id!==null||p.outbox_event_id!==null))c.addIssue({code:'custom',message:'receipt_outcome'});
});
export const operationsChecklistResultV2Schema=z.strictObject({work_order_id:uuid,item_id:uuid,completed:z.literal(true),completed_at:z.iso.datetime({offset:true}),notes:checklistNotesV2Schema,already_recorded:z.boolean()});
export const workOrderChecklistReadV2Schema=z.strictObject({work_order_id:uuid,status:z.enum(['draft','scheduled','assigned','in_progress','blocked','completed','verified','cancelled']),items:z.array(z.strictObject({id:uuid,label:z.string().min(1),required:z.boolean(),completed:z.boolean(),completed_at:z.iso.datetime({offset:true}).nullable(),notes:z.string().nullable()}))}).superRefine((v,c)=>{
 if(new Set(v.items.map(i=>i.id)).size!==v.items.length)c.addIssue({code:'custom',message:'duplicate_checklist_item'});
 for(const i of v.items)if(i.completed&&(i.completed_at===null||i.notes===null||Array.from(i.notes).length<10))c.addIssue({code:'custom',message:'unproven_checklist_completion'});
});
export const operationsChecklistReceiptV2Schema=z.strictObject({...operationsReceiptV1Schema.shape,contract_version:z.literal('operations-command-receipt.v2'),action:z.literal('record_checklist'),result:operationsChecklistResultV2Schema.nullable()}).superRefine((p,c)=>{
 if(p.outcome==='committed'?(!p.result||p.error_code!==null||p.audit_event_id===null||p.outbox_event_id===null):(p.result!==null||p.error_code===null||p.audit_event_id!==null||p.outbox_event_id!==null))c.addIssue({code:'custom',message:'receipt_outcome'});
});
export const operationsReceiptSchema=z.union([operationsReceiptV1Schema,operationsChecklistReceiptV2Schema]);
export type OperationsReceipt=z.infer<typeof operationsReceiptSchema>;
export const operationsAnswerSchema=z.strictObject({version:z.union([z.literal(1),z.literal(2)]),actor_id:uuid,context_id:uuid,state:z.enum(['clear','pending','committed','rejected','absent','acknowledged']),command:operationsEnvelopeSchema.nullable(),receipt:operationsReceiptSchema.nullable()}).superRefine((p,c)=>{
 const valid=p.state==='clear'?p.command===null&&p.receipt===null:p.state==='pending'||p.state==='absent'?p.command!==null&&p.receipt===null:p.command!==null&&p.receipt!==null&&(p.state==='acknowledged'||p.receipt.outcome===p.state);
 if(!valid)c.addIssue({code:'custom',message:'operations_answer_state'});
});
export function intentFromWire(wire:string):OperationsIntent{
 if(new TextEncoder().encode(wire).byteLength>24000)throw Error('operations_wire_limit');
 const raw:unknown=JSON.parse(wire);const p=operationsIntentSchema.parse(raw);
 // Zod transforms must never silently change dispatched intent.
 const normalized=(v:unknown):string=>{if(typeof v==='string'){if(v.includes('\0'))throw Error('operations_nul');for(let i=0;i<v.length;i++){const n=v.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const m=v.charCodeAt(++i);if(!(m>=0xdc00&&m<=0xdfff))throw Error('operations_unicode');}else if(n>=0xdc00&&n<=0xdfff)throw Error('operations_unicode');}return JSON.stringify(v);}if(Array.isArray(v))return '['+v.map(normalized).join(',')+']';if(v&&typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>normalized(k)+':'+normalized(x)).join(',')+'}';return JSON.stringify(v);};
 if(normalized(raw)!==normalized(p))throw Error('operations_noncanonical_input');
 return p;
}
export function receiptFor(envelope:OperationsEnvelope,actor:string,value:unknown){
 const r=operationsReceiptSchema.parse(value),p=intentFromWire(envelope.wire);
 if(r.actor_id!==actor||r.context_id!==p.context_id||r.key!==envelope.key||r.fingerprint!==envelope.fingerprint||r.action!==p.action||r.target_id!==p.target_id)throw Error('operations_receipt_binding');
 if(r.contract_version!==(p.version===2?'operations-command-receipt.v2':'operations-command-receipt.v1'))throw Error('operations_receipt_version');
 if(r.outcome==='committed'){
  if(p.action==='record_checklist'){
   const result=operationsChecklistResultV2Schema.parse(r.result);
   if(result.work_order_id!==p.target_id||result.item_id!==p.input.item_id||result.notes!==p.input.notes||Date.parse(result.completed_at)>Date.parse(r.recorded_at))throw Error('operations_checklist_receipt');
  }else if(p.action==='save'){
   const result=z.strictObject({id:uuid,revision:z.number().int().positive()}).parse(r.result);
   if(result.id!==p.target_id||result.revision!==p.input.revision+1)throw Error('operations_save_receipt');
  }else if(p.action==='generate'){
   z.union([z.strictObject({id:uuid,replayed:z.literal(true)}),z.strictObject({id:uuid,replayed:z.literal(false),status:z.literal('draft'),work_order_no:z.number().int().positive()})]).parse(r.result);
  }else{
   const event=z.iso.datetime({offset:true});
   const result=(p.action==='issue'?z.strictObject({id:uuid,status:z.literal('assigned'),vendor_id:uuid}):p.action==='start'?z.strictObject({id:uuid,status:z.literal('in_progress'),started_at:event}):p.action==='complete'?z.strictObject({id:uuid,status:z.literal('completed'),completed_at:event}):z.strictObject({id:uuid,status:z.literal('verified'),verified_at:event})).parse(r.result);
   if(result.id!==p.target_id)throw Error('operations_transition_receipt');
  }
 }
 return r;
}

// Only OPEN may discover a command in another currently authorized Context.
// Every command-bearing answer stays bound to that command's original Context.
export function boundOperationsAnswer(value:unknown,phase:string,requestedContext:string,actor?:string){
 const answer=operationsAnswerSchema.parse(value);
 if(actor&&answer.actor_id!==actor)throw Error('operations_answer_actor');
 if(answer.command){
  const intent=intentFromWire(answer.command.wire);
  if(intent.context_id!==answer.context_id||intent.version!==answer.version)throw Error('operations_answer_command_context_or_version');
  if(answer.receipt)receiptFor(answer.command,answer.actor_id,answer.receipt);
 }
 if(answer.context_id!==requestedContext&&(phase!=='open'||!answer.command||!['pending','committed','rejected'].includes(answer.state)))throw Error('operations_answer_context');
 return answer;
}
