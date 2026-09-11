/**
 * Provider-Neutral Payment Gateway Adapter & Webhook Verifier
 * Slice: CLADORA-P2-PAY-003-R1
 * Authoritative boundary: DEFERRED-LIVE-PAYMENT-PROVIDER
 * Zero card/PAN/CVV handling. Fails closed when live provider is not configured.
 */

import crypto from "node:crypto";
import { PaymentIntent, ProviderSessionResult, BeneficiaryAccountSnapshot } from "./types";

export interface PaymentProviderConfig {
  providerCode: string;
  isConfigured: boolean;
  webhookSecret?: string;
  environment: "sandbox" | "production" | "deferred";
}

export interface WebhookVerificationResult {
  isValid: boolean;
  reason?: string;
  eventId?: string;
  eventType?: string;
  payload?: any;
}

/**
 * Provider-Neutral Adapter interface
 */
export interface IPaymentProviderAdapter {
  providerCode: string;
  createCheckoutSession(
    intent: PaymentIntent,
    beneficiary: BeneficiaryAccountSnapshot
  ): Promise<ProviderSessionResult>;
  verifyWebhook(
    rawBody: string,
    signatureHeader: string | null,
    timestampHeader?: string | null
  ): WebhookVerificationResult;
}

/**
 * Deferred Provider Adapter (for NETOPIA, Stripe, or other PSPs awaiting live contract activation)
 * Returns DEFERRED-LIVE-PAYMENT-PROVIDER fail-closed response, preserving direct bank transfers.
 */
export class DeferredPaymentProviderAdapter implements IPaymentProviderAdapter {
  constructor(public providerCode: string) {}

  async createCheckoutSession(
    intent: PaymentIntent,
    beneficiary: BeneficiaryAccountSnapshot
  ): Promise<ProviderSessionResult> {
    // In accordance with CLADORA-P2-PAY-003-R1, live hosted PSP checkout is deferred
    // Direct bank transfer and QR instructions remain fully operational.
    return {
      status: "deferred_unconfigured",
      provider_reference: `DEF-${this.providerCode.toUpperCase()}-${intent.idempotency_key}`,
      message: `Direct card checkout through ${this.providerCode} is awaiting association merchant credential onboarding. Please use direct bank transfer with the generated payment instructions.`
    };
  }

  verifyWebhook(
    rawBody: string,
    signatureHeader: string | null,
    timestampHeader?: string | null
  ): WebhookVerificationResult {
    // Fail-closed verification for unconfigured provider
    const secret = process.env[`PAYMENT_WEBHOOK_SECRET_${this.providerCode.toUpperCase()}`];
    if (!secret || !signatureHeader) {
      return {
        isValid: false,
        reason: "webhook_secret_not_configured_or_signature_missing",
      };
    }

    // Timestamp replay check (< 300 seconds)
    if (timestampHeader) {
      const eventTime = parseInt(timestampHeader, 10);
      const now = Math.floor(Date.now() / 1000);
      if (isNaN(eventTime) || Math.abs(now - eventTime) > 300) {
        return {
          isValid: false,
          reason: "webhook_timestamp_out_of_window",
        };
      }
    }

    // Constant-time HMAC comparison
    try {
      const hmac = crypto.createHmac("sha256", secret);
      const digest = hmac.update(rawBody).digest("hex");
      const signatureBuf = Buffer.from(signatureHeader, "hex");
      const digestBuf = Buffer.from(digest, "hex");

      if (signatureBuf.length !== digestBuf.length || !crypto.timingSafeEqual(signatureBuf, digestBuf)) {
        return { isValid: false, reason: "signature_mismatch" };
      }

      const parsed = JSON.parse(rawBody);
      return {
        isValid: true,
        eventId: parsed.id || parsed.event_id,
        eventType: parsed.type || parsed.event_type,
        payload: parsed.data || parsed,
      };
    } catch {
      return { isValid: false, reason: "invalid_webhook_payload_or_signature" };
    }
  }
}

/**
 * Registry to retrieve provider adapter by provider_code
 */
export function getPaymentProviderAdapter(providerCode: string): IPaymentProviderAdapter {
  // All live external PSP connections fall under deferred boundary until production credentials exist
  return new DeferredPaymentProviderAdapter(providerCode || "deferred");
}
