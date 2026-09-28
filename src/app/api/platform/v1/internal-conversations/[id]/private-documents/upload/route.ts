import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { processUploadStream } from "@/lib/customer/documents-stream-handler";
import { ALLOWED_DOCUMENT_MIMES, MAX_DOCUMENT_FILE_SIZE_BYTES } from "@/lib/customer/documents-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const inputSchema = z.object({ intent_id: z.string().uuid(), object_path: z.string().min(1).max(500),
  mime_type: z.enum(ALLOWED_DOCUMENT_MIMES) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  const thread = z.string().uuid().safeParse((await params).id);
  if (!thread.success || !request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return NextResponse.json({ error: { code: "INVALID_UPLOAD" } }, { status: 400, headers });
  if (Number(request.headers.get("content-length") || 0) > MAX_DOCUMENT_FILE_SIZE_BYTES + 1024 * 1024)
    return NextResponse.json({ error: { code: "FILE_TOO_LARGE" } }, { status: 413, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const form = await request.formData();
  const input = inputSchema.safeParse({ intent_id: form.get("intent_id"), object_path: form.get("object_path"), mime_type: form.get("mime_type") });
  const file = form.get("file");
  if (!input.success || !(file instanceof File) || file.size < 1 || file.size > MAX_DOCUMENT_FILE_SIZE_BYTES)
    return NextResponse.json({ error: { code: "INVALID_UPLOAD" } }, { status: 400, headers });
  let processed;
  try { processed = await processUploadStream(file.stream(), input.data.mime_type, MAX_DOCUMENT_FILE_SIZE_BYTES); }
  catch { return NextResponse.json({ error: { code: "INVALID_FILE_CONTENT" } }, { status: 400, headers }); }
  const bytes = Buffer.concat(processed.chunks.map((chunk) => Buffer.from(chunk)));
  const uploaded = await client.storage.from("internal-message-vault").upload(input.data.object_path, bytes,
    { contentType: processed.result.detectedMime, upsert: false });
  if (uploaded.error) return NextResponse.json({ error: { code: "STORAGE_UPLOAD_FAILED" } }, { status: 500, headers });
  const finished = await client.schema("customer_api").rpc("finish_internal_private_upload_v1", {
    p_intent_id: input.data.intent_id, p_path: input.data.object_path,
    p_sha256: processed.result.serverSha256, p_size_bytes: processed.result.totalBytes,
    p_mime: processed.result.detectedMime,
  });
  if (finished.error) return NextResponse.json({ error: { code: finished.error.code === "42501" ? "ACCESS_DENIED" : "UPLOAD_FINALIZE_FAILED" } }, { status: finished.error.code === "42501" ? 403 : 400, headers });
  return NextResponse.json(finished.data, { status: 201, headers });
}
