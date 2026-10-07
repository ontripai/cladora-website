import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform(value => value.toLowerCase());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'invalid_date');

export const presaleActivationCommandV1Schema = z.strictObject({
  version: z.literal(1),
  context_id: uuid,
  workspace_id: uuid,
  property_id: uuid,
  opportunity_id: uuid,
  proposal_id: uuid,
  document_context_id: uuid,
  evidence_version_id: uuid,
  signed_on: isoDate,
  expected_effective_from: isoDate,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
}).superRefine((value, ctx) => {
  if (value.signed_on > value.expected_effective_from) {
    ctx.addIssue({ code: 'custom', path: ['signed_on'], message: 'signature_after_effective_date' });
  }
});

export const presaleActivationResponseV1Schema = z.object({
  version: z.literal(1),
  presale_contract_id: uuid,
  contractual_buyer_relationship_id: uuid,
  status: z.literal('contractual_buyer'),
  effective_from: isoDate,
  effective_to: isoDate.nullable(),
  idempotent: z.boolean(),
});

