import { randomUUID, createHash } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { CoreCe012TerminalBindingV1 } from './ce012-terminal-authority-port-v1';
import { z } from 'zod';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  currentAuthorityTransactionRequestV1Schema,
  currentAuthorityTransactionDecisionReceiptV1Schema,
  type CanonicalCurrentAuthorityObservationV1,
  type CurrentAuthorityTransactionRequestV1,
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from './current-authority-transaction-port-v1';
import { CoreAuthorityProviderUnavailableV1 } from './current-authority-postgres-provider-v1';

import {
  coreTransactionSubjectReferenceV1Schema, coreTransactionProviderEvidenceV1Schema,
  coreTransactionAcceptedProviderEvidenceV1Schema, coreSubjectReferencesMatch,
  type CoreTransactionProviderEvidenceV1, type CoreTransactionAcceptedProviderEvidenceV1,
} from './transaction-provider-evidence-v1';
import {
  coreTransactionReplayCommandHashV1,
  coreTransactionReplayProviderDecisionV1Schema,
  coreTransactionReplayReceiptHashV1,
  coreTransactionReplayRequirementV1Schema,
  type CoreTransactionReplayProviderDecisionV1,
} from './transaction-replay-provider-hook-v1';
import {
  coreJurisdictionDomainArtifactCommitCandidateV1Schema,
  type CoreJurisdictionDomainArtifactCommitCandidateV1,
} from './jurisdiction-domain-artifact-transaction-evidence-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const code = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);
export const coreTransactionCommandV1Schema = z.strictObject({
  contract_version: z.literal('core-transaction-command.v1'),
  transaction_id: uuid,
  command_id: uuid,
  context_id: uuid,
  workspace_id: uuid,
  actor_id: uuid,
  authority_version: z.number().int().positive().safe(),
  permission_code: code,
  module_code: code,
  evaluation_purpose: code,
  aggregate_type: code,
  aggregate_id: uuid,
  aggregate_version: z.number().int().positive().safe(),
  provider_source_ids: z.array(uuid).max(32),
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  input_fingerprint: z.string().regex(/^[a-z0-9]+:[a-f0-9]{16,64}$/),
});
export type CoreTransactionCommandV1 = z.infer<typeof coreTransactionCommandV1Schema>;
export const coreTransactionCommandV2Schema = coreTransactionCommandV1Schema.extend({
  contract_version: z.literal('core-transaction-command.v2'),
  subject_reference: coreTransactionSubjectReferenceV1Schema,
}).refine(command => command.provider_source_ids.includes(command.subject_reference.id),
  'Subject must be included in the existing provider-source lock set');
export type CoreTransactionCommandV2 = z.infer<typeof coreTransactionCommandV2Schema>;
const commandSchema = z.discriminatedUnion('contract_version', [
  coreTransactionCommandV1Schema, coreTransactionCommandV2Schema,
]);

/** Trusted server providers only: never expose this capability to a route/client. */
export interface CoreTransactionScopeV1 {
  readonly transaction_id: string;
  readonly database_transaction_id: string;
  readonly workspace_id: string;
  readonly tenant_id: string;
  readonly actor_id: string;
  readonly attempt: number;
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string, values?: unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
}
interface CoreTransactionProvidersV1Base {
  /** Inactive opt-in. Only the fixed Core checkpoint executes, never caller code. */
  readonly terminal_checkpoint?: 'core-ce012-host-terminal.v1';
  /** Core-owned resolution of version-bearing authority, in this exact SQL scope. */
  resolveAuthority(scope: CoreTransactionScopeV1, request: CurrentAuthorityTransactionRequestV1):
    Promise<CanonicalCurrentAuthorityObservationV1>;
  /** Read-only provider validation. No network effects, durable writes or cached allow. */
  validateProviders(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
    authority: CurrentAuthorityTransactionDecisionReceiptV1): Promise<boolean>;
  /** Domain-owner mutation in the supplied SQL scope; no independent transaction. */
  mutate(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1): Promise<{ mutation_id: string }>;
}
type CoreTransactionReplayCapabilityV1 = {
  readonly replay_policy?: 'authority_only';
  readonly replay_provider_code?: never;
  readonly validateReplay?: never;
} | {
  readonly replay_policy: 'provider_current_state_required';
  /** Stable identity for a V1 provider, which otherwise has no provider code. */
  readonly replay_provider_code: string;
  /** Read-only current-state validation of an exactly matched persisted receipt. */
  validateReplay(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
    authority: CurrentAuthorityTransactionDecisionReceiptV1,
    receipt: CoreTransactionReceiptV1): Promise<CoreTransactionReplayProviderDecisionV1>;
};
type CoreTransactionJurisdictionArtifactCapabilityV1<Command> = {
  readonly jurisdiction_artifact_projection?: 'none';
  readonly resolveJurisdictionArtifacts?: never;
} | {
  /** Core-owned, inactive projection of accepted current resolver decisions. */
  readonly jurisdiction_artifact_projection:
    'core-jurisdiction-domain-artifact-host-projection.v1';
  resolveJurisdictionArtifacts(
    scope: CoreTransactionScopeV1,
    command: Command,
    authority: CurrentAuthorityTransactionDecisionReceiptV1,
  ): Promise<readonly CoreJurisdictionDomainArtifactCommitCandidateV1[]>;
};
export type CoreTransactionProvidersV1 = CoreTransactionProvidersV1Base
  & CoreTransactionReplayCapabilityV1
  & CoreTransactionJurisdictionArtifactCapabilityV1<CoreTransactionCommandV1>;

interface CoreTransactionProvidersV2Base {
  readonly terminal_checkpoint?: 'core-ce012-host-terminal.v1';
  readonly provider_code: string;
  resolveAuthority(scope: CoreTransactionScopeV1, request: CurrentAuthorityTransactionRequestV1):
    Promise<CanonicalCurrentAuthorityObservationV1>;
  validateProviders(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV2,
    authority: CurrentAuthorityTransactionDecisionReceiptV1): Promise<CoreTransactionProviderEvidenceV1>;
  mutate(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV2): Promise<{ mutation_id: string }>;
}
type CoreTransactionReplayCapabilityV2 = {
  readonly replay_policy?: 'authority_only';
  readonly validateReplay?: never;
} | {
  readonly replay_policy: 'provider_current_state_required';
  /** Read-only current-state validation; fresh-command validation is never reused. */
  validateReplay(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV2,
    authority: CurrentAuthorityTransactionDecisionReceiptV1,
    receipt: CoreTransactionReceiptV2): Promise<CoreTransactionReplayProviderDecisionV1>;
};
export type CoreTransactionProvidersV2 = CoreTransactionProvidersV2Base
  & CoreTransactionReplayCapabilityV2
  & CoreTransactionJurisdictionArtifactCapabilityV1<CoreTransactionCommandV2>;
const committedJurisdictionArtifactsSchema = z.array(
  coreJurisdictionDomainArtifactCommitCandidateV1Schema,
).min(1).max(32).superRefine((values, context) => {
  const identities = values.map(value => `${value.fingerprint.domain_code}\u0000${
    value.fingerprint.domain_version}\u0000${value.fingerprint.artifact_sha256}`);
  if (new Set(identities).size !== identities.length) {
    context.addIssue({ code: 'custom', message: 'Artifact commitments must be unique' });
  }
  if (values.some((value, index) => index > 0 && identities[index - 1] >= identities[index])) {
    context.addIssue({ code: 'custom', message: 'Artifact commitments must be sorted' });
  }
});
const receiptBaseSchema = z.strictObject({
  contract_version: z.literal('core-transaction-receipt.v1'),
  receipt_version: z.literal(1),
  receipt_id: uuid,
  transaction_id: uuid,
  command_id: uuid,
  workspace_id: uuid,
  actor_id: uuid,
  aggregate_type: code,
  aggregate_id: uuid,
  aggregate_version: z.number().int().positive().safe(),
  input_fingerprint: coreTransactionCommandV1Schema.shape.input_fingerprint,
  idempotency_key: coreTransactionCommandV1Schema.shape.idempotency_key,
  replay_validation: coreTransactionReplayRequirementV1Schema.optional(),
  authority: currentAuthorityTransactionDecisionReceiptV1Schema,
  mutation_id: uuid,
  audit_event_id: z.string().regex(/^[1-9][0-9]*$/),
  outbox_event_id: uuid,
  jurisdiction_artifacts: committedJurisdictionArtifactsSchema.optional(),
  committed_at: z.string().datetime({ offset: true }),
});
const receiptAuthorityMatchesEffect = (receipt: Pick<z.infer<typeof receiptBaseSchema>,
  'authority' | 'workspace_id' | 'actor_id' | 'transaction_id' | 'command_id'
  | 'aggregate_type' | 'aggregate_id'>) => receipt.authority.decision === 'allowed'
  && receipt.authority.workspace_id === receipt.workspace_id
  && receipt.authority.actor_id === receipt.actor_id
  && receipt.authority.transaction_context.transaction_id === receipt.transaction_id
  && receipt.authority.transaction_context.command_id === receipt.command_id
  && receipt.authority.transaction_context.lock.aggregate_type === receipt.aggregate_type
  && receipt.authority.transaction_context.lock.aggregate_id === receipt.aggregate_id;
const receiptSchema = receiptBaseSchema.refine(receiptAuthorityMatchesEffect,
  'Persisted authority receipt must bind the complete committed effect identity');
export type CoreTransactionReceiptV1 = z.infer<typeof receiptSchema>;
const receiptV2Schema = receiptBaseSchema.extend({
  contract_version: z.literal('core-transaction-receipt.v2'),
  receipt_version: z.literal(2),
  subject_reference: coreTransactionSubjectReferenceV1Schema,
  provider_evidence: coreTransactionAcceptedProviderEvidenceV1Schema,
}).refine(receipt => receiptAuthorityMatchesEffect(receipt) && coreSubjectReferencesMatch(receipt.subject_reference, receipt.provider_evidence.subject_reference)
  && (receipt.replay_validation === undefined
    || receipt.replay_validation.provider_code === receipt.provider_evidence.provider_code)
  && receipt.provider_evidence.transaction_id === receipt.transaction_id
  && receipt.provider_evidence.command_id === receipt.command_id
  && receipt.provider_evidence.workspace_id === receipt.workspace_id
  && receipt.provider_evidence.actor_id === receipt.actor_id
  && receipt.provider_evidence.context_id === receipt.authority.context_id
  && receipt.provider_evidence.authority_decision_id === receipt.authority.decision_id
  && receipt.provider_evidence.authority_version === receipt.authority.authority_version
  && receipt.provider_evidence.attempt === receipt.authority.transaction_context.attempt
  && Date.parse(receipt.provider_evidence.evaluated_at) >= Date.parse(receipt.authority.evaluated_at)
  && Date.parse(receipt.provider_evidence.evaluated_at) <= Date.parse(receipt.committed_at),
'Persisted provider evidence must bind subject, authority and committed transaction');
export type CoreTransactionReceiptV2 = z.infer<typeof receiptV2Schema>;
const persistedReceiptSchema = z.union([receiptSchema, receiptV2Schema]);

// PROPOSED263-1: expose existing strict parsers only; no host/evaluator behavior change.
export const coreTransactionReceiptV1Schema = receiptSchema;
export const coreTransactionReceiptV2Schema = receiptV2Schema;
export type CoreTransactionResultV1 =
  | { status: 'committed' | 'exact_replay'; receipt: CoreTransactionReceiptV1 }
  | { status: 'denied'; code: 'INVALID_COMMAND' | 'WORKSPACE_UNAVAILABLE' | 'REPLAY_CONFLICT'
      | 'AUTHORITY_DENIED' | 'PROVIDER_UNAVAILABLE' | 'TRANSACTION_FAILED';
      authority?: CurrentAuthorityTransactionDecisionReceiptV1 }
  | { status: 'unknown_commit'; code: 'READBACK_REQUIRED' };

export type CoreTransactionResultV2 =
  | { status: 'committed' | 'exact_replay'; receipt: CoreTransactionReceiptV2 }
  | Exclude<CoreTransactionResultV1, { status: 'committed' | 'exact_replay' }>;
type CoreTransactionResult = CoreTransactionResultV1 | CoreTransactionResultV2;
export interface CoreTransactionHostV1 {
  execute(command: unknown, providers: CoreTransactionProvidersV1): Promise<CoreTransactionResultV1>;
  execute(command: unknown, providers: CoreTransactionProvidersV2): Promise<CoreTransactionResultV2>;
}

/** Private identity-bound lifecycle evidence, NOT authority/disclosure. */
export const CORE_HOST_TERMINAL_LIFECYCLE_V1 = 'core-host-terminal-lifecycle.v1' as const;
export const CORE_HOST_TERMINAL_RUNTIME_BINDING = null;
export type CoreHostTerminalLifecycleInfoV1 = Readonly<{
  contract: typeof CORE_HOST_TERMINAL_LIFECYCLE_V1;
  settlement: 'committed' | 'replay_rolled_back' | 'rolled_back' | 'unknown' | 'not_started';
  observation: 'sealed_and_closed' | 'invalidated';
  attempt: number;
  backend_pid: number | null;
  database_transaction_id: string | null;
  response_sha256: string;
  observation_sha256: string | null;
  seal_sha256: string | null;
  response_encoding: 'core-host-result-json-utf8.v1';
  disclosure_authorization: 'not_ready';
  live_observation: false;
  reusable_in_other_attempt: false;
  first_error_code: string | null;
}>;
const terminalResults = new WeakMap<object, {info: CoreHostTerminalLifecycleInfoV1; bytes: Buffer}>();
/** Only the EXACT result object issued by this host is recognized. JSON is not a proof. */
export function coreHostTerminalLifecycleV1(result: unknown): CoreHostTerminalLifecycleInfoV1 | null {
  return typeof result === 'object' && result !== null ? terminalResults.get(result)?.info ?? null : null;
}
/** Exact host-result bytes only; not HTTP headers, a Docs projection or delivery ACK. */
export function coreHostTerminalResponseMatchesV1(result: unknown, bytes: Uint8Array): boolean {
  if (typeof result !== 'object' || result === null) return false;
  const record = terminalResults.get(result);
  return record !== undefined && record.bytes.equals(Buffer.from(bytes));
}
function freezeTerminalResponse<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) freezeTerminalResponse(item);
    Object.freeze(value);
  }
  return value;
}
class TerminalAttemptV1 {
  generation = 0;
  inFlight = 0;
  failed = false;
  first: unknown;
  closed = false;
  commitSerializationAbort = false;
  backendPid: number | null = null;
  databaseTransactionId: string | null = null;
  settlement: CoreHostTerminalLifecycleInfoV1['settlement'] = 'not_started';
  seal: {generation: number; response: CoreTransactionResult; bytes: Buffer;
    observation: Readonly<{binding: CoreCe012TerminalBindingV1; evaluated_at: string}>;
    observationHash: string; sealHash: string} | null = null;
  publishedResult: CoreTransactionResult | null = null;
  constructor(readonly attempt: number) {}
  invalidate() { this.generation += 1; this.seal = null; }
  fail(error: unknown) { if (!this.failed) { this.failed = true; this.first = error; } this.invalidate(); }
  assertSealed() {
    if (this.failed) throw this.first;
    if (this.closed || !this.seal || this.inFlight !== 0 || this.seal.generation !== this.generation) {
      throw new Error('core_terminal_seal_invalid');
    }
  }
  record(result: CoreTransactionResult, sealed: boolean) {
    const bytes = Buffer.from(JSON.stringify(result), 'utf8');
    const code = (this.first as {code?: unknown})?.code;
    const info: CoreHostTerminalLifecycleInfoV1 = Object.freeze({
      contract: CORE_HOST_TERMINAL_LIFECYCLE_V1, settlement: this.settlement,
      observation: sealed ? 'sealed_and_closed' : 'invalidated', attempt: this.attempt,
      backend_pid: this.backendPid, database_transaction_id: this.databaseTransactionId,
      response_sha256: createHash('sha256').update(bytes).digest('hex'),
      observation_sha256: sealed ? this.seal!.observationHash : null,
      seal_sha256: sealed ? this.seal!.sealHash : null,
      response_encoding: 'core-host-result-json-utf8.v1', disclosure_authorization: 'not_ready',
      live_observation: false, reusable_in_other_attempt: false,
      first_error_code: typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : null,
    });
    this.publishedResult = result;
    terminalResults.set(result, {info, bytes});
    return result;
  }
}

function entitlementBindingsMatch(
  stored: CurrentAuthorityTransactionDecisionReceiptV1['entitlement'],
  current: CurrentAuthorityTransactionDecisionReceiptV1['entitlement'],
): boolean {
  // Legacy contract-only providers have neither binding. A canonical binding
  // cannot disappear or be introduced silently when an old receipt is replayed.
  if (stored === undefined || current === undefined) return stored === current;
  return stored.contract_version === current.contract_version
    && stored.workspace_id === current.workspace_id
    && stored.authority_revision === current.authority_revision
    && stored.module_definition_id === current.module_definition_id
    && stored.module_code === current.module_code
    && stored.entitlement_key === current.entitlement_key;
}

class AbortTransaction extends Error {
  constructor(readonly result: CoreTransactionResult) { super('core_transaction_aborted'); }
}

/** One backend connection, transaction, lock context and canonical ledger set. Unwired by default. */
export function createCorePostgresTransactionHostV1(pool: Pick<Pool, 'connect'>) {
  return {
    async execute(commandValue: unknown, providers: CoreTransactionProvidersV1 | CoreTransactionProvidersV2): Promise<CoreTransactionResult> {
      const parsed = commandSchema.safeParse(commandValue);
      if (!parsed.success) return { status: 'denied', code: 'INVALID_COMMAND' };
      const command = parsed.data;
      const providerCode = command.contract_version === 'core-transaction-command.v2'
        ? (providers as CoreTransactionProvidersV2).provider_code : undefined;
      const replayPolicy = providers.replay_policy ?? 'authority_only';
      const validateReplay = providers.validateReplay as ((
        replayScope: CoreTransactionScopeV1,
        replayCommand: CoreTransactionCommandV1 | CoreTransactionCommandV2,
        replayAuthority: CurrentAuthorityTransactionDecisionReceiptV1,
        receipt: CoreTransactionReceiptV1 | CoreTransactionReceiptV2,
      ) => Promise<CoreTransactionReplayProviderDecisionV1>) | undefined;
      const replayProviderCode = command.contract_version === 'core-transaction-command.v2'
        ? providerCode
        : (providers as CoreTransactionProvidersV1).replay_provider_code;
      const terminalPolicy = providers.terminal_checkpoint;
      if (terminalPolicy !== undefined && (terminalPolicy !== 'core-ce012-host-terminal.v1'
        || command.contract_version !== 'core-transaction-command.v2'
        || providerCode !== 'documents-ce012-reference-provider.v1'
        || command.aggregate_type !== 'experience_guide')) {
        return {status: 'denied', code: 'PROVIDER_UNAVAILABLE'};
      }
      const artifactProjection = providers.jurisdiction_artifact_projection ?? 'none';
      const resolveJurisdictionArtifacts = providers.resolveJurisdictionArtifacts as ((
        artifactScope: CoreTransactionScopeV1,
        artifactCommand: CoreTransactionCommandV1 | CoreTransactionCommandV2,
        artifactAuthority: CurrentAuthorityTransactionDecisionReceiptV1,
      ) => Promise<readonly CoreJurisdictionDomainArtifactCommitCandidateV1[]>) | undefined;
      if (command.contract_version === 'core-transaction-command.v2'
        && (typeof providerCode !== 'string' || !/^[a-z][a-z0-9_.:-]{0,79}$/.test(providerCode))) {
        return { status: 'denied', code: 'PROVIDER_UNAVAILABLE' };
      }
      if (replayPolicy !== 'authority_only' && replayPolicy !== 'provider_current_state_required') {
        return { status: 'denied', code: 'PROVIDER_UNAVAILABLE' };
      }
      const replayRequirement = replayPolicy === 'provider_current_state_required'
        ? coreTransactionReplayRequirementV1Schema.safeParse({
          contract_version: 'core-transaction-replay-provider-requirement.v1',
          provider_code: replayProviderCode,
        })
        : undefined;
      if ((replayRequirement && (!replayRequirement.success || typeof validateReplay !== 'function'))
        || (replayPolicy === 'authority_only' && (typeof validateReplay === 'function'
          || (command.contract_version === 'core-transaction-command.v1'
            && typeof replayProviderCode === 'string')))) {
        return { status: 'denied', code: 'PROVIDER_UNAVAILABLE' };
      }
      if ((artifactProjection === 'core-jurisdiction-domain-artifact-host-projection.v1'
          && typeof resolveJurisdictionArtifacts !== 'function')
        || (artifactProjection === 'none' && typeof resolveJurisdictionArtifacts === 'function')
        || !['none', 'core-jurisdiction-domain-artifact-host-projection.v1']
          .includes(artifactProjection)) {
        return { status: 'denied', code: 'PROVIDER_UNAVAILABLE' };
      }
      // Copy per attempt: a provider cannot alter the authoritative command bindings.
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        let client: PoolClient | undefined;
        let live = true;
        let commitAttempted = false;
        let rollbackFailed = false;
        const terminal = terminalPolicy ? new TerminalAttemptV1(attempt) : null;
        let backendError: ((error: Error) => void) | undefined;
        const wire = async function<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = [], settlement = false) {
          if (terminal) {
            if (settlement) terminal.assertSealed();
            else terminal.invalidate();
            terminal.inFlight += 1;
          }
          try { return await client!.query<Row>(text, values); }
          catch (error) {
            if (terminal && settlement && text === 'commit' && (error as {code?: string})?.code === '40001') terminal.commitSerializationAbort = true;
            terminal?.fail(error); throw error;
          }
          finally { if (terminal) terminal.inFlight -= 1; }
        }
        const failedResult = function(value: CoreTransactionResult): CoreTransactionResult {
          return terminal ? terminal.record(freezeTerminalResponse(value), false) : value;
        }
        try {
          client = await pool.connect();
          if (terminal) {
            backendError = error => terminal.fail(error);
            client.on('error', backendError);
          }
          const begun = await wire('begin isolation level serializable');
          if (terminal) {
            terminal.settlement = 'unknown';
            if (begun.command !== 'BEGIN') throw new Error('core_terminal_begin_ack_invalid');
            const backend = await wire<{backend_pid: number; database_transaction_id: string; isolation: string}>(
              "select pg_backend_pid() as backend_pid,txid_current()::text as database_transaction_id,current_setting('transaction_isolation') as isolation");
            const b = backend.rows[0];
            if (backend.rowCount !== 1 || backend.rows.length !== 1 || !b || !Number.isSafeInteger(b.backend_pid) || b.backend_pid < 1
              || !/^[1-9][0-9]*$/.test(b.database_transaction_id) || b.isolation !== 'serializable') throw new Error('core_terminal_backend_invalid');
            terminal.backendPid = b.backend_pid; terminal.databaseTransactionId = b.database_transaction_id;
          }
          await wire("set local search_path = pg_catalog");
          await wire("set local lock_timeout = '5s'");
          await wire("set local statement_timeout = '10s'");
          // Advisory locks create no idempotency/ledger rows, even on a denied command.
          const key = `core-tx.v1:${command.workspace_id}:${command.idempotency_key}`;
          const lock = async (label: string) => {
            await wire('select pg_advisory_xact_lock(hashtextextended($1,0))', [label]);
          };
          await lock(`idempotency:${key}`);
          const workspace = await wire<{ tenant_id: string }>(
            `select tenant_id from platform.customer_workspaces
              where id=$1 and archived_at is null and lifecycle_status='ACTIVE' for update`,
            [command.workspace_id],
          );
          if (workspace.rowCount !== 1) {
            throw new AbortTransaction({ status: 'denied', code: 'WORKSPACE_UNAVAILABLE' });
          }
          const tenantId = workspace.rows[0].tenant_id;
          await lock(`aggregate:${command.workspace_id}:${command.aggregate_type}:${command.aggregate_id}`);
          for (const sourceId of Array.from(new Set(command.provider_source_ids)).sort()) {
            await lock(`provider:${command.workspace_id}:${sourceId}`);
          }
          const transaction = await wire<{ id: string; now: string }>(
            "select txid_current()::text as id, clock_timestamp()::text as now",
          );
          const pending = new Set<Promise<unknown>>();
          let queryFailed = false;
          let phase: 'read' | 'mutation' = 'read';
          const scope: CoreTransactionScopeV1 = Object.freeze({
            transaction_id: command.transaction_id,
            database_transaction_id: transaction.rows[0].id,
            workspace_id: command.workspace_id,
            tenant_id: tenantId,
            actor_id: command.actor_id,
            attempt,
            async query<Row extends QueryResultRow>(text: string, values: unknown[] = []) {
              // Transaction/session control and multi-statements belong exclusively to the host.
              // This is a trusted-provider boundary, not a SQL sandbox.
              terminal?.invalidate();
              if (!live || !/^\s*(select|insert|update|delete|with)\b/i.test(text) || text.includes(';')
                || (phase === 'read' && !/^\s*select\b/i.test(text))) {
                queryFailed = true;
                const error = new Error('transaction_scope_unavailable');
                terminal?.fail(error);
                throw error;
              }
              const query = wire<Row>(text, values);
              pending.add(query);
              query.catch(() => { queryFailed = true; }).finally(() => pending.delete(query));
              return query;
            },
          });
          const invoke = async <T>(operation: () => Promise<T>) => {
            terminal?.invalidate();
            try {
              const value = await operation();
              await Promise.all(Array.from(pending));
              if (terminal?.failed) throw terminal.first;
              if (queryFailed) throw new Error('provider_query_failed');
              return value;
            } finally { terminal?.invalidate(); }
          };
          const sealResponse = async function(receipt: CoreTransactionReceiptV1 | CoreTransactionReceiptV2, status: 'committed' | 'exact_replay') {
            if (!terminal || command.contract_version !== 'core-transaction-command.v2' || receipt.contract_version !== 'core-transaction-receipt.v2') throw new Error('core_terminal_policy_invalid');
            // Consumer raw scope closes permanently before imports/checkpoint waits.
            live = false;
            await Promise.all(Array.from(pending));
            if (queryFailed || terminal.failed) throw terminal.failed ? terminal.first : new Error('provider_query_failed');
            const checkpoint = await import('./ce012-host-terminal-checkpoint-v1');
            terminal.invalidate();
            const terminalScope: CoreTransactionScopeV1 = Object.freeze({...scope,
              async query<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
                if (terminal.closed || !/^\s*select\b/i.test(text) || text.includes(';')) throw new Error('core_terminal_query_invalid');
                return wire<Row>(text, values);
              },
            });
            const observation = await checkpoint.runCoreCe012HostTerminalCheckpointV1(terminalScope, command, receipt);
            terminal.invalidate();
            if (terminal.failed) throw terminal.first;
            const b = observation.binding;
            if (terminal.inFlight !== 0 || pending.size !== 0 || b.backend_pid !== terminal.backendPid
              || b.database_transaction_id !== terminal.databaseTransactionId || b.attempt !== attempt
              || b.transaction_id !== command.transaction_id || b.command_id !== command.command_id
              || b.actor_id !== scope.actor_id || b.tenant_id !== scope.tenant_id
              || b.context_id !== command.context_id || b.workspace_id !== scope.workspace_id
              || b.command_hash !== requestHash || b.canonical_key !== key
              || b.authority_revision !== command.authority_version || b.core_receipt_id !== receipt.receipt_id
              || b.core_receipt_hash !== coreTransactionReplayReceiptHashV1(receipt) || b.mutation_id !== receipt.mutation_id
              || !command.provider_source_ids.includes(b.target.document_id)
              || !command.provider_source_ids.includes(b.target.document_version_id)) throw new Error('core_terminal_binding_invalid');
            const response = freezeTerminalResponse(structuredClone({status, receipt})) as CoreTransactionResult;
            const bytes = Buffer.from(JSON.stringify(response), 'utf8');
            const observationHash = createHash('sha256').update(JSON.stringify(observation)).digest('hex');
            const sealHash = createHash('sha256').update(JSON.stringify({contract: CORE_HOST_TERMINAL_LIFECYCLE_V1,
              response_sha256: createHash('sha256').update(bytes).digest('hex'), observation_sha256: observationHash,
              backend_pid: terminal.backendPid, database_transaction_id: terminal.databaseTransactionId, attempt, status})).digest('hex');
            terminal.seal = {generation: terminal.generation, response, bytes, observation, observationHash, sealHash};
            terminal.assertSealed();
            return response;
          }
          const settledResponse = function(response: CoreTransactionResult) {
            terminal!.assertSealed();
            if (terminal!.seal!.response !== response
              || !terminal!.seal!.bytes.equals(Buffer.from(JSON.stringify(response), 'utf8'))) throw new Error('core_terminal_response_invalid');
            return terminal!.record(response, true);
          }
          const request = currentAuthorityTransactionRequestV1Schema.parse({
            contract_version: 'core-current-authority-transaction-port-request.v1',
            decision_id: randomUUID(), context_id: command.context_id,
            workspace_id: command.workspace_id, actor_id: command.actor_id,
            authority_version: command.authority_version, permission_code: command.permission_code,
            module_code: command.module_code, evaluation_purpose: command.evaluation_purpose,
            transaction_context: {
              transaction_id: command.transaction_id, command_id: command.command_id, attempt,
              isolation_level: 'serializable', lock: {
                kind: 'command_aggregate', workspace_id: command.workspace_id,
                aggregate_type: command.aggregate_type, aggregate_id: command.aggregate_id,
                acquired_at: new Date(transaction.rows[0].now).toISOString(),
              },
            },
          });
          const observation = await invoke(() => providers.resolveAuthority(scope, structuredClone(request)));
          // An injected observation cannot grant permission in place of the Core engine.
          const canonical = await wire<{ actor_bound: boolean; allowed: boolean }>(
            `select auth.uid()=$1::uuid as actor_bound,
              app_private.check_workspace_native_permission_v2($2,$3,$4,$5) as allowed`,
            [command.actor_id, command.context_id, command.workspace_id,
              command.permission_code, command.module_code],
          );
          if (canonical.rows[0]?.actor_bound !== true) {
            throw new AbortTransaction({ status: 'denied', code: 'AUTHORITY_DENIED' });
          }
          const authority = bindCanonicalCurrentAuthorityObservationV1(request, {
            ...observation,
            decision: canonical.rows[0]?.allowed === true ? observation.decision : 'denied',
          });
          if (authority.decision !== 'allowed') {
            throw new AbortTransaction({ status: 'denied', code: 'AUTHORITY_DENIED', authority });
          }
          // Fingerprint also covers every host identity/effect binding. Key is Workspace-scoped.
          const requestHash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
          const previous = await wire<{ actor_id: string; request_hash: string;
            response_ref: unknown; expires_at: Date }>(
            `select actor_id,request_hash,response_ref,expires_at from platform.idempotency_keys
              where tenant_id=$1 and key=$2 for update`, [tenantId, key],
          );
          if (previous.rowCount) {
            const row = previous.rows[0];
            const prior = persistedReceiptSchema.safeParse(row.response_ref);
            if (row.actor_id !== command.actor_id || row.request_hash !== requestHash
              || !prior.success || row.expires_at.getTime() <= Date.now()
              || prior.data.workspace_id !== command.workspace_id
              || prior.data.actor_id !== command.actor_id
              || prior.data.transaction_id !== command.transaction_id
              || prior.data.command_id !== command.command_id
              || prior.data.idempotency_key !== command.idempotency_key
              || prior.data.input_fingerprint !== command.input_fingerprint
              || prior.data.aggregate_type !== command.aggregate_type
              || prior.data.aggregate_id !== command.aggregate_id
              || prior.data.aggregate_version !== command.aggregate_version
              || prior.data.authority.context_id !== command.context_id
              || prior.data.authority.authority_version !== command.authority_version
              || prior.data.authority.permission_code !== command.permission_code
              || prior.data.authority.module_code !== command.module_code
              || prior.data.authority.evaluation_purpose !== command.evaluation_purpose
              || !entitlementBindingsMatch(prior.data.authority.entitlement, authority.entitlement)
              || (command.contract_version === 'core-transaction-command.v2'
                ? prior.data.contract_version !== 'core-transaction-receipt.v2'
                  || !coreSubjectReferencesMatch(prior.data.subject_reference, command.subject_reference)
                  || prior.data.provider_evidence.provider_code !== providerCode
                : prior.data.contract_version !== 'core-transaction-receipt.v1')) {
              throw new AbortTransaction({ status: 'denied', code: 'REPLAY_CONFLICT' });
            }
            const storedReplayRequirement = prior.data.replay_validation;
            const currentReplayRequirement = replayRequirement?.success
              ? replayRequirement.data : undefined;
            if ((storedReplayRequirement === undefined) !== (currentReplayRequirement === undefined)
              || storedReplayRequirement?.provider_code !== currentReplayRequirement?.provider_code) {
              throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
            }
            if (currentReplayRequirement) {
              const replayCommandHash = coreTransactionReplayCommandHashV1(command);
              const replayReceiptHash = coreTransactionReplayReceiptHashV1(prior.data);
              const replayValue = await invoke(() => validateReplay!(
                scope,
                structuredClone(command),
                structuredClone(authority),
                structuredClone(prior.data),
              ));
              const replay = coreTransactionReplayProviderDecisionV1Schema.safeParse(replayValue);
              const replayNow = await wire<{ now: string }>('select clock_timestamp()::text as now');
              if (!replay.success
                || replay.data.provider_code !== currentReplayRequirement.provider_code
                || replay.data.database_transaction_id !== scope.database_transaction_id
                || replay.data.transaction_id !== command.transaction_id
                || replay.data.command_id !== command.command_id
                || replay.data.workspace_id !== command.workspace_id
                || replay.data.actor_id !== command.actor_id
                || replay.data.context_id !== command.context_id
                || replay.data.authority_decision_id !== authority.decision_id
                || replay.data.authority_version !== authority.authority_version
                || replay.data.attempt !== attempt
                || replay.data.receipt_id !== prior.data.receipt_id
                || replay.data.receipt_contract_version !== prior.data.contract_version
                || replay.data.command_hash !== replayCommandHash
                || replay.data.receipt_hash !== replayReceiptHash
                || Date.parse(replay.data.evaluated_at) < Date.parse(authority.evaluated_at)
                || Date.parse(replay.data.evaluated_at) > Date.parse(replayNow.rows[0].now)) {
                throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
              }
              if (replay.data.decision !== 'accepted') {
                throw new AbortTransaction({ status: 'denied', code:
                  replay.data.denial_reason === 'PROVIDER_UNAVAILABLE'
                    ? 'PROVIDER_UNAVAILABLE'
                    : 'REPLAY_CONFLICT' });
              }
            }
            if (terminal) {
              const response = await sealResponse(prior.data, 'exact_replay');
              const ack = await wire('rollback', [], true);
              if (ack.command !== 'ROLLBACK') throw new Error('core_terminal_replay_ack_invalid');
              terminal.settlement = 'replay_rolled_back';
              return settledResponse(response);
            }
            live = false;
            await wire('rollback');
            return prior.data.contract_version === 'core-transaction-receipt.v2'
              ? { status: 'exact_replay', receipt: prior.data }
              : { status: 'exact_replay', receipt: prior.data };
          }
          let providerEvidence: CoreTransactionAcceptedProviderEvidenceV1 | undefined;
          if (command.contract_version === 'core-transaction-command.v2') {
            const value = await invoke(() => (providers as CoreTransactionProvidersV2).validateProviders(
              scope, structuredClone(command), structuredClone(authority)));
            const evidence = coreTransactionProviderEvidenceV1Schema.safeParse(value);
            const now = await wire<{ now: string }>('select clock_timestamp()::text as now');
            if (!evidence.success || evidence.data.decision !== 'accepted'
              || evidence.data.provider_code !== providerCode
              || evidence.data.transaction_id !== command.transaction_id
              || evidence.data.command_id !== command.command_id
              || evidence.data.workspace_id !== command.workspace_id
              || evidence.data.actor_id !== command.actor_id
              || evidence.data.context_id !== command.context_id
              || evidence.data.authority_decision_id !== authority.decision_id
              || evidence.data.authority_version !== authority.authority_version
              || evidence.data.attempt !== attempt
              || !coreSubjectReferencesMatch(evidence.data.subject_reference, command.subject_reference)
              || Date.parse(evidence.data.evaluated_at) < Date.parse(authority.evaluated_at)
              || Date.parse(evidence.data.evaluated_at) > Date.parse(now.rows[0].now)) {
              throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
            }
            providerEvidence = evidence.data;
          } else if (await invoke(() => (providers as CoreTransactionProvidersV1).validateProviders(
            scope, structuredClone(command), structuredClone(authority))) !== true) {
            throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
          }
          let jurisdictionArtifacts: CoreJurisdictionDomainArtifactCommitCandidateV1[] | undefined;
          if (artifactProjection === 'core-jurisdiction-domain-artifact-host-projection.v1') {
            if (command.aggregate_type !== 'portfolio.property') {
              throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
            }
            const values = await invoke(() => resolveJurisdictionArtifacts!(
              scope,
              structuredClone(command),
              structuredClone(authority),
            ));
            if (!Array.isArray(values) || values.length === 0 || values.length > 32) {
              throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
            }
            const parsedValues = values.map(value =>
              coreJurisdictionDomainArtifactCommitCandidateV1Schema.safeParse(value));
            const artifactNow = await wire<{ now: string }>(
              'select clock_timestamp()::text as now',
            );
            if (parsedValues.some(value => !value.success)
              || parsedValues.some(value => value.success
                && (value.data.property_id !== command.aggregate_id
                  || Date.parse(value.data.evaluated_at) < Date.parse(authority.evaluated_at)
                  || Date.parse(value.data.evaluated_at) > Date.parse(artifactNow.rows[0].now)))) {
              throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
            }
            const normalized = parsedValues.map(value => {
              if (!value.success) throw new Error('unreachable_invalid_artifact_commitment');
              return value.data;
            }).sort((left, right) => {
              const leftKey = `${left.fingerprint.domain_code}\u0000${left.fingerprint.domain_version}\u0000${left.fingerprint.artifact_sha256}`;
              const rightKey = `${right.fingerprint.domain_code}\u0000${right.fingerprint.domain_version}\u0000${right.fingerprint.artifact_sha256}`;
              return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
            });
            const commitments = committedJurisdictionArtifactsSchema.safeParse(normalized);
            if (!commitments.success
              || new Set(commitments.data.map(value => value.fingerprint.domain_code)).size
                !== commitments.data.length) {
              throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
            }
            jurisdictionArtifacts = commitments.data;
          }
          // Only now may any persistent effect be staged.
          await wire(`insert into platform.idempotency_keys
            (tenant_id,actor_id,key,request_hash,expires_at) values($1,$2,$3,$4,statement_timestamp()+interval '1 day')`,
          [tenantId, command.actor_id, key, requestHash]);
          phase = 'mutation';
          const mutation = await invoke(() => command.contract_version === 'core-transaction-command.v2'
            ? (providers as CoreTransactionProvidersV2).mutate(scope, structuredClone(command))
            : (providers as CoreTransactionProvidersV1).mutate(scope, structuredClone(command)));
          const mutationId = uuid.parse(mutation.mutation_id);
          const receiptId = randomUUID();
          const receiptContractVersion = command.contract_version === 'core-transaction-command.v2'
            ? 'core-transaction-receipt.v2' : 'core-transaction-receipt.v1';
          if (jurisdictionArtifacts !== undefined) {
            for (let index = 0; index < jurisdictionArtifacts.length; index += 1) {
              const commitment = jurisdictionArtifacts[index];
              const fingerprint = commitment.fingerprint;
              const inserted = await wire(`insert into
                platform.jurisdiction_domain_artifact_receipt_evidence(
                  receipt_id,artifact_ordinal,evidence_contract_version,tenant_id,workspace_id,
                  source_property_id,source_actor_id,source_transaction_id,source_command_id,
                  source_attempt,source_idempotency_key,source_receipt_contract_version,
                  authority_decision_id,resolver_decision_id,artifact_id,
                  jurisdiction_profile_id,profile_code,profile_version,country_code,
                  profile_manifest_sha256,domain_code,domain_version,artifact_sha256,effective_at)
                select $1,$2,'core-jurisdiction-domain-artifact-committed-evidence.v1',
                  $3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,a.id,
                  a.jurisdiction_profile_id,a.profile_code,a.profile_version,a.country_code,
                  a.profile_manifest_sha256,a.domain_code,a.domain_version,a.artifact_sha256,$14
                from platform.jurisdiction_domain_artifacts a
                where a.jurisdiction_profile_id=$15 and a.profile_code=$16
                  and a.profile_version=$17 and a.country_code=$18
                  and a.profile_manifest_sha256=$19 and a.domain_code=$20
                  and a.domain_version=$21 and a.artifact_sha256=$22
                  and a.canonical_bytes_sha256=$22 and a.lifecycle_status='active'
                  and a.effective_from<=$14::timestamptz
                  and (a.effective_to is null or a.effective_to>$14::timestamptz)`, [
                receiptId, index + 1, tenantId, command.workspace_id, command.aggregate_id,
                command.actor_id, command.transaction_id, command.command_id, attempt,
                command.idempotency_key, receiptContractVersion, authority.decision_id,
                commitment.resolver_decision_id, commitment.evaluated_at,
                fingerprint.profile_id, fingerprint.profile_code, fingerprint.profile_version,
                fingerprint.country_code, fingerprint.profile_manifest_sha256,
                fingerprint.domain_code, fingerprint.domain_version, fingerprint.artifact_sha256,
              ]);
              if (inserted.rowCount !== 1) throw new Error('artifact_projection_unavailable');
            }
          }
          const audit = await wire<{ id: string }>(`insert into audit.events
            (tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot)
            values($1,$2,$3,$4,$5,$6,$7::jsonb) returning id::text`,
          [tenantId, command.actor_id, `core.${command.evaluation_purpose}`, command.aggregate_type,
            command.aggregate_id, command.command_id, JSON.stringify({
              receipt_id: receiptId, workspace_id: command.workspace_id, transaction_id: command.transaction_id,
              authority_decision_id: authority.decision_id, authority_version: authority.authority_version,
              mutation_id: mutationId,
            })]);
          const outbox = await wire<{ id: string }>(`insert into platform.outbox_events
            (tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id)
            values($1,$2,$3,$4,$5,$6::jsonb,$7) returning id::text`,
          [tenantId, command.aggregate_type, command.aggregate_id, command.aggregate_version,
            `core.${command.evaluation_purpose}.v1`, JSON.stringify({
              event_version: 1, receipt_id: receiptId, workspace_id: command.workspace_id,
              transaction_id: command.transaction_id, mutation_id: mutationId,
            }), command.command_id]);
          const now = await wire<{ now: string }>('select clock_timestamp()::text as now');
          const receipt = persistedReceiptSchema.parse({
            ...(command.contract_version === 'core-transaction-command.v2'
              ? { contract_version: 'core-transaction-receipt.v2', receipt_version: 2,
                subject_reference: command.subject_reference, provider_evidence: providerEvidence }
              : { contract_version: 'core-transaction-receipt.v1', receipt_version: 1 }),
            ...(replayRequirement?.success ? { replay_validation: replayRequirement.data } : {}),
            receipt_id: receiptId,
            transaction_id: command.transaction_id, command_id: command.command_id,
            workspace_id: command.workspace_id, actor_id: command.actor_id,
            aggregate_type: command.aggregate_type, aggregate_id: command.aggregate_id,
            aggregate_version: command.aggregate_version, input_fingerprint: command.input_fingerprint,
            idempotency_key: command.idempotency_key, authority, mutation_id: mutationId,
            audit_event_id: audit.rows[0].id, outbox_event_id: outbox.rows[0].id,
            ...(jurisdictionArtifacts === undefined
              ? {} : { jurisdiction_artifacts: jurisdictionArtifacts }),
            committed_at: new Date(now.rows[0].now).toISOString(),
          });
          await wire(`update platform.idempotency_keys set response_ref=$3::jsonb,status_code=200
            where tenant_id=$1 and key=$2`, [tenantId, key, JSON.stringify(receipt)]);
          if (terminal) {
            const response = await sealResponse(receipt, 'committed');
            commitAttempted = true;
            const ack = await wire('commit', [], true);
            if (ack.command === 'ROLLBACK') { terminal.settlement = 'rolled_back'; throw new Error('core_terminal_commit_aborted'); }
            if (ack.command !== 'COMMIT') throw new Error('core_terminal_commit_ack_invalid');
            terminal.settlement = 'committed';
            return settledResponse(response);
          }
          live = false;
          commitAttempted = true;
          await wire('commit');
          return receipt.contract_version === 'core-transaction-receipt.v2'
            ? { status: 'committed', receipt }
            : { status: 'committed', receipt };
        } catch (caught) {
          live = false;
          const error = terminal?.failed ? terminal.first : caught;
          terminal?.fail(error);
          if (client) await wire('rollback').then(ack => {
            // A cleanup ACK cannot undo an attempted/unknown COMMIT.
            if (terminal && (!commitAttempted || terminal.commitSerializationAbort) && ack.command === 'ROLLBACK') terminal.settlement = 'rolled_back';
          }).catch(() => { rollbackFailed = true; });
          // A failed COMMIT is uncertain unless PostgreSQL positively reports serialization abort.
          const sqlCode = (error as { code?: string })?.code;
          if (sqlCode === '40001' && attempt < 3
            && (!terminal || !commitAttempted || (terminal.commitSerializationAbort && terminal.settlement !== 'committed'))) continue;
          if (commitAttempted && (sqlCode !== '40001' || (terminal && !terminal.commitSerializationAbort))
            && terminal?.settlement !== 'rolled_back') {
            if (terminal) terminal.settlement = 'unknown';
            return failedResult({ status: 'unknown_commit', code: 'READBACK_REQUIRED' });
          }
          if (error instanceof AbortTransaction) return failedResult(error.result);
          if (error instanceof CoreAuthorityProviderUnavailableV1
            && error.code === 'ACTOR_REVOKED') {
            return failedResult({ status: 'denied', code: 'AUTHORITY_DENIED' });
          }
          return failedResult({ status: 'denied', code: 'TRANSACTION_FAILED' });
        } finally {
          live = false;
          try {
            if (backendError) client?.removeListener('error', backendError);
            client?.release(rollbackFailed || commitAttempted ? true : undefined);
            if (terminal?.failed && terminal.seal) terminal.invalidate();
          } catch (cleanup) {
            if (terminal?.publishedResult) terminalResults.delete(terminal.publishedResult);
            terminal?.fail(cleanup);
            throw terminal?.failed ? terminal.first : cleanup;
          } finally { if (terminal) { terminal.closed = true; terminal.invalidate(); } }
        }
      }
      return { status: 'denied', code: 'TRANSACTION_FAILED' };
    },
  } as CoreTransactionHostV1;
}
