import { z } from "zod";

export const createMaintenanceRequestSchema = z.object({
  context_id: z.string().uuid(),
  property_id: z.string().uuid(),
  building_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "title_required").max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  category: z.string().trim().min(1).default("General"),
  priority: z.enum(["low", "normal", "high", "urgent", "emergency"]).default("normal"),
  severity: z.enum(["minor", "moderate", "major", "critical"]).default("minor"),
  safety_impact: z.boolean().default(false),
  access_instructions: z.string().trim().max(1000).optional().nullable(),
  preferred_window: z.string().trim().max(200).optional().nullable(),
  source: z.enum(["portal", "mobile", "call", "email", "sensor", "inspection"]).default("portal"),
});

export const triageRequestSchema = z.object({
  context_id: z.string().uuid(),
  priority: z.enum(["low", "normal", "high", "urgent", "emergency"]),
  category: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const assignRequestSchema = z.object({
  context_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const changeRequestStatusSchema = z.object({
  context_id: z.string().uuid(),
  status: z.enum(["open", "triaged", "planned", "in_progress", "resolved", "closed", "reopened", "cancelled"]),
  reason: z.string().trim().max(500).optional().nullable(),
  resolution_summary: z.string().trim().max(2000).optional().nullable(),
});

export const reopenRequestSchema = z.object({
  context_id: z.string().uuid(),
  reason: z.string().trim().min(1, "reopen_reason_required").max(500),
});

export const createWorkOrderSchema = z.object({
  context_id: z.string().uuid(),
  property_id: z.string().uuid(),
  building_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  asset_id: z.string().uuid().optional().nullable(),
  ticket_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "title_required").max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent", "emergency"]).default("normal"),
  scheduled_start: z.string().datetime().optional().nullable(),
  scheduled_end: z.string().datetime().optional().nullable(),
  vendor_id: z.string().uuid().optional().nullable(),
  estimated_cost: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).default("RON"),
  access_instructions: z.string().trim().max(1000).optional().nullable(),
});

export const approveWorkOrderSchema = z.object({
  context_id: z.string().uuid(),
  approved_budget: z.number().min(0).optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const issueWorkOrderSchema = z.object({
  context_id: z.string().uuid(),
  vendor_id: z.string().uuid().optional().nullable(),
});

export const holdWorkOrderSchema = z.object({
  context_id: z.string().uuid(),
  hold_reason: z.string().trim().min(1, "hold_reason_required").max(500),
});

export const completeWorkOrderSchema = z.object({
  context_id: z.string().uuid(),
  completion_notes: z.string().trim().min(1, "completion_notes_required").max(2000),
  actual_cost: z.number().min(0).optional().nullable(),
});

export const verifyWorkOrderSchema = z.object({
  context_id: z.string().uuid(),
  verification_notes: z.string().trim().min(1, "verification_notes_required").max(2000),
});

export const closeWorkOrderSchema = z.object({
  context_id: z.string().uuid(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const createMaintenancePayableSchema = z.object({
  context_id: z.string().uuid(),
  purchase_order_id: z.string().uuid().optional().nullable(),
  invoice_ref: z.string().trim().min(1, "invoice_ref_required").max(100),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable(),
  subtotal: z.number().positive("subtotal_must_be_positive"),
  tax_amount: z.number().min(0).default(0),
  currency: z.string().length(3).default("RON"),
  expense_account_id: z.string().uuid().optional().nullable(),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const createRfqSchema = z.object({
  context_id: z.string().uuid(),
  work_order_id: z.string().uuid().optional().nullable(),
  ticket_id: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "title_required").max(200),
  scope_description: z.string().trim().max(4000).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  invited_vendor_ids: z.array(z.string().uuid()).default([]),
});

export const submitQuoteSchema = z.object({
  context_id: z.string().uuid(),
  work_order_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  quote_ref: z.string().trim().min(1).max(100),
  subtotal: z.number().min(0),
  tax_total: z.number().min(0).default(0),
  currency: z.string().length(3).default("RON"),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable(),
  scope_snapshot: z.record(z.string(), z.unknown()).optional().default({}),
  rfq_id: z.string().uuid().optional().nullable(),
});

export const selectQuoteSchema = z.object({
  context_id: z.string().uuid(),
  selection_reason: z.string().trim().min(1, "selection_reason_required").max(500),
});

export const createPurchaseOrderSchema = z.object({
  context_id: z.string().uuid(),
  work_order_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  quote_id: z.string().uuid().optional().nullable(),
  subtotal: z.number().min(0).default(0),
  tax_total: z.number().min(0).default(0),
  currency: z.string().length(3).default("RON"),
  payment_terms: z.string().trim().max(100).default("Net 30"),
});

export const approvePurchaseOrderSchema = z.object({
  context_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const requestPurchaseOrderSchema = z.object({
  context_id: z.string().uuid(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const receivePurchaseOrderSchema = z.object({
  context_id: z.string().uuid(),
});

