import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
const updateSchema = z.object({ display_name: z.string().trim().min(2).max(120) }).strict();

export async function GET() {
  const client = await createClient();
  const { data: user, error: authError } = await client.auth.getUser();
  if (authError || !user.user) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const { data: profile, error } = await client.schema("customer_api").rpc("my_profile_v1" as never);
  if (error) return NextResponse.json({ error: { code: "PROFILE_UNAVAILABLE" } }, { status: 500, headers });
  const own = profile as { display_name?: string; locale?: string; timezone?: string } | null;
  return NextResponse.json({
    email: user.user.email ?? "",
    display_name: own?.display_name ?? user.user.email ?? "",
    locale: own?.locale ?? null,
    timezone: own?.timezone ?? null,
  }, { headers });
}

export async function PUT(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers });
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 4096);
  if (errorResponse) return errorResponse;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_DISPLAY_NAME" } }, { status: 400, headers });
  const client = await createClient();
  const { data: claims, error: authError } = await client.auth.getClaims();
  if (authError || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers });
  const { data, error } = await client.schema("customer_api").rpc("update_my_profile_v1" as never, { p_display_name: parsed.data.display_name } as never);
  if (error) return NextResponse.json({ error: { code: error.code === "22023" ? "INVALID_DISPLAY_NAME" : "PROFILE_UPDATE_FAILED" } }, { status: error.code === "22023" ? 400 : 500, headers });
  return NextResponse.json(data, { headers });
}
