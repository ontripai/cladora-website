import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import {
  RECOVERY_COOKIE_NAME,
  verifyRecoverySessionToken,
  getClearRecoveryCookieOptions,
} from '@/lib/auth/recovery-cookie';
import type { Language } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const metadataCopy = {
  ro: { title: 'Setează o parolă nouă', description: 'Finalizează în siguranță recuperarea contului CLADORA.' },
  en: { title: 'Set a new password', description: 'Securely complete recovery of your CLADORA account.' },
  fa: { title: 'تعیین رمز عبور جدید', description: 'فرایند امن بازیابی حساب کلادورا را تکمیل کنید.' },
} as const;

export async function generateMetadata(props: { params: Promise<{ lang: Language }> }): Promise<Metadata> {
  const { lang } = await props.params;
  return {
    ...metadataCopy[lang],
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function ResetPasswordPage(props: { params: Promise<{ lang: Language }> }) {
  const { lang } = await props.params;
  if (!isSupabaseConfigured()) {
    redirect(`/${lang}/password-recovery-result?status=invalid`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    redirect(`/${lang}/password-recovery-result?status=invalid`);
  }

  const cookieStore = await cookies();
  const rawRecoveryCookie = cookieStore.get(RECOVERY_COOKIE_NAME)?.value;
  const verifiedRecovery = verifyRecoverySessionToken(rawRecoveryCookie);

  if (!verifiedRecovery || verifiedRecovery.userId !== data.claims.sub) {
    try {
      cookieStore.set(RECOVERY_COOKIE_NAME, '', getClearRecoveryCookieOptions());
    } catch {
      // Fallback if cookieStore is read-only in context
    }
    redirect(`/${lang}/password-recovery-result?status=invalid`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC] px-4 pb-24 pt-32">
      <div className="w-full max-w-md">
        <ResetPasswordForm lang={lang} />
      </div>
    </main>
  );
}
