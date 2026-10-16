import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';

export const SERVICE_ARCHETYPE_TAXONOMY_CONTRACT = 'service-archetype-taxonomy.v1' as const;
export const SERVICE_TEMPLATE_ARCHETYPE_REFERENCE_CONTRACT = 'service-template-archetype-reference.v1' as const;
export const SERVICE_TAXONOMY_DEPRECATION_CONTRACT = 'service-taxonomy-deprecation-decision.v1' as const;
export const SERVICE_TAXONOMY_EXTENSION_PROPOSAL_CONTRACT = 'service-taxonomy-extension-proposal.v1' as const;
export const SERVICE_TAXONOMY_OWNER = 'platform_service_taxonomy_governance' as const;

export const SERVICE_COMPATIBILITY_HINT_CODES = [
  'residential',
  'office_workplace',
  'retail',
  'hospitality',
  'industrial',
  'logistics',
  'automotive',
  'mixed_use',
] as const;

export const SERVICE_PRIMITIVE_CODES = [
  'unit_cleaning',
  'in_unit_repair',
  'in_unit_equipment_installation',
  'car_wash',
  'vehicle_care',
  'dry_cleaning',
  'prepared_food',
  'catering',
  'breakfast_order',
  'daily_shopping',
  'bread_delivery',
  'concierge_assistance',
  'parcel_handling',
  'space_reservation',
  'desk_reservation',
  'room_reservation',
  'equipment_reservation',
  'freight_elevator_move_reservation',
  'move_assistance',
  'goods_unloading',
  'goods_loading',
  'goods_packing',
  'goods_movement',
] as const;

export const SERVICE_ARCHETYPE_CODES = [
  'unit_care_and_cleaning',
  'in_unit_repair_and_installation',
  'vehicle_care',
  'garment_and_laundry',
  'food_catering_and_breakfast',
  'daily_essentials_and_bread_delivery',
  'concierge_and_parcel_handling',
  'space_and_equipment_booking',
  'move_and_freight_elevator_booking',
  'goods_handling_and_logistics',
] as const;

export type ServiceCompatibilityHintCode = typeof SERVICE_COMPATIBILITY_HINT_CODES[number];
export type ServicePrimitiveCode = typeof SERVICE_PRIMITIVE_CODES[number];
export type ServiceArchetypeCode = typeof SERVICE_ARCHETYPE_CODES[number];

export const SERVICE_ARCHETYPE_PRIMITIVE_MAP = {
  unit_care_and_cleaning: ['unit_cleaning'],
  in_unit_repair_and_installation: ['in_unit_repair', 'in_unit_equipment_installation'],
  vehicle_care: ['car_wash', 'vehicle_care'],
  garment_and_laundry: ['dry_cleaning'],
  food_catering_and_breakfast: ['prepared_food', 'catering', 'breakfast_order'],
  daily_essentials_and_bread_delivery: ['daily_shopping', 'bread_delivery'],
  concierge_and_parcel_handling: ['concierge_assistance', 'parcel_handling'],
  space_and_equipment_booking: [
    'space_reservation',
    'desk_reservation',
    'room_reservation',
    'equipment_reservation',
  ],
  move_and_freight_elevator_booking: ['freight_elevator_move_reservation', 'move_assistance'],
  goods_handling_and_logistics: ['goods_unloading', 'goods_loading', 'goods_packing', 'goods_movement'],
} as const satisfies Record<ServiceArchetypeCode, readonly ServicePrimitiveCode[]>;

export const SERVICE_ARCHETYPE_COMPATIBILITY_HINT_MAP = {
  unit_care_and_cleaning: ['residential', 'hospitality', 'mixed_use'],
  in_unit_repair_and_installation: ['residential', 'office_workplace', 'retail', 'hospitality', 'mixed_use'],
  vehicle_care: ['residential', 'office_workplace', 'retail', 'hospitality', 'industrial', 'automotive', 'mixed_use'],
  garment_and_laundry: ['residential', 'office_workplace', 'hospitality', 'mixed_use'],
  food_catering_and_breakfast: ['residential', 'office_workplace', 'retail', 'hospitality', 'industrial', 'logistics', 'mixed_use'],
  daily_essentials_and_bread_delivery: ['residential', 'office_workplace', 'retail', 'hospitality', 'industrial', 'logistics', 'mixed_use'],
  concierge_and_parcel_handling: ['residential', 'office_workplace', 'retail', 'hospitality', 'industrial', 'logistics', 'mixed_use'],
  space_and_equipment_booking: ['residential', 'office_workplace', 'retail', 'hospitality', 'industrial', 'logistics', 'automotive', 'mixed_use'],
  move_and_freight_elevator_booking: ['residential', 'office_workplace', 'retail', 'hospitality', 'industrial', 'logistics', 'mixed_use'],
  goods_handling_and_logistics: ['office_workplace', 'retail', 'hospitality', 'industrial', 'logistics', 'automotive', 'mixed_use'],
} as const satisfies Record<ServiceArchetypeCode, readonly ServiceCompatibilityHintCode[]>;

const versionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const contentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const codeSchema = z.string().regex(/^[a-z][a-z0-9_]{2,63}$/);
const timestampSchema = z.iso.datetime({ offset: true });
const labelsSchema = z.strictObject({
  ro: z.string().trim().min(1).max(200),
  en: z.string().trim().min(1).max(200),
  fa: z.string().trim().min(1).max(200),
});
const compatibilityHintSchema = z.enum(SERVICE_COMPATIBILITY_HINT_CODES);
const primitiveCodeSchema = z.enum(SERVICE_PRIMITIVE_CODES);
const archetypeCodeSchema = z.enum(SERVICE_ARCHETYPE_CODES);

function addUniqueArrayIssue(values: readonly string[], context: z.RefinementCtx, path: PropertyKey[]) {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: 'custom', path, message: 'Values must be unique' });
  }
}

function sameSet(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && expected.every(value => actual.includes(value));
}

export const servicePrimitiveRevisionV1Schema = z.strictObject({
  contract: z.literal(SERVICE_ARCHETYPE_TAXONOMY_CONTRACT),
  contract_version: z.literal(1),
  owner: z.literal(SERVICE_TAXONOMY_OWNER),
  primitive_id: uuidSchema,
  primitive_code: primitiveCodeSchema,
  primitive_version: versionSchema,
  content_hash: contentHashSchema,
  classification: z.literal('member_orderable_service'),
  country_scope: z.literal('country_neutral'),
  technical_effect: z.enum(['none', 'possible_incidental_asset_effect']),
  compatibility_hints: z.array(compatibilityHintSchema).max(SERVICE_COMPATIBILITY_HINT_CODES.length).optional(),
  labels: labelsSchema,
  published_at: timestampSchema,
}).superRefine((value, context) => {
  if (value.compatibility_hints !== undefined) {
    addUniqueArrayIssue(value.compatibility_hints, context, ['compatibility_hints']);
  }
});

export const exactServicePrimitiveReferenceV1Schema = z.strictObject({
  primitive_id: uuidSchema,
  primitive_code: primitiveCodeSchema,
  primitive_version: versionSchema,
  content_hash: contentHashSchema,
});

export const serviceArchetypeRevisionV1Schema = z.strictObject({
  contract: z.literal(SERVICE_ARCHETYPE_TAXONOMY_CONTRACT),
  contract_version: z.literal(1),
  owner: z.literal(SERVICE_TAXONOMY_OWNER),
  archetype_id: uuidSchema,
  archetype_code: archetypeCodeSchema,
  archetype_version: versionSchema,
  content_hash: contentHashSchema,
  classification: z.literal('member_orderable_service'),
  country_scope: z.literal('country_neutral'),
  technical_effect_policy: z.literal('asset_history_only_when_actual_technical_effect_is_verified'),
  compatibility_hints: z.array(compatibilityHintSchema).max(SERVICE_COMPATIBILITY_HINT_CODES.length).optional(),
  primitive_references: z.array(exactServicePrimitiveReferenceV1Schema).min(1).max(SERVICE_PRIMITIVE_CODES.length),
  labels: labelsSchema,
  published_at: timestampSchema,
}).superRefine((value, context) => {
  if (value.compatibility_hints !== undefined) {
    addUniqueArrayIssue(value.compatibility_hints, context, ['compatibility_hints']);
  }
  addUniqueArrayIssue(
    value.primitive_references.map(reference => `${reference.primitive_id}:${reference.primitive_version}`),
    context,
    ['primitive_references'],
  );

  const expectedPrimitives = SERVICE_ARCHETYPE_PRIMITIVE_MAP[value.archetype_code];
  const actualPrimitives = value.primitive_references.map(reference => reference.primitive_code);
  if (!sameSet(actualPrimitives, expectedPrimitives)) {
    context.addIssue({
      code: 'custom',
      path: ['primitive_references'],
      message: 'Archetype must reference its exact approved primitive set',
    });
  }

});

export const exactServiceArchetypeReferenceV1Schema = z.strictObject({
  archetype_id: uuidSchema,
  archetype_code: archetypeCodeSchema,
  archetype_version: versionSchema,
  content_hash: contentHashSchema,
});

export const serviceTemplateArchetypeReferenceV1Schema = z.strictObject({
  contract: z.literal(SERVICE_TEMPLATE_ARCHETYPE_REFERENCE_CONTRACT),
  contract_version: z.literal(1),
  archetype: exactServiceArchetypeReferenceV1Schema,
});

const proposedTaxonomyCodeSchema = codeSchema.refine(
  value => (
    !value.startsWith('custom_')
    && !(SERVICE_PRIMITIVE_CODES as readonly string[]).includes(value)
    && !(SERVICE_ARCHETYPE_CODES as readonly string[]).includes(value)
  ),
  { message: 'Proposal must describe a new non-generic taxonomy concept' },
);

export const serviceTaxonomyExtensionProposalV1Schema = z.strictObject({
  contract: z.literal(SERVICE_TAXONOMY_EXTENSION_PROPOSAL_CONTRACT),
  contract_version: z.literal(1),
  proposal_id: uuidSchema,
  proposal_version: versionSchema,
  proposal_only: z.literal(true),
  governance_owner: z.literal(SERVICE_TAXONOMY_OWNER),
  proposer_workspace_reference: uuidSchema,
  proposed_primitive: z.strictObject({
    suggested_code: proposedTaxonomyCodeSchema,
    labels: labelsSchema,
    definition: z.string().trim().min(20).max(2_000),
    technical_effect: z.enum(['none', 'possible_incidental_asset_effect']),
  }),
  proposed_archetype: z.strictObject({
    suggested_code: proposedTaxonomyCodeSchema,
    labels: labelsSchema,
    definition: z.string().trim().min(20).max(2_000),
  }),
  compatibility_hints: z.array(compatibilityHintSchema).max(SERVICE_COMPATIBILITY_HINT_CODES.length).optional(),
  submitted_at: timestampSchema,
}).superRefine((value, context) => {
  if (value.compatibility_hints !== undefined) {
    addUniqueArrayIssue(value.compatibility_hints, context, ['compatibility_hints']);
  }
  if (value.proposed_primitive.suggested_code === value.proposed_archetype.suggested_code) {
    context.addIssue({
      code: 'custom',
      path: ['proposed_archetype', 'suggested_code'],
      message: 'Primitive and archetype suggestions must have distinct codes',
    });
  }
});

const primitiveDeprecationDecisionSchema = z.strictObject({
  contract: z.literal(SERVICE_TAXONOMY_DEPRECATION_CONTRACT),
  contract_version: z.literal(1),
  owner: z.literal(SERVICE_TAXONOMY_OWNER),
  decision_id: uuidSchema,
  decision_version: versionSchema,
  target_kind: z.literal('primitive'),
  target: exactServicePrimitiveReferenceV1Schema,
  successor: exactServicePrimitiveReferenceV1Schema.nullable(),
  reason_code: codeSchema,
  effective_at: timestampSchema,
});

const archetypeDeprecationDecisionSchema = z.strictObject({
  contract: z.literal(SERVICE_TAXONOMY_DEPRECATION_CONTRACT),
  contract_version: z.literal(1),
  owner: z.literal(SERVICE_TAXONOMY_OWNER),
  decision_id: uuidSchema,
  decision_version: versionSchema,
  target_kind: z.literal('archetype'),
  target: exactServiceArchetypeReferenceV1Schema,
  successor: exactServiceArchetypeReferenceV1Schema.nullable(),
  reason_code: codeSchema,
  effective_at: timestampSchema,
});

export const serviceTaxonomyDeprecationDecisionV1Schema = z.discriminatedUnion('target_kind', [
  primitiveDeprecationDecisionSchema,
  archetypeDeprecationDecisionSchema,
]).superRefine((value, context) => {
  if (value.successor === null) return;

  if (value.target_kind === 'primitive') {
    if (
      value.successor.primitive_id !== value.target.primitive_id
      || value.successor.primitive_code !== value.target.primitive_code
      || value.successor.primitive_version <= value.target.primitive_version
    ) {
      context.addIssue({ code: 'custom', path: ['successor'], message: 'Invalid primitive successor' });
    }
    return;
  }

  if (
    value.successor.archetype_id !== value.target.archetype_id
    || value.successor.archetype_code !== value.target.archetype_code
    || value.successor.archetype_version <= value.target.archetype_version
  ) {
    context.addIssue({ code: 'custom', path: ['successor'], message: 'Invalid archetype successor' });
  }
});

export const serviceArchetypeTaxonomyCatalogV1Schema = z.strictObject({
  contract: z.literal(SERVICE_ARCHETYPE_TAXONOMY_CONTRACT),
  contract_version: z.literal(1),
  owner: z.literal(SERVICE_TAXONOMY_OWNER),
  primitives: z.array(servicePrimitiveRevisionV1Schema).min(1).max(512),
  archetypes: z.array(serviceArchetypeRevisionV1Schema).min(1).max(256),
  deprecations: z.array(serviceTaxonomyDeprecationDecisionV1Schema).max(256),
}).superRefine((value, context) => {
  addUniqueArrayIssue(
    value.primitives.map(primitive => `${primitive.primitive_id}:${primitive.primitive_version}`),
    context,
    ['primitives'],
  );
  addUniqueArrayIssue(
    value.archetypes.map(archetype => `${archetype.archetype_id}:${archetype.archetype_version}`),
    context,
    ['archetypes'],
  );
  addUniqueArrayIssue(
    value.deprecations.map(decision => `${decision.decision_id}:${decision.decision_version}`),
    context,
    ['deprecations'],
  );

  const primitiveIdentityByCode = new Map<ServicePrimitiveCode, string>();
  const primitiveCodeByIdentity = new Map<string, ServicePrimitiveCode>();
  value.primitives.forEach((primitive, index) => {
    const identityForCode = primitiveIdentityByCode.get(primitive.primitive_code);
    const codeForIdentity = primitiveCodeByIdentity.get(primitive.primitive_id);
    if (identityForCode !== undefined && identityForCode !== primitive.primitive_id) {
      context.addIssue({ code: 'custom', path: ['primitives', index, 'primitive_id'], message: 'Primitive code must retain one stable identity' });
    }
    if (codeForIdentity !== undefined && codeForIdentity !== primitive.primitive_code) {
      context.addIssue({ code: 'custom', path: ['primitives', index, 'primitive_code'], message: 'Primitive identity must retain one stable code' });
    }
    primitiveIdentityByCode.set(primitive.primitive_code, primitive.primitive_id);
    primitiveCodeByIdentity.set(primitive.primitive_id, primitive.primitive_code);
  });

  const archetypeIdentityByCode = new Map<ServiceArchetypeCode, string>();
  const archetypeCodeByIdentity = new Map<string, ServiceArchetypeCode>();
  value.archetypes.forEach((archetype, index) => {
    const identityForCode = archetypeIdentityByCode.get(archetype.archetype_code);
    const codeForIdentity = archetypeCodeByIdentity.get(archetype.archetype_id);
    if (identityForCode !== undefined && identityForCode !== archetype.archetype_id) {
      context.addIssue({ code: 'custom', path: ['archetypes', index, 'archetype_id'], message: 'Archetype code must retain one stable identity' });
    }
    if (codeForIdentity !== undefined && codeForIdentity !== archetype.archetype_code) {
      context.addIssue({ code: 'custom', path: ['archetypes', index, 'archetype_code'], message: 'Archetype identity must retain one stable code' });
    }
    archetypeIdentityByCode.set(archetype.archetype_code, archetype.archetype_id);
    archetypeCodeByIdentity.set(archetype.archetype_id, archetype.archetype_code);
  });

  const primitiveReferences = new Set(value.primitives.map(primitive => [
    primitive.primitive_id,
    primitive.primitive_code,
    primitive.primitive_version,
    primitive.content_hash,
  ].join(':')));
  const primitivePublishedAt = new Map(value.primitives.map(primitive => [[
    primitive.primitive_id,
    primitive.primitive_code,
    primitive.primitive_version,
    primitive.content_hash,
  ].join(':'), Date.parse(primitive.published_at)]));

  value.archetypes.forEach((archetype, archetypeIndex) => {
    archetype.primitive_references.forEach((reference, referenceIndex) => {
      const key = [
        reference.primitive_id,
        reference.primitive_code,
        reference.primitive_version,
        reference.content_hash,
      ].join(':');
      if (!primitiveReferences.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['archetypes', archetypeIndex, 'primitive_references', referenceIndex],
          message: 'Primitive reference must resolve exactly inside the catalog',
        });
      }
    });
  });

  const archetypeReferences = new Set(value.archetypes.map(archetype => [
    archetype.archetype_id,
    archetype.archetype_code,
    archetype.archetype_version,
    archetype.content_hash,
  ].join(':')));
  const archetypePublishedAt = new Map(value.archetypes.map(archetype => [[
    archetype.archetype_id,
    archetype.archetype_code,
    archetype.archetype_version,
    archetype.content_hash,
  ].join(':'), Date.parse(archetype.published_at)]));

  const deprecationByTarget = new Map<string, { index: number; successorKey: string | null; effectiveAt: number }>();
  const predecessorBySuccessor = new Map<string, number>();

  value.deprecations.forEach((decision, index) => {
    const targetKey = decision.target_kind === 'primitive'
      ? [decision.target.primitive_id, decision.target.primitive_code, decision.target.primitive_version, decision.target.content_hash].join(':')
      : [decision.target.archetype_id, decision.target.archetype_code, decision.target.archetype_version, decision.target.content_hash].join(':');
    const referenceSet = decision.target_kind === 'primitive' ? primitiveReferences : archetypeReferences;
    const publishedAt = decision.target_kind === 'primitive' ? primitivePublishedAt : archetypePublishedAt;
    const typedTargetKey = `${decision.target_kind}:${targetKey}`;
    if (!referenceSet.has(targetKey)) {
      context.addIssue({ code: 'custom', path: ['deprecations', index, 'target'], message: 'Deprecation target must resolve exactly inside the catalog' });
    }

    if (deprecationByTarget.has(typedTargetKey)) {
      context.addIssue({
        code: 'custom',
        path: ['deprecations', index, 'target'],
        message: 'An exact deprecation target may have only one deterministic successor chain',
      });
    }

    const targetPublishedAt = publishedAt.get(targetKey);
    const effectiveAt = Date.parse(decision.effective_at);
    if (targetPublishedAt !== undefined && effectiveAt < targetPublishedAt) {
      context.addIssue({
        code: 'custom',
        path: ['deprecations', index, 'effective_at'],
        message: 'Deprecation cannot precede publication of its exact target',
      });
    }

    let typedSuccessorKey: string | null = null;
    if (decision.successor !== null) {
      const successorKey = decision.target_kind === 'primitive'
        ? [decision.successor.primitive_id, decision.successor.primitive_code, decision.successor.primitive_version, decision.successor.content_hash].join(':')
        : [decision.successor.archetype_id, decision.successor.archetype_code, decision.successor.archetype_version, decision.successor.content_hash].join(':');
      if (!referenceSet.has(successorKey)) {
        context.addIssue({ code: 'custom', path: ['deprecations', index, 'successor'], message: 'Deprecation successor must resolve exactly inside the catalog' });
      }
      const successorPublishedAt = publishedAt.get(successorKey);
      if (
        targetPublishedAt !== undefined
        && successorPublishedAt !== undefined
        && successorPublishedAt <= targetPublishedAt
      ) {
        context.addIssue({
          code: 'custom',
          path: ['deprecations', index, 'successor'],
          message: 'Deprecation successor must be published after its exact target',
        });
      }

      typedSuccessorKey = `${decision.target_kind}:${successorKey}`;
      if (predecessorBySuccessor.has(typedSuccessorKey)) {
        context.addIssue({
          code: 'custom',
          path: ['deprecations', index, 'successor'],
          message: 'A deprecation successor may have only one predecessor',
        });
      } else {
        predecessorBySuccessor.set(typedSuccessorKey, index);
      }
    }

    if (!deprecationByTarget.has(typedTargetKey)) {
      deprecationByTarget.set(typedTargetKey, { index, successorKey: typedSuccessorKey, effectiveAt });
    }
  });

  deprecationByTarget.forEach(decision => {
    if (decision.successorKey === null) return;
    const successorDecision = deprecationByTarget.get(decision.successorKey);
    if (successorDecision !== undefined && successorDecision.effectiveAt <= decision.effectiveAt) {
      context.addIssue({
        code: 'custom',
        path: ['deprecations', successorDecision.index, 'effective_at'],
        message: 'Deprecation chain chronology must advance strictly',
      });
    }
  });
});

const taxonomyRevisionSchema = z.union([servicePrimitiveRevisionV1Schema, serviceArchetypeRevisionV1Schema]);

export type ServiceTaxonomyRevisionComparison =
  | 'EXACT_REPLAY'
  | 'NEW_VERSION'
  | 'INVALID_CONTRACT'
  | 'IDENTITY_MISMATCH'
  | 'IMMUTABLE_REVISION_CONFLICT'
  | 'STALE_VERSION'
  | 'VERSION_GAP';

export function compareImmutableServiceTaxonomyRevision(
  currentInput: unknown,
  candidateInput: unknown,
): ServiceTaxonomyRevisionComparison {
  const current = taxonomyRevisionSchema.safeParse(currentInput);
  const candidate = taxonomyRevisionSchema.safeParse(candidateInput);
  if (!current.success || !candidate.success) return 'INVALID_CONTRACT';

  let currentId: string;
  let candidateId: string;
  let currentCode: ServicePrimitiveCode | ServiceArchetypeCode;
  let candidateCode: ServicePrimitiveCode | ServiceArchetypeCode;
  let currentVersion: number;
  let candidateVersion: number;

  if ('primitive_id' in current.data && 'primitive_id' in candidate.data) {
    currentId = current.data.primitive_id;
    candidateId = candidate.data.primitive_id;
    currentCode = current.data.primitive_code;
    candidateCode = candidate.data.primitive_code;
    currentVersion = current.data.primitive_version;
    candidateVersion = candidate.data.primitive_version;
  } else if ('archetype_id' in current.data && 'archetype_id' in candidate.data) {
    currentId = current.data.archetype_id;
    candidateId = candidate.data.archetype_id;
    currentCode = current.data.archetype_code;
    candidateCode = candidate.data.archetype_code;
    currentVersion = current.data.archetype_version;
    candidateVersion = candidate.data.archetype_version;
  } else {
    return 'IDENTITY_MISMATCH';
  }

  if (currentId !== candidateId || currentCode !== candidateCode) return 'IDENTITY_MISMATCH';
  if (candidateVersion === currentVersion) {
    return JSON.stringify(candidate.data) === JSON.stringify(current.data)
      ? 'EXACT_REPLAY'
      : 'IMMUTABLE_REVISION_CONFLICT';
  }
  if (candidateVersion < currentVersion) return 'STALE_VERSION';
  if (candidateVersion !== currentVersion + 1) return 'VERSION_GAP';
  return 'NEW_VERSION';
}

export type ServicePrimitiveRevisionV1 = z.infer<typeof servicePrimitiveRevisionV1Schema>;
export type ServiceArchetypeRevisionV1 = z.infer<typeof serviceArchetypeRevisionV1Schema>;
export type ServiceTemplateArchetypeReferenceV1 = z.infer<typeof serviceTemplateArchetypeReferenceV1Schema>;
export type ServiceTaxonomyExtensionProposalV1 = z.infer<typeof serviceTaxonomyExtensionProposalV1Schema>;
export type ServiceTaxonomyDeprecationDecisionV1 = z.infer<typeof serviceTaxonomyDeprecationDecisionV1Schema>;
export type ServiceArchetypeTaxonomyCatalogV1 = z.infer<typeof serviceArchetypeTaxonomyCatalogV1Schema>;
