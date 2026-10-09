import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform(value => value.toLowerCase());
const requestKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTimestamp = z.string().datetime({ offset: true });
const commercialAmount = /^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$/;
const managementCapability = z.enum([
  'listing',
  'lease_administration',
  'maintenance_coordination',
  'owner_reporting',
  'rent_collection',
  'supplier_coordination',
]);
const managementScope = z.strictObject({
  capabilities: z.array(managementCapability).min(1).max(6)
    .refine(value => new Set(value).size === value.length),
  notes: z.string().trim().min(1).max(1000).optional(),
});

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
    action: z.literal('request_management_mandate'),
    property_id: uuid,
    owner_party_id: uuid,
    scope: managementScope,
    valid_from: isoDate,
    valid_to: isoDate,
    proposal_evidence_reference: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('accept_management_mandate'),
    mandate_request_id: uuid,
    acceptance_evidence_reference: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    ...base,
    action: z.literal('link_management_work_order'),
    mandate_request_id: uuid,
    work_order_id: uuid,
  }),
  z.strictObject({
    ...base,
    action: z.literal('read_management_portfolio'),
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
  if (value.action === 'request_management_mandate' && value.valid_to <= value.valid_from) {
    ctx.addIssue({ code: 'custom', path: ['valid_to'], message: 'invalid_period' });
  }
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
  if (value.kind === 'resale') {
    const price = value.commercial_terms.price;
    const currency = value.commercial_terms.currency;
    if (typeof price !== 'string' || !commercialAmount.test(price) || Number(price) <= 0) {
      ctx.addIssue({ code: 'custom', path: ['commercial_terms', 'price'], message: 'invalid_resale_price' });
    }
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
      ctx.addIssue({ code: 'custom', path: ['commercial_terms', 'currency'], message: 'invalid_resale_currency' });
    }
    if (value.effective_to !== null) {
      ctx.addIssue({ code: 'custom', path: ['effective_to'], message: 'resale_is_point_in_time' });
    }
  }
  if (value.kind === 'lease') {
    const rentAmount = value.commercial_terms.rent_amount;
    const currency = value.commercial_terms.currency;
    if (typeof rentAmount !== 'number' || !Number.isFinite(rentAmount) || rentAmount <= 0) {
      ctx.addIssue({ code: 'custom', path: ['commercial_terms', 'rent_amount'], message: 'invalid_lease_rent' });
    }
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
      ctx.addIssue({ code: 'custom', path: ['commercial_terms', 'currency'], message: 'invalid_lease_currency' });
    }
  }
  if (value.effective_to !== null && value.effective_to <= value.effective_from) {
    ctx.addIssue({ code: 'custom', path: ['effective_to'], message: 'invalid_period' });
  }
});

export const commercialLifecycleResponseV1Schema = z.object({
  version: z.literal(1),
  idempotent: z.boolean(),
}).passthrough();

export const managementPortfolioQueryV1Schema = z.strictObject({
  context_id: uuid,
  workspace_id: uuid,
});

export const managementPortfolioResponseV1Schema = z.strictObject({
  version: z.literal(1),
  idempotent: z.literal(true),
  as_of: isoTimestamp,
  properties: z.array(z.strictObject({
    mandate_request_id: uuid,
    property: z.strictObject({ id: uuid, label: z.string().trim().min(1).max(255) }),
    owner: z.strictObject({ party_id: uuid, label: z.string().trim().min(1).max(255) }),
    scope: managementScope,
    valid_from: isoDate,
    valid_to: isoDate,
    status: z.literal('accepted'),
    action_links: z.array(z.strictObject({
      action_link_id: uuid,
      core_record_type: z.literal('maintenance.work_order'),
      core_record_id: uuid,
      unit_id: uuid.nullable(),
      source_status_snapshot: z.enum(['scheduled', 'assigned', 'in_progress', 'blocked', 'completed', 'verified']),
      linked_at: isoTimestamp,
    })).max(500),
  })).max(500),
  operations: z.strictObject({
    detail_owner: z.literal('Operations'),
    mode: z.literal('canonical_references_only'),
  }),
  finance: z.strictObject({
    detail_owner: z.literal('Finance'),
    mode: z.literal('not_connected'),
    reason: z.literal('canonical_receipt_contract_unavailable'),
  }),
});
