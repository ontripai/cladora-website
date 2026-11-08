import 'server-only';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {createCorePostgresTransactionHostV1,coreTransactionCommandV2Schema} from '../core/postgres-transaction-host-v1';
import {authenticateExperienceGuideLifecycleServerSessionV1 as authenticateSession} from './experience-guide-lifecycle-http-v1';
import {announcementCommandV1Schema,buildAnnouncementCoreCommandV1,announcementCoreMatchesV1,createAnnouncementProviderV1} from './community-announcement-provider-v1';
import {communityReadResponseSchema} from './community-base-client';
import {hasTrustedMutationOrigin} from '../security/same-origin';
import {isApplicationJson,parseJsonWithLimit} from '../security/request-body';
import type {Ce010RuntimeV1} from './community-announcement-runtime-v1';
const scopeSchema=z.strictObject({context_id:z.string().uuid(),workspace_id:z.string().uuid()});
const headers={'cache-control':'no-store, private',pragma:'no-cache',vary:'Cookie','content-type':'application/json'};
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
const fail=(status:number,code:string)=>json(status,{error:{code}});
export const CE010_NATIVE_AUTH_SQL=`select r.tenant_id::text,r.membership_id::text,
 (auth.uid()=$3::uuid and auth.jwt()->>'session_id'=$4 and auth.jwt()->>'exp'=$5
  and auth.jwt()->>'role'='authenticated' and auth.jwt()->>'aal'='aal2') as actor_bound,
 app_private.check_workspace_native_permission_v2_at_v1($1,$2,'community.community.read','community_basic',clock_timestamp()) as can_read,
 app_private.check_workspace_native_permission_v2_at_v1($1,$2,'community.announcement.publish','community_basic',clock_timestamp()) as can_publish,
 (select revision::text from app_private.canonical_authority_revision_v1 where singleton) as revision,
 app_private.require_request_session_current_at_v1(clock_timestamp()) as session_guard
 from app_private.resolve_workspace_native_context_v2_at_v1($1,$2,clock_timestamp()) r`;
export const CE010_NATIVE_READ_SQL='select customer_api.read_ce_community_v1($1::uuid,$2::uuid) as projection';
const authority=z.object({tenant_id:z.string().uuid(),membership_id:z.string().uuid(),revision:z.coerce.number().int().positive().safe(),actor_bound:z.literal(true),can_read:z.boolean(),can_publish:z.boolean()});
export function createAnnouncementHandlersV1(runtime:Ce010RuntimeV1){
 async function bind(request:Request,scope:z.infer<typeof scopeSchema>){
  const session=await authenticateSession(request);if(!session||!session.session_id||session.assurance_level!=='aal2')throw Object.assign(Error(),{code:'AUTH401'});
  const b=await runtime.resolve?.(request,scope);if(!b||b.contract!=='ce010-request-binding.v1'||b.request!==request||b.actor_id!==session.actor_id||b.session_id!==session.session_id||!b.request_pool)throw Object.assign(Error(),{code:'55000'});
  return {session,pool:b.request_pool};
 }
 async function probe(binding:Awaited<ReturnType<typeof bind>>,scope:z.infer<typeof scopeSchema>,read:boolean,request?:Request){
  const c=await binding.pool.connect();let settled=false;
  const args=[scope.context_id,scope.workspace_id,binding.session.actor_id,binding.session.session_id,String(binding.session.expires_at)];
  try{await c.query('begin isolation level serializable');
   await c.query('select revision::text from app_private.canonical_authority_revision_v1 where singleton for share');
   const first=await c.query(CE010_NATIVE_AUTH_SQL,args);if(first.rowCount!==1||first.rows[0].actor_bound!==true)throw Object.assign(Error(),{code:'42501'});const a=authority.parse(first.rows[0]);
   if(read?!a.can_read:!a.can_publish)throw Object.assign(Error(),{code:'42501'});
   const data=read?communityReadResponseSchema.parse((await c.query(CE010_NATIVE_READ_SQL,[scope.context_id,scope.workspace_id])).rows[0]?.projection):null;
   if(data&&(data.workspace_id.toLowerCase()!==scope.workspace_id.toLowerCase()||data.communities.some(x=>x.workspace_id.toLowerCase()!==scope.workspace_id.toLowerCase())
    ||data.announcements.some(x=>!data.communities.some(p=>p.id.toLowerCase()===x.community_id.toLowerCase()))))throw Object.assign(Error(),{code:'55000'});
   // All issuer/source verification waits precede the last canonical read guard.
   // Keep that guard in the admitted scope; do not add SDK waits after rollback.
   if(read&&(!request||!await fresh(request,binding.session)))throw Object.assign(Error(),{code:'AUTH401'});
   const last=await c.query(CE010_NATIVE_AUTH_SQL,args);if(last.rowCount!==1||last.rows[0].actor_bound!==true)throw Object.assign(Error(),{code:'42501'});const b=authority.parse(last.rows[0]);
   if(a.tenant_id!==b.tenant_id||a.membership_id!==b.membership_id||a.revision!==b.revision||a.can_publish!==b.can_publish||(read?!b.can_read:!b.can_publish))throw Object.assign(Error(),{code:'42501'});
   const ack=await c.query('rollback');if(ack.command!=='ROLLBACK')throw Object.assign(Error(),{code:'55000'});settled=true;return {data,revision:b.revision};
  }finally{if(!settled)try{await c.query('rollback');}catch{}c.release(!settled);}
 }
 const error=(e:unknown)=>{const code=(e as {code?:string})?.code;return e instanceof z.ZodError?fail(400,'INVALID_REQUEST'):code==='AUTH401'?fail(401,'UNAUTHORIZED'):code==='42501'?fail(403,'CE_COMMUNITY_ACCESS_DENIED'):['23505','23514','40001'].includes(code??'')?fail(409,'CE_COMMUNITY_CONFLICT'):fail(503,'CE_COMMUNITY_CONNECTION_NOT_READY');};
 async function fresh(request:Request,s:Awaited<ReturnType<typeof bind>>['session']){const now=await authenticateSession(request);return !request.signal.aborted&&now?.actor_id===s.actor_id&&now?.session_id===s.session_id&&now?.assurance_level==='aal2';}
 return {
  async GET(request:Request){try{const url=new URL(request.url);if(Array.from(url.searchParams.keys()).some(k=>url.searchParams.getAll(k).length!==1))return fail(400,'INVALID_REQUEST');
   const scope=scopeSchema.parse(Object.fromEntries(url.searchParams)),b=await bind(request,scope),p=await probe(b,scope,true,request);
   const response=json(200,p.data);response.headers.set('X-Cladora-Community-Read','core-announcement-v1');return response;
  }catch(e){return error(e);}},
  async POST(request:NextRequest){if(!hasTrustedMutationOrigin(request))return fail(403,'BAD_ORIGIN');if(!isApplicationJson(request.headers.get('content-type')))return fail(415,'UNSUPPORTED_MEDIA_TYPE');
   const body=await parseJsonWithLimit<unknown>(request,64*1024);if(body.errorResponse){for(const[k,v]of Object.entries(headers))body.errorResponse.headers.set(k,v);return body.errorResponse;}
   try{const p=z.strictObject({op:z.enum(['prepare_announcement','execute_announcement']),command:announcementCommandV1Schema,core_command:coreTransactionCommandV2Schema.optional()}).parse(body.data),g=p.command,b=await bind(request,g);
    if(p.op==='prepare_announcement'){if(p.core_command)return fail(400,'INVALID_REQUEST');const observed=await probe(b,g,false);if(!await fresh(request,b.session))return fail(401,'UNAUTHORIZED');
     return json(200,{contract:'ce010-prepared-announcement.v1',command:g,core_command:buildAnnouncementCoreCommandV1(g,{actor_id:b.session.actor_id,authority_version:observed.revision})});}
    const c=p.core_command;if(!c||!announcementCoreMatchesV1(c,g))return fail(400,'INVALID_REQUEST');if(c.actor_id!==b.session.actor_id.toLowerCase())return fail(403,'CE_COMMUNITY_ACCESS_DENIED');
    const result=await createCorePostgresTransactionHostV1(b.pool,{replay_expiry:'database_after_lock.v1'}).execute(c,createAnnouncementProviderV1(g));
    if(result.status==='unknown_commit')return json(202,{outcome:'unknown'});
    if(result.status==='denied')return fail(result.code==='AUTHORITY_DENIED'?403:result.code==='PROVIDER_UNAVAILABLE'?503:409,'CE_COMMUNITY_COMMAND_UNCONFIRMED');
    if(!await fresh(request,b.session))return json(202,{outcome:'unknown'});
    return json(200,{entity_type:'community_announcement',entity_id:g.announcement_id,version:result.receipt.aggregate_version,command:g.type,replayed:result.status==='exact_replay'});
   }catch(e){return error(e);}
  }
 };
}
