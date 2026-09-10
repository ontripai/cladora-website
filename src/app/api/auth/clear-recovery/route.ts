import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getClearRecoveryCookieOptions, RECOVERY_COOKIE_NAME } from '@/lib/auth/recovery-cookie';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const isHttps = request.url.startsWith('https:');
  const clearOpts = getClearRecoveryCookieOptions(isHttps);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(RECOVERY_COOKIE_NAME, '', clearOpts);
  try {
    cookieStore.set(RECOVERY_COOKIE_NAME, '', clearOpts);
  } catch {
    // Primary cookie removal attached to response headers
  }

  return response;
}
