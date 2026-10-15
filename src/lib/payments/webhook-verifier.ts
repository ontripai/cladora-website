import "server-only";

import crypto from "node:crypto";

const PROVIDER_CODE_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;
const SIGNATURE_PATTERN = /^[a-fA-F0-9]{64}$/;
const TIMESTAMP_PATTERN = /^[0-9]{10}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9._:-]{2,99}$/;
const MAX_CONFIGURED_PROVIDERS = 16;

export const PAYMENT_WEBHOOK_REPLAY_WINDOW_SECONDS = 300;

export interface PaymentWebhookProviderConfig {
  providerCode: string;
  secret: string;
}

export interface PaymentWebhookEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export function resolvePaymentWebhookProviderConfig(
  providerHeader: string | null,
  environment: NodeJS.ProcessEnv = process.env,
): PaymentWebhookProviderConfig | null {
  if (!providerHeader || !PROVIDER_CODE_PATTERN.test(providerHeader)) return null;

  const rawAllowlist = environment.PAYMENT_WEBHOOK_PROVIDER_ALLOWLIST;
  if (!rawAllowlist) return null;

  const providers = rawAllowlist.split(",").map((value) => value.trim());
  if (
    providers.length === 0
    || providers.length > MAX_CONFIGURED_PROVIDERS
    || providers.some((value) => !PROVIDER_CODE_PATTERN.test(value))
    || new Set(providers).size !== providers.length
    || !providers.includes(providerHeader)
  ) {
    return null;
  }

  const secret = environment[`PAYMENT_WEBHOOK_SECRET_${providerHeader.toUpperCase()}`];
  if (!secret) return null;

  return { providerCode: providerHeader, secret };
}

export function verifyPaymentWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  nowMilliseconds?: number;
}): boolean {
  const { rawBody, signature, timestamp, secret } = input;
  if (!signature || !SIGNATURE_PATTERN.test(signature)) return false;
  if (!timestamp || !TIMESTAMP_PATTERN.test(timestamp)) return false;

  const eventTime = Number(timestamp);
  const nowSeconds = Math.floor((input.nowMilliseconds ?? Date.now()) / 1000);
  if (
    !Number.isSafeInteger(eventTime)
    || eventTime <= 0
    || Math.abs(nowSeconds - eventTime) > PAYMENT_WEBHOOK_REPLAY_WINDOW_SECONDS
  ) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function parsePaymentWebhookEvent(rawBody: string): PaymentWebhookEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const explicitEventId = payload.event_id;
  const alternateEventId = payload.id;
  if (
    explicitEventId !== undefined
    && alternateEventId !== undefined
    && explicitEventId !== alternateEventId
  ) {
    return null;
  }
  const eventId = explicitEventId ?? alternateEventId;

  const explicitEventType = payload.event_type;
  const alternateEventType = payload.type;
  if (
    explicitEventType !== undefined
    && alternateEventType !== undefined
    && explicitEventType !== alternateEventType
  ) {
    return null;
  }
  const eventType = explicitEventType ?? alternateEventType;

  if (typeof eventId !== "string" || !EVENT_ID_PATTERN.test(eventId)) return null;
  if (typeof eventType !== "string" || !EVENT_TYPE_PATTERN.test(eventType)) return null;

  return { eventId, eventType, payload };
}
