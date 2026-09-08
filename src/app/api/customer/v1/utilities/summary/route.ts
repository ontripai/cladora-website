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

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("get_utilities_summary_v1", {
    p_context_id: contextId,
  });

  if (error) {
    const { status, body } = mapUtilitiesRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
