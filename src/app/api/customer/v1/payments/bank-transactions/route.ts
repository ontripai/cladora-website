import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryBankTransactionsSchema } from "@/lib/customer/payments-schema";
import { mapPaymentsRpcError } from "../route";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const parsed = queryBankTransactionsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_QUERY" } }, { status: 400, headers: HEADERS });
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const { data, error: rpcError } = await supabase.schema("customer_api").rpc("list_bank_transactions_v1", {
    p_context_id: p.context_id,
    p_bank_account_id: p.bank_account_id ?? null,
    p_match_status: p.match_status === "all" ? null : p.match_status,
    p_from: p.from ?? null,
    p_to: p.to ?? null,
    p_limit: p.limit,
    p_offset: p.offset,
  });

  if (rpcError) {
    const { status, body } = mapPaymentsRpcError(rpcError);
    return NextResponse.json(body, { status, headers: HEADERS });
  }

  return NextResponse.json(data, { headers: HEADERS });
}
