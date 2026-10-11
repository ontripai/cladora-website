export function mapBillingRpcError(error: any) {
  const code = error?.code;
  const msg = error?.message || "";
  if (
    code === "42501" ||
    msg.includes("access_denied") ||
    msg.includes("permission_required") ||
    msg.includes("mfa_required") ||
    msg.includes("entitlement_required") ||
    msg.includes("role_denied") ||
    msg.includes("scope_denied")
  ) {
    return { status: 403, body: { error: { code: "FORBIDDEN", message: "Access denied" } } };
  }
  if (code === "40001" || msg.includes("closed") || msg.includes("already_issued") || msg.includes("conflict")) {
    return {
      status: 409,
      body: { error: { code: "CONFLICT", message: msg.includes("closed") ? "Accounting period is closed" : "Conflict" } },
    };
  }
  if (code === "22023" || code === "23514" || msg.includes("invalid") || msg.includes("required") || msg.includes("totals_do_not_match")) {
    return { status: 400, body: { error: { code: "BAD_REQUEST", message: "Invalid billing request" } } };
  }
  if (code === "P0002" || msg.includes("not_found")) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: "Record not found" } } };
  }
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Billing operation failed" } } };
}
