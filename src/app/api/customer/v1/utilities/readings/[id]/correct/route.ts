import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapUtilitiesRpcError } from "@/lib/customer/utilities-api-helper";
import { correctReadingSchema } from "@/lib/customer/utilities-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } }, { status: 403, headers: HEADERS });
  }
  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "application/json required" } }, { status: 415, headers: HEADERS });
  }

  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 10 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid body" } }, { status: 400, headers: HEADERS });
  }

  const parsed = correctReadingSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("correct_reading_v1", {
    p_context_id: p.context_id,
    p_reading_id: id,
    p_corrected_value: p.corrected_value,
    p_correction_reason: p.correction_reason,
  });

  if (error) {
    const { status: s, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status: s, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
