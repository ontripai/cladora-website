import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform(value => value.toLowerCase());
const requestKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTimestamp = z.string().datetime({ offset: true });

const base = {
  version: z.literal(1),
  context_id: uuid,
  workspace_id: uuid,
  idempotency_key: requestKey,
};

export const commercialLifecycleCommandV1Schema = z.union([
  z.strictObject({
    ...base,
    action: z.literal('publish_listing'),
    opportunity_id: uuid,
    property_id: uuid,
    unit_id: uuid,
    kind: z.enum(['presale', 'resale', 'lease']),
    available_from: isoTimestamp,
    available_until: isoTimestamp.nullable(),
  }),
  z.strictObject({
    ...base,
    action: z.literal('submit_applicant'),
    listing_id: uuid,
    party_id: uuid,
  }),
  z.strictObject({
    ...base,
    action: z.literal('reserve_listing'),
    listing_id: uuid,
    applicant_id: uuid,
    reserved_until: isoTimestamp,
  }),
  z.strictObject({
    ...base,
    action: z.enum(['cancel_reservation', 'expire_reservation']),
    reservation_id: uuid,
    expected_version: z.number().int().positive(),
    reason: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('extend_reservation'),
    reservation_id: uuid,
    expected_version: z.number().int().positive(),
    reserved_until: isoTimestamp,
    reason: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('convert_reservation'),
    reservation_id: uuid,
    expected_version: z.number().int().positive(),
    conversion_reference: z.string().trim().min(8).max(500),
    reason: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('edit_listing'),
    listing_id: uuid,
    expected_version: z.number().int().positive(),
    available_from: isoTimestamp,
    available_until: isoTimestamp.nullable(),
    reason: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('withdraw_listing'),
    listing_id: uuid,
    expected_version: z.number().int().positive(),
    reason: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('republish_listing'),
    listing_id: uuid,
    expected_version: z.number().int().positive(),
    available_from: isoTimestamp,
    available_until: isoTimestamp.nullable(),
    reason: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('record_obligation_schedule'),
    presale_contract_id: uuid,
    currency: z.string().regex(/^[A-Z]{3}$/),
    total_amount: z.string().regex(/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$/).refine(value => Number(value) > 0),
    terms: z.array(z.strictObject({
      due_on: isoDate,
      amount: z.number().positive(),
      label: z.string().trim().min(1).max(160),
    })).min(1).max(120),
    financial_source_reference: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('link_execution'),
    property_id: uuid,
    unit_id: uuid.nullable(),
    kind: z.enum(['resale', 'lease', 'management_mandate']),
    core_record_id: uuid,
    commercial_terms: z.record(z.string(), z.unknown()),
    effective_from: isoDate,
    effective_to: isoDate.nullable(),
  }),
]).superRefine((value, ctx) => {
  if ((value.action === 'edit_listing' || value.action === 'republish_listing')
    && value.available_until !== null && value.available_until <= value.available_from) {
    ctx.addIssue({ code: 'custom', path: ['available_until'], message: 'invalid_period' });
  }
  if (value.action !== 'link_execution') return;
  if (value.kind !== 'management_mandate' && value.unit_id === null) {
    ctx.addIssue({ code: 'custom', path: ['unit_id'], message: 'unit_required' });
  }
  if (value.kind === 'management_mandate' && value.unit_id !== null) {
    ctx.addIssue({ code: 'custom', path: ['unit_id'], message: 'unit_not_allowed' });
  }
  if (value.effective_to !== null && value.effective_to <= value.effective_from) {
    ctx.addIssue({ code: 'custom', path: ['effective_to'], message: 'invalid_period' });
  }
});

export const commercialLifecycleResponseV1Schema = z.object({
  version: z.literal(1),
  idempotent: z.boolean(),
}).passthrough();
