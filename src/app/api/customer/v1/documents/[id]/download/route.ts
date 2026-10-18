import { NextRequest, NextResponse } from "next/server";
import { HEADERS } from "@/lib/customer/documents-api-helper";
import { authorizeDownloadSchema } from "@/lib/customer/documents-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { z } from "zod";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } },
      { status: 403, headers: HEADERS }
    );
  }
  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "application/json required" } },
      { status: 415, headers: HEADERS }
    );
  }

  const { id: documentId } = await context.params;
  if (!z.string().uuid().safeParse(documentId).success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Invalid document UUID" } },
      { status: 400, headers: HEADERS }
    );
  }
  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400, headers: HEADERS }
    );
  }

  const parsed = authorizeDownloadSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } },
      { status: 400, headers: HEADERS }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "CANONICAL_DOCUMENT_DOWNLOAD_UNAVAILABLE",
        message: "Canonical document download is not active.",
      },
    },
    { status: 503, headers: HEADERS }
  );
}
