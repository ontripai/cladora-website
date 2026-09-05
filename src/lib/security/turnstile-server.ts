export interface TurnstileVerifyResult {
  success: boolean;
  bypassed?: boolean;
  errorCode?: string;
}

/**
 * Validates Cloudflare Turnstile token on the server.
 *
 * Production Policy:
 * - If TURNSTILE_REQUIRED=true (or secret key configured), validation is fail-closed.
 * - Missing or invalid token rejects the request.
 *
 * Preview / Local Development Policy:
 * - If keys are absent, bypass is logged non-sensitively without breaking development.
 * - If NEXT_PUBLIC_TURNSTILE_SITE_KEY is provided but TURNSTILE_SECRET_KEY is missing,
 *   a configuration error is produced.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  clientIp?: string
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const isProduction = process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV?.includes('preview');
  const isRequired = process.env.TURNSTILE_REQUIRED?.toLowerCase() === 'true' || isProduction;

  // 1. Misconfiguration: Site key set on client but secret key missing on server
  if (siteKey && !secretKey) {
    console.error('[SECURITY_CONFIG_ERROR] NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing.');
    return { success: false, errorCode: 'CAPTCHA_MISCONFIGURED' };
  }

  // 2. Keys missing scenario
  if (!secretKey) {
    if (isRequired && isProduction) {
      return { success: false, errorCode: 'CAPTCHA_REQUIRED_IN_PRODUCTION' };
    }
    // Local development or preview without keys: clean bypass
    return { success: true, bypassed: true };
  }

  // 3. Keys are present: Token must be provided and valid
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, errorCode: 'CAPTCHA_TOKEN_MISSING' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token.trim());
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, errorCode: 'CAPTCHA_SERVICE_UNAVAILABLE' };
    }

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      errorCode: Array.isArray(data['error-codes']) ? data['error-codes'][0] : 'CAPTCHA_VERIFICATION_FAILED',
    };
  } catch {
    return { success: false, errorCode: 'CAPTCHA_TIMEOUT' };
  }
}
