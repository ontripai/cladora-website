import { z } from "zod";

export const ALLOWED_DOCUMENT_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const FORBIDDEN_DOCUMENT_EXTENSIONS = [
  "exe", "sh", "bat", "cmd", "js", "mjs", "ts", "html", "htm", "svg", "php", "py", "zip", "tar", "gz", "rar",
] as const;

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const createUploadIntentSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  document_id: z.string().uuid().optional().nullable(),
  filename: z.string().min(1).max(255).refine((fn) => {
    const ext = fn.split(".").pop()?.toLowerCase() || "";
    return !FORBIDDEN_DOCUMENT_EXTENSIONS.includes(ext as any);
  }, "Disallowed active-content or executable file extension"),
  declared_mime: z.enum(ALLOWED_DOCUMENT_MIMES, {
    message: "Unsupported document MIME type",
  }),
  size_bytes: z.number().int().positive().max(MAX_DOCUMENT_FILE_SIZE_BYTES, "File size limit exceeded (max 20MB)"),
  idempotency_key: z.string().max(128).optional().nullable(),
});

export const finalizeUploadSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  intent_id: z.string().uuid("Invalid upload intent UUID"),
  computed_sha256: z.string().length(64, "SHA-256 must be exactly 64 hexadecimal characters").regex(/^[a-f0-9]{64}$/i),
  actual_size_bytes: z.number().int().positive().max(MAX_DOCUMENT_FILE_SIZE_BYTES),
  detected_mime: z.enum(ALLOWED_DOCUMENT_MIMES),
  title: z.string().min(1).max(255).optional().nullable(),
  document_type: z.string().min(1).max(64).default("general"),
  classification: z.enum(["public", "internal", "confidential", "restricted"]).default("internal"),
  property_id: z.string().uuid().optional().nullable(),
});

export const authorizeDownloadSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  version_id: z.string().uuid().optional().nullable(),
  admin_inspection: z.boolean().default(false),
});

export const verifyEvidenceSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  evidence_type: z.string().min(2).max(64).default("statutory_proof"),
  decision: z.enum(["verified", "rejected"]),
  notes: z.string().max(1000).optional().nullable(),
});

export const placeLegalHoldSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  reason: z.string().min(5, "Legal hold reason must be at least 5 characters").max(500),
});

export const releaseLegalHoldSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  release_reason: z.string().min(5, "Release reason must be at least 5 characters").max(500),
});

export const requestDispositionSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  reason: z.string().min(5, "Disposition request reason must be at least 5 characters").max(500),
});

export const approveDispositionSchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  decision: z.enum(["approved", "rejected"]),
  rejection_reason: z.string().max(500).optional().nullable(),
});

export const assignRetentionPolicySchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  policy_code: z.string().min(2).max(64),
  basis: z.string().max(255).default("standard_statutory"),
});

export const linkDocumentEntitySchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  entity_type: z.string().min(3).max(64),
  entity_id: z.string().uuid("Invalid entity UUID"),
  relation_type: z.enum(["evidence", "attachment", "authoritative", "statutory_proof"]).default("evidence"),
});

export const listDocumentsQuerySchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  status: z.string().optional().nullable(),
  classification: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  query: z.string().optional().nullable(),
});
