import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const schema = z.object({
  context_id: z.string().uuid(),
  view: z
    .enum([
      "parties",
      "residents",
      "ownerships",
      "leases",
      "occupancies",
      "mappings",
      "links",
      "history",
      "units",
      "unit_detail",
    ])
    .default("occupancies"),
  query: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  kind: z
    .enum(["owner", "tenant", "household_member", "short_stay", "company", "empty"])
    .optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
});

function mapRpcError(error: any) {
  const code = error?.code;
  const msg = error?.message || "";
  if (code === "42501" || msg.includes("access_denied") || msg.includes("permission_required") || msg.includes("mfa_required")) {
    return { status: 403, code: "OCCUPANCY_ACCESS_DENIED" };
  }
  if (code === "P0002" || msg.includes("not_found")) {
    return { status: 404, code: "OCCUPANCY_NOT_FOUND" };
  }
  return { status: 500, code: "OCCUPANCY_QUERY_FAILED" };
}

export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_OCCUPANCY_QUERY" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;

  // Handle unit detail query
  if (p.view === "unit_detail" && p.unit_id) {
    const { data: unitData, error: unitError } = await supabase
      .schema("customer_api")
      .rpc("get_unit_occupancy_detail_v1", {
        p_context_id: p.context_id,
        p_unit_id: p.unit_id,
      });

    if (unitError) {
      const err = mapRpcError(unitError);
      return NextResponse.json({ error: { code: err.code } }, { status: err.status, headers: HEADERS });
    }
    return NextResponse.json(unitData, { headers: HEADERS });
  }

  // Customer API Gateway: delegates to occupancy.get_customer_registry via customer_api
  const targetView = (p.view === "unit_detail" || p.view === "units") ? "occupancies" : p.view;
  const { data, error: queryError } = await supabase
    .schema("customer_api")
    .rpc("get_occupancy_registry_v1", {
      p_context_id: p.context_id,
      p_view: targetView,
      p_query: p.query ?? null,
      p_status: p.status ?? null,
      p_kind: p.kind ?? null,
      p_from: p.from ?? null,
      p_to: p.to ?? null,
      p_limit: p.limit,
      p_offset: p.offset,
      p_id: p.id ?? null,
    });

  if (queryError) {
    const err = mapRpcError(queryError);
    return NextResponse.json({ error: { code: err.code } }, { status: err.status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
