import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const localizedLabelSchema = z.object({
  ro: z.string().optional(),
  en: z.string().optional(),
  fa: z.string().optional(),
}).catchall(z.string());

export const taxonomyItemSchema = z.object({
  id: uuidSchema,
  code: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  labels: localizedLabelSchema.optional(),
  description: z.string().nullable().optional(),
});

export const spaceKindItemSchema = z.object({
  id: uuidSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  labels: localizedLabelSchema.optional(),
  compatibility_level: z.enum(['compatible', 'review_required', 'incompatible']).optional(),
});

export const workspaceTaxonomyResponseSchema = z.object({
  has_assignment: z.boolean(),
  status: z.string(),
  workspace_id: uuidSchema.nullable().optional(),
  assignment_id: uuidSchema.optional(),
  valid_from: z.string().optional(),
  valid_to: z.string().nullable().optional(),
  profile: taxonomyItemSchema.optional(),
  operating_model: taxonomyItemSchema.optional(),
  allowed_space_kinds: z.array(spaceKindItemSchema).optional(),
});

export type WorkspaceTaxonomyResponse = z.infer<typeof workspaceTaxonomyResponseSchema>;

export const assignWorkspaceTaxonomyRequestSchema = z.object({
  context_id: uuidSchema,
  property_profile_code: z.string().regex(/^[a-z0-9_]{3,64}$/),
  operating_model_code: z.string().regex(/^[a-z0-9_]{3,64}$/),
  country_code: z.string().regex(/^[A-Za-z]{2}$/).transform((val) => val.toUpperCase()),
  idempotency_key: uuidSchema,
  expected_assignment_id: uuidSchema.nullable().optional(),
  reason: z.string().max(1000).nullable().optional(),
}).strict();

export type AssignWorkspaceTaxonomyRequest = z.infer<typeof assignWorkspaceTaxonomyRequestSchema>;

export const assignWorkspaceTaxonomyResponseSchema = z.object({
  workspace_id: uuidSchema,
  assignment_id: uuidSchema,
  previous_assignment_id: uuidSchema.nullable().optional(),
  property_profile_code: z.string(),
  operating_model_code: z.string(),
  country_code: z.string(),
  compatibility_status: z.enum(['compatible', 'review_required']),
  valid_from: z.string(),
  idempotent_replay: z.boolean(),
  audit_event_id: z.number().int().positive(),
});

export type AssignWorkspaceTaxonomyResponse = z.infer<typeof assignWorkspaceTaxonomyResponseSchema>;
