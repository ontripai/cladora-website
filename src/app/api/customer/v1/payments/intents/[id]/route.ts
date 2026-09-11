import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { z } from "zod";

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

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("get_payment_intent_v1", {
    p_context_id: contextId,
    p_intent_id: intentId,
  });

  if (error) {
    const code = error.code;
    const msg = error.message || "";
    if (code === "42501") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied to payment intent" } },
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
      { error: { code: "QUERY_FAILED", message: msg } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { headers: HEADERS });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Untrusted mutation origin" } },
      { status: 403, headers: HEADERS }
    );
  }

  const { id: intentId } = await context.params;
  const contextId = request.nextUrl.searchParams.get("context_id");
  const reason = request.nextUrl.searchParams.get("reason") || "user_cancelled";

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

  const { data, error } = await (supabase.schema("customer_api") as any).rpc("cancel_payment_intent_v1", {
    p_context_id: contextId,
    p_intent_id: intentId,
    p_reason: reason,
  });

  if (error) {
    const code = error.code;
    const msg = error.message || "";
    if (code === "42501") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Access denied to cancel payment intent" } },
        { status: 403, headers: HEADERS }
      );
    }
    return NextResponse.json(
      { error: { code: "CANCELLATION_FAILED", message: msg } },
      { status: 400, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { headers: HEADERS });
}
