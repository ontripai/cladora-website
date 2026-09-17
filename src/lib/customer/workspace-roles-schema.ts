import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/, 'Invalid idempotency key format');

export const scopeCeilingSchema = z.enum(['workspace', 'property', 'building', 'unit']);
export const scopeTypeSchema = z.enum(['workspace', 'property', 'building', 'unit']);
export const roleLifecycleStatusSchema = z.enum(['draft', 'published', 'archived']);
export const permissionEffectSchema = z.enum(['allow', 'deny']);

export const roleModuleItemSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
});

export const rolePermissionItemSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  effect: permissionEffectSchema,
});

export const workspaceRoleItemSchema = z.object({
  id: uuidSchema,
  code: z.string().regex(/^[a-z0-9_]{3,50}$/, 'Role code must be 3-50 lowercase alphanumeric or underscores'),
  name: z.string().min(2),
  description: z.string().nullable().optional(),
  role_version: z.number().int().positive(),
  lock_version: z.number().int().positive(),
  scope_ceiling: scopeCeilingSchema,
  lifecycle_status: roleLifecycleStatusSchema,
  base_role_id: uuidSchema.nullable().optional(),
  base_role_code: z.string().nullable().optional(),
  valid_from: z.string(),
  valid_to: z.string().nullable().optional(),
  modules: z.array(roleModuleItemSchema),
  permissions: z.array(rolePermissionItemSchema),
});

export const workspaceMemberRoleAssignmentItemSchema = z.object({
  id: uuidSchema,
  membership_id: uuidSchema,
  member_name: z.string().nullable().optional(),
  workspace_role_id: uuidSchema,
  role_code: z.string(),
  role_name: z.string(),
  scope_type: scopeTypeSchema,
  property_id: uuidSchema.nullable().optional(),
  property_name: z.string().nullable().optional(),
  building_id: uuidSchema.nullable().optional(),
  building_name: z.string().nullable().optional(),
  unit_id: uuidSchema.nullable().optional(),
  unit_number: z.string().nullable().optional(),
  valid_from: z.string(),
  valid_to: z.string().nullable().optional(),
  lock_version: z.number().int().positive(),
  reason: z.string(),
});

export const availableModuleItemSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  category: z.string(),
});

export const availablePermissionItemSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  module_code: z.string(),
  permission_mode: z.string(),
  requires_aal2: z.boolean(),
});

export const templateRoleItemSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
});

export const getWorkspaceRolesResponseSchema = z.object({
  workspace_id: uuidSchema,
  roles: z.array(workspaceRoleItemSchema),
  assignments: z.array(workspaceMemberRoleAssignmentItemSchema),
  available_modules: z.array(availableModuleItemSchema),
  available_permissions: z.array(availablePermissionItemSchema),
  templates: z.array(templateRoleItemSchema),
});

// Mutation Request Schemas

export const createWorkspaceRoleDraftRequestSchema = z.object({
  context_id: uuidSchema,
  code: z.string().regex(/^[a-z0-9_]{3,50}$/, 'Role code must be 3-50 lowercase characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(500).nullable().optional(),
  scope_ceiling: scopeCeilingSchema.default('workspace'),
  base_role_id: uuidSchema.nullable().optional(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export const attachWorkspaceRoleModuleRequestSchema = z.object({
  context_id: uuidSchema,
  workspace_role_id: uuidSchema,
  module_definition_id: uuidSchema,
  expected_lock_version: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export const detachWorkspaceRoleModuleRequestSchema = z.object({
  context_id: uuidSchema,
  workspace_role_id: uuidSchema,
  module_definition_id: uuidSchema,
  expected_lock_version: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export const attachWorkspaceRolePermissionRequestSchema = z.object({
  context_id: uuidSchema,
  workspace_role_id: uuidSchema,
  permission_id: uuidSchema,
  effect: permissionEffectSchema.default('allow'),
  expected_lock_version: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export const detachWorkspaceRolePermissionRequestSchema = z.object({
  context_id: uuidSchema,
  workspace_role_id: uuidSchema,
  permission_id: uuidSchema,
  expected_lock_version: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export const snapshotWorkspaceRoleTemplateRequestSchema = z.object({
  context_id: uuidSchema,
  workspace_role_id: uuidSchema,
  expected_lock_version: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export const publishWorkspaceRoleRequestSchema = z.object({
  context_id: uuidSchema,
  workspace_role_id: uuidSchema,
  expected_lock_version: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export const assignWorkspaceRoleRequestSchema = z.object({
  context_id: uuidSchema,
  target_membership_id: uuidSchema,
  workspace_role_id: uuidSchema,
  scope_type: scopeTypeSchema,
  property_id: uuidSchema.nullable().optional(),
  building_id: uuidSchema.nullable().optional(),
  unit_id: uuidSchema.nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export const revokeWorkspaceRoleAssignmentRequestSchema = z.object({
  context_id: uuidSchema,
  assignment_id: uuidSchema,
  expected_lock_version: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(500),
  idempotency_key: idempotencyKeySchema,
});

export type WorkspaceRoleItem = z.infer<typeof workspaceRoleItemSchema>;
export type WorkspaceMemberRoleAssignmentItem = z.infer<typeof workspaceMemberRoleAssignmentItemSchema>;
export type GetWorkspaceRolesResponse = z.infer<typeof getWorkspaceRolesResponseSchema>;
