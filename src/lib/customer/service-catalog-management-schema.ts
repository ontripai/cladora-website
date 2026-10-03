import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';
import { serviceOfferingRevisionSchema } from './service-catalog-schema';

export const serviceCatalogManagementSchema = z.strictObject({
  can_manage: z.boolean(), can_publish: z.boolean(), next_after: uuidSchema.nullable(),
  definitions: z.array(z.strictObject({ definition_id: uuidSchema, code: z.string(), labels: serviceOfferingRevisionSchema.shape.labels, active: z.boolean(), lock_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER) })),
  providers: z.array(z.strictObject({ provider_party_id: uuidSchema, label: z.string() })),
  offerings: z.array(z.strictObject({ offering_id: uuidSchema, definition_id: uuidSchema, provider_party_id: uuidSchema,
    lock_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), current_revision_id: uuidSchema, published_revision_id: uuidSchema.nullable(),
    revisions: z.array(z.strictObject({ revision_id: uuidSchema, status: z.enum(['draft', 'submitted', 'published', 'suspended', 'archived']),
      revision: serviceOfferingRevisionSchema, can_publish: z.boolean() })),
  })),
});
export type ServiceCatalogManagement = z.infer<typeof serviceCatalogManagementSchema>;
export const updateServiceDefinitionSchema = z.strictObject({
  context_id: uuidSchema, workspace_id: uuidSchema, definition_id: uuidSchema,
  expected_lock_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), labels: serviceOfferingRevisionSchema.shape.labels,
  active: z.boolean(), reason: z.string().trim().min(5).max(500), idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
});
