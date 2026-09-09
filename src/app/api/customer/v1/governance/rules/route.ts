import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapGovernanceRpcError } from "@/lib/customer/governance-api-helper";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contextId = searchParams.get("context_id");

  if (!contextId) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "context_id required" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("get_legal_decision_rules_v1", {
    p_context_id: contextId,
  });

  if (error) {
    const { status: httpStatus, body } = mapGovernanceRpcError(error);
    return NextResponse.json(body, { status: httpStatus, headers: HEADERS });
  }

  return NextResponse.json({ rules: data ?? [] }, { headers: HEADERS });
}
