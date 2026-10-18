import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
  void available;
  return NextResponse.json({
    error: { code: "CANONICAL_PRIVATE_ATTACHMENT_UNAVAILABLE" },
  }, { status: 503, headers });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const conversation = uuid.safeParse((await params).id);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = bodySchema.safeParse(body);
  if (!conversation.success || !parsed.success) return NextResponse.json({ error: { code: "INVALID_ATTACHMENT" } }, { status: 400, headers });
  return NextResponse.json({
    error: { code: "CANONICAL_PRIVATE_ATTACHMENT_UNAVAILABLE" },
  }, { status: 503, headers });
}
