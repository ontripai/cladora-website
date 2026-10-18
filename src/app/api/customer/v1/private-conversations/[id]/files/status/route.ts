import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
  return NextResponse.json({
    error: { code: "CANONICAL_PRIVATE_ATTACHMENT_UNAVAILABLE" },
  }, { status: 503, headers });
}
