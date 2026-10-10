import { z } from 'zod';

import { uuidSchema } from '../customer/workspace-composition-schema.ts';
import {
  canonicalResourceReferenceV1InputSchema,
  canonicalResourceReferenceV1Schema,
  resourceRelationshipKindV1Schema,
  resourceRelationshipV1Schema,
} from './resource-contracts-v1.ts';
import {
  workspaceNativeAuthorityDecisionV2Schema,
  workspaceNativeAuthorityRequestV2Schema,
} from './workspace-authority-decision-v2.ts';

const timestampSchema = z.string().datetime({ offset: true });
const scopeCodeSchema = z.string().regex(/^[a-z0-9_.:-]{1,128}$/);

const relationshipExpectationV1Schema = z.strictObject({
  relationship_id: uuidSchema,
  relationship_version: z.number().int().positive(),
  relationship_kind: resourceRelationshipKindV1Schema,
  required_scope_codes: z.array(scopeCodeSchema).min(1).max(64)
    .refine((values) => new Set(values).size === values.length, 'relationship_scope_codes_must_be_unique'),
});

export const coreResourceAuthorityRequestV1Schema = z.strictObject({
  contract_version: z.literal('core-resource-authority.v1'),
  evaluation_time: timestampSchema,
  resource: canonicalResourceReferenceV1InputSchema,
  relationship: relationshipExpectationV1Schema,
  authority: workspaceNativeAuthorityRequestV2Schema,
}).superRefine((value, ctx) => {
  const pairs = [
    ['context_id', value.resource.context_id, value.authority.context_id],
    ['workspace_id', value.resource.workspace_id, value.authority.workspace_id],
    ['permission_code', value.resource.permission_code, value.authority.permission_code],
  ] as const;
  for (const [field, resourceValue, authorityValue] of pairs) {
    if (resourceValue !== authorityValue) {
      ctx.addIssue({
        code: 'custom',
        path: ['authority', field],
        message: `authority_${field}_must_match_resource_request`,
      });
    }
  }
});

export const coreResourceAuthorityEvidenceV1Schema = z.strictObject({
  resource: canonicalResourceReferenceV1Schema,
  relationship: resourceRelationshipV1Schema.nullable(),
  authority: workspaceNativeAuthorityDecisionV2Schema,
});

const authorityReferenceV1Schema = z.strictObject({
  decision_id: uuidSchema,
  evaluator: z.literal('app_private.check_workspace_native_permission_v2'),
  authority_policy_version: z.literal(2),
  evaluated_at: timestampSchema,
  current_authority_recheck_required: z.literal(true),
  reusable_as_command_authority: z.literal(false),
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
});

const allowedResourceIdentityV1Schema = z.strictObject({
  tenant_id: uuidSchema,
  workspace_id: uuidSchema,
  resource_type: canonicalResourceReferenceV1InputSchema.shape.resource_type,
  resource_id: uuidSchema,
  resource_version: z.number().int().positive(),
  lifecycle_status: z.string().min(1).max(64),
});

const allowedRelationshipReferenceV1Schema = z.strictObject({
  relationship_id: uuidSchema,
  relationship_version: z.number().int().positive(),
  relationship_kind: resourceRelationshipKindV1Schema,
  party_id: uuidSchema,
  scope_codes: z.array(scopeCodeSchema).min(1).max(64),
  valid_from: timestampSchema,
  valid_until: timestampSchema.nullable(),
  relationship_status: z.literal('effective'),
});

export const coreResourceAuthorityDenialReasonV1Schema = z.enum([
  'invalid_or_mismatched_evidence',
  'authority_request_mismatch',
  'authority_evaluation_stale',
  'authority_denied',
  'resource_not_verified',
  'resource_evaluation_stale',
  'resource_identity_mismatch',
  'resource_version_stale',
  'relationship_missing',
  'relationship_identity_mismatch',
  'relationship_version_stale',
  'relationship_kind_mismatch',
  'relationship_scope_insufficient',
  'relationship_not_effective',
  'relationship_evaluation_stale',
  'relationship_outside_evaluation_time',
]);

const decisionBase = {
  contract_version: z.literal('core-resource-authority.v1'),
  decision_id: uuidSchema,
  workspace_id: uuidSchema,
  permission_code: z.string().regex(/^[a-z0-9_.:-]{3,160}$/),
  module_code: z.string().regex(/^[a-z0-9_.:-]{3,160}$/),
  evaluated_at: timestampSchema,
  authority_reference: authorityReferenceV1Schema,
} as const;

const coreResourceAuthorityAllowedV1Schema = z.strictObject({
  ...decisionBase,
  decision: z.literal('allowed'),
  disclosure: z.literal('verified'),
  resource_identity: allowedResourceIdentityV1Schema,
  relationship_reference: allowedRelationshipReferenceV1Schema,
  reason_codes: z.tuple([z.literal('resource_relationship_authority_verified')]),
});

const coreResourceAuthorityDeniedV1Schema = z.strictObject({
  ...decisionBase,
  decision: z.literal('denied'),
  disclosure: z.literal('withheld'),
  resource_identity: z.null(),
  relationship_reference: z.null(),
  reason_codes: z.tuple([coreResourceAuthorityDenialReasonV1Schema]),
});

export const coreResourceAuthorityDecisionV1Schema = z.discriminatedUnion('decision', [
  coreResourceAuthorityAllowedV1Schema,
  coreResourceAuthorityDeniedV1Schema,
]);

export type CoreResourceAuthorityRequestV1 = z.infer<typeof coreResourceAuthorityRequestV1Schema>;
export type CoreResourceAuthorityEvidenceV1 = z.infer<typeof coreResourceAuthorityEvidenceV1Schema>;
export type CoreResourceAuthorityDecisionV1 = z.infer<typeof coreResourceAuthorityDecisionV1Schema>;
export type CoreResourceAuthorityDenialReasonV1 = z.infer<typeof coreResourceAuthorityDenialReasonV1Schema>;

function authorityReference(request: CoreResourceAuthorityRequestV1, evaluatedAt: string) {
  return {
    decision_id: request.authority.decision_id,
    evaluator: 'app_private.check_workspace_native_permission_v2' as const,
    authority_policy_version: 2 as const,
    evaluated_at: evaluatedAt,
    current_authority_recheck_required: true as const,
    reusable_as_command_authority: false as const,
    source_disclosure: 'status_only' as const,
    source_reference: null,
  };
}

function denied(
  request: CoreResourceAuthorityRequestV1,
  evaluatedAt: string,
  reason: CoreResourceAuthorityDenialReasonV1,
): CoreResourceAuthorityDecisionV1 {
  return coreResourceAuthorityDecisionV1Schema.parse({
    contract_version: 'core-resource-authority.v1',
    decision_id: request.authority.decision_id,
    workspace_id: request.authority.workspace_id,
    permission_code: request.authority.permission_code,
    module_code: request.authority.module_code,
    evaluated_at: evaluatedAt,
    authority_reference: authorityReference(request, evaluatedAt),
    decision: 'denied',
    disclosure: 'withheld',
    resource_identity: null,
    relationship_reference: null,
    reason_codes: [reason],
  });
}

function sameAuthorityRequest(
  request: CoreResourceAuthorityRequestV1,
  authority: z.infer<typeof workspaceNativeAuthorityDecisionV2Schema>,
) {
  return authority.decision_id === request.authority.decision_id
    && authority.workspace_id === request.authority.workspace_id
    && authority.permission_code === request.authority.permission_code
    && authority.module_code === request.authority.module_code
    && authority.target_scope_type === request.authority.target_scope_type
    && authority.target_scope_id === request.authority.target_scope_id;
}

export function evaluateCoreResourceAuthorityV1(
  unparsedRequest: CoreResourceAuthorityRequestV1,
  unparsedEvidence: CoreResourceAuthorityEvidenceV1,
): CoreResourceAuthorityDecisionV1 {
  const request = coreResourceAuthorityRequestV1Schema.parse(unparsedRequest);
  const parsedTime = request.evaluation_time;
  const evidenceResult = coreResourceAuthorityEvidenceV1Schema.safeParse(unparsedEvidence);
  if (!evidenceResult.success) return denied(request, parsedTime, 'invalid_or_mismatched_evidence');
  const evidence = evidenceResult.data;

  if (!sameAuthorityRequest(request, evidence.authority)) {
    return denied(request, parsedTime, 'authority_request_mismatch');
  }
  if (evidence.authority.evaluated_at !== parsedTime) {
    return denied(request, parsedTime, 'authority_evaluation_stale');
  }
  if (evidence.authority.decision !== 'allowed') {
    return denied(request, parsedTime, 'authority_denied');
  }
  if (evidence.resource.reference_status !== 'verified') {
    return denied(request, parsedTime, 'resource_not_verified');
  }
  if (evidence.resource.evaluated_at !== parsedTime) {
    return denied(request, parsedTime, 'resource_evaluation_stale');
  }
  if (evidence.resource.workspace_id !== request.resource.workspace_id
    || evidence.resource.resource_type !== request.resource.resource_type
    || evidence.resource.resource_id !== request.resource.resource_id) {
    return denied(request, parsedTime, 'resource_identity_mismatch');
  }
  if (evidence.resource.resource_version !== request.resource.resource_version) {
    return denied(request, parsedTime, 'resource_version_stale');
  }
  if (evidence.relationship === null) {
    return denied(request, parsedTime, 'relationship_missing');
  }
  const relationship = evidence.relationship;
  if (relationship.tenant_id !== evidence.resource.tenant_id
    || relationship.workspace_id !== request.resource.workspace_id
    || relationship.resource_type !== request.resource.resource_type
    || relationship.resource_id !== request.resource.resource_id
    || relationship.relationship_id !== request.relationship.relationship_id) {
    return denied(request, parsedTime, 'relationship_identity_mismatch');
  }
  if (relationship.relationship_version !== request.relationship.relationship_version) {
    return denied(request, parsedTime, 'relationship_version_stale');
  }
  if (relationship.relationship_kind !== request.relationship.relationship_kind) {
    return denied(request, parsedTime, 'relationship_kind_mismatch');
  }
  if (!request.relationship.required_scope_codes.every((scope) => relationship.scope_codes.includes(scope))) {
    return denied(request, parsedTime, 'relationship_scope_insufficient');
  }
  if (relationship.relationship_status !== 'effective') {
    return denied(request, parsedTime, 'relationship_not_effective');
  }
  if (relationship.evaluated_at !== parsedTime) {
    return denied(request, parsedTime, 'relationship_evaluation_stale');
  }
  const evaluatedMillis = Date.parse(parsedTime);
  if (Date.parse(relationship.valid_from) > evaluatedMillis
    || (relationship.valid_until !== null && Date.parse(relationship.valid_until) <= evaluatedMillis)) {
    return denied(request, parsedTime, 'relationship_outside_evaluation_time');
  }

  return coreResourceAuthorityDecisionV1Schema.parse({
    contract_version: 'core-resource-authority.v1',
    decision_id: request.authority.decision_id,
    workspace_id: request.authority.workspace_id,
    permission_code: request.authority.permission_code,
    module_code: request.authority.module_code,
    evaluated_at: parsedTime,
    authority_reference: authorityReference(request, parsedTime),
    decision: 'allowed',
    disclosure: 'verified',
    resource_identity: {
      tenant_id: evidence.resource.tenant_id,
      workspace_id: evidence.resource.workspace_id,
      resource_type: evidence.resource.resource_type,
      resource_id: evidence.resource.resource_id,
      resource_version: evidence.resource.resource_version,
      lifecycle_status: evidence.resource.lifecycle_status,
    },
    relationship_reference: {
      relationship_id: relationship.relationship_id,
      relationship_version: relationship.relationship_version,
      relationship_kind: relationship.relationship_kind,
      party_id: relationship.party_id,
      scope_codes: relationship.scope_codes,
      valid_from: relationship.valid_from,
      valid_until: relationship.valid_until,
      relationship_status: relationship.relationship_status,
    },
    reason_codes: ['resource_relationship_authority_verified'],
  });
}
