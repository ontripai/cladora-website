import { NextResponse } from "next/server";

export const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export function mapUtilitiesRpcError(error: { code?: string; message?: string }): {
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
    msg.includes("utility_entitlement_required") ||
    msg.includes("utility_role_denied")
  ) {
    return {
      status: 403,
      body: { error: { code: "UTILITY_FORBIDDEN", message: "Action forbidden or requires elevation." } },
    };
  }
  if (code === "25000" || msg.includes("closed") || msg.includes("closed_accounting_period")) {
    return {
      status: 409,
      body: { error: { code: "FINANCIAL_PERIOD_CLOSED", message: "Accounting period is closed." } },
    };
  }
  if (
    msg.includes("duplicate_meter_serial") ||
    msg.includes("consumption_already_billed") ||
    msg.includes("meter_already_inactive")
  ) {
    return {
      status: 409,
      body: { error: { code: "UTILITY_CONFLICT", message: msg || "Conflict in meter or consumption state." } },
    };
  }
  if (
    code === "22023" ||
    code === "23505" ||
    code === "23503" ||
    msg.includes("out_of_order") ||
    msg.includes("negative") ||
    msg.includes("invalid") ||
    msg.includes("start_reading_must_precede_end")
  ) {
    return {
      status: 400,
      body: { error: { code: "INVALID_UTILITY_REQUEST", message: msg || "Invalid utility request parameters." } },
    };
  }
  return {
    status: 500,
    body: { error: { code: "UTILITY_INTERNAL_ERROR", message: "An unexpected utility error occurred." } },
  };
}
