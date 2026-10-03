import { z } from "zod";

const uuid = z.string().uuid().transform((value) => value.toLowerCase());
const label = (maximum: number) => z.string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(z.string().min(1).max(maximum).regex(/^[^\u0000-\u001f\u007f]*$/));

// Preserve numeric(20,4) exactly; JSON numbers and locale-formatted prices are
// deliberately rejected. Never round or pass money through binary floating point.
const price = z.string().regex(/^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,4})?$/)
  .refine((value) => /[1-9]/.test(value), "positive_price_required")
  .transform((value) => {
    const [whole, fraction = ""] = value.split(".");
    return `${whole}.${fraction.padEnd(4, "0")}`;
  });

export const airpropOpportunityPayloadV2Schema = z.strictObject({
  name: label(160),
  country_code: z.literal("RO"),
  city: label(120),
  currency: z.enum(["RON", "EUR"]),
  asking_price: price,
  property_id: uuid.nullable().optional().transform((value) => value ?? null),
  source_ref: label(500).nullable().optional().transform((value) => value ?? null),
});

// This validates untrusted input only. It does not establish workspace authority,
// resolve a property, grant access, or create a commercial/financial record.
export const createAirpropOpportunityV2Schema = z.strictObject({
  version: z.literal(2),
  context_id: uuid,
  workspace_id: uuid,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  payload: airpropOpportunityPayloadV2Schema,
});

export type CreateAirpropOpportunityV2 = z.output<typeof createAirpropOpportunityV2Schema>;
