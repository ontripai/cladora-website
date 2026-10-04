import { z } from 'zod';

// Canonical PostgreSQL IDs also include deterministic pilot IDs with non-RFC bits.
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform(value => value.toLowerCase());
const amount = z.string().regex(/^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,4})?$/)
  .transform(value => {
    const [whole, fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(4, '0')}`;
  });
const units = (value: string) => BigInt(value.replace('.', ''));
const canonicalAmount = (value: string) => /^(?:0|[1-9][0-9]{0,15})\.[0-9]{4}$/.test(value);

export const airpropUnderwritingAssumptionsV2Schema = z.strictObject({
  acquisition_cost: amount.refine(value => canonicalAmount(value) && units(value) > BigInt(0), 'positive_cost_required'),
  annual_rent: amount,
  annual_opex: amount,
  currency: z.enum(['RON', 'EUR']),
}).refine(value => canonicalAmount(value.annual_opex) && canonicalAmount(value.annual_rent)
  && units(value.annual_opex) <= units(value.annual_rent), 'opex_exceeds_rent');

export const createAirpropUnderwritingV2Schema = z.strictObject({
  version: z.literal(2),
  context_id: uuid,
  workspace_id: uuid,
  opportunity_id: uuid,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  // Reject stale concurrent edits. Zero denotes no existing evaluation version.
  expected_version: z.number().int().min(0).max(2147483646),
  assumptions: airpropUnderwritingAssumptionsV2Schema,
});

const opportunityCurrencySchema = z.enum(['RON', 'EUR']);
function decimal(value: bigint, scale: number) {
  const digits = value.toString().padStart(scale + 1, '0');
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
function ratio(numerator: bigint, denominator: bigint) {
  const scaled = numerator * BigInt(100000000);
  // Positive ratios: half-away-from-zero, matching PostgreSQL numeric round(x,8).
  const rounded = scaled / denominator + ((scaled % denominator) * BigInt(2) >= denominator ? BigInt(1) : BigInt(0));
  return decimal(rounded, 8);
}

/** Pure arithmetic only. Currency must come from the currently authorized opportunity.
 * This establishes no permission, valuation, approval, tax or ledger effect. */
export function calculateAirpropUnderwritingV2(untrustedAssumptions: unknown, opportunityCurrency: unknown) {
  const assumptions = airpropUnderwritingAssumptionsV2Schema.parse(untrustedAssumptions);
  if (assumptions.currency !== opportunityCurrencySchema.parse(opportunityCurrency)) {
    throw new Error('airprop_underwriting_currency_mismatch');
  }
  const cost = units(assumptions.acquisition_cost);
  const rent = units(assumptions.annual_rent);
  const noi = rent - units(assumptions.annual_opex);
  return {
    annual_noi: decimal(noi, 4),
    gross_yield: ratio(rent, cost),
    net_yield: ratio(noi, cost),
    currency: assumptions.currency,
  };
}

export type CreateAirpropUnderwritingV2 = z.output<typeof createAirpropUnderwritingV2Schema>;
