import { NextRequest, NextResponse } from "next/server";

import { HEADERS } from "@/lib/customer/documents-api-helper";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";

// D1 maintenance gate. No bytes are read or written before the D2 trusted
// Storage verifier and role-bound Core transaction adapter are available.
export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } },
      { status: 403, headers: HEADERS }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "CANONICAL_DOCUMENT_WRITER_UNAVAILABLE",
        message: "Document upload is temporarily unavailable during the canonical writer cutover.",
      },
    },
    { status: 503, headers: HEADERS }
  );
}
