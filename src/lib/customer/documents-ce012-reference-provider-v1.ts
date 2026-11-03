import { randomUUID } from 'node:crypto';
import {
  ce012GuideSaveCommandV1Schema,
  fingerprintCe012GuideSavePayload,
} from '../community/experience-guide-command-contract';
import {
  coreTransactionCommandV2Schema,
  type CoreTransactionCommandV2,
  type CoreTransactionScopeV1,
} from '../core/postgres-transaction-host-v1';
import {
  currentAuthorityTransactionDecisionReceiptV1Schema,
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from '../core/current-authority-transaction-port-v1';
import {
  DOCS_CE012_REFERENCE_DECISION_CONTRACT,
  docsCe012ReferenceDecisionV1Schema,
  docsCe012ReferenceRequestV1Schema,
  type DocsCe012ReferenceDecisionV1,
  type DocsCe012ReferenceRequestV1,
} from './documents-ce012-reference-contract';
import {
  selectDocumentsReferenceInCoreTransactionV1,
  selectDocumentsHistoricalReferenceInCoreTransactionV1,
} from './documents-reference-tx-selector-v1';

export const documentsCe012ReferenceProviderVersionV1 = 'documents-ce012-reference-provider.v1';

/** Inactive, transaction-local bridge implementation. Construct only inside
 * Core validateProviders / validateReplay after the Guide lock and current
 * server-session authority check. Never retain it beyond that read phase.
 * Replay mode must come from Core's matched-receipt replay hook, never HTTP.
 * The factory accepts capabilities, not a caller-provided actor/authority port.
 */
export function createDocumentsCe012ReferenceProviderV1(
  scope: CoreTransactionScopeV1,
  commandValue: CoreTransactionCommandV2,
  authorityValue: CurrentAuthorityTransactionDecisionReceiptV1,
  guideCommandValue: unknown,
  evaluationMode: DocsCe012ReferenceRequestV1['evaluation_mode'],
) {
  // Parse into private copies: later mutation of caller objects cannot rebind a
  // provider instance. Document source_version is the existing target.document_version;
  // Guide source version is expected_guide_version. Neither needs a new wire field.
  const command = coreTransactionCommandV2Schema.parse(commandValue);
  const authority = currentAuthorityTransactionDecisionReceiptV1Schema.parse(authorityValue);
  const guide = ce012GuideSaveCommandV1Schema.parse(guideCommandValue);
  const target = guide.payload.document_target;
  const sourceVersion = guide.expected_guide_version;
  const bound = fingerprintCe012GuideSavePayload(guide) === guide.payload_fingerprint
    && command.command_id === guide.command_id
    && command.context_id === guide.context_id
    && command.workspace_id === guide.workspace_id
    && command.aggregate_type === 'experience_guide'
    && command.aggregate_id === guide.guide_id
    && command.aggregate_version === sourceVersion + 1
    && command.subject_reference.kind === 'experience.guide'
    && command.subject_reference.id === guide.guide_id
    && command.subject_reference.version === sourceVersion
    && command.subject_reference.relation === 'save_draft'
    && command.subject_reference.request_version === 1
    && command.permission_code === 'experience.guide.manage'
    && command.module_code === 'experience_guides'
    && command.evaluation_purpose === 'experience.guide.command'
    && command.input_fingerprint === guide.payload_fingerprint
    && command.idempotency_key === guide.idempotency_key
    && (evaluationMode === 'new_command' || evaluationMode === 'replay');

  return {
    async select(requestValue: unknown): Promise<DocsCe012ReferenceDecisionV1> {
      const request = docsCe012ReferenceRequestV1Schema.parse(requestValue);
      const decision = (
        status: DocsCe012ReferenceDecisionV1['decision'],
        evaluatedAt = authority.evaluated_at,
      ): DocsCe012ReferenceDecisionV1 => docsCe012ReferenceDecisionV1Schema.parse({
        contract: DOCS_CE012_REFERENCE_DECISION_CONTRACT,
        version: 1,
        decision_id: randomUUID(),
        context_id: request.context_id,
        workspace_id: request.workspace_id,
        guide_id: request.guide_id,
        target: request.target,
        evaluation_mode: request.evaluation_mode,
        authority_basis: 'current_server_session',
        decision: status,
        // Documents-owned neutral label: no title, path, classification, hash or
        // caller label is fetched or echoed, even for an authorized reference.
        safe_label: status === 'current_authorized' || status === 'historical_authorized'
          ? 'Document reference' : null,
        redaction: status === 'current_authorized' || status === 'historical_authorized'
          ? 'safe_label_only' : 'none',
        evaluated_at: evaluatedAt,
      });
      if (!bound || target === null
        || request.context_id !== guide.context_id
        || request.workspace_id !== guide.workspace_id
        || request.guide_id !== guide.guide_id
        || request.evaluation_mode !== evaluationMode
        || request.target.document_id !== target.document_id
        || request.target.document_version_id !== target.document_version_id
        || request.target.document_version !== target.document_version) {
        return decision('denied');
      }
      try {
        // Derive the actor from the host's server-authenticated SQL session,
        // then compare it to the private host command and post-lock receipt.
        const session = await scope.query<{ actor_id: string | null }>(
          'select auth.uid()::text as actor_id',
        );
        const actor = session.rows[0]?.actor_id;
        if (session.rowCount !== 1 || !actor || actor !== scope.actor_id
          || actor !== command.actor_id || actor !== authority.actor_id) {
          return decision('denied');
        }
        const selectReference = evaluationMode === 'new_command'
          ? selectDocumentsReferenceInCoreTransactionV1
          : selectDocumentsHistoricalReferenceInCoreTransactionV1;
        const selected = await selectReference(scope, command, authority, request.target);
        if (selected.decision !== 'accepted') {
          return decision(selected.denial_reason === 'STALE_REFERENCE' ? 'stale'
            : selected.denial_reason === 'PROVIDER_UNAVAILABLE' ? 'not_ready' : 'denied',
          selected.evaluated_at);
        }
        return decision(evaluationMode === 'new_command'
          ? 'current_authorized' : 'historical_authorized', selected.evaluated_at);
      } catch (error) {
        if ((error as { code?: string })?.code === '40001') throw error;
        return decision('not_ready');
      }
    },
  };
}
