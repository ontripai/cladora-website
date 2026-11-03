/** Existing Vault provider + existing target-specific selector, same Core scope. */
import type { CoreTransactionProvidersV1 } from '../core/postgres-transaction-host-v1';
import {
  buildDocumentsVaultDownloadExactWorkspaceCommandV2,
  createDocumentsVaultDownloadExactWorkspaceProvidersV2,
  type DocumentsVaultDownloadExactWorkspaceV2,
} from './documents-vault-download-exact-workspace-v2';
import { selectDocumentsReferenceInCoreTransactionV1 } from './documents-reference-tx-selector-v1';

/** Private provider composition, not a route/download permit. Core15 final
 * current-disclosure + Platform12 custody must gate any outward body/label after
 * Storage waits. A historical closed MATCH is never used as authority here.
 */
export function createDocumentsFunctionalDownloadProviderV1(
  input: DocumentsVaultDownloadExactWorkspaceV2,
  context: Parameters<typeof buildDocumentsVaultDownloadExactWorkspaceCommandV2>[1],
) {
  const base = createDocumentsVaultDownloadExactWorkspaceProvidersV2(input, context);
  const command = buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
  const target = Object.freeze({ document_id: input.document_id, document_version_id: input.version_id,
    document_version: input.expected_current_version });
  let eligible = false;
  const providers: CoreTransactionProvidersV1 = {
    ...base.providers,
    async validateProviders(scope, actual, authority) {
      eligible = false;
      if (JSON.stringify(actual) !== JSON.stringify(command)
        || !await base.providers.validateProviders(scope, actual, authority)) return false;
      const selected = await selectDocumentsReferenceInCoreTransactionV1(scope, actual, authority, target);
      eligible = selected.decision === 'accepted';
      return eligible;
    },
    async validateReplay(...args: Parameters<NonNullable<CoreTransactionProvidersV1['validateReplay']>>) {
      const [scope, actual, authority, receipt] = args;
      eligible = false;
      if (!base.providers.validateReplay) throw new Error('documents_replay_provider_unavailable');
      const replay = await base.providers.validateReplay(scope, actual, authority, receipt);
      if (replay.decision !== 'accepted') return replay;
      const selected = await selectDocumentsReferenceInCoreTransactionV1(scope, actual, authority, target);
      eligible = selected.decision === 'accepted';
      return eligible ? replay : { ...replay, decision: 'denied' as const, denial_reason: 'REPLAY_STATE_CHANGED' as const };
    },
    async mutate(scope, actual) {
      if (!eligible) throw new Error('documents_target_read_required');
      return base.providers.mutate(scope, actual);
    },
  };
  return Object.freeze({ providers: Object.freeze(providers),
    readPrivateDownloadCandidate() {
      const storage = eligible ? base.readAuthorizedDownload() : null;
      return storage ? Object.freeze({ ...storage, reusable_as_download_authority: false as const }) : null;
    },
  });
}
