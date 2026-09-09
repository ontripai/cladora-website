export const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export function mapCommunicationsRpcError(error: { code?: string; message?: string }): {
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

  // Authorization & MFA errors
  if (
    code === "42501" ||
    msg.includes("permission_denied") ||
    msg.includes("access_denied") ||
    msg.includes("mfa_required") ||
    msg.includes("customer_context_access_denied") ||
    msg.includes("entitlement_module_communications_required") ||
    msg.includes("recipient_record_not_found_for_caller") ||
    msg.includes("dual_control_violation_verifier_cannot_be_capturer")
  ) {
    const isMfa = msg.includes("mfa_required");
    const isDualControl = msg.includes("dual_control_violation");
    return {
      status: 403,
      body: {
        error: {
          code: isMfa
            ? "MFA_REQUIRED"
            : isDualControl
            ? "DUAL_CONTROL_VIOLATION"
            : "FORBIDDEN",
          message: isMfa
            ? "MFA elevation (AAL2) required for this communication action."
            : isDualControl
            ? "Dual-control rule violated: Verifier cannot be the same user who captured the evidence."
            : "Permission denied for this communication context.",
        },
      },
    };
  }

  // Not found
  if (
    msg.includes("notice_not_found") ||
    msg.includes("statutory_evidence_not_found") ||
    msg.includes("template_version_not_found")
  ) {
    return {
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "Requested communication record not found." } },
    };
  }

  // Conflict / Immutability
  if (
    code === "23505" ||
    msg.includes("template_version_is_immutable_once_referenced") ||
    msg.includes("recipient_population_frozen_after_publish") ||
    msg.includes("verified_statutory_evidence_is_immutable") ||
    msg.includes("delivery_attempt_cannot_regress_from_delivered") ||
    msg.includes("cannot_cancel_notice_with_verified_statutory_evidence")
  ) {
    return {
      status: 409,
      body: {
        error: {
          code: "CONFLICT_OR_IMMUTABLE",
          message: "Communication record is frozen or transition violates immutability rules.",
        },
      },
    };
  }

  // Validation / Business rule errors
  if (
    code === "22000" ||
    msg.includes("placeholder_not_allowlisted") ||
    msg.includes("source_entity_mismatch") ||
    msg.includes("notice_must_be_draft_to_approve") ||
    msg.includes("notice_must_be_approved_to_publish") ||
    msg.includes("evidence_already_reviewed") ||
    msg.includes("reconvened_notice_must_reference_reconvened_meeting")
  ) {
    return {
      status: 400,
      body: {
        error: {
          code: "INVALID_COMMUNICATION_OPERATION",
          message: msg.replace(/.*exception:\s*/i, "").replace(/ERROR:\s*/i, ""),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "COMMUNICATIONS_INTERNAL_ERROR",
        message: "An internal communications service error occurred.",
      },
    },
  };
}
