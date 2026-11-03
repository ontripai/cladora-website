/** Application commands over the existing Documents engines, no parallel store. */
import type { CoreTransactionHostV1 } from '../core/postgres-transaction-host-v1';
import {
  buildDocumentsNewDocumentIntentCommandV1, createDocumentsNewDocumentIntentProvidersV1,
  buildDocumentsInitialVersionCommandV1, createDocumentsInitialVersionProvidersV1,
  type DocumentsNewDocumentIntentV1, type DocumentsInitialVersionV1, type VerifiedDocumentsStoredObjectV1,
} from './documents-workspace-binding-writer-v1';
import {
  buildDocumentsReplacementIntentCommandV1, createDocumentsReplacementIntentProvidersV1,
  buildDocumentsReplacementCandidateCommandV1, createDocumentsReplacementCandidateProvidersV1,
  type DocumentsReplacementIntentV1, type DocumentsReplacementCandidateV1,
} from './documents-replacement-workspace-writer-v1';
import {
  buildDocumentsReplacementPromotionAfterCleanCommandV1, createDocumentsReplacementPromotionAfterCleanProvidersV1,
  type DocumentsReplacementPromotionAfterCleanV1,
} from './documents-replacement-promotion-after-clean-v1';
import { buildDocumentsVaultDownloadExactWorkspaceCommandV2, type DocumentsVaultDownloadExactWorkspaceV2 } from './documents-vault-download-exact-workspace-v2';
import { createDocumentsFunctionalDownloadProviderV1 } from './documents-functional-download-provider-v1';

type CommandContext = Parameters<typeof buildDocumentsNewDocumentIntentCommandV1>[1];
/** The actual Core15 server composition must provide the authenticated role-bound
 * host and server-derived command context. None is made from browser metadata.
 * IDs/key/context are retained by the caller across UNKNOWN; this module creates
 * no replacement keys, automatic retry loop or private idempotency ledger.
 */
export function createDocumentsFunctionalCommandsV1(host: CoreTransactionHostV1) {
  return Object.freeze({
    issueNewIntent(input: DocumentsNewDocumentIntentV1, context: CommandContext) {
      return host.execute(buildDocumentsNewDocumentIntentCommandV1(input, context),
        createDocumentsNewDocumentIntentProvidersV1(input, context));
    },
    finalizeInitial(input: DocumentsInitialVersionV1, context: CommandContext, object: VerifiedDocumentsStoredObjectV1) {
      return host.execute(buildDocumentsInitialVersionCommandV1(input, context, object),
        createDocumentsInitialVersionProvidersV1(input, context, object));
    },
    issueReplacementIntent(input: DocumentsReplacementIntentV1, context: CommandContext) {
      return host.execute(buildDocumentsReplacementIntentCommandV1(input, context),
        createDocumentsReplacementIntentProvidersV1(input, context));
    },
    stageReplacement(input: DocumentsReplacementCandidateV1, context: CommandContext, object: VerifiedDocumentsStoredObjectV1) {
      return host.execute(buildDocumentsReplacementCandidateCommandV1(input, context, object),
        createDocumentsReplacementCandidateProvidersV1(input, context, object));
    },
    promoteCleanReplacement(input: DocumentsReplacementPromotionAfterCleanV1, context: CommandContext, object: VerifiedDocumentsStoredObjectV1) {
      // The canonical provider locks/rechecks actual attestation and CAS parent.
      // No client/worker clean flag can substitute for its database checks.
      return host.execute(buildDocumentsReplacementPromotionAfterCleanCommandV1(input, context, object),
        createDocumentsReplacementPromotionAfterCleanProvidersV1(input, context, object));
    },
    async preparePrivateDownload(input: DocumentsVaultDownloadExactWorkspaceV2, context: CommandContext) {
      const command = buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
      const download = createDocumentsFunctionalDownloadProviderV1(input, context);
      const result = await host.execute(command, download.providers);
      const successful = (result.status === 'committed' || result.status === 'exact_replay')
        && result.receipt.mutation_id === input.version_id
        && result.receipt.command_id === command.command_id
        && result.receipt.workspace_id === input.workspace_id
        && result.receipt.input_fingerprint === command.input_fingerprint;
      // Not a stream/signed URL or release authority. Core15 must recheck current
      // target/session + Platform12 custody after Storage read and before response.
      return Object.freeze({ result, private_candidate: successful ? download.readPrivateDownloadCandidate() : null,
        outward_projection: null, current_disclosure: 'not_evaluated' as const });
    },
  });
}
