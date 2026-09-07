import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { queryPaymentsSchema, recordPaymentRequestSchema } from "@/lib/customer/payments-schema";

const HEADERS = {
  'Cache-Control':'no-store, private',
  Pragma: "no-cache",
  Vary: "Cookie",
};

const MAX_BODY_BYTES = 10 * 1024;

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

export async function GET(request: NextRequest) {
  const parsed = queryPaymentsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_PAYMENTS_QUERY" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error: rpcError } = await supabase.schema("customer_api").rpc("get_payments_v1", {
    p_context_id: p.context_id,
    p_view: p.view,
    p_query: p.query ?? null,
    p_status: p.status ?? null,
    p_from: p.from ?? null,
    p_to: p.to ?? null,
    p_limit: p.limit,
    p_offset: p.offset,
    p_id: p.id ?? null,
  });

  if (rpcError) {
    const { status, body } = mapPaymentsRpcError(rpcError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: "UNTRUSTED_ORIGIN" } }, { status: 403, headers: HEADERS });
  }

  const contentType = request.headers.get("content-type");
  if (!isApplicationJson(contentType)) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: HEADERS });
  }

  const { data: rawBody, errorResponse } = await parseJsonWithLimit(request, MAX_BODY_BYTES);
  if (errorResponse) return errorResponse;

  const parsed = recordPaymentRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_PAYLOAD", details: parsed.error.format() } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const b = parsed.data;
  const { data, error: rpcError } = await supabase.schema("customer_api").rpc("record_payment_v1", {
    p_context_id: b.context_id,
    p_property_id: b.property_id,
    p_amount: b.amount,
    p_currency: b.currency,
    p_paid_at: b.paid_at ?? new Date().toISOString(),
    p_unit_id: b.unit_id ?? null,
    p_payer_party_id: b.payer_party_id ?? null,
    p_method: b.method,
    p_provider_ref: b.provider_ref ?? null,
    p_description: b.description ?? null,
    p_idempotency_key: b.idempotency_key ?? null,
  });

  if (rpcError) {
    const { status, body } = mapPaymentsRpcError(rpcError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
