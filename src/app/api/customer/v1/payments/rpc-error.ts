export function mapPaymentsRpcError(error: { code?: string; message?: string }): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  const code = error?.code || "";
  const msg = error?.message || "";

  if (
    code === "42501" ||
    msg.includes("permission_denied") ||
    msg.includes("access_denied") ||
    msg.includes("mfa_required")
  ) {
    return {
      status: 403,
      body: { error: { code: "PAYMENTS_FORBIDDEN", message: "Action forbidden or requires elevation." } },
    };
  }
  if (code === "25000" || msg.includes("closed") || msg.includes("closed_accounting_period")) {
    return {
      status: 409,
      body: { error: { code: "FINANCIAL_PERIOD_CLOSED", message: "Financial period is closed." } },
    };
  }
  if (
    msg.includes("overallocated") ||
    msg.includes("reconciliation_difference_must_be_zero") ||
    msg.includes("reconciliation_unmatched_credit_remaining") ||
    msg.includes("reconciliation_match_approval_pending") ||
    msg.includes("reconciliation_exception_unresolved") ||
    msg.includes("already_reversed") ||
    msg.includes("not_in_allocatable_status")
  ) {
    return {
      status: 409,
      body: { error: { code: "PAYMENTS_CONFLICT", message: msg || "Conflict in payment state." } },
    };
  }
  if (
    code === "22023" ||
    code === "23505" ||
    msg.includes("must_be_positive") ||
    msg.includes("mismatch") ||
    msg.includes("invalid")
  ) {
    return {
      status: 400,
      body: { error: { code: "INVALID_PAYMENTS_REQUEST", message: msg || "Invalid payment request parameters." } },
    };
  }
  return {
    status: 500,
    body: { error: { code: "PAYMENTS_INTERNAL_ERROR", message: "A secure payments error occurred." } },
  };
}
