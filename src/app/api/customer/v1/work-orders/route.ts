import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapMaintenanceRpcError } from "@/lib/customer/maintenance-api-helper";
import { createWorkOrderSchema } from "@/lib/customer/maintenance-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function GET(request: NextRequest) {
  const contextId = request.nextUrl.searchParams.get("context_id");
  if (!contextId) {
    return NextResponse.json({ error: { code: "MISSING_CONTEXT_ID" } }, { status: 400, headers: HEADERS });
  }

  const status = request.nextUrl.searchParams.get("status") || null;
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0", 10);

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("list_work_orders_v1", {
    p_context_id: contextId,
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    const { status: httpStatus, body } = mapMaintenanceRpcError(error);
    return NextResponse.json(body, { status: httpStatus, headers: HEADERS });
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

  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 20 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid body" } }, { status: 400, headers: HEADERS });
  }

  const parsed = createWorkOrderSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("create_work_order_v1", {
    p_context_id: p.context_id,
    p_property_id: p.property_id,
    p_building_id: p.building_id ?? null,
    p_unit_id: p.unit_id ?? null,
    p_asset_id: p.asset_id ?? null,
    p_ticket_id: p.ticket_id ?? null,
    p_title: p.title,
    p_description: p.description ?? null,
    p_priority: p.priority,
    p_scheduled_start: p.scheduled_start ?? null,
    p_scheduled_end: p.scheduled_end ?? null,
    p_vendor_id: p.vendor_id ?? null,
    p_estimated_cost: p.estimated_cost ?? null,
    p_currency: p.currency,
    p_access_instructions: p.access_instructions ?? null,
  });

  if (error) {
    const { status: httpStatus, body } = mapMaintenanceRpcError(error);
    return NextResponse.json(body, { status: httpStatus, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
