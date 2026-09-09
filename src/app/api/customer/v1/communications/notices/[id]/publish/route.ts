import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapCommunicationsRpcError } from "@/lib/customer/communications-api-helper";
import { publishNoticeSchema } from "@/lib/customer/communications-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } }, { status: 403, headers: HEADERS });
  }
  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "application/json required" } }, { status: 415, headers: HEADERS });
  }

  const { id: noticeId } = await params;
  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body" } }, { status: 400, headers: HEADERS });
  }

  const parsed = publishNoticeSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401, headers: HEADERS });
  }

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("publish_notice_v1", {
    p_context_id: parsed.data.context_id,
    p_notice_id: noticeId,
  });

  if (error) {
    const { status, body } = mapCommunicationsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
