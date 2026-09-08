import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapUtilitiesRpcError } from "@/lib/customer/utilities-api-helper";
import { updateMeterSchema } from "@/lib/customer/utilities-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contextId = request.nextUrl.searchParams.get("context_id");
  if (!contextId) {
    return NextResponse.json({ error: { code: "MISSING_CONTEXT_ID" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const { data, error } = await supabase.schema("customer_api").rpc("get_utilities_v1", {
    p_context_id: contextId,
    p_view: "meters",
    p_query: null,
    p_status: null,
    p_service: null,
    p_from: null,
    p_to: null,
    p_limit: 1,
    p_offset: 0,
    p_id: id,
  });

  if (error) {
    const { status: s, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status: s, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = updateMeterSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("update_meter_v1", {
    p_context_id: p.context_id,
    p_meter_id: id,
    p_calibration_expires_on: p.calibration_expires_on ?? null,
    p_multiplier: p.multiplier ?? null,
    p_unit_code: p.unit_code ?? null,
    p_decimal_precision: p.decimal_precision ?? null,
  });

  if (error) {
    const { status: s, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status: s, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
