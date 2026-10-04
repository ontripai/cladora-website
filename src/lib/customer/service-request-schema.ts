import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

// Validation only: the server resolves the actor and validates the current
// Workspace, offering revision, beneficiary and location through canonical guards.
// A request expresses interest; it creates no payment or execution obligation.
export const createServiceRequestSchema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  published_revision_id: uuidSchema,
  beneficiary_party_id: uuidSchema,
  description: z.string().trim().min(5).max(5000),
  idempotency_key: idempotencyKeySchema,
});

export type CreateServiceRequest = z.infer<typeof createServiceRequestSchema>;

/** Pure planning against a server-read offering. Not an authorization boundary.
 * The future transaction must lock/re-read the offering and recheck live access,
 * parties, entitlement and references before committing request/audit/outbox.
 */
export function checkServiceRequestOffering(
  request: CreateServiceRequest,
  offering: { id: string; workspace_id: string; published_revision_id: string | null;
    status: string; valid_from: string; valid_until: string | null },
  now: number,
): 'OK' | 'OFFERING_MISMATCH' | 'REVISION_CHANGED' | 'UNAVAILABLE' {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!same(request.offering_id, offering.id) || !same(request.workspace_id, offering.workspace_id)) return 'OFFERING_MISMATCH';
  if (!offering.published_revision_id || !same(request.published_revision_id, offering.published_revision_id)) return 'REVISION_CHANGED';
  const start = Date.parse(offering.valid_from);
  const end = offering.valid_until === null ? null : Date.parse(offering.valid_until);
  if (offering.status !== 'published' || !Number.isFinite(now) || !Number.isFinite(start)
    || now < start || (end !== null && (!Number.isFinite(end) || end <= start || now >= end))) return 'UNAVAILABLE';
  return 'OK';
}
