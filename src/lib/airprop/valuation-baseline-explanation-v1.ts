import { z } from 'zod';
import { resourceValuationResultV1Schema } from './valuation-contract-v1';
import type { ValuationBaselinePolicyV1 } from './valuation-baseline-policy-v1';

const text = z.string().min(1).max(240);
const decimal = z.string().regex(/^(0|[1-9][0-9]{0,40})(\.[0-9]{1,24})?$/);
export const valuationComparableTraceV2Schema = z.strictObject({
  observation_id: z.string().uuid(), unit_id: text, source_id: text, source_version: text,
  source_record_id: text, unit_review_ref: text, weight: z.number().int().positive().max(1000),
  normalized_amount: decimal, normalized_area_sqm: decimal, adjusted_unit_price: decimal,
  fx_source_ref: text.nullable(), index_ref: text.nullable(), observed_at: z.string().datetime({offset:true}),
  time_factor: decimal, index_version: text.nullable(), weight_policy_ref: text,
});
export type ValuationComparableTraceV1 = z.infer<typeof valuationComparableTraceV2Schema>;

// Local proposed consumer ABI; shared resource-valuation-result.v1 is unchanged.
const wrapperBase = {
  contract: z.literal('valuation-baseline-result.v1'), currency: z.string().regex(/^[A-Z]{3}$/),
  area_unit: z.literal('sqm'), amount_basis: z.literal('subject_total'), result: resourceValuationResultV1Schema,
};
export const valuationBaselineResultV1Schema = z.discriminatedUnion('transaction_kind', [
  z.strictObject({...wrapperBase, transaction_kind:z.literal('sale'), rental_period:z.null()}),
  z.strictObject({...wrapperBase, transaction_kind:z.literal('rent'), rental_period:z.enum(['month','year'])}),
]).superRefine((v,ctx)=>{
  if (v.currency!==v.result.currency || (v.transaction_kind==='sale' && v.result.rent_range!==null) ||
    (v.transaction_kind==='rent' && v.result.sale_range!==null)) {
    ctx.addIssue({code:'custom',message:'valuation_basis_result_mismatch'});
  }
});
export type ValuationBaselineResultV1 = z.infer<typeof valuationBaselineResultV1Schema>;

/** Construct each allowed field explicitly; never clone a caller/internal trace. */
export function projectValuationComparableV2(row: ValuationComparableTraceV1) {
  return valuationComparableTraceV2Schema.parse({
    observation_id:row.observation_id,unit_id:row.unit_id,source_id:row.source_id,source_version:row.source_version,
    source_record_id:row.source_record_id,unit_review_ref:row.unit_review_ref,weight:row.weight,
    normalized_amount:row.normalized_amount,normalized_area_sqm:row.normalized_area_sqm,
    adjusted_unit_price:row.adjusted_unit_price,fx_source_ref:row.fx_source_ref,index_ref:row.index_ref,
    observed_at:row.observed_at,time_factor:row.time_factor,index_version:row.index_version,weight_policy_ref:row.weight_policy_ref,
  });
}
export function explainValuationBaselineV1(policy: ValuationBaselinePolicyV1, count: number, excluded: number) {
  return [
    `${policy.transaction_kind}; evidence=${policy.evidence_kind}; ${count} distinct eligible units; ${excluded} observations not selected. Asking evidence is never a verified deal.`,
    'Central = exact source-policy-weighted mean of adjusted price/sqm times the subject area. Low/high = observed comparable envelope, rounded outward; not a confidence interval.',
    `Market=${policy.market.country_code}/${policy.market.locality}; type=${policy.resource_type}; selection requires exact location and unit attributes. No guessed floor, amenity or service-cost coefficient.`,
    policy.transaction_kind === 'rent' ? `Rent basis=${policy.rental_period}; no sale-to-rent or rental-period conversion.` : 'Sale evidence only; no conversion from rent.',
    'Quality score measures selected-unit coverage only, not probability, accuracy or statistical confidence.',
    'Model is unvalidated against real-market holdout data. No listing, ownership, contract, publication or financial posting is changed.',
  ];
}
