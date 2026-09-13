import { z } from "zod";

export const importContextSchema = z.object({ context_id: z.string().uuid() });
export const createImportRunSchema = importContextSchema.extend({ property_id: z.string().uuid().nullable().optional(), idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/) });
export const importActionSchema = importContextSchema;
export const importSourceMetadataSchema = z.object({
  context_id: z.string().uuid(), template_code: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
  filename: z.string().min(1).max(255), sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
