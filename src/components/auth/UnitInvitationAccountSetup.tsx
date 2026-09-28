'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { meetsPasswordPolicy, MIN_PASSWORD_LENGTH } from '@/lib/auth/password-policy';
import type { Language } from '@/types';

export function UnitInvitationAccountSetup({ lang }: { lang: Language }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = `/${lang}/mfa/setup?next=invitation-continuation`;
  const fa = lang === 'fa';
  const ro = lang === 'ro';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetsPasswordPolicy(password) || password !== confirmation) {
      setError(fa ? 'رمز باید حداقل ۸ نویسه، یک حرف و یک عدد داشته باشد و با تکرار آن یکسان باشد.' : ro ? 'Parola trebuie să aibă cel puțin 8 caractere, o literă și o cifră; confirmarea trebuie să coincidă.' : 'Use at least 8 characters, one letter and one number, and match the confirmation.');
      return;
    }
    setBusy(true); setError('');
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError(fa ? 'ثبت رمز انجام نشد. دوباره تلاش کنید.' : ro ? 'Parola nu a putut fi salvată. Încercați din nou.' : 'Could not save your password. Try again.');
      setBusy(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return <div className="card-proptech space-y-5 bg-white p-8">
    <h1 className="text-xl font-bold">{fa ? 'تکمیل حساب CLADORA' : ro ? 'Finalizați contul CLADORA' : 'Complete your CLADORA account'}</h1>
    <p>{fa ? 'ایمیل شما تأیید شده است. اگر اولین بار است وارد CLADORA می‌شوید، رمز عبور خود را تعیین کنید؛ سپس احراز هویت دومرحله‌ای را فعال و دعوت را بپذیرید.' : ro ? 'Emailul este confirmat. Dacă sunteți nou, alegeți o parolă, apoi activați verificarea în doi pași și acceptați invitația.' : 'Your email is confirmed. If you are new, choose a password, then enable two-factor authentication and accept the invitation.'}</p>
    <form onSubmit={submit} className="space-y-3">
      <label className="block">{fa ? 'رمز عبور جدید' : ro ? 'Parolă nouă' : 'New password'}<input className="mt-1 block w-full rounded border p-2" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label className="block">{fa ? 'تکرار رمز عبور' : ro ? 'Confirmă parola' : 'Confirm password'}<input className="mt-1 block w-full rounded border p-2" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button disabled={busy} className="rounded bg-[#087A6E] px-4 py-3 font-semibold text-white disabled:opacity-50">{fa ? 'ثبت رمز و ادامه' : ro ? 'Salvează parola și continuă' : 'Save password and continue'}</button>
    </form>
    <Link href={next} className="block text-[#087A6E] underline">{fa ? 'قبلاً حساب دارم؛ ادامه به احراز هویت دومرحله‌ای' : ro ? 'Am deja cont; continuă la verificarea în doi pași' : 'I already have an account; continue to two-factor authentication'}</Link>
  </div>;
}
