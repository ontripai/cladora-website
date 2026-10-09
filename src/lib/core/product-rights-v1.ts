import { z } from 'zod';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';

const timestampSchema = z.string().datetime({ offset: true });
const keySchema = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);

export const productRightValueTypeV1Schema = z.enum([
  'boolean',
  'numeric',
  'string',
  'array',
  'json',
]);

export const productRightProvenanceV1Schema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('contract'),
    contract_id: uuidSchema,
    contract_version: z.number().int().positive(),
    source_reference: z.string().min(1).max(240),
  }),
  z.strictObject({
    kind: z.literal('legacy_unprovenanced'),
    contract_id: z.null(),
    contract_version: z.null(),
    source_reference: z.null(),
  }),
]);

export const productRightValueV1Schema = z.discriminatedUnion('value_type', [
  z.strictObject({ value_type: z.literal('boolean'), boolean_value: z.boolean() }),
  z.strictObject({ value_type: z.literal('numeric'), numeric_value: z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/) }),
  z.strictObject({ value_type: z.literal('string'), string_value: z.string().max(4096) }),
  z.strictObject({ value_type: z.literal('array'), array_value: z.array(z.unknown()).max(1024) }),
  z.strictObject({ value_type: z.literal('json'), json_value: z.record(z.string(), z.unknown()) }),
]);

export const productRightOverrideV1Schema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('inactive'),
    value: z.null(),
    expires_at: z.null(),
  }),
  z.strictObject({
    status: z.literal('active'),
    value: z.unknown(),
    expires_at: timestampSchema,
  }),
]);

export const productRightEvaluationV1Schema = z.strictObject({
  contract_version: z.literal('product-right-evaluation.v1'),
  workspace_id: uuidSchema,
  entitlement_id: uuidSchema,
  entitlement_key: keySchema,
  value: productRightValueV1Schema,
  provenance: productRightProvenanceV1Schema,
  valid_from: timestampSchema,
  valid_until: timestampSchema.nullable(),
  override: productRightOverrideV1Schema,
  evaluation_purpose: z.enum(['capability_availability', 'quota_limit', 'domain_specific']),
  evaluation_result: z.enum(['effective', 'ineffective', 'review_required', 'not_applicable']),
  reason_codes: z.array(keySchema).min(1).max(32),
  evaluated_at: timestampSchema,
});

export const productActivationStateV1Schema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('active'),
    activation_id: uuidSchema,
    module_definition_id: uuidSchema,
    module_code: keySchema,
    module_version: z.number().int().positive(),
    valid_from: timestampSchema,
    valid_until: z.null(),
  }),
  z.strictObject({
    status: z.enum(['inactive', 'deactivated', 'superseded', 'not_installed']),
    activation_id: uuidSchema.nullable(),
    module_definition_id: uuidSchema.nullable(),
    module_code: keySchema,
    module_version: z.number().int().positive().nullable(),
    valid_from: timestampSchema.nullable(),
    valid_until: timestampSchema.nullable(),
  }),
]);

export const productCapabilityDecisionV1Schema = z.strictObject({
  contract_version: z.literal('product-capability-decision.v1'),
  evaluated_at: timestampSchema,
  workspace_id: uuidSchema,
  capability_key: keySchema,
  product_availability: z.enum(['available', 'unavailable', 'review_required']),
  right: productRightEvaluationV1Schema.nullable(),
  activation: productActivationStateV1Schema,
  action_authorization: z.literal('not_evaluated'),
  reason_codes: z.array(keySchema).min(1).max(32),
});

export const productRightTruthTableV1 = [
  { value_type: 'boolean', purpose: 'capability_availability', current_rule: 'boolean_true', supported: true },
  { value_type: 'numeric', purpose: 'capability_availability', current_rule: 'numeric_positive', supported: true },
  { value_type: 'numeric', purpose: 'quota_limit', current_rule: 'numeric_limit_minus_usage', supported: true },
  { value_type: 'string', purpose: 'capability_availability', current_rule: 'no_shared_comparator', supported: false },
  { value_type: 'array', purpose: 'capability_availability', current_rule: 'no_shared_comparator', supported: false },
  { value_type: 'json', purpose: 'capability_availability', current_rule: 'no_shared_comparator', supported: false },
] as const;

export type ProductRightEvaluationV1 = z.infer<typeof productRightEvaluationV1Schema>;
export type ProductCapabilityDecisionV1 = z.infer<typeof productCapabilityDecisionV1Schema>;
