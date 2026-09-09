import { z } from "zod";

export const LIFECYCLE_STATUSES = [
  "planned",
  "ordered",
  "installed",
  "commissioned",
  "active",
  "under_maintenance",
  "out_of_service",
  "decommission_pending",
  "decommissioned",
  "disposed",
] as const;

export const OPERATIONAL_STATUSES = [
  "operational",
  "degraded",
  "unavailable",
  "isolated",
  "unknown",
] as const;

export const ASSET_CONDITIONS = [
  "excellent",
  "good",
  "fair",
  "poor",
  "critical",
  "retired",
  "unknown",
] as const;

export const CRITICALITY_LEVELS = ["low", "medium", "high", "critical"] as const;

export const OWNERSHIP_TYPES = [
  "association",
  "owner",
  "municipal",
  "utility",
  "vendor",
  "tenant",
] as const;

export const ASSET_SCOPES = [
  "property",
  "building",
  "unit",
  "common_area",
] as const;

export const INSPECTION_RESULTS = [
  "pending",
  "passed",
  "passed_with_observations",
  "failed",
  "inconclusive",
] as const;

export const CLAIM_STATUSES = [
  "submitted",
  "in_review",
  "accepted",
  "rejected",
  "resolved",
] as const;

// 1. List Assets Query
export const listAssetsQuerySchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  property_id: z.string().uuid().optional().nullable(),
  building_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  lifecycle_status: z.enum(LIFECYCLE_STATUSES).optional().nullable(),
  operational_status: z.enum(OPERATIONAL_STATUSES).optional().nullable(),
  condition: z.enum(ASSET_CONDITIONS).optional().nullable(),
  criticality_level: z.enum(CRITICALITY_LEVELS).optional().nullable(),
  is_safety_critical: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional()
    .nullable(),
  search: z.string().trim().max(100).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

// 2. Asset Detail Query
export const assetDetailQuerySchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
});

// 3. Create Asset
export const createAssetSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  property_id: z.string().uuid("Invalid property UUID"),
  category_id: z.string().uuid("Invalid category UUID"),
  asset_code: z.string().trim().min(1, "Asset code is required").max(64),
  name: z.string().trim().min(1, "Asset name is required").max(255),
  scope: z.enum(ASSET_SCOPES).default("property"),
  building_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  manufacturer: z.string().max(120).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  serial_number: z.string().max(120).optional().nullable(),
  manufacture_year: z.number().int().min(1900).max(2100).optional().nullable(),
  installed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable(),
  location_description: z.string().max(500).optional().nullable(),
  ownership_type: z.enum(OWNERSHIP_TYPES).default("association"),
  condition: z.enum(ASSET_CONDITIONS).default("unknown"),
  criticality_level: z.enum(CRITICALITY_LEVELS).default("medium"),
  is_safety_critical: z.boolean().default(false),
  replacement_cost: z.number().positive().optional().nullable(),
  currency: z.string().length(3).default("RON"),
  meter_id: z.string().uuid().optional().nullable(),
  access_point_id: z.string().uuid().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  service_contract_id: z.string().uuid().optional().nullable(),
  service_frequency_months: z.number().int().positive().optional().nullable(),
});

// 4. Update Asset
export const updateAssetSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  name: z.string().trim().min(1).max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  location_description: z.string().max(500).optional().nullable(),
  meter_id: z.string().uuid().optional().nullable(),
  access_point_id: z.string().uuid().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  service_contract_id: z.string().uuid().optional().nullable(),
  service_frequency_months: z.number().int().positive().optional().nullable(),
  replacement_cost: z.number().positive().optional().nullable(),
});

// 5. Transition Lifecycle (Decommissioning barred directly)
export const transitionLifecycleSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  target_status: z.enum([
    "planned",
    "ordered",
    "installed",
    "commissioned",
    "active",
    "under_maintenance",
    "out_of_service",
  ], {
    message: "Direct decommission transition forbidden. Use decommission request and approval.",
  }),
  reason: z.string().max(500).optional().nullable(),
});

// 6. Update Operational Status
export const updateOperationalStatusSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  operational_status: z.enum(OPERATIONAL_STATUSES),
  condition: z.enum(ASSET_CONDITIONS).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

// 7. Start Downtime
export const startDowntimeSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  reason: z.string().trim().min(2, "Reason must be at least 2 characters").max(500),
  is_planned: z.boolean().default(false),
  work_order_id: z.string().uuid().optional().nullable(),
  ticket_id: z.string().uuid().optional().nullable(),
  started_at: z.string().datetime().optional().nullable(),
});

// 8. End Downtime
export const endDowntimeSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  ended_at: z.string().datetime().optional().nullable(),
  restored_operational_status: z.enum(OPERATIONAL_STATUSES).default("operational"),
});

// 9. Inspections
export const recordInspectionSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  inspection_type: z.string().trim().min(1).max(64),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid scheduled_date (YYYY-MM-DD)"),
  performed_at: z.string().datetime().optional().nullable(),
  result: z.enum(INSPECTION_RESULTS).default("pending"),
  inspector_name: z.string().max(120).optional().nullable(),
  inspector_vendor_id: z.string().uuid().optional().nullable(),
  observations: z.string().max(2000).optional().nullable(),
  corrective_action_required: z.string().max(2000).optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
  policy_id: z.string().uuid().optional().nullable(),
});

export const verifyInspectionSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
});

// 10. Warranty
export const upsertWarrantySchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid starts_on (YYYY-MM-DD)"),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid ends_on (YYYY-MM-DD)"),
  vendor_id: z.string().uuid().optional().nullable(),
  coverage_json: z.record(z.string(), z.any()).default({}),
  warranty_terms: z.string().max(2000).optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
}).refine((data) => data.ends_on >= data.starts_on, {
  message: "Warranty ends_on must be on or after starts_on",
  path: ["ends_on"],
});

export const createClaimSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  warranty_id: z.string().uuid("Invalid warranty UUID"),
  claim_reference: z.string().trim().min(1).max(64),
  description: z.string().trim().min(5, "Claim description must be at least 5 characters").max(2000),
  claim_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid claim_date (YYYY-MM-DD)").optional(),
  document_id: z.string().uuid().optional().nullable(),
});

export const resolveClaimSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  resolution_status: z.enum(["in_review", "accepted", "rejected", "resolved"]),
  resolution_notes: z.string().max(1000).optional().nullable(),
});

// 11. Compliance Policy
export const configurePolicySchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  policy_code: z.string().trim().min(1).max(64),
  category_code: z.string().trim().min(1).max(64),
  interval_months: z.number().int().positive("Interval months must be positive"),
  legal_source_reference: z.string().trim().min(2).max(500),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid effective_from (YYYY-MM-DD)"),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid effective_to (YYYY-MM-DD)").optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  is_safety_mandatory: z.boolean().default(false),
  jurisdiction: z.string().length(2).default("RO"),
}).refine(
  (data) => !data.effective_to || data.effective_to >= data.effective_from,
  {
    message: "effective_to must be on or after effective_from",
    path: ["effective_to"],
  }
);

// 12. Decommissioning
export const requestDecommissionSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  reason: z.string().trim().min(5, "Decommission reason must be at least 5 characters").max(1000),
  replacement_asset_id: z.string().uuid().optional().nullable(),
});

export const approveDecommissionSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  approved: z.boolean(),
  rejection_reason: z.string().max(500).optional().nullable(),
});
