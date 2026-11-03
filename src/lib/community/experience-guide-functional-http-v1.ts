/** CE-owned application adapter. Not an official Core15 ABI or a configured backend. */
import 'server-only';
import type {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {createCorePostgresTransactionHostV1,coreTransactionCommandV2Schema} from '../core/postgres-transaction-host-v1';
import type {CorePlatformRoleBoundPoolV1} from '../core/platform-role-bound-pool-v1';
import {authenticateExperienceGuideLifecycleServerSessionV1,createExperienceGuideLifecycleRequestPoolV1,
  type ExperienceGuideLifecycleAuthenticationV1} from './experience-guide-lifecycle-http-v1';
import {buildCe012NewSaveCommandV1,createCe012SaveWriterExecutorV1,ce012SaveCoreBindingMatchesV1} from './experience-guide-save-writer-v1';
import {ce012GuideSaveCommandV1Schema} from './experience-guide-command-contract';
import {ce012CommandSchema} from './experience-guide-schema';
import {ce012CreateCommandV1Schema,ce012CreateExecutionV1Schema,ce012CreateCoreMatchesV1,createCe012CreateWriterProviderV1,fingerprintCe012CreateV1} from './experience-guide-create-writer-v1';
import {guideReadResponseSchema} from './experience-guide-client';
import {hasTrustedMutationOrigin} from '../security/same-origin';
import {parseJsonWithLimit,isApplicationJson} from '../security/request-body';
const uuid=z.string().uuid();
const scopeSchema=z.strictObject({context_id:uuid,workspace_id:uuid});
const prepareSchema=scopeSchema.extend({op:z.literal('prepare'),guide_id:uuid,expected_guide_version:z.number().int().positive().safe(),
 command_id:uuid,idempotency_key:z.string(),title:z.string(),step_title:z.string(),instructions:z.string()});
const executionSchema=z.strictObject({op:z.literal('execute'),guide_command:ce012GuideSaveCommandV1Schema,core_command:coreTransactionCommandV2Schema});
const headers={'cache-control':'no-store, private','content-type':'application/json','vary':'Cookie'};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const fail=(status:number,code:string)=>json(status,{error:{code}});
export interface Ce012FunctionalDependenciesV1 {
 role_bound_pool:CorePlatformRoleBoundPoolV1|null;
 authenticate?:ExperienceGuideLifecycleAuthenticationV1;
}
// Intentionally no env/owner/service-role fallback or public registration endpoint.
export const ce012FunctionalDependenciesV1:Ce012FunctionalDependenciesV1=Object.freeze({role_bound_pool:null});

/** Native/schema/session operations are fixed CE consumer statements. No SQL is
 * executed when the actual Core/Platform role-bound capability is absent.
 */
export const CE012_FUNCTIONAL_AUTH_SQL=`select r.tenant_id::text,r.membership_id::text,
 app_private.check_workspace_native_permission_v2_at_v1($1,$2,'experience.guide.manage','experience_guides',clock_timestamp()) as can_manage,
 app_private.check_workspace_native_permission_v2_at_v1($1,$2,'experience.guide.read','experience_guides',clock_timestamp()) as can_read,
 (select revision::text from app_private.canonical_authority_revision_v1 where singleton) as revision,
 app_private.require_request_session_current_at_v1(clock_timestamp()) as session_guard
 from app_private.resolve_workspace_native_context_v2_at_v1($1,$2,clock_timestamp()) r`;
export const CE012_FUNCTIONAL_READ_SQL=`select jsonb_build_object('guides',coalesce(jsonb_agg(q.item),'[]'::jsonb),'limit',50) as projection from (
 select jsonb_build_object('guide_id',g.id,'workspace_id',g.workspace_id,'title',g.title,'audience',g.audience,
 'status',g.status,'version',g.version,'can_edit',($4::boolean and g.status='draft' and 1=(select count(*) from experience.guide_steps current_step
 where current_step.tenant_id=g.tenant_id and current_step.workspace_id=g.workspace_id and current_step.guide_id=g.id
 and current_step.guide_version=g.content_version) and not exists(
 select 1 from experience.guide_references r where r.tenant_id=g.tenant_id and r.workspace_id=g.workspace_id
 and r.guide_id=g.id and r.guide_version=g.content_version)),
 'steps',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'body',s.body,'references','[]'::jsonb) order by s.position)
 from experience.guide_steps s where s.tenant_id=g.tenant_id and s.workspace_id=g.workspace_id
 and s.guide_id=g.id and s.guide_version=g.content_version),'[]'::jsonb)) as item
 from experience.guides g where g.tenant_id=$1 and g.workspace_id=$2 and ($4::boolean or
 (g.status='published' and app_private.ce_guide_audience_allows_v1($3,$2,g.audience)))
 order by g.created_at,g.id limit 50) q`;
const authRow=z.object({tenant_id:uuid,membership_id:uuid,can_manage:z.boolean(),can_read:z.boolean(),revision:z.coerce.number().int().positive().safe(),session_guard:z.unknown()});
export function createCe012FunctionalHandlersV1(deps:Ce012FunctionalDependenciesV1){
 const authenticate=deps.authenticate??authenticateExperienceGuideLifecycleServerSessionV1;
 async function session(request:Request){const s=await authenticate(request);return s&&s.expires_at>Math.floor(Date.now()/1000)?s:null;}
 async function probe(s:NonNullable<Awaited<ReturnType<typeof session>>>,scope:z.infer<typeof scopeSchema>,projection:boolean){
  if(!deps.role_bound_pool)throw Object.assign(Error(),{code:'55000'});
  const pool=createExperienceGuideLifecycleRequestPoolV1(deps.role_bound_pool,s,scope),client=await pool.connect();
  try{await client.query('begin isolation level serializable read only');
   const first=await client.query(CE012_FUNCTIONAL_AUTH_SQL,[scope.context_id,scope.workspace_id]);
   if(first.rowCount!==1)throw Object.assign(Error(),{code:'42501'});const a=authRow.parse(first.rows[0]);
   if(!a.can_read||(!projection&&!a.can_manage))throw Object.assign(Error(),{code:'42501'});
   let data:unknown=null;
   if(projection){const rows=await client.query(CE012_FUNCTIONAL_READ_SQL,[a.tenant_id,scope.workspace_id,scope.context_id,a.can_manage]);
    if(rows.rowCount!==1)throw Error();data=guideReadResponseSchema.parse(rows.rows[0].projection);}
   const final=await client.query(CE012_FUNCTIONAL_AUTH_SQL,[scope.context_id,scope.workspace_id]);
   if(final.rowCount!==1)throw Object.assign(Error(),{code:'42501'});const b=authRow.parse(final.rows[0]);
   if(b.tenant_id!==a.tenant_id||b.membership_id!==a.membership_id||b.revision!==a.revision||!b.can_read||(!projection&&!b.can_manage)||a.can_manage!==b.can_manage)throw Object.assign(Error(),{code:'42501'});
   return {pool,revision:b.revision,data,can_manage:b.can_manage};
  }finally{try{await client.query('rollback');}finally{client.release();}}
 }
 function error(e:unknown){const code=(e as {code?:string})?.code;
  return code==='42501'?fail(403,'CE_GUIDE_ACCESS_DENIED'):['23505','23514','40001'].includes(code??'')?fail(409,'CE_GUIDE_CONFLICT'):fail(503,'CE_GUIDE_CONNECTION_NOT_READY');}
 return {
  async GET(request:Request){try{const url=new URL(request.url);const q=scopeSchema.parse(Object.fromEntries(url.searchParams));
   if(Array.from(url.searchParams.keys()).some(k=>url.searchParams.getAll(k).length!==1))return fail(400,'INVALID_REQUEST');
   const s=await session(request);if(!s)return fail(401,'UNAUTHORIZED');const p=await probe(s,q,true);
   const fresh=await session(request);if(!fresh||fresh.actor_id!==s.actor_id)return fail(401,'UNAUTHORIZED');
   const response=json(200,{contract:'ce012-functional-guide.v1',projection:p.data,can_create:p.can_manage,reference_editing:false});
   response.headers.set('X-Cladora-Guide-Read','functional-v1');return response;
  }catch(e){return e instanceof z.ZodError?fail(400,'INVALID_REQUEST'):error(e);}},
  async POST(request:NextRequest){if(!hasTrustedMutationOrigin(request))return fail(403,'BAD_ORIGIN');
   if(!isApplicationJson(request.headers.get('content-type')))return fail(415,'UNSUPPORTED_MEDIA_TYPE');
   const parsed=await parseJsonWithLimit<unknown>(request,64*1024);if(parsed.errorResponse){for(const [key,value]of Object.entries(headers))parsed.errorResponse.headers.set(key,value);return parsed.errorResponse;}
   try{const body=parsed.data as {op?:unknown};const s=await session(request);if(!s)return fail(401,'UNAUTHORIZED');
    if(body?.op==='create'){const envelope=z.strictObject({op:z.literal('create'),command:ce012CommandSchema}).parse(body);
     if(envelope.command.type!=='create_guide')return fail(400,'INVALID_REQUEST');return fail(503,'CE_GUIDE_CREATE_CORE15_NOT_READY');}
    if(body?.op==='prepare_create'){
     const q=z.strictObject({op:z.literal('prepare_create'),command:ce012CreateCommandV1Schema}).parse(body),g=q.command;
     if(g.guide_id===g.steps[0].id)return fail(400,'INVALID_REQUEST');
     const p=await probe(s,g,false);
     const core=coreTransactionCommandV2Schema.parse({contract_version:'core-transaction-command.v2',transaction_id:randomUUID(),command_id:g.command_id,
      context_id:g.context_id,workspace_id:g.workspace_id,actor_id:s.actor_id,authority_version:p.revision,
      permission_code:'experience.guide.manage',module_code:'experience_guides',evaluation_purpose:'experience.guide.command',
      aggregate_type:'experience_guide',aggregate_id:g.guide_id,aggregate_version:1,provider_source_ids:[g.guide_id,g.steps[0].id],
      idempotency_key:g.idempotency_key,input_fingerprint:fingerprintCe012CreateV1(g),
      subject_reference:{kind:'experience.guide',id:g.guide_id,version:1,relation:'create_guide',request_version:1}});
     return json(200,{contract:'ce012-prepared-create.v1',command:g,core_command:core});
    }
    if(body?.op==='execute_create'){
     const q=ce012CreateExecutionV1Schema.parse(body),g=q.command,c=q.core_command;
     if(!ce012CreateCoreMatchesV1(c,g))return fail(400,'INVALID_REQUEST');
     if(c.actor_id!==s.actor_id)return fail(403,'CE_GUIDE_ACCESS_DENIED');
     if(!deps.role_bound_pool)return fail(503,'CE_GUIDE_CONNECTION_NOT_READY');
     const pool=createExperienceGuideLifecycleRequestPoolV1(deps.role_bound_pool,s,g);
     const result=await createCorePostgresTransactionHostV1(pool).execute(c,createCe012CreateWriterProviderV1(g));
     if(result.status==='unknown_commit')return json(202,{outcome:'unknown'});
     if(result.status==='denied')return fail(result.code==='AUTHORITY_DENIED'?403:409,'CE_GUIDE_CREATE_DENIED');
     const fresh=await session(request);if(!fresh||fresh.actor_id!==s.actor_id)return json(202,{outcome:'unknown'});
     return json(200,{outcome:'created',command_id:g.command_id,guide_id:g.guide_id,version:result.receipt.aggregate_version,
      receipt_id:result.receipt.receipt_id,idempotency_key:g.idempotency_key,payload_fingerprint:c.input_fingerprint,replayed:result.status==='exact_replay'});
    }
    if(body?.op==='prepare'){const q=prepareSchema.parse(body);const p=await probe(s,q,false);
     const guide=buildCe012NewSaveCommandV1({contract:'ce012-guide-command.v1',version:1,command_id:q.command_id,
      action:'save_draft',context_id:q.context_id,workspace_id:q.workspace_id,guide_id:q.guide_id,expected_guide_version:q.expected_guide_version,
      payload:{title:q.title,step_title:q.step_title,instructions:q.instructions,document_target:null},idempotency_key:q.idempotency_key});
     const core=coreTransactionCommandV2Schema.parse({contract_version:'core-transaction-command.v2',transaction_id:randomUUID(),command_id:guide.command_id,
      context_id:guide.context_id,workspace_id:guide.workspace_id,actor_id:s.actor_id,authority_version:p.revision,
      permission_code:'experience.guide.manage',module_code:'experience_guides',evaluation_purpose:'experience.guide.command',aggregate_type:'experience_guide',
      aggregate_id:guide.guide_id,aggregate_version:guide.expected_guide_version+1,provider_source_ids:[guide.guide_id],
      idempotency_key:guide.idempotency_key,input_fingerprint:guide.payload_fingerprint,
      subject_reference:{kind:'experience.guide',id:guide.guide_id,version:guide.expected_guide_version,relation:'save_draft',request_version:1}});
     return json(200,{contract:'ce012-prepared-save.v1',guide_command:guide,core_command:core});}
    const q=executionSchema.parse(body),c=q.core_command,g=q.guide_command;
    if(g.payload.document_target!==null)return fail(503,'CE_GUIDE_REFERENCE_NOT_READY');
    if(!ce012SaveCoreBindingMatchesV1(c,g)||c.provider_source_ids.length!==1||c.provider_source_ids[0]!==g.guide_id)return fail(400,'INVALID_REQUEST');
    if(c.actor_id!==s.actor_id)return fail(403,'CE_GUIDE_ACCESS_DENIED');
    if(!deps.role_bound_pool)return fail(503,'CE_GUIDE_CONNECTION_NOT_READY');
    // Client-carried Core JSON is never authority: actual verified session,
    // request-bound role lease and the canonical host/evaluator own the decision.
    const pool=createExperienceGuideLifecycleRequestPoolV1(deps.role_bound_pool,s,{context_id:g.context_id,workspace_id:g.workspace_id});
    const result=await createCe012SaveWriterExecutorV1(createCorePostgresTransactionHostV1(pool),c).execute(g);
    if(result.result_code!=='OK'||!result.receipt)return fail(result.result_code==='AUTHORITY_DENIED'?403:409,'CE_GUIDE_SAVE_DENIED');
    const fresh=await session(request);if(!fresh||fresh.actor_id!==s.actor_id)return json(202,{outcome:'unknown'});
    return json(200,{outcome:'saved',receipt:result.receipt,replayed:result.replayed});
   }catch(e){if((e as {code?:string})?.code==='CE012_SAVE_UNKNOWN')return json(202,{outcome:'unknown'});
    return e instanceof z.ZodError?fail(400,'INVALID_REQUEST'):error(e);}}
 };
}

/** Server-selected cutover, never an HTTP-error fallback. The existing reader
 * remains authoritative until the official server composition is configured.
 * A configured reader's401/403/503 is returned unchanged. Reference resolution
 * remains its existing separately-authorized operation; this cutover is list-only.
 */
export function createCe012GuideReadCutoverV1(
 existing:(request:NextRequest)=>Promise<Response>,
 dependencies:Ce012FunctionalDependenciesV1=ce012FunctionalDependenciesV1,
):(request:NextRequest)=>Promise<Response>{
 if(dependencies.role_bound_pool===null)return existing;
 const configured=createCe012FunctionalHandlersV1(dependencies).GET;
 return request=>request.nextUrl.searchParams.has('reference_id')?existing(request):configured(request);
}
