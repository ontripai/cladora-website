/** Inactive pure consumer of the official historical Core14 matcher. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  CORE_CE012_CLOSED_BINDING_MATCHER_V1,
  coreCe012ClosedBindingExpectationV1Schema, matchCoreCe012ClosedBindingV1,
} from '../core/postgres-transaction-host-v1';
import { coreCe012StoredRelationRequestV1Schema } from '../core/ce012-stored-relation-v1';
import { fingerprintCe012GuideSavePayload } from '../community/experience-guide-command-contract';

export const DOCUMENTS_CE012_CLOSED_REPLAY_ADOPTER_V2 = 'documents-ce012-closed-replay-adopter.v2' as const;
export const DOCUMENTS_CE012_CLOSED_REPLAY_RUNTIME_BINDING_V2 = null;
export const DOCUMENTS_CE012_CLOSED_REPLAY_CORE_SOURCE_V2 = '3e9593af25433dcf32042f624731f514d09ec35b';
const input = z.strictObject({
  contract: z.literal(DOCUMENTS_CE012_CLOSED_REPLAY_ADOPTER_V2),
  original: coreCe012StoredRelationRequestV1Schema,
  matcher: coreCe012ClosedBindingExpectationV1Schema,
});
type Input = z.infer<typeof input>;
function sameSavedRelation(v: Input): boolean {
  const { command: c, guide_command: g, expected: receipt } = v.original;
  const { command: mc, binding: b } = v.matcher, target = g.payload.document_target;
  // Both command schemas are the actual canonical Core schema. Compare the full
  // parsed representation, not two independent expectations or a supplied hash.
  return JSON.stringify(c) === JSON.stringify(mc) && target !== null
    && c.command_id === g.command_id && c.context_id === g.context_id && c.workspace_id === g.workspace_id
    && c.aggregate_type === 'experience_guide' && c.aggregate_id === g.guide_id
    && c.aggregate_version === g.expected_guide_version + 1
    && c.permission_code === 'experience.guide.manage' && c.module_code === 'experience_guides'
    && c.evaluation_purpose === 'experience.guide.command'
    && c.subject_reference.kind === 'experience.guide' && c.subject_reference.id === g.guide_id
    && c.subject_reference.version === g.expected_guide_version
    && c.subject_reference.relation === 'save_draft' && c.subject_reference.request_version === 1
    && c.provider_source_ids.includes(g.guide_id) && c.provider_source_ids.includes(target.document_id)
    && c.provider_source_ids.includes(target.document_version_id)
    && c.idempotency_key === g.idempotency_key && c.input_fingerprint === g.payload_fingerprint
    && fingerprintCe012GuideSavePayload(g) === g.payload_fingerprint
    && b.command_hash === createHash('sha256').update(JSON.stringify(c)).digest('hex')
    && b.canonical_key === `core-tx.v1:${c.workspace_id}:${c.idempotency_key}`
    && b.transaction_id === c.transaction_id && b.command_id === c.command_id && b.actor_id === c.actor_id
    && b.context_id === c.context_id && b.workspace_id === c.workspace_id && b.authority_revision === c.authority_version
    && b.ce_save_receipt_id === receipt.ce_save_receipt_id
    && b.core_receipt_id === receipt.core_receipt_id && b.core_receipt_hash === receipt.core_receipt_hash
    && b.target.document_id === target.document_id && b.target.document_version_id === target.document_version_id
    && b.target.document_version === target.document_version;
}
/** Full tenant/member/execution binding is REQUIRED by the imported Core schema.
 * It is never guessed from UI, locale, result metadata or another candidate.
 */
export const documentsCe012ClosedReplayExpectationV2Schema = input.superRefine((value, ctx) => {
  if (!sameSavedRelation(value)) ctx.addIssue({ code: 'custom', message: 'Unrelated closed replay expectations' });
});
export type DocumentsCe012ClosedReplayExpectationV2 = z.infer<typeof documentsCe012ClosedReplayExpectationV2Schema>;
const answer = (match: 'MATCH' | 'NO_MATCH', code: 'HISTORICAL_CLOSED_BINDING_MATCH' | 'NO_CLOSED_BINDING_MATCH' | 'INVALID_EXPECTATION') => Object.freeze({
  contract: DOCUMENTS_CE012_CLOSED_REPLAY_ADOPTER_V2, match, code, status: 'not_ready' as const,
  projection: null, current_authority: 'not_evaluated' as const, runtime_binding: null,
  reusable_as_command_authority: false as const,
});

/** Synchronous read-only comparison. No query/host execution/registration/retry. */
export function readDocumentsCe012ClosedReplayV2(result: unknown, exactResponseBytes: Uint8Array, expected: unknown) {
  try {
    const parsed = documentsCe012ClosedReplayExpectationV2Schema.safeParse(expected);
    if (!parsed.success) return answer('NO_MATCH', 'INVALID_EXPECTATION');
    const matched = matchCoreCe012ClosedBindingV1(result, exactResponseBytes, parsed.data.matcher);
    if (matched.contract !== CORE_CE012_CLOSED_BINDING_MATCHER_V1 || matched.match !== 'MATCH'
      || matched.status !== 'not_ready' || matched.projection !== null || matched.current_authority !== 'not_evaluated') {
      return answer('NO_MATCH', 'NO_CLOSED_BINDING_MATCH');
    }
    return answer('MATCH', 'HISTORICAL_CLOSED_BINDING_MATCH');
  } catch { return answer('NO_MATCH', 'INVALID_EXPECTATION'); }
}
