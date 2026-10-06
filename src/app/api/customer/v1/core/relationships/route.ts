import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/customer/occupancy-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

const HEADERS = { "Cache-Control": "no-store, private", Pragma: "no-cache", Vary: "Cookie" };
const key = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
const reference = z.string().trim().min(15).max(500);
const reason = z.string().trim().min(8).max(500);
const date = z.iso.date();
const query = z.object({ context_id: uuidSchema, workspace_id: uuidSchema, property_id: uuidSchema.optional(),
  view: z.enum(["proposals", "subjects", "properties"]).default("proposals") }).strict().superRefine((value, ctx) => {
  if (value.view !== "properties" && !value.property_id) ctx.addIssue({ code: "custom", message: "property_id required" });
});
const common = { context_id: uuidSchema, workspace_id: uuidSchema,
  request_id: uuidSchema, idempotency_key: key, evidence_reference: reference, reason };
const proposal = z.object({ ...common, action: z.literal("propose"),
  property_id: uuidSchema, unit_id: uuidSchema,
  kind: z.enum(["contractual_buyer", "ownership_transfer", "lease"]),
  source_party_id: uuidSchema.nullable(), target_party_id: uuidSchema,
  effective_from: date, effective_to: date.nullable(),
}).strict();
const review = z.object({ ...common, action: z.literal("review"),
  proposal_id: uuidSchema, decision: z.enum(["verified", "rejected"]),
}).strict();
const mutation = z.discriminatedUnion("action", [proposal, review]);

function failure(error: { code?: string }) {
  const status = error.code === "42501" ? 403 :
    ["23505", "23514", "40001"].includes(error.code ?? "") ? 409 :
    error.code === "22023" ? 400 : 500;
  const code = status === 403 ? "FORBIDDEN" : status === 409 ? "CONFLICT" :
    status === 400 ? "INVALID_REQUEST" : "INTERNAL_ERROR";
  return NextResponse.json({ error: { code } }, { status, headers: HEADERS });
}

export async function GET(request: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_PARAMETERS" } }, { status: 400, headers: HEADERS });
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  const p = parsed.data;
  const name = p.view === "subjects" ? "list_core_relationship_subjects_v1" :
    p.view === "properties" ? "list_core_relationship_properties_v1" : "list_core_relationship_proposals_v1";
  const args = p.view === "properties" ? { p_context_id: p.context_id, p_workspace_id: p.workspace_id } :
    { p_context_id: p.context_id, p_workspace_id: p.workspace_id, p_property_id: p.property_id };
  const { data, error } = await (supabase.schema("customer_api") as any).rpc(name, args);
  if (error) return failure(error);
  return NextResponse.json(data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "BAD_ORIGIN" } }, { status: 403, headers: HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: HEADERS });
  const { data: body, errorResponse } = await parseJsonWithLimit<unknown>(request, 16 * 1024);
  if (errorResponse) return errorResponse;
  const parsed = mutation.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers: HEADERS });
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  const p = parsed.data;
  const args = p.action === "propose" ? {
    p_context_id: p.context_id, p_workspace_id: p.workspace_id,
    p_property_id: p.property_id, p_unit_id: p.unit_id, p_kind: p.kind,
    p_source_party_id: p.source_party_id, p_target_party_id: p.target_party_id,
    p_effective_from: p.effective_from, p_effective_to: p.effective_to,
    p_evidence_reference: p.evidence_reference, p_reason: p.reason,
    p_request_id: p.request_id, p_idempotency_key: p.idempotency_key,
  } : {
    p_context_id: p.context_id, p_workspace_id: p.workspace_id,
    p_proposal_id: p.proposal_id, p_decision: p.decision,
    p_evidence_reference: p.evidence_reference, p_reason: p.reason,
    p_request_id: p.request_id, p_idempotency_key: p.idempotency_key,
  };
  const name = p.action === "propose" ? "propose_core_relationship_v1" : "review_core_relationship_v1";
  const { data, error } = await (supabase.schema("customer_api") as any).rpc(name, args);
  if (error) return failure(error);
  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
