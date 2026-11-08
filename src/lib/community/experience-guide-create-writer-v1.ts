/** CE create provider. Canonical guides/steps and Core C03 receipt only; unwired by default. */
import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ce012CommandSchema} from './experience-guide-schema';
import {resolveAuthority} from '../core/current-authority-postgres-provider-v1';
import {bindCanonicalCurrentAuthorityObservationV1,currentAuthorityTransactionRequestV1Schema,
 type CurrentAuthorityTransactionDecisionReceiptV1} from '../core/current-authority-transaction-port-v1';
import {coreTransactionCommandV2Schema,type CoreTransactionCommandV2,type CoreTransactionProvidersV2,
 type CoreTransactionScopeV1} from '../core/postgres-transaction-host-v1';
import {coreTransactionReplayCommandHashV1,coreTransactionReplayReceiptHashV1} from '../core/transaction-replay-provider-hook-v1';

// Reuse the accepted create command; ZERO is deliberately not a save_draft positive version.
export const ce012CreateCommandV1Schema=ce012CommandSchema.refine(c=>c.type==='create_guide'
 &&c.expected_version===0&&c.steps.length===1&&c.steps[0].references.length===0,'Single-step, document-free creation only')
 .transform(c=>{if(c.type!=='create_guide')throw Error('INVALID_CREATE');return c;});
export type Ce012CreateCommandV1=z.infer<typeof ce012CreateCommandV1Schema>;
export const CE012_CREATE_PROVIDER_V1='ce-guide-create-provider.v1';
const stable=(v:unknown):string=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:v!==null&&typeof v==='object'
 ?`{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${stable(x)}`).join(',')}}`:JSON.stringify(v);
export const fingerprintCe012CreateV1=(value:unknown)=>`sha256:${createHash('sha256').update(stable(ce012CreateCommandV1Schema.parse(value))).digest('hex')}`;
export const ce012CreateExecutionV1Schema=z.strictObject({op:z.literal('execute_create'),command:ce012CreateCommandV1Schema,core_command:coreTransactionCommandV2Schema});
export function ce012CreateCoreMatchesV1(c:CoreTransactionCommandV2,g:Ce012CreateCommandV1){return c.command_id===g.command_id
 &&c.context_id===g.context_id&&c.workspace_id===g.workspace_id&&c.aggregate_id===g.guide_id&&c.aggregate_type==='experience_guide'
 &&c.aggregate_version===1&&c.subject_reference.kind==='experience.guide'&&c.subject_reference.id===g.guide_id
 &&c.subject_reference.version===1&&c.subject_reference.relation==='create_guide'&&c.subject_reference.request_version===1
 &&c.provider_source_ids.length===2&&c.provider_source_ids.includes(g.guide_id)&&c.provider_source_ids.includes(g.steps[0].id)
 &&g.guide_id!==g.steps[0].id&&c.permission_code==='experience.guide.manage'&&c.module_code==='experience_guides'
 &&c.evaluation_purpose==='experience.guide.command'&&c.idempotency_key===g.idempotency_key&&c.input_fingerprint===fingerprintCe012CreateV1(g);}
const must=(yes:unknown,code='42501')=>{if(!yes)throw Object.assign(Error('CE_GUIDE_CREATE_REJECTED'),{code});};
const scopeId=(s:CoreTransactionScopeV1)=>[s.transaction_id,s.database_transaction_id,s.tenant_id,s.workspace_id,s.actor_id,s.attempt].join(':');
function authorityMatches(s:CoreTransactionScopeV1,c:CoreTransactionCommandV2,a:CurrentAuthorityTransactionDecisionReceiptV1){return a.decision==='allowed'
 &&a.transaction_bound&&a.rechecked_after_lock&&s.actor_id===c.actor_id&&s.workspace_id===c.workspace_id&&s.transaction_id===c.transaction_id
 &&a.actor_id===c.actor_id&&a.context_id===c.context_id&&a.workspace_id===c.workspace_id&&a.authority_version===c.authority_version
 &&a.permission_code===c.permission_code&&a.module_code===c.module_code&&a.evaluation_purpose===c.evaluation_purpose
 &&a.transaction_context.transaction_id===s.transaction_id&&a.transaction_context.command_id===c.command_id
 &&a.transaction_context.attempt===s.attempt&&a.transaction_context.isolation_level==='serializable'
 &&a.transaction_context.lock.workspace_id===c.workspace_id&&a.transaction_context.lock.aggregate_id===c.aggregate_id
 &&a.transaction_context.lock.aggregate_type===c.aggregate_type&&a.entitlement?.workspace_id===c.workspace_id
 &&a.entitlement.module_code===c.module_code&&a.entitlement.entitlement_key==='module.experience_guides'&&a.entitlement.authority_revision===c.authority_version;}
async function checkpoint(s:CoreTransactionScopeV1,c:CoreTransactionCommandV2,a:CurrentAuthorityTransactionDecisionReceiptV1){
 const bound=scopeId(s);must(authorityMatches(s,c,a));
 const request=currentAuthorityTransactionRequestV1Schema.parse({contract_version:'core-current-authority-transaction-port-request.v1',
 decision_id:a.decision_id,context_id:c.context_id,workspace_id:c.workspace_id,actor_id:c.actor_id,authority_version:c.authority_version,
 permission_code:c.permission_code,module_code:c.module_code,evaluation_purpose:c.evaluation_purpose,transaction_context:a.transaction_context});
 const fresh=bindCanonicalCurrentAuthorityObservationV1(request,await resolveAuthority(s,request));
 must(scopeId(s)===bound&&authorityMatches(s,c,fresh)&&stable(a.entitlement)===stable(fresh.entitlement));return fresh;
}
export const CE012_CREATE_EXISTS_SQL=`select id::text from experience.guides where tenant_id=$1 and workspace_id=$2 and id=$3 for update`;
export const CE012_CREATE_HISTORY_SQL=`select g.created_by::text,s.id::text,s.title,s.body from experience.guides g
 join experience.guide_steps s on s.tenant_id=g.tenant_id and s.workspace_id=g.workspace_id and s.guide_id=g.id
 where g.tenant_id=$1 and g.workspace_id=$2 and g.id=$3 and g.version>=1 and s.guide_version=1 and s.position=1 for share of g,s`;
export const CE012_CREATE_GUIDE_SQL=`insert into experience.guides(id,tenant_id,workspace_id,title,audience,status,version,content_version,created_by)
 values($1,$2,$3,$4,$5::jsonb,'draft',1,1,$6) returning id`;
export const CE012_CREATE_STEP_SQL=`insert into experience.guide_steps(id,tenant_id,workspace_id,guide_id,guide_version,position,title,body)
 values($1,$2,$3,$4,1,1,$5,$6) returning id`;
/** No transaction control or independent receipt persistence. Core owns reservation, audit/outbox and COMMIT. */
export function createCe012CreateWriterProviderV1(value:unknown):CoreTransactionProvidersV2{
 const g=ce012CreateCommandV1Schema.parse(value),step=g.steps[0];
 const staged=new WeakMap<CoreTransactionScopeV1,{command:string;scope:string;authority:CurrentAuthorityTransactionDecisionReceiptV1}>();
 return {provider_code:CE012_CREATE_PROVIDER_V1,replay_policy:'provider_current_state_required',resolveAuthority,
 async validateProviders(s,c,a){must(ce012CreateCoreMatchesV1(c,g)&&authorityMatches(s,c,a));
  const bound=scopeId(s),rows=await s.query(CE012_CREATE_EXISTS_SQL,[s.tenant_id,s.workspace_id,g.guide_id]);must(rows.rowCount===0,'23505');
  const fresh=await checkpoint(s,c,a);must(scopeId(s)===bound);staged.set(s,{command:stable(c),scope:bound,authority:fresh});
  return {contract_version:'core-transaction-provider-evidence.v1',evidence_id:randomUUID(),provider_code:CE012_CREATE_PROVIDER_V1,
   transaction_id:c.transaction_id,command_id:c.command_id,workspace_id:c.workspace_id,actor_id:c.actor_id,context_id:c.context_id,
   authority_decision_id:a.decision_id,authority_version:a.authority_version,attempt:s.attempt,subject_reference:c.subject_reference,
   evaluated_at:fresh.evaluated_at,source_disclosure:'status_only',source_reference:null,decision:'accepted',denial_reason:null,
   reference_state:'available',current_actor_can_read:true};
 },
 async mutate(s,c){const plan=staged.get(s);staged.delete(s);must(plan&&plan.command===stable(c)&&plan.scope===scopeId(s));
  const fresh=await checkpoint(s,c,plan!.authority);must(plan!.scope===scopeId(s));
  const guide=await s.query(CE012_CREATE_GUIDE_SQL,[g.guide_id,s.tenant_id,s.workspace_id,g.title,JSON.stringify(g.audience),s.actor_id]);must(guide.rowCount===1);
  const child=await s.query(CE012_CREATE_STEP_SQL,[step.id,s.tenant_id,s.workspace_id,g.guide_id,step.title,step.body]);must(child.rowCount===1);
  await checkpoint(s,c,fresh);must(plan!.scope===scopeId(s));return {mutation_id:randomUUID()};
 },
 async validateReplay(s,c,a,r){must(ce012CreateCoreMatchesV1(c,g)&&authorityMatches(s,c,a));const bound=scopeId(s);
  const rows=await s.query(CE012_CREATE_HISTORY_SQL,[s.tenant_id,s.workspace_id,g.guide_id]);
  const row=z.strictObject({created_by:z.string().uuid(),id:z.string().uuid(),title:z.string(),body:z.string()});
  must(rows.rowCount===1&&rows.rows.length===1);const h=row.parse(rows.rows[0]);
  must(h.created_by===s.actor_id&&h.id===step.id&&h.title===step.title&&h.body===step.body);
  const fresh=await checkpoint(s,c,a);must(scopeId(s)===bound);
  return {contract_version:'core-transaction-replay-provider-decision.v1',decision_id:randomUUID(),provider_code:CE012_CREATE_PROVIDER_V1,
   database_transaction_id:s.database_transaction_id,transaction_id:c.transaction_id,command_id:c.command_id,
   workspace_id:c.workspace_id,actor_id:c.actor_id,context_id:c.context_id,authority_decision_id:a.decision_id,
   authority_version:a.authority_version,attempt:s.attempt,receipt_id:r.receipt_id,receipt_contract_version:r.contract_version,
   command_hash:coreTransactionReplayCommandHashV1(c),receipt_hash:coreTransactionReplayReceiptHashV1(r),evaluated_at:fresh.evaluated_at,
   read_only:true,decision:'accepted',denial_reason:null};
 }};
}

/** Shared CE checkpoint; the canonical Core resolver remains the sole evaluator. */
export {checkpoint as recheckCe012CurrentAuthorityV1};
