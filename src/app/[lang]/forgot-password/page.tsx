import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import type { Language } from '@/types';
import { authCaptchaTemporarilyDisabled } from '@/lib/security/auth-captcha';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const metadataCopy = {
  ro: { title: 'Recuperare parolă', description: 'Solicită în siguranță instrucțiuni pentru recuperarea accesului la contul CLADORA.' },
  en: { title: 'Password recovery', description: 'Securely request instructions to recover access to your CLADORA account.' },
  fa: { title: 'بازیابی رمز عبور', description: 'درخواست امن راهنمای بازیابی دسترسی به حساب کاربری کلادورا.' },
} as const;

export async function generateMetadata(props: { params: Promise<{ lang: Language }> }): Promise<Metadata> {
  const { lang } = await props.params;
  return {
    ...metadataCopy[lang],
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function ForgotPasswordPage(props: { params: Promise<{ lang: Language }> }) {
  const { lang } = await props.params;
  const captchaSiteKey = authCaptchaTemporarilyDisabled ? undefined : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;
  const captchaRequired = !authCaptchaTemporarilyDisabled && process.env.VERCEL_ENV === 'production';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC] px-4 pb-24 pt-32">
      <div className="w-full max-w-md">
        <ForgotPasswordForm
          lang={lang}
          captchaRequired={captchaRequired}
          captchaSiteKey={captchaSiteKey}
        />
      </div>
    </main>
  );
}
