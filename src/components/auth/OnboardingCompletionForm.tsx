'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/types';

const errors = {
  fa: { generic: 'تکمیل راه‌اندازی انجام نشد. کد خطا را برای پشتیبانی ارسال کنید.', origin: 'دامنهٔ درخواست پذیرفته نشد. صفحه را در دامنهٔ اصلی سایت باز کنید.', mfa: 'تأیید دومرحله‌ای این نشست لازم است؛ از صفحهٔ ورود دوباره تأیید کنید.', conflict: 'اطلاعات محیط کاری تغییر کرده است؛ صفحه را تازه کنید و دوباره تلاش کنید.', auth: 'نشست ورود معتبر نیست؛ دوباره وارد شوید.', network: 'ارتباط برقرار نشد؛ پیش از تلاش مجدد صفحه را تازه کنید تا وضعیت ثبت بررسی شود.' },
  ro: { generic: 'Configurarea nu a putut fi finalizată. Trimite codul erorii către suport.', origin: 'Originea cererii nu a fost acceptată. Deschide pagina pe domeniul principal.', mfa: 'Sesiunea necesită verificare în doi pași. Confirmă din nou prin pagina de autentificare.', conflict: 'Datele spațiului s-au modificat. Reîncarcă pagina și încearcă din nou.', auth: 'Sesiunea nu este validă. Autentifică-te din nou.', network: 'Conexiunea a eșuat. Reîncarcă pagina pentru a verifica starea înainte de a reîncerca.' },
  en: { generic: 'Setup could not be completed. Send the error code to support.', origin: 'The request origin was rejected. Open this page on the main site domain.', mfa: 'This session requires two-factor verification. Verify again through the sign-in page.', conflict: 'Workspace information changed. Reload this page and try again.', auth: 'The session is invalid. Sign in again.', network: 'Connection failed. Reload to check the saved state before retrying.' },
};

const copy = {
  ro: { title: 'Finalizează activarea spațiului', body: 'Confirmă profilul, activează TOTP și încheie verificarea administratorului principal.', action: 'Finalizează onboarding-ul', success: 'Onboarding finalizat. Spațiul poate fi activat de CLADORA.', error: 'Finalizarea nu a fost posibilă. Verifică MFA și încearcă din nou.' },
  en: { title: 'Complete workspace activation', body: 'Confirm your profile, enable TOTP, and finish the primary administrator verification.', action: 'Complete onboarding', success: 'Onboarding completed. CLADORA can now activate the workspace.', error: 'Completion failed. Verify MFA and try again.' },
  fa: { title: 'تکمیل فعال‌سازی فضای کاری', body: 'پروفایل را تأیید، TOTP را فعال و بررسی مدیر اصلی را تکمیل کنید.', action: 'تکمیل راه‌اندازی', success: 'راه‌اندازی تکمیل شد و کلادورا می‌تواند فضای کاری را فعال کند.', error: 'تکمیل ممکن نشد؛ MFA را بررسی و دوباره تلاش کنید.' },
} as const;

export function OnboardingCompletionForm({ lang, workspaceId, version, completed }: { lang: Language; workspaceId: string; version: number; completed: boolean }) {
  const t = copy[lang]; const router = useRouter();
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null); const [error,setError]=useState<string|null>(null);
  async function complete() {
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/auth/complete-onboarding',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace_id:workspaceId,expected_version:version,reason:'Primary administrator completed the secure onboarding checklist'})});
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const known = ['ORIGIN_REJECTED', 'MFA_REQUIRED', 'CONCURRENCY_CONFLICT', 'AUTHENTICATION_REQUIRED', 'ONBOARDING_REJECTED', 'INVALID_PAYLOAD'];
        const code = known.includes(body?.error?.code) ? body.error.code : 'UNKNOWN_ERROR';
        const e = errors[lang];
        const message = code === 'ORIGIN_REJECTED' ? e.origin : code === 'MFA_REQUIRED' ? e.mfa : code === 'CONCURRENCY_CONFLICT' ? e.conflict : code === 'AUTHENTICATION_REQUIRED' ? e.auth : e.generic;
        setError(`${message} (${code})`);
        return;
      }
      setMessage(t.success); router.refresh();
    } catch { setError(errors[lang].network); }
    finally { setBusy(false); }
  }
  return <section className="card-proptech space-y-4 bg-white p-6"><h1 className="text-xl font-extrabold text-[#102A43]">{t.title}</h1><p className="text-sm text-[#334E68]">{t.body}</p><button type="button" disabled={busy || completed} onClick={complete} className="rounded-xl bg-[#087A6E] px-5 py-3 text-xs font-extrabold text-white disabled:opacity-60">{t.action}</button>{(completed||message)&&<p role="status" className="text-xs font-semibold text-[#087A6E]">{message ?? t.success}</p>}{error&&<p role="alert" className="text-xs font-semibold text-[#B42318]">{error}</p>}</section>;
}
