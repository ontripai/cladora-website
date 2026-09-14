import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildingSetupActionSchema } from "@/lib/customer/building-setup-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { mapOnboardingError, ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";

const actions = { rehearse: "rehearse_building_setup_v1", submit: "submit_building_setup_v1", approve: "approve_building_setup_v1", provision: "provision_building_setup_v1" } as const;
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers: ONBOARDING_HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: ONBOARDING_HEADERS });
  const { id, action } = await params;
  const rpc = actions[action as keyof typeof actions];
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 8 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = buildingSetupActionSchema.safeParse(body);
  if (!rpc || !parsed.success || !zUuid(id)) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: ONBOARDING_HEADERS });
  const supabase = await createClient();
  const { data, error } = await supabase.schema("customer_api").rpc(rpc as never, { p_context_id: parsed.data.context_id, p_run_id: id } as never);
  if (error) { const mapped = mapOnboardingError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  return NextResponse.json(data, { headers: ONBOARDING_HEADERS });
}
function zUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
