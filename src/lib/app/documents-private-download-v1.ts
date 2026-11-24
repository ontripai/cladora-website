import 'server-only';

import type { NextRequest } from 'next/server';

import { HEADERS } from '../customer/documents-api-helper';
import { createDocumentsFunctionalCommandsV1 } from '../customer/documents-functional-commands-v1';
import { createDocumentsStorageReadbackV1 } from '../customer/documents-storage-readback-v1';
import { documentsVaultDownloadExactWorkspaceV2Schema } from '../customer/documents-vault-download-exact-workspace-v2';
import { isApplicationJson, parseJsonWithLimit } from '../security/request-body';
import { hasTrustedMutationOrigin } from '../security/same-origin';

type Commands = ReturnType<typeof createDocumentsFunctionalCommandsV1>;
type Storage = ReturnType<typeof createDocumentsStorageReadbackV1>;

/** APP supplies an admitted, request-scoped binding from Core and Platform.
 * Each resolve verifies the current session and the same private custody target.
 */
export type DocumentsPrivateDownloadBindingV1 = Readonly<{
  sessionId: string;
  tenantId: string;
  contextId: string;
  workspaceId: string;
  custodyId: string;
  commandContext: Parameters<Commands['preparePrivateDownload']>[1];
  commands: Pick<Commands, 'preparePrivateDownload' | 'recheckPrivateDownload'>;
  storage: Pick<Storage, 'readbackWithBytes'>;
}>;

const fail = (status: number, code: string) => Response.json({ error: { code } }, { status, headers: HEADERS });
const denied = () => fail(403, 'DOCUMENT_DOWNLOAD_DENIED');
const unavailable = () => fail(503, 'DOCUMENT_DOWNLOAD_UNAVAILABLE');

export function createDocumentsPrivateDownloadPostV1(
  resolve: (request: Request) => Promise<DocumentsPrivateDownloadBindingV1 | null>,
) {
  return async function POST(request: NextRequest): Promise<Response> {
    if (!hasTrustedMutationOrigin(request)) return fail(403, 'BAD_ORIGIN');
    if (!isApplicationJson(request.headers.get('content-type'))) return fail(415, 'UNSUPPORTED_MEDIA_TYPE');
    const body = await parseJsonWithLimit<unknown>(request, 16 * 1024);
    if (body.errorResponse) {
      for (const [name, value] of Object.entries(HEADERS)) body.errorResponse.headers.set(name, value);
      return body.errorResponse;
    }
    const parsed = documentsVaultDownloadExactWorkspaceV2Schema.safeParse(body.data);
    if (!parsed.success) return fail(400, 'INVALID_REQUEST');

    try {
      const binding = await resolve(request);
      const input = parsed.data;
      if (!binding || request.signal.aborted || binding.contextId !== input.context_id
        || binding.workspaceId !== input.workspace_id) return denied();
      const context = Object.freeze({ ...binding.commandContext });
      const prepared = await binding.commands.preparePrivateDownload(input, context);
      const candidate = prepared.private_candidate;
      if (prepared.result.status === 'unknown_commit') return unavailable();
      if (!candidate || (prepared.result.status !== 'committed' && prepared.result.status !== 'exact_replay')) return denied();
      const { measurement, bytes } = await binding.storage.readbackWithBytes({
        bucket_id: candidate.bucket_id, object_path: candidate.object_path,
      });
      if (measurement.bucket_id !== candidate.bucket_id || measurement.object_path !== candidate.object_path
        || measurement.storage_object_id !== candidate.storage_object_id
        || measurement.storage_generation !== candidate.storage_generation
        || measurement.storage_etag !== candidate.storage_etag || measurement.sha256 !== candidate.sha256
        || measurement.size_bytes !== candidate.size_bytes || bytes.size !== candidate.size_bytes
        || measurement.detected_mime_type !== candidate.mime_type) return unavailable();

      const current = await resolve(request);
      if (!current || current.sessionId !== binding.sessionId || current.tenantId !== binding.tenantId
        || current.contextId !== binding.contextId || current.workspaceId !== binding.workspaceId
        || current.custodyId !== binding.custodyId || current.commandContext.actor_id !== context.actor_id
        || current.commandContext.authority_version !== context.authority_version || request.signal.aborted) return denied();
      const checked = await current.commands.recheckPrivateDownload(input, context);
      if (checked.result.status === 'unknown_commit') return unavailable();
      if (request.signal.aborted || checked.result.status !== 'exact_replay'
        || checked.result.receipt.receipt_id !== prepared.result.receipt.receipt_id
        || JSON.stringify(checked.private_candidate) !== JSON.stringify(candidate)) return denied();

      return new Response(bytes, { headers: { ...HEADERS, 'Content-Type': candidate.mime_type,
        'Content-Disposition': 'attachment', 'X-Content-Type-Options': 'nosniff' } });
    } catch {
      return unavailable();
    }
  };
}
