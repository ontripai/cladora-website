import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ context_id: z.string().uuid(), body: z.string().trim().min(1).max(5000), request_id: z.string().uuid() });
const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsedId = z.string().uuid().safeParse(id);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsedId.success || !parsed.success) return NextResponse.json({ error: { code: "INVALID_MESSAGE" } }, { status: 400, headers });
  const client = await createClient();
  const { data: claims, error } = await client.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("send_private_message_v1", {
    p_context_id: parsed.data.context_id, p_conversation_id: parsedId.data, p_body: parsed.data.body, p_request_id: parsed.data.request_id,
  });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "MESSAGE_SEND_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}
