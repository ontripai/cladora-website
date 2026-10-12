import { z } from 'zod';

export const DOCS_CE012_REFERENCE_REQUEST_CONTRACT = 'docs-ce012-reference-request.v1' as const;
export const DOCS_CE012_REFERENCE_DECISION_CONTRACT = 'docs-ce012-reference-decision.v1' as const;

const uuid = z.string().uuid();
const safeVersion = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const evaluatedAt = z.string().datetime({ offset: true });

export const docsCe012ImmutableTargetV1Schema = z.strictObject({
  document_id: uuid,
  document_version_id: uuid,
  document_version: safeVersion,
});

export const docsCe012ReferenceRequestV1Schema = z.strictObject({
  contract: z.literal(DOCS_CE012_REFERENCE_REQUEST_CONTRACT),
  version: z.literal(1),
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  target: docsCe012ImmutableTargetV1Schema,
  evaluation_mode: z.enum(['new_command', 'replay']),
});

const decisionBase = {
  contract: z.literal(DOCS_CE012_REFERENCE_DECISION_CONTRACT),
  version: z.literal(1),
  decision_id: uuid,
  context_id: uuid,
  workspace_id: uuid,
  guide_id: uuid,
  target: docsCe012ImmutableTargetV1Schema,
  evaluation_mode: z.enum(['new_command', 'replay']),
  authority_basis: z.literal('current_server_session'),
  evaluated_at: evaluatedAt,
};

export const docsCe012ReferenceDecisionV1Schema = z.discriminatedUnion('decision', [
  z.strictObject({
    ...decisionBase,
    decision: z.enum(['current_authorized', 'historical_authorized']),
    safe_label: z.string().trim().min(1).max(120),
    redaction: z.literal('safe_label_only'),
  }),
  z.strictObject({
    ...decisionBase,
    decision: z.enum(['stale', 'denied', 'not_found', 'not_ready']),
    safe_label: z.null(),
    redaction: z.literal('none'),
  }),
]);

export type DocsCe012ImmutableTargetV1 = z.infer<typeof docsCe012ImmutableTargetV1Schema>;
export type DocsCe012ReferenceRequestV1 = z.infer<typeof docsCe012ReferenceRequestV1Schema>;
export type DocsCe012ReferenceDecisionV1 = z.infer<typeof docsCe012ReferenceDecisionV1Schema>;
