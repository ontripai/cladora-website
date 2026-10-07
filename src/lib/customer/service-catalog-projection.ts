import { z } from 'zod';
import { serviceOfferingRevisionSchema } from './service-catalog-schema';
import { uuidSchema } from './workspace-composition-schema';

// Explicit read projection AFTER authoritative context/permission/eligibility checks.
// This helper is not public publication consent and does not authorize a row.
const itemSchema = z.object({
  offering_id: uuidSchema,
  revision_id: uuidSchema,
  status: z.literal('published'),
  revision: serviceOfferingRevisionSchema,
});

export function projectAuthorizedServiceCatalogItem(row: unknown, now: number) {
  const parsed = itemSchema.safeParse(row);
  if (!parsed.success || !Number.isFinite(now)) return null;
  const { offering_id, revision_id, revision } = parsed.data;
  if (now < Date.parse(revision.valid_from)
    || (revision.valid_until !== null && now >= Date.parse(revision.valid_until))) return null;
  // Never spread raw rows: provider contact, actor, tenant, approval notes,
  // eligibility internals and document IDs are not customer catalogue fields.
  return {
    offering_id,
    revision_id,
    labels: revision.labels,
    description: revision.description,
    acquisition_mode: revision.acquisition_mode,
    price: revision.price,
    valid_from: revision.valid_from,
    valid_until: revision.valid_until,
    cancellation_terms: revision.cancellation_terms,
    acceptance_criteria: revision.acceptance_criteria,
  };
}

export type ServiceCatalogItem = NonNullable<ReturnType<typeof projectAuthorizedServiceCatalogItem>>;
