import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const uuid = z.string().uuid();
type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const thread = uuid.safeParse((await params).id);
  if (!thread.success) return NextResponse.json({ error: { code: "INVALID_THREAD" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const method = request.nextUrl.searchParams.get("available") === "true"
    ? "list_internal_attachable_documents_v1" : "list_internal_attachments_v1";
  const result = await client.schema("customer_api").rpc(method, { p_thread_id: thread.data });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "ATTACHMENTS_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const thread = uuid.safeParse((await params).id);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 4096);
  if (errorResponse) return errorResponse;
  const input = z.object({ message_id: uuid, document_id: uuid, version_id: uuid }).safeParse(body);
  if (!thread.success || !input.success) return NextResponse.json({ error: { code: "INVALID_ATTACHMENT" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("attach_internal_document_v1", {
    p_thread_id: thread.data, p_message_id: input.data.message_id,
    p_document_id: input.data.document_id, p_version_id: input.data.version_id,
  });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "ATTACHMENT_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { status: 201, headers });
}
