export const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export type DetectedMimeResult =
  | { success: true; mime: string }
  | { success: false; reason: string };

/**
 * Inspect magic bytes of the initial chunk of a file to identify MIME type
 * and reject active content (SVG, HTML, executables, scripts).
 */
export function inspectMagicBytes(buffer: Buffer): DetectedMimeResult {
  if (!buffer || buffer.length === 0) {
    return { success: false, reason: "zero_byte_content_rejected" };
  }

  // Active Content & Executable Detection
  // Executables: Windows PE (MZ), Linux ELF, Shebang
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { success: false, reason: "executable_binary_rejected" };
  }
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { success: false, reason: "executable_binary_rejected" };
  }
  if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    return { success: false, reason: "executable_script_rejected" };
  }

  // String preview for script/markup inspection (first 1024 bytes)
  const headerText = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("utf8").toLowerCase();
  if (headerText.includes("<svg") || headerText.includes("xmlns=\"http://www.w3.org/2000/svg\"")) {
    return { success: false, reason: "svg_active_content_rejected" };
  }
  if (headerText.includes("<html") || headerText.includes("<!doctype html") || headerText.includes("<script")) {
    return { success: false, reason: "html_active_content_rejected" };
  }

  // PDF: %PDF-
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { success: true, mime: "application/pdf" };
  }

  // JPEG: \xFF\xD8\xFF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { success: true, mime: "image/jpeg" };
  }

  // PNG: \x89PNG\r\n\x1a\n
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { success: true, mime: "image/png" };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { success: true, mime: "image/webp" };
  }

  // Office Open XML (DOCX / XLSX) or ZIP format: PK\x03\x04
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    // OpenXML documents are ZIP archives with [Content_Types].xml
    // Inspect up to 4096 bytes for OpenXML markers
    const zipScan = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("latin1");
    if (zipScan.includes("word/") || zipScan.includes("[Content_Types].xml")) {
      return { success: true, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    }
    if (zipScan.includes("xl/") || zipScan.includes("worksheets/")) {
      return { success: true, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }
    // Generic archive files are not allowed without specific inspection
    return { success: false, reason: "unsupported_archive_format_rejected" };
  }

  // Legacy MS Office (DOC, XLS): OLE Compound Document \xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return { success: true, mime: "application/msword" };
  }

  // Plain text inspection: Valid UTF-8, no zero bytes
  let isText = true;
  for (let i = 0; i < Math.min(buffer.length, 512); i++) {
    if (buffer[i] === 0x00) {
      isText = false;
      break;
    }
  }
  if (isText) {
    return { success: true, mime: "text/plain" };
  }

  return { success: false, reason: "unknown_or_unsupported_file_signature" };
}

export function mapDocumentsRpcError(error: { code?: string; message?: string }): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  const code = error?.code || "";
  const msg = error?.message || "";

  // Authentication errors
  if (
    (code === "42501" || code === "401") &&
    (msg.includes("authentication_required") || msg.includes("UNAUTHORIZED"))
  ) {
    return {
      status: 401,
      body: { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
    };
  }

  // MFA & Dual-Control violations
  if (msg.includes("mfa_aal2_required") || msg.includes("admin_inspection_aal2_required")) {
    return {
      status: 403,
      body: { error: { code: "MFA_REQUIRED", message: "MFA elevation (AAL2) required for this privileged document operation." } },
    };
  }
  if (msg.includes("dual_control_creator_cannot_verify_evidence")) {
    return {
      status: 403,
      body: { error: { code: "DUAL_CONTROL_VIOLATION", message: "Dual control enforced: Document creator cannot verify own document as evidence." } },
    };
  }
  if (msg.includes("dual_control_requester_cannot_approve_disposition")) {
    return {
      status: 403,
      body: { error: { code: "DUAL_CONTROL_VIOLATION", message: "Dual control enforced: Requester cannot approve own document disposition request." } },
    };
  }

  // Authorization & Permissions
  if (
    code === "42501" ||
    msg.includes("permission_denied") ||
    msg.includes("customer_context_access_denied") ||
    msg.includes("documents_module_not_entitled") ||
    msg.includes("upload_intent_user_mismatch") ||
    msg.includes("admin_inspection_permission_denied")
  ) {
    return {
      status: 403,
      body: { error: { code: "FORBIDDEN", message: "Permission denied for this document context." } },
    };
  }

  // Fail-Closed Scanner Statuses
  if (msg.includes("deferred_scanner_cannot_normal_download")) {
    return {
      status: 403,
      body: { error: { code: "SCANNER_DEFERRED_DOWNLOAD_FORBIDDEN", message: "This file has not undergone malware scanning (status: deferred). Normal download is forbidden." } },
    };
  }
  if (msg.includes("quarantined_file_cannot_download")) {
    return {
      status: 403,
      body: { error: { code: "FILE_QUARANTINED", message: "This file has been quarantined by security scanners and cannot be accessed." } },
    };
  }
  if (msg.includes("pending_scanner_cannot_download")) {
    return {
      status: 403,
      body: { error: { code: "SCANNING_PENDING", message: "Malware scan in progress. File is temporarily unavailable." } },
    };
  }
  if (msg.includes("verified_evidence_requires_clean_scanner_status")) {
    return {
      status: 400,
      body: { error: { code: "SCANNER_CLEAN_REQUIRED", message: "Document cannot be verified as statutory legal evidence without a verified clean malware scan." } },
    };
  }
  if (msg.includes("deferred_scanner_cannot_attach_authoritative_evidence")) {
    return {
      status: 400,
      body: { error: { code: "AUTHORITATIVE_ATTACHMENT_FORBIDDEN", message: "Unscanned or deferred document cannot be linked as authoritative cross-module evidence." } },
    };
  }

  // Legal Hold overrides
  if (msg.includes("document_under_legal_hold") || msg.includes("legal_hold_blocks_disposition")) {
    return {
      status: 409,
      body: { error: { code: "LEGAL_HOLD_ACTIVE", message: "Document is frozen under an active legal hold. Retention disposition and mutation are strictly blocked." } },
    };
  }

  // Replay & Checksum integrity
  if (msg.includes("upload_intent_already_consumed") || msg.includes("intent_attempt_limit_exceeded")) {
    return {
      status: 409,
      body: { error: { code: "INTENT_ALREADY_CONSUMED", message: "Upload intent has already been consumed or maximum attempts reached. Please request a new intent." } },
    };
  }
  if (msg.includes("expired_intent_cannot_finalize") || msg.includes("upload_intent_expired")) {
    return {
      status: 410,
      body: { error: { code: "INTENT_EXPIRED", message: "Upload intent has expired. Please initiate a new upload." } },
    };
  }
  if (msg.includes("invalid_server_checksum") || msg.includes("invalid_uploaded_byte_size")) {
    return {
      status: 400,
      body: { error: { code: "CHECKSUM_MISMATCH", message: "Server-calculated content hash or file size does not match expected parameters." } },
    };
  }

  // Immutability
  if (
    msg.includes("document_versions_are_immutable") ||
    msg.includes("verified_evidence_is_immutable") ||
    msg.includes("retention_assignment_is_immutable") ||
    msg.includes("historical_retention_snapshot_immutable") ||
    msg.includes("released_legal_hold_is_immutable")
  ) {
    return {
      status: 409,
      body: { error: { code: "IMMUTABLE_RECORD", message: "This document record or version is immutable and cannot be updated or deleted." } },
    };
  }

  // Not Found
  if (msg.includes("document_not_found") || msg.includes("document_version_not_found") || msg.includes("upload_intent_not_found")) {
    return {
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "The requested document, version, or intent was not found." } },
    };
  }

  // Validation
  if (
    msg.includes("zero_byte_upload_rejected") ||
    msg.includes("disallowed_file_extension") ||
    msg.includes("unsupported_document_mime_type") ||
    msg.includes("file_size_limit_exceeded") ||
    msg.includes("document_retention_policy_unconfigured") ||
    msg.includes("retention_policy_version_overlap_rejected") ||
    msg.includes("document_link_cross_tenant_or_missing") ||
    msg.includes("document_link_type_invalid")
  ) {
    return {
      status: 400,
      body: { error: { code: "INVALID_REQUEST", message: msg } },
    };
  }

  return {
    status: 500,
    body: { error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." } },
  };
}
