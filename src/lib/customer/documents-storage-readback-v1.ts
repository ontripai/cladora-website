/** Trusted-server Storage byte adapter. Measurements are NOT authority or scan. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  documentsNewDocumentIntentV1Schema, type DocumentsNewDocumentIntentV1,
} from './documents-workspace-binding-writer-v1';
import { processUploadStream } from './documents-stream-handler';

const targetSchema = z.strictObject({ bucket_id: z.literal('document-vault'),
  object_path: z.string().min(3).max(1024).refine(p => !p.startsWith('/') && !p.includes('..')) });
const infoSchema = z.object({ id: z.string().uuid(), name: z.string(), bucketId: z.literal('document-vault'),
  size: z.number().int().positive().max(20 * 1024 * 1024), contentType: z.string().min(3).max(160),
  version: z.string().min(1).max(255).nullish(), etag: z.string().min(1).max(1024).nullish() });
export class DocumentsStorageReadbackUnavailableV1 extends Error {
  constructor(readonly code: 'UPLOAD_OUTCOME_UNCONFIRMED' | 'READBACK_UNAVAILABLE' | 'OBJECT_CHANGED' | 'CONTENT_MISMATCH') {
    super(code); this.name = 'DocumentsStorageReadbackUnavailableV1';
  }
}

/** The caller must supply Platform's actual scoped Storage client AFTER canonical
 * intent issuance/custody admission. This factory neither provisions a client nor
 * loads credentials. No public route is wired and no service_role fallback exists.
 */
export function createDocumentsStorageReadbackV1(client: Pick<SupabaseClient, 'storage'>) {
  async function readback(targetValue: z.input<typeof targetSchema>) {
    const target = targetSchema.parse(targetValue), bucket = client.storage.from(target.bucket_id);
    const beforeResponse = await bucket.info(target.object_path);
    const before = infoSchema.safeParse(beforeResponse.data);
    if (beforeResponse.error || !before.success || before.data.name !== target.object_path) {
      throw new DocumentsStorageReadbackUnavailableV1('READBACK_UNAVAILABLE');
    }
    const downloaded = await bucket.download(target.object_path);
    if (downloaded.error || !downloaded.data || downloaded.data.size !== before.data.size) {
      throw new DocumentsStorageReadbackUnavailableV1('CONTENT_MISMATCH');
    }
    const processed = await processUploadStream(downloaded.data.stream(), before.data.contentType, before.data.size);
    const afterResponse = await bucket.info(target.object_path), after = infoSchema.safeParse(afterResponse.data);
    if (afterResponse.error || !after.success || JSON.stringify(before.data) !== JSON.stringify(after.data)) {
      throw new DocumentsStorageReadbackUnavailableV1('OBJECT_CHANGED');
    }
    return Object.freeze({ bucket_id: target.bucket_id, object_path: target.object_path,
      storage_object_id: before.data.id,
      generation_capability: before.data.version ? 'exposed' as const : 'not_exposed' as const,
      storage_generation: before.data.version ?? null,
      etag_capability: before.data.etag ? 'exposed' as const : 'not_exposed' as const,
      storage_etag: before.data.etag ?? null,
      sha256: processed.result.serverSha256, size_bytes: processed.result.totalBytes,
      detected_mime_type: processed.result.detectedMime,
      // Deliberately NOT a VerifiedDocumentsStoredObjectV1. Platform12 must prove
      // non-overwrite/custody separately; info/version/ETag cannot establish it.
      non_overwrite_verified: false as const, scan_authority: false as const,
      reusable_as_download_authority: false as const });
  }
  return Object.freeze({ readback,
    async uploadNew(intentValue: DocumentsNewDocumentIntentV1, bytesValue: Uint8Array) {
      const intent = documentsNewDocumentIntentV1Schema.parse(intentValue);
      targetSchema.parse({ bucket_id: 'document-vault', object_path: intent.object_path });
      const bytes = Uint8Array.from(bytesValue);
      const measured = await processUploadStream((async function* () { yield bytes; })(),
        intent.declared_mime_type, intent.max_size_bytes);
      let uploaded;
      try { uploaded = await client.storage.from('document-vault').upload(intent.object_path, bytes,
        { upsert: false, contentType: measured.result.detectedMime, cacheControl: '0' }); }
      catch { throw new DocumentsStorageReadbackUnavailableV1('UPLOAD_OUTCOME_UNCONFIRMED'); }
      // Duplicate/already-exists and lost ACK are NEVER translated to success.
      // Retain original intent/path and use separately authorized recovery/readback.
      if (uploaded.error || !uploaded.data || uploaded.data.path !== intent.object_path
        || !z.string().uuid().safeParse(uploaded.data.id).success) {
        throw new DocumentsStorageReadbackUnavailableV1('UPLOAD_OUTCOME_UNCONFIRMED');
      }
      const stored = await readback({ bucket_id: 'document-vault', object_path: intent.object_path });
      if (stored.storage_object_id !== uploaded.data.id || stored.sha256 !== measured.result.serverSha256
        || stored.size_bytes !== measured.result.totalBytes || stored.detected_mime_type !== measured.result.detectedMime) {
        throw new DocumentsStorageReadbackUnavailableV1('CONTENT_MISMATCH');
      }
      return stored;
    },
  });
}
