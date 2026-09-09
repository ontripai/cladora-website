import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapCommunicationsRpcError } from "@/lib/customer/communications-api-helper";
import { getDeliveriesQuerySchema } from "@/lib/customer/communications-schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = getDeliveriesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "context_id parameter is required." } },
      { status: 400, headers: HEADERS }
    );
  }

  const { id: noticeId } = await params;
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("list_notice_deliveries_v1", {
    p_context_id: p.context_id,
    p_notice_id: noticeId,
    p_limit: p.limit,
    p_offset: p.offset,
  });

  if (error) {
    const { status, body } = mapCommunicationsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
