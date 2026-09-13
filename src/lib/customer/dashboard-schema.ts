import { z } from 'zod';
import { CANONICAL_ROLES } from './access-matrix.ts';

export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format'
  );

export const SCOPE_TYPES = ['tenant', 'property', 'building', 'unit'] as const;

export const dashboardContextSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    tenant_name: z.string().min(1),
    role_code: z.enum(CANONICAL_ROLES),
    role_name: z.string().min(1),
    scope_type: z.enum(SCOPE_TYPES),
    property_id: uuidSchema.nullable().optional(),
    building_id: uuidSchema.nullable().optional(),
    unit_id: uuidSchema.nullable().optional(),
  })
  .strict();

const finiteNumber = z.number().finite();

export const dashboardKpisSchema = z
  .object({
    properties: finiteNumber.optional(),
    buildings: finiteNumber.optional(),
    units: finiteNumber.optional(),
    open_work_orders: finiteNumber.optional(),
    unread_notifications: finiteNumber.optional(),
    outstanding_amount: finiteNumber.optional(),
    my_units_count: finiteNumber.optional(),
    my_open_requests: finiteNumber.optional(),
    my_open_tickets: finiteNumber.optional(),
    financial_records: finiteNumber.optional(),
  })
  .strict();

// PostgreSQL serializes timestamptz values with an explicit UTC offset
// (for example, `2026-09-13T21:47:00.33075+00:00`). Accept standard
// ISO-8601 offsets in addition to the `Z` form used by browser fixtures.
export const isoDateStringSchema = z.iso.datetime({ offset: true });

export const dashboardRpcResponseSchema = z
  .object({
    version: z.literal(1),
    persona: z.enum(CANONICAL_ROLES),
    contextId: uuidSchema,
    context: dashboardContextSchema,
    workspace_id: uuidSchema,
    capabilities: z.array(z.string()),
    sections: z.array(z.string()),
    permissions: z.array(z.string()),
    entitlements: z.array(z.string()),
    modules: z.array(z.string()),
    kpis: dashboardKpisSchema,
    generated_at: isoDateStringSchema,
  })
  .strict();

export type DashboardRpcResponse = z.infer<typeof dashboardRpcResponseSchema>;
export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;
export type DashboardContext = z.infer<typeof dashboardContextSchema>;
