import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapPaymentsRpcError } from "../route";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const contextId = request.nextUrl.searchParams.get("context_id");
  if (!contextId) {
    return NextResponse.json({ error: { code: "CONTEXT_REQUIRED" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const { data, error: rpcError } = await supabase.schema("customer_api").rpc("get_payments_v1", {
    p_context_id: contextId,
    p_view: "payments",
    p_limit: 1,
    p_offset: 0,
  });

  if (rpcError) {
    const { status, body } = mapPaymentsRpcError(rpcError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json((data as any)?.summary ?? [], { headers: HEADERS });
}
