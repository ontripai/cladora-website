import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const id = z.string().uuid().safeParse((await params).id);
  const { errorResponse } = await parseJsonWithLimit<unknown>(request, 1024);
  if (errorResponse) return errorResponse;
  if (!id.success) return NextResponse.json({ error: { code: "INVALID_ATTACHMENT" } }, { status: 400, headers });
  const client = await createClient();
  const auth = await client.auth.getClaims();
  if (auth.error || !auth.data?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const result = await client.schema("customer_api").rpc("authorize_internal_attachment_download_v1", { p_attachment_id: id.data });
  if (result.error) return NextResponse.json({ error: { code: result.error.code === "42501" ? "ACCESS_DENIED" : "DOWNLOAD_FAILED" } }, { status: result.error.code === "42501" ? 403 : 500, headers });
  const record = result.data as { bucket_id?: string; object_path?: string } | null;
  if (record?.bucket_id !== "document-vault" || !record.object_path) return NextResponse.json({ error: { code: "STORAGE_ERROR" } }, { status: 500, headers });
  const signed = await createAdminClient().storage.from("document-vault").createSignedUrl(record.object_path, 60, { download: true });
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: { code: "SIGNING_FAILED" } }, { status: 500, headers });
  return NextResponse.json({ download_url: signed.data.signedUrl, expires_in_seconds: 60 }, { headers });
}
