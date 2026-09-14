import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBuildingSetupSchema } from "@/lib/customer/building-setup-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { mapOnboardingError, ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers: ONBOARDING_HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: ONBOARDING_HEADERS });
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 64 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = createBuildingSetupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: ONBOARDING_HEADERS });
  const supabase = await createClient();
  const { data, error } = await supabase.schema("customer_api").rpc("create_building_setup_v1" as never, {
    p_context_id: parsed.data.context_id,
    p_idempotency_key: parsed.data.idempotency_key,
    p_payload: parsed.data.payload,
  } as never);
  if (error) { const mapped = mapOnboardingError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  return NextResponse.json(data, { status: 201, headers: ONBOARDING_HEADERS });
}
