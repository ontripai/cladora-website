import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const uuid = z.string().uuid();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const conversation = uuid.safeParse((await params).id);
  const context = uuid.safeParse(request.nextUrl.searchParams.get("context_id"));
  const document = uuid.safeParse(request.nextUrl.searchParams.get("document_id"));
  const version = uuid.safeParse(request.nextUrl.searchParams.get("version_id"));
  if (!conversation.success || !context.success || !document.success || !version.success) {
    return NextResponse.json({ error: { code: "INVALID_QUERY" } }, { status: 400, headers });
  }
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const { data, error } = await client.schema("customer_api").rpc("my_private_file_scan_status_v1" as never, {
    p_context_id: context.data, p_conversation_id: conversation.data,
    p_document_id: document.data, p_version_id: version.data,
  } as never);
  if (error) return NextResponse.json({ error: { code: error.code === "42501" ? "ACCESS_DENIED" : "SCAN_STATUS_FAILED" } }, { status: error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(data, { headers });
}
