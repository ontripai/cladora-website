/**
 * Centralized Lead Security Configuration & Verification.
 * Enforces strict fail-closed policies for HMAC secrets, Supabase connectivity,
 * Turnstile configurations, and Webhook destinations across Production and Preview.
 */

export interface LeadServiceConfigValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Retrieves and validates the HMAC secret key.
 * Fail-closed in Production and Preview if missing or shorter than 32 characters.
 * Secret is never logged.
 */
export function getLeadSecuritySecret(): string {
  const secret = process.env.LEAD_IP_HASH_SECRET?.trim();
  const isProductionOrPreview =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview';

  if (!secret || secret.length < 32) {
    if (isProductionOrPreview) {
      throw new Error(
        'SECURITY_CONFIG_ERROR: LEAD_IP_HASH_SECRET is not configured or is fewer than 32 characters. Cannot process lead HMAC operations safely.'
      );
    }

    const allowDevFallback =
      process.env.ALLOW_DEV_FALLBACK_SECRET === 'true' ||
      process.env.NODE_ENV === 'test';

    if (allowDevFallback) {
      return 'dev-only-mock-secret-for-local-testing-32-chars';
    }

    throw new Error(
      'SECURITY_CONFIG_ERROR: LEAD_IP_HASH_SECRET is required (min 32 chars). Set ALLOW_DEV_FALLBACK_SECRET=true for offline development.'
    );
  }

  return secret;
}

/**
 * Validates service-level configuration before processing any lead mutations or rate limits.
 * Checks:
 * - Supabase credentials (URL, Publishable Key, Secret Key)
 * - HMAC Lead Secret (min 32 chars)
 * - Cloudflare Turnstile key consistency
 * - Webhook host allowlist consistency
 */
export function validateLeadServiceConfiguration(): LeadServiceConfigValidation {
  const isProductionOrPreview =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview';

  const allowLocalMock = process.env.ALLOW_MOCK_LEAD_CAPTURE === 'true';

  // 1. Supabase credentials check:
  // In production/preview (or in dev/test without explicit local mock flag), Supabase is mandatory.
  if (isProductionOrPreview || !allowLocalMock) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

    if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
      return {
        valid: false,
        reason: 'MISSING_SUPABASE_CONFIGURATION',
      };
    }
  }

  // 2. LEAD_IP_HASH_SECRET check (min 32 chars)
  const ipHashSecret = process.env.LEAD_IP_HASH_SECRET?.trim();
  const allowSecretFallback =
    process.env.ALLOW_DEV_FALLBACK_SECRET === 'true' ||
    process.env.NODE_ENV === 'test';

  if (!ipHashSecret || ipHashSecret.length < 32) {
    if (isProductionOrPreview || !allowSecretFallback) {
      return {
        valid: false,
        reason: 'INVALID_OR_MISSING_LEAD_SECRET',
      };
    }
  }

  // 3. Turnstile Configuration Consistency
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  const isTurnstileRequired = process.env.TURNSTILE_REQUIRED === 'true';

  if (isTurnstileRequired && (!turnstileSiteKey || !turnstileSecretKey)) {
    return {
      valid: false,
      reason: 'MISSING_REQUIRED_TURNSTILE_CONFIGURATION',
    };
  }

  if ((turnstileSiteKey && !turnstileSecretKey) || (!turnstileSiteKey && turnstileSecretKey)) {
    return {
      valid: false,
      reason: 'INCONSISTENT_TURNSTILE_CONFIGURATION',
    };
  }

  // 4. Webhook Allowlist Consistency
  const webhookUrl = process.env.CONTACT_NOTIFICATION_WEBHOOK_URL?.trim();
  const allowedHosts = process.env.CONTACT_NOTIFICATION_ALLOWED_HOSTS?.trim();

  if (webhookUrl) {
    if (!allowedHosts) {
      return {
        valid: false,
        reason: 'WEBHOOK_CONFIGURED_WITHOUT_ALLOWLIST',
      };
    }
  }

  return { valid: true };
}
