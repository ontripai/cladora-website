/** Official request-local CE010 port. No global registry/cutover or domain writer. */
import 'server-only';
import {z} from 'zod';
import type{Pool,PoolClient}from'pg';
import queryProfile from './ce010-query-profile-v1.json';
import{createCorePlatformCe010RoleBoundPoolV1,corePlatformCe010RuntimeRoleV1,type CorePlatformRoleBoundConnectionModelV1}from'./platform-role-bound-pool-v1';
import{createCoreFunctionalRequestAuthV1}from'./functional-request-auth-v1';
import{getPublicSupabaseEnv}from'../supabase/env';
import{coreFunctionalDevelopmentTargetV1Schema,type CoreFunctionalDevelopmentTargetV1}from'./functional-command-runtime-v1';
export const CORE_CE010_REQUEST_FACTORY_V1='core-ce010-request-factory.v1' as const;
export const CORE_CE010_RUNTIME_BINDING=null;
export const CORE_CE010_REQUEST_SQL_V1=Object.freeze({
 target:`select pg_backend_pid() as backend_pid,current_user::text as current_user,session_user::text as session_user,current_database() as database_name,
 (select oid::integer from pg_database where datname=current_database()) as database_oid,
 (select obj_description(oid,'pg_namespace') from pg_namespace where nspname='core_runtime') as backend_marker,
 current_setting('server_version_num')::integer as server_version_num,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication
 from pg_roles r where r.rolname=current_user`,
 identity:`select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.aal','aal2',true),
 set_config('request.jwt.claim.role','authenticated',true),set_config('request.cladora.context_id',$3,true),set_config('request.cladora.workspace_id',$4,true),
 set_config('request.jwt.claim','',true),set_config('request.jwt.claim.email','',true)`,
 clock:`select pg_backend_pid() as backend_pid,auth.uid()::text as actor_id,
 to_timestamp($1::double precision)>clock_timestamp() as unexpired,pg_catalog.to_jsonb(clock_timestamp()) #>> '{}' as checked_at`,
 session:'select app_private.lock_core_request_session_v1()',
 epoch:'select revision::text from app_private.canonical_authority_revision_v1 where singleton for share',
 guard:`select r.tenant_id::text,r.membership_id::text,auth.uid()::text as actor_id,
 (auth.jwt()->>'session_id'=$4 and auth.jwt()->>'exp'=$5 and auth.jwt()->>'aal'='aal2'
  and auth.jwt()->>'role'='authenticated' and to_timestamp($5::double precision)>clock_timestamp()) as session_bound,
 app_private.check_workspace_native_permission_v2_at_v1($1::uuid,$2::uuid,$6,'community_basic',clock_timestamp()) as allowed,
 (select revision::text from app_private.canonical_authority_revision_v1 where singleton) as revision,
 (select entitlement_key from platform.module_definitions where code='community_basic' and is_active) as entitlement_key,
 app_private.require_request_session_current_at_v1(clock_timestamp()) as session_guard
 from app_private.resolve_workspace_native_context_v2_at_v1($1::uuid,$2::uuid,clock_timestamp()) r`,
});
const uuid=z.string().uuid(),claims=z.object({sub:uuid,session_id:uuid,exp:z.number().int().positive().safe(),aal:z.enum(['aal1','aal2']),role:z.literal('authenticated')});
const selection=z.object({context_id:uuid,workspace_id:uuid}),who=z.object({backend_pid:z.number().int().positive(),current_user:z.literal(corePlatformCe010RuntimeRoleV1),session_user:z.literal(corePlatformCe010RuntimeRoleV1),database_name:z.string(),database_oid:z.number().int(),backend_marker:z.string(),server_version_num:z.number().int(),rolsuper:z.literal(false),rolbypassrls:z.literal(false),rolcreaterole:z.literal(false),rolcreatedb:z.literal(false),rolreplication:z.literal(false)});
const scoped=z.object({tenant_id:uuid,membership_id:uuid,actor_id:uuid,session_bound:z.literal(true),allowed:z.literal(true),entitlement_key:z.literal('module.community_basic'),revision:z.string().regex(/^[1-9][0-9]*$/)});
const admitted=new Map(queryProfile.queries.map(q=>[q.sql,q]));
function fail(code:string):never{throw Object.assign(Error('CE010_REQUEST_UNAVAILABLE'),{code});}
async function bounded<T>(p:Promise<T>,ms:number):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([p,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('CE010_AUTH_TIMEOUT'),{code:'55000'})),ms);})]);}finally{if(timer)clearTimeout(timer);}}
export function createCoreCe010RequestRuntimeV1(options:Readonly<{runtime_pool:Pool;target:CoreFunctionalDevelopmentTargetV1;connection_model:CorePlatformRoleBoundConnectionModelV1}>){
 if(!['direct','session_pooler'].includes(options.connection_model))fail('55000');
 const target=Object.freeze(coreFunctionalDevelopmentTargetV1Schema.parse(options.target)),origin=new URL(target.auth_origin);
 const platform12=target.database_name==='postgres'&&/^core15-dev:[a-f0-9]{32}$/.test(target.backend_id)&&target.host==='127.0.0.1'&&target.port===55422&&target.auth_origin==='http://127.0.0.1:55421';
 if(target.runtime_role!==corePlatformCe010RuntimeRoleV1||(!/^cladora_dev_[a-z0-9_]+$/.test(target.database_name)&&!platform12)
  ||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||!['http:','https:'].includes(origin.protocol))fail('55000');
 function selectors(){const p=options.runtime_pool.options,c=p.connectionString?new URL(p.connectionString):null;
  if(c&&(!['postgres:','postgresql:'].includes(c.protocol)||c.search))fail('55000');
  if((c?.hostname.replace(/^\[|\]$/g,'')??p.host)!==target.host||Number(c?.port||p.port||5432)!==target.port||(c?decodeURIComponent(c.pathname.slice(1)):p.database)!==target.database_name||(c?decodeURIComponent(c.username):p.user)!==corePlatformCe010RuntimeRoleV1
   ||!Number.isFinite(p.connectionTimeoutMillis)||Number(p.connectionTimeoutMillis)<=0||Number(p.connectionTimeoutMillis)>5000||!Number.isFinite(p.query_timeout)||Number(p.query_timeout)<=0||Number(p.query_timeout)>15000)fail('55000');}
 selectors();
 return Object.freeze({contract_version:CORE_CE010_REQUEST_FACTORY_V1,async resolve(request:Request,scopeValue:unknown){
  const scope=Object.freeze(selection.parse(scopeValue));if(request.signal.aborted)return null;
  const permission=request.method==='GET'?'community.community.read':request.method==='POST'?'community.announcement.publish':fail('55000');
  let actor:string|null=null,sid:string|null=null,leased=false;
  async function authenticate(){
   if(request.signal.aborted)fail('AUTH401');if(new URL(getPublicSupabaseEnv().url).origin!==origin.origin)fail('55000');
   const client=await bounded(createCoreFunctionalRequestAuthV1(request,origin.origin,getPublicSupabaseEnv().publishableKey),10000);
   const[u,c]=await bounded(Promise.all([client.auth.getUser(),client.auth.getClaims()]),10000),parsed=claims.safeParse(c.data?.claims);
   if(request.signal.aborted||u.error||c.error||!u.data.user||!parsed.success||u.data.user.id.toLowerCase()!==parsed.data.sub.toLowerCase())fail('AUTH401');
   if(parsed.data.aal!=='aal2')fail('AUTH401');
   if((actor!==null&&actor!==parsed.data.sub)||(sid!==null&&sid!==parsed.data.session_id))fail('AUTH401');
   actor=parsed.data.sub;sid=parsed.data.session_id;return Object.freeze(parsed.data);
  }
  const first=await authenticate();
  const request_pool=Object.freeze({async connect():Promise<PoolClient>{
   if(leased)fail('55000');leased=true;let physical:PoolClient|undefined,released=false,failed=false,firstError:unknown;
   try{
    const initial=await authenticate();selectors();physical=await options.runtime_pool.connect();const raw=physical.query.bind(physical),physicalRelease=physical.release.bind(physical);let physicalReleased=false;
    const remember=(error:Error)=>{if(!failed){failed=true;firstError=error;}};
    physical.on('error',remember);
    physical.once('end',()=>{if(!released&&!physicalReleased)remember(Object.assign(Error('CE010_BACKEND_CLOSED'),{code:'55000'}));physical?.removeListener('error',remember);});
    physical.release=(error?:Error|boolean)=>{if(physicalReleased)return;physicalReleased=true;physicalRelease(error);};
    const targetRow=await raw(CORE_CE010_REQUEST_SQL_V1.target),principal=who.parse(targetRow.rows[0]);
    if(targetRow.rowCount!==1||principal.database_oid!==target.database_oid||principal.database_name!==target.database_name||principal.backend_marker!==target.backend_id||principal.server_version_num<170000||principal.server_version_num>=180000)fail('55000');
    let transaction=false,hasBegun=false,active=initial,tenant:string|null=null,member:string|null=null,epoch:string|null=null;
    const guard=async()=>{
     if(failed)throw firstError;
     if(request.signal.aborted)fail('AUTH401');
     const answer=await raw(CORE_CE010_REQUEST_SQL_V1.guard,[scope.context_id,scope.workspace_id,active.sub,active.session_id,String(active.exp),permission]);
     if(answer.rowCount!==1||answer.rows.length!==1)fail('42501');const p=scoped.safeParse(answer.rows[0]);
     if(!p.success||p.data.actor_id!==actor||(tenant!==null&&tenant!==p.data.tenant_id)||(member!==null&&member!==p.data.membership_id)||(epoch!==null&&epoch!==p.data.revision))fail('42501');
     tenant=p.data.tenant_id;member=p.data.membership_id;epoch=p.data.revision;
     const clock=await raw(CORE_CE010_REQUEST_SQL_V1.clock,[String(active.exp)]);
     if(clock.rowCount!==1||clock.rows[0]?.backend_pid!==principal.backend_pid||clock.rows[0]?.actor_id!==actor||clock.rows[0]?.unexpired!==true||!z.iso.datetime({offset:true}).safeParse(clock.rows[0]?.checked_at).success||request.signal.aborted)fail('42501');
     if(failed)throw firstError;
    };
    const lower=Object.create(physical) as PoolClient;
    lower.query=(async(text:string,values?:unknown[])=>{
     const normalized=text.trim().toLowerCase();
     if(normalized==='begin isolation level serializable'){
      if(hasBegun)fail('55000');hasBegun=true;
      active=await authenticate();const begin=await raw(text,values);if(begin.command!=='BEGIN')fail('55000');transaction=true;
      await raw("set local lock_timeout='5s'");await raw("set local statement_timeout='10s'");
      await raw(CORE_CE010_REQUEST_SQL_V1.identity,[JSON.stringify({...active,active_context_id:scope.context_id}),active.sub,scope.context_id,scope.workspace_id]);
      await raw(CORE_CE010_REQUEST_SQL_V1.session);await raw(CORE_CE010_REQUEST_SQL_V1.epoch);
      await guard();await raw(CORE_CE010_REQUEST_SQL_V1.identity,[JSON.stringify({...active,active_context_id:scope.context_id,active_tenant_id:tenant,active_membership_id:member,active_workspace_id:scope.workspace_id}),active.sub,scope.context_id,scope.workspace_id]);
      return begin;
     }
     if(normalized==='commit'){await guard();const result=await raw(text,values);if(result.command!=='COMMIT')fail('55000');transaction=false;return result;}
     if(normalized==='rollback'){const result=await raw(text,values);if(result.command!=='ROLLBACK')fail('55000');transaction=false;return result;}
     const product=admitted.has(text)&&!normalized.startsWith('set local ');
     if(transaction&&product)await guard();const result=await raw(text,values);if(transaction&&product)await guard();return result;
    }) as PoolClient['query'];
    const fixed=createCorePlatformCe010RoleBoundPoolV1({runtime_pool:{async connect(){return lower;}},connection_model:options.connection_model});
    const lease=await fixed.connect();if(failed)throw firstError;if(request.signal.aborted)fail('AUTH401');const out=Object.create(lease) as PoolClient;
    out.query=(async(text:unknown,values:unknown[]=[])=>{
     if(released)fail('55000');
     const rollback=typeof text==='string'&&text.trim().toLowerCase()==='rollback';
     if(failed&&!rollback)throw firstError;
     try{
      if(typeof text!=='string')fail('55000');const q=admitted.get(text);if(!q||values.length!==q.parameters)fail('55000');
      if(!transaction&&text!=='begin isolation level serializable'&&!rollback)fail('55000');
      if(!rollback&&request.signal.aborted)fail('AUTH401');
      const flat=text.replace(/\s+/g,' ').trim().toLowerCase();
      if(permission==='community.community.read'&&(/^(insert|update|delete)\b/.test(flat)||flat==='commit'))fail('42501');
      if(permission==='community.community.read'&&q.source_path!=='src/lib/community/community-announcement-http-v1.ts'&&!['begin isolation level serializable','rollback'].includes(flat)&&text!==CORE_CE010_REQUEST_SQL_V1.epoch)fail('42501');
      if(flat.startsWith('select customer_api.read_ce_community_v1')&&(values[0]!==scope.context_id||values[1]!==scope.workspace_id))fail('42501');
      if(flat.startsWith('select r.tenant_id::text')&&(values[0]!==scope.context_id||values[1]!==scope.workspace_id||values[2]!==actor||values[3]!==sid||values[4]!==String(active.exp)))fail('42501');
      if(flat.startsWith('select m.tenant_id::text')&&values[0]!==scope.context_id)fail('42501');
      if(flat.startsWith('select tenant_id')&&flat.includes('platform.customer_workspaces')&&values[0]!==scope.workspace_id)fail('42501');
      if(flat.startsWith('insert into community.announcements')){if(values[1]!==tenant||values[2]!==scope.workspace_id||values[6]!==actor)fail('42501');}
      else if(/\b(?:from|into|update) community\./.test(flat)&&values.length>=2&&(values[0]!==tenant||values[1]!==scope.workspace_id))fail('42501');
      if(flat.startsWith('select auth.uid()=$1::uuid as actor_bound')&&(values[0]!==actor||values[1]!==scope.context_id||values[2]!==scope.workspace_id||values[3]!=='community.announcement.publish'||values[4]!=='community_basic'))fail('42501');
      if(flat.includes('statement_timestamp()::text as evaluated_at')&&(values[0]!==scope.context_id||values[1]!==scope.workspace_id||values[2]!=='community.announcement.publish'||values[3]!=='community_basic'))fail('42501');
      if(flat.includes('platform.idempotency_keys')){if(values[0]!==tenant)fail('42501');const key=flat.startsWith('insert')?values[2]:values[1];if(typeof key!=='string'||!key.startsWith('core-tx.v1:'+scope.workspace_id+':')||(flat.startsWith('insert')&&values[1]!==actor))fail('42501');}
      if(flat.startsWith('insert into audit.events')&&(values[0]!==tenant||values[1]!==actor))fail('42501');
      if(flat.startsWith('insert into platform.outbox_events')&&(values[0]!==tenant||values[1]!=='community_announcement'))fail('42501');
      const result=await lease.query(text,values);if(failed&&!rollback)throw firstError;return result;
     }catch(e){if(!failed){failed=true;firstError=e;}throw firstError;}
    }) as PoolClient['query'];
    // CE010 is deliberately destroy-on-release, including clean read rollback.
    // No asynchronous scrub failure can silently return an identity-bearing lease.
    out.release=(_error?:Error|boolean)=>{if(released)return;released=true;leased=false;try{lease.release(true);}catch(e){if(!failed)throw e;}};
    return out;
   }catch(e){leased=false;if(!released){released=true;try{physical?.release(true);}catch{}}throw failed?firstError:e;}
  }});
  return Object.freeze({contract:'ce010-request-binding.v1' as const,request,actor_id:first.sub,session_id:first.session_id,request_pool});
 }});
}
