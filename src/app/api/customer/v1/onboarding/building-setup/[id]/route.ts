import { mapBuildingSetupError, missingSetupPrecondition } from "@/lib/customer/building-workspace-onboarding-api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildingSetupIdSchema, buildingSetupReadSchema, buildingSetupUnitsSchema, buildingSetupActionSchema, buildingSetupReceiptSchema } from "@/lib/customer/building-setup-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";

const inputSchema = buildingSetupActionSchema.extend({ units: buildingSetupUnitsSchema });
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const contextId = request.nextUrl.searchParams.get("context_id");
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  if (!buildingSetupIdSchema.safeParse(workspaceId).success || !buildingSetupIdSchema.safeParse(id).success || !buildingSetupIdSchema.safeParse(contextId).success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: ONBOARDING_HEADERS });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.schema("customer_api").rpc("get_building_setup_v2" as never, {
    p_context_id: contextId, p_workspace_id: workspaceId, p_run_id: id,
  } as never);
  if (error) { const mapped = mapBuildingSetupError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  const record = buildingSetupReadSchema.safeParse(data);
  if (!record.success || record.data.run_id !== id || record.data.workspace_id !== workspaceId) return NextResponse.json({ error: { code: "SETUP_INVALID_RESPONSE" } }, { status: 502, headers: ONBOARDING_HEADERS });
  return NextResponse.json(record.data, { headers: ONBOARDING_HEADERS });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers: ONBOARDING_HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: ONBOARDING_HEADERS });
  const { id } = await params;
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 64 * 1024);
  if (errorResponse) return errorResponse;
  if (missingSetupPrecondition(body)) return NextResponse.json({ error: { code: "SETUP_PRECONDITION_REQUIRED" } }, { status: 428, headers: ONBOARDING_HEADERS });
  const parsed = inputSchema.safeParse(body);
  if (!buildingSetupIdSchema.safeParse(id).success || !parsed.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: ONBOARDING_HEADERS });
  const supabase = await createClient();
  const { data, error } = await supabase.schema("customer_api").rpc("update_building_setup_units_v2" as never, {
    p_context_id: parsed.data.context_id, p_workspace_id: parsed.data.workspace_id, p_expected_revision: parsed.data.expected_revision, p_command_key: parsed.data.command_key, p_run_id: id, p_units: parsed.data.units,
  } as never);
  if (error) { const mapped = mapBuildingSetupError(error); return NextResponse.json({ error: { code: mapped.code } }, { status: mapped.status, headers: ONBOARDING_HEADERS }); }
  const receipt = buildingSetupReceiptSchema.safeParse(data);
  if (!receipt.success || receipt.data.run_id !== id || receipt.data.workspace_id !== parsed.data.workspace_id || receipt.data.command_key !== parsed.data.command_key || receipt.data.expected_revision !== parsed.data.expected_revision || receipt.data.revision !== parsed.data.expected_revision + 1) return NextResponse.json({ error: { code: "SETUP_INVALID_RESPONSE" } }, { status: 502, headers: ONBOARDING_HEADERS });
  return NextResponse.json(receipt.data, { headers: ONBOARDING_HEADERS });
}
