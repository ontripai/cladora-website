/** Private, inactive Core port. Imports cannot activate a route or transaction. */
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {QueryResultRow} from 'pg';
import type {CoreTransactionScopeV1} from './postgres-transaction-host-v1';
import {coreTransactionReceiptV2Schema} from './postgres-transaction-host-v1';
import {resolveAuthority,CoreAuthorityProviderUnavailableV1} from './current-authority-postgres-provider-v1';
import {bindCanonicalCurrentAuthorityObservationV1,currentAuthorityTransactionRequestV1Schema} from './current-authority-transaction-port-v1';
import {coreCe012StoredRelationRequestV1Schema,CORE_CE012_STORED_RELATION_SQL} from './ce012-stored-relation-v1';
import {readCoreCe012CombinedRelationV1,CORE_CE012_SAVE_RELATION_SQL} from './ce012-combined-stored-relation-v1';
import {coreTransactionReplayReceiptHashV1} from './transaction-replay-provider-hook-v1';

export const CORE_CE012_TERMINAL_AUTHORITY_PORT_V1='core-ce012-terminal-authority-port.v1' as const;
export const CORE_CE012_TERMINAL_RUNTIME_BINDING=null;
const uuid=z.string().uuid();
const stamp=z.iso.datetime({offset:true}).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
const positive=z.number().int().positive().safe();
const clockRow=z.strictObject({database_transaction_id:z.string().regex(/^[1-9][0-9]*$/),actor_id:uuid,
  isolation:z.literal('serializable'),backend_pid:positive,evaluated_at:stamp});
const finalRow=clockRow.extend({tenant_id:uuid,workspace_id:uuid,membership_id:uuid,
  authority_revision:z.string().regex(/^[1-9][0-9]*$/),ce_allowed:z.boolean(),docs_allowed:z.boolean(),
  aal:z.enum(['aal1','aal2']),session_guard:z.unknown(),unexpired:z.boolean(),
  ce_module_id:uuid,ce_entitlement_key:z.string().nullable(),docs_module_id:uuid,docs_entitlement_key:z.string().nullable()});

/** Source-only SELECTs on the supplied existing scope; never BEGIN/COMMIT or DML.
 * The _at helpers are the existing canonical evaluator/session implementation.
 * evaluated_at is sampled by PostgreSQL AFTER all preceding awaited statements.
 * Internal evaluator/catalog waits and elapsed rule validity are NOT certified by
 * this sample: the opaque observation below deliberately grants no disclosure.
 */
export const CORE_CE012_TERMINAL_SQL=Object.freeze({
  session:'select app_private.require_request_session_current_at_v1(clock_timestamp()) as session_guard',
  lock:`select g.id::text as context_id,m.user_id::text as actor_id,m.tenant_id::text,
    m.id::text as membership_id,w.id::text as workspace_id from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join platform.customer_workspaces w on w.id=$2::uuid and w.tenant_id=m.tenant_id
    where g.id=$1::uuid for share of g,m,w`,
  clock:`select txid_current()::text as database_transaction_id,auth.uid()::text as actor_id,
    current_setting('transaction_isolation') as isolation,pg_backend_pid() as backend_pid,
    to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as evaluated_at`,
  final:`select * from (with sampled as materialized (select clock_timestamp() as at),
    resolved as materialized (select s.at,r.workspace_id,r.tenant_id,r.membership_id,
      app_private.require_request_session_current_at_v1(s.at) as session_guard
      from sampled s cross join lateral
      app_private.resolve_workspace_native_context_v2_at_v1($1::uuid,$2::uuid,s.at) r),
    checked as materialized (select r.*,
      app_private.check_workspace_native_permission_v2_at_v1($1::uuid,$2::uuid,'experience.guide.manage','experience_guides',r.at) as ce_allowed,
      app_private.check_workspace_native_permission_v2_at_v1($1::uuid,$2::uuid,'documents.vault.read','documents',r.at) as docs_allowed
      from resolved r)
    select txid_current()::text as database_transaction_id,auth.uid()::text as actor_id,
      current_setting('transaction_isolation') as isolation,pg_backend_pid() as backend_pid,
      to_char(c.at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as evaluated_at,
      c.tenant_id::text,c.workspace_id::text,c.membership_id::text,
      (select revision::text from app_private.canonical_authority_revision_v1 where singleton) as authority_revision,
      c.ce_allowed,c.docs_allowed,auth.jwt()->>'aal' as aal,c.session_guard,
      ($3::timestamptz>c.at) as unexpired,
      ce.id::text as ce_module_id,ce.entitlement_key as ce_entitlement_key,
      d.id::text as docs_module_id,d.entitlement_key as docs_entitlement_key
    from checked c join platform.module_definitions ce on ce.code='experience_guides'
      and ce.is_active and ce.lifecycle_status in ('active','published')
      and ce.valid_from<=c.at and (ce.valid_to is null or ce.valid_to>c.at)
    join platform.module_definitions d on d.code='documents' and d.is_active
      and d.lifecycle_status in ('active','published')
      and d.valid_from<=c.at and (d.valid_to is null or d.valid_to>c.at)) as core_terminal_observation`,
});
const lockedRow=z.strictObject({context_id:uuid,actor_id:uuid,tenant_id:uuid,membership_id:uuid,workspace_id:uuid});
type Binding=Readonly<{
  transaction_id:string;database_transaction_id:string;attempt:number;backend_pid:number;
  actor_id:string;tenant_id:string;context_id:string;workspace_id:string;membership_id:string;
  command_id:string;canonical_key:string;command_hash:string;authority_revision:number;
  ce_receipt_id:string;core_receipt_id:string;core_receipt_hash:string;mutation_id:string;
  target:Readonly<{document_id:string;document_version_id:string;document_version:number}>;
}>;
export type CoreCe012TerminalBindingV1=Binding;
export type CoreCe012TerminalObservationV1=Readonly<{contract:'core-ce012-terminal-observation.v1'}>;
type Status='observed'|'denied'|'mismatch'|'expired'|'unavailable';
export type CoreCe012TerminalResultV1=Readonly<{contract:typeof CORE_CE012_TERMINAL_AUTHORITY_PORT_V1;
  status:'not_ready';core_status:Status;observation:CoreCe012TerminalObservationV1|null;
  documents_projection:null;action_authorization:'not_evaluated'}>;
const result=(core_status:Status,observation:CoreCe012TerminalObservationV1|null=null):CoreCe012TerminalResultV1=>Object.freeze({
  contract:CORE_CE012_TERMINAL_AUTHORITY_PORT_V1,status:'not_ready',core_status,observation,
  documents_projection:null,action_authorization:'not_evaluated'});
const state=(error:unknown)=>typeof error==='object'&&error!==null&&'code' in error?error.code:undefined;
class BindingFailure extends Error{}

/** Trusted host/provider integration only. `scope` is NOT a public JSON input.
 * No authority/time/verifier callback or injected provider is accepted. Existing
 * resolveAuthority + binder execute internally; observation objects are WeakMap
 * identities, not serialized permissions. The old host provides no lifecycle
 * registration hook, so NO observation is admitted as settlement/disclosure proof.
 */
export function createCoreCe012TerminalAuthorityPortV1(scope:CoreTransactionScopeV1,value:unknown){
  const parsed=coreCe012StoredRelationRequestV1Schema.safeParse(value);
  const input=parsed.success?structuredClone(parsed.data):null;
  const bound={transaction_id:scope.transaction_id,database_transaction_id:scope.database_transaction_id,
    tenant_id:scope.tenant_id,workspace_id:scope.workspace_id,actor_id:scope.actor_id,attempt:scope.attempt};
  const unchanged=()=>Object.entries(bound).every(([k,v])=>scope[k as keyof typeof bound]===v);
  let closed=false,busy=false,generation=0,pending=0,first:unknown,failed=false;
  const observations=new WeakMap<CoreCe012TerminalObservationV1,{generation:number;binding:Binding;evaluated_at:string}>();
  const invalidate=()=>{generation++;};
  const fail=(error:unknown)=>{if(!failed){first=error;failed=true;}invalidate();};
  function ensure(){if(failed)throw first;if(closed||!unchanged())throw new BindingFailure();}
  async function query<Row extends QueryResultRow=QueryResultRow>(text:string,values:unknown[]=[]){
    ensure();try{const rows=await scope.query<Row>(text,values);ensure();return rows;}catch(error){fail(error);throw error;}
  }
  // This is an existing trusted-provider scope facade, NOT a public SQL sandbox.
  // All owner reads MUST use it once this port is installed. A new read invalidates
  // the previous premise before it starts (even while its promise is pending).
  const trackedScope:CoreTransactionScopeV1=Object.freeze({...bound,async query<Row extends QueryResultRow=QueryResultRow>(text:string,values:unknown[]=[]){
    invalidate();if(busy)throw new BindingFailure();ensure();pending++;
    try{return await query<Row>(text,values);}catch(error){fail(error);throw error;}finally{pending--;}
  }});
  async function checkpoint():Promise<CoreCe012TerminalResultV1>{
    invalidate();if(busy||pending) return result('unavailable');
    busy=true;
    try{
      ensure();
      if(!input||!uuid.safeParse(bound.tenant_id).success||!positive.safeParse(bound.attempt).success
        ||input.command.transaction_id!==bound.transaction_id||input.command.actor_id!==bound.actor_id
        ||input.command.workspace_id!==bound.workspace_id)return result('mismatch');
      const c=input.command,guide=input.guide_command,target=guide.payload.document_target;
      const initialSession=await query(CORE_CE012_TERMINAL_SQL.session);
      if(initialSession.rowCount!==1||initialSession.rows.length!==1||!Object.hasOwn(initialSession.rows[0],'session_guard'))return result('unavailable');
      const integrity=await readCoreCe012CombinedRelationV1(trackedInternalScope,input);ensure();
      if(integrity.integrity!=='matched_candidate')return result(integrity.integrity==='expired'?'expired':integrity.integrity==='mismatch'?'mismatch':'unavailable');
      if(!target)return result('mismatch');
      const key=`core-tx.v1:${c.workspace_id}:${c.idempotency_key}`;
      const hash=createHash('sha256').update(JSON.stringify(c)).digest('hex');
      const ledger=await query(CORE_CE012_STORED_RELATION_SQL,[bound.tenant_id,key]);
      const row=ledger.rows[0],receipt=coreTransactionReceiptV2Schema.safeParse(row?.response_ref);
      if(ledger.rowCount!==1||ledger.rows.length!==1||!receipt.success||!stamp.safeParse(row.expires_at).success)return result('unavailable');
      const ce=await query(CORE_CE012_SAVE_RELATION_SQL,[bound.tenant_id,bound.workspace_id,key]);
      // The official composition has already validated the full relation. Rebind
      // extracted identity to the actual locked C03/CE rows, never caller IDs alone.
      if(ce.rowCount!==1||ce.rows.length!==1||row.request_hash!==hash||row.actor_id!==bound.actor_id
        ||row.tenant_id!==bound.tenant_id||row.key!==key||ce.rows[0].mutation_id!==receipt.data.mutation_id
        ||ce.rows[0].ce_receipt?.receipt_id!==input.expected.ce_save_receipt_id
        ||receipt.data.receipt_id!==input.expected.core_receipt_id
        ||coreTransactionReplayReceiptHashV1(receipt.data)!==input.expected.core_receipt_hash)return result('mismatch');
      const locked=await query(CORE_CE012_TERMINAL_SQL.lock,[c.context_id,c.workspace_id]);
      const l=lockedRow.safeParse(locked.rows[0]);
      if(locked.rowCount!==1||locked.rows.length!==1||!l.success||l.data.actor_id!==bound.actor_id
        ||l.data.tenant_id!==bound.tenant_id||l.data.workspace_id!==bound.workspace_id||l.data.context_id!==c.context_id)return result('denied');
      const sampled=await query(CORE_CE012_TERMINAL_SQL.clock);
      const start=clockRow.safeParse(sampled.rows[0]);
      if(sampled.rowCount!==1||sampled.rows.length!==1||!start.success)return result('unavailable');
      if(start.data.database_transaction_id!==bound.database_transaction_id||start.data.actor_id!==bound.actor_id)return result('mismatch');
      const authority=[];
      for(const [permission,module] of [['experience.guide.manage','experience_guides'],['documents.vault.read','documents']]){
        const request=currentAuthorityTransactionRequestV1Schema.parse({contract_version:'core-current-authority-transaction-port-request.v1',
          decision_id:randomUUID(),context_id:c.context_id,workspace_id:c.workspace_id,actor_id:c.actor_id,
          authority_version:c.authority_version,permission_code:permission,module_code:module,evaluation_purpose:'ce012.terminal.read',
          transaction_context:{transaction_id:c.transaction_id,command_id:c.command_id,attempt:bound.attempt,isolation_level:'serializable',
            lock:{kind:'command_aggregate',workspace_id:c.workspace_id,aggregate_type:c.aggregate_type,aggregate_id:c.aggregate_id,acquired_at:start.data.evaluated_at}}});
        const observation=await resolveAuthority(trackedInternalScope,request);
        const decision=bindCanonicalCurrentAuthorityObservationV1(request,observation);
        if(decision.decision!=='allowed'||!decision.entitlement)return result('denied');
        authority.push(decision.entitlement);
      }
      // All earlier row locks/provider waits have completed BEFORE this statement.
      // Same _at instant for canonical permission, session and locked-row expiry.
      const final=await query(CORE_CE012_TERMINAL_SQL.final,[c.context_id,c.workspace_id,row.expires_at]);
      const f=finalRow.safeParse(final.rows[0]);
      if(final.rowCount!==1||final.rows.length!==1||!f.success||!Object.hasOwn(final.rows[0],'session_guard'))return result('unavailable');
      const x=f.data;
      if(x.actor_id!==bound.actor_id||x.tenant_id!==bound.tenant_id||x.workspace_id!==bound.workspace_id
        ||x.membership_id!==l.data.membership_id||x.database_transaction_id!==bound.database_transaction_id
        ||x.backend_pid!==start.data.backend_pid||x.authority_revision!==String(c.authority_version)
        ||x.evaluated_at<start.data.evaluated_at
        ||x.ce_module_id!==authority[0].module_definition_id||x.ce_entitlement_key!==authority[0].entitlement_key
        ||x.docs_module_id!==authority[1].module_definition_id||x.docs_entitlement_key!==authority[1].entitlement_key)return result('mismatch');
      if(!x.unexpired)return result('expired');
      if(!x.ce_allowed||!x.docs_allowed)return result('denied');
      const binding:Binding=Object.freeze({...bound,context_id:c.context_id,membership_id:l.data.membership_id,
        backend_pid:x.backend_pid,command_id:c.command_id,canonical_key:key,command_hash:hash,authority_revision:c.authority_version,
        ce_receipt_id:input.expected.ce_save_receipt_id,core_receipt_id:receipt.data.receipt_id,
        core_receipt_hash:input.expected.core_receipt_hash,mutation_id:receipt.data.mutation_id,
        target:Object.freeze({document_id:target.document_id,document_version_id:target.document_version_id,document_version:target.document_version})});
      const observation=Object.freeze({contract:'core-ce012-terminal-observation.v1' as const});
      observations.set(observation,{generation,binding,evaluated_at:x.evaluated_at});
      return result('observed',observation);
    }catch(caught){
      const error=failed?first:caught;
      if(state(error)==='40001'){fail(error);throw error;}
      if(error instanceof BindingFailure)return result('mismatch');
      if(error instanceof CoreAuthorityProviderUnavailableV1)return result(['ACTOR_REVOKED','AUTHORITY_DENIED'].includes(error.code)?'denied':'unavailable');
      if(state(error)==='42501'){fail(error);return result('denied');}
      // Unknown, timeout, cancellation and host/settlement errors stay errors; no
      // catch-all converts them into a successful source/authority observation.
      fail(error);throw error;
    }finally{busy=false;}
  }
  // Internal reads participate in first-failure/scope checks but cannot invalidate
  // themselves; concurrent external reads while checkpoint runs are rejected.
  const trackedInternalScope:CoreTransactionScopeV1=Object.freeze({...bound,query});
  return Object.freeze({contract:CORE_CE012_TERMINAL_AUTHORITY_PORT_V1,scope:trackedScope,checkpoint,
    inspect(observation:CoreCe012TerminalObservationV1){
      const item=observations.get(observation);
      if(!item||closed||failed||!unchanged()||item.generation!==generation)return Object.freeze({status:'invalidated' as const});
      return Object.freeze({status:'core_observed_not_ready' as const,binding:item.binding,evaluated_at:item.evaluated_at,
        terminal_wait_coverage:'not_ready' as const,settlement:'not_observed' as const,documents_projection:null});
    },
    close(){closed=true;invalidate();},
  });
}

export type CoreCe012TerminalAuthorityPortV1=ReturnType<typeof createCoreCe012TerminalAuthorityPortV1>;
