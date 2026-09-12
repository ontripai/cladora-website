import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { z } from "zod";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const MAX_BODY_BYTES = 16 * 1024;

const configureActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_draft"),
    context_id: z.string().uuid(),
    property_id: z.string().uuid().optional().nullable(),
    bank_account_id: z.string().uuid().optional().nullable(),
    association_legal_name: z.string().trim().min(3).max(150),
    bank_name: z.string().trim().min(2).max(100),
    currency: z.string().trim().length(3).default("RON"),
    iban: z.string().trim().min(15).max(34),
  }),
  z.object({
    action: z.literal("submit_approval"),
    context_id: z.string().uuid(),
    beneficiary_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("approve"),
    context_id: z.string().uuid(),
    beneficiary_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("reject"),
    context_id: z.string().uuid(),
    beneficiary_id: z.string().uuid(),
    rejection_reason: z.string().trim().max(250).optional(),
  }),
  z.object({
    action: z.literal("revoke"),
    context_id: z.string().uuid(),
    beneficiary_id: z.string().uuid(),
    revocation_reason: z.string().trim().max(250).optional(),
  }),
  z.object({
    action: z.literal("configure_policy"),
    context_id: z.string().uuid(),
    strategy: z.enum(["oldest_due_first", "current_period_first", "invoice_selected", "proportional"]).default("oldest_due_first"),
    penalties_priority: z.enum(["penalties_first", "principal_first"]).default("principal_first"),
    min_partial_amount: z.coerce.number().positive().default(1.00),
    overpayment_handling: z.enum(["credit_balance", "reject"]).default("credit_balance"),
    credit_balance_handling: z.enum(["apply_to_next", "hold"]).default("apply_to_next"),
    approval_reference: z.string().trim().max(100).optional(),
  }),
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contextId = searchParams.get("context_id");
  const propertyId = searchParams.get("property_id");

  if (!contextId) {
    return NextResponse.json(
      { error: { code: "MISSING_PARAMETER", message: "context_id parameter is required" } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("customer_api")
    .rpc("list_payment_configuration_v1" as any, {
      p_context_id: contextId,
      p_property_id: propertyId || null,
    });

  if (error) {
    const isAuth = error.code === "42501" || error.message?.includes("denied") || error.message?.includes("required");
    return NextResponse.json(
      { error: { code: isAuth ? "UNAUTHORIZED" : "QUERY_FAILED", message: error.message } },
      { status: isAuth ? 403 : 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { status: 200, headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Untrusted mutation origin" } },
      { status: 403, headers: HEADERS }
    );
  }

  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" } },
      { status: 415, headers: HEADERS }
    );
  }

  const { data: json, errorResponse } = await parseJsonWithLimit(request, MAX_BODY_BYTES);
  if (errorResponse || !json) {
    return errorResponse ?? NextResponse.json(
      { error: { code: "INVALID_REQUEST_BODY", message: "Invalid JSON payload" } },
      { status: 400, headers: HEADERS }
    );
  }

  const parsed = configureActionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid action parameters", details: parsed.error.issues } },
      { status: 422, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const payload = parsed.data;

  let rpcName: string;
  let rpcArgs: Record<string, any>;

  switch (payload.action) {
    case "create_draft":
      rpcName = "create_beneficiary_account_draft_v1";
      rpcArgs = {
        p_context_id: payload.context_id,
        p_property_id: payload.property_id || null,
        p_bank_account_id: payload.bank_account_id || null,
        p_association_legal_name: payload.association_legal_name,
        p_bank_name: payload.bank_name,
        p_currency: payload.currency,
        p_iban: payload.iban,
      };
      break;

    case "submit_approval":
      rpcName = "submit_beneficiary_account_for_approval_v1";
      rpcArgs = {
        p_context_id: payload.context_id,
        p_beneficiary_id: payload.beneficiary_id,
      };
      break;

    case "approve":
      rpcName = "approve_beneficiary_account_v1";
      rpcArgs = {
        p_context_id: payload.context_id,
        p_beneficiary_id: payload.beneficiary_id,
      };
      break;

    case "reject":
      rpcName = "reject_beneficiary_account_v1";
      rpcArgs = {
        p_context_id: payload.context_id,
        p_beneficiary_id: payload.beneficiary_id,
        p_rejection_reason: payload.rejection_reason || null,
      };
      break;

    case "revoke":
      rpcName = "revoke_beneficiary_account_v1";
      rpcArgs = {
        p_context_id: payload.context_id,
        p_beneficiary_id: payload.beneficiary_id,
        p_revocation_reason: payload.revocation_reason || null,
      };
      break;

    case "configure_policy":
      rpcName = "configure_payment_allocation_policy_v1";
      rpcArgs = {
        p_context_id: payload.context_id,
        p_strategy: payload.strategy,
        p_penalties_priority: payload.penalties_priority,
        p_min_partial_amount: payload.min_partial_amount,
        p_overpayment_handling: payload.overpayment_handling,
        p_credit_balance_handling: payload.credit_balance_handling,
        p_approval_reference: payload.approval_reference || null,
      };
      break;
  }

  const { data, error } = await supabase
    .schema("customer_api")
    .rpc(rpcName as any, rpcArgs);

  if (error) {
    const isAuth = error.code === "42501" || error.message?.includes("denied") || error.message?.includes("required");
    const isValidation = error.code === "22023" || error.message?.includes("invalid");
    return NextResponse.json(
      { error: { code: isAuth ? "FORBIDDEN" : isValidation ? "BAD_REQUEST" : "OPERATION_FAILED", message: error.message } },
      { status: isAuth ? 403 : isValidation ? 400 : 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { status: 200, headers: HEADERS });
}
