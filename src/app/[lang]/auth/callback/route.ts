import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  hasDuplicateCallbackParameters,
  hasForbiddenAuthQuery,
  hasUnexpectedQuery,
  isSupportedLocale,
  mapOtpErrorStatus,
  parseCallbackContract,
  resolveAuthEmailDestination,
  resolvePkceDestination,
} from '@/lib/auth/email-callback.mjs';
import { getPublicSupabaseEnv } from '@/lib/supabase/env';
import {
  createRecoverySessionToken,
  getClearRecoveryCookieOptions,
  getRecoveryCookieOptions,
  RECOVERY_COOKIE_NAME,
} from '@/lib/auth/recovery-cookie';
import type { Database } from '@/types/database.generated';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, private',
  'CDN-Cache-Control': 'no-store',
  'Surrogate-Control': 'no-store',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  Vary: 'Cookie',
};

function noStore(response: NextResponse): NextResponse {
  Object.entries(NO_STORE_HEADERS).forEach(([name, value]) => response.headers.set(name, value));
  return response;
}

function resultUrl(request: NextRequest, lang: string, status: string): URL {
  const locale = isSupportedLocale(lang) ? lang : 'ro';
  return new URL(`/${locale}/auth-result?status=${status}`, request.url);
}

function reject(request: NextRequest, lang: string, status: string): NextResponse {
  const response = noStore(NextResponse.redirect(resultUrl(request, lang, status)));
  response.cookies.set(
    RECOVERY_COOKIE_NAME,
    '',
    getClearRecoveryCookieOptions(request.url.startsWith('https:')),
  );
  return response;
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ lang: string }> },
) {
  const { lang } = await props.params;
  if (!isSupportedLocale(lang)) {
    return reject(request, 'ro', 'invalid_locale');
  }

  const searchParams = request.nextUrl.searchParams;
  if (
    hasForbiddenAuthQuery(searchParams) ||
    hasDuplicateCallbackParameters(searchParams) ||
    hasUnexpectedQuery(searchParams)
  ) {
    return reject(request, lang, 'unsafe');
  }

  const contract = parseCallbackContract(searchParams);
  if (!contract.valid) {
    return reject(request, lang, contract.reason || 'unsafe');
  }

  let destination: string | null = null;
  if (contract.kind === 'pkce') {
    destination = resolvePkceDestination(lang, contract.next);
  } else if (contract.kind === 'otp') {
    destination = resolveAuthEmailDestination(lang, contract.type, contract.next);
  }

  if (!destination) {
    return reject(request, lang, 'unsafe');
  }

  const response = NextResponse.redirect(new URL(destination, request.url));
  noStore(response);

  const cookieStore = await cookies();
  const { url, publishableKey } = getPublicSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Server response handles primary cookie header persistence.
          }
        });
      },
    },
  });

  let sessionUserId: string | null = null;
  let sessionId: string | undefined = undefined;
  let isRecovery = false;

  if (contract.kind === 'pkce') {
    const { data, error } = await supabase.auth.exchangeCodeForSession(contract.code);
    if (error || !data?.session?.user) {
      return reject(request, lang, 'expired');
    }
    sessionUserId = data.session.user.id;
    sessionId = (data.session as { id?: string }).id;

    if (destination.endsWith('/reset-password')) {
      const amr = (data.session.user as { amr?: Array<{ method: string }> })?.amr;
      const isOtpOrRecovery = !amr || amr.some((m) => m.method === 'otp' || m.method === 'recovery');
      if (isOtpOrRecovery) {
        isRecovery = true;
      } else {
        return reject(request, lang, 'unsafe');
      }
    }
  } else if (contract.kind === 'otp') {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: contract.tokenHash,
      type: contract.type,
    });
    if (error || !data?.session?.user) {
      return reject(request, lang, mapOtpErrorStatus(error?.code));
    }
    sessionUserId = data.session.user.id;
    sessionId = (data.session as { id?: string }).id;

    if (contract.type === 'recovery' && destination.endsWith('/reset-password')) {
      isRecovery = true;
    }
  }

  if (isRecovery && sessionUserId) {
    const isHttps = request.url.startsWith('https:');
    const token = createRecoverySessionToken(sessionUserId, sessionId);
    const cookieOpts = getRecoveryCookieOptions(isHttps);
    response.cookies.set(RECOVERY_COOKIE_NAME, token, cookieOpts);
    try {
      cookieStore.set(RECOVERY_COOKIE_NAME, token, cookieOpts);
    } catch {
      // Primary cookie persisted in response.cookies.
    }
  }

  return response;
}
