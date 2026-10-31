import { createHmac } from 'node:crypto';
import { FINGERPRINT_WINDOW_MINUTES, type FingerprintResult } from './fingerprint.ts';
import { getLeadSecuritySecret } from './lead-security-config.ts';

export const CONTACT_FINGERPRINT_VERSION = 'cladora.contact.intent.v2';

/** Only the bounded, successfully validated contact schema may enter this helper. */
export interface ContactFingerprintIntent {
  fullName: string;
  email: string;
  phone?: string | null;
  message: string;
  locale: 'ro' | 'en' | 'fa';
  role?: string | null;
  propertyType?: string | null;
  portfolioScope?: string | null;
  stage?: string | null;
  services?: readonly string[] | null;
  workspaceStatus?: string | null;
  city?: string | null;
  unitsCount?: string | null;
}

const optional = (value: string | null | undefined): string | null => value?.trim() || null;

/**
 * Fixed tuple, complete validated message and unordered service selection.
 * Tracking, challenge tokens and request JSON are never serialized into intent.
 * Pilot and legacy fingerprint.ts are deliberately unchanged. No legacy fallback:
 * v1/v2 dedupe across a mixed-version bucket is not guaranteed (see task contract).
 */
export function computeContactSubmissionFingerprint(
  payload: ContactFingerprintIntent,
  explicitBucket?: number,
): FingerprintResult {
  const secret = getLeadSecuritySecret();
  const bucket = explicitBucket ?? Math.floor(Date.now() / (FINGERPRINT_WINDOW_MINUTES * 60 * 1000));
  const services = Array.from(new Set((payload.services ?? []).map(value => value.trim()).filter(Boolean))).sort();
  const canonical = JSON.stringify([
    CONTACT_FINGERPRINT_VERSION,
    payload.fullName.trim(),
    payload.email.trim().toLowerCase(),
    (payload.phone ?? '').replace(/[\s\-\(\)\.]/g, ''),
    payload.message.trim(),
    payload.locale,
    optional(payload.role),
    optional(payload.propertyType),
    optional(payload.portfolioScope),
    optional(payload.stage),
    services,
    optional(payload.workspaceStatus),
    optional(payload.city),
    optional(payload.unitsCount),
    bucket,
  ]);
  return { fingerprint: createHmac('sha256', secret).update(canonical).digest('hex'), bucket };
}
