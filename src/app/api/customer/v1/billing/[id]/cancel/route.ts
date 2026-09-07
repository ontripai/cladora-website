import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { cancelBillRequestSchema } from "@/lib/customer/billing-schema";
import { mapBillingRpcError } from "../../route";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const MAX_BODY_BYTES = 10 * 1024;

export async function POST(
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

  const parsed = cancelBillRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_PAYLOAD", details: parsed.error.format() } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const b = parsed.data;
  const { data, error: rpcError } = await supabase.schema("customer_api").rpc("cancel_bill_v1", {
    p_context_id: b.context_id,
    p_invoice_id: id,
    p_reason: b.reason ?? null,
  });

  if (rpcError) {
    const { status, body } = mapBillingRpcError(rpcError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
