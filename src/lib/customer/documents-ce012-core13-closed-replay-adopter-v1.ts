/** Pure inactive reader of closed host metadata. Never current Docs authority. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  coreHostJointReplaySealV1, coreHostTerminalLifecycleV1,
  coreHostTerminalResponseMatchesV1, coreTransactionReceiptV2Schema,
} from '../core/postgres-transaction-host-v1';
import { coreCe012StoredRelationRequestV1Schema } from '../core/ce012-stored-relation-v1';
import { coreTransactionReplayReceiptHashV1 } from '../core/transaction-replay-provider-hook-v1';
import { coreSubjectReferencesMatch } from '../core/transaction-provider-evidence-v1';
import { fingerprintCe012GuideSavePayload } from '../community/experience-guide-command-contract';

export const DOCUMENTS_CORE13_CLOSED_REPLAY_ADOPTER_V1 = 'documents-ce012-core13-closed-replay-adopter.v1' as const;
export const DOCUMENTS_CORE13_CLOSED_REPLAY_RUNTIME_BINDING = null;
export const DOCUMENTS_CORE13_SOURCE = '1971770a7ee92c2020387c5222b0c7da03a552d8';
export const documentsCore13ClosedReplayExpectationV1Schema = z.strictObject({
  contract: z.literal(DOCUMENTS_CORE13_CLOSED_REPLAY_ADOPTER_V1),
  original: coreCe012StoredRelationRequestV1Schema,
  execution: z.strictObject({ attempt: z.number().int().positive().safe(),
    backend_pid: z.number().int().positive().safe(), database_transaction_id: z.string().regex(/^[1-9][0-9]*$/) }),
});
type Code = 'INVALID_EXPECTATION' | 'UNRECOGNIZED_RESULT' | 'REPLAY_ROLLBACK_REQUIRED'
  | 'RESPONSE_BYTES_MISMATCH' | 'EXECUTION_MISMATCH' | 'INPUT_BINDING_MISMATCH'
  | 'RECEIPT_MISMATCH' | 'TARGET_MISMATCH' | 'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED';
const answer = (code: Code) => Object.freeze({
  contract: DOCUMENTS_CORE13_CLOSED_REPLAY_ADOPTER_V1, status: 'not_ready' as const,
  code, projection: null, runtime_binding: null, current_authority: 'not_evaluated' as const,
  reusable_as_command_authority: false as const,
});
const hex = (s: string | null) => s !== null && /^[a-f0-9]{64}$/.test(s);

/**
 * Actual result identity and exact response bytes only. Expectation is a comparison
 * input, NOT authority/custody or an externally supplied Docs candidate. No query,
 * host execution, write, retry, key/receipt generation or caller verifier exists.
 */
export function readDocumentsCore13ClosedReplayV1(result: unknown, responseBytes: Uint8Array, expected: unknown) {
  const parsed = documentsCore13ClosedReplayExpectationV1Schema.safeParse(expected);
  if (!parsed.success) return answer('INVALID_EXPECTATION');
  const lifecycle = coreHostTerminalLifecycleV1(result);
  const joint = coreHostJointReplaySealV1(result);
  if (!lifecycle || !joint) return answer('UNRECOGNIZED_RESULT');
  if (typeof result !== 'object' || result === null || !('status' in result) || result.status !== 'exact_replay'
    || !('receipt' in result) || lifecycle.settlement !== 'replay_rolled_back'
    || lifecycle.observation !== 'sealed_and_closed' || lifecycle.first_error_code !== null
    || lifecycle.disclosure_authorization !== 'not_ready' || lifecycle.live_observation !== false
    || lifecycle.reusable_in_other_attempt !== false
    || joint.contract !== 'core-ce012-joint-replay-seal.v1' || joint.status !== 'not_ready'
    || joint.registration !== 'closed_opaque_candidate' || joint.settlement !== 'replay_rolled_back'
    || joint.current_authority !== 'not_evaluated' || joint.projection !== null) return answer('REPLAY_ROLLBACK_REQUIRED');
  try {
    if (!(responseBytes instanceof Uint8Array)) return answer('RESPONSE_BYTES_MISMATCH');
    const bytes = Buffer.from(responseBytes); // Private stable byte image; never echo.
    if (!coreHostTerminalResponseMatchesV1(result, bytes)
      || lifecycle.response_encoding !== 'core-host-result-json-utf8.v1'
      || createHash('sha256').update(bytes).digest('hex') !== lifecycle.response_sha256
      || joint.response_sha256 !== lifecycle.response_sha256 || joint.seal_sha256 !== lifecycle.seal_sha256
      || !hex(joint.candidate_sha256) || !hex(joint.seal_sha256) || !hex(lifecycle.observation_sha256)
      || !z.string().uuid().safeParse(joint.candidate_id).success) return answer('RESPONSE_BYTES_MISMATCH');
  } catch { return answer('RESPONSE_BYTES_MISMATCH'); }
  const { original, execution } = parsed.data;
  if (joint.attempt !== lifecycle.attempt || joint.backend_pid !== lifecycle.backend_pid
    || joint.database_transaction_id !== lifecycle.database_transaction_id
    || joint.attempt !== execution.attempt || joint.backend_pid !== execution.backend_pid
    || joint.database_transaction_id !== execution.database_transaction_id) return answer('EXECUTION_MISMATCH');
  const c = original.command, g = original.guide_command, target = g.payload.document_target;
  if (target === null || c.command_id !== g.command_id || c.context_id !== g.context_id
    || c.workspace_id !== g.workspace_id || c.aggregate_id !== g.guide_id
    || c.aggregate_type !== 'experience_guide' || c.aggregate_version !== g.expected_guide_version + 1
    || c.idempotency_key !== g.idempotency_key || c.input_fingerprint !== g.payload_fingerprint
    || fingerprintCe012GuideSavePayload(g) !== g.payload_fingerprint
    || c.permission_code !== 'experience.guide.manage' || c.module_code !== 'experience_guides'
    || c.evaluation_purpose !== 'experience.guide.command'
    || c.subject_reference.kind !== 'experience.guide' || c.subject_reference.id !== g.guide_id
    || c.subject_reference.version !== g.expected_guide_version || c.subject_reference.relation !== 'save_draft'
    || c.subject_reference.request_version !== 1
    || !c.provider_source_ids.includes(g.guide_id) || !c.provider_source_ids.includes(target.document_id)
    || !c.provider_source_ids.includes(target.document_version_id)) return answer('INPUT_BINDING_MISMATCH');
  const receipt = coreTransactionReceiptV2Schema.safeParse(result.receipt);
  if (!receipt.success) return answer('RECEIPT_MISMATCH');
  const r = receipt.data;
  if (r.receipt_id !== original.expected.core_receipt_id
    || coreTransactionReplayReceiptHashV1(r) !== original.expected.core_receipt_hash
    || r.transaction_id !== c.transaction_id || r.command_id !== c.command_id || r.actor_id !== c.actor_id
    || r.workspace_id !== c.workspace_id || r.idempotency_key !== c.idempotency_key
    || r.input_fingerprint !== c.input_fingerprint || r.aggregate_id !== c.aggregate_id
    || r.aggregate_type !== c.aggregate_type || r.aggregate_version !== c.aggregate_version
    || r.authority.context_id !== c.context_id || r.authority.authority_version !== c.authority_version
    || r.authority.permission_code !== c.permission_code || r.authority.module_code !== c.module_code
    || r.authority.evaluation_purpose !== c.evaluation_purpose
    || !coreSubjectReferencesMatch(r.subject_reference, c.subject_reference)) return answer('RECEIPT_MISMATCH');
  if (joint.target.document_id !== target.document_id || joint.target.document_version_id !== target.document_version_id
    || joint.target.document_version !== target.document_version) return answer('TARGET_MISMATCH');
  // The real getter proves this record was registered by the host, not that an
  // external candidate equals its private token. It exposes no expected-CE-ID /
  // tenant / complete-binding matcher or candidate hash preimage. Do not guess.
  return answer('OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
}
