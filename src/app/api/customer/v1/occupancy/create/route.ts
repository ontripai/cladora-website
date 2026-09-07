import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { createOccupancyRequestSchema } from "@/lib/customer/occupancy-schema";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const MAX_BODY_BYTES = 10 * 1024; // 10 KB limit

function mapRpcError(error: any) {
  const code = error?.code;
  const msg = error?.message || "";
  if (code === "42501" || msg.includes("access_denied") || msg.includes("permission_required") || msg.includes("mfa_required")) {
    return { status: 403, body: { error: { code: "FORBIDDEN", message: "Access denied" } } };
  }
  if (code === "40001" || msg.includes("overlapping")) {
    return { status: 409, body: { error: { code: "CONFLICT", message: "Conflicting occupancy schedule" } } };
  }
  if (code === "22023" || msg.includes("invalid") || msg.includes("required") || msg.includes("must_be")) {
    return { status: 400, body: { error: { code: "BAD_REQUEST", message: "Invalid occupancy parameters" } } };
  }
  if (code === "P0002" || msg.includes("not_found")) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: "Record not found" } } };
  }
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Operation failed" } } };
}

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

  const parsed = createOccupancyRequestSchema.safeParse(rawBody);
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
    .rpc("create_occupancy_v1", {
      p_context_id: b.context_id,
      p_unit_id: b.unit_id,
      p_kind: b.kind,
      p_starts_at: b.starts_at,
      p_ends_at: b.ends_at ?? null,
      p_occupant_party_ids: b.occupant_party_ids ?? null,
      p_role: b.role ?? null,
      p_reason: b.reason ?? null,
    });

  if (rpcError) {
    const { status, body } = mapRpcError(rpcError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
