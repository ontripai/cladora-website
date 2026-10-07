import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const uuid = z.string().uuid();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conversation = uuid.safeParse((await params).id);
  const context = uuid.safeParse(request.nextUrl.searchParams.get("context_id"));
  if (!conversation.success || !context.success) return NextResponse.json({ error: { code: "INVALID_QUERY" } }, { status: 400, headers });

  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });

  const { data, error } = await client.schema("customer_api").rpc("private_conversation_property_v1" as never, {
    p_context_id: context.data, p_conversation_id: conversation.data,
  } as never);
  if (error || !data) return NextResponse.json({ error: { code: error?.code === "42501" ? "ACCESS_DENIED" : "UPLOAD_CONTEXT_FAILED" } }, { status: error?.code === "42501" ? 403 : 500, headers });
  return NextResponse.json({ property_id: data }, { headers });
}
