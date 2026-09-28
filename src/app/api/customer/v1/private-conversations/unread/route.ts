import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
export async function GET(request: NextRequest) {
  const context = z.string().uuid().safeParse(request.nextUrl.searchParams.get("context_id"));
  if (!context.success) return NextResponse.json({ error: { code: "INVALID_QUERY" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("get_private_unread_v1", { p_context_id: context.data });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "UNREAD_QUERY_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}
