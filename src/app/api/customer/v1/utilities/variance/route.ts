import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapUtilitiesRpcError } from "@/lib/customer/utilities-api-helper";
import { varianceQuerySchema } from "@/lib/customer/utilities-schema";

export async function GET(request: NextRequest) {
  const parsed = varianceQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("get_meter_variance_v1", {
    p_context_id: p.context_id,
    p_building_id: p.building_id,
    p_service_type: p.service_type,
    p_from: p.from ?? null,
    p_to: p.to ?? null,
  });

  if (error) {
    const { status: s, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status: s, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
