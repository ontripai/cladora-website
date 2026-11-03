import { mapBuildingSetupError, missingSetupPrecondition } from "@/lib/customer/building-workspace-onboarding-api";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildingSetupActionSchema, buildingSetupIdSchema, buildingSetupReceiptSchema, buildingSetupApprovalSchema } from "@/lib/customer/building-setup-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";

const actions = { rehearse: "rehearse_building_setup_v2", submit: "submit_building_setup_v2", approve: "approve_building_setup_v2", provision: "provision_building_setup_v2" } as const;
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers: ONBOARDING_HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: ONBOARDING_HEADERS });
  const { id, action } = await params;
  const rpc = Object.hasOwn(actions, action) ? actions[action as keyof typeof actions] : null;
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 8 * 1024);
  if (errorResponse) return errorResponse;
  if (missingSetupPrecondition(body, action === "approve")) return NextResponse.json({ error: { code: "SETUP_PRECONDITION_REQUIRED" } }, { status: 428, headers: ONBOARDING_HEADERS });
  const parsed = (action === "approve" ? buildingSetupApprovalSchema : buildingSetupActionSchema).safeParse(body);
  if (!rpc || !parsed.success || !buildingSetupIdSchema.safeParse(id).success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: ONBOARDING_HEADERS });
  const supabase = await createClient();
  const { data, error } = await supabase.schema("customer_api").rpc(rpc as never, { p_context_id: parsed.data.context_id, p_workspace_id: parsed.data.workspace_id, p_run_id: id, p_expected_revision: parsed.data.expected_revision, p_command_key: parsed.data.command_key, ...(action === "approve" && "expected_payload_hash" in parsed.data ? { p_expected_payload_hash: parsed.data.expected_payload_hash } : {}) } as never);
  if (error) { const mapped = mapBuildingSetupError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  const receipt = buildingSetupReceiptSchema.safeParse(data);
  if (!receipt.success || receipt.data.run_id !== id || receipt.data.workspace_id !== parsed.data.workspace_id || receipt.data.command_key !== parsed.data.command_key || receipt.data.expected_revision !== parsed.data.expected_revision || receipt.data.revision !== parsed.data.expected_revision + 1) return NextResponse.json({ error: { code: "SETUP_INVALID_RESPONSE" } }, { status: 502, headers: ONBOARDING_HEADERS });
  return NextResponse.json(receipt.data, { headers: ONBOARDING_HEADERS });
}
