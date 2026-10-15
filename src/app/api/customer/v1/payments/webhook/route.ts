import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parsePaymentWebhookEvent,
  resolvePaymentWebhookProviderConfig,
  verifyPaymentWebhookSignature,
} from "@/lib/payments/webhook-verifier";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
};

export async function POST(request: NextRequest) {
  const provider = resolvePaymentWebhookProviderConfig(request.headers.get("x-payment-provider"));
  if (!provider) {
    return NextResponse.json(
      { error: { code: "WEBHOOK_UNAVAILABLE" } },
      { status: 503, headers: HEADERS }
    );
  }

  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");
  if (!signature || !timestamp) {
    return NextResponse.json(
      { error: { code: "WEBHOOK_UNAUTHORIZED" } },
      { status: 401, headers: HEADERS }
    );
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "INVALID_WEBHOOK_PAYLOAD" } },
      { status: 400, headers: HEADERS }
    );
  }

  if (!verifyPaymentWebhookSignature({
    rawBody,
    signature,
    timestamp,
    secret: provider.secret,
  })) {
    return NextResponse.json(
      { error: { code: "WEBHOOK_UNAUTHORIZED" } },
      { status: 401, headers: HEADERS }
    );
  }

  const event = parsePaymentWebhookEvent(rawBody);
  if (!event) {
    return NextResponse.json(
      { error: { code: "INVALID_WEBHOOK_PAYLOAD" } },
      { status: 400, headers: HEADERS }
    );
  }

  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc("process_webhook_event_v1" as any, {
    p_provider_code: provider.providerCode,
    p_provider_event_id: event.eventId,
    p_event_type: event.eventType,
    p_payload_hash: payloadHash,
    p_payload: event.payload,
  });

  if (error) {
    return NextResponse.json(
      { error: { code: "WEBHOOK_PROCESSING_FAILED" } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { status: 200, headers: HEADERS });
}
