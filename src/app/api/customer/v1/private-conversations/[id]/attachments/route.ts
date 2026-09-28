import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const uuid = z.string().uuid();
const bodySchema = z.object({ context_id: uuid, message_id: uuid, document_id: uuid, version_id: uuid });
type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const conversation = uuid.safeParse((await params).id);
  const context = uuid.safeParse(request.nextUrl.searchParams.get("context_id"));
  const available = request.nextUrl.searchParams.get("available") === "true";
  if (!conversation.success || !context.success) return NextResponse.json({ error: { code: "INVALID_QUERY" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = available
    ? await client.schema("customer_api").rpc("list_attachable_private_documents_v1", { p_context_id: context.data, p_conversation_id: conversation.data })
    : await client.schema("customer_api").rpc("list_private_attachments_v1", { p_context_id: context.data, p_conversation_id: conversation.data });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "ATTACHMENT_QUERY_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const conversation = uuid.safeParse((await params).id);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = bodySchema.safeParse(body);
  if (!conversation.success || !parsed.success) return NextResponse.json({ error: { code: "INVALID_ATTACHMENT" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("attach_private_document_v1", {
    p_context_id: parsed.data.context_id, p_conversation_id: conversation.data, p_message_id: parsed.data.message_id,
    p_document_id: parsed.data.document_id, p_version_id: parsed.data.version_id,
  });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "ATTACHMENT_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { status: 201, headers });
}
