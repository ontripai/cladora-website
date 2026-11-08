/** CE-owned inactive domain provider. C01 evaluates; C03 owns the transaction and receipt. */
import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {ce010CommandSchema} from './community-base-schema';
import {eventAudienceSchema} from './event-interest-schema';
import {resolveAuthority} from '../core/current-authority-postgres-provider-v1';
import {bindCanonicalCurrentAuthorityObservationV1,currentAuthorityTransactionRequestV1Schema,type CurrentAuthorityTransactionDecisionReceiptV1} from '../core/current-authority-transaction-port-v1';
import {coreTransactionCommandV2Schema,type CoreTransactionCommandV2,type CoreTransactionProvidersV2,type CoreTransactionScopeV1} from '../core/postgres-transaction-host-v1';
import {coreTransactionReplayCommandHashV1,coreTransactionReplayReceiptHashV1} from '../core/transaction-replay-provider-hook-v1';

export const announcementCommandV1Schema=ce010CommandSchema.refine(c=>['create_announcement','publish_announcement','cancel_announcement'].includes(c.type),'Announcement slice only')
 .transform(c=>{if(c.type!=='create_announcement'&&c.type!=='publish_announcement'&&c.type!=='cancel_announcement')throw Error('INVALID_ANNOUNCEMENT');return c;});
export type AnnouncementCommandV1=z.infer<typeof announcementCommandV1Schema>;
const stable=(v:unknown):string=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:v!==null&&typeof v==='object'?`{${Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>`${JSON.stringify(k)}:${stable(x)}`).join(',')}}`:JSON.stringify(v);
export const fingerprintAnnouncementV1=(value:unknown)=>`sha256:${createHash('sha256').update(stable({contract:'ce010-announcement-input.v1',command:announcementCommandV1Schema.parse(value)})).digest('hex')}`;
export function buildAnnouncementCoreCommandV1(value:unknown,server:{actor_id:string;authority_version:number;transaction_id?:string}){
 const g=announcementCommandV1Schema.parse(value),version=g.type==='create_announcement'?1:g.expected_version+1;
 return coreTransactionCommandV2Schema.parse({contract_version:'core-transaction-command.v2',transaction_id:server.transaction_id??randomUUID(),command_id:g.command_id,
  context_id:g.context_id,workspace_id:g.workspace_id,actor_id:server.actor_id,authority_version:server.authority_version,
  permission_code:'community.announcement.publish',module_code:'community_basic',evaluation_purpose:'community.announcement.command',
  aggregate_type:'community_announcement',aggregate_id:g.announcement_id,aggregate_version:version,
  provider_source_ids:[g.community_id,g.announcement_id],idempotency_key:g.idempotency_key,input_fingerprint:fingerprintAnnouncementV1(g),
  subject_reference:{kind:'community.announcement',id:g.announcement_id,version,relation:g.type,request_version:1}});
}
export function announcementCoreMatchesV1(c:CoreTransactionCommandV2,g:AnnouncementCommandV1){return stable(c)===stable(buildAnnouncementCoreCommandV1(g,{actor_id:c.actor_id,authority_version:c.authority_version,transaction_id:c.transaction_id}));}
const must=(ok:unknown,code='42501')=>{if(!ok)throw Object.assign(Error('CE_ANNOUNCEMENT_REJECTED'),{code});};
const row=z.strictObject({id:z.string().uuid(),version:z.coerce.number().int().positive().safe(),audience:eventAudienceSchema});
const annRow=row.extend({community_id:z.string().uuid(),status:z.enum(['draft','published','cancelled']),body:z.string()});
export const CE010_COMMUNITY_LOCK_SQL=`select id::text,version,audience from community.communities where tenant_id=$1 and workspace_id=$2 and id=$3 for update`;
export const CE010_ANNOUNCEMENT_LOCK_SQL=`select id::text,community_id::text,version,audience,status,body from community.announcements where tenant_id=$1 and workspace_id=$2 and community_id=$3 and id=$4 for update`;
export const CE010_AUDIENCE_VALID_SQL=`select app_private.ce_community_audience_valid_v1($1::jsonb,$2::uuid,$3::uuid) as valid`;
export const CE010_ANNOUNCEMENT_INSERT_SQL=`insert into community.announcements(id,tenant_id,workspace_id,community_id,body,audience,status,version,created_by)
 values($1,$2,$3,$4,$5,$6::jsonb,'draft',1,$7) returning id`;
export const CE010_ANNOUNCEMENT_UPDATE_SQL=`update community.announcements set status=$5,version=version+1,updated_at=clock_timestamp()
 where tenant_id=$1 and workspace_id=$2 and community_id=$3 and id=$4 and version=$6
 and (($5='published' and status='draft') or ($5='cancelled' and status<>'cancelled')) returning id`;
const scopeKey=(s:CoreTransactionScopeV1)=>[s.database_transaction_id,s.transaction_id,s.tenant_id,s.workspace_id,s.actor_id,s.attempt].join(':');
function matches(s:CoreTransactionScopeV1,c:CoreTransactionCommandV2,a:CurrentAuthorityTransactionDecisionReceiptV1){return a.decision==='allowed'&&a.transaction_bound&&a.rechecked_after_lock
 &&s.transaction_id===c.transaction_id&&s.workspace_id===c.workspace_id&&s.actor_id===c.actor_id&&a.actor_id===c.actor_id
 &&a.context_id===c.context_id&&a.workspace_id===c.workspace_id&&a.authority_version===c.authority_version
 &&a.permission_code===c.permission_code&&a.module_code===c.module_code&&a.evaluation_purpose===c.evaluation_purpose
 &&a.transaction_context.transaction_id===s.transaction_id&&a.transaction_context.command_id===c.command_id&&a.transaction_context.attempt===s.attempt
 &&a.transaction_context.lock.aggregate_id===c.aggregate_id&&a.transaction_context.lock.aggregate_type===c.aggregate_type
 &&a.entitlement?.workspace_id===c.workspace_id&&a.entitlement.module_code==='community_basic'&&a.entitlement.entitlement_key==='module.community_basic';}
async function checkpoint(s:CoreTransactionScopeV1,c:CoreTransactionCommandV2,a:CurrentAuthorityTransactionDecisionReceiptV1){
 must(matches(s,c,a));const key=scopeKey(s),request=currentAuthorityTransactionRequestV1Schema.parse({contract_version:'core-current-authority-transaction-port-request.v1',
  decision_id:a.decision_id,context_id:c.context_id,workspace_id:c.workspace_id,actor_id:c.actor_id,authority_version:c.authority_version,
  permission_code:c.permission_code,module_code:c.module_code,evaluation_purpose:c.evaluation_purpose,transaction_context:a.transaction_context});
 const fresh=bindCanonicalCurrentAuthorityObservationV1(request,await resolveAuthority(s,request));
 must(scopeKey(s)===key&&matches(s,c,fresh)&&stable(a.entitlement)===stable(fresh.entitlement));
 // The canonical evaluator remains Core-owned; the existing current-time session
 // and permission primitives close this domain's post-wait expiry boundary.
 const current=await s.query(`select auth.uid()=$1::uuid as actor_bound,
  app_private.check_workspace_native_permission_v2_at_v1($2::uuid,$3::uuid,$4,$5,clock_timestamp()) as allowed,
  app_private.check_workspace_native_permission_v2_at_v1($2::uuid,$3::uuid,'community.community.read','community_basic',clock_timestamp()) as can_read,
  app_private.require_request_session_current_at_v1(clock_timestamp()) as session_guard`,[c.actor_id,c.context_id,c.workspace_id,c.permission_code,c.module_code]);
 must(current.rowCount===1&&current.rows[0].actor_bound===true&&current.rows[0].allowed===true&&current.rows[0].can_read===true&&scopeKey(s)===key);return fresh;
}
export function createAnnouncementProviderV1(value:unknown):CoreTransactionProvidersV2{
 const g=announcementCommandV1Schema.parse(value),provider_code='ce010-announcement-provider.v1';
 const plans=new WeakMap<CoreTransactionScopeV1,{scope:string;command:string;authority:CurrentAuthorityTransactionDecisionReceiptV1}>();
 async function source(s:CoreTransactionScopeV1,replay:boolean){
  const community=await s.query(CE010_COMMUNITY_LOCK_SQL,[s.tenant_id,s.workspace_id,g.community_id]);must(community.rowCount===1);const parent=row.parse(community.rows[0]);
  const found=await s.query(CE010_ANNOUNCEMENT_LOCK_SQL,[s.tenant_id,s.workspace_id,g.community_id,g.announcement_id]);
  if(!replay&&g.type==='create_announcement'){
   must(parent.version===g.expected_version,'40001');must(found.rowCount===0,'23505');
   const valid=await s.query(CE010_AUDIENCE_VALID_SQL,[JSON.stringify(g.audience),s.tenant_id,s.workspace_id]);must(valid.rowCount===1&&valid.rows[0].valid===true,'22023');return;
  }
  must(found.rowCount===1);const a=annRow.parse(found.rows[0]);must(a.community_id.toLowerCase()===g.community_id.toLowerCase());
  if(replay){must(a.version>=(g.type==='create_announcement'?1:g.expected_version+1));if(g.type==='create_announcement')must(a.body===g.body&&stable(a.audience)===stable(g.audience));}
  else{must(a.version===g.expected_version,'40001');must(g.type==='publish_announcement'?a.status==='draft':a.status!=='cancelled','40001');}
 }
 return {provider_code,replay_policy:'provider_current_state_required',resolveAuthority,
  async validateProviders(s,c,a){must(announcementCoreMatchesV1(c,g)&&matches(s,c,a));const key=scopeKey(s);await source(s,false);const fresh=await checkpoint(s,c,a);must(scopeKey(s)===key);
   plans.set(s,{scope:key,command:stable(c),authority:fresh});return {contract_version:'core-transaction-provider-evidence.v1',evidence_id:randomUUID(),provider_code,
    transaction_id:c.transaction_id,command_id:c.command_id,workspace_id:c.workspace_id,actor_id:c.actor_id,context_id:c.context_id,
    authority_decision_id:a.decision_id,authority_version:a.authority_version,attempt:s.attempt,subject_reference:c.subject_reference,
    evaluated_at:fresh.evaluated_at,source_disclosure:'status_only',source_reference:null,decision:'accepted',denial_reason:null,reference_state:'available',current_actor_can_read:true};},
  async mutate(s,c){const p=plans.get(s);plans.delete(s);must(p&&p.scope===scopeKey(s)&&p.command===stable(c));
   const fresh=await checkpoint(s,c,p!.authority);const result=g.type==='create_announcement'
    ?await s.query(CE010_ANNOUNCEMENT_INSERT_SQL,[g.announcement_id,s.tenant_id,s.workspace_id,g.community_id,g.body,JSON.stringify(g.audience),s.actor_id])
    :await s.query(CE010_ANNOUNCEMENT_UPDATE_SQL,[s.tenant_id,s.workspace_id,g.community_id,g.announcement_id,g.type==='publish_announcement'?'published':'cancelled',g.expected_version]);
   must(result.rowCount===1,'40001');await checkpoint(s,c,fresh);must(p!.scope===scopeKey(s));return {mutation_id:randomUUID()};},
  async validateReplay(s,c,a,r){must(announcementCoreMatchesV1(c,g)&&matches(s,c,a));const key=scopeKey(s);await source(s,true);const fresh=await checkpoint(s,c,a);must(scopeKey(s)===key);
   return {contract_version:'core-transaction-replay-provider-decision.v1',decision_id:randomUUID(),provider_code,database_transaction_id:s.database_transaction_id,
    transaction_id:c.transaction_id,command_id:c.command_id,workspace_id:c.workspace_id,actor_id:c.actor_id,context_id:c.context_id,authority_decision_id:a.decision_id,
    authority_version:a.authority_version,attempt:s.attempt,receipt_id:r.receipt_id,receipt_contract_version:r.contract_version,
    command_hash:coreTransactionReplayCommandHashV1(c),receipt_hash:coreTransactionReplayReceiptHashV1(r),evaluated_at:fresh.evaluated_at,read_only:true,decision:'accepted',denial_reason:null};}
 };
}
