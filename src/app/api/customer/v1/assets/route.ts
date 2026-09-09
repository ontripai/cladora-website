import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapAssetsRpcError } from "@/lib/customer/assets-api-helper";
import { listAssetsQuerySchema, createAssetSchema } from "@/lib/customer/assets-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function GET(request: NextRequest) {
  const parsed = listAssetsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_QUERY_PARAMETERS", message: parsed.error.issues[0]?.message || "Validation failed" } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401, headers: HEADERS }
    );
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("list_assets_v1", {
    p_context_id: p.context_id,
    p_property_id: p.property_id ?? null,
    p_building_id: p.building_id ?? null,
    p_category_id: p.category_id ?? null,
    p_lifecycle_status: p.lifecycle_status ?? null,
    p_operational_status: p.operational_status ?? null,
    p_condition: p.condition ?? null,
    p_criticality_level: p.criticality_level ?? null,
    p_is_safety_critical: p.is_safety_critical ?? null,
    p_search: p.search ?? null,
    p_limit: p.limit,
    p_offset: p.offset,
  });

  if (error) {
    const { status, body } = mapAssetsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } },
      { status: 403, headers: HEADERS }
    );
  }
  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "application/json required" } },
      { status: 415, headers: HEADERS }
    );
  }

  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 32 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400, headers: HEADERS }
    );
  }

  const parsed = createAssetSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401, headers: HEADERS }
    );
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("create_asset_v1", {
    p_context_id: p.context_id,
    p_property_id: p.property_id,
    p_category_id: p.category_id,
    p_asset_code: p.asset_code,
    p_name: p.name,
    p_scope: p.scope,
    p_building_id: p.building_id ?? null,
    p_unit_id: p.unit_id ?? null,
    p_description: p.description ?? null,
    p_manufacturer: p.manufacturer ?? null,
    p_model: p.model ?? null,
    p_serial_number: p.serial_number ?? null,
    p_manufacture_year: p.manufacture_year ?? null,
    p_installed_on: p.installed_on ?? null,
    p_location_description: p.location_description ?? null,
    p_ownership_type: p.ownership_type,
    p_condition: p.condition,
    p_criticality_level: p.criticality_level,
    p_is_safety_critical: p.is_safety_critical,
    p_replacement_cost: p.replacement_cost ?? null,
    p_currency: p.currency,
    p_meter_id: p.meter_id ?? null,
    p_access_point_id: p.access_point_id ?? null,
    p_vendor_id: p.vendor_id ?? null,
    p_service_contract_id: p.service_contract_id ?? null,
    p_service_frequency_months: p.service_frequency_months ?? null,
  });

  if (error) {
    const { status, body } = mapAssetsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
