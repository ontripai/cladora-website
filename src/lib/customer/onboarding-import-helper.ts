export const ONBOARDING_HEADERS = { "Cache-Control": "no-store, private", Pragma: "no-cache", Vary: "Cookie" };
export function mapOnboardingError(error: { message?: string; code?: string }) {
  const message = (error.message ?? "").toLowerCase();
  if (error.code === "42501" || message.includes("access_denied") || message.includes("mfa_required")) return { status: 403, code: message.includes("mfa") ? "MFA_REQUIRED" : "FORBIDDEN" };
  if (error.code === "P0002" || message.includes("not_found")) return { status: 404, code: "IMPORT_NOT_FOUND" };
  if (error.code === "23505" || message.includes("concurrent")) return { status: 409, code: "IMPORT_CONFLICT" };
  if (message.includes("deferred_xlsx")) return { status: 422, code: "DEFERRED_XLSX_IMPORT_UNTIL_MALWARE_SCANNER" };
  if (message.includes("dual_control")) return { status: 403, code: "DUAL_CONTROL_REQUIRED" };
  if (message.includes("opening_balance_rehearsal_not_zero")) return { status: 422, code: "OPENING_BALANCE_NOT_ZERO" };
  if (message.includes("setup_rehearsal_required")) return { status: 409, code: "SETUP_REHEARSAL_REQUIRED" };
  if (message.includes("setup_approval_required") || message.includes("setup_invalid_state")) return { status: 409, code: "SETUP_STATE_CONFLICT" };
  if (message.includes("setup_run_not_found")) return { status: 404, code: "SETUP_NOT_FOUND" };
  if (message.includes("setup_")) return { status: 422, code: "SETUP_REQUEST_REJECTED" };
  return { status: 400, code: "IMPORT_REQUEST_REJECTED" };
}
