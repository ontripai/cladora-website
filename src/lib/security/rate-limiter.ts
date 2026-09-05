import { isSupabaseConfigured } from '../supabase/env.ts';
import { RATE_LIMIT_CONFIG, type RateLimitAction } from '../../config/rate-limits.ts';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  currentCount: number;
}

export { RATE_LIMIT_CONFIG };

/**
 * Checks and increments persistent rate limit using Supabase table marketing_rate_limits.
 * Operates on an atomic window-bucket UPSERT in the database.
 *
 * Security Policy: Fail-Closed in Production and Preview upon any DB/RPC error.
 */
export async function checkRateLimit(
  actionKey: string,
  action: RateLimitAction
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIG[action];
  const maxRequests = config.maxRequests;
  const windowSeconds = config.windowSeconds;

  const isProductionOrPreview =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview';

  // If Supabase is not configured
  if (!isSupabaseConfigured()) {
    if (isProductionOrPreview) {
      console.error('[SECURITY_FAIL_CLOSED] Supabase not configured in production/preview. Rejecting rate limit.');
      return {
        allowed: false,
        retryAfterSeconds: windowSeconds,
        currentCount: maxRequests + 1,
      };
    }

    const allowMock =
      process.env.ALLOW_MOCK_LEAD_CAPTURE === 'true' ||
      process.env.NODE_ENV === 'test';

    if (allowMock) {
      return {
        allowed: true,
        retryAfterSeconds: 0,
        currentCount: 1,
      };
    }

    return {
      allowed: false,
      retryAfterSeconds: windowSeconds,
      currentCount: maxRequests + 1,
    };
  }

  try {
    const { createAdminClient } = await import('../supabase/admin.ts');
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('consume_marketing_rate_limit', {
      p_action_key: actionKey,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    const rows = data as unknown as Array<{
      allowed: boolean;
      retry_after_seconds: number;
      current_count: number;
    }> | null;

    if (error || !rows || rows.length === 0) {
      console.error('[SECURITY_FAIL_CLOSED] Rate limit RPC check failed:', error?.message);
      // Fail-closed in production/preview
      return {
        allowed: false,
        retryAfterSeconds: windowSeconds,
        currentCount: maxRequests + 1,
      };
    }

    const row = rows[0];
    return {
      allowed: Boolean(row.allowed),
      retryAfterSeconds: Number(row.retry_after_seconds) || 0,
      currentCount: Number(row.current_count) || 1,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SECURITY_FAIL_CLOSED] Rate limit execution exception:', msg);
    return {
      allowed: false,
      retryAfterSeconds: windowSeconds,
      currentCount: maxRequests + 1,
    };
  }
}
