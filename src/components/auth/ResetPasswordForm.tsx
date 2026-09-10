'use client';

import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CladoraBrand } from '@/components/brand/CladoraBrand';
import { createClient } from '@/lib/supabase/client';
import type { Language } from '@/types';
import { meetsPasswordPolicy, MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';

type Props = { lang: Language; flow?: 'recovery' | 'invitation' };

import { mapUpdateUserError, recoveryErrorCopy, type RecoveryErrorCode } from '@/lib/auth/recovery-errors';

export type { RecoveryErrorCode };
export { mapUpdateUserError };

const copy = {
  ro: {
    title: 'Alege o parolă nouă',
    intro: 'Setează o parolă de cel puțin 8 caractere, cu minimum o literă și o cifră.',
    password: 'Parolă nouă',
    confirm: 'Confirmă parola',
    submit: 'Actualizează parola',
    working: 'Se actualizează…',
    mismatch: 'Parolele nu coincid.',
    weak: 'Parola trebuie să aibă cel puțin 8 caractere, o literă și o cifră.',
    invitationTitle: 'Setează parola contului',
    invitationIntro: 'Finalizează activarea cu o parolă de minimum 8 caractere, o literă și o cifră.',
    invitationFailed: 'Parola nu a putut fi setată. Reia invitația sau solicită asistență.',
  },
  en: {
    title: 'Choose a new password',
    intro: 'Set a password with at least 8 characters, including one letter and one number.',
    password: 'New password',
    confirm: 'Confirm password',
    submit: 'Update password',
    working: 'Updating…',
    mismatch: 'Passwords do not match.',
    weak: 'The password must contain at least 8 characters, one letter, and one number.',
    invitationTitle: 'Set your account password',
    invitationIntro: 'Complete activation with at least 8 characters, one letter, and one number.',
    invitationFailed: 'The password could not be set. Restart the invitation or request assistance.',
  },
  fa: {
    title: 'انتخاب رمز عبور جدید',
    intro: 'رمزی با حداقل ۸ نویسه، شامل دست‌کم یک حرف و یک عدد تعیین کنید.',
    password: 'رمز عبور جدید',
    confirm: 'تکرار رمز عبور',
    submit: 'به‌روزرسانی رمز عبور',
    working: 'در حال به‌روزرسانی…',
    mismatch: 'رمزهای عبور یکسان نیستند.',
    weak: 'رمز عبور باید حداقل ۸ نویسه و شامل یک حرف و یک عدد باشد.',
    invitationTitle: 'تعیین رمز عبور حساب',
    invitationIntro: 'فعال‌سازی را با رمزی حداقل ۸ نویسه‌ای شامل یک حرف و یک عدد تکمیل کنید.',
    invitationFailed: 'تعیین رمز عبور انجام نشد. دعوت‌نامه را دوباره آغاز کنید یا پشتیبانی بخواهید.',
  },
} as const;

export function ResetPasswordForm({ lang, flow = 'recovery' }: Props) {
  const t = copy[lang];
  const title = flow === 'invitation' ? t.invitationTitle : t.title;
  const intro = flow === 'invitation' ? t.invitationIntro : t.intro;
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!meetsPasswordPolicy(password)) {
      setError(t.weak);
      return;
    }
    if (password !== confirmation) {
      setError(t.mismatch);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        if (flow === 'invitation') {
          setError(t.invitationFailed);
        } else {
          const errCode = mapUpdateUserError(updateError);
          setError(recoveryErrorCopy[lang][errCode]);
        }
        return;
      }

      try {
        await fetch('/api/auth/clear-recovery', { method: 'POST' });
      } catch {
        // Non-fatal; global sign out invalidates refresh tokens on server.
      }

      await supabase.auth.signOut({ scope: 'global' });
      router.replace(
        flow === 'invitation'
          ? `/${lang}/invitation-result?status=completed`
          : `/${lang}/password-recovery-result?status=updated`,
      );
      router.refresh();
    } catch (unexpected) {
      if (flow === 'invitation') {
        setError(t.invitationFailed);
      } else {
        const errCode = mapUpdateUserError(unexpected);
        setError(recoveryErrorCopy[lang][errCode]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-proptech space-y-6 border-[#D3DCE6] bg-white p-8 shadow-elevated">
      <div className="space-y-2 text-center">
        <CladoraBrand variant="symbol" decorative className="mx-auto h-12 w-12" />
        <h1 className="text-2xl font-extrabold text-[#102A43]">{title}</h1>
        <p className="text-xs leading-5 text-[#334E68]">{intro}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label htmlFor="newPassword" className="block text-xs font-bold text-[#102A43]">
          {t.password}
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-[#486581]" />
          <input
            id="newPassword"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-[#D3DCE6] py-2.5 pe-3 ps-9 text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#087A6E]"
          />
        </div>

        <label htmlFor="confirmPassword" className="block text-xs font-bold text-[#102A43]">
          {t.confirm}
        </label>
        <input
          id="confirmPassword"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="w-full rounded-xl border border-[#D3DCE6] px-3 py-2.5 text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#087A6E]"
        />

        {error && (
          <p role="alert" className="rounded-xl border border-[#F5B7B1] bg-[#FFF1F0] px-3 py-2 text-xs font-semibold text-[#B42318]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#087A6E] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#065F55] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              <span>{t.working}</span>
            </>
          ) : (
            <span>{t.submit}</span>
          )}
        </button>
      </form>
    </div>
  );
}
