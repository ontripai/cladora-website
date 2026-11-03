import { z } from 'zod';
import { canonicalResourceReferenceV1Schema } from '@/lib/core/resource-contracts-v1';

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });

export const amenityCapacityPolicyV1Schema = z.strictObject({
  policy_id: uuid,
  policy_version: z.number().int().positive(),
  labels: z.strictObject({ ro: z.string().min(1), en: z.string().min(1), fa: z.string().min(1) }),
  timezone: z.string().min(1).max(100),
  capacity_unit: z.string().min(3).max(160),
  total_capacity: z.number().int().positive(),
  hold_ttl_seconds: z.number().int().min(30).max(86_400),
  conflict_mode: z.enum(['exclusive', 'counted_capacity']),
  resource: canonicalResourceReferenceV1Schema,
});

export const amenityCapacityHoldV1Schema = z.strictObject({
  hold_id: uuid,
  hold_version: z.number().int().positive(),
  policy_id: uuid,
  source_entity_id: uuid,
  effective_start: timestamp,
  effective_end: timestamp,
  allocated_capacity: z.number().int().positive(),
  state: z.enum(['held', 'confirmed', 'released', 'expired']),
  expires_at: timestamp.nullable(),
});

export const amenityCapacityReadV1Schema = z.strictObject({
  contract_version: z.literal('c13-amenity-capacity.v1'),
  workspace_id: uuid,
  policies: z.array(amenityCapacityPolicyV1Schema).max(100),
  my_holds: z.array(amenityCapacityHoldV1Schema).max(500),
  read_only_projection: z.literal(true),
});

export type AmenityCapacityReadV1 = z.infer<typeof amenityCapacityReadV1Schema>;
export type AmenityCapacityPolicyV1 = z.infer<typeof amenityCapacityPolicyV1Schema>;
export type AmenityCapacityHoldV1 = z.infer<typeof amenityCapacityHoldV1Schema>;
