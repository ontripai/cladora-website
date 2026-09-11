import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { z } from "zod";
import { getPaymentProviderAdapter } from "@/lib/payments/provider-adapter";
import { buildBankPaymentInstruction } from "@/lib/payments/bank-instruction";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
  Vary: "Cookie",
};

const MAX_BODY_BYTES = 16 * 1024;

const createIntentSchema = z.object({
  context_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().length(3).default("RON"),
  provider_code: z.string().trim().default("bank_transfer"),
  payment_method: z.enum(["bank_transfer", "card"]).default("bank_transfer"),
  selected_invoices: z
    .array(
      z.object({
        invoice_id: z.string().uuid(),
        amount: z.coerce.number().positive(),
      })
    )
    .optional()
    .default([]),
  idempotency_key: z.string().trim().max(100).optional(),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Untrusted mutation origin" } },
      { status: 403, headers: HEADERS }
    );
  }

  if (!isApplicationJson(request.headers.get("content-type"))) {
    return NextResponse.json(
      { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json" } },
      { status: 415, headers: HEADERS }
    );
  }

  const { data: json, errorResponse } = await parseJsonWithLimit(request, MAX_BODY_BYTES);
  if (errorResponse || !json) {
    return errorResponse ?? NextResponse.json(
      { error: { code: "INVALID_REQUEST_BODY", message: "Invalid JSON payload" } },
      { status: 400, headers: HEADERS }
    );
  }

  const parsed = createIntentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INTENT_PARAMETERS", message: "Validation failed", details: parsed.error.issues } },
      { status: 400, headers: HEADERS }
    );
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401, headers: HEADERS });
  }

  const p = parsed.data;
  const idempotencyKey = p.idempotency_key || `INTENT-${claims.claims.sub}-${Date.now()}`;

  // Call customer_api.create_payment_intent_v1
  const { data, error } = await (supabase.schema("customer_api") as any).rpc("create_payment_intent_v1", {
    p_context_id: p.context_id,
    p_unit_id: p.unit_id,
    p_selected_invoices: p.selected_invoices,
    p_amount: p.amount,
    p_currency: p.currency,
    p_provider_code: p.provider_code,
    p_payment_method: p.payment_method,
  });

  if (error) {
    const code = error.code;
    const msg = error.message || "";
    if (code === "42501" || msg.includes("access_denied")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied to create payment intent" } },
        { status: 403, headers: HEADERS }
      );
    }
    if (code === "22023" || code === "23505" || code === "23514") {
      return NextResponse.json(
        { error: { code: "INVALID_INTENT_REQUEST", message: msg } },
        { status: 400, headers: HEADERS }
      );
    }
    return NextResponse.json(
      { error: { code: "INTENT_CREATION_FAILED", message: msg } },
      { status: 500, headers: HEADERS }
    );
  }

  // If method is card and provider is external PSP:
  let providerSession = null;
  if (p.payment_method === "card") {
    const adapter = getPaymentProviderAdapter(p.provider_code);
    providerSession = await adapter.createCheckoutSession(
      data as any,
      (data as any)?.beneficiary_snapshot
    );
  }

  return NextResponse.json(
    {
      ...(typeof data === "object" && data !== null ? data : {}),
      provider_session: providerSession,
    },
    { status: 201, headers: HEADERS }
  );
}
