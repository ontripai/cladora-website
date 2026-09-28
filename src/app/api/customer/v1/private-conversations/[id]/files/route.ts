import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const uuid = z.string().uuid();
const schema = z.object({ context_id: uuid, document_id: uuid, version_id: uuid, request_id: uuid });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const conversation = uuid.safeParse((await params).id);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = schema.safeParse(body);
  if (!conversation.success || !parsed.success) return NextResponse.json({ error: { code: "INVALID_FILE_MESSAGE" } }, { status: 400, headers });

  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const { data, error } = await client.schema("customer_api").rpc("send_private_file_v1" as never, {
    p_context_id: parsed.data.context_id, p_conversation_id: conversation.data,
    p_document_id: parsed.data.document_id, p_version_id: parsed.data.version_id,
    p_request_id: parsed.data.request_id,
  } as never);
  if (error) return NextResponse.json({ error: { code: error.code === "42501" ? "ACCESS_DENIED" : "FILE_SEND_FAILED" } }, { status: error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(data, { status: 201, headers });
}
