'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
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
    authenticator: 'Cod Authenticator',
    authenticatorIntro: 'Contul este protejat prin MFA. Introdu codul de 6 cifre pentru a continua.',
    authenticatorRequired: 'Introdu codul de 6 cifre din aplicația Authenticator.',
    authenticatorInvalid: 'Codul Authenticator este incorect sau a expirat.',
    authenticatorUnavailable: 'Verificarea MFA nu este disponibilă momentan. Solicită un link nou sau contactează suportul.',
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
    authenticator: 'Authenticator code',
    authenticatorIntro: 'This account is protected by MFA. Enter the 6-digit code to continue.',
    authenticatorRequired: 'Enter the 6-digit code from your authenticator app.',
    authenticatorInvalid: 'The authenticator code is invalid or expired.',
    authenticatorUnavailable: 'MFA verification is currently unavailable. Request a new link or contact support.',
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
    authenticator: 'کد Authenticator',
    authenticatorIntro: 'این حساب با MFA محافظت می‌شود. برای ادامه کد ۶ رقمی را وارد کنید.',
    authenticatorRequired: 'کد ۶ رقمی برنامه Authenticator را وارد کنید.',
    authenticatorInvalid: 'کد Authenticator نادرست است یا منقضی شده است.',
    authenticatorUnavailable: 'تأیید MFA اکنون در دسترس نیست. پیوند جدیدی درخواست کنید یا با پشتیبانی تماس بگیرید.',
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
  const [assuranceChecking, setAssuranceChecking] = useState(flow === 'recovery');
  const [assuranceBlocked, setAssuranceBlocked] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    if (flow !== 'recovery') return;

    let active = true;
    void (async () => {
      const supabase = createClient();
      const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] =
        await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ]);

      if (!active) return;
      if (assuranceError || factorsError) {
        setAssuranceBlocked(true);
        setError(t.authenticatorUnavailable);
      } else if (assurance?.currentLevel !== 'aal2' && assurance?.nextLevel === 'aal2') {
        const verifiedTotp = factors?.totp.find((factor) => factor.status === 'verified');
        if (verifiedTotp) {
          setTotpFactorId(verifiedTotp.id);
        } else {
          setAssuranceBlocked(true);
          setError(t.authenticatorUnavailable);
        }
      }
      setAssuranceChecking(false);
    })();

    return () => {
      active = false;
    };
  }, [flow, t.authenticatorUnavailable]);

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
    if (totpFactorId && !/^\d{6}$/.test(totpCode)) {
      setError(t.authenticatorRequired);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      if (flow === 'recovery' && totpFactorId) {
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: totpFactorId,
          code: totpCode,
        });
        if (verifyError) {
          setError(t.authenticatorInvalid);
          return;
        }

        const { data: assurance, error: assuranceError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError || assurance?.currentLevel !== 'aal2') {
          setError(t.authenticatorUnavailable);
          return;
        }
      }

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

        {flow === 'recovery' && totpFactorId && (
          <div className="space-y-3 rounded-xl border border-[#B8D8D3] bg-[#F0FAF8] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#087A6E]" aria-hidden="true" />
              <div>
                <label htmlFor="recoveryTotpCode" className="block text-xs font-bold text-[#102A43]">
                  {t.authenticator}
                </label>
                <p className="mt-1 text-xs leading-5 text-[#52667A]">{t.authenticatorIntro}</p>
              </div>
            </div>
            <input
              id="recoveryTotpCode"
              name="totpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ''))}
              className="w-full rounded-xl border border-[#B8D8D3] bg-white px-4 py-2.5 text-center text-lg tracking-[0.35em] text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#087A6E]"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-[#F5B7B1] bg-[#FFF1F0] px-3 py-2 text-xs font-semibold text-[#B42318]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || assuranceChecking || assuranceBlocked}
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
