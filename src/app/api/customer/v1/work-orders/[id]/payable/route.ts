import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HEADERS, mapMaintenanceRpcError } from "@/lib/customer/maintenance-api-helper";
import { createMaintenancePayableSchema } from "@/lib/customer/maintenance-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: { code: "BAD_ORIGIN", message: "Untrusted mutation origin" } }, { status: 403, headers: HEADERS });
  }
  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "application/json required" } }, { status: 415, headers: HEADERS });
  }

  const { id: workOrderId } = await params;
  const { data: bodyJson, errorResponse } = await parseJsonWithLimit<unknown>(request, 20 * 1024);
  if (errorResponse || !bodyJson) {
    return errorResponse ?? NextResponse.json({ error: { code: "INVALID_JSON", message: "Invalid body" } }, { status: 400, headers: HEADERS });
  }

  const parsed = createMaintenancePayableSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: parsed.error.issues[0]?.message || "Validation failed" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("create_maintenance_payable_v1", {
    p_context_id: p.context_id,
    p_work_order_id: workOrderId,
    p_purchase_order_id: p.purchase_order_id ?? null,
    p_invoice_ref: p.invoice_ref,
    p_invoice_date: p.invoice_date,
    p_due_date: p.due_date ?? null,
    p_subtotal: p.subtotal,
    p_tax_amount: p.tax_amount,
    p_currency: p.currency,
    p_expense_account_id: p.expense_account_id ?? null,
    p_idempotency_key: p.idempotency_key ?? null,
  });

  if (error) {
    const { status: httpStatus, body } = mapMaintenanceRpcError(error);
    return NextResponse.json(body, { status: httpStatus, headers: HEADERS });
  }

  return NextResponse.json(data, { status: 201, headers: HEADERS });
}
