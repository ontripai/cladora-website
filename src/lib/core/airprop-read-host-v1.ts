import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Pool,PoolClient,QueryResult,QueryResultRow} from 'pg';
import {createClient} from '../supabase/server';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import {admitCoreAirpropReadSelectorQueryV1} from './airprop-read-selector-queries-v1';

declare const liveReadObservation:unique symbol;
export type CoreAirpropReadObservationV1=Readonly<{contract:'core-airprop-read-observation.v1';[liveReadObservation]:true}>;
type ReadObservationInfo=Readonly<{context_id:string;workspace_id:string;tenant_id:string;membership_id:string;actor_id:string;
 database_transaction_id:string;backend_pid:number;authority_revision:string;checked_at:string;scope_expires_at:string;
 permission:'airprop.asset.read';module:'airprop_commercial';purpose:'airprop.portfolio.read'}>;
const observations=new WeakMap<object,{scope:CoreTransactionScopeV1;sequence:number;info:ReadObservationInfo}>();
const liveReads=new WeakMap<CoreTransactionScopeV1,{checkpoint:()=>Promise<CoreAirpropReadObservationV1>;current:(n:number)=>boolean}>();
/** Only the actual host scope can acquire a real checkpoint. No JSON/allow input. */
export async function checkpointCoreAirpropReadScopeV1(scope:CoreTransactionScopeV1){
 const port=liveReads.get(scope);if(!port)throw new CoreReadHostUnavailableV1('READ_SCOPE_NOT_HOST_ISSUED');return port.checkpoint();
}
/** Read-only historical matching within the still-live query generation. */
export function inspectCoreAirpropReadObservationV1(scope:CoreTransactionScopeV1,value:unknown):ReadObservationInfo|null{
 if(!value||typeof value!=='object')return null;const record=observations.get(value);
 return record&&record.scope===scope&&liveReads.get(scope)?.current(record.sequence)?record.info:null;
}

export const CORE_AIRPROP_READ_HOST_V1='core-airprop-read-host.v1' as const;
export const CORE_AIRPROP_READ_HOST_RUNTIME_BINDING=null;
export const CORE_AIRPROP_READ_CONSUMER='2981ec440e5978724c8da373800e9b1913f63905';
const uuid=z.string().uuid().transform(x=>x.toLowerCase());
const requestedSchema=z.strictObject({context_id:uuid,workspace_id:uuid});
const claimsSchema=z.object({sub:uuid,session_id:uuid,exp:z.number().int().positive().safe(),aal:z.enum(['aal1','aal2']),role:z.literal('authenticated')});
const stamp=z.iso.datetime({offset:true}).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const pid=z.number().int().positive().safe();
const scopeRow=z.strictObject({context_id:uuid,workspace_id:uuid,tenant_id:uuid,membership_id:uuid,actor_id:uuid});
const observed=scopeRow.extend({database_transaction_id:z.string().regex(/^[1-9][0-9]*$/),backend_pid:pid,authority_revision:z.string().regex(/^[1-9][0-9]*$/),allowed:z.boolean(),scope_current:z.boolean(),checked_at:stamp,scope_expires_at:stamp,session_guard:z.unknown()});
export type CoreReadServerScopeV1=Readonly<z.infer<typeof requestedSchema>&{actor_id:string;tenant_id:string}>;
export interface CoreAirpropReadHostV1 {
  readonly contract_version:typeof CORE_AIRPROP_READ_HOST_V1;
  withScope<T>(actorId:string,requested:unknown,read:(scope:CoreTransactionScopeV1,server:CoreReadServerScopeV1)=>Promise<T>):Promise<{value:T;completed_at:string}>;
}
type Stage='authenticate'|'checkout'|'setup'|'scope'|'callback'|'final'|'commit'|'clock'|'rollback'|'cleanup';
type Settlement='not_started'|'unknown'|'rolled_back'|'committed';
export interface CoreReadFailureInfoV1 {readonly stage:Stage;readonly settlement:Settlement;readonly cleanup_errors:readonly unknown[];readonly cleanup_status:'not_required'|'acknowledged'|'unknown';}
const failures=new WeakMap<object,CoreReadFailureInfoV1>();
export function coreReadFailureInfoV1(error:object){return failures.get(error);}
export class CoreReadHostUnavailableV1 extends Error {constructor(readonly code:string){super(code);this.name='CoreReadHostUnavailableV1';}}
function fail(code:string):never{throw new CoreReadHostUnavailableV1(code);}
// Duration budgets only, never clocks, TTLs, leases or freshness evidence.
export const CORE_READ_HOST_BUDGETS=Object.freeze({wire_ms:15000,callback_ms:15000,cleanup_ms:5000});
async function bounded<T>(operation:Promise<T>,ms:number):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new CoreReadHostUnavailableV1('READ_HOST_TIMEOUT')),ms);})]);}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
export const CORE_READ_HOST_SQL=Object.freeze({
  principal:`select current_user::text as executor,session_user::text as runtime,
    r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication from pg_roles r where r.rolname=current_user`,
  identity:`select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true),
    set_config('request.jwt.claim.aal',$3,true),set_config('request.jwt.claim.role','authenticated',true),
    set_config('request.cladora.context_id',$4,true),set_config('request.cladora.workspace_id',$5,true)`,
  session:'select app_private.lock_core_request_session_v1()',
  revision:'select revision::text from app_private.canonical_authority_revision_v1 where singleton for share',
  resolve:`select workspace_id::text,tenant_id::text,membership_id::text
    from app_private.resolve_workspace_native_context_v2($1::uuid,$2::uuid)`,
  lock:`select g.id::text as context_id,w.id::text as workspace_id,m.tenant_id::text,m.id::text as membership_id,m.user_id::text as actor_id
    from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join platform.customer_workspaces w on w.id=$2::uuid and w.tenant_id=m.tenant_id
    where g.id=$1::uuid for share of g,m,w`,
  guard:`select * from (with resolved as materialized (
      select r.* from app_private.resolve_workspace_native_context_v2($1::uuid,$2::uuid) r),
    evaluated as materialized (select r.workspace_id,r.tenant_id,r.membership_id,
      app_private.check_workspace_native_permission_v2($1::uuid,$2::uuid,'airprop.asset.read','airprop_commercial') as allowed,
      app_private.require_request_session_current_at_v1(clock_timestamp()) as session_guard from resolved r),
    source as materialized (select e.*,g.id as context_id,m.user_id as actor_id,g.starts_at as gs,g.ends_at as ge,
      m.starts_at as ms,m.ends_at as me,m.status,w.lifecycle_status,w.archived_at,
      txid_current()::text as database_transaction_id,pg_backend_pid() as backend_pid,
      (select revision::text from app_private.canonical_authority_revision_v1 where singleton) as authority_revision
      from evaluated e join identity.context_grants g on g.id=$1::uuid and g.tenant_id=e.tenant_id
      join identity.memberships m on m.id=e.membership_id and m.id=g.membership_id and m.tenant_id=e.tenant_id
      join platform.customer_workspaces w on w.id=e.workspace_id and w.tenant_id=e.tenant_id),
    timed as materialized (select s.*,clock_timestamp() as at from source s)
    select context_id::text,workspace_id::text,tenant_id::text,membership_id::text,actor_id::text,
      database_transaction_id,backend_pid,authority_revision,allowed,session_guard,
      (gs<=at and (ge is null or ge>at) and ms<=at and (me is null or me>at)
        and status='active' and lifecycle_status='ACTIVE' and archived_at is null and to_timestamp($3)>at) as scope_current,
      to_char(at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as checked_at,
      to_char(least(to_timestamp($3),ge,me) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as scope_expires_at
      from timed) as read_guard`,
  completed:`select pg_backend_pid() as backend_pid,
    to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as completed_at,
    ($1::timestamptz>clock_timestamp()) as unexpired`,
});
// Closed exact SQL admission, pinned to the actual owner module; not a SELECT sandbox.
const pageHash='ab4992773d4e4638a52f218b97252bcc509b92c56a0c667a43d680b9750387d2';
const clockHash='d589c6582430f861e3bba1205ebcb81765a2f089f4cc4ef3187d47d191d0ef30';
const pageParams=z.tuple([uuid,uuid,uuid.nullable(),z.number().int().min(1).max(100)]);
const principal=z.strictObject({executor:z.string(),runtime:z.string(),rolsuper:z.literal(false),rolbypassrls:z.literal(false),rolcreaterole:z.literal(false),rolcreatedb:z.literal(false),rolreplication:z.literal(false)});

/** Existing pg Pool checkout/query/release transport only. No pool/role/credential
 * construction. Principal profile is private deployment input, not an HTTP ABI;
 * AIRPROP ACL/RLS/role-graph admission remains external and runtime binding NULL.
 */
export function createCoreAirpropReadHostV1(options:Readonly<{
  pool:Pick<Pool,'connect'>|null;
  principal:Readonly<{executor:string;runtime:string}>;
}>):CoreAirpropReadHostV1{
 const pool=options.pool,profile=Object.freeze({...options.principal});
 if(!/^[a-z_][a-z0-9_]{0,62}$/.test(profile.executor)||!/^[a-z_][a-z0-9_]{0,62}$/.test(profile.runtime)
   ||['postgres','supabase_admin','supabase_auth_admin','service_role','authenticated','anon','authenticator'].some(x=>x===profile.executor||x===profile.runtime))fail('PRINCIPAL_PROFILE_NOT_READY');
 return Object.freeze({contract_version:CORE_AIRPROP_READ_HOST_V1,async withScope<T>(actorId:string,request:unknown,read:(scope:CoreTransactionScopeV1,server:CoreReadServerScopeV1)=>Promise<T>){
  let client:PoolClient|undefined,stage:Stage='authenticate',first:unknown,hasFirst=false,firstStage:Stage=stage,settlement:Settlement='not_started';
  let onClientError:((error:Error)=>void)|undefined;
  let cleanupStatus:CoreReadFailureInfoV1['cleanup_status']='not_required';
  let live=false,beginAttempted=false,commitAttempted=false,inFlight=0;
  const pending=new Set<Promise<unknown>>(),cleanupErrors:unknown[]=[];
  const note=(error:unknown,at:Stage)=>{if(!hasFirst){first=error;hasFirst=true;firstStage=at;}};
  async function wire<Row extends QueryResultRow=QueryResultRow>(text:string,values:unknown[]=[]){
   if(hasFirst&&text!=='rollback')throw first;
   inFlight++;let query:Promise<QueryResult<Row>>;
   try{query=client!.query<Row>(text,values);}catch(error){inFlight--;throw error;}
   query.then(()=>{inFlight--;},()=>{inFlight--;});
   return bounded(query,CORE_READ_HOST_BUDGETS.wire_ms);
  }
  let value:T|undefined,completedAt:string|undefined;
  try{
   if(!pool)fail('HOST_NOT_READY');
   const requested=requestedSchema.parse(request);
   const supabase=await bounded(createClient(),CORE_READ_HOST_BUDGETS.wire_ms);
   const [userResult,claimResult]=await bounded(Promise.all([supabase.auth.getUser(),supabase.auth.getClaims()]),CORE_READ_HOST_BUDGETS.wire_ms);
   if(userResult.error||claimResult.error||!userResult.data.user)fail('AUTHENTICATION_REQUIRED');
   const claims=claimsSchema.parse(claimResult.data?.claims);
   if(uuid.parse(userResult.data.user.id)!==claims.sub||uuid.parse(actorId)!==claims.sub)fail('ACTOR_BINDING_MISMATCH');
   stage='checkout';cleanupStatus='unknown';const acquisition=pool.connect();
   try{client=await bounded(acquisition,CORE_READ_HOST_BUDGETS.wire_ms);}catch(error){
    // A timed-out checkout is not cancellation of pool.connect(). Destroy a late
    // lease; never let it become an untracked reusable authenticated connection.
    void acquisition.then(late=>{try{late.release(true);}catch(cleanup){cleanupErrors.push(cleanup);}},()=>{});throw error;
   }
   onClientError=error=>{note(error,stage);live=false;};client.on('error',onClientError);
   stage='setup';const who=await wire(CORE_READ_HOST_SQL.principal);const principalRow=principal.parse(who.rows[0]);
   if(who.rowCount!==1||principalRow.executor!==profile.executor||principalRow.runtime!==profile.runtime)fail('PRINCIPAL_PROFILE_NOT_READY');
   // Session duration limits also cover the post-COMMIT clock. The lease is always
   // destroyed, never returned with session-level settings to another request.
   await wire("set statement_timeout = '10s'");await wire("set lock_timeout = '5s'");await wire("set idle_in_transaction_session_timeout = '15s'");
   beginAttempted=true;settlement='unknown';const begun=await wire('begin isolation level serializable');if(begun.command!=='BEGIN')fail('BEGIN_ACK_INVALID');
   await wire("set local search_path = pg_catalog");
   await wire(CORE_READ_HOST_SQL.identity,[JSON.stringify(claims),claims.sub,claims.aal,requested.context_id,requested.workspace_id]);
   // Reuse the existing C01 managed-session row barrier; no synthetic lease or
   // new session evaluator. Missing helper/EXECUTE/profile compatibility denies.
   await wire(CORE_READ_HOST_SQL.session);
   stage='scope';const revision=await wire(CORE_READ_HOST_SQL.revision);
   const epoch=z.string().regex(/^[1-9][0-9]*$/).parse(revision.rows[0]?.revision);if(revision.rowCount!==1)fail('AUTHORITY_UNAVAILABLE');
   const resolved=await wire(CORE_READ_HOST_SQL.resolve,[requested.context_id,requested.workspace_id]);
   const canonical=z.strictObject({workspace_id:uuid,tenant_id:uuid,membership_id:uuid}).parse(resolved.rows[0]);
   if(resolved.rowCount!==1||canonical.workspace_id!==requested.workspace_id)fail('SCOPE_DENIED');
   const locked=await wire(CORE_READ_HOST_SQL.lock,[requested.context_id,canonical.workspace_id]);const bound=scopeRow.parse(locked.rows[0]);
   if(locked.rowCount!==1||bound.context_id!==requested.context_id||bound.workspace_id!==canonical.workspace_id||bound.tenant_id!==canonical.tenant_id||bound.membership_id!==canonical.membership_id||bound.actor_id!==claims.sub)fail('SCOPE_DENIED');
   const params=[bound.context_id,bound.workspace_id,claims.exp];
   const initial=await wire(CORE_READ_HOST_SQL.guard,params);let current=observed.parse(initial.rows[0]);
   const check=(row:z.infer<typeof observed>)=>{if(!row.allowed||!row.scope_current||row.authority_revision!==epoch||!Object.hasOwn(row,'session_guard')||Object.keys(bound).some(k=>row[k as keyof typeof bound]!==bound[k as keyof typeof bound]))fail('SCOPE_DENIED');};
   if(initial.rowCount!==1)fail('SCOPE_DENIED');check(current);
   const tx=current.database_transaction_id,backend=current.backend_pid,readId=randomUUID();
   const server:CoreReadServerScopeV1=Object.freeze({context_id:bound.context_id,workspace_id:bound.workspace_id,actor_id:bound.actor_id,tenant_id:bound.tenant_id});
   let sequence=0,checkpointPending=false;
   const scope:CoreTransactionScopeV1=Object.freeze({transaction_id:readId,database_transaction_id:tx,workspace_id:bound.workspace_id,tenant_id:bound.tenant_id,actor_id:bound.actor_id,attempt:1,
    async query<Row extends QueryResultRow>(this:CoreTransactionScopeV1,text:string,values:unknown[]=[]){
     try{
      if(!live||this!==scope||checkpointPending)fail('READ_SCOPE_CLOSED');
      const hash=createHash('sha256').update(text).digest('hex');let args:unknown[];
      if(hash===pageHash){args=pageParams.parse(structuredClone(values));if(args[0]!==bound.tenant_id||args[1]!==bound.workspace_id)fail('READ_SCOPE_FOREIGN');}
      else if(hash===clockHash){if(values.length!==0)fail('READ_QUERY_NOT_ADMITTED');args=[];}
      else {const admitted=admitCoreAirpropReadSelectorQueryV1(text,values,bound);if(admitted===null)fail('READ_QUERY_NOT_ADMITTED');args=admitted;}
      sequence++;
      const q=wire<Row>(text,args);pending.add(q);q.then(()=>pending.delete(q),error=>{note(error,'callback');pending.delete(q);});return await q;
     }catch(error){note(error,'callback');throw error;}
    }});
   liveReads.set(scope,{
    current:n=>live&&!hasFirst&&!checkpointPending&&pending.size===0&&n===sequence,
    checkpoint:()=>{
     if(!live||hasFirst||checkpointPending||pending.size!==0){
      const error=new CoreReadHostUnavailableV1('READ_CHECKPOINT_UNAVAILABLE');note(error,'callback');return Promise.reject(error);
     }
     checkpointPending=true;sequence++;
     const operation=(async()=>{try{
      const result=await wire(CORE_READ_HOST_SQL.guard,params),row=observed.parse(result.rows[0]);
      if(result.rowCount!==1||row.database_transaction_id!==tx||row.backend_pid!==backend)fail('TRANSACTION_BINDING_MISMATCH');check(row);current=row;
      if(hasFirst)throw first;if(!live)fail('READ_SCOPE_CLOSED');
      const token=Object.freeze({contract:'core-airprop-read-observation.v1'}) as CoreAirpropReadObservationV1;
      observations.set(token,{scope,sequence,info:Object.freeze({...bound,database_transaction_id:tx,backend_pid:backend,authority_revision:epoch,
       checked_at:row.checked_at,scope_expires_at:row.scope_expires_at,permission:'airprop.asset.read',module:'airprop_commercial',purpose:'airprop.portfolio.read'})});
      return token;
     }catch(error){note(error,'callback');throw error;}finally{checkpointPending=false;}})();
     pending.add(operation);operation.then(()=>pending.delete(operation),()=>pending.delete(operation));return operation;
    },
   });
   stage='callback';live=true;
   try{value=await bounded(read(scope,server),CORE_READ_HOST_BUDGETS.callback_ms);}finally{live=false;}
   await bounded(Promise.allSettled(Array.from(pending)),CORE_READ_HOST_BUDGETS.wire_ms);if(hasFirst)throw first;
   value=structuredClone(value); // Detach mutable/callback-owned response before settlement.
   if(hasFirst)throw first;
   stage='final';const final=await wire(CORE_READ_HOST_SQL.guard,params);current=observed.parse(final.rows[0]);
   if(final.rowCount!==1||current.database_transaction_id!==tx||current.backend_pid!==backend)fail('TRANSACTION_BINDING_MISMATCH');check(current);
   if(hasFirst)throw first;
   stage='commit';commitAttempted=true;const committed=await wire('commit');
   if(committed.command==='ROLLBACK'){settlement='rolled_back';fail('COMMIT_ABORTED');}
   if(committed.command!=='COMMIT')fail('COMMIT_ACK_INVALID');settlement='committed';
   stage='clock';const completion=await wire(CORE_READ_HOST_SQL.completed,[current.scope_expires_at]);
   const post=z.strictObject({backend_pid:pid,completed_at:stamp,unexpired:z.literal(true)}).parse(completion.rows[0]);
   if(completion.rowCount!==1||post.backend_pid!==backend||post.completed_at<current.checked_at)fail('COMPLETION_UNPROVEN');completedAt=post.completed_at;
  }catch(error){note(error,stage);live=false;
   // Never reinterpret a post-COMMIT rollback as undoing an unknown COMMIT.
   if(client&&beginAttempted&&settlement!=='committed'&&settlement!=='rolled_back'&&inFlight===0){
    try{const rolled=await wire('rollback');if(rolled.command!=='ROLLBACK')fail('ROLLBACK_ACK_INVALID');
     if(!commitAttempted||(typeof first==='object'&&first!==null&&'code' in first&&first.code==='40001'))settlement='rolled_back';
    }catch(cleanup){cleanupErrors.push(cleanup);}
   }
  }finally{
   live=false;
   if(client){
    stage='cleanup';let onEnd:(()=>void)|undefined,onError:((e:Error)=>void)|undefined;
    try{
     // Existing pg release(true) destroys this physical checkout. Observe its end;
     // release() returning void alone is not a successful cleanup acknowledgement.
     const ended=new Promise<void>((resolve,reject)=>{onEnd=()=>resolve();onError=e=>reject(e);client!.once('end',onEnd);client!.once('error',onError);});
     try{client.release(true);}catch(error){void ended.catch(()=>{});throw error;}
     await bounded(ended,CORE_READ_HOST_BUDGETS.cleanup_ms);cleanupStatus='acknowledged';
    }catch(cleanup){if(!hasFirst)note(cleanup,'cleanup');else cleanupErrors.push(cleanup);}
    finally{
     if(onEnd)client.removeListener('end',onEnd);if(onError)client.removeListener('error',onError);
     const lease=client,listener=onClientError;
     if(listener){if(cleanupStatus==='acknowledged')lease.removeListener('error',listener);
      else lease.once('end',()=>lease.removeListener('error',listener));}
    }
   }
  }
  if(hasFirst){const error=typeof first==='object'&&first!==null?first:new CoreReadHostUnavailableV1('READ_FAILED');failures.set(error,Object.freeze({stage:firstStage,settlement,cleanup_errors:Object.freeze(Array.from(cleanupErrors)),cleanup_status:cleanupStatus}));throw error;}
  if(completedAt===undefined)fail('COMPLETION_UNPROVEN');return{value:value as T,completed_at:completedAt};
 }});
}
