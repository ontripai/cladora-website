import { createHash } from 'node:crypto';
import { z } from 'zod';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const isoTimestamp = z.string().datetime({ offset: true });
const currency = z.string().regex(/^[A-Z]{3}$/);
const decimal = z.string().regex(/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$/);
const positiveDecimal = decimal.refine(value => Number(value) > 0, 'must_be_positive');
const versionLabel = z.string().trim().min(1).max(80);
const shortText = z.string().trim().min(1).max(500);

export const valuationPurposeV1Schema = z.enum([
  'sale_estimate',
  'rental_recommendation',
  'listing_price_suggestion',
  'sale_scenario',
  'rent_scenario',
  'portfolio_report',
]);

export const resourceValuationInputV1Schema = z.strictObject({
  contract: z.literal('resource-valuation-input.v1'),
  resource_id: uuid,
  resource_version: z.number().int().positive(),
  resource_type: z.string().trim().min(1).max(80),
  workspace_id: uuid,
  snapshot_as_of: isoTimestamp,
  country_code: z.string().regex(/^[A-Z]{2}$/),
  location: z.strictObject({
    locality: z.string().trim().min(1).max(160),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  attributes: z.record(z.string().min(1).max(80), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  evidence_refs: z.array(uuid).max(250),
});

export const marketObservationV1Schema = z.strictObject({
  contract: z.literal('market-observation.v1'),
  observation_id: uuid,
  resource_type: z.string().trim().min(1).max(80),
  transaction_kind: z.enum(['sale', 'rent']),
  evidence_kind: z.enum(['asking', 'verified_transaction', 'external_estimate']),
  source: z.strictObject({
    source_id: z.string().trim().min(1).max(160),
    source_type: z.enum(['company', 'advisor', 'market_site', 'public_registry', 'licensed_dataset']),
    source_record_id: z.string().trim().min(1).max(240),
    collected_at: isoTimestamp,
    usage_rights: z.enum(['internal', 'licensed', 'public']),
  }),
  observed_at: isoTimestamp,
  location_key: z.string().trim().min(1).max(240),
  currency,
  amount: positiveDecimal,
  area: positiveDecimal.optional(),
  area_unit: z.enum(['sqm', 'sqft']).optional(),
  attributes: z.record(z.string().min(1).max(80), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  verification: z.enum(['unverified', 'source_verified', 'transaction_verified']),
  quarantined: z.boolean(),
  quarantine_reasons: z.array(shortText).max(20),
}).superRefine((value, ctx) => {
  if ((value.area === undefined) !== (value.area_unit === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['area'], message: 'area_and_unit_required_together' });
  }
  if (value.evidence_kind === 'verified_transaction' && value.verification !== 'transaction_verified') {
    ctx.addIssue({ code: 'custom', path: ['verification'], message: 'verified_transaction_requires_verification' });
  }
  if (!value.quarantined && value.quarantine_reasons.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['quarantine_reasons'], message: 'reasons_require_quarantine' });
  }
});

export const valuationRequestReceiptV1Schema = z.strictObject({
  contract: z.literal('valuation-request-receipt.v1'),
  valuation_id: uuid,
  request_id: uuid,
  resource_id: uuid,
  resource_version: z.number().int().positive(),
  workspace_id: uuid,
  purposes: z.array(valuationPurposeV1Schema).min(1),
  requested_at: isoTimestamp,
  accepted_at: isoTimestamp,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
});

const evidenceSummary = z.strictObject({
  asking_count: z.number().int().nonnegative(),
  verified_transaction_count: z.number().int().nonnegative(),
  external_estimate_count: z.number().int().nonnegative(),
  quarantined_count: z.number().int().nonnegative(),
  oldest_observed_at: isoTimestamp.nullable(),
  newest_observed_at: isoTimestamp.nullable(),
  freshness_days: z.number().int().nonnegative().nullable(),
});

const valuationRange = z.strictObject({
  low: positiveDecimal,
  high: positiveDecimal,
  central: positiveDecimal.nullable(),
}).superRefine((value, ctx) => {
  if (Number(value.low) > Number(value.high)) ctx.addIssue({ code: 'custom', path: ['high'], message: 'range_high_below_low' });
  if (value.central !== null && (Number(value.central) < Number(value.low) || Number(value.central) > Number(value.high))) {
    ctx.addIssue({ code: 'custom', path: ['central'], message: 'central_outside_range' });
  }
});

export const resourceValuationResultV1Schema = z.strictObject({
  contract: z.literal('resource-valuation-result.v1'),
  valuation_id: uuid,
  resource_id: uuid,
  resource_version: z.number().int().positive(),
  workspace_id: uuid,
  as_of: isoTimestamp,
  computed_at: isoTimestamp,
  outcome: z.enum(['sufficient', 'insufficient_data']),
  currency,
  sale_range: valuationRange.nullable(),
  rent_range: valuationRange.nullable(),
  price_per_area_basis: z.strictObject({ amount: positiveDecimal, area_unit: z.enum(['sqm', 'sqft']) }).nullable(),
  evidence: evidenceSummary,
  explanations: z.array(shortText).min(1).max(50),
  assumptions: z.array(shortText).max(50),
  missing_inputs: z.array(z.string().trim().min(1).max(120)).max(50),
  quality_score: z.number().min(0).max(1),
  model_version: versionLabel,
  dataset_version: versionLabel,
  policy_version: versionLabel,
  review_status: z.enum(['not_reviewed', 'accepted', 'overridden', 'rejected']),
  scope_disclaimer: shortText,
}).superRefine((value, ctx) => {
  const hasRange = value.sale_range !== null || value.rent_range !== null;
  if (value.outcome === 'sufficient' && !hasRange) ctx.addIssue({ code: 'custom', path: ['outcome'], message: 'sufficient_result_requires_range' });
  if (value.outcome === 'insufficient_data' && (hasRange || value.missing_inputs.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['outcome'], message: 'insufficient_result_requires_missing_inputs_and_no_range' });
  }
});

export const valuationReviewV1Schema = z.strictObject({
  contract: z.literal('valuation-review.v1'),
  valuation_id: uuid,
  workspace_id: uuid,
  decision: z.enum(['accept', 'override', 'reject']),
  reason: shortText,
  reviewed_at: isoTimestamp,
  reviewer_party_id: uuid,
  override_sale_range: valuationRange.optional(),
  override_rent_range: valuationRange.optional(),
}).superRefine((value, ctx) => {
  const hasOverride = value.override_sale_range !== undefined || value.override_rent_range !== undefined;
  if (value.decision === 'override' && !hasOverride) ctx.addIssue({ code: 'custom', path: ['decision'], message: 'override_requires_range' });
  if (value.decision !== 'override' && hasOverride) ctx.addIssue({ code: 'custom', path: ['decision'], message: 'range_requires_override' });
});

export const listingPriceDecisionV1Schema = z.strictObject({
  contract: z.literal('listing-price-decision.v1'),
  valuation_id: uuid,
  resource_id: uuid,
  resource_version: z.number().int().positive(),
  workspace_id: uuid,
  listing_id: uuid.nullable(),
  decision: z.enum(['use_suggestion', 'set_independent_price', 'defer']),
  currency,
  selected_amount: positiveDecimal.nullable(),
  reason: shortText,
  decided_at: isoTimestamp,
  decided_by_party_id: uuid,
  publish: z.literal(false),
}).superRefine((value, ctx) => {
  if (value.decision === 'defer' && value.selected_amount !== null) ctx.addIssue({ code: 'custom', path: ['selected_amount'], message: 'defer_has_no_price' });
  if (value.decision !== 'defer' && value.selected_amount === null) ctx.addIssue({ code: 'custom', path: ['selected_amount'], message: 'price_required' });
});

export function marketObservationFingerprintV1(input: unknown): string {
  const value = marketObservationV1Schema.parse(input);
  const identity = [
    value.source.source_id,
    value.source.source_record_id,
    value.transaction_kind,
    value.evidence_kind,
    value.observed_at,
    value.location_key,
    value.currency,
    value.amount,
  ].map(part => part.normalize('NFC').trim().toLowerCase()).join('|');
  return createHash('sha256').update(identity).digest('hex');
}

