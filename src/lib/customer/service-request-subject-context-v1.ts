import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';

export const SERVICE_REQUEST_SUBJECT_CONTEXT_CONTRACT = 'service-request-subject-context.v1' as const;
/** Reference-only canonical snapshot; party access must be rechecked per transaction. */
export const serviceRequestSubjectContextV1Schema = z.strictObject({
  request_id: uuidSchema,
  request_version: z.number().int().positive().safe(),
  workspace_id: uuidSchema,
  status: z.literal('submitted'),
  actor_party_snapshot: z.strictObject({ party_id: uuidSchema, current_actor_is_party: z.literal(true) }),
  audience_party_snapshot: z.strictObject({ party_ids: z.tuple([uuidSchema]), request_party_only: z.literal(true) }),
}).refine(value => value.actor_party_snapshot.party_id.toLowerCase()
  === value.audience_party_snapshot.party_ids[0].toLowerCase(), 'exact_request_party_audience_required');
export type ServiceRequestSubjectContextV1 = z.infer<typeof serviceRequestSubjectContextV1Schema>;
