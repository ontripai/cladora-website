import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/customer/occupancy-schema";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const querySchema = z.object({
  context_id: uuidSchema,
  unit_id: uuidSchema,
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_PARAMETERS" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const { context_id, unit_id } = parsed.data;
  const { data, error: rpcError } = await supabase
    .schema("customer_api")
    .rpc("get_unit_occupancy_detail_v1", {
      p_context_id: context_id,
      p_unit_id: unit_id,
    });

  if (rpcError) {
    const code = rpcError.code;
    const msg = rpcError.message || "";
    if (code === "42501" || msg.includes("access_denied") || msg.includes("permission_required") || msg.includes("mfa_required")) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Access denied" } }, { status: 403, headers: HEADERS });
    }
    if (code === "P0002" || msg.includes("not_found")) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unit not found" } }, { status: 404, headers: HEADERS });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Operation failed" } }, { status: 500, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
