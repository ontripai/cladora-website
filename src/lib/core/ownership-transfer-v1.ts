import { z } from 'zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  .transform(value => value.toLowerCase());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'invalid_date');

export const ownershipTransferCommandV1Schema = z.strictObject({
  version: z.literal(1),
  context_id: uuid,
  workspace_id: uuid,
  property_id: uuid,
  proposal_id: uuid,
  document_context_id: uuid,
  evidence_version_id: uuid,
  expected_outgoing_ownership_id: uuid,
  expected_outgoing_valid_from: isoDate,
  expected_share: z.number().positive().max(1),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
});

export const ownershipTransferResponseV1Schema = z.object({
  version: z.literal(1),
  transfer_id: uuid,
  outgoing_ownership_id: uuid,
  incoming_ownership_id: uuid,
  status: z.literal('transferred'),
  effective_on: isoDate,
  idempotent: z.boolean(),
});
