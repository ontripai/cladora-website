import { z } from "zod";

export const importContextSchema = z.object({ context_id: z.string().uuid() });
export const createImportRunSchema = importContextSchema.extend({ property_id: z.string().uuid().nullable().optional(), idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/) });
export const importActionSchema = importContextSchema;
export const importSourceMetadataSchema = z.object({
  context_id: z.string().uuid(), template_code: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/),
  filename: z.string().min(1).max(255), sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export const configureImportTemplateSchema = importContextSchema.extend({
  code: z.enum(["property","building","entrance","unit","party","ownership","occupancy","account","opening_gl","open_receivable","meter","meter_reading"]),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  dependency_order: z.number().int().min(0).max(1000),
  schema: z.object({ headers: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,63}$/)).min(2).max(64) }).passthrough(),
  max_rows: z.number().int().min(1).max(100_000).default(10_000),
});
