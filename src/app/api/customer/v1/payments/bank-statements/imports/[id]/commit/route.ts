import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { commitBankStatementImportSchema } from "@/lib/customer/payments-schema";
import { mapPaymentsRpcError } from "../../../../route";

const HEADERS = { "Cache-Control": "no-store, private", Pragma: "no-cache", Vary: "Cookie" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: { code: "UNTRUSTED_ORIGIN" } }, { status: 403, headers: HEADERS });
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } }, { status: 415, headers: HEADERS });
  const { data: rawBody, errorResponse } = await parseJsonWithLimit(request, 4096);
  if (errorResponse) return errorResponse;
  const body = commitBankStatementImportSchema.safeParse(rawBody);
  const { id } = await params;
  if (!body.success || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: { code: "INVALID_IMPORT_COMMIT" } }, { status: 400, headers: HEADERS });
  }
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  const result = await supabase.schema("customer_api").rpc("commit_bank_statement_import_v1", { p_context_id: body.data.context_id, p_batch_id: id });
  if (result.error) {
    const mapped = mapPaymentsRpcError(result.error);
    return NextResponse.json(mapped.body, { status: mapped.status, headers: HEADERS });
  }
  return NextResponse.json(result.data, { headers: HEADERS });
}
