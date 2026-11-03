import { z } from 'zod';
import type { CoreTransactionReceiptV1 } from '../core/postgres-transaction-host-v1';

// Inactive HTTP projection contract for the existing writer. It carries no
// authority receipt, object identity, path, scan attestation or download permit.
// The maintenance routes do not produce this ACK. A future server adapter must
// project an actual committed/exact-replay result, never a Storage response.
const uuid = z.string().uuid();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const binding = {
  context_id: uuid, workspace_id: uuid, actor_id: uuid,
  request_sha256: sha256,
};
export const documentsUploadIntentAckV1Schema = z.strictObject({
  contract_version: z.literal('documents-upload-intent-ack.v1'), ...binding,
  idempotency_key: z.string().min(8).max(160),
  intent_id: uuid, prospective_document_id: uuid,
});
// This is a bounded projection of CoreTransactionReceiptV1, not a second Core
// receipt/authority interface. Full private Core receipts are not HTTP payloads.
const receiptSchema = z.strictObject({
  contract_version: z.literal('core-transaction-receipt.v1'), receipt_id: uuid,
  workspace_id: uuid, actor_id: uuid, aggregate_type: z.literal('documents.document'),
  aggregate_id: uuid, aggregate_version: z.literal(1), mutation_id: uuid,
  idempotency_key: z.string().min(8).max(160), committed_at: z.iso.datetime({ offset: true }),
});
type ReceiptProjection = Pick<CoreTransactionReceiptV1,
  'contract_version' | 'receipt_id' | 'workspace_id' | 'actor_id' | 'aggregate_type'
  | 'aggregate_id' | 'aggregate_version' | 'mutation_id' | 'idempotency_key' | 'committed_at'>;
const projectionTypeCheck: z.ZodType<ReceiptProjection> = receiptSchema;
export const documentsUploadFinalizationAckV1Schema = z.strictObject({
  contract_version: z.literal('documents-upload-finalization-ack.v1'), ...binding,
  status: z.enum(['committed', 'exact_replay']), intent_id: uuid,
  document_id: uuid, document_version_id: uuid, receipt: projectionTypeCheck,
});
export type DocumentsUploadUiBindingV1 = z.infer<typeof documentsUploadIntentAckV1Schema>;
export function matchesDocumentsUploadFinalizationAckV1(
  value: unknown, intent: DocumentsUploadUiBindingV1, finalizationKey: string,
) {
  const parsed = documentsUploadFinalizationAckV1Schema.safeParse(value);
  if (!parsed.success) return false;
  const ack = parsed.data;
  return ack.context_id === intent.context_id && ack.workspace_id === intent.workspace_id
    && ack.actor_id === intent.actor_id && ack.request_sha256 === intent.request_sha256
    && ack.intent_id === intent.intent_id && ack.document_id === intent.prospective_document_id
    && ack.receipt.workspace_id === intent.workspace_id && ack.receipt.actor_id === intent.actor_id
    && ack.receipt.aggregate_id === ack.document_id && ack.receipt.mutation_id === ack.document_version_id
    && ack.receipt.idempotency_key === finalizationKey;
}
