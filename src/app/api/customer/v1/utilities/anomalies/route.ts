import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapUtilitiesRpcError } from "@/lib/customer/utilities-api-helper";

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
  const from = request.nextUrl.searchParams.get("from") || null;
  const to = request.nextUrl.searchParams.get("to") || null;
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 25), 1), 100);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") || 0), 0);

  const { data, error } = await supabase.schema("customer_api").rpc("get_utilities_v1", {
    p_context_id: contextId,
    p_view: "anomalies",
    p_query: query,
    p_status: status,
    p_service: service,
    p_from: from,
    p_to: to,
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
