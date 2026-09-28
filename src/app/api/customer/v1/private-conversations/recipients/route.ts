import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const querySchema = z.object({
  context_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  query: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_DISCOVERY_QUERY" } }, { status: 400, headers });
  const client = await createClient();
  const { data: claims, error: authError } = await client.auth.getClaims();
  if (authError || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const { data, error } = parsed.data.unit_id
    ? await client.schema("customer_api").rpc("list_private_recipients_v1", {
        p_context_id: parsed.data.context_id, p_unit_id: parsed.data.unit_id,
      })
    : await client.schema("customer_api").rpc("list_private_units_v1", {
        p_context_id: parsed.data.context_id, p_query: parsed.data.query ?? null,
        p_limit: 25, p_offset: parsed.data.offset,
      });
  if (error) return NextResponse.json({ error: { code: error.code === "42501" ? "ACCESS_DENIED" : "DISCOVERY_FAILED" } }, { status: error.code === "42501" ? 403 : 500, headers });
  return NextResponse.json(data, { headers });
}
