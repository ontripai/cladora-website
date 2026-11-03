import { z } from "zod";

// The existing HTTP/composer contract counts trimmed UTF-16 code units.
// Zod string max length can count code points; keep this bound explicit and
// field-local so pick()/optional() retain it without changing parsed text.
const trimmedUtf16String = (maximum: number) => z.string().trim().superRefine((value, context) => {
  if (value.length > maximum) context.addIssue({ code: "too_big", origin: "string", maximum, inclusive: true });
});

export const getNoticesQuerySchema = z.object({
  context_id: z.string().uuid(),
  status: z.enum(["draft", "approved", "published", "cancelled"]).optional(),
  source_module: z.enum(["governance", "maintenance", "billing", "utilities", "general"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  id: z.string().uuid().optional(),
});

export const createNoticeDraftSchema = z.object({
  context_id: z.string().uuid(),
  title_ro: trimmedUtf16String(250).min(1),
  body_ro: trimmedUtf16String(20000).min(1),
  title_en: trimmedUtf16String(250).optional(),
  body_en: trimmedUtf16String(20000).optional(),
  title_fa: trimmedUtf16String(250).optional(),
  body_fa: trimmedUtf16String(20000).optional(),
  communication_type: z
    .enum([
      "general_announcement",
      "meeting_convening",
      "reconvened_meeting",
      "resolution_publication",
      "billing_reminder",
      "maintenance_notice",
    ])
    .default("general_announcement"),
  legal_classification: z
    .enum(["statutory_governance", "operational_mandatory", "informational_optional"])
    .default("informational_optional"),
  source_module: z.enum(["governance", "maintenance", "billing", "utilities", "general"]).default("general"),
  source_entity_type: z
    .enum([
      "governance.meeting",
      "governance.resolution",
      "maintenance.work_order",
      "billing.invoice",
      "utilities.period",
      "general",
    ])
    .optional(),
  source_entity_id: z.string().uuid().optional(),
  template_version_id: z.string().uuid().optional(),
  template_params: z.record(z.string(), z.string()).optional(),
  idempotency_key: trimmedUtf16String(100).optional(),
});

export const approveNoticeSchema = z.object({
  context_id: z.string().uuid(),
});

export const publishNoticeSchema = z.object({
  context_id: z.string().uuid(),
});

export const cancelNoticeSchema = z.object({
  context_id: z.string().uuid(),
  reason: trimmedUtf16String(1000).min(1),
});

export const acknowledgeNoticeSchema = z.object({
  context_id: z.string().uuid(),
  method: z.enum(["in_app_signature", "in_app_click", "offline_form"]).default("in_app_click"),
  checksum: trimmedUtf16String(128).optional(),
  notes: trimmedUtf16String(500).optional(),
});

export const recordStatutoryEvidenceSchema = z.object({
  context_id: z.string().uuid(),
  evidence_type: z.enum([
    "noticeboard_posting",
    "nominal_convening_table",
    "registered_postal_letter",
    "declared_content_postal_proof",
    "confirmation_of_receipt",
    "dated_photocopy_display",
    "signed_written_declaration",
    "physical_evidence_reference",
  ]),
  evidence_reference: trimmedUtf16String(250).min(1),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  checksum: trimmedUtf16String(128).optional(),
  document_id: z.string().uuid().optional(),
  notes: trimmedUtf16String(1000).optional(),
});

export const verifyStatutoryEvidenceSchema = z.object({
  context_id: z.string().uuid(),
  decision: z.enum(["verified", "rejected"]),
  rejection_reason: trimmedUtf16String(1000).optional(),
});

export const getDeliveriesQuerySchema = z.object({
  context_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
