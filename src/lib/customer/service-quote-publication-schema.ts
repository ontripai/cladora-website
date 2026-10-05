import { z } from 'zod';
import { uuidSchema, idempotencyKeySchema } from './workspace-composition-schema';
export const publishServiceQuoteSchema = z.strictObject({
  context_id: uuidSchema, workspace_id: uuidSchema, quote_id: uuidSchema,
  expected_version: z.number().int().min(1).max(1000000000), idempotency_key: idempotencyKeySchema,
});
export const serviceQuotePublicationResultSchema = z.strictObject({ quote_id: uuidSchema, version: z.number().int().positive(), status: z.literal('presented') });
export const serviceQuotePublicationsSchema = z.strictObject({ can_publish: z.boolean(), quotes: z.array(z.strictObject({
  quote_id: uuidSchema, version: z.number().int().positive(), description: z.string(), scope: z.string(),
  total_minor: z.string().regex(/^(0|[1-9][0-9]{0,17})$/), currency: z.enum(['RON','EUR','GBP','USD']),
  valid_until: z.iso.datetime({ offset: true }), published_at: z.iso.datetime({ offset: true }).nullable(),
  provider_label: z.string(), beneficiary_label: z.string(), state: z.enum(['draft','presented','superseded','expired']),
})) });
