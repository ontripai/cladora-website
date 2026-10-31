import { z } from 'zod';

const label = z.string().trim().min(1).max(80);
const instant = z.string().datetime({ offset: true });
const positive = z.string().regex(/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,8})?$/)
  .refine(v => Number(v) > 0);
const unique = (items: string[]) => new Set(items).size === items.length;

// Supplied, versioned market policy, never universal fitted coefficients or a license.
export const valuationBaselinePolicyV1Schema = z.strictObject({
  contract: z.literal('valuation-baseline-policy.v1'),
  policy_version: label,
  model_version: label,
  dataset_kind: z.enum(['synthetic', 'curated_unvalidated']),
  market: z.strictObject({ country_code: z.string().regex(/^[A-Z]{2}$/), locality: label, location_key: z.string().min(1).max(240) }),
  resource_type: label,
  transaction_kind: z.enum(['sale', 'rent']),
  evidence_kind: z.enum(['asking', 'verified_transaction', 'external_estimate']),
  rental_period: z.enum(['month', 'year']).nullable(),
  location_key_attribute: label,
  area_attribute: label,
  area_unit_attribute: label,
  match_attributes: z.array(label).min(1).max(10).refine(unique),
  min_comparables: z.number().int().min(2).max(100),
  min_area_ratio: positive,
  max_area_ratio: positive,
  outlier_ratio: positive.refine(v => Number(v) > 1),
  source_weights: z.array(z.strictObject({ source_id: label, weight: z.number().int().positive().max(1000), rationale_ref: z.string().min(1).max(240) })).min(1).max(100),
  time_adjustments: z.array(z.strictObject({
    observation_id: z.string().uuid(), factor: positive, from: instant, to: instant,
    published_at: instant, index_version: label, evidence_ref: z.string().min(1).max(240),
    basis: z.literal('target_currency_property_index'),
  })).max(500),
}).superRefine((p, ctx) => {
  if (Number(p.min_area_ratio) > 1 || Number(p.max_area_ratio) < 1 ||
    (p.transaction_kind === 'sale') !== (p.rental_period === null) ||
    !unique(p.source_weights.map(x => x.source_id)) ||
    !unique(p.time_adjustments.map(x => x.observation_id))) {
    ctx.addIssue({ code: 'custom', message: 'invalid_policy_bounds_period_or_duplicate_adjustment' });
  }
});
export type ValuationBaselinePolicyV1 = z.infer<typeof valuationBaselinePolicyV1Schema>;

// Exact positive rational arithmetic; BigInt constructors support the existing ES5
// compilation target without bigint literals/downlevelIteration/config changes.
export type Ratio = Readonly<{ n: bigint; d: bigint }>;
const zero = BigInt(0), one = BigInt(1), ten = BigInt(10);
function ratio(n: bigint, d: bigint): Ratio {
  if (d <= zero || n < zero) throw new Error('invalid_nonnegative_ratio');
  let a = n, b = d;
  while (b !== zero) { const remainder = a % b; a = b; b = remainder; }
  return { n: n / (a || one), d: d / (a || one) };
}
export function decimalRatio(value: string): Ratio {
  if (!/^(0|[1-9][0-9]{0,30})(\.[0-9]{1,24})?$/.test(value)) throw new Error('invalid_exact_decimal');
  const [whole, fraction = ''] = value.split('.');
  let scale = one;
  for (let i = 0; i < fraction.length; i++) scale *= ten;
  return ratio(BigInt(whole + fraction), scale);
}
export const addRatio = (a: Ratio, b: Ratio) => ratio(a.n * b.d + b.n * a.d, a.d * b.d);
export const multiplyRatio = (a: Ratio, b: Ratio) => ratio(a.n * b.n, a.d * b.d);
export function divideRatio(a: Ratio, b: Ratio): Ratio {
  if (b.n === zero) throw new Error('zero_denominator');
  return ratio(a.n * b.d, a.d * b.n);
}
export const compareRatio = (a: Ratio, b: Ratio) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
export function renderRatio(value: Ratio, places: number, rounding: 'floor' | 'ceil' | 'half_up'): string {
  let scale = one;
  for (let i = 0; i < places; i++) scale *= ten;
  const scaled = value.n * scale;
  let units = scaled / value.d;
  const remainder = scaled % value.d;
  if ((rounding === 'ceil' && remainder > zero) || (rounding === 'half_up' && remainder * BigInt(2) >= value.d)) units += one;
  const digits = units.toString().padStart(places + 1, '0');
  return places === 0 ? digits : digits.slice(0, -places) + '.' + digits.slice(-places);
}
