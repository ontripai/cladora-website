import { z } from 'zod';

// Correlation ONLY. No actor, authority revision, receipt, bytes or object path.
// Field order is explicit and identical in browser and server. No trimming,
// Unicode normalization, inference or JSON property insertion order dependence.
const uuid = z.string().uuid();
export const documentsUploadSnapshotV1Schema = z.strictObject({
  context_id: uuid, workspace_id: uuid,
  filename: z.string().min(1).max(255),
  declared_mime: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
  title: z.string().min(1).max(500).refine(value => value === value.trim()),
  document_type: z.string().min(1).max(120).refine(value => value === value.trim()),
  classification: z.enum(['public', 'internal', 'confidential', 'restricted']),
  property_id: uuid.nullable(),
});
export type DocumentsUploadSnapshotV1 = z.infer<typeof documentsUploadSnapshotV1Schema>;
export function serializeDocumentsUploadSnapshotV1(value: unknown): string {
  const s = documentsUploadSnapshotV1Schema.parse(value);
  return JSON.stringify({ context_id: s.context_id, workspace_id: s.workspace_id,
    filename: s.filename, declared_mime: s.declared_mime, size_bytes: s.size_bytes,
    title: s.title, document_type: s.document_type, classification: s.classification, property_id: s.property_id });
}
export const documentsUploadIntentRequestV1Schema = documentsUploadSnapshotV1Schema.extend({
  idempotency_key: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  request_sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const documentsUploadFinalizationRequestV1Schema = documentsUploadIntentRequestV1Schema.extend({ intent_id: uuid });
export function documentsUploadRequestSnapshotV1(value: z.infer<typeof documentsUploadIntentRequestV1Schema>) {
  // Explicit extraction, never stripping unknown fields from an unparsed request.
  return documentsUploadSnapshotV1Schema.parse({ context_id: value.context_id, workspace_id: value.workspace_id,
    filename: value.filename, declared_mime: value.declared_mime, size_bytes: value.size_bytes,
    title: value.title, document_type: value.document_type, classification: value.classification, property_id: value.property_id });
}
