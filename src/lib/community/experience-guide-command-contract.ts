import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  DOCS_CE012_REFERENCE_DECISION_CONTRACT,
  docsCe012ReferenceDecisionV1Schema,
  docsCe012ReferenceRequestV1Schema,
  type DocsCe012ReferenceDecisionV1,
  type DocsCe012ReferenceRequestV1,
} from '../customer/documents-ce012-reference-contract.ts';

export {
  DOCS_CE012_REFERENCE_DECISION_CONTRACT,
  DOCS_CE012_REFERENCE_REQUEST_CONTRACT,
  docsCe012ImmutableTargetV1Schema,
  docsCe012ReferenceDecisionV1Schema,
  docsCe012ReferenceRequestV1Schema,
} from '../customer/documents-ce012-reference-contract.ts';

export const CE012_GUIDE_COMMAND_CONTRACT = 'ce012-guide-command.v1' as const;
export const CORE_CE012_MAP_DECISION_CONTRACT = 'core-ce012-map-decision.v1' as const;

const uuid = z.string().uuid();
const safeVersion = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const fingerprint = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const evaluatedAt = z.string().datetime({ offset: true });

export const ce012EditorIdentitySchema = z.strictObject({
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
});

export const ce012DocumentTargetV1Schema = z.strictObject({
  document_id: uuid,
  document_version_id: uuid,
  document_version: safeVersion,
  label: z.string().trim().min(1).max(120),
});

export const ce012GuideSavePayloadV1Schema = z.strictObject({
  title: z.string().trim().min(2).max(160),
  step_id: uuid,
  step_title: z.string().trim().min(1).max(160),
  instructions: z.string().trim().min(1).max(5_000),
  document_target: ce012DocumentTargetV1Schema.nullable(),
});

export const ce012GuideSaveCommandV1Schema = z.strictObject({
  contract: z.literal(CE012_GUIDE_COMMAND_CONTRACT),
  version: z.literal(1),
  command_id: uuid,
  action: z.literal('save_draft'),
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  expected_guide_version: safeVersion,
  payload: ce012GuideSavePayloadV1Schema,
  payload_fingerprint: fingerprint,
  idempotency_key: idempotencyKey,
});

export const coreCe012MapRequestV1Schema = z.strictObject({
  contract: z.literal('core-ce012-map-request.v1'),
  version: z.literal(1),
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  action: z.literal('save_draft'),
  module_code: z.literal('experience_guides'),
  entitlement_key: z.literal('module.experience_guides'),
  permission_code: z.literal('experience.guide.manage'),
});

export const coreCe012MapDecisionV1Schema = z.strictObject({
  contract: z.literal(CORE_CE012_MAP_DECISION_CONTRACT),
  version: z.literal(1),
  decision_id: uuid,
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  actor_id: uuid,
  membership_id: uuid,
  module_code: z.literal('experience_guides'),
  entitlement_key: z.literal('module.experience_guides'),
  permission_code: z.literal('experience.guide.manage'),
  authority: z.enum(['allowed', 'denied', 'revoked', 'not_ready']),
  entitlement: z.enum(['active', 'inactive', 'not_ready']),
  evaluated_at: evaluatedAt,
});

export const ce012GuideCommandReceiptV1Schema = z.strictObject({
  contract: z.literal(CE012_GUIDE_COMMAND_CONTRACT),
  version: z.literal(1),
  receipt_id: uuid,
  command_id: uuid,
  action: z.literal('save_draft'),
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  previous_guide_version: safeVersion,
  resulting_guide_version: safeVersion,
  document_target: ce012DocumentTargetV1Schema.nullable(),
  payload_fingerprint: fingerprint,
  idempotency_key: idempotencyKey,
  idempotency_binding_id: uuid,
  core_decision_id: uuid,
  document_decision_id: uuid.nullable(),
  authority: z.literal('verified'),
  entitlement: z.literal('verified'),
  evaluated_at: evaluatedAt,
}).superRefine((receipt, context) => {
  if (receipt.resulting_guide_version !== receipt.previous_guide_version + 1) {
    context.addIssue({
      code: 'custom',
      path: ['resulting_guide_version'],
      message: 'A save receipt must advance the Guide version exactly once',
    });
  }
  if ((receipt.document_target === null) !== (receipt.document_decision_id === null)) {
    context.addIssue({
      code: 'custom',
      path: ['document_decision_id'],
      message: 'A document decision is present exactly when a document target is bound',
    });
  }
});

const guideSnapshotSchema = z.strictObject({
  guide_id: uuid,
  context_id: uuid,
  workspace_id: uuid,
  current_version: safeVersion,
  state: z.enum(['draft', 'published', 'cancelled']),
});

export const ce012GuideCommandSnapshotV1Schema = z.strictObject({
  guide: guideSnapshotSchema.nullable(),
  core_decision: coreCe012MapDecisionV1Schema,
  document_decision: docsCe012ReferenceDecisionV1Schema.nullable(),
  issuance: z.strictObject({
    receipt_id: uuid,
    idempotency_binding_id: uuid,
    evaluated_at: evaluatedAt,
  }),
  replay: z.strictObject({
    idempotency_key: idempotencyKey,
    payload_fingerprint: fingerprint,
    receipt: ce012GuideCommandReceiptV1Schema,
  }).nullable(),
});

export const ce012GuideCommandResultCodeV1Schema = z.enum([
  'OK',
  'PAYLOAD_FINGERPRINT_MISMATCH',
  'WORKSPACE_MISMATCH',
  'AUTHORITY_DENIED',
  'ENTITLEMENT_INACTIVE',
  'PROVIDER_NOT_READY',
  'GUIDE_UNAVAILABLE',
  'ACTION_NOT_ALLOWED',
  'STALE_GUIDE',
  'DOCUMENT_DECISION_REQUIRED',
  'DOCUMENT_STALE',
  'DOCUMENT_DENIED',
  'DOCUMENT_NOT_FOUND',
  'REPLAY_CONFLICT',
]);

export type Ce012EditorIdentity = z.infer<typeof ce012EditorIdentitySchema>;
export type CoreCe012MapRequestV1 = z.infer<typeof coreCe012MapRequestV1Schema>;
export type { DocsCe012ReferenceRequestV1 };
export type CoreCe012MapDecisionV1 = z.infer<typeof coreCe012MapDecisionV1Schema>;
export type { DocsCe012ReferenceDecisionV1 };
export type Ce012GuideSaveCommandV1 = z.infer<typeof ce012GuideSaveCommandV1Schema>;
export type Ce012GuideSavePayloadV1 = z.infer<typeof ce012GuideSavePayloadV1Schema>;
export type Ce012GuideCommandSnapshotV1 = z.infer<typeof ce012GuideCommandSnapshotV1Schema>;
export type Ce012GuideCommandReceiptV1 = z.infer<typeof ce012GuideCommandReceiptV1Schema>;
export type Ce012GuideCommandResultCodeV1 = z.infer<typeof ce012GuideCommandResultCodeV1Schema>;

export type Ce012GuideMutationPlanV1 = {
  kind: 'save_draft';
  guide_id: string;
  expected_guide_version: number;
  resulting_guide_version: number;
  payload: Ce012GuideSavePayloadV1;
  receipt: Ce012GuideCommandReceiptV1;
};

export type Ce012GuideCommandEvaluationV1 = {
  decision_status: 'accepted' | 'conflict' | 'denied' | 'not_ready';
  result_code: Ce012GuideCommandResultCodeV1;
  replayed: boolean;
  receipt: Ce012GuideCommandReceiptV1 | null;
  mutation_plan: Ce012GuideMutationPlanV1 | null;
};

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const fingerprintCe012GuideSavePayload = (
  command: Pick<
    Ce012GuideSaveCommandV1,
    'action' | 'context_id' | 'workspace_id' | 'guide_id' | 'expected_guide_version' | 'payload'
  >,
): string => `sha256:${createHash('sha256').update(stableSerialize({
  action: command.action,
  context_id: command.context_id,
  workspace_id: command.workspace_id,
  guide_id: command.guide_id,
  expected_guide_version: command.expected_guide_version,
  payload: command.payload,
})).digest('hex')}`;

const targetMatches = (
  left: Ce012GuideSavePayloadV1['document_target'],
  right: Ce012GuideSavePayloadV1['document_target'],
): boolean => {
  if (left === null || right === null) return left === right;
  return left.document_id === right.document_id
    && left.document_version_id === right.document_version_id
    && left.document_version === right.document_version;
};

const resultStatus = (
  code: Ce012GuideCommandResultCodeV1,
): Ce012GuideCommandEvaluationV1['decision_status'] => {
  if (code === 'OK') return 'accepted';
  if (code === 'PAYLOAD_FINGERPRINT_MISMATCH'
    || code === 'STALE_GUIDE'
    || code === 'DOCUMENT_STALE'
    || code === 'REPLAY_CONFLICT') return 'conflict';
  if (code === 'PROVIDER_NOT_READY' || code === 'DOCUMENT_DECISION_REQUIRED') return 'not_ready';
  return 'denied';
};

const stop = (code: Exclude<Ce012GuideCommandResultCodeV1, 'OK'>): Ce012GuideCommandEvaluationV1 => ({
  decision_status: resultStatus(code),
  result_code: code,
  replayed: false,
  receipt: null,
  mutation_plan: null,
});

const replayReceiptMatches = (
  command: Ce012GuideSaveCommandV1,
  receipt: Ce012GuideCommandReceiptV1,
): boolean => receipt.command_id === command.command_id
  && receipt.action === command.action
  && receipt.context_id === command.context_id
  && receipt.workspace_id === command.workspace_id
  && receipt.guide_id === command.guide_id
  && receipt.previous_guide_version === command.expected_guide_version
  && receipt.resulting_guide_version === command.expected_guide_version + 1
  && receipt.payload_fingerprint === command.payload_fingerprint
  && receipt.idempotency_key === command.idempotency_key
  && targetMatches(receipt.document_target, command.payload.document_target);

export const evaluateCe012GuideSaveCommand = (
  commandValue: unknown,
  snapshotValue: unknown,
): Ce012GuideCommandEvaluationV1 => {
  const command = ce012GuideSaveCommandV1Schema.parse(commandValue);
  const snapshot = ce012GuideCommandSnapshotV1Schema.parse(snapshotValue);
  const computedFingerprint = fingerprintCe012GuideSavePayload(command);
  if (computedFingerprint !== command.payload_fingerprint) return stop('PAYLOAD_FINGERPRINT_MISMATCH');

  const { core_decision: core, guide } = snapshot;
  if (core.context_id !== command.context_id || core.workspace_id !== command.workspace_id
    || core.guide_id !== command.guide_id
    || (guide !== null && (guide.context_id !== command.context_id
      || guide.workspace_id !== command.workspace_id
      || guide.guide_id !== command.guide_id))) return stop('WORKSPACE_MISMATCH');

  if (core.authority === 'not_ready' || core.entitlement === 'not_ready') return stop('PROVIDER_NOT_READY');
  if (core.authority !== 'allowed') return stop('AUTHORITY_DENIED');
  if (core.entitlement !== 'active') return stop('ENTITLEMENT_INACTIVE');
  if (guide === null) return stop('GUIDE_UNAVAILABLE');
  if (guide.state !== 'draft') return stop('ACTION_NOT_ALLOWED');

  const target = command.payload.document_target;
  const docs = snapshot.document_decision;
  if ((target === null) !== (docs === null)) return stop('DOCUMENT_DECISION_REQUIRED');
  if (target !== null && docs !== null) {
    if (docs.context_id !== command.context_id || docs.workspace_id !== command.workspace_id
      || docs.guide_id !== command.guide_id) {
      return stop('WORKSPACE_MISMATCH');
    }
    if (docs.target.document_id !== target.document_id
      || docs.target.document_version_id !== target.document_version_id
      || docs.target.document_version !== target.document_version) return stop('DOCUMENT_STALE');
    if (docs.decision === 'not_ready') return stop('PROVIDER_NOT_READY');
    if (docs.decision === 'not_found') return stop('DOCUMENT_NOT_FOUND');
    if (docs.decision === 'denied') return stop('DOCUMENT_DENIED');
    if (docs.decision === 'stale') return stop('DOCUMENT_STALE');
  }

  if (snapshot.replay !== null) {
    const replay = snapshot.replay;
    if (replay.idempotency_key !== command.idempotency_key
      || replay.payload_fingerprint !== command.payload_fingerprint
      || !replayReceiptMatches(command, replay.receipt)) return stop('REPLAY_CONFLICT');
    if (target !== null && docs?.evaluation_mode !== 'replay') return stop('DOCUMENT_DECISION_REQUIRED');
    if (target !== null
      && docs?.decision !== 'current_authorized'
      && docs?.decision !== 'historical_authorized') return stop('DOCUMENT_DENIED');
    return {
      decision_status: 'accepted',
      result_code: 'OK',
      replayed: true,
      receipt: replay.receipt,
      mutation_plan: null,
    };
  }

  if (target !== null && (docs?.evaluation_mode !== 'new_command' || docs.decision !== 'current_authorized')) {
    return docs?.decision === 'historical_authorized' ? stop('DOCUMENT_STALE') : stop('DOCUMENT_DECISION_REQUIRED');
  }
  if (guide.current_version !== command.expected_guide_version) return stop('STALE_GUIDE');

  const receipt = ce012GuideCommandReceiptV1Schema.parse({
    contract: CE012_GUIDE_COMMAND_CONTRACT,
    version: 1,
    receipt_id: snapshot.issuance.receipt_id,
    command_id: command.command_id,
    action: command.action,
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    guide_id: command.guide_id,
    previous_guide_version: command.expected_guide_version,
    resulting_guide_version: command.expected_guide_version + 1,
    document_target: command.payload.document_target === null ? null : {
      ...command.payload.document_target,
      label: docs?.decision === 'current_authorized' ? docs.safe_label : command.payload.document_target.label,
    },
    payload_fingerprint: command.payload_fingerprint,
    idempotency_key: command.idempotency_key,
    idempotency_binding_id: snapshot.issuance.idempotency_binding_id,
    core_decision_id: core.decision_id,
    document_decision_id: docs?.decision_id ?? null,
    authority: 'verified',
    entitlement: 'verified',
    evaluated_at: snapshot.issuance.evaluated_at,
  });

  return {
    decision_status: 'accepted',
    result_code: 'OK',
    replayed: false,
    receipt,
    mutation_plan: {
      kind: 'save_draft',
      guide_id: command.guide_id,
      expected_guide_version: command.expected_guide_version,
      resulting_guide_version: command.expected_guide_version + 1,
      payload: command.payload.document_target === null ? command.payload : {
        ...command.payload,
        document_target: receipt.document_target,
      },
      receipt,
    },
  };
};

export const isCe012GuideCompletionCurrent = (
  receipt: Ce012GuideCommandReceiptV1,
  active: Ce012EditorIdentity,
): boolean => receipt.context_id === active.context_id
  && receipt.workspace_id === active.workspace_id
  && receipt.guide_id === active.guide_id;
