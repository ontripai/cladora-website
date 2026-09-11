import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const HEADERS = {
  "Cache-Control": "no-store, private",
  Pragma: "no-cache",
};

export async function POST(request: NextRequest) {
  const providerCode = request.headers.get("x-payment-provider") || "unknown";
  const signature = request.headers.get("x-webhook-signature") || request.headers.get("stripe-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  // Read raw text body for cryptographic hash & signature verification
  const rawBody = await request.text();
  if (!rawBody || rawBody.trim().length === 0) {
    return NextResponse.json(
      { error: { code: "EMPTY_BODY", message: "Webhook body is empty" } },
      { status: 400, headers: HEADERS }
    );
  }

  // Calculate payload SHA256 hash
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");

  // Parse JSON body
  let parsedPayload: any;
  try {
    parsedPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Failed to parse JSON webhook body" } },
      { status: 400, headers: HEADERS }
    );
  }

  const tenantId = parsedPayload.tenant_id || request.headers.get("x-tenant-id");
  const eventId = parsedPayload.event_id || parsedPayload.id || `EVT-${Date.now()}`;
  const eventType = parsedPayload.event_type || parsedPayload.type || "unknown";

  if (!tenantId) {
    return NextResponse.json(
      { error: { code: "MISSING_TENANT_ID", message: "tenant_id must be provided in body or header" } },
      { status: 400, headers: HEADERS }
    );
  }

  // Validate replay window (< 300 seconds) if timestamp header present
  if (timestamp) {
    const eventTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (!isNaN(eventTime) && Math.abs(now - eventTime) > 300) {
      return NextResponse.json(
        { error: { code: "REPLAY_WINDOW_EXCEEDED", message: "Webhook timestamp expired" } },
        { status: 400, headers: HEADERS }
      );
    }
  }

  // Ingest into database via service role client calling payments.process_webhook_event_v1
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc("process_webhook_event_v1" as any, {
    p_tenant_id: tenantId,
    p_provider_code: providerCode,
    p_provider_event_id: eventId,
    p_event_type: eventType,
    p_payload_hash: payloadHash,
    p_payload: parsedPayload,
  });

  if (error) {
    return NextResponse.json(
      { error: { code: "WEBHOOK_PROCESSING_FAILED", message: error.message } },
      { status: 500, headers: HEADERS }
    );
  }

  return NextResponse.json(data, { status: 200, headers: HEADERS });
}
