import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapCommunicationsRpcError } from "@/lib/customer/communications-api-helper";
import { createNoticeDraftSchema, getNoticesQuerySchema } from "@/lib/customer/communications-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function GET(request: NextRequest) {
  const parsed = getNoticesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Invalid query" } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("get_official_notices_v1", {
    p_context_id: p.context_id,
    p_status: p.status ?? null,
    p_source_module: p.source_module ?? null,
    p_limit: p.limit,
    p_offset: p.offset,
    p_id: p.id ?? null,
  });

  if (error) {
    const { status, body } = mapCommunicationsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } }, { status: 403, headers: HEADERS });
  }
  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "application/json required" } }, { status: 415, headers: HEADERS });
  }

  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 32 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body" } }, { status: 400, headers: HEADERS });
  }

  const parsed = createNoticeDraftSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("create_notice_draft_v1", {
    p_context_id: p.context_id,
    p_title_ro: p.title_ro,
    p_body_ro: p.body_ro,
    p_title_en: p.title_en ?? null,
    p_body_en: p.body_en ?? null,
    p_title_fa: p.title_fa ?? null,
    p_body_fa: p.body_fa ?? null,
    p_communication_type: p.communication_type,
    p_legal_classification: p.legal_classification,
    p_source_module: p.source_module,
    p_source_entity_type: p.source_entity_type ?? null,
    p_source_entity_id: p.source_entity_id ?? null,
    p_template_version_id: p.template_version_id ?? null,
    p_template_params: p.template_params ?? {},
    p_idempotency_key: p.idempotency_key ?? null,
  });

  if (error) {
    const { status, body } = mapCommunicationsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
