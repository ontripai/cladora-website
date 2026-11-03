import { z } from 'zod';
import { eventCommandSchema } from './event-interest-schema.ts';
export const eventLookupRequestSchema = eventCommandSchema;
// The original command is the request; no client actor/tenant/hash/permission.
export const eventLookupResponseSchema = z.discriminatedUnion('status', [
  z.strictObject({ contract: z.literal('ce011-receipt-lookup.v1'), status: z.literal('unresolved') }),
  z.strictObject({ contract: z.literal('ce011-receipt-lookup.v1'), status: z.literal('matched'), result: z.unknown() }),
]);
