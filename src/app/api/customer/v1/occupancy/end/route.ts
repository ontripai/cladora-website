import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { endOccupancyRequestSchema } from "@/lib/customer/occupancy-schema";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const MAX_BODY_BYTES = 10 * 1024;

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: "UNTRUSTED_ORIGIN" } }, { status: 403, headers: HEADERS });
  }

  const contentType = request.headers.get("content-type");
  if (!isApplicationJson(contentType)) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: HEADERS });
  }

  const { data: rawBody, errorResponse } = await parseJsonWithLimit(request, MAX_BODY_BYTES);
  if (errorResponse) return errorResponse;

  const parsed = endOccupancyRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_PAYLOAD" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const b = parsed.data;
  const { data, error: rpcError } = await supabase
    .schema("customer_api")
    .rpc("end_occupancy_v1", {
      p_context_id: b.context_id,
      p_occupancy_id: b.occupancy_id,
      p_ended_at: b.ended_at ?? null,
      p_reason: b.reason ?? null,
    });

  if (rpcError) {
    const code = rpcError.code;
    const msg = rpcError.message || "";
    if (code === "42501" || msg.includes("access_denied") || msg.includes("permission_required") || msg.includes("mfa_required")) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, { status: 403, headers: HEADERS });
    }
    if (code === "22023" || msg.includes("invalid") || msg.includes("already_ended")) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid request" } }, { status: 400, headers: HEADERS });
    }
    if (code === "P0002" || msg.includes("not_found")) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Occupancy not found" } }, { status: 404, headers: HEADERS });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Operation failed" } }, { status: 500, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
