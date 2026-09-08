export const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export function mapMaintenanceRpcError(error: { code?: string; message?: string }): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  const code = error?.code || "";
  const msg = error?.message || "";

  if (
    code === "42501" ||
    msg.includes("permission_denied") ||
    msg.includes("access_denied") ||
    msg.includes("mfa_required") ||
    msg.includes("maintenance_permission_required") ||
    msg.includes("procurement_permission_required") ||
    msg.includes("procurement_role_denied") ||
    msg.includes("maintenance_entitlement_required") ||
    msg.includes("procurement_entitlement_required") ||
    msg.includes("creator_cannot_self_approve_dual_control") ||
    msg.includes("same_user_cannot_perform_dual_approval_step") ||
    msg.includes("platform_auditor_denied") ||
    msg.includes("scope_violation") ||
    msg.includes("customer_context_access_denied")
  ) {
    const isMfa = msg.includes("mfa_required");
    const isDual = msg.includes("creator_cannot_self_approve_dual_control") || msg.includes("same_user_cannot_perform_dual_approval_step");
    return {
      status: 403,
      body: {
        error: {
          code: isMfa ? "MFA_REQUIRED" : isDual ? "DUAL_CONTROL_VIOLATION" : "FORBIDDEN",
          message: isMfa ? "MFA elevation required." : isDual ? "Dual control requires an independent authorized approver." : "Action forbidden or requires elevation.",
        },
      },
    };
  }

  if ((code === "42501" || code === "401") && (msg.includes("authentication_required") || msg.includes("UNAUTHORIZED"))) {
    return {
      status: 401,
      body: { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
    };
  }

  if (
    code === "25000" ||
    msg.includes("closed") ||
    msg.includes("closed_accounting_period") ||
    msg.includes("Cannot modify journal")
  ) {
    return {
      status: 409,
      body: { error: { code: "FINANCIAL_PERIOD_CLOSED", message: "Accounting period is closed." } },
    };
  }

  if (
    msg.includes("purchase_order_must_be_draft_to_request") ||
    msg.includes("purchase_order_must_be_requested_to_approve") ||
    msg.includes("purchase_order_must_be_approved_to_issue") ||
    msg.includes("purchase_order_must_be_ordered_to_receive") ||
    msg.includes("invalid_purchase_order_transition") ||
    msg.includes("approved_purchase_order_is_immutable") ||
    msg.includes("duplicate_vendor_invoice_reference") ||
    msg.includes("payable_already_exists_for_work_order") ||
    msg.includes("work_order_must_be_verified_for_payable") ||
    msg.includes("quote_has_expired") ||
    msg.includes("invalid_work_order_transition") ||
    msg.includes("final_work_order_is_immutable") ||
    msg.includes("verified_work_order_is_terminal")
  ) {
    return {
      status: 409,
      body: { error: { code: "MAINTENANCE_CONFLICT", message: msg || "Lifecycle or entity conflict." } },
    };
  }

  if (code === "P0002" || msg.includes("not_found")) {
    return {
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "Requested resource not found." } },
    };
  }

  if (
    code === "22004" ||
    code === "22003" ||
    code === "22023" ||
    code === "23505" ||
    code === "23503" ||
    msg.includes("required") ||
    msg.includes("invalid") ||
    msg.includes("positive")
  ) {
    return {
      status: 400,
      body: { error: { code: "INVALID_REQUEST", message: msg || "Invalid input parameters." } },
    };
  }

  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "Internal maintenance service error." } },
  };
}
