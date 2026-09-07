import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryBillingSchema } from "@/lib/customer/billing-schema";
import { mapBillingRpcError } from "../route";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const parsed = queryBillingSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_BILLING_QUERY" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error: queryError } = await supabase.schema("customer_api").rpc("get_billing_v1", {
    p_context_id: p.context_id,
    p_query: p.query ?? null,
    p_status: p.status ?? null,
    p_from: p.from ?? null,
    p_to: p.to ?? null,
    p_limit: 1,
    p_offset: 0,
  });

  if (queryError) {
    const { status, body } = mapBillingRpcError(queryError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  const res = data as any;
  return NextResponse.json({ summary: res?.summary ?? [], total: res?.total ?? 0 }, { headers: HEADERS });
}
