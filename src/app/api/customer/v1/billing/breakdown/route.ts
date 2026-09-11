import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const queryBreakdownSchema = z.object({
  context_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const parsed = queryBreakdownSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_BREAKDOWN_QUERY", message: "Invalid breakdown query parameters", details: parsed.error.issues } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const { context_id, unit_id, from, to, status, limit, offset } = parsed.data;

  // Call PostgreSQL RPC get_unit_charge_breakdown_v1
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("get_unit_charge_breakdown_v1", {
    p_context_id: context_id,
    p_unit_id: unit_id,
    p_from_date: from ?? null,
    p_to_date: to ?? null,
    p_status: status ?? null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    const code = error.code;
    const msg = error.message || "";
    if (code === "42501" || msg.includes("access_denied")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied to unit charge breakdown" } },
        { status: 403, headers: HEADERS }
      );
    }
    return NextResponse.json(
      { error: { code: "BREAKDOWN_QUERY_FAILED", message: msg || "Failed to retrieve charge breakdown" } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { headers: HEADERS });
}
