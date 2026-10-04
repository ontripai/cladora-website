import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';
// Account ownership comes from the authenticated server session, never these fields.
export const serviceSelfPersonSchema = z.object({
  context_id: uuidSchema, workspace_id: uuidSchema,
  name: z.string().trim().min(2).max(120),
  valid_until: z.iso.datetime({ offset: true }),
  confirm_self: z.literal(true),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
}).strict();
export const serviceSelfPersonResultSchema = z.object({ party_id: uuidSchema, valid_until: z.iso.datetime({ offset: true }) }).strict();
export type ServiceSelfPerson = z.infer<typeof serviceSelfPersonSchema>;
