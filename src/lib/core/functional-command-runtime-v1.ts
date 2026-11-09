/** Server-only binding of verified Auth to the EXISTING C03 host. */
import 'server-only';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import queryCensus from './functional-read-queries-v1.json';
import {createServiceOfferingRequestSourcePortsV1} from '../customer/service-v14-execution/request-source-ports';
import {currentAuthorityTransactionRequestV1Schema} from './current-authority-transaction-port-v1';
import type {CoreTransactionScopeV1,CoreTransactionCommandV1} from './postgres-transaction-host-v1';
import type {Pool,PoolClient,QueryResultRow} from 'pg';
import {createClient} from '../supabase/server';
import {getPublicSupabaseEnv} from '../supabase/env';
import {createCoreFunctionalRequestAuthV1} from './functional-request-auth-v1';
import {createCorePostgresTransactionHostV1,CORE_SERVER_REPLAY_EXPIRY_SQL_V1,coreTransactionCommandV1Schema,coreTransactionCommandV2Schema,
 type CoreTransactionHostV1,type CoreTransactionProvidersV1,type CoreTransactionProvidersV2} from './postgres-transaction-host-v1';
import {CORE_S01_SQL} from './service-s01/provider-agreement-reader-v1';
import {createCoreFunctionalProducersV1} from './functional-producers-v1';
import type {CoreS01ServiceOfferingBindingV1} from './service-s01/offering-disclosure-policy-v1';
import {coreDomainCommandIdentitySelectionV1Schema,coreDomainCommandIdentityV1Schema} from './domain-command-identity-v1';
export const CORE_FUNCTIONAL_COMMAND_RUNTIME_V1='core-functional-command-runtime.v1' as const;
const uuid=z.string().uuid();
const role=z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/);
export const coreFunctionalDevelopmentTargetV1Schema=z.strictObject({
 contract:z.literal('core-functional-development-target.v1'),backend_id:z.string().min(8).max(160),
 purpose:z.literal('owned-isolated-persistent-development'),host:z.enum(['127.0.0.1','localhost','::1']),
 port:z.number().int().min(1).max(65535),database_name:z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/),
 database_oid:z.number().int().positive().safe(),runtime_role:role,auth_origin:z.string().url(),
});
export type CoreFunctionalDevelopmentTargetV1=z.infer<typeof coreFunctionalDevelopmentTargetV1Schema>;
const claimsSchema=z.object({sub:uuid,session_id:uuid,aal:z.enum(['aal1','aal2']),role:z.literal('authenticated'),exp:z.number().int().positive().safe()});
type VerifiedAal2Claims=z.infer<typeof claimsSchema>&{aal:'aal2'};
const commandSchema=z.union([coreTransactionCommandV1Schema,coreTransactionCommandV2Schema]);
export class CoreFunctionalRuntimeUnavailableV1 extends Error {constructor(readonly code:string){super(code);this.name='CoreFunctionalRuntimeUnavailableV1';}}
const leasePids=new WeakMap<PoolClient,number>();
const readFailures=new WeakMap<object,Readonly<{settlement:'unknown'|'rolled_back';cleanup:'destroy_requested';rollback_error:unknown;cleanup_error?:unknown}>>();
export function coreFunctionalReadFailureV1(error:object){return readFailures.get(error)??null;}
async function bounded<T>(operation:Promise<T>,ms:number):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new CoreFunctionalRuntimeUnavailableV1('RUNTIME_TIMEOUT')),ms);})]);}finally{if(timer!==undefined)clearTimeout(timer);}}
const fail=(code:string):never=>{throw new CoreFunctionalRuntimeUnavailableV1(code);};
export const CORE_FUNCTIONAL_RUNTIME_SQL=Object.freeze({
 principal:`select pg_backend_pid() as backend_pid,current_user::text as principal,session_user::text as login,current_database() as database_name,
  (select oid::integer from pg_database where datname=current_database()) as database_oid,
  (select obj_description(oid,'pg_namespace') from pg_namespace where nspname='core_runtime') as backend_marker,
  current_setting('server_version_num')::integer as server_version_num,
  r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
  exists(select 1 from pg_auth_members m where m.member=r.oid) as privileged_membership,
  has_database_privilege(current_user,current_database(),'CREATE') as database_create,
  exists(select 1 from pg_namespace n where n.nspname in ('app_private','platform','identity','portfolio','audit','service_catalog','auth','public')
    and has_schema_privilege(current_user,n.oid,'CREATE')) as schema_create,
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('app_private','platform','identity','portfolio','audit','service_catalog','auth') and c.relowner=r.oid) as table_owner
  from pg_roles r where r.rolname=current_user`,
 identity:`select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),
  set_config('request.jwt.claim.aal','aal2',true),set_config('request.jwt.claim.role','authenticated',true),
  set_config('request.cladora.context_id',$3,true),set_config('request.cladora.workspace_id',$4,true)`,
 session:'select app_private.lock_core_request_session_v1()',
 resolve:'select workspace_id::text,tenant_id::text,membership_id::text from app_private.resolve_workspace_native_context_v2($1::uuid,$2::uuid)',
 checkpoint:'select app_private.core_functional_checkpoint_v1($1::uuid,$2::uuid,$3::text,$4::text,$5::bigint)',
});
const principalSchema=z.strictObject({backend_pid:z.number().int().positive().safe(),principal:role,login:role,database_name:z.string(),database_oid:z.number().int(),server_version_num:z.number().int(),backend_marker:z.string().nullable().optional(),
 rolsuper:z.literal(false),rolbypassrls:z.literal(false),rolcreaterole:z.literal(false),rolcreatedb:z.literal(false),rolreplication:z.literal(false),privileged_membership:z.literal(false),database_create:z.literal(false),schema_create:z.literal(false),table_owner:z.literal(false)});
/** Must be constructed by the server from Platform's verified target manifest,
 * never an HTTP payload. No default URL, env-secret discovery, alternate target,
 * service-role client, caller Auth callback or authority provider is accepted.
 */
export function createCoreFunctionalCommandRuntimeV1(options:Readonly<{pool:Pool;target:CoreFunctionalDevelopmentTargetV1;offering:CoreS01ServiceOfferingBindingV1|null;request?:Request;agreement_family?:'request'|'authoring'|'revise';claim_alias_profile?:'documents.v1'}>){
 const producers=createCoreFunctionalProducersV1(options.offering,options.agreement_family);
 const target=Object.freeze(coreFunctionalDevelopmentTargetV1Schema.parse(options.target));
 const platform12=target.database_name==='postgres'&&/^core15-dev:[a-f0-9]{32}$/.test(target.backend_id)
  &&target.host==='127.0.0.1'&&target.port===55422&&target.auth_origin==='http://127.0.0.1:55421';
 if(!/^cladora_dev_[a-z0-9_]+$/.test(target.database_name)&&!platform12)fail('DEVELOPMENT_DATABASE_REQUIRED');
 const origin=new URL(target.auth_origin);
 if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||!['http:','https:'].includes(origin.protocol)
   ||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash
   ||['postgres','authenticated','anon','service_role','supabase_admin','supabase_auth_admin','cladora_rpc_owner'].includes(target.runtime_role))fail('DEVELOPMENT_TARGET_REQUIRED');
 // Inspect only the actual Pool's NONSECRET selectors. A connectionString may
 // override separate Pool fields; compare its effective selectors, never print it.
 function assertPoolSelectors(){
 const config=options.pool.options;
 if(!Number.isFinite(config.connectionTimeoutMillis)||Number(config.connectionTimeoutMillis)<=0||Number(config.connectionTimeoutMillis)>5000
  ||!Number.isFinite(config.query_timeout)||Number(config.query_timeout)<=0||Number(config.query_timeout)>15000)fail('POOL_BUDGET_REQUIRED');
 const connection=config.connectionString?new URL(config.connectionString):null;
 if(connection&&(connection.search||!['postgres:','postgresql:'].includes(connection.protocol)))fail('POOL_BINDING_MISMATCH');
 const poolHost=connection?.hostname.replace(/^\[|\]$/g,'')??config.host;
 const port=Number(connection?.port||config.port||5432),database=connection?decodeURIComponent(connection.pathname.slice(1)):config.database;
 const user=connection?decodeURIComponent(connection.username):config.user;
 if(poolHost!==target.host||port!==target.port||database!==target.database_name||user!==target.runtime_role)fail('POOL_BINDING_MISMATCH');
 }
 assertPoolSelectors();
 async function authenticate(){
  // Fixed official server Auth client. getClaims alone/user_metadata are not proof.
  if(new URL(getPublicSupabaseEnv().url).origin!==origin.origin)fail('AUTH_TARGET_MISMATCH');
  const auth=await bounded(options.request
   ?Promise.resolve(createCoreFunctionalRequestAuthV1(options.request,origin.origin,getPublicSupabaseEnv().publishableKey))
   :createClient(),10000);
  const [user,claimed]=await bounded(Promise.all([auth.auth.getUser(),auth.auth.getClaims()]),10000);
  const verifiedActor=user.data.user?.id;
  if(user.error||claimed.error||!uuid.safeParse(verifiedActor).success)return fail('AUTHENTICATION_REQUIRED');
  const parsed=claimsSchema.safeParse(claimed.data?.claims);
  if(!parsed.success)return fail('AUTHENTICATION_REQUIRED');
  const claims=parsed.data;
  if(claims.sub.toLowerCase()!==(verifiedActor as string).toLowerCase())fail('ACTOR_BINDING_MISMATCH');
  // Only a verified, structurally valid, actor-matched session can need MFA.
  // Never upgrade AAL1 to AAL2 or let it reach a pool checkout/dispatch.
  if(claims.aal!=='aal2')return fail('MFA_REQUIRED');
  return {...claims,aal:'aal2' as const};
 }
 function makeConnect(command:Pick<CoreTransactionCommandV1,'context_id'|'workspace_id'|'permission_code'|'module_code'|'authority_version'>|null,claims:VerifiedAal2Claims,state:{authorized:boolean;binding?:{workspace_id:string;tenant_id:string;membership_id:string}}){
  const connect=async()=>{
   state.authorized=false;assertPoolSelectors();const client=await options.pool.connect();
   const raw=client.query.bind(client);let leaseError:unknown,leaseFailed=false;
   const onError=(error:Error)=>{if(!leaseFailed){leaseFailed=true;leaseError=error;}};client.on('error',onError);
   let backend:number|undefined;
   const assertPrincipal=async()=>{
    const result=await raw(CORE_FUNCTIONAL_RUNTIME_SQL.principal),who=principalSchema.parse(result.rows[0]);
    if(result.rowCount!==1||who.principal!==target.runtime_role||who.login!==target.runtime_role
      ||who.database_oid!==target.database_oid||who.database_name!==target.database_name
      ||(platform12&&who.backend_marker!==target.backend_id)
      ||who.server_version_num<170000||who.server_version_num>=180000||(backend!==undefined&&who.backend_pid!==backend))fail('NATIVE_TARGET_MISMATCH');
    backend=who.backend_pid;
   };
   try{await assertPrincipal();if(options.claim_alias_profile==='documents.v1')await raw("select pg_catalog.set_config('request.jwt.claim','',false),pg_catalog.set_config('request.jwt.claim.email','',false)");}catch(error){client.once('end',()=>client.removeListener('error',onError));try{client.release(true);}catch(cleanup){if(options.claim_alias_profile!=='documents.v1')throw cleanup;if(error!==null&&typeof error==='object')readFailures.set(error,Object.freeze({settlement:'unknown',cleanup:'destroy_requested',rollback_error:cleanup}));}throw error;}
   const checkpoint=()=>{if(command===null)return fail('READ_SCOPE_REQUIRED');return raw(CORE_FUNCTIONAL_RUNTIME_SQL.checkpoint,[command.context_id,command.workspace_id,command.permission_code,command.module_code,command.authority_version]);};
   const wrapped=new Proxy(client, {get(object,key){
    if(key==='query')return async(text:string,values:unknown[]=[])=>{
     if(typeof text!=='string')fail('WIRE_CONTRACT_MISMATCH');
     if(leaseFailed&&text.trim().toLowerCase()!=='rollback')throw leaseError;
     try{
      const normalized=text.trim().toLowerCase();
      if(normalized==='begin isolation level serializable'){
       const begin=await raw(text,values);if(begin.command!=='BEGIN')fail('BEGIN_ACK_INVALID');await assertPrincipal();
       await raw("set local lock_timeout='5s'");await raw("set local statement_timeout='10s'");
       if(options.claim_alias_profile==='documents.v1')await raw("select pg_catalog.set_config('request.jwt.claim','',true),pg_catalog.set_config('request.jwt.claim.email','',true)");
       await raw(CORE_FUNCTIONAL_RUNTIME_SQL.identity,[JSON.stringify({...claims,active_context_id:command?.context_id??''}),claims.sub,command?.context_id??'',command?.workspace_id??'']);
       await raw(CORE_FUNCTIONAL_RUNTIME_SQL.session); // Real managed session row barrier, held to settlement.
       if(command===null)return begin; // Own-selection discovery; no caller scope or allow.
       const resolved=await raw(CORE_FUNCTIONAL_RUNTIME_SQL.resolve,[command.context_id,command.workspace_id]);
       const binding=z.strictObject({workspace_id:uuid,tenant_id:uuid,membership_id:uuid}).parse(resolved.rows[0]);
       if(resolved.rowCount!==1||binding.workspace_id!==command.workspace_id)fail('SCOPE_DENIED');
       state.binding=Object.freeze({...binding});
       await raw(CORE_FUNCTIONAL_RUNTIME_SQL.identity,[JSON.stringify({...claims,active_context_id:command.context_id,active_tenant_id:binding.tenant_id,active_membership_id:binding.membership_id,active_workspace_id:binding.workspace_id}),claims.sub,command.context_id,command.workspace_id]);
       return begin;
      }
      // Guard after provider awaits, before the first/each effect and settlement.
      if(state.authorized&&normalized!=='rollback'&&!normalized.startsWith('set local '))await checkpoint();
      if(normalized==='commit')await assertPrincipal();
      const answer=await raw(text,values);
      if(normalized==='commit'&&answer.command!=='COMMIT')fail('COMMIT_ACK_UNKNOWN');
      if(normalized==='commit')await assertPrincipal();
      if(normalized==='rollback'&&answer.command!=='ROLLBACK')fail('ROLLBACK_ACK_UNKNOWN');
      if(state.authorized&&normalized!=='commit'&&normalized!=='rollback'&&text!==CORE_SERVER_REPLAY_EXPIRY_SQL_V1&&!normalized.startsWith('set local '))await checkpoint();
      if(text===CORE_S01_SQL.head||text===CORE_S01_SQL.discover){
       // node-pg int8 is text by default. Adapt ONLY the pinned S01 revision
       // column, preserving exactness and every other field/row for its schema.
       return {...answer,rows:answer.rows.map(row=>{
        if(typeof row.revision!=='string')return row;
        if(!/^[1-9][0-9]*$/.test(row.revision)||!Number.isSafeInteger(Number(row.revision)))fail('S01_REVISION_CODEC_MISMATCH');
        return {...row,revision:Number(row.revision)};
       })};
      }
      return answer;
     }catch(error){if(!leaseFailed){leaseFailed=true;leaseError=error;}throw error;} // Original40001 retained.
    };
    if(key==='release')return()=>{object.once('end',()=>object.removeListener('error',onError));try{object.release(true);}catch(cleanup){throw leaseFailed?leaseError:cleanup;}}; // Never return a claim-bearing lease to the pool.
    const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
   }});
   leasePids.set(wrapped as PoolClient,backend!);return wrapped as PoolClient;
  };
  return connect;
 }
 const execute=async(commandValue:unknown,providers:CoreTransactionProvidersV1|CoreTransactionProvidersV2,documentsReplayOnly=false)=>{
  const command=commandSchema.parse(commandValue);
  const claims=await authenticate();
  if(claims.sub.toLowerCase()!==command.actor_id)fail('ACTOR_BINDING_MISMATCH');
  const state={authorized:false};
  const boundPool={connect:makeConnect(command,claims,state)};
  // Same C03 ledger/host, including existing retry/recovery, NOT a new engine.
  const host=createCorePostgresTransactionHostV1(boundPool,{replay_expiry:'database_after_lock.v1'});
  const selectedHost=documentsReplayOnly?host.executeDocumentsReplayOnly.bind(host):host.execute.bind(host);
  return selectedHost(command,{...providers,async resolveAuthority(...args:Parameters<typeof producers.resolveAuthority>){
   const observation=await producers.resolveAuthority(...args);state.authorized=observation.decision==='allowed';return observation;
  }} as CoreTransactionProvidersV1&CoreTransactionProvidersV2);
 };
 const withRequestScope=async<T>(selection:{context_id:string;workspace_id:string;offering_id:string},
  operation:(scope:CoreTransactionScopeV1,ports:ReturnType<typeof createServiceOfferingRequestSourcePortsV1>)=>Promise<T>)=>{
  const selected=z.strictObject({context_id:uuid,workspace_id:uuid,offering_id:uuid}).parse(selection);
  const claims=await authenticate(),state={authorized:false};
  const readCommand={...selected,permission_code:'services.orders.request',module_code:'services_orders',authority_version:1};
  const client=await makeConnect(readCommand,claims,state)();let live=false,settled=false,pending=0,first:unknown,failed=false,readError:unknown,hasReadError=false;
  const query=async<Row extends QueryResultRow=QueryResultRow>(sql:string,values:unknown[]=[])=>client.query<Row>(sql,values);
  try{
   await query('begin isolation level serializable');
   await query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`aggregate:${selected.workspace_id}:service_request:${selected.offering_id}`]);
   const workspace=await query('select id from platform.customer_workspaces where id=$1::uuid for share',[selected.workspace_id]);
   const offering=await query('select id from service_catalog.offerings where id=$1::uuid and workspace_id=$2::uuid for share',[selected.offering_id,selected.workspace_id]);
   if(workspace.rowCount!==1||offering.rowCount!==1)fail('READ_SCOPE_DENIED');
   const epoch=await query('select revision::text from app_private.canonical_authority_revision_v1 where singleton for share');
   readCommand.authority_version=z.coerce.number().int().positive().safe().parse(epoch.rows[0]?.revision);
   if(epoch.rowCount!==1)fail('READ_SCOPE_DENIED');
   const meta=await query(`select txid_current()::text as database_transaction_id,auth.uid()::text as actor_id,
    app_private.active_tenant_id()::text as tenant_id,
    to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at`);
   const m=z.strictObject({database_transaction_id:z.string().regex(/^[1-9][0-9]*$/),actor_id:uuid,tenant_id:uuid,at:z.iso.datetime({offset:true})}).parse(meta.rows[0]);
   if(meta.rowCount!==1||m.actor_id!==claims.sub)fail('READ_SCOPE_DENIED');
   const transaction_id=randomUUID(),command_id=randomUUID();
   const request=currentAuthorityTransactionRequestV1Schema.parse({contract_version:'core-current-authority-transaction-port-request.v1',
    decision_id:randomUUID(),context_id:selected.context_id,workspace_id:selected.workspace_id,actor_id:claims.sub,
    authority_version:readCommand.authority_version,permission_code:'services.orders.request',module_code:'services_orders',
    evaluation_purpose:'service.request.preflight',transaction_context:{transaction_id,command_id,attempt:1,isolation_level:'serializable',
     lock:{kind:'command_aggregate',workspace_id:selected.workspace_id,aggregate_type:'service_request',aggregate_id:selected.offering_id,acquired_at:m.at}}});
   const allowed=new Set(queryCensus.queries.map(item=>item.sql));
   const scope:CoreTransactionScopeV1=Object.freeze({transaction_id,database_transaction_id:m.database_transaction_id,tenant_id:m.tenant_id,
    workspace_id:selected.workspace_id,actor_id:claims.sub,attempt:1,
    async query<Row extends QueryResultRow>(sql:string,values:unknown[]=[]){
     if(!live||!allowed.has(sql)||pending!==0){if(!failed){failed=true;first=new CoreFunctionalRuntimeUnavailableV1('READ_QUERY_NOT_ADMITTED');}throw first;}
     pending++;
     try{return await query<Row>(sql,values);}catch(error){if(!failed){failed=true;first=error;}throw error;}finally{pending--;}
    }});
   live=true;
   const initial=await producers.resolveAuthority(scope,request);
   if(initial.decision!=='allowed')fail('READ_SCOPE_DENIED');state.authorized=true;
   const ports=createServiceOfferingRequestSourcePortsV1(scope,{resolveProviderAgreement:producers.readers.resolveProviderAgreement,
    authorityRequestFor(_scope,input){if(_scope!==scope||input.context_id!==selected.context_id||input.workspace_id!==selected.workspace_id
     ||input.offering_id!==selected.offering_id)fail('READ_SCOPE_DENIED');return{...request,decision_id:randomUUID(),evaluation_purpose:input.purpose};}});
   const value=await operation(scope,ports);live=false;if(failed)throw first;if(pending!==0)fail('READ_PENDING_QUERY');
   const detached=structuredClone(value);
   // A final query renews session/authority after ALL callback waits. It is NOT a
   // C03 reservation, command receipt, domain/audit/outbox write or new commit.
   await query(CORE_FUNCTIONAL_RUNTIME_SQL.checkpoint,[selected.context_id,selected.workspace_id,readCommand.permission_code,readCommand.module_code,readCommand.authority_version]);
   const rollback=await query('rollback');if(rollback.command!=='ROLLBACK')fail('READ_ROLLBACK_UNKNOWN');settled=true;
   state.authorized=false;
   const completed=await query(`select pg_backend_pid() as backend_pid,to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at`);
   const completed_at=z.iso.datetime({offset:true}).parse(completed.rows[0]?.at);
   if(completed.rowCount!==1||completed.rows[0]?.backend_pid!==leasePids.get(client))fail('READ_CLOCK_UNAVAILABLE');
   return {value:detached,completed_at};
  }catch(error){live=false;readError=error;hasReadError=true;let rollback_error:unknown;if(!settled)try{const ack=await query('rollback');settled=ack.command==='ROLLBACK';}catch(cleanup){rollback_error=cleanup;}
   if(typeof error==='object'&&error!==null)readFailures.set(error,Object.freeze({settlement:settled?'rolled_back':'unknown',cleanup:'destroy_requested',rollback_error}));throw error;}
  finally{live=false;try{client.release(true);}catch(cleanup){if(!hasReadError)throw cleanup;
   if(typeof readError==='object'&&readError!==null){const prior=readFailures.get(readError);readFailures.set(readError,Object.freeze({settlement:prior?.settlement??'unknown',cleanup:'destroy_requested',rollback_error:prior?.rollback_error,cleanup_error:cleanup}));}}}
 };
 /** Closed app reads use the same authenticated lease and canonical SQL gate.
  * No caller query/callback, command lock, reservation or synthetic receipt.
  */
 const readServiceApp=async(kind:'selections'|'catalog'|'requests'|'definitions',input?:{context_id:string;workspace_id:string})=>{
  if(!['selections','catalog','requests','definitions'].includes(kind)||(kind==='selections'&&input!==undefined))return fail('READ_KIND_NOT_ADMITTED');
  const selected=kind==='selections'?null:z.strictObject({context_id:uuid,workspace_id:uuid}).parse(input);
  const permission=kind==='definitions'?'services.catalog.manage':kind==='catalog'?'services.catalog.read':'services.orders.read',moduleCode=kind==='catalog'||kind==='definitions'?'services_catalog':'services_orders';
  const claims=await authenticate(),state={authorized:false};
  const command=selected?{...selected,permission_code:permission,module_code:moduleCode,authority_version:1}:null;
  const client=await makeConnect(command,claims,state)();let settled=false,first:unknown;
  try{
   await client.query('begin isolation level serializable');
   if(command){
    const epoch=await client.query('select revision::text from app_private.canonical_authority_revision_v1 where singleton for share');
    if(epoch.rowCount!==1)fail('READ_SCOPE_DENIED');command.authority_version=z.coerce.number().int().positive().safe().parse(epoch.rows[0].revision);
    await client.query(CORE_FUNCTIONAL_RUNTIME_SQL.checkpoint,[command.context_id,command.workspace_id,permission,moduleCode,command.authority_version]);state.authorized=true;
   }
   const sql=kind==='definitions'?'select customer_api.list_service_definitions_v1($1::uuid,$2::uuid) as value'
    :kind==='selections'?'select app_private.list_core_service_selections_v1() as value'
    :kind==='catalog'?'select customer_api.list_service_catalog_v1($1::uuid,$2::uuid) as value'
     :'select customer_api.read_service_requests_v1($1::uuid,$2::uuid) as value';
   const r=await client.query(sql,selected?[selected.context_id,selected.workspace_id]:[]);if(r.rowCount!==1)fail('READ_SOURCE_INVARIANT');
   const value=structuredClone(r.rows[0].value);
   // query proxy rechecks scoped authority after the RPC and before settlement.
   // Discovery's SQL gate rechecks all returned tuples after its final row wait.
   await client.query(CORE_FUNCTIONAL_RUNTIME_SQL.session);
   const ack=await client.query('rollback');if(ack.command!=='ROLLBACK')fail('READ_ROLLBACK_UNKNOWN');settled=true;state.authorized=false;
   const clock=await client.query(`select pg_backend_pid() as backend_pid,to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at`);
   if(clock.rowCount!==1||clock.rows[0].backend_pid!==leasePids.get(client))fail('READ_CLOCK_UNAVAILABLE');
   return{value,completed_at:z.iso.datetime({offset:true}).parse(clock.rows[0].at)};
  }catch(error){first=error;let rollback_error:unknown;if(!settled)try{const ack=await client.query('rollback');settled=ack.command==='ROLLBACK';}catch(e){rollback_error=e;}
   if(error!==null&&typeof error==='object')readFailures.set(error,Object.freeze({settlement:settled?'rolled_back':'unknown',cleanup:'destroy_requested',rollback_error}));throw error;
  }finally{try{client.release(true);}catch(error){if(!first)throw error;}}
 };
 /** Closed command-preparation identity read. No domain/provider callback,
  * command reservation, reusable scope, receipt, or mutation is exposed. */
 const resolveCommandIdentity=async(value:unknown)=>{
  const selected=coreDomainCommandIdentitySelectionV1Schema.parse(value),claims=await authenticate();
  const state:{authorized:boolean;binding?:{workspace_id:string;tenant_id:string;membership_id:string}}={authorized:false},command={...selected,authority_version:1};
  const client=await makeConnect(command,claims,state)();let settled=false,first:unknown,failed=false;
  try{
   await client.query('begin isolation level serializable');
   const epoch=await client.query('select revision::text from app_private.canonical_authority_revision_v1 where singleton for share');
   if(epoch.rowCount!==1)fail('READ_SCOPE_DENIED');
   command.authority_version=z.coerce.number().int().positive().safe().parse(epoch.rows[0]?.revision);
   const args=[command.context_id,command.workspace_id,command.permission_code,command.module_code,command.authority_version];
   await client.query(CORE_FUNCTIONAL_RUNTIME_SQL.checkpoint,args);state.authorized=true;
   const resolved=await client.query(CORE_FUNCTIONAL_RUNTIME_SQL.resolve,[selected.context_id,selected.workspace_id]);
   const binding=z.strictObject({workspace_id:uuid,tenant_id:uuid,membership_id:uuid}).parse(resolved.rows[0]);
   if(resolved.rowCount!==1||binding.workspace_id!==selected.workspace_id||!state.binding
    ||binding.tenant_id!==state.binding.tenant_id||binding.membership_id!==state.binding.membership_id)fail('SCOPE_DENIED');
   const clockSQL=`select pg_backend_pid() as backend_pid,to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at`;
   const observed=await client.query(clockSQL);
   if(observed.rowCount!==1||observed.rows[0]?.backend_pid!==leasePids.get(client))fail('READ_CLOCK_UNAVAILABLE');
   const evaluated_at=z.iso.datetime({offset:true}).parse(observed.rows[0].at);
   // Fresh canonical session/authority check after all source and clock waits.
   await client.query(CORE_FUNCTIONAL_RUNTIME_SQL.checkpoint,args);
   const ack=await client.query('rollback');if(ack.command!=='ROLLBACK')fail('READ_ROLLBACK_UNKNOWN');settled=true;state.authorized=false;
   const completed=await client.query(clockSQL);
   if(completed.rowCount!==1||completed.rows[0]?.backend_pid!==leasePids.get(client))fail('READ_CLOCK_UNAVAILABLE');
   return Object.freeze(coreDomainCommandIdentityV1Schema.parse({contract_version:'core-domain-command-identity.v1',
    ...selected,...binding,actor_id:claims.sub,authority_version:command.authority_version,evaluated_at,
    completed_at:completed.rows[0].at,action_authorization:'not_evaluated',reusable_as_authority:false}));
  }catch(error){failed=true;first=error;let rollback_error:unknown;if(!settled)try{const ack=await client.query('rollback');settled=ack.command==='ROLLBACK';}catch(cleanup){rollback_error=cleanup;}
   if(error!==null&&typeof error==='object')readFailures.set(error,Object.freeze({settlement:settled?'rolled_back':'unknown',cleanup:'destroy_requested',rollback_error}));throw error;
  }finally{try{client.release(true);}catch(cleanup){if(!failed)throw cleanup;
   if(first!==null&&typeof first==='object'){const prior=readFailures.get(first);readFailures.set(first,Object.freeze({settlement:prior?.settlement??'unknown',cleanup:'destroy_requested',rollback_error:prior?.rollback_error,cleanup_error:cleanup}));}}}
 };
 const host=Object.freeze({contract_version:'core-transaction-host.v1' as const,execute}) as CoreTransactionHostV1;
 return Object.freeze({host,executeDocumentsReplayOnly(command:unknown,providers:CoreTransactionProvidersV1){return execute(command,providers,true);},readers:producers.readers,withRequestScope,readServiceApp,resolveCommandIdentity,async verifyServerSession(){await authenticate();},contract:CORE_FUNCTIONAL_COMMAND_RUNTIME_V1});
}
/** No query runner is exported. Row type import preserves the real pg ABI. */
export type CoreFunctionalRuntimeRowV1=QueryResultRow;
