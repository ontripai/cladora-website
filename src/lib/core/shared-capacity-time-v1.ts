import { z } from 'zod';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { canonicalResourceReferenceV1InputSchema } from '@/lib/core/resource-contracts-v1';

const timestampSchema = z.string().datetime({ offset: true });
const codeSchema = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const timezoneSchema = z.string().regex(/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_.+-]+)+$/).max(100);
const versionSchema = z.number().int().positive().max(1_000_000_000);
const capacitySchema = z.number().int().positive().max(1_000_000);

export const sharedCapacityPolicyV1Schema = z.strictObject({
  contract_version: z.literal('shared-capacity-time.v1'),
  policy_id: uuidSchema,
  policy_version: versionSchema,
  timezone: timezoneSchema,
  capacity_unit: codeSchema,
  total_capacity: capacitySchema,
  hold_ttl_seconds: z.number().int().min(30).max(86_400),
  conflict_mode: z.enum(['exclusive', 'counted_capacity']),
  multi_resource_mode: z.literal('all_or_nothing'),
  interval_semantics: z.literal('half_open'),
  valid_from: timestampSchema,
  valid_until: timestampSchema.nullable(),
}).superRefine((value, ctx) => {
  if (value.valid_until !== null && Date.parse(value.valid_until) <= Date.parse(value.valid_from)) {
    ctx.addIssue({ code: 'custom', path: ['valid_until'], message: 'policy_valid_until_must_follow_valid_from' });
  }
});

const capacitySourceV1Schema = z.strictObject({
  consumer_domain: z.enum(['service', 'community']),
  consumer_entity_type: codeSchema,
  consumer_entity_id: uuidSchema,
  consumer_version: versionSchema,
});

const capacityWindowV1Schema = z.strictObject({
  requested_start: timestampSchema,
  requested_end: timestampSchema,
  requested_capacity: capacitySchema,
  resources: z.array(canonicalResourceReferenceV1InputSchema).min(1).max(20),
}).superRefine((value, ctx) => {
  if (Date.parse(value.requested_end) <= Date.parse(value.requested_start)) {
    ctx.addIssue({ code: 'custom', path: ['requested_end'], message: 'half_open_window_end_must_follow_start' });
  }
  const keys = value.resources.map((resource) => `${resource.resource_type}:${resource.resource_id.toLowerCase()}`);
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: 'custom', path: ['resources'], message: 'capacity_resources_must_be_unique' });
  }
});

const capacityRequestBase = {
  contract_version: z.literal('shared-capacity-allocation-receipt.v1'),
  request_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  source: capacitySourceV1Schema,
  policy_id: uuidSchema,
  expected_policy_version: versionSchema,
  requested_at: timestampSchema,
};

export const sharedCapacityAllocationRequestV1Schema = z.discriminatedUnion('action', [
  z.strictObject({ ...capacityRequestBase, action: z.literal('request_hold'), window: capacityWindowV1Schema }),
  z.strictObject({ ...capacityRequestBase, action: z.literal('confirm_hold'), hold_id: uuidSchema, expected_hold_version: versionSchema }),
  z.strictObject({ ...capacityRequestBase, action: z.literal('reschedule'), hold_id: uuidSchema, expected_hold_version: versionSchema, window: capacityWindowV1Schema }),
  z.strictObject({ ...capacityRequestBase, action: z.literal('release'), hold_id: uuidSchema, expected_hold_version: versionSchema, reason_code: codeSchema }),
]);

const capacityResourceReceiptV1Schema = z.strictObject({
  resource_type: z.enum(['party', 'property', 'building', 'entrance', 'unit', 'asset']),
  resource_id: uuidSchema,
  resource_version: versionSchema,
});

const capacityConflictV1Schema = z.strictObject({
  resource_type: z.enum(['property', 'building', 'entrance', 'unit', 'asset']),
  resource_id: uuidSchema,
  conflict_start: timestampSchema,
  conflict_end: timestampSchema,
  conflict_disclosure: z.literal('interval_only'),
});

const capacityReceiptBaseV1Schema = z.strictObject({
  contract_version: z.literal('shared-capacity-allocation-receipt.v1'),
  receipt_id: uuidSchema,
  receipt_version: versionSchema,
  request_id: uuidSchema,
  action: z.enum(['request_hold', 'confirm_hold', 'reschedule', 'release']),
  workspace_id: uuidSchema,
  source: capacitySourceV1Schema,
  policy_id: uuidSchema,
  policy_version: versionSchema,
  evaluated_at: timestampSchema,
  current_authority_recheck_required: z.literal(true),
  replayed: z.boolean(),
});

const capacityVerifiedReceiptV1Schema = capacityReceiptBaseV1Schema.extend({
  decision_status: z.literal('verified'),
  hold_id: uuidSchema,
  hold_version: versionSchema,
  hold_state: z.enum(['held', 'confirmed', 'released', 'expired']),
  effective_start: timestampSchema,
  effective_end: timestampSchema,
  allocated_capacity: capacitySchema,
  resources: z.array(capacityResourceReceiptV1Schema).min(1).max(20),
  expires_at: timestampSchema.nullable(),
  conflicts: z.array(z.never()).max(0),
  reason_codes: z.tuple([z.literal('capacity_allocation_verified')]),
}).superRefine((value, ctx) => {
  if (Date.parse(value.effective_end) <= Date.parse(value.effective_start)) {
    ctx.addIssue({ code: 'custom', path: ['effective_end'], message: 'effective_half_open_window_invalid' });
  }
  if ((value.hold_state === 'held') !== (value.expires_at !== null)) {
    ctx.addIssue({ code: 'custom', path: ['expires_at'], message: 'only_held_state_has_expiry' });
  }
});

const capacityDeniedReceiptV1Schema = capacityReceiptBaseV1Schema.extend({
  decision_status: z.literal('denied'),
  hold_id: z.null(),
  hold_version: z.null(),
  hold_state: z.null(),
  effective_start: z.null(),
  effective_end: z.null(),
  allocated_capacity: z.null(),
  resources: z.array(capacityResourceReceiptV1Schema).max(20),
  expires_at: z.null(),
  conflicts: z.array(capacityConflictV1Schema).max(20),
  reason_codes: z.array(codeSchema).min(1).max(32),
});

const capacityUnresolvedReceiptV1Schema = capacityReceiptBaseV1Schema.extend({
  decision_status: z.enum(['stale', 'unknown']),
  hold_id: z.null(),
  hold_version: z.null(),
  hold_state: z.null(),
  effective_start: z.null(),
  effective_end: z.null(),
  allocated_capacity: z.null(),
  resources: z.array(z.never()).max(0),
  expires_at: z.null(),
  conflicts: z.array(z.never()).max(0),
  reason_codes: z.array(codeSchema).min(1).max(32),
});

export const sharedCapacityAllocationReceiptV1Schema = z.union([
  capacityVerifiedReceiptV1Schema,
  capacityDeniedReceiptV1Schema,
  capacityUnresolvedReceiptV1Schema,
]);

export type SharedCapacityPolicyV1 = z.infer<typeof sharedCapacityPolicyV1Schema>;
export type SharedCapacityAllocationRequestV1 = z.infer<typeof sharedCapacityAllocationRequestV1Schema>;
export type SharedCapacityAllocationReceiptV1 = z.infer<typeof sharedCapacityAllocationReceiptV1Schema>;
