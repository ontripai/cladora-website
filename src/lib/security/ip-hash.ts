import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Retrieves and validates the HMAC secret key.
 * Fail-closed in Production and Preview if missing or shorter than 32 characters.
 */
import { getLeadSecuritySecret } from './lead-security-config.ts';
export { getLeadSecuritySecret };

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp?.trim()) return realIp.trim();

  return '127.0.0.1';
}

/**
 * Computes a privacy-safe, irreversible HMAC-SHA256 hash of the client IP.
 * Never stores or leaks raw IP addresses.
 * Uses a validated secret with a minimum length of 32 characters.
 */
export function hashClientIp(ip: string): string {
  const secret = getLeadSecuritySecret();
  return createHmac('sha256', secret)
    .update(ip.trim().toLowerCase())
    .digest('hex');
}
