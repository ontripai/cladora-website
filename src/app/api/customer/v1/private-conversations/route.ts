import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const createSchema = z.object({
  unit_id: z.string().uuid(),
  recipient_membership_id: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
  request_id: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("conversation_id");
  const parsed = id === null ? null : z.string().uuid().safeParse(id);
  if (parsed && !parsed.success) return NextResponse.json({ error: { code: "INVALID_CONVERSATION_ID" } }, { status: 400, headers });
  const client = await createClient();
  const { data: claims, error } = await client.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("get_private_conversations_v1", {
    p_conversation_id: parsed?.success ? parsed.data : null,
  });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "CONVERSATION_QUERY_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_CONVERSATION" } }, { status: 400, headers });
  const client = await createClient();
  const { data: claims, error } = await client.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("create_private_conversation_v1", {
    p_unit_id: parsed.data.unit_id,
    p_recipient_membership_id: parsed.data.recipient_membership_id,
    p_body: parsed.data.body,
    p_request_id: parsed.data.request_id,
  });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "CONVERSATION_CREATE_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { status: 201, headers });
}
