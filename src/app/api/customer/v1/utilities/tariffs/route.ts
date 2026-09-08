import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapUtilitiesRpcError } from "@/lib/customer/utilities-api-helper";
import { createTariffSchema } from "@/lib/customer/utilities-schema";
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

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("get_utilities_v1", {
    p_context_id: contextId,
    p_view: "contracts",
  });

  if (error) {
    const { status, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
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

  const parsed = createTariffSchema.safeParse(bodyJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg = issue?.message || "Validation failed";
    const code = msg === "tax_rate_required"
      ? "TAX_RATE_REQUIRED"
      : msg === "tax_rate_out_of_range"
      ? "TAX_RATE_OUT_OF_RANGE"
      : "INVALID_REQUEST";
    return NextResponse.json({ error: { code, message: msg } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("create_tariff_v1", {
    p_context_id: p.context_id,
    p_property_id: p.property_id,
    p_service_type: p.service_type,
    p_tariff_code: p.tariff_code,
    p_name: p.name,
    p_unit_rate: p.unit_rate,
    p_fixed_charge: p.fixed_charge,
    p_tax_rate: p.tax_rate,
    p_currency: p.currency,
    p_valid_from: p.valid_from ?? null,
    p_valid_to: p.valid_to ?? null,
    p_description: p.description ?? null,
  });

  if (error) {
    const { status: s, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status: s, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
