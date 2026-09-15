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
