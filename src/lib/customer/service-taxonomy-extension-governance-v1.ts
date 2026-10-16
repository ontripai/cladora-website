import { z } from 'zod';
import {
  SERVICE_COMPATIBILITY_HINT_CODES,
  SERVICE_TAXONOMY_EXTENSION_PROPOSAL_CONTRACT,
  SERVICE_TAXONOMY_OWNER,
  serviceTaxonomyExtensionProposalV1Schema,
  type ServiceTaxonomyExtensionProposalV1,
} from './service-archetype-taxonomy-v1';
import {
  fingerprintServiceProviderInput,
  serviceReceiptFingerprintSchema,
} from './service-provider-receipt-v1-schema';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

export const SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_COMMAND_CONTRACT =
  'service-taxonomy-extension-governance-command.v1' as const;
export const SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_DECISION_CONTRACT =
  'service-taxonomy-extension-governance-decision.v1' as const;
export const SERVICE_TAXONOMY_SEMANTIC_REVIEW_CONTRACT =
  'service-taxonomy-semantic-review.v1' as const;
export const SERVICE_REUSABLE_TAXONOMY_TEMPLATE_CONTRACT =
  'service-reusable-taxonomy-template.v1' as const;
export const SERVICE_TAXONOMY_TEMPLATE_USE_CONTRACT =
  'service-taxonomy-template-use-candidate.v1' as const;

const safeVersionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const contentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const taxonomyCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{2,63}$/);
const timestampSchema = z.iso.datetime({ offset: true });
const compatibilityHintSchema = z.enum(SERVICE_COMPATIBILITY_HINT_CODES);
const labelsSchema = z.strictObject({
  ro: z.string().trim().min(1).max(200),
  en: z.string().trim().min(1).max(200),
  fa: z.string().trim().min(1).max(200),
});

export const serviceTaxonomyExtensionLifecycleV1Schema = z.enum([
  'pending',
  'rejected',
  'accepted',
]);

export const serviceTaxonomyGovernanceAuthorityEvidenceV1Schema = z.strictObject({
  contract: z.literal('service-taxonomy-governance-authority-evidence.v1'),
  owner: z.literal(SERVICE_TAXONOMY_OWNER),
  actor_party_reference: uuidSchema,
  authority_revision: safeVersionSchema,
  outcome: z.enum(['verified', 'denied']),
  evaluated_at: timestampSchema,
});

export const serviceTaxonomySemanticReviewV1Schema = z.strictObject({
  contract: z.literal(SERVICE_TAXONOMY_SEMANTIC_REVIEW_CONTRACT),
  contract_version: z.literal(1),
  proposal_id: uuidSchema,
  proposal_version: safeVersionSchema,
  boundary_classification: z.enum([
    'member_orderable_service',
    'maintenance',
    'community_experience',
    'unknown',
  ]),
  primitive_semantic_fingerprint: serviceReceiptFingerprintSchema,
  archetype_semantic_fingerprint: serviceReceiptFingerprintSchema,
  semantic_duplicate_of: z.strictObject({
    kind: z.enum(['primitive', 'archetype']),
    identity: uuidSchema,
    code: taxonomyCodeSchema,
    version: safeVersionSchema,
    semantic_fingerprint: serviceReceiptFingerprintSchema,
  }).nullable(),
  reviewed_at: timestampSchema,
});

export const serviceTaxonomyRegistrySnapshotV1Schema = z.strictObject({
  contract: z.literal('service-taxonomy-registry-snapshot.v1'),
  contract_version: z.literal(1),
  taxonomy_revision: safeVersionSchema,
  primitive_codes: z.array(taxonomyCodeSchema).max(4_096),
  archetype_codes: z.array(taxonomyCodeSchema).max(2_048),
  semantic_fingerprints: z.array(serviceReceiptFingerprintSchema).max(8_192),
  evaluated_at: timestampSchema,
}).superRefine((snapshot, context) => {
  for (const [path, values] of [
    ['primitive_codes', snapshot.primitive_codes],
    ['archetype_codes', snapshot.archetype_codes],
    ['semantic_fingerprints', snapshot.semantic_fingerprints],
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', path: [path], message: 'Registry values must be unique' });
    }
  }
});

const commandBase = {
  contract: z.literal(SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_COMMAND_CONTRACT),
  contract_version: z.literal(1),
  command_id: uuidSchema,
  decision_id: uuidSchema,
  proposal: serviceTaxonomyExtensionProposalV1Schema,
  expected_proposal_version: safeVersionSchema,
  expected_proposal_fingerprint: serviceReceiptFingerprintSchema,
  idempotency_key: idempotencyKeySchema,
  evaluated_at: timestampSchema,
} as const;

const submitCommandSchema = z.strictObject({
  ...commandBase,
  action: z.literal('submit'),
});

const rejectCommandSchema = z.strictObject({
  ...commandBase,
  action: z.literal('reject'),
  authority: serviceTaxonomyGovernanceAuthorityEvidenceV1Schema,
  semantic_review: serviceTaxonomySemanticReviewV1Schema,
  reason_code: z.enum([
    'BOUNDARY_MAINTENANCE',
    'BOUNDARY_COMMUNITY_EXPERIENCE',
    'SEMANTIC_DUPLICATE',
    'CODE_COLLISION',
    'INSUFFICIENT_DEFINITION',
    'OTHER_REVIEW_REJECTION',
  ]),
});

const acceptCommandSchema = z.strictObject({
  ...commandBase,
  action: z.literal('accept'),
  authority: serviceTaxonomyGovernanceAuthorityEvidenceV1Schema,
  semantic_review: serviceTaxonomySemanticReviewV1Schema,
  expected_taxonomy_revision: safeVersionSchema,
  proposed_taxonomy_revision: safeVersionSchema,
  primitive_identity: uuidSchema,
  primitive_content_hash: contentHashSchema,
  archetype_identity: uuidSchema,
  archetype_content_hash: contentHashSchema,
});

export const serviceTaxonomyExtensionGovernanceCommandV1Schema = z.discriminatedUnion('action', [
  submitCommandSchema,
  rejectCommandSchema,
  acceptCommandSchema,
]);

const proposalReferenceSchema = z.strictObject({
  proposal_id: uuidSchema,
  proposal_version: safeVersionSchema,
  proposal_fingerprint: serviceReceiptFingerprintSchema,
});

const taxonomyCandidateSchema = z.strictObject({
  candidate_only: z.literal(true),
  executable: z.literal(false),
  taxonomy_revision: safeVersionSchema,
  owner: z.literal(SERVICE_TAXONOMY_OWNER),
  country_scope: z.literal('country_neutral'),
  orderability: z.literal('not_orderable'),
  publication: z.literal('not_published'),
  activation: z.literal('inactive'),
  primitive: z.strictObject({
    primitive_id: uuidSchema,
    primitive_code: taxonomyCodeSchema,
    primitive_version: z.literal(1),
    content_hash: contentHashSchema,
    semantic_definition: z.string().trim().min(20).max(2_000),
    semantic_fingerprint: serviceReceiptFingerprintSchema,
    technical_effect: z.enum(['none', 'possible_incidental_asset_effect']),
    labels: labelsSchema,
  }),
  archetype: z.strictObject({
    archetype_id: uuidSchema,
    archetype_code: taxonomyCodeSchema,
    archetype_version: z.literal(1),
    content_hash: contentHashSchema,
    semantic_definition: z.string().trim().min(20).max(2_000),
    semantic_fingerprint: serviceReceiptFingerprintSchema,
    exact_primitive_reference: z.strictObject({
      primitive_id: uuidSchema,
      primitive_code: taxonomyCodeSchema,
      primitive_version: z.literal(1),
      content_hash: contentHashSchema,
    }),
    labels: labelsSchema,
  }),
  compatibility_hints: z.array(compatibilityHintSchema).max(SERVICE_COMPATIBILITY_HINT_CODES.length),
});

const decisionBase = {
  contract: z.literal(SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_DECISION_CONTRACT),
  contract_version: z.literal(1),
  decision_id: uuidSchema,
  proposal: proposalReferenceSchema,
  idempotency_key: idempotencyKeySchema,
  input_fingerprint: serviceReceiptFingerprintSchema,
  evaluated_at: timestampSchema,
  executable: z.literal(false),
  zero_side_effects: z.literal(true),
} as const;

const pendingDecisionSchema = z.strictObject({
  ...decisionBase,
  lifecycle_status: z.literal('pending'),
  result_code: z.literal('PROPOSAL_PENDING'),
  decision_owner: z.null(),
  authority_revision: z.null(),
  taxonomy_candidate: z.null(),
});

const rejectedDecisionSchema = z.strictObject({
  ...decisionBase,
  lifecycle_status: z.literal('rejected'),
  result_code: z.enum([
    'STALE_PROPOSAL',
    'PROPOSAL_IMMUTABILITY_CONFLICT',
    'GOVERNANCE_AUTHORITY_DENIED',
    'TAXONOMY_REVISION_CONFLICT',
    'CODE_COLLISION',
    'SEMANTIC_DUPLICATE',
    'MAINTENANCE_MASQUERADE',
    'COMMUNITY_EXPERIENCE_MASQUERADE',
    'UNKNOWN_SEMANTICS',
    'REVIEW_REJECTED',
  ]),
  decision_owner: z.literal(SERVICE_TAXONOMY_OWNER).nullable(),
  authority_revision: safeVersionSchema.nullable(),
  taxonomy_candidate: z.null(),
});

const acceptedDecisionSchema = z.strictObject({
  ...decisionBase,
  lifecycle_status: z.literal('accepted'),
  result_code: z.literal('NEXT_TAXONOMY_REVISION_CANDIDATE_ACCEPTED'),
  decision_owner: z.literal(SERVICE_TAXONOMY_OWNER),
  authority_revision: safeVersionSchema,
  taxonomy_candidate: taxonomyCandidateSchema,
});

export const serviceTaxonomyExtensionGovernanceDecisionV1Schema = z.discriminatedUnion(
  'lifecycle_status',
  [pendingDecisionSchema, rejectedDecisionSchema, acceptedDecisionSchema],
);

export const exactReusableTaxonomyTemplateReferenceV1Schema = z.strictObject({
  template_id: uuidSchema,
  template_version: safeVersionSchema,
  content_hash: contentHashSchema,
});

export const serviceReusableTaxonomyTemplateV1Schema = z.strictObject({
  contract: z.literal(SERVICE_REUSABLE_TAXONOMY_TEMPLATE_CONTRACT),
  contract_version: z.literal(1),
  template_id: uuidSchema,
  template_version: safeVersionSchema,
  content_hash: contentHashSchema,
  lifecycle: z.literal('accepted'),
  source_workspace_reference: uuidSchema,
  taxonomy_revision: safeVersionSchema,
  exact_archetype_reference: z.strictObject({
    archetype_id: uuidSchema,
    archetype_code: taxonomyCodeSchema,
    archetype_version: safeVersionSchema,
    content_hash: contentHashSchema,
    semantic_fingerprint: serviceReceiptFingerprintSchema,
    primitive_semantic_fingerprint: serviceReceiptFingerprintSchema,
  }),
  provenance: z.strictObject({
    source_proposal: proposalReferenceSchema,
    governance_decision_id: uuidSchema,
    governance_decision_version: z.literal(1),
    parent_template: exactReusableTaxonomyTemplateReferenceV1Schema.nullable(),
  }),
  public_definition: z.strictObject({
    labels: labelsSchema,
    semantic_definition: z.string().trim().min(20).max(2_000),
  }),
  country_scope: z.literal('country_neutral'),
  compatibility_hints: z.array(compatibilityHintSchema).max(SERVICE_COMPATIBILITY_HINT_CODES.length),
  accepted_at: timestampSchema,
}).superRefine((template, context) => {
  if (new Set(template.compatibility_hints).size !== template.compatibility_hints.length) {
    context.addIssue({ code: 'custom', path: ['compatibility_hints'], message: 'Hints must be unique' });
  }
  if (template.provenance.parent_template?.template_id === template.template_id) {
    context.addIssue({ code: 'custom', path: ['provenance', 'parent_template'], message: 'A fork must use a new template identity' });
  }
  const expectedSemanticFingerprint = fingerprintServiceProviderInput({
    kind: 'archetype',
    definition: template.public_definition.semantic_definition,
    primitive_semantic_fingerprint: template.exact_archetype_reference.primitive_semantic_fingerprint,
  });
  if (template.exact_archetype_reference.semantic_fingerprint !== expectedSemanticFingerprint) {
    context.addIssue({
      code: 'custom',
      path: ['exact_archetype_reference', 'semantic_fingerprint'],
      message: 'Template definition must preserve the accepted archetype semantics',
    });
  }
});

export const serviceTaxonomyTemplateUseCommandV1Schema = z.strictObject({
  contract: z.literal(SERVICE_TAXONOMY_TEMPLATE_USE_CONTRACT),
  contract_version: z.literal(1),
  action: z.enum(['adopt', 'fork']),
  operation_id: uuidSchema,
  destination_workspace_reference: uuidSchema,
  template: serviceReusableTaxonomyTemplateV1Schema,
  result_identity: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  evaluated_at: timestampSchema,
}).superRefine((command, context) => {
  if (command.destination_workspace_reference === command.template.source_workspace_reference) {
    context.addIssue({
      code: 'custom',
      path: ['destination_workspace_reference'],
      message: 'Cross-Workspace adoption or fork requires another Workspace',
    });
  }
  if (command.result_identity === command.template.template_id) {
    context.addIssue({
      code: 'custom',
      path: ['result_identity'],
      message: 'Adoption or fork result must use a new identity',
    });
  }
});

export const serviceTaxonomyTemplateUseDecisionV1Schema = z.strictObject({
  contract: z.literal(SERVICE_TAXONOMY_TEMPLATE_USE_CONTRACT),
  contract_version: z.literal(1),
  action: z.enum(['adopt', 'fork']),
  operation_id: uuidSchema,
  destination_workspace_reference: uuidSchema,
  exact_template_reference: exactReusableTaxonomyTemplateReferenceV1Schema,
  result_identity: uuidSchema,
  result_version: z.literal(1),
  provenance_preserved: z.literal(true),
  local_eligibility: z.literal('not_evaluated'),
  local_price: z.literal('not_set'),
  local_availability: z.literal('not_evaluated'),
  local_activation: z.literal('inactive'),
  executable: z.literal(false),
  zero_side_effects: z.literal(true),
  idempotency_key: idempotencyKeySchema,
  input_fingerprint: serviceReceiptFingerprintSchema,
  evaluated_at: timestampSchema,
});

type GovernanceDecision = z.infer<typeof serviceTaxonomyExtensionGovernanceDecisionV1Schema>;
type GovernanceCommand = z.infer<typeof serviceTaxonomyExtensionGovernanceCommandV1Schema>;
type RegistrySnapshot = z.infer<typeof serviceTaxonomyRegistrySnapshotV1Schema>;
type TemplateUseDecision = z.infer<typeof serviceTaxonomyTemplateUseDecisionV1Schema>;

export type ServiceTaxonomyGovernanceEvaluation =
  | { outcome: 'new_decision'; decision: GovernanceDecision }
  | { outcome: 'exact_replay'; decision: GovernanceDecision }
  | { outcome: 'replay_conflict'; code: 'REPLAY_CONFLICT' };

export function fingerprintServiceTaxonomyExtensionProposalV1(
  proposal: ServiceTaxonomyExtensionProposalV1,
) {
  return fingerprintServiceProviderInput({
    contract: SERVICE_TAXONOMY_EXTENSION_PROPOSAL_CONTRACT,
    proposal,
  });
}

export function fingerprintServiceTaxonomyPrimitiveProposalV1(
  proposal: ServiceTaxonomyExtensionProposalV1,
) {
  return fingerprintServiceProviderInput({
    kind: 'primitive',
    definition: proposal.proposed_primitive.definition,
    technical_effect: proposal.proposed_primitive.technical_effect,
  });
}

export function fingerprintServiceTaxonomyArchetypeProposalV1(
  proposal: ServiceTaxonomyExtensionProposalV1,
) {
  return fingerprintServiceProviderInput({
    kind: 'archetype',
    definition: proposal.proposed_archetype.definition,
    primitive_semantic_fingerprint: fingerprintServiceTaxonomyPrimitiveProposalV1(proposal),
  });
}

function proposalReference(proposal: ServiceTaxonomyExtensionProposalV1) {
  return {
    proposal_id: proposal.proposal_id,
    proposal_version: proposal.proposal_version,
    proposal_fingerprint: fingerprintServiceTaxonomyExtensionProposalV1(proposal),
  };
}

function evaluationFingerprint(command: GovernanceCommand, registry: RegistrySnapshot) {
  return fingerprintServiceProviderInput({ command, registry });
}

function rejectedDecision(
  command: GovernanceCommand,
  proposal: ServiceTaxonomyExtensionProposalV1,
  inputFingerprint: string,
  resultCode: z.infer<typeof rejectedDecisionSchema>['result_code'],
): GovernanceDecision {
  const hasAuthority = command.action !== 'submit' && command.authority.outcome === 'verified';
  return serviceTaxonomyExtensionGovernanceDecisionV1Schema.parse({
    contract: SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_DECISION_CONTRACT,
    contract_version: 1,
    decision_id: command.decision_id,
    proposal: proposalReference(proposal),
    lifecycle_status: 'rejected',
    result_code: resultCode,
    decision_owner: hasAuthority ? SERVICE_TAXONOMY_OWNER : null,
    authority_revision: hasAuthority ? command.authority.authority_revision : null,
    taxonomy_candidate: null,
    idempotency_key: command.idempotency_key,
    input_fingerprint: inputFingerprint,
    evaluated_at: command.evaluated_at,
    executable: false,
    zero_side_effects: true,
  });
}

export function evaluateServiceTaxonomyExtensionGovernanceV1(input: {
  command: unknown;
  currentProposal: unknown;
  registry: unknown;
  priorDecision?: unknown;
}): ServiceTaxonomyGovernanceEvaluation {
  const command = serviceTaxonomyExtensionGovernanceCommandV1Schema.parse(input.command);
  const currentProposal = serviceTaxonomyExtensionProposalV1Schema.parse(input.currentProposal);
  const registry = serviceTaxonomyRegistrySnapshotV1Schema.parse(input.registry);
  const inputFingerprint = evaluationFingerprint(command, registry);

  if (input.priorDecision !== undefined) {
    const prior = serviceTaxonomyExtensionGovernanceDecisionV1Schema.parse(input.priorDecision);
    if (prior.idempotency_key === command.idempotency_key) {
      return prior.input_fingerprint === inputFingerprint
        ? { outcome: 'exact_replay', decision: prior }
        : { outcome: 'replay_conflict', code: 'REPLAY_CONFLICT' };
    }
  }

  const commandProposalFingerprint = fingerprintServiceTaxonomyExtensionProposalV1(command.proposal);
  const currentProposalFingerprint = fingerprintServiceTaxonomyExtensionProposalV1(currentProposal);
  if (
    command.proposal.proposal_id !== currentProposal.proposal_id
    || command.expected_proposal_version !== currentProposal.proposal_version
    || command.proposal.proposal_version !== currentProposal.proposal_version
  ) {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command, currentProposal, inputFingerprint, 'STALE_PROPOSAL',
    ) };
  }
  if (
    command.expected_proposal_fingerprint !== currentProposalFingerprint
    || commandProposalFingerprint !== currentProposalFingerprint
  ) {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command, currentProposal, inputFingerprint, 'PROPOSAL_IMMUTABILITY_CONFLICT',
    ) };
  }

  if (command.action === 'submit') {
    return {
      outcome: 'new_decision',
      decision: serviceTaxonomyExtensionGovernanceDecisionV1Schema.parse({
        contract: SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_DECISION_CONTRACT,
        contract_version: 1,
        decision_id: command.decision_id,
        proposal: proposalReference(currentProposal),
        lifecycle_status: 'pending',
        result_code: 'PROPOSAL_PENDING',
        decision_owner: null,
        authority_revision: null,
        taxonomy_candidate: null,
        idempotency_key: command.idempotency_key,
        input_fingerprint: inputFingerprint,
        evaluated_at: command.evaluated_at,
        executable: false,
        zero_side_effects: true,
      }),
    };
  }

  if (command.authority.outcome !== 'verified') {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command, currentProposal, inputFingerprint, 'GOVERNANCE_AUTHORITY_DENIED',
    ) };
  }

  const expectedPrimitiveFingerprint = fingerprintServiceTaxonomyPrimitiveProposalV1(currentProposal);
  const expectedArchetypeFingerprint = fingerprintServiceTaxonomyArchetypeProposalV1(currentProposal);
  if (
    command.semantic_review.proposal_id !== currentProposal.proposal_id
    || command.semantic_review.proposal_version !== currentProposal.proposal_version
    || command.semantic_review.primitive_semantic_fingerprint !== expectedPrimitiveFingerprint
    || command.semantic_review.archetype_semantic_fingerprint !== expectedArchetypeFingerprint
  ) {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command, currentProposal, inputFingerprint, 'PROPOSAL_IMMUTABILITY_CONFLICT',
    ) };
  }

  if (command.action === 'reject') {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command, currentProposal, inputFingerprint, 'REVIEW_REJECTED',
    ) };
  }

  if (
    command.expected_taxonomy_revision !== registry.taxonomy_revision
    || command.proposed_taxonomy_revision !== registry.taxonomy_revision + 1
  ) {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command, currentProposal, inputFingerprint, 'TAXONOMY_REVISION_CONFLICT',
    ) };
  }

  const primitiveCode = currentProposal.proposed_primitive.suggested_code;
  const archetypeCode = currentProposal.proposed_archetype.suggested_code;
  if (
    registry.primitive_codes.includes(primitiveCode)
    || registry.archetype_codes.includes(primitiveCode)
    || registry.primitive_codes.includes(archetypeCode)
    || registry.archetype_codes.includes(archetypeCode)
  ) {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command, currentProposal, inputFingerprint, 'CODE_COLLISION',
    ) };
  }

  if (
    command.semantic_review.semantic_duplicate_of !== null
    || registry.semantic_fingerprints.includes(expectedPrimitiveFingerprint)
    || registry.semantic_fingerprints.includes(expectedArchetypeFingerprint)
  ) {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command, currentProposal, inputFingerprint, 'SEMANTIC_DUPLICATE',
    ) };
  }

  const classificationCode = {
    maintenance: 'MAINTENANCE_MASQUERADE',
    community_experience: 'COMMUNITY_EXPERIENCE_MASQUERADE',
    unknown: 'UNKNOWN_SEMANTICS',
  } as const;
  if (command.semantic_review.boundary_classification !== 'member_orderable_service') {
    return { outcome: 'new_decision', decision: rejectedDecision(
      command,
      currentProposal,
      inputFingerprint,
      classificationCode[command.semantic_review.boundary_classification],
    ) };
  }

  const hints = currentProposal.compatibility_hints ?? [];
  const candidate = {
    candidate_only: true as const,
    executable: false as const,
    taxonomy_revision: command.proposed_taxonomy_revision,
    owner: SERVICE_TAXONOMY_OWNER,
    country_scope: 'country_neutral' as const,
    orderability: 'not_orderable' as const,
    publication: 'not_published' as const,
    activation: 'inactive' as const,
    primitive: {
      primitive_id: command.primitive_identity,
      primitive_code: primitiveCode,
      primitive_version: 1 as const,
      content_hash: command.primitive_content_hash,
      semantic_definition: currentProposal.proposed_primitive.definition,
      semantic_fingerprint: expectedPrimitiveFingerprint,
      technical_effect: currentProposal.proposed_primitive.technical_effect,
      labels: currentProposal.proposed_primitive.labels,
    },
    archetype: {
      archetype_id: command.archetype_identity,
      archetype_code: archetypeCode,
      archetype_version: 1 as const,
      content_hash: command.archetype_content_hash,
      semantic_definition: currentProposal.proposed_archetype.definition,
      semantic_fingerprint: expectedArchetypeFingerprint,
      exact_primitive_reference: {
        primitive_id: command.primitive_identity,
        primitive_code: primitiveCode,
        primitive_version: 1 as const,
        content_hash: command.primitive_content_hash,
      },
      labels: currentProposal.proposed_archetype.labels,
    },
    compatibility_hints: hints,
  };

  return {
    outcome: 'new_decision',
    decision: serviceTaxonomyExtensionGovernanceDecisionV1Schema.parse({
      contract: SERVICE_TAXONOMY_EXTENSION_GOVERNANCE_DECISION_CONTRACT,
      contract_version: 1,
      decision_id: command.decision_id,
      proposal: proposalReference(currentProposal),
      lifecycle_status: 'accepted',
      result_code: 'NEXT_TAXONOMY_REVISION_CANDIDATE_ACCEPTED',
      decision_owner: SERVICE_TAXONOMY_OWNER,
      authority_revision: command.authority.authority_revision,
      taxonomy_candidate: candidate,
      idempotency_key: command.idempotency_key,
      input_fingerprint: inputFingerprint,
      evaluated_at: command.evaluated_at,
      executable: false,
      zero_side_effects: true,
    }),
  };
}

export function evaluateServiceTaxonomyTemplateUseV1(input: unknown): TemplateUseDecision {
  const command = serviceTaxonomyTemplateUseCommandV1Schema.parse(input);
  return serviceTaxonomyTemplateUseDecisionV1Schema.parse({
    contract: SERVICE_TAXONOMY_TEMPLATE_USE_CONTRACT,
    contract_version: 1,
    action: command.action,
    operation_id: command.operation_id,
    destination_workspace_reference: command.destination_workspace_reference,
    exact_template_reference: {
      template_id: command.template.template_id,
      template_version: command.template.template_version,
      content_hash: command.template.content_hash,
    },
    result_identity: command.result_identity,
    result_version: 1,
    provenance_preserved: true,
    local_eligibility: 'not_evaluated',
    local_price: 'not_set',
    local_availability: 'not_evaluated',
    local_activation: 'inactive',
    executable: false,
    zero_side_effects: true,
    idempotency_key: command.idempotency_key,
    input_fingerprint: fingerprintServiceProviderInput(command),
    evaluated_at: command.evaluated_at,
  });
}

export type ServiceTaxonomyExtensionGovernanceCommandV1 = z.infer<
  typeof serviceTaxonomyExtensionGovernanceCommandV1Schema
>;
export type ServiceTaxonomyExtensionGovernanceDecisionV1 = GovernanceDecision;
export type ServiceReusableTaxonomyTemplateV1 = z.infer<typeof serviceReusableTaxonomyTemplateV1Schema>;
export type ServiceTaxonomyTemplateUseDecisionV1 = TemplateUseDecision;
