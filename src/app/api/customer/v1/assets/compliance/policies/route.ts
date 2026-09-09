import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapAssetsRpcError } from "@/lib/customer/assets-api-helper";
import { configurePolicySchema } from "@/lib/customer/assets-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const listPoliciesQuerySchema = z.object({
  context_id: z.string().uuid("Invalid customer context UUID"),
  category_code: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const parsed = listPoliciesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_QUERY_PARAMETERS", message: parsed.error.issues[0]?.message || "Validation failed" } },
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

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("list_compliance_policies_v1", {
    p_context_id: parsed.data.context_id,
    p_category_code: parsed.data.category_code ?? null,
  });

  if (error) {
    const { status, body } = mapAssetsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
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

  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400, headers: HEADERS }
    );
  }

  const parsed = configurePolicySchema.safeParse(bodyJson);
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
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("configure_compliance_policy_v1", {
    p_context_id: p.context_id,
    p_policy_code: p.policy_code,
    p_category_code: p.category_code,
    p_interval_months: p.interval_months,
    p_legal_source_reference: p.legal_source_reference,
    p_effective_from: p.effective_from,
    p_effective_to: p.effective_to ?? null,
    p_property_id: p.property_id ?? null,
    p_is_safety_mandatory: p.is_safety_mandatory,
    p_jurisdiction: p.jurisdiction,
  });

  if (error) {
    const { status, body } = mapAssetsRpcError(error);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
