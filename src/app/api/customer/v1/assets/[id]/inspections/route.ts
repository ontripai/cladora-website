import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapAssetsRpcError } from "@/lib/customer/assets-api-helper";
import { assetDetailQuerySchema, recordInspectionSchema } from "@/lib/customer/assets-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const parsed = assetDetailQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_QUERY_PARAMETERS", message: parsed.error.issues[0]?.message || "Validation failed" } },
      { status: 400, headers: HEADERS }
    );
  }

  const { id: assetId } = await context.params;
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401, headers: HEADERS }
    );
  }

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("list_asset_inspections_v1", {
    p_context_id: parsed.data.context_id,
    p_asset_id: assetId,
  });

  if (error) {
    const { status, body } = mapAssetsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } },
      { status: 403, headers: HEADERS }
    );
  }
  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "application/json required" } },
      { status: 415, headers: HEADERS }
    );
  }

  const { id: assetId } = await context.params;
  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400, headers: HEADERS }
    );
  }

  const parsed = recordInspectionSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401, headers: HEADERS }
    );
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("record_asset_inspection_v1", {
    p_context_id: p.context_id,
    p_asset_id: assetId,
    p_inspection_type: p.inspection_type,
    p_scheduled_date: p.scheduled_date,
    p_performed_at: p.performed_at ?? null,
    p_result: p.result,
    p_inspector_name: p.inspector_name ?? null,
    p_inspector_vendor_id: p.inspector_vendor_id ?? null,
    p_observations: p.observations ?? null,
    p_corrective_action_required: p.corrective_action_required ?? null,
    p_document_id: p.document_id ?? null,
    p_policy_id: p.policy_id ?? null,
  });

  if (error) {
    const { status, body } = mapAssetsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
