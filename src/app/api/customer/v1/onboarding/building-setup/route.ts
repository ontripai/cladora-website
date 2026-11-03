import { mapBuildingSetupError } from "@/lib/customer/building-workspace-onboarding-api";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBuildingSetupSchema, buildingSetupReceiptSchema, buildingSetupIdSchema, buildingSetupReadSchema } from "@/lib/customer/building-setup-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers: ONBOARDING_HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: ONBOARDING_HEADERS });
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 64 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = createBuildingSetupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: ONBOARDING_HEADERS });
  const supabase = await createClient();
  const { data, error } = await supabase.schema("customer_api").rpc("create_building_setup_v2" as never, {
    p_context_id: parsed.data.context_id,
    p_workspace_id: parsed.data.workspace_id,
    p_idempotency_key: parsed.data.idempotency_key,
    p_payload: parsed.data.payload,
  } as never);
  if (error) { const mapped = mapBuildingSetupError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  const receipt = buildingSetupReceiptSchema.safeParse(data);
  if (!receipt.success || receipt.data.workspace_id !== parsed.data.workspace_id || receipt.data.revision !== 1 || !receipt.data.creation_request_hash) return NextResponse.json({ error: { code: "SETUP_INVALID_RESPONSE" } }, { status: 502, headers: ONBOARDING_HEADERS });
  return NextResponse.json(receipt.data, { status: 201, headers: ONBOARDING_HEADERS });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const context = buildingSetupIdSchema.safeParse(query.get('context_id'));
  const workspace = buildingSetupIdSchema.safeParse(query.get('workspace_id'));
  const key = query.get('idempotency_key');
  if (!context.success || !workspace.success || !key || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers: ONBOARDING_HEADERS });
  const supabase = await createClient();
  const { data, error } = await supabase.schema('customer_api').rpc('get_building_setup_attempt_v2' as never, { p_context_id: context.data, p_workspace_id: workspace.data, p_idempotency_key: key } as never);
  if (error) { const mapped = mapBuildingSetupError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  const parsed = data === null ? null : buildingSetupReadSchema.safeParse(data);
  if (parsed && (!parsed.success || parsed.data.workspace_id !== workspace.data)) return NextResponse.json({ error: { code: 'SETUP_INVALID_RESPONSE' } }, { status: 502, headers: ONBOARDING_HEADERS });
  return NextResponse.json({ attempt: parsed?.success ? parsed.data : null }, { headers: ONBOARDING_HEADERS });
}
