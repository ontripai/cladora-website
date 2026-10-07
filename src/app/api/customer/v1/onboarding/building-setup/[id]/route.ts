import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildingSetupPayloadSchema } from "@/lib/customer/building-setup-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { mapOnboardingError, ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";

const inputSchema = z.object({ context_id: z.string().uuid(), units: buildingSetupPayloadSchema.shape.units });
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const contextId = request.nextUrl.searchParams.get("context_id");
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(contextId).success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: ONBOARDING_HEADERS });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.schema("customer_api").rpc("get_building_setup_v1" as never, {
    p_context_id: contextId, p_run_id: id,
  } as never);
  if (error) { const mapped = mapOnboardingError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  return NextResponse.json(data, { headers: ONBOARDING_HEADERS });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers: ONBOARDING_HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: ONBOARDING_HEADERS });
  const { id } = await params;
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 64 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = inputSchema.safeParse(body);
  if (!z.string().uuid().safeParse(id).success || !parsed.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: ONBOARDING_HEADERS });
  const supabase = await createClient();
  const { data, error } = await supabase.schema("customer_api").rpc("update_building_setup_units_v1" as never, {
    p_context_id: parsed.data.context_id, p_run_id: id, p_units: parsed.data.units,
  } as never);
  if (error) { const mapped = mapOnboardingError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  return NextResponse.json(data, { headers: ONBOARDING_HEADERS });
}
