/** Inactive Utilities domain writer. Only the existing C03 host owns settlement. */
import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { coreTransactionCommandV1Schema, type CoreTransactionScopeV1 } from '@/lib/core/postgres-transaction-host-v1';
import { SERVICE_TYPES } from '@/lib/customer/utilities-schema';

export const UTILITIES_MONTHLY_INPUT_RUNTIME_BINDING = null;
export const UTILITIES_MONTHLY_INPUT_SQL_V1 = 'select utilities.produce_monthly_input_v1($1::uuid,$2::uuid,$3::bigint,$4::jsonb) as result';
export const UTILITIES_INVOICE_REVIEW_SOURCE_SQL_V1 = 'select utilities.read_invoice_review_source_v1($1::uuid,$2::uuid,$3::bigint,$4::uuid) as result';
const uuid = z.string().uuid().transform(s => s.toLowerCase());
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const decimal = z.string().regex(/^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,4})?$/);
const base = { source_id: uuid };
export const utilitiesMonthlyInputV1Schema = z.discriminatedUnion('operation', [
  z.strictObject({ ...base, contract_version: z.literal('utilities-monthly-input.v2'), operation: z.literal('ingest_invoice'), contract_id: uuid,
    ingestion_document_id: uuid, external_invoice_no: z.string().trim().min(1).max(160),
    issued_on: z.iso.date(), due_on: z.iso.date().nullable(), period_start: z.iso.date(), period_end: z.iso.date(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    lines: z.array(z.strictObject({ service_type: z.enum(SERVICE_TYPES), description: z.string().trim().min(1).max(500),
      line_subtotal: decimal, line_tax: decimal })).min(1).max(100),
  }).refine(p => p.period_start < p.period_end && (p.due_on === null || p.due_on >= p.issued_on), 'invoice_dates_invalid'),
  z.strictObject({ ...base, contract_version: z.literal('utilities-monthly-input.v2'), operation: z.literal('review_invoice'), review_task_id: uuid,
    source_hash_contract: z.literal('utilities-invoice-content.v2'),
    expected_source_sha256: sha, decision: z.enum(['approved', 'rejected']), reason: z.string().trim().min(8).max(1000) }),
  z.strictObject({ ...base, contract_version: z.literal('utilities-monthly-input.v1'), operation: z.literal('approve_reading'), expected_source_sha256: sha,
    note: z.string().trim().max(1000).nullable() }),
]);
export type UtilitiesMonthlyInputV1 = z.infer<typeof utilitiesMonthlyInputV1Schema>;
export const UTILITIES_MONTHLY_INPUT_PROFILES_V1 = Object.freeze({
  // Owner-approved distinct capabilities. No role mapping/grant is inferred.
  ingest_invoice: { permission: 'utilities.invoices.ingest', purpose: 'utilities.invoice.ingest', aggregate: 'utilities.provider_invoice' },
  review_invoice: { permission: 'utilities.invoices.review', purpose: 'utilities.invoice.review', aggregate: 'utilities.provider_invoice' },
  approve_reading: { permission: 'utilities.readings.approve', purpose: 'utilities.reading.approve', aggregate: 'utilities.meter_reading' },
});
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function fingerprintUtilitiesMonthlyInputV1(value: unknown) {
  return `sha256:${createHash('sha256').update(canonical(utilitiesMonthlyInputV1Schema.parse(value)), 'utf8').digest('hex')}`;
}
const resultSchema = z.strictObject({ contract_version: z.literal('utilities-monthly-input-result.v1'),
  source_relation: z.enum(['utilities.provider_invoices', 'utilities.meter_readings']), source_id: uuid,
  source_sha256: sha, status: z.enum(['review_required', 'approved', 'void', 'validated']), mutation_id: uuid,
  tenant_id: uuid, actor_id: uuid, database_transaction_id: z.string().regex(/^[1-9][0-9]*$/),
});
function fail(): never { throw Object.assign(Error('UTILITIES_INPUT_UNAVAILABLE'), { code: '55000' }); }
const reviewSourceRequest = z.strictObject({ context_id: uuid, workspace_id: uuid,
  authority_version: z.number().int().positive().safe(), source_id: uuid });
const reviewSourceResult = z.strictObject({ contract_version: z.literal('utilities-invoice-review-source.v2'),
  source_hash_contract: z.literal('utilities-invoice-content.v2'), origin_actor_id: uuid, origin_record_id: uuid,
  source_id: uuid, review_task_id: uuid, source_sha256: sha, tenant_id: uuid, actor_id: uuid,
  database_transaction_id: z.string().regex(/^[1-9][0-9]*$/) });
/** Existing lock-capable SERIALIZABLE read host supplies the live scope.
 * This read creates no command/key/reservation or approval and must use rollback
 * settlement. The host owns disclosure/settlement; runtime/query admission NULL.
 */
export async function readUtilitiesInvoiceReviewSourceV1(scope: CoreTransactionScopeV1, selection: unknown) {
  const input = reviewSourceRequest.parse(selection);
  if (scope.workspace_id !== input.workspace_id) fail();
  const snapshot = [scope.actor_id, scope.tenant_id, scope.workspace_id, scope.transaction_id, scope.database_transaction_id, scope.attempt];
  const rows = await scope.query(UTILITIES_INVOICE_REVIEW_SOURCE_SQL_V1,
    [input.context_id, input.workspace_id, input.authority_version, input.source_id]);
  if (JSON.stringify(snapshot) !== JSON.stringify([scope.actor_id, scope.tenant_id, scope.workspace_id, scope.transaction_id, scope.database_transaction_id, scope.attempt])
    || rows.rowCount !== 1 || rows.rows.length !== 1) fail();
  const result = reviewSourceResult.parse(rows.rows[0].result);
  if (result.source_id !== input.source_id || result.tenant_id !== scope.tenant_id || result.actor_id !== scope.actor_id
    || result.database_transaction_id !== scope.database_transaction_id) fail();
  if (result.origin_actor_id === scope.actor_id) throw Object.assign(Error('UTILITIES_INVOICE_REVIEW_DENIED'), { code: '42501' });
  // Origin identities remain private; this is data, not disclosure/authority.
  return Object.freeze({ source_id: result.source_id, review_task_id: result.review_task_id,
    source_hash_contract: result.source_hash_contract, source_sha256: result.source_sha256 });
}
/** Domain mutation hook, not an HTTP executor, authority provider or retry engine.
 * Wire this ONLY inside the existing authenticated C01/C03 host. The returned
 * internal source observation must never be published before host settlement.
 */
export async function mutateUtilitiesMonthlyInputV1(scope: CoreTransactionScopeV1, commandValue: unknown, inputValue: unknown) {
  const command = coreTransactionCommandV1Schema.parse(commandValue);
  const input = utilitiesMonthlyInputV1Schema.parse(inputValue);
  const profile = UTILITIES_MONTHLY_INPUT_PROFILES_V1[input.operation];
  const sourceIds = input.operation === 'ingest_invoice' ? [input.source_id, input.contract_id, input.ingestion_document_id]
    : input.operation === 'review_invoice' ? [input.source_id, input.review_task_id] : [input.source_id];
  if (command.transaction_id !== scope.transaction_id || command.actor_id !== scope.actor_id
    || command.workspace_id !== scope.workspace_id || command.aggregate_id !== input.source_id
    || command.aggregate_type !== profile.aggregate || command.module_code !== 'utilities'
    || command.permission_code !== profile.permission || command.evaluation_purpose !== profile.purpose
    || command.input_fingerprint !== fingerprintUtilitiesMonthlyInputV1(input)
    || JSON.stringify([...command.provider_source_ids].sort()) !== JSON.stringify([...sourceIds].sort())) fail();
  const snapshot = { actor: scope.actor_id, tenant: scope.tenant_id, workspace: scope.workspace_id,
    transaction: scope.transaction_id, db: scope.database_transaction_id, attempt: scope.attempt };
  if (input.operation === 'review_invoice') {
    const current = await readUtilitiesInvoiceReviewSourceV1(scope, {
      context_id: command.context_id, workspace_id: command.workspace_id,
      authority_version: command.authority_version, source_id: input.source_id,
    });
    if (current.review_task_id !== input.review_task_id || current.source_sha256 !== input.expected_source_sha256
      || current.source_hash_contract !== input.source_hash_contract) {
      throw Object.assign(Error('UTILITIES_INVOICE_SOURCE_DRIFT'), { code: '22023' });
    }
  }
  // Fixed same-transaction calls; no SDK/URL/SQL/allow callback from caller.
  // SQL reacquires/rechecks origin, content and current authority before effect.
  // No catch: preserve the identical 40001, timeout and cancellation objects.
  const rows = await scope.query(UTILITIES_MONTHLY_INPUT_SQL_V1,
    [command.context_id, command.workspace_id, command.authority_version, JSON.stringify(input)]);
  if (snapshot.actor !== scope.actor_id || snapshot.tenant !== scope.tenant_id || snapshot.workspace !== scope.workspace_id
    || snapshot.transaction !== scope.transaction_id || snapshot.db !== scope.database_transaction_id || snapshot.attempt !== scope.attempt) fail();
  if (rows.rowCount !== 1 || rows.rows.length !== 1) fail();
  const result = resultSchema.parse(rows.rows[0].result);
  if (result.source_id !== input.source_id || result.mutation_id !== input.source_id
    || result.tenant_id !== scope.tenant_id || result.actor_id !== scope.actor_id
    || result.database_transaction_id !== scope.database_transaction_id
    || result.source_relation !== (input.operation === 'approve_reading' ? 'utilities.meter_readings' : 'utilities.provider_invoices')
    || result.status !== (input.operation === 'ingest_invoice' ? 'review_required' : input.operation === 'approve_reading' ? 'validated' : input.decision === 'approved' ? 'approved' : 'void')) fail();
  return Object.freeze({ mutation_id: result.mutation_id });
}
