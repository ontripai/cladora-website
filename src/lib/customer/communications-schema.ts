import { z } from "zod";

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
  title_ro: z.string().trim().min(1).max(250),
  body_ro: z.string().trim().min(1).max(20000),
  title_en: z.string().trim().max(250).optional(),
  body_en: z.string().trim().max(20000).optional(),
  title_fa: z.string().trim().max(250).optional(),
  body_fa: z.string().trim().max(20000).optional(),
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
  idempotency_key: z.string().trim().max(100).optional(),
});

export const approveNoticeSchema = z.object({
  context_id: z.string().uuid(),
});

export const publishNoticeSchema = z.object({
  context_id: z.string().uuid(),
});

export const cancelNoticeSchema = z.object({
  context_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
});

export const acknowledgeNoticeSchema = z.object({
  context_id: z.string().uuid(),
  method: z.enum(["in_app_signature", "in_app_click", "offline_form"]).default("in_app_click"),
  checksum: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(500).optional(),
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
  evidence_reference: z.string().trim().min(1).max(250),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  checksum: z.string().trim().max(128).optional(),
  document_id: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const verifyStatutoryEvidenceSchema = z.object({
  context_id: z.string().uuid(),
  decision: z.enum(["verified", "rejected"]),
  rejection_reason: z.string().trim().max(1000).optional(),
});

export const getDeliveriesQuerySchema = z.object({
  context_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
