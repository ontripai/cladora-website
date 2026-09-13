import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { createBankStatementImportSchema, queryBankStatementImportsSchema } from "@/lib/customer/payments-schema";
import { mapPaymentsRpcError } from "../../route";

const HEADERS = { "Cache-Control": "no-store, private", Pragma: "no-cache", Vary: "Cookie" };
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const parsed = queryBankStatementImportsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_IMPORT_QUERY" } }, { status: 400, headers: HEADERS });
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  const q = parsed.data;
  const result = await supabase.schema("customer_api").rpc("get_bank_statement_import_v1", {
    p_context_id: q.context_id, p_batch_id: q.id ?? null, p_limit: q.limit, p_offset: q.offset,
  });
  if (result.error) {
    const mapped = mapPaymentsRpcError(result.error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: HEADERS });
  }
  return NextResponse.json(result.data, { headers: HEADERS });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "UNTRUSTED_ORIGIN" } }, { status: 403, headers: HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: HEADERS });
  const { data: rawBody, errorResponse } = await parseJsonWithLimit(request, MAX_BODY_BYTES);
  if (errorResponse) return errorResponse;
  const parsed = createBankStatementImportSchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_IMPORT_PAYLOAD", details: parsed.error.format() } }, { status: 400, headers: HEADERS });
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  const b = parsed.data;
  const sourceHash = createHash("sha256").update(JSON.stringify(b.rows)).digest("hex");
  const created = await supabase.schema("customer_api").rpc("create_bank_statement_import_v1", {
    p_context_id: b.context_id, p_bank_account_id: b.bank_account_id, p_source: b.source,
    p_source_hash: sourceHash, p_file_name: b.file_name, p_statement_format: b.statement_format,
    p_period_start: b.period_start, p_period_end: b.period_end, p_opening_balance: b.opening_balance ?? null,
    p_closing_balance: b.closing_balance ?? null, p_idempotency_key: b.idempotency_key,
  });
  if (created.error) {
    const mapped = mapPaymentsRpcError(created.error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: HEADERS });
  }
  const batchId = (created.data as { id: string }).id;
  const createdState = created.data as { id: string; status: string; idempotent?: boolean };
  if (!createdState.idempotent || createdState.status === "draft") {
    const staged = await supabase.schema("customer_api").rpc("stage_bank_statement_rows_v1", { p_context_id: b.context_id, p_batch_id: batchId, p_rows: b.rows });
    if (staged.error) {
      const mapped = mapPaymentsRpcError(staged.error);
      return NextResponse.json(mapped.body, { status: mapped.status, headers: HEADERS });
    }
  }
  if (createdState.idempotent && ["validated", "committed"].includes(createdState.status)) {
    return NextResponse.json(createdState, { status: 200, headers: HEADERS });
  }
  const validated = await supabase.schema("customer_api").rpc("validate_bank_statement_import_v1", { p_context_id: b.context_id, p_batch_id: batchId });
  if (validated.error) {
    const mapped = mapPaymentsRpcError(validated.error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: HEADERS });
  }
  return NextResponse.json(validated.data, { status: 201, headers: HEADERS });
}
