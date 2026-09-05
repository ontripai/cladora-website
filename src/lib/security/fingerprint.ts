import { createHmac } from 'node:crypto';

export const FINGERPRINT_WINDOW_MINUTES = 15;

export interface FingerprintPayload {
  leadType: 'contact' | 'pilot';
  normalizedEmail: string;
  normalizedPhone?: string;
  messageSnippet?: string;
}

export interface FingerprintResult {
  fingerprint: string;
  bucket: number;
}

import { getLeadSecuritySecret } from './lead-security-config.ts';
export { getLeadSecuritySecret };

/**
 * Computes a rolling 15-minute submission fingerprint using HMAC-SHA256.
 * Catches double submissions or rapid duplicate clicks within 15 minutes,
 * while allowing legitimate subsequent submissions in the future.
 *
 * Uses a validated secret with a minimum length of 32 characters.
 */
export function computeSubmissionFingerprint(
  payload: FingerprintPayload,
  explicitBucket?: number
): FingerprintResult {
  const secret = getLeadSecuritySecret();
  const bucket =
    explicitBucket !== undefined
      ? explicitBucket
      : Math.floor(Date.now() / (FINGERPRINT_WINDOW_MINUTES * 60 * 1000));

  const canonicalInput = [
    payload.leadType,
    payload.normalizedEmail.trim().toLowerCase(),
    (payload.normalizedPhone ?? '').replace(/[\s\-\(\)\.]/g, ''),
    (payload.messageSnippet ?? '').trim().toLowerCase().slice(0, 60),
    bucket.toString(),
  ].join('::');

  const fingerprint = createHmac('sha256', secret)
    .update(canonicalInput)
    .digest('hex');

  return { fingerprint, bucket };
}
