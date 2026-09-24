import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Auth callback and result routes intentionally bypass Proxy so credentials are handled only by the callback route.
export const config = {
  matcher: [
    '/:lang(ro|en|fa)/app/:path*',
    '/:lang(ro|en|fa)/login',
    '/:lang(ro|en|fa)/forgot-password',
    '/:lang(ro|en|fa)/reset-password',
    '/:lang(ro|en|fa)/password-recovery-result',
    '/:lang(ro|en|fa)/invitation-continuation',
    '/:lang(ro|en|fa)/set-password',
    '/:lang(ro|en|fa)/workspace-access',
    '/:lang(ro|en|fa)/platform/:path+',
  ],
};
