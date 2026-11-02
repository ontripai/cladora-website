/** Inactive Core-owned source proposal. No route, RPC, grant or runtime binding. */
import {z} from 'zod';
import {CoreS01UnavailableV1} from './errors-v1.ts';
import type {CoreS01OfferingDisclosurePolicyV1} from './offering-disclosure-policy-v1.ts';
export {CoreS01UnavailableV1} from './errors-v1.ts';
import {
  providerAgreementVerificationV1InputSchema,
  providerAgreementVerificationV1Schema,
  type ProviderAgreementVerificationV1,
  type ProviderAgreementVerificationV1Input,
} from '../resource-contracts-v1.ts';
import {uuidSchema} from '../../customer/workspace-composition-schema.ts';
import type {CoreTransactionScopeV1} from '../postgres-transaction-host-v1.ts';
import {resolveAuthority, CoreAuthorityProviderUnavailableV1} from '../current-authority-postgres-provider-v1.ts';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  currentAuthorityTransactionRequestV1Schema,
  type CurrentAuthorityTransactionRequestV1,
} from '../current-authority-transaction-port-v1.ts';

export const CORE_S01_RUNTIME_BINDING = null;
export const CORE_S01_SQL = Object.freeze({
  clock: `select txid_current()::text as database_transaction_id, auth.uid()::text as actor_id,
    current_setting('transaction_isolation') as isolation,
    to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as evaluated_at`,
  session: 'select app_private.require_request_session_current_at_v1(clock_timestamp())',
  final: `select * from (with allowed as materialized (select
      app_private.check_workspace_native_permission_v2($1::uuid,$2::uuid,$3::text,$4::text) as allowed),
    checked as materialized (select allowed,
      app_private.require_request_session_current_at_v1(clock_timestamp()) as session_guard from allowed)
    select txid_current()::text as database_transaction_id,auth.uid()::text as actor_id,
      current_setting('transaction_isolation') as isolation,
      to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as evaluated_at,
      allowed,session_guard,(select revision::text from app_private.canonical_authority_revision_v1 where singleton) as authority_revision
    from checked) as final_observation`,
  discover: `select id::text,tenant_id::text,workspace_id::text,provider_party_id::text,
    current_version,revision,status from platform.provider_agreement_heads_v1
    where id=$1::uuid and tenant_id=$2::uuid and workspace_id=$3::uuid`,
  head: `select id::text,tenant_id::text,workspace_id::text,provider_party_id::text,
    current_version,revision,status from platform.provider_agreement_heads_v1
    where id=$1::uuid and tenant_id=$2::uuid and workspace_id=$3::uuid for share`,
  version: `select agreement_id::text,tenant_id::text,workspace_id::text,provider_party_id::text,
    version,valid_from::text,valid_until::text,allowed_service_scope
    from platform.provider_agreement_versions_v1
    where agreement_id=$1::uuid and tenant_id=$2::uuid and workspace_id=$3::uuid and version=$4::integer for share`,
  party: `select id::text,tenant_id::text,archived_at is null as current
    from portfolio.parties where id=$1::uuid and tenant_id=$2::uuid for share`,
  workspace: `select id::text,tenant_id::text,archived_at is null and lifecycle_status='ACTIVE' as current
    from platform.customer_workspaces where id=$1::uuid and tenant_id=$2::uuid for share`,
});
const positive = z.number().int().positive().safe();
const timestamp = z.iso.datetime({offset: true});
const scopeCode = z.string().regex(/^[a-z0-9_.:-]{1,128}$/);
const headSchema = z.strictObject({
  id: uuidSchema,tenant_id: uuidSchema,workspace_id: uuidSchema,provider_party_id: uuidSchema,
  current_version: positive,revision: positive,status: z.enum(['effective','revoked','suspended']),
});
const rowSchema = z.strictObject({
  agreement_id: uuidSchema,tenant_id: uuidSchema,workspace_id: uuidSchema,provider_party_id: uuidSchema,
  version: positive,valid_from: z.iso.date(),valid_until: z.iso.date().nullable(),
  allowed_service_scope: z.array(scopeCode).min(1).max(64).refine(x=>new Set(x).size===x.length),
}).refine(x=>x.valid_until===null||x.valid_until>x.valid_from);
const identitySchema = z.strictObject({id: uuidSchema,tenant_id: uuidSchema,current: z.boolean()});
const clockSchema = z.strictObject({database_transaction_id: z.string().regex(/^\d+$/),
  actor_id: uuidSchema.nullable(),isolation: z.literal('serializable'),evaluated_at: timestamp.refine(x=>x.endsWith('Z'),'server_clock_must_be_utc')});

/** Server capabilities only, never request/user_metadata. Null source means NOT_READY.
 * The proposed date/disclosure policies require independent acceptance, not this type.
 */
export interface CoreS01BindingsV1 {
  source: null | {contract: 'core-provider-agreement-store.v1';
    date_policy: 'utc_start_inclusive_end_exclusive.operational.v1'};
  authorityRequestFor(scope: CoreTransactionScopeV1, input: ProviderAgreementVerificationV1Input):
    CurrentAuthorityTransactionRequestV1;
  offeringPolicy: CoreS01OfferingDisclosurePolicyV1;
}
const withheld = (evaluated_at: string): ProviderAgreementVerificationV1 => ({
  contract_version:'provider-agreement-verification.v1',agreement_status:'withheld',tenant_id:null,
  workspace_id:null,provider_party_id:null,provider_agreement_id:null,provider_agreement_version:null,
  valid_from:null,valid_until:null,allowed_service_scope:[],evaluated_at,action_authorization:'not_evaluated',
});
function sqlState(error: unknown) {
  return typeof error==='object'&&error!==null&&'code' in error ? error.code : undefined;
}

/** Real reader algorithm over the proposed store; no SQL is run by importing it.
 * Caller owns the exact server transaction and its settlement. No client/BEGIN/COMMIT.
 */
export function createCoreS01ProviderAgreementReaderV1(bindings: CoreS01BindingsV1) {
  const source = bindings.source === null ? null : Object.freeze({...bindings.source});
  return async function resolveProviderAgreement(scope: CoreTransactionScopeV1, value: ProviderAgreementVerificationV1Input):
    Promise<ProviderAgreementVerificationV1> {
    const parsed=providerAgreementVerificationV1InputSchema.safeParse(value);
    if (!parsed.success || !Number.isSafeInteger(parsed.data.provider_agreement_version)
      || new Set(parsed.data.requested_service_scope).size!==parsed.data.requested_service_scope.length) {
      throw new CoreS01UnavailableV1('INVALID_INPUT');
    }
    const input=structuredClone(parsed.data);
    Object.freeze(input.requested_service_scope);Object.freeze(input);
    if (source?.contract!=='core-provider-agreement-store.v1'
      ||source.date_policy!=='utc_start_inclusive_end_exclusive.operational.v1') {
      throw new CoreS01UnavailableV1('SOURCE_NOT_READY');
    }
    // S01 only: no publication, Finance, booking or resource-specific authority.
    if (input.permission_code!=='services.orders.request'
      ||input.requested_service_scope.length!==1||input.requested_service_scope[0]!=='service.request.create') {
      throw new CoreS01UnavailableV1('INVALID_INPUT');
    }
    const bound={actor_id:scope.actor_id,tenant_id:scope.tenant_id,workspace_id:scope.workspace_id,
      transaction_id:scope.transaction_id,database_transaction_id:scope.database_transaction_id,attempt:scope.attempt};
    const unchanged=()=>Object.entries(bound).every(([k,v])=>scope[k as keyof typeof bound]===v);
    const readClock=async()=>{
      const result=await scope.query(CORE_S01_SQL.clock);
      if (result.rowCount!==1||result.rows.length!==1) throw new CoreS01UnavailableV1('SOURCE_INVARIANT');
      const clock=clockSchema.parse(result.rows[0]);
      if (!unchanged()||clock.database_transaction_id!==bound.database_transaction_id) {
        throw new CoreS01UnavailableV1('SOURCE_INVARIANT');
      }
      return clock;
    };
    try {
      let clock=await readClock();
      if (input.workspace_id!==bound.workspace_id||clock.actor_id!==bound.actor_id) return withheld(clock.evaluated_at);
      const request=currentAuthorityTransactionRequestV1Schema.parse(structuredClone(bindings.authorityRequestFor(scope,input)));
      if (request.context_id!==input.context_id||request.workspace_id!==bound.workspace_id
        ||request.actor_id!==bound.actor_id||request.permission_code!==input.permission_code
        ||request.module_code!=='services_orders'||request.transaction_context.transaction_id!==bound.transaction_id
        ||request.transaction_context.attempt!==bound.attempt) return withheld(clock.evaluated_at);
      const authority=async()=>{
        await scope.query(CORE_S01_SQL.session);
        const observation=await resolveAuthority(scope,request);
        return bindCanonicalCurrentAuthorityObservationV1(request,observation).decision==='allowed';
      };
      try { if (!await authority()) return withheld(clock.evaluated_at); }
      catch (error) { if (sqlState(error)==='42501'||(error instanceof CoreAuthorityProviderUnavailableV1 && ['ACTOR_REVOKED','ACTOR_BINDING_MISMATCH','AUTHORITY_NOT_FOUND','AUTHORITY_DENIED','CROSS_WORKSPACE'].includes(error.code))) return withheld(clock.evaluated_at); throw error; }
      const disclosure=await bindings.offeringPolicy.readAndCheck(scope,input);
      if (disclosure.status!=='disclose') return withheld(clock.evaluated_at);
      const params=[input.provider_agreement_id,bound.tenant_id,bound.workspace_id];
      const discovery=await scope.query(CORE_S01_SQL.discover,params);
      if (discovery.rowCount===0&&discovery.rows.length===0) return withheld((await readClock()).evaluated_at);
      if (discovery.rowCount!==1||discovery.rows.length!==1) throw new CoreS01UnavailableV1('SOURCE_INVARIANT');
      const candidate=headSchema.parse(discovery.rows[0]);
      if(candidate.current_version!==input.provider_agreement_version)return withheld((await readClock()).evaluated_at);
      if (candidate.id!==input.provider_agreement_id||candidate.tenant_id!==bound.tenant_id||candidate.workspace_id!==bound.workspace_id) return withheld((await readClock()).evaluated_at);
      // Global order within S01: canonical party -> Workspace -> head -> version.
      const parties=await scope.query(CORE_S01_SQL.party,[candidate.provider_party_id,bound.tenant_id]);
      const workspaces=await scope.query(CORE_S01_SQL.workspace,[bound.workspace_id,bound.tenant_id]);
      const heads=await scope.query(CORE_S01_SQL.head,params);
      if (heads.rowCount===0&&heads.rows.length===0) return withheld((await readClock()).evaluated_at);
      if (heads.rowCount!==1||heads.rows.length!==1) throw new CoreS01UnavailableV1('SOURCE_INVARIANT');
      const head=headSchema.parse(heads.rows[0]);
      if(head.provider_party_id!==disclosure.provider_party_id)return withheld((await readClock()).evaluated_at);
      if (JSON.stringify(head)!==JSON.stringify(candidate)) return withheld((await readClock()).evaluated_at);
      if (head.id!==input.provider_agreement_id||head.tenant_id!==bound.tenant_id||head.workspace_id!==bound.workspace_id) {
        return withheld((await readClock()).evaluated_at);
      }
      const versions=await scope.query(CORE_S01_SQL.version,[...params,head.current_version]);
      if ([versions,parties,workspaces].some(x=>x.rowCount!==1||x.rows.length!==1)) throw new CoreS01UnavailableV1('SOURCE_INVARIANT');
      const row=rowSchema.parse(versions.rows[0]);const party=identitySchema.parse(parties.rows[0]);
      const workspace=identitySchema.parse(workspaces.rows[0]);
      // Detect a nonparticipating/malformed source port rather than disclose a stale head.
      const after=await scope.query(CORE_S01_SQL.head,params);
      if (after.rowCount!==1||after.rows.length!==1||JSON.stringify(headSchema.parse(after.rows[0]))!==JSON.stringify(head)) {
        return withheld((await readClock()).evaluated_at);
      }
      // Recheck canonical authority/session/disclosure AFTER source lock waits.
      clock=await readClock();
      try { if (!await authority()) return withheld(clock.evaluated_at); }
      catch (error) { if (sqlState(error)==='42501'||(error instanceof CoreAuthorityProviderUnavailableV1 && ['ACTOR_REVOKED','ACTOR_BINDING_MISMATCH','AUTHORITY_NOT_FOUND','AUTHORITY_DENIED','CROSS_WORKSPACE'].includes(error.code))) return withheld(clock.evaluated_at); throw error; }
      const currentDisclosure=await bindings.offeringPolicy.readAndCheck(scope,input);
      if (clock.actor_id!==bound.actor_id||!unchanged()||currentDisclosure.status!=='disclose'
        ||currentDisclosure.provider_party_id!==disclosure.provider_party_id
        ||currentDisclosure.offering_id!==disclosure.offering_id||currentDisclosure.revision_id!==disclosure.revision_id) {
        return withheld(clock.evaluated_at);
      }
      if (row.agreement_id!==head.id||row.tenant_id!==bound.tenant_id||row.workspace_id!==bound.workspace_id
        ||row.provider_party_id!==head.provider_party_id||row.version!==head.current_version
        ||party.id!==head.provider_party_id||party.tenant_id!==bound.tenant_id||!party.current
        ||workspace.id!==bound.workspace_id||workspace.tenant_id!==bound.tenant_id||!workspace.current) return withheld(clock.evaluated_at);
      // The final disclosure/source wait invalidates all earlier allows. Reuse the
      // canonical provider+binding, then one same-scope canonical/session/date observation.
      try { if (!await authority()) return withheld(clock.evaluated_at); }
      catch (error) { if (sqlState(error)==='42501'||(error instanceof CoreAuthorityProviderUnavailableV1 && ['ACTOR_REVOKED','ACTOR_BINDING_MISMATCH','AUTHORITY_NOT_FOUND','AUTHORITY_DENIED','CROSS_WORKSPACE'].includes(error.code))) return withheld(clock.evaluated_at); throw error; }
      try {
        const final=await scope.query(CORE_S01_SQL.final,[input.context_id,bound.workspace_id,input.permission_code,'services_orders']);
        if (final.rowCount!==1||final.rows.length!==1) throw new CoreS01UnavailableV1('SOURCE_INVARIANT');
        const observed=clockSchema.extend({allowed:z.boolean(),session_guard:z.unknown(),authority_revision:z.string().regex(/^\d+$/)}).parse(final.rows[0]);
        if (!Object.hasOwn(final.rows[0],'session_guard')||observed.allowed!==true
          ||observed.authority_revision!==String(request.authority_version)
          ||observed.database_transaction_id!==bound.database_transaction_id) return withheld(observed.evaluated_at);
        clock=observed;
      } catch (error) { if (sqlState(error)==='42501') return withheld(clock.evaluated_at); throw error; }
      if (clock.actor_id!==bound.actor_id||!unchanged()) return withheld(clock.evaluated_at);
      const finalTime=Date.parse(clock.evaluated_at);
      if(finalTime<Date.parse(currentDisclosure.valid_from)
        ||(currentDisclosure.valid_until!==null&&finalTime>=Date.parse(currentDisclosure.valid_until))) return withheld(clock.evaluated_at);
      const today=clock.evaluated_at.slice(0,10);
      const status=head.status==='revoked'?'revoked':head.status!=='effective'||row.version!==input.provider_agreement_version
        ||today<row.valid_from||!input.requested_service_scope.every(x=>row.allowed_service_scope.includes(x))?'not_effective'
          :row.valid_until!==null&&today>=row.valid_until?'expired':'effective';
      return providerAgreementVerificationV1Schema.parse({
        contract_version:'provider-agreement-verification.v1',agreement_status:status,tenant_id:bound.tenant_id,
        workspace_id:bound.workspace_id,provider_party_id:row.provider_party_id,provider_agreement_id:row.agreement_id,
        provider_agreement_version:row.version,valid_from:row.valid_from,valid_until:row.valid_until,
        allowed_service_scope:row.allowed_service_scope.filter(x=>input.requested_service_scope.includes(x)),evaluated_at:clock.evaluated_at,action_authorization:'not_evaluated',
      });
    } catch (error) {
      if (sqlState(error)==='40001') throw error; // Existing host owns fresh-attempt retry.
      if (error instanceof CoreS01UnavailableV1) throw error;
      // No exception detail/SQL/row leakage; timeout/cancel is never successful data.
      throw new CoreS01UnavailableV1('SOURCE_UNAVAILABLE');
    }
  };
}

/** SERVICE preflight closes over a server-owned read transaction, never a client scope. */
export function bindCoreS01PreflightReaderV1(
  reader: ReturnType<typeof createCoreS01ProviderAgreementReaderV1>,scope: CoreTransactionScopeV1,
) { return (input: ProviderAgreementVerificationV1Input)=>reader(scope,input); }

/** Optional Core composition seam for the EXISTING host's resolveAuthority slot.
 * Stores only request/lock metadata keyed by the exact live scope, never an allow.
 * Readers still invoke the canonical provider and session guard afresh. No new
 * transaction, actor resolver, receipt or permission evaluator is introduced.
 */
export function createCoreS01AuthorityCaptureV1() {
  const requests=new WeakMap<CoreTransactionScopeV1,CurrentAuthorityTransactionRequestV1>();
  return {
    async resolveAuthority(scope: CoreTransactionScopeV1, value: CurrentAuthorityTransactionRequestV1) {
      requests.delete(scope);
      const request=currentAuthorityTransactionRequestV1Schema.parse(structuredClone(value));
      const observation=await resolveAuthority(scope,request);
      if (bindCanonicalCurrentAuthorityObservationV1(request,observation).decision==='allowed') {
        requests.set(scope,structuredClone(request));
      }
      return observation;
    },
    authorityRequestFor(scope: CoreTransactionScopeV1): CurrentAuthorityTransactionRequestV1 {
      const request=requests.get(scope);
      if (!request) throw new CoreS01UnavailableV1('SOURCE_NOT_READY');
      return structuredClone(request);
    },
  };
}
