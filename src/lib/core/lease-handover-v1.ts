import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform(value => value.toLowerCase());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'invalid_date');
const idempotencyKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const scheduleSnapshot = z.strictObject({
  currency: z.string().regex(/^[A-Z]{3}$/), rent_amount: z.number().nonnegative(),
  deposit_amount: z.number().nonnegative().optional(), due_day: z.number().int().min(1).max(31).optional(),
  indexation: z.string().max(500).optional(), notes: z.string().max(500).optional(),
});
const transferableFacts = z.strictObject({
  meter_readings: z.array(z.strictObject({ label: z.string().min(1).max(120), value: z.number().finite(), unit: z.string().min(1).max(30) })).max(100).default([]),
  keys_count: z.number().int().nonnegative().max(1000).default(0),
  open_defects: z.array(z.string().min(1).max(500)).max(100).default([]),
  accepted_items: z.array(z.string().min(1).max(500)).max(100).default([]),
});

export const leaseHandoverCommandV1Schema = z.strictObject({
  version: z.literal(1), action: z.literal('activate'), context_id: uuid, workspace_id: uuid,
  property_id: uuid, proposal_id: uuid, document_context_id: uuid, evidence_version_id: uuid,
  handover_status: z.enum(['partial', 'accepted']), schedule_snapshot: scheduleSnapshot,
  transferable_facts: transferableFacts, idempotency_key: idempotencyKey,
});

export const leaseTerminationCommandV1Schema = z.strictObject({
  version: z.literal(1), action: z.literal('terminate'), context_id: uuid, workspace_id: uuid,
  property_id: uuid, lease_id: uuid, expected_starts_on: isoDate, effective_on: isoDate,
  access_assignment_ids: z.array(uuid).max(100).refine(values => new Set(values).size === values.length, 'duplicate_access_assignment'),
  reason: z.string().trim().min(8).max(500), idempotency_key: idempotencyKey,
});

export const leaseTransitionCommandV1Schema = z.discriminatedUnion('action', [
  leaseHandoverCommandV1Schema, leaseTerminationCommandV1Schema,
]);

export const leaseHandoverResponseV1Schema = z.object({
  version: z.literal(1), receipt_id: uuid, lease_id: uuid, status: z.literal('active'),
  handover_status: z.enum(['partial', 'accepted']), effective_on: isoDate, idempotent: z.boolean(),
});

export const leaseTerminationResponseV1Schema = z.object({
  version: z.literal(1), receipt_id: uuid, lease_id: uuid, status: z.literal('terminated'),
  effective_on: isoDate, ended_access_count: z.number().int().nonnegative(),
  ended_occupancy_count: z.number().int().nonnegative(), settlement_status: z.literal('separate'),
  idempotent: z.boolean(),
});
