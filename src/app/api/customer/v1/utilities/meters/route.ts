import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapUtilitiesRpcError } from "@/lib/customer/utilities-api-helper";
import { createMeterSchema } from "@/lib/customer/utilities-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function GET(request: NextRequest) {
  const contextId = request.nextUrl.searchParams.get("context_id");
  if (!contextId) {
    return NextResponse.json({ error: { code: "MISSING_CONTEXT_ID" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const query = request.nextUrl.searchParams.get("query") || null;
  const status = request.nextUrl.searchParams.get("status") || null;
  const service = request.nextUrl.searchParams.get("service") || null;
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 25), 1), 100);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") || 0), 0);

  const { data, error } = await supabase.schema("customer_api").rpc("get_utilities_v1", {
    p_context_id: contextId,
    p_view: "meters",
    p_query: query,
    p_status: status,
    p_service: service,
    p_from: null,
    p_to: null,
    p_limit: limit,
    p_offset: offset,
    p_id: null,
  });

  if (error) {
    const { status: s, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status: s, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
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

  const parsed = createMeterSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("create_meter_v1", {
    p_context_id: p.context_id,
    p_property_id: p.property_id,
    p_building_id: p.building_id ?? null,
    p_unit_id: p.unit_id ?? null,
    p_service_type: p.service_type,
    p_scope: p.scope,
    p_serial_number: p.serial_number,
    p_unit_code: p.unit_code,
    p_multiplier: p.multiplier,
    p_initial_reading: p.initial_reading,
    p_installed_on: p.installed_on ?? null,
    p_calibration_expires_on: p.calibration_expires_on ?? null,
    p_parent_meter_id: p.parent_meter_id ?? null,
    p_decimal_precision: p.decimal_precision,
  });

  if (error) {
    const { status: s, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status: s, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
