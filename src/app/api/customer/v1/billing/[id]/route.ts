import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { updateBillRequestSchema } from "@/lib/customer/billing-schema";
import { mapBillingRpcError } from "../route";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const MAX_BODY_BYTES = 64 * 1024;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contextId = request.nextUrl.searchParams.get("context_id");
  if (!contextId) {
    return NextResponse.json({ error: { code: "CONTEXT_REQUIRED" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const { data, error: queryError } = await supabase.schema("customer_api").rpc("get_billing_v1", {
    p_context_id: contextId,
    p_invoice_id: id,
    p_limit: 1,
    p_offset: 0,
  });

  if (queryError) {
    const { status, body } = mapBillingRpcError(queryError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  const res = data as any;
  const invoice = res?.invoices?.[0] ?? null;
  if (!invoice) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404, headers: HEADERS });
  }

  return NextResponse.json({ ...invoice, lines: res?.lines ?? [], journal: res?.journal ?? null }, { headers: HEADERS });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: "UNTRUSTED_ORIGIN" } }, { status: 403, headers: HEADERS });
  }

  const contentType = request.headers.get("content-type");
  if (!isApplicationJson(contentType)) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: HEADERS });
  }

  const { id } = await params;
  const { data: rawBody, errorResponse } = await parseJsonWithLimit(request, MAX_BODY_BYTES);
  if (errorResponse) return errorResponse;

  const parsed = updateBillRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_PAYLOAD", details: parsed.error.format() } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const b = parsed.data;
  const { data, error: rpcError } = await supabase.schema("customer_api").rpc("update_bill_v1", {
    p_context_id: b.context_id,
    p_invoice_id: id,
    p_due_on: b.due_on ?? null,
    p_period_start: b.period_start ?? null,
    p_period_end: b.period_end ?? null,
    p_liable_party_id: b.liable_party_id ?? null,
    p_lines: b.lines ?? null,
  });

  if (rpcError) {
    const { status, body } = mapBillingRpcError(rpcError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
