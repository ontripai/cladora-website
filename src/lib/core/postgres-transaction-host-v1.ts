import { randomUUID, createHash } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { z } from 'zod';
import {
  bindCanonicalCurrentAuthorityObservationV1,
  currentAuthorityTransactionRequestV1Schema,
  currentAuthorityTransactionDecisionReceiptV1Schema,
  type CanonicalCurrentAuthorityObservationV1,
  type CurrentAuthorityTransactionRequestV1,
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from './current-authority-transaction-port-v1';

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
export interface CoreTransactionProvidersV1 {
  /** Core-owned resolution of version-bearing authority, in this exact SQL scope. */
  resolveAuthority(scope: CoreTransactionScopeV1, request: CurrentAuthorityTransactionRequestV1):
    Promise<CanonicalCurrentAuthorityObservationV1>;
  /** Read-only provider validation. No network effects, durable writes or cached allow. */
  validateProviders(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1): Promise<boolean>;
  /** Domain-owner mutation in the supplied SQL scope; no independent transaction. */
  mutate(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1): Promise<{ mutation_id: string }>;
}
const receiptSchema = z.strictObject({
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
  authority: currentAuthorityTransactionDecisionReceiptV1Schema,
  mutation_id: uuid,
  audit_event_id: z.string().regex(/^[1-9][0-9]*$/),
  outbox_event_id: uuid,
  committed_at: z.string().datetime({ offset: true }),
}).refine(receipt => receipt.authority.decision === 'allowed'
  && receipt.authority.workspace_id === receipt.workspace_id
  && receipt.authority.actor_id === receipt.actor_id
  && receipt.authority.transaction_context.transaction_id === receipt.transaction_id
  && receipt.authority.transaction_context.command_id === receipt.command_id
  && receipt.authority.transaction_context.lock.aggregate_type === receipt.aggregate_type
  && receipt.authority.transaction_context.lock.aggregate_id === receipt.aggregate_id,
'Persisted authority receipt must bind the complete committed effect identity');
export type CoreTransactionReceiptV1 = z.infer<typeof receiptSchema>;
export type CoreTransactionResultV1 =
  | { status: 'committed' | 'exact_replay'; receipt: CoreTransactionReceiptV1 }
  | { status: 'denied'; code: 'INVALID_COMMAND' | 'WORKSPACE_UNAVAILABLE' | 'REPLAY_CONFLICT'
      | 'AUTHORITY_DENIED' | 'PROVIDER_UNAVAILABLE' | 'TRANSACTION_FAILED';
      authority?: CurrentAuthorityTransactionDecisionReceiptV1 }
  | { status: 'unknown_commit'; code: 'READBACK_REQUIRED' };

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
  constructor(readonly result: CoreTransactionResultV1) { super('core_transaction_aborted'); }
}

/** One backend connection, transaction, lock context and canonical ledger set. Unwired by default. */
export function createCorePostgresTransactionHostV1(pool: Pick<Pool, 'connect'>) {
  return {
    async execute(commandValue: unknown, providers: CoreTransactionProvidersV1): Promise<CoreTransactionResultV1> {
      const parsed = coreTransactionCommandV1Schema.safeParse(commandValue);
      if (!parsed.success) return { status: 'denied', code: 'INVALID_COMMAND' };
      const command = parsed.data;
      // Copy per attempt: a provider cannot alter the authoritative command bindings.
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        let client: PoolClient | undefined;
        let live = true;
        let commitAttempted = false;
        let rollbackFailed = false;
        try {
          client = await pool.connect();
          await client.query('begin isolation level serializable');
          await client.query("set local search_path = pg_catalog");
          await client.query("set local lock_timeout = '5s'");
          await client.query("set local statement_timeout = '10s'");
          // Advisory locks create no idempotency/ledger rows, even on a denied command.
          const key = `core-tx.v1:${command.workspace_id}:${command.idempotency_key}`;
          const lock = async (label: string) => {
            await client!.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [label]);
          };
          await lock(`idempotency:${key}`);
          const workspace = await client.query<{ tenant_id: string }>(
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
          const transaction = await client.query<{ id: string; now: string }>(
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
              if (!live || !/^\s*(select|insert|update|delete|with)\b/i.test(text) || text.includes(';')
                || (phase === 'read' && !/^\s*select\b/i.test(text))) {
                queryFailed = true;
                throw new Error('transaction_scope_unavailable');
              }
              const query = client!.query<Row>(text, values);
              pending.add(query);
              query.catch(() => { queryFailed = true; }).finally(() => pending.delete(query));
              return query;
            },
          });
          const invoke = async <T>(operation: () => Promise<T>) => {
            const value = await operation();
            await Promise.all(Array.from(pending));
            if (queryFailed) throw new Error('provider_query_failed');
            return value;
          };
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
          const canonical = await client.query<{ actor_bound: boolean; allowed: boolean }>(
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
          const previous = await client.query<{ actor_id: string; request_hash: string;
            response_ref: unknown; expires_at: Date }>(
            `select actor_id,request_hash,response_ref,expires_at from platform.idempotency_keys
              where tenant_id=$1 and key=$2 for update`, [tenantId, key],
          );
          if (previous.rowCount) {
            const row = previous.rows[0];
            const prior = receiptSchema.safeParse(row.response_ref);
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
              || !entitlementBindingsMatch(prior.data.authority.entitlement, authority.entitlement)) {
              throw new AbortTransaction({ status: 'denied', code: 'REPLAY_CONFLICT' });
            }
            live = false;
            await client.query('rollback');
            return { status: 'exact_replay', receipt: prior.data };
          }
          if (!await invoke(() => providers.validateProviders(scope, structuredClone(command)))) {
            throw new AbortTransaction({ status: 'denied', code: 'PROVIDER_UNAVAILABLE' });
          }
          // Only now may any persistent effect be staged.
          await client.query(`insert into platform.idempotency_keys
            (tenant_id,actor_id,key,request_hash,expires_at) values($1,$2,$3,$4,statement_timestamp()+interval '1 day')`,
          [tenantId, command.actor_id, key, requestHash]);
          phase = 'mutation';
          const mutation = await invoke(() => providers.mutate(scope, structuredClone(command)));
          const mutationId = uuid.parse(mutation.mutation_id);
          const receiptId = randomUUID();
          const audit = await client.query<{ id: string }>(`insert into audit.events
            (tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot)
            values($1,$2,$3,$4,$5,$6,$7::jsonb) returning id::text`,
          [tenantId, command.actor_id, `core.${command.evaluation_purpose}`, command.aggregate_type,
            command.aggregate_id, command.command_id, JSON.stringify({
              receipt_id: receiptId, workspace_id: command.workspace_id, transaction_id: command.transaction_id,
              authority_decision_id: authority.decision_id, authority_version: authority.authority_version,
              mutation_id: mutationId,
            })]);
          const outbox = await client.query<{ id: string }>(`insert into platform.outbox_events
            (tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id)
            values($1,$2,$3,$4,$5,$6::jsonb,$7) returning id::text`,
          [tenantId, command.aggregate_type, command.aggregate_id, command.aggregate_version,
            `core.${command.evaluation_purpose}.v1`, JSON.stringify({
              event_version: 1, receipt_id: receiptId, workspace_id: command.workspace_id,
              transaction_id: command.transaction_id, mutation_id: mutationId,
            }), command.command_id]);
          const now = await client.query<{ now: string }>('select clock_timestamp()::text as now');
          const receipt = receiptSchema.parse({
            contract_version: 'core-transaction-receipt.v1', receipt_version: 1, receipt_id: receiptId,
            transaction_id: command.transaction_id, command_id: command.command_id,
            workspace_id: command.workspace_id, actor_id: command.actor_id,
            aggregate_type: command.aggregate_type, aggregate_id: command.aggregate_id,
            aggregate_version: command.aggregate_version, input_fingerprint: command.input_fingerprint,
            idempotency_key: command.idempotency_key, authority, mutation_id: mutationId,
            audit_event_id: audit.rows[0].id, outbox_event_id: outbox.rows[0].id,
            committed_at: new Date(now.rows[0].now).toISOString(),
          });
          await client.query(`update platform.idempotency_keys set response_ref=$3::jsonb,status_code=200
            where tenant_id=$1 and key=$2`, [tenantId, key, JSON.stringify(receipt)]);
          live = false;
          commitAttempted = true;
          await client.query('commit');
          return { status: 'committed', receipt };
        } catch (error) {
          live = false;
          if (client) await client.query('rollback').catch(() => { rollbackFailed = true; });
          // A failed COMMIT is uncertain unless PostgreSQL positively reports serialization abort.
          const sqlCode = (error as { code?: string })?.code;
          if (sqlCode === '40001' && attempt < 3) continue;
          if (commitAttempted && sqlCode !== '40001') {
            return { status: 'unknown_commit', code: 'READBACK_REQUIRED' };
          }
          if (error instanceof AbortTransaction) return error.result;
          return { status: 'denied', code: 'TRANSACTION_FAILED' };
        } finally {
          live = false;
          client?.release(rollbackFailed || commitAttempted ? true : undefined);
        }
      }
      return { status: 'denied', code: 'TRANSACTION_FAILED' };
    },
  };
}
