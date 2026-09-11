import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { buildBankPaymentInstruction } from "@/lib/payments/bank-instruction";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: intentId } = await context.params;
  const contextId = request.nextUrl.searchParams.get("context_id");

  if (!contextId || !z.string().uuid().safeParse(contextId).success) {
    return NextResponse.json(
      { error: { code: "INVALID_CONTEXT_ID", message: "Valid context_id parameter is required" } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("generate_bank_instruction_v1", {
    p_context_id: contextId,
    p_intent_id: intentId,
  });

  if (error) {
    const code = error.code;
    const msg = error.message || "";
    if (code === "42501") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied to generate bank instruction" } },
        { status: 403, headers: HEADERS }
      );
    }
    if (code === "22023" || msg.includes("not_found")) {
      return NextResponse.json(
        { error: { code: "INTENT_NOT_FOUND", message: "Payment intent not found" } },
        { status: 404, headers: HEADERS }
      );
    }
    return NextResponse.json(
      { error: { code: "INSTRUCTION_GENERATION_FAILED", message: msg } },
      { status: 500, headers: HEADERS }
    );
  }

  const rawInstruction = data as any;

  // Enrich with standard EPC QR code payload
  const instruction = buildBankPaymentInstruction({
    associationLegalName: rawInstruction.association_legal_name,
    iban: rawInstruction.iban,
    bankName: rawInstruction.bank_name,
    amount: Number(rawInstruction.amount),
    currency: rawInstruction.currency || "RON",
    clientReference: rawInstruction.client_reference,
    unitCode: rawInstruction.unit_code || "UNIT",
  });

  return NextResponse.json(instruction, { headers: HEADERS });
}
