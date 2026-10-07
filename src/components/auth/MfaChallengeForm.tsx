'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Language } from '@/types';

export function MfaChallengeForm({ lang, continueTo }: { lang: Language; continueTo: string }) {
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((factor) => factor.status === 'verified');
      if (!active) return;
      if (listError || !verified) {
        setError(lang === 'fa' ? 'عامل دوم معتبر پیدا نشد.' : lang === 'ro' ? 'Nu a fost găsit un factor valid.' : 'No verified second factor was found.');
      } else {
        setFactorId(verified.id);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [lang]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setError(lang === 'fa' ? 'کد تأیید صحیح نیست یا منقضی شده است.' : lang === 'ro' ? 'Codul este incorect sau a expirat.' : 'The verification code is invalid or expired.');
      setLoading(false);
      return;
    }
    // challengeAndVerify persists the AAL2 session. Reload the document so the
    // protected server layout receives that updated session immediately.
    window.location.replace(continueTo);
  }

  return (
    <form onSubmit={verify} className="card-proptech w-full max-w-md space-y-5 bg-white p-8 shadow-elevated">
      <ShieldCheck className="mx-auto h-10 w-10 text-[#087A6E]" />
      <div className="text-center">
        <h1 className="text-xl font-extrabold text-[#102A43]">{lang === 'fa' ? 'تأیید دومرحله‌ای' : lang === 'ro' ? 'Verificare în doi pași' : 'Two-step verification'}</h1>
        <p className="mt-2 text-xs text-[#52667A]">{lang === 'fa' ? 'کد ۶ رقمی برنامه Authenticator را وارد کنید.' : lang === 'ro' ? 'Introdu codul de 6 cifre din aplicația Authenticator.' : 'Enter the 6-digit code from your authenticator app.'}</p>
      </div>
      <input aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl border border-[#D3DCE6] px-4 py-3 text-center text-xl tracking-[0.5em] focus:ring-2 focus:ring-[#087A6E]" />
      {error && <p role="alert" className="rounded-xl bg-[#FFF1F0] p-3 text-xs font-semibold text-[#B42318]">{error}</p>}
      <button disabled={loading || !factorId || code.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087A6E] px-4 py-3 text-xs font-extrabold text-white disabled:opacity-60">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {lang === 'fa' ? 'تأیید و ادامه' : lang === 'ro' ? 'Verifică și continuă' : 'Verify and continue'}
      </button>
    </form>
  );
}
