import { z } from 'zod';
import { serviceResourceReferenceSchema } from './service-offering-v14-schema';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

export const SERVICE_OFFERING_REQUEST_FLOW_CONTRACT = 'service-offering-request-flow.v1' as const;

export const serviceOfferingRequestPublicInputV1Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  published_revision_id: uuidSchema,
  beneficiary_party_id: uuidSchema,
  resource: serviceResourceReferenceSchema.nullable(),
  description: z.string().trim().min(5).max(5000),
  idempotency_key: idempotencyKeySchema,
});

export type ServiceOfferingRequestPublicInputV1 = z.infer<
  typeof serviceOfferingRequestPublicInputV1Schema
>;

export const serviceOfferingRequestPreflightInputV1Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  published_revision_id: uuidSchema,
});

export type ServiceOfferingRequestPreflightInputV1 = z.infer<
  typeof serviceOfferingRequestPreflightInputV1Schema
>;

export const namedServiceResourceV1Schema = z.strictObject({
  reference: serviceResourceReferenceSchema,
  label: z.string().trim().min(1).max(240),
  detail: z.string().trim().min(1).max(240).nullable(),
});

export type NamedServiceResourceV1 = z.infer<typeof namedServiceResourceV1Schema>;

export const serviceOfferingRequestPreflightResultV1Schema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('ready'),
    contract: z.literal(SERVICE_OFFERING_REQUEST_FLOW_CONTRACT),
    source_kind: z.enum(['workspace', 'resources']),
    resources: z.array(namedServiceResourceV1Schema).max(100),
  }),
  z.strictObject({
    status: z.literal('denied'),
    code: z.enum(['SERVICE_ACCESS_DENIED', 'OFFERING_UNAVAILABLE', 'SOURCE_ACCESS_DENIED']),
  }),
  z.strictObject({
    status: z.literal('conflict'),
    code: z.enum(['OFFERING_CHANGED', 'SOURCE_CHANGED']),
  }),
  z.strictObject({
    status: z.literal('not_ready'),
    code: z.enum([
      'SERVICE_S01_NOT_READY',
      'SERVICE_S02_NOT_READY',
      'SERVICE_S03_NOT_READY',
      'ELIGIBILITY_SOURCE_NOT_READY',
      'RUNTIME_BINDING_INACTIVE',
    ]),
  }),
]);

export type ServiceOfferingRequestPreflightResultV1 = z.infer<
  typeof serviceOfferingRequestPreflightResultV1Schema
>;
