import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';
export const serviceRequestResultSchema = z.strictObject({ request_id: uuidSchema, status: z.literal('submitted') });
export const serviceRequestReadSchema = z.strictObject({
  can_request: z.boolean(),
  beneficiaries: z.array(z.strictObject({ party_id: uuidSchema, label: z.string() })),
  requests: z.array(z.strictObject({ request_id: uuidSchema, offering_id: uuidSchema, revision_id: uuidSchema,
    description: z.string(), status: z.literal('submitted'), created_at: z.string() })),
});
