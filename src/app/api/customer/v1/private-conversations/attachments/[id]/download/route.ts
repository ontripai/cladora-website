import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const id = z.string().uuid().safeParse((await params).id);
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 1024);
  if (errorResponse) return errorResponse;
  const parsed = z.object({ context_id: z.string().uuid() }).safeParse(body);
  if (!id.success || !parsed.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers });
  return NextResponse.json({
    error: { code: "CANONICAL_PRIVATE_ATTACHMENT_UNAVAILABLE" },
  }, { status: 503, headers });
}
