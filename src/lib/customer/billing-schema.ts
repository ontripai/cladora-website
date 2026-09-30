import { z } from "zod";

// Match PostgreSQL identifiers, including deterministic fixture UUIDs.
export const uuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const billingLineItemSchema = z.object({
  description: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().positive(),
  tax_rate: z.coerce.number().min(0).default(0),
  category_id: uuidSchema.optional().nullable(),
});

export const createBillRequestSchema = z.object({
  context_id: uuidSchema,
  property_id: uuidSchema,
  unit_id: uuidSchema,
  liable_party_id: uuidSchema,
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  currency: z.string().trim().length(3).default("RON"),
  lines: z.array(billingLineItemSchema).min(1),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const updateBillRequestSchema = z.object({
  context_id: uuidSchema,
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable(),
  liable_party_id: uuidSchema.optional().nullable(),
  lines: z.array(billingLineItemSchema).min(1).optional().nullable(),
});

export const issueBillRequestSchema = z.object({
  context_id: uuidSchema,
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional().nullable(),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const cancelBillRequestSchema = z.object({
  context_id: uuidSchema,
  reason: z.string().trim().max(255).optional().nullable(),
});

export const queryBillingSchema = z.object({
  context_id: uuidSchema,
  query: z.string().trim().max(120).optional(),
  status: z.enum(["draft", "issued", "partially_paid", "paid", "void", "credited", "overdue"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  invoice_id: uuidSchema.optional(),
});
