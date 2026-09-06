import { z } from 'zod';
import { CANONICAL_ROLES } from './access-matrix.ts';

export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format'
  );

export const dashboardRpcResponseSchema = z.object({
  version: z.literal(1),
  persona: z.enum(CANONICAL_ROLES),
  contextId: uuidSchema,
  context: z.object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    tenant_name: z.string(),
    role_code: z.string(),
    role_name: z.string(),
    scope_type: z.string(),
    property_id: uuidSchema.nullable().optional(),
    building_id: uuidSchema.nullable().optional(),
    unit_id: uuidSchema.nullable().optional(),
  }),
  workspace_id: uuidSchema,
  capabilities: z.array(z.string()),
  sections: z.array(z.string()),
  permissions: z.array(z.string()),
  entitlements: z.array(z.string()),
  modules: z.array(z.string()),
  kpis: z.record(
    z.string(),
    z.union([z.number(), z.string(), z.record(z.string(), z.unknown()), z.null()])
  ),
});

export type DashboardRpcResponse = z.infer<typeof dashboardRpcResponseSchema>;
