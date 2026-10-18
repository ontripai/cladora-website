import { NextRequest, NextResponse } from "next/server";

import { HEADERS } from "@/lib/customer/documents-api-helper";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";

// D1 maintenance gate. This route must not call a legacy writer. A later,
// separately reviewed cutover may replace this response with the D2 Core host.
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
        message: "Document creation is temporarily unavailable during the canonical writer cutover.",
      },
    },
    { status: 503, headers: HEADERS }
  );
}
