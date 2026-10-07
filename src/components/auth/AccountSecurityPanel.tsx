'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Language } from '@/types';
import { meetsPasswordPolicy, MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';

type TotpFactor = { id: string; friendly_name?: string; status: 'verified' | 'unverified' };
type Enrollment = { id: string; qrCode: string; secret: string };

const copy = {
  ro: { title: 'Securitatea reală a contului', mfa: 'Authenticator TOTP', enabled: 'Activat', disabled: 'Opțional · neactivat', enroll: 'Configurează 2FA', code: 'Cod de 6 cifre', verify: 'Verifică și activează', remove: 'Elimină factorul', currentPassword: 'Parola actuală', password: 'Parolă nouă (minimum 8 caractere, o literă și o cifră)', confirm: 'Confirmă parola', update: 'Schimbă parola', sessions: 'Deconectează celelalte sesiuni', logout: 'Ieșire securizată', saved: 'Modificarea a fost salvată.', generic: 'Operațiunea nu a putut fi finalizată.' },
  en: { title: 'Live account security', mfa: 'Authenticator TOTP', enabled: 'Enabled', disabled: 'Optional · not enabled', enroll: 'Set up 2FA', code: '6-digit code', verify: 'Verify and enable', remove: 'Remove factor', currentPassword: 'Current password', password: 'New password (minimum 8 characters, one letter and one number)', confirm: 'Confirm password', update: 'Change password', sessions: 'Sign out other sessions', logout: 'Secure sign out', saved: 'The change was saved.', generic: 'The operation could not be completed.' },
  fa: { title: 'امنیت واقعی حساب', mfa: 'برنامه Authenticator و TOTP', enabled: 'فعال', disabled: 'اختیاری · فعال نشده', enroll: 'راه‌اندازی 2FA', code: 'کد ۶ رقمی', verify: 'تأیید و فعال‌سازی', remove: 'حذف عامل دوم', currentPassword: 'رمز عبور فعلی', password: 'رمز جدید (حداقل ۸ نویسه، یک حرف و یک عدد)', confirm: 'تکرار رمز جدید', update: 'تغییر رمز عبور', sessions: 'خروج سایر نشست‌ها', logout: 'خروج امن', saved: 'تغییر با موفقیت ذخیره شد.', generic: 'انجام عملیات ممکن نشد.' },
} as const;

export function AccountSecurityPanel({ lang, continueTo }: { lang: Language; continueTo?: string }) {
  const t = copy[lang];
  const router = useRouter();
  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshFactors() {
    const { data, error: listError } = await createClient().auth.mfa.listFactors();
    if (listError) throw listError;
    setFactors((data?.totp ?? []) as TotpFactor[]);
  }

  useEffect(() => {
    let active = true;
    void createClient().auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!active) return;
      if (listError) setError(t.generic);
      else setFactors((data?.totp ?? []) as TotpFactor[]);
    });
    return () => { active = false; };
  }, [t.generic]);

  async function act(action: () => Promise<void>) {
    setBusy(true); setError(null); setMessage(null);
    try { await action(); } catch { setError(t.generic); }
    finally { setBusy(false); }
  }

  function beginEnrollment() {
    void act(async () => {
      const supabase = createClient();
      for (const factor of factors.filter((item) => item.status === 'unverified')) {
        const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (cleanupError) throw cleanupError;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'CLADORA Authenticator' });
      if (enrollError) throw enrollError;
      setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    });
  }

  function verifyEnrollment(event: FormEvent) {
    event.preventDefault();
    if (!enrollment || !/^\d{6}$/.test(code)) return;
    void act(async () => {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.id, code });
      if (verifyError) throw verifyError;
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance.currentLevel !== 'aal2') throw assuranceError ?? new Error('MFA assurance level was not elevated.');
      window.location.replace(continueTo ?? `/${lang}/app/dashboard`);
    });
  }

  function removeFactor(id: string) {
    void act(async () => {
      const { error: removeError } = await createClient().auth.mfa.unenroll({ factorId: id });
      if (removeError) throw removeError;
      setMessage(t.saved); await refreshFactors(); router.refresh();
    });
  }

  function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword || !meetsPasswordPolicy(password) || password !== confirmPassword) { setError(t.generic); return; }
    void act(async () => {
      const { error: updateError } = await createClient().auth.updateUser({ password, current_password: currentPassword });
      if (updateError) throw updateError;
      const { error: revokeError } = await createClient().auth.signOut({ scope: 'others' });
      if (revokeError) throw revokeError;
      setCurrentPassword(''); setPassword(''); setConfirmPassword(''); setMessage(t.saved);
    });
  }

  const verified = factors.filter((factor) => factor.status === 'verified');

  return (
    <section className="card-proptech space-y-5 bg-white p-6 md:col-span-2" aria-labelledby="account-security-title">
      <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-[#087A6E]" /><h2 id="account-security-title" className="text-sm font-extrabold text-[#102A43]">{t.title}</h2></div>
      <div className="rounded-xl bg-[#F6F9FC] p-4 text-xs"><div className="flex items-center justify-between"><span className="font-bold text-[#102A43]">{t.mfa}</span><span className={verified.length ? 'font-bold text-[#10B981]' : 'font-bold text-[#B54708]'}>{verified.length ? t.enabled : t.disabled}</span></div></div>
      {!verified.length && !enrollment && <button type="button" disabled={busy} onClick={beginEnrollment} className="rounded-xl bg-[#087A6E] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{t.enroll}</button>}
      {enrollment && <form onSubmit={verifyEnrollment} className="space-y-3 rounded-xl border border-[#B2E5DF] p-4">
        {/* Supabase returns this local data URI; it is never sent to another image host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qrCode} alt="TOTP QR code" className="h-44 w-44 bg-white p-2" />
        <code className="block break-all rounded bg-[#F6F9FC] p-2 text-[11px]" dir="ltr">{enrollment.secret}</code>
        <input aria-label={t.code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder={t.code} className="w-full rounded-xl border border-[#D3DCE6] px-3 py-2.5 text-xs" />
        <button disabled={busy || code.length !== 6} className="rounded-xl bg-[#087A6E] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{t.verify}</button>
      </form>}
      {verified.map((factor) => <div key={factor.id} className="flex items-center justify-between rounded-xl border border-[#D3DCE6] p-3 text-xs"><span>{factor.friendly_name || t.mfa}</span><button type="button" disabled={busy} onClick={() => removeFactor(factor.id)} className="font-bold text-[#B42318]">{t.remove}</button></div>)}
      <form onSubmit={changePassword} className="grid gap-3 border-t border-[#F0F4F8] pt-5 md:grid-cols-4">
        <input type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t.currentPassword} className="rounded-xl border border-[#D3DCE6] px-3 py-2.5 text-xs" />
        <input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.password} className="rounded-xl border border-[#D3DCE6] px-3 py-2.5 text-xs" />
        <input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.confirm} className="rounded-xl border border-[#D3DCE6] px-3 py-2.5 text-xs" />
        <button disabled={busy || !currentPassword || !meetsPasswordPolicy(password) || password !== confirmPassword} className="flex items-center justify-center gap-2 rounded-xl bg-[#102A43] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"><KeyRound className="h-4 w-4" />{t.update}</button>
      </form>
      <div className="flex flex-wrap gap-3 border-t border-[#F0F4F8] pt-5">
        <button type="button" disabled={busy} onClick={() => void act(async () => { const { error: e } = await createClient().auth.signOut({ scope: 'others' }); if (e) throw e; setMessage(t.saved); })} className="rounded-xl border border-[#D3DCE6] px-4 py-2.5 text-xs font-bold text-[#102A43]">{t.sessions}</button>
        <button type="button" disabled={busy} onClick={() => void act(async () => { const { error: e } = await createClient().auth.signOut({ scope: 'local' }); if (e) throw e; router.replace(`/${lang}/login`); router.refresh(); })} className="flex items-center gap-2 rounded-xl border border-[#F5B7B1] px-4 py-2.5 text-xs font-bold text-[#B42318]"><LogOut className="h-4 w-4" />{t.logout}</button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-[#087A6E]" />}
      </div>
      {message && <p role="status" className="text-xs font-semibold text-[#087A6E]">{message}</p>}
      {error && <p role="alert" className="text-xs font-semibold text-[#B42318]">{error}</p>}
    </section>
  );
}
