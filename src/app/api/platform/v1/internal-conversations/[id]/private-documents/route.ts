import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_DOCUMENT_MIMES, FORBIDDEN_DOCUMENT_EXTENSIONS, MAX_DOCUMENT_FILE_SIZE_BYTES } from "@/lib/customer/documents-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const uuid = z.string().uuid();
const inputSchema = z.object({ message_id: uuid,
  filename: z.string().min(1).max(255).refine((name) => !FORBIDDEN_DOCUMENT_EXTENSIONS.includes(name.split(".").pop()?.toLowerCase() as typeof FORBIDDEN_DOCUMENT_EXTENSIONS[number])),
  mime_type: z.enum(ALLOWED_DOCUMENT_MIMES),
  size_bytes: z.number().int().min(1).max(MAX_DOCUMENT_FILE_SIZE_BYTES) });
type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const thread = uuid.safeParse((await params).id);
  if (!thread.success) return NextResponse.json({ error: { code: "INVALID_THREAD" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("list_internal_private_documents_v1", { p_thread_id: thread.data });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "DOCUMENTS_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(result.data, { headers });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const thread = uuid.safeParse((await params).id);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 8192);
  if (errorResponse) return errorResponse;
  const input = inputSchema.safeParse(body);
  if (!thread.success || !input.success) return NextResponse.json({ error: { code: "INVALID_DOCUMENT" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("begin_internal_private_upload_v1", {
    p_thread_id: thread.data, p_message_id: input.data.message_id,
    p_filename: input.data.filename, p_mime: input.data.mime_type, p_size_bytes: input.data.size_bytes,
  });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "UPLOAD_INTENT_FAILED" } }, { status: result.error.code === "42501" ? 403 : 400, headers });
  return NextResponse.json(result.data, { status: 201, headers });
}
