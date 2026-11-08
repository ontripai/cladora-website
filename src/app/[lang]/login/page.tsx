import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import { LoginForm } from '@/components/auth/LoginForm';
import type { Language } from '@/types';
import { authCaptchaTemporarilyDisabled } from '@/lib/security/auth-captcha';
import { sanitizeAllowedNextRoute, isCoreServiceAssemblyProfile } from '@/lib/auth/post-auth-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  props: { params: Promise<{ lang: Language }> },
): Promise<Metadata> {
  const { lang } = await props.params;
  return getRouteMetadata('/login', lang);
}

export default async function LoginPage(props: {
  params: Promise<{ lang: Language }>;
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { lang } = await props.params;
  const { next, reason } = await props.searchParams;
  const captchaSiteKey = authCaptchaTemporarilyDisabled ? undefined : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;
  const captchaRequired = !authCaptchaTemporarilyDisabled && process.env.VERCEL_ENV === 'production';

  const isAssembly = typeof isCoreServiceAssemblyProfile === 'function' ? isCoreServiceAssemblyProfile() : false;
  const safeNext = typeof sanitizeAllowedNextRoute === 'function'
    ? sanitizeAllowedNextRoute(next, lang, isAssembly)
    : (next ? `/${lang}/${next}` : null);
  const safeNextKey = safeNext ? safeNext.replace(`/${lang}/`, '') : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC] pb-24 pt-32">
      <div className="mx-auto w-full max-w-md px-4">
        <LoginForm
          lang={lang}
          reason={reason}
          captchaRequired={captchaRequired}
          captchaSiteKey={captchaSiteKey}
          workspaceAccessRequested={safeNextKey === 'workspace-access'}
          caseAccessRequested={safeNextKey === 'cases'}
          ownerPortfolioRequested={safeNextKey === 'owner-portfolio'}
          accountRequested={safeNextKey === 'account'}
          invitationRequested={safeNextKey === 'invitation-continuation'}
        />
      </div>
    </main>
  );
}
