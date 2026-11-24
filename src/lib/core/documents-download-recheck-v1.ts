/** Target-specific canonical recheck AFTER private Storage wait; no fresh receipt. */
import 'server-only';
import type { Pool } from 'pg';
import {
  buildDocumentsVaultDownloadExactWorkspaceCommandV2,
  documentsVaultDownloadExactWorkspaceV2Schema,
  type DocumentsVaultAuthorizedDownloadV2,
  type DocumentsVaultDownloadExactWorkspaceV2,
} from '../customer/documents-vault-download-exact-workspace-v2';
import { createDocumentsFunctionalDownloadProviderV1 } from '../customer/documents-functional-download-provider-v1';
import { createCoreDocumentsCommandBindingV1 } from './documents-command-binding-v1';
import type { CoreFunctionalDevelopmentTargetV1 } from './functional-command-runtime-v1';
import { coreTransactionReceiptV1Schema, type CoreTransactionResultV1 } from './postgres-transaction-host-v1';
import { coreTransactionReplayReceiptHashV1 } from './transaction-replay-provider-hook-v1';

export const CORE_DOCUMENTS_DOWNLOAD_RECHECK_V1 = 'core-documents-download-recheck.v1' as const;
type CommandContext = Parameters<typeof buildDocumentsVaultDownloadExactWorkspaceCommandV2>[1];
type PreparedDownload = Readonly<{
  result: CoreTransactionResultV1;
  private_candidate: DocumentsVaultAuthorizedDownloadV2 | null;
}>;
const privateOnly = { outward_projection: null, current_authority_reusable: false } as const;
const withheld = Object.freeze({ ...privateOnly, status: 'withheld' as const, private_candidate: null });
const unavailable = Object.freeze({ ...privateOnly, status: 'unavailable' as const, private_candidate: null });

function objectIdentity(candidate: DocumentsVaultAuthorizedDownloadV2) {
  return JSON.stringify([
    candidate.document_id, candidate.version_id, candidate.version, candidate.bucket_id,
    candidate.object_path, candidate.storage_object_id, candidate.storage_generation,
    candidate.storage_etag, candidate.sha256, candidate.size_bytes, candidate.mime_type,
  ]);
}

export async function createCoreDocumentsDownloadRecheckV1(
  options: Readonly<{ pool: Pool; target: CoreFunctionalDevelopmentTargetV1; request: Request }>,
) {
  const request = options.request;
  const binding = await createCoreDocumentsCommandBindingV1(options).bind(request);
  if (!binding) return null;
  const { replayHost } = binding;

  async function recheckAfterStorage(inputValue: DocumentsVaultDownloadExactWorkspaceV2, context: CommandContext) {
    const input = documentsVaultDownloadExactWorkspaceV2Schema.parse(inputValue);
    const command = buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
    const current = createDocumentsFunctionalDownloadProviderV1(input, context);
    const result = await replayHost.execute(command, current.providers);
    // The provider's replay check re-reads current authority and the target.
    const privateCandidate = result.status === 'exact_replay' && !request.signal.aborted
      ? current.readPrivateDownloadCandidate() : null;
    return Object.freeze({ ...privateOnly, result, private_candidate: privateCandidate });
  }

  function bindPreparedDownload(
    inputValue: DocumentsVaultDownloadExactWorkspaceV2,
    context: CommandContext,
    prepared: PreparedDownload,
  ) {
    const { result, private_candidate: candidate } = prepared;
    if (request.signal.aborted || !candidate
      || (result.status !== 'committed' && result.status !== 'exact_replay')) return null;
    const input = documentsVaultDownloadExactWorkspaceV2Schema.parse(inputValue);
    const command = buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
    const receipt = coreTransactionReceiptV1Schema.safeParse(result.receipt);
    if (!receipt.success || receipt.data.command_id !== command.command_id
      || receipt.data.workspace_id !== command.workspace_id || receipt.data.mutation_id !== input.version_id
      || receipt.data.input_fingerprint !== command.input_fingerprint
      || candidate.document_id !== input.document_id || candidate.version_id !== input.version_id
      || candidate.version !== input.expected_current_version) return null;
    const receiptHash = coreTransactionReplayReceiptHashV1(receipt.data);
    const identity = objectIdentity(candidate);
    const originalContext = {
      transaction_id: command.transaction_id, command_id: command.command_id,
      actor_id: command.actor_id, authority_version: command.authority_version,
    };

    // Before Storage, retain the original receipt and the exact private object.
    // The caller still owns measuring the downloaded bytes and outward release.
    return Object.freeze({
      async recheckAfterStorage() {
        if (request.signal.aborted) return withheld;
        const current = await recheckAfterStorage(input, originalContext);
        if (current.result.status === 'unknown_commit') return unavailable;
        if (current.result.status !== 'exact_replay' || !current.private_candidate
          || coreTransactionReplayReceiptHashV1(current.result.receipt) !== receiptHash
          || objectIdentity(current.private_candidate) !== identity) return withheld;
        return Object.freeze({
          ...privateOnly, status: 'current_match' as const, private_candidate: current.private_candidate,
        });
      },
    });
  }

  return Object.freeze({
    contract_version: CORE_DOCUMENTS_DOWNLOAD_RECHECK_V1, recheckAfterStorage, bindPreparedDownload,
  });
}
