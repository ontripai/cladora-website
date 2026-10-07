import { z } from 'zod';
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).transform(value => value.toLowerCase());
const version = z.number().int().min(1).max(2147483647);

export const createAirpropDiligenceDraftV1Schema = z.strictObject({
  version: z.literal(1), context_id: uuid, workspace_id: uuid, opportunity_id: uuid,
  expected_underwriting_version: version,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
});

