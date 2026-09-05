import type { NextRequest } from 'next/server';

const PRODUCTION_ORIGIN = 'https://cladora.ro';

/**
 * Validates request origin against strictly controlled origins:
 * 1. Primary Production Domain (https://cladora.ro)
 * 2. Exact configured site URL from NEXT_PUBLIC_SITE_URL
 * 3. Exact Vercel deployment preview origin (https://${process.env.VERCEL_URL})
 * 4. Explicit origins in ALLOWED_FORM_ORIGINS environment variable
 * 5. localhost / 127.0.0.1 ONLY in development (NODE_ENV === 'development')
 *
 * No broad wildcard pattern-matching on .vercel.app or ontrip domains.
 */
export function isAllowedOrigin(originHeader: string | null): boolean {
  if (!originHeader) return false;

  let originUrl: URL;
  try {
    originUrl = new URL(originHeader);
  } catch {
    return false;
  }

  const normalizedInputOrigin = originUrl.origin.toLowerCase();

  // 1. Primary Production Domain
  if (normalizedInputOrigin === PRODUCTION_ORIGIN) return true;

  // 2. Configured Site Origin from Env
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    try {
      if (normalizedInputOrigin === new URL(siteUrl).origin.toLowerCase()) return true;
    } catch {
      // ignore malformed env URL
    }
  }

  // 3. Exact current Vercel preview deployment URL
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const expectedVercelOrigin = `https://${vercelUrl.replace(/^https?:\/\//, '')}`.toLowerCase();
    if (normalizedInputOrigin === expectedVercelOrigin) return true;
  }

  // 4. Explicit list of allowed form origins
  const allowedFormOrigins = process.env.ALLOWED_FORM_ORIGINS?.trim();
  if (allowedFormOrigins) {
    const list = allowedFormOrigins
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (list.includes(normalizedInputOrigin)) return true;
  }

  // 5. Local Development ONLY
  if (process.env.NODE_ENV === 'development') {
    if (
      (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') &&
      (originUrl.protocol === 'http:' || originUrl.protocol === 'https:')
    ) {
      return true;
    }
  }

  return false;
}

export function validateRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    return isAllowedOrigin(origin);
  }

  // Fallback to referer header if origin is absent
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return isAllowedOrigin(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  return false;
}
