import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/customer/occupancy-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const HEADERS = { "Cache-Control": "no-store, private", Pragma: "no-cache", Vary: "Cookie" };
const common = { context_id: uuidSchema, workspace_id: uuidSchema };
const mutationIdentity = {
  request_id: uuidSchema,
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
};
const querySchema = z.object({ ...common, unit_id: uuidSchema }).strict();
const specificationSchema = z.object({
  ...common,
  ...mutationIdentity,
  action: z.literal("record_specification"),
  unit_id: uuidSchema,
  expected_version: z.number().int().min(0),
  unit_code: z.string().min(1).max(80).refine((s) => s === s.trim()),
  floor: z.number().int().min(-32768).max(32767).nullable(),
  area_m2: z.number().positive().nullable(),
  bedrooms: z.number().int().min(0).max(32767).nullable(),
  source_reference: z.string().trim().min(1).max(500),
}).strict();
const lineageSchema = z.object({
  ...common,
  ...mutationIdentity,
  action: z.literal("record_lineage"),
  property_id: uuidSchema,
  kind: z.enum(["split", "merge"]),
  predecessor_unit_ids: z.array(uuidSchema).min(1).max(100),
  successor_unit_ids: z.array(uuidSchema).min(1).max(100),
  source_reference: z.string().trim().min(1).max(500),
}).strict().superRefine((value, ctx) => {
  if ((value.kind === "split" && (value.predecessor_unit_ids.length !== 1 || value.successor_unit_ids.length < 2)) ||
      (value.kind === "merge" && (value.predecessor_unit_ids.length < 2 || value.successor_unit_ids.length !== 1))) {
    ctx.addIssue({ code: "custom", message: "Invalid lineage shape" });
  }
});
const mutationSchema = z.union([specificationSchema, lineageSchema]);

function rpcFailure(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "42501" || message.includes("access_denied") || message.includes("permission_required") || message.includes("mfa_required")) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403, headers: HEADERS });
  }
  if (error.code === "40001" || error.code === "23505" || error.code === "23514") {
    return NextResponse.json({ error: { code: "CONFLICT" } }, { status: 409, headers: HEADERS });
  }
  if (error.code === "22023" || message.includes("_invalid")) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: HEADERS });
  }
  return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500, headers: HEADERS });
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_PARAMETERS" } }, { status: 400, headers: HEADERS });
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("get_core_unit_identity_history_v1", {
    p_context_id: parsed.data.context_id,
    p_workspace_id: parsed.data.workspace_id,
    p_unit_id: parsed.data.unit_id,
  });
  if (error) return rpcFailure(error);
  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers: HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: HEADERS });
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = mutationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: HEADERS });
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  const p = parsed.data;
  const rpc = p.action === "record_specification" ? "record_core_unit_specification_v2" : "record_core_unit_lineage_v2";
  const args = p.action === "record_specification" ? {
    p_context_id: p.context_id, p_workspace_id: p.workspace_id, p_unit_id: p.unit_id,
    p_expected_version: p.expected_version, p_unit_code: p.unit_code, p_floor: p.floor,
    p_area_m2: p.area_m2, p_bedrooms: p.bedrooms, p_source_reference: p.source_reference,
    p_request_id: p.request_id, p_idempotency_key: p.idempotency_key,
  } : {
    p_context_id: p.context_id, p_workspace_id: p.workspace_id, p_property_id: p.property_id,
    p_kind: p.kind, p_predecessor_unit_ids: p.predecessor_unit_ids,
    p_successor_unit_ids: p.successor_unit_ids, p_source_reference: p.source_reference,
    p_request_id: p.request_id, p_idempotency_key: p.idempotency_key,
  };
  const { data, error } = await (supabase.schema("customer_api") as any).rpc(rpc, args);
  if (error) return rpcFailure(error);
  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
