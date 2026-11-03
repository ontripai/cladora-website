/** First real Core15 session slice; NOT Context/permission/command authority. */
import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import type {Pool,PoolClient} from 'pg';
export const CORE_AUTHENTICATED_SESSION_RUNTIME_V1='core-authenticated-session-runtime.v1' as const;
const claimsSchema=z.object({sub:z.string().uuid(),session_id:z.string().uuid(),exp:z.number().int().positive().safe(),
 role:z.literal('authenticated'),aal:z.enum(['aal1','aal2'])});
const currentSchema=z.strictObject({actor_id:z.string().uuid(),aal:z.enum(['aal1','aal2']),checked_at:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/)});
const failures=new WeakMap<object,Readonly<{settlement:'rolled_back'|'unknown';cleanup:'destroy_requested'}>>();
export function coreAuthenticatedSessionFailureV1(error:object){return failures.get(error)??null;}
const denied=()=>Object.freeze({contract:CORE_AUTHENTICATED_SESSION_RUNTIME_V1,status:'denied' as const,actor_id:null,aal:null,checked_at:null,action_authorization:'not_evaluated' as const});
async function bounded<T>(p:Promise<T>){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([p,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('core_session_transport_timeout')),10000);})]);}finally{if(timer!==undefined)clearTimeout(timer);}}
export function createCoreAuthenticatedSessionRuntimeV1(options:Readonly<{pool:Pool;auth_origin:string;publishable_key:string;database_oid:number}>){
 const origin=new URL(options.auth_origin);
 if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'
  ||!Number.isSafeInteger(options.database_oid)||options.database_oid<1)throw new Error('core_session_owned_target_required');
 const selector=options.pool.options,connection=selector.connectionString?new URL(selector.connectionString):null;
 const host=connection?.hostname.replace(/^\[|\]$/g,'')??selector.host;
 const user=connection?decodeURIComponent(connection.username):selector.user;
 if(!['127.0.0.1','localhost','::1'].includes(host??'')||user!=='cladora_core_runtime')throw new Error('core_session_pool_profile_required');
 // Actual Supabase client and issuer; no caller-provided getUser/getClaims/allow.
 const auth=createClient(origin.origin,options.publishable_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return Object.freeze({contract:CORE_AUTHENTICATED_SESSION_RUNTIME_V1,async check(accessToken:string){
  if(typeof accessToken!=='string'||accessToken.length<32||accessToken.length>16384)return denied();
  const [user,claimed]=await bounded(Promise.all([auth.auth.getUser(accessToken),auth.auth.getClaims(accessToken)]));
  const parsed=claimsSchema.safeParse(claimed.data?.claims);
  if(user.error||claimed.error||!user.data.user||!parsed.success||user.data.user.id!==parsed.data.sub)return denied();
  const claims=parsed.data;
  let client:PoolClient|undefined,started=false,settled=false,first:unknown,failed=false;
  let value:z.infer<typeof currentSchema>|undefined;
  try{
   client=await options.pool.connect();
   const principal=await client.query(`select current_user::text as actor,session_user::text as login,
    (select oid::integer from pg_database where datname=current_database()) as database_oid,
    current_setting('server_version_num')::integer as version,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
    exists(select 1 from pg_auth_members where member=r.oid) as membership from pg_roles r where r.rolname=current_user`);
   const p=principal.rows[0];if(principal.rowCount!==1||p.actor!=='cladora_core_runtime'||p.login!==p.actor||p.database_oid!==options.database_oid
    ||p.version<170000||p.version>=180000||[p.rolsuper,p.rolbypassrls,p.rolcreaterole,p.rolcreatedb,p.rolreplication,p.membership].some(v=>v!==false))throw new Error('core_session_principal_mismatch');
   started=true;const begin=await client.query('begin isolation level serializable');if(begin.command!=='BEGIN')throw new Error('core_session_begin_unknown');
   await client.query("set local lock_timeout='5s'");await client.query("set local statement_timeout='10s'");
   await client.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.aal',$3,true)",[JSON.stringify(claims),claims.sub,claims.aal]);
   const result=await client.query('select * from core_runtime.lock_request_session_v1()');
   if(result.rowCount!==1||result.rows.length!==1)throw new Error('core_session_source_unavailable');value=currentSchema.parse(result.rows[0]);
   if(value.actor_id!==claims.sub||value.aal!==claims.aal)throw new Error('core_session_binding_mismatch');
   const ack=await client.query('rollback');if(ack.command!=='ROLLBACK')throw new Error('core_session_rollback_unknown');settled=true;
  }catch(error){failed=true;first=error;
   if(client&&started&&!settled)try{const ack=await client.query('rollback');settled=ack.command==='ROLLBACK';}catch{/* UNKNOWN, never a fabricated rollback proof. */}
  }finally{if(client)try{client.release(true);}catch(error){if(!failed){failed=true;first=error;}}}
  if(failed){if(typeof first==='object'&&first!==null){failures.set(first,Object.freeze({settlement:settled?'rolled_back':'unknown',cleanup:'destroy_requested'}));
    if('code' in first&&first.code==='42501'&&settled)return denied();}
   throw first; // Preserve original40001/cancellation/transport failure; no retry.
  }
  if(!settled||!value)throw new Error('core_session_settlement_unknown');
  return Object.freeze({contract:CORE_AUTHENTICATED_SESSION_RUNTIME_V1,status:'current' as const,...value,
   action_authorization:'not_evaluated' as const,Context_authority:'not_evaluated' as const,reusable_as_command_authority:false as const});
 }});
}
