import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import { LoginForm } from '@/components/auth/LoginForm';
import type { Language } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  props: { params: Promise<{ lang: Language }> },
): Promise<Metadata> {
  const { lang } = await props.params;
  return getRouteMetadata('/login', lang);
}

export default async function LoginPage(props: { params: Promise<{ lang: Language }>; searchParams: Promise<{ next?: string }> }) {
  const { lang } = await props.params;
  const { next } = await props.searchParams;
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;
  const captchaRequired = process.env.VERCEL_ENV === 'production';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC] pb-24 pt-32">
      <div className="mx-auto w-full max-w-md px-4">
        <LoginForm
          lang={lang}
          captchaRequired={captchaRequired}
          captchaSiteKey={captchaSiteKey}
          workspaceAccessRequested={next === 'workspace-access' || next === `/${lang}/workspace-access`}
        />
      </div>
    </main>
  );
}
