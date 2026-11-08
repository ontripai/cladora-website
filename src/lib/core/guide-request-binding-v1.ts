/** Core-owned, request-local composition for the official CE Guide consumer. */
import 'server-only';
import {getPublicSupabaseEnv} from '../supabase/env';
import {z} from 'zod';
import type {Pool,PoolClient} from 'pg';
import {createCorePlatformRoleBoundPoolV1,corePlatformCeGuideRuntimeRoleV1,
 type CorePlatformRoleBoundConnectionModelV1,type CorePlatformRoleBoundPoolV1} from './platform-role-bound-pool-v1';
import {authenticateExperienceGuideLifecycleServerSessionV1,
 type ExperienceGuideLifecycleAuthenticationV1} from '../community/experience-guide-lifecycle-http-v1';
import {createCe012FunctionalHandlersV1,type Ce012FunctionalDependenciesV1} from '../community/experience-guide-functional-http-v1';
import {coreFunctionalDevelopmentTargetV1Schema,type CoreFunctionalDevelopmentTargetV1} from './functional-command-runtime-v1';
export const CORE_GUIDE_REQUEST_BINDING_V1='core-guide-request-binding.v1' as const;
export const CORE_GUIDE_REQUEST_RUNTIME_ACTIVATION=null;
export type CoreGuideRequestDependenciesV1=Readonly<Ce012FunctionalDependenciesV1&{
 role_bound_pool:CorePlatformRoleBoundPoolV1;authenticate:ExperienceGuideLifecycleAuthenticationV1;
}>;
export type CoreGuideRequestBindingOptionsV1=Readonly<{request:Request;runtime_pool:Pool;
 target:CoreFunctionalDevelopmentTargetV1;connection_model:CorePlatformRoleBoundConnectionModelV1}>;
export const CORE_GUIDE_IDENTITY_SQL_V1=`select current_user::text as current_user,session_user::text as session_user,
 current_database() as database_name,(select oid::integer from pg_database where datname=current_database()) as database_oid,
 current_setting('server_version_num')::integer as server_version_num,
 (select obj_description(oid,'pg_namespace') from pg_namespace where nspname='core_runtime') as backend_marker,
 r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication from pg_roles r where r.rolname=current_user`;
const uuid=z.string().uuid();
const nativeSession=z.object({source:z.literal('supabase_verified_session'),actor_id:uuid,
 assurance_level:z.literal('aal2'),expires_at:z.number().int().positive().safe(),session_id:uuid});
const principal=z.strictObject({current_user:z.literal(corePlatformCeGuideRuntimeRoleV1),session_user:z.literal(corePlatformCeGuideRuntimeRoleV1),
 database_name:z.string(),database_oid:z.number().int().positive().safe(),server_version_num:z.number().int(),backend_marker:z.string().nullable(),
 rolsuper:z.literal(false),rolbypassrls:z.literal(false),rolcreaterole:z.literal(false),rolcreatedb:z.literal(false),rolreplication:z.literal(false)});
export class CoreGuideBindingUnavailableV1 extends Error{constructor(readonly code:string){super(code);this.name='CoreGuideBindingUnavailableV1';}}
const fail=(code:string):never=>{throw new CoreGuideBindingUnavailableV1(code);};
/** Platform supplies its admitted physical runtime-role pool and observed target.
 * A profile/connection string is not evidence: every checkout verifies the actual
 * target/principal before the existing fixed-role adapter can select executor.
 * This does not install/finalize role graph, select an owner or mint a session.
 */
export function createCoreGuideRequestBindingV1(options:CoreGuideRequestBindingOptionsV1):Readonly<{contract_version:typeof CORE_GUIDE_REQUEST_BINDING_V1;dependencies:CoreGuideRequestDependenciesV1}>{
 const target=Object.freeze(coreFunctionalDevelopmentTargetV1Schema.parse(options.target)),request=options.request;
 const platform12=target.database_name==='postgres'&&/^core15-dev:[a-f0-9]{32}$/.test(target.backend_id)
  &&target.host==='127.0.0.1'&&target.port===55422&&target.auth_origin==='http://127.0.0.1:55421';
 const origin=new URL(target.auth_origin);
 if(target.runtime_role!==corePlatformCeGuideRuntimeRoleV1||(!/^cladora_dev_[a-z0-9_]+$/.test(target.database_name)&&!platform12)
  ||!['127.0.0.1','localhost','[::1]'].includes(target.host)||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)
  ||!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)fail('GUIDE_OWNED_DEVELOPMENT_TARGET_REQUIRED');
 function selectors(){
  const p=options.runtime_pool.options;
  if(!p||!Number.isFinite(p.connectionTimeoutMillis)||Number(p.connectionTimeoutMillis)<=0||Number(p.connectionTimeoutMillis)>5000
   ||!Number.isFinite(p.query_timeout)||Number(p.query_timeout)<=0||Number(p.query_timeout)>15000)fail('GUIDE_POOL_BUDGET_REQUIRED');
  const c=p.connectionString?new URL(p.connectionString):null;
  if(c&&(!['postgres:','postgresql:'].includes(c.protocol)||c.search))fail('GUIDE_POOL_TARGET_MISMATCH');
  if((c?.hostname.replace(/^\[|\]$/g,'')??p.host)!==target.host||Number(c?.port||p.port||5432)!==target.port
   ||(c?decodeURIComponent(c.pathname.slice(1)):p.database)!==target.database_name
   ||(c?decodeURIComponent(c.username):p.user)!==corePlatformCeGuideRuntimeRoleV1)fail('GUIDE_POOL_TARGET_MISMATCH');
 }
 selectors();
 let authenticatedActor:string|null=null,pinnedActor:string|null=null,pinnedSession:string|null=null,authGeneration=0;
 const authenticate:ExperienceGuideLifecycleAuthenticationV1=async(candidate)=>{
  const generation=++authGeneration;authenticatedActor=null;
  if(candidate!==request||request.signal.aborted)return null;
  if(new URL(getPublicSupabaseEnv().url).origin!==origin.origin)fail('GUIDE_AUTH_TARGET_MISMATCH');
  // Actual CE official SSR auth is reused, not a caller-supplied function or
  // the SERVICE port. Re-evaluate each time; no cached allow/session snapshot.
  const observed=await authenticateExperienceGuideLifecycleServerSessionV1(request);
  const parsed=nativeSession.safeParse(observed);
  if(generation!==authGeneration||request.signal.aborted||!parsed.success)return null;
  if((pinnedActor!==null&&pinnedActor!==parsed.data.actor_id)||(pinnedSession!==null&&pinnedSession!==parsed.data.session_id))fail('GUIDE_REQUEST_SESSION_DRIFT');
  pinnedActor=parsed.data.actor_id;pinnedSession=parsed.data.session_id;authenticatedActor=parsed.data.actor_id;
  // The CE successor owns SID/exp validation and transaction-local carriage;
  // absent SID (legacy carrier) is deliberately NOT upgraded into native proof.
  return Object.freeze(parsed.data);
 };
 const checkedPool={async connect():Promise<PoolClient>{
  if(request.signal.aborted||authenticatedActor===null)fail('GUIDE_REQUEST_AUTHENTICATION_REQUIRED');selectors();
  const client=await options.runtime_pool.connect();
  try{
   const r=await client.query(CORE_GUIDE_IDENTITY_SQL_V1),who=principal.parse(r.rows[0]);
   if(r.rowCount!==1||r.rows.length!==1||who.database_name!==target.database_name||who.database_oid!==target.database_oid
    ||who.server_version_num<170000||who.server_version_num>=180000||(platform12&&who.backend_marker!==target.backend_id))fail('GUIDE_ACTUAL_TARGET_MISMATCH');
   if(request.signal.aborted||authenticatedActor===null)fail('GUIDE_REQUEST_AUTHENTICATION_REQUIRED');
   return client;
  }catch(error){try{client.release(true);}catch{}throw error;}
 }};
 const fixed=createCorePlatformRoleBoundPoolV1({runtime_pool:checkedPool,connection_model:options.connection_model});
 const role_bound_pool:CorePlatformRoleBoundPoolV1=Object.freeze({contract_version:fixed.contract_version,connection_model:fixed.connection_model,
  async connect(){
   if(request.signal.aborted||authenticatedActor===null)fail('GUIDE_REQUEST_AUTHENTICATION_REQUIRED');
   const c=await fixed.connect();let failed=false,first:unknown;
   const guarded=Object.create(c) as PoolClient;
   guarded.query=(async(text:unknown,values?:unknown[])=>{
    const rollback=typeof text==='string'&&text.trim().toLowerCase()==='rollback';
    if(!rollback){if(failed)throw first;if(request.signal.aborted||authenticatedActor===null)fail('GUIDE_REQUEST_AUTHENTICATION_REQUIRED');}
    try{return await c.query(text as string,values);}catch(error){if(!failed){failed=true;first=error;}throw error;}
   }) as PoolClient['query'];
   guarded.release=(error?:Error|boolean)=>c.release(error||failed||request.signal.aborted?true:undefined);
   return guarded;
  }});
 return Object.freeze({contract_version:CORE_GUIDE_REQUEST_BINDING_V1,dependencies:Object.freeze({role_bound_pool,authenticate})});
}

/** Direct, request-owned consumer composition; routes select it explicitly.
 * No global cutover, handler fallback, fresh host, or alternate domain writer. */
export function createCoreGuideRequestHandlersV1(options:CoreGuideRequestBindingOptionsV1){
 const binding=createCoreGuideRequestBindingV1(options);
 return Object.freeze({contract_version:CORE_GUIDE_REQUEST_BINDING_V1,
  handlers:Object.freeze(createCe012FunctionalHandlersV1(binding.dependencies))});
}
