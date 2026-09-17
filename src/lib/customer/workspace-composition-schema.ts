import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/, 'Invalid idempotency key format');

export const moduleCategorySchema = z.enum([
  'core',
  'financial',
  'operations',
  'governance',
  'security',
  'occupancy',
  'services',
  'investment',
]);

export const moduleItemSchema = z.object({
  module_definition_id: uuidSchema,
  code: z.string().min(2).max(64),
  version: z.number().int().positive(),
  name: z.string(),
  labels: z.object({
    ro: z.string(),
    en: z.string(),
    fa: z.string(),
  }),
  category: z.string(),
  sensitivity_level: z.string(),
  requires_aal2: z.boolean(),
  lifecycle_status: z.string(),
  workspace_module_id: uuidSchema.nullable(),
  status: z.string(),
  is_installed: z.boolean(),
  is_entitled: z.boolean(),
  is_compatible: z.boolean(),
  can_activate: z.boolean(),
  can_deactivate: z.boolean(),
});

export const workspaceCompositionResponseSchema = z.object({
  has_assignment: z.boolean(),
  status: z.string(),
  workspace_id: uuidSchema.nullable(),
  country_code: z.string().nullable().optional(),
  profile: z
    .object({
      id: uuidSchema,
      code: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  operating_model: z
    .object({
      id: uuidSchema,
      code: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  modules: z.array(moduleItemSchema),
});

export const activateWorkspaceModuleRequestSchema = z.object({
  context_id: uuidSchema,
  module_definition_id: uuidSchema,
  expected_workspace_module_id: uuidSchema.nullable().optional(),
  config_json: z.record(z.string(), z.never()).default({}),
  idempotency_key: idempotencyKeySchema,
  reason: z.string().min(3).max(500).optional(),
});

export const activateWorkspaceModuleResponseSchema = z.object({
  action: z.literal('activate'),
  module_code: z.string(),
  module_definition_id: uuidSchema,
  reason: z.string(),
  status: z.string(),
  valid_from: z.string(),
  workspace_id: uuidSchema,
  workspace_module_id: uuidSchema,
});

export const deactivateWorkspaceModuleRequestSchema = z.object({
  context_id: uuidSchema,
  expected_workspace_module_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  reason: z.string().min(5).max(500),
});

export const deactivateWorkspaceModuleResponseSchema = z.object({
  action: z.literal('deactivate'),
  deactivated_at: z.string(),
  module_code: z.string(),
  module_definition_id: uuidSchema,
  reason: z.string(),
  status: z.literal('deactivated'),
  workspace_id: uuidSchema,
  workspace_module_id: uuidSchema,
});

export type ModuleItem = z.infer<typeof moduleItemSchema>;
export type WorkspaceCompositionResponse = z.infer<typeof workspaceCompositionResponseSchema>;
export type ActivateWorkspaceModuleRequest = z.infer<typeof activateWorkspaceModuleRequestSchema>;
export type ActivateWorkspaceModuleResponse = z.infer<typeof activateWorkspaceModuleResponseSchema>;
export type DeactivateWorkspaceModuleRequest = z.infer<typeof deactivateWorkspaceModuleRequestSchema>;
export type DeactivateWorkspaceModuleResponse = z.infer<typeof deactivateWorkspaceModuleResponseSchema>;
