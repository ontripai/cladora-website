import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { createBillRequestSchema, queryBillingSchema } from "@/lib/customer/billing-schema";

const HEADERS = {
  'Cache-Control':'no-store, private',
  Pragma: "no-cache",
  Vary: "Cookie",
};

const MAX_BODY_BYTES = 64 * 1024; // 64 KB limit for bill creation with line items

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

export async function GET(request: NextRequest) {
  const parsed = queryBillingSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_BILLING_QUERY" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error: queryError } = await supabase.schema("customer_api").rpc("get_billing_v1", {
    p_context_id: p.context_id,
    p_query: p.query ?? null,
    p_status: p.status ?? null,
    p_from: p.from ?? null,
    p_to: p.to ?? null,
    p_limit: p.limit,
    p_offset: p.offset,
    p_invoice_id: p.invoice_id ?? null,
  });

  if (queryError) {
    const { status, body } = mapBillingRpcError(queryError);
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

  const parsed = createBillRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_PAYLOAD", details: parsed.error.format() } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const b = parsed.data;
  const { data, error: rpcError } = await supabase.schema("customer_api").rpc("create_bill_v1", {
    p_context_id: b.context_id,
    p_property_id: b.property_id,
    p_unit_id: b.unit_id,
    p_liable_party_id: b.liable_party_id,
    p_period_start: b.period_start,
    p_period_end: b.period_end,
    p_due_on: b.due_on,
    p_currency: b.currency,
    p_lines: b.lines,
    p_idempotency_key: b.idempotency_key ?? null,
  });

  if (rpcError) {
    const { status, body } = mapBillingRpcError(rpcError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
