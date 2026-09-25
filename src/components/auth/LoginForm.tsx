'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Lock, Mail, PlayCircle } from 'lucide-react';
import type { Language } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { CladoraBrand } from '@/components/brand/CladoraBrand';
import { resolvePostAuthRoute } from '@/lib/auth/post-auth-route';

interface LoginFormProps {
  lang: Language;
  captchaRequired: boolean;
  captchaSiteKey?: string;
  workspaceAccessRequested?: boolean;
  caseAccessRequested?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ lang, captchaRequired, captchaSiteKey, workspaceAccessRequested = false, caseAccessRequested = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const configured = isSupabaseConfigured();
  const captchaConfigured = Boolean(captchaSiteKey);
  const captchaNeeded = captchaRequired || captchaConfigured;
  const captchaBlocked = captchaRequired && !captchaConfigured;

  const captchaMissingMessage =
    lang === 'ro'
      ? 'Verificarea anti-abuz este obligatorie, dar nu este configurată. Contactează administratorul.'
      : lang === 'fa'
        ? 'بررسی ضدسوءاستفاده الزامی است اما پیکربندی نشده؛ با مدیر سامانه تماس بگیرید.'
        : 'Abuse protection is required but not configured. Contact the administrator.';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!configured) {
      setError(
        lang === 'ro'
          ? 'Conexiunea securizată nu este configurată încă.'
          : lang === 'fa'
            ? 'اتصال امن Supabase هنوز پیکربندی نشده است.'
            : 'The secure Supabase connection is not configured yet.',
      );
      return;
    }
    if (captchaBlocked) {
      setError(captchaMissingMessage);
      return;
    }
    if (captchaNeeded && !captchaToken) {
      setError(
        lang === 'ro'
          ? 'Finalizează verificarea anti-abuz înainte de autentificare.'
          : lang === 'fa'
            ? 'پیش از ورود، بررسی ضدسوءاستفاده را کامل کنید.'
            : 'Complete the abuse-protection check before signing in.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken: captchaToken ?? undefined },
      });

      if (signInError) {
        setCaptchaToken(null);
        setCaptchaAttempt((value) => value + 1);
        setError(
          lang === 'ro'
            ? 'Emailul sau parola nu sunt corecte.'
            : lang === 'fa'
              ? 'ایمیل یا رمز عبور صحیح نیست.'
              : 'The email or password is incorrect.',
        );
        return;
      }

      let destination: string;
      try {
        destination = await resolvePostAuthRoute(supabase, lang);
        if (workspaceAccessRequested && !destination.includes('/platform/')) {
          destination = destination.includes('/mfa')
            ? `${destination}${destination.includes('?') ? '&' : '?'}next=workspace-access`
            : `/${lang}/workspace-access`;
        }
        if (caseAccessRequested && !destination.includes('/platform/')) {
          destination = destination.includes('/mfa')
            ? `${destination}${destination.includes('?') ? '&' : '?'}next=cases`
            : `/${lang}/cases`;
        }
      } catch {
        await supabase.auth.signOut();
        setError(
          lang === 'ro'
            ? 'Starea de securitate a contului nu a putut fi verificată.'
            : lang === 'fa'
              ? 'وضعیت امنیتی حساب قابل بررسی نبود.'
              : 'The account security state could not be verified.',
        );
        return;
      }

      // A full document navigation makes the newly issued Auth/MFA cookies
      // visible to the first server-rendered protected route.
      window.location.replace(destination);
    } catch {
      setCaptchaToken(null);
      setCaptchaAttempt((value) => value + 1);
      setError(
        lang === 'ro'
          ? 'Autentificarea nu a putut fi finalizată.'
          : lang === 'fa'
            ? 'فرایند ورود قابل تکمیل نبود.'
            : 'Sign-in could not be completed.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card-proptech space-y-6 border-[#D3DCE6] bg-white p-8 shadow-elevated">
      <div className="space-y-2 text-center">
        <CladoraBrand variant="symbol" decorative className="mx-auto h-12 w-12" />
        <h1 className="font-display text-2xl font-extrabold text-[#102A43]">
          {lang === 'ro'
            ? 'Autentificare în CLADORA'
            : lang === 'fa'
              ? 'ورود به سامانه کلادورا'
              : 'Sign in to CLADORA'}
        </h1>
        <p className="text-xs text-[#334E68]">
          {lang === 'ro'
            ? 'Accesează panoul de control al asociației sau portofoliului tău'
            : lang === 'fa'
              ? 'دسترسی به میز کار اختصاصی مجتمع مسکونی یا سبد املاک'
              : 'Access your condominium or portfolio workspace'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="loginEmail" className="mb-1 block text-xs font-bold text-[#102A43]">
            {lang === 'fa' ? 'پست الکترونیک (ایمیل)' : 'Email'}
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-[#486581]" />
            <input
              id="loginEmail"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-xl border border-[#D3DCE6] py-2.5 pe-3 ps-9 text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#087A6E]"
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="loginPassword" className="text-xs font-bold text-[#102A43]">
              {lang === 'ro' ? 'Parolă' : lang === 'fa' ? 'رمز عبور' : 'Password'}
            </label>
            <Link href={`/${lang}/forgot-password`} className="text-[11px] font-semibold text-[#087A6E] hover:underline">
              {lang === 'ro' ? 'Ai uitat parola?' : lang === 'fa' ? 'فراموشی رمز عبور؟' : 'Forgot password?'}
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-[#486581]" />
            <input
              id="loginPassword"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-[#D3DCE6] py-2.5 pe-3 ps-9 text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#087A6E]"
            />
          </div>
        </div>

        {captchaSiteKey && (
          <TurnstileWidget
            key={captchaAttempt}
            siteKey={captchaSiteKey}
            lang={lang}
            onToken={setCaptchaToken}
          />
        )}

        {captchaBlocked && (
          <p role="alert" className="rounded-xl border border-[#F5B7B1] bg-[#FFF1F0] px-3 py-2 text-xs font-semibold text-[#B42318]">
            {captchaMissingMessage}
          </p>
        )}
        {error && !captchaBlocked && (
          <p role="alert" className="rounded-xl border border-[#F5B7B1] bg-[#FFF1F0] px-3 py-2 text-xs font-semibold text-[#B42318]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || captchaBlocked || (captchaNeeded && !captchaToken)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087A6E] px-4 py-3 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#065F55] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>
            {isSubmitting
              ? lang === 'ro'
                ? 'Se verifică…'
                : lang === 'fa'
                  ? 'در حال بررسی…'
                  : 'Signing in…'
              : lang === 'ro'
                ? 'Intră în Cont'
                : lang === 'fa'
                  ? 'ورود به حساب کاربری'
                  : 'Sign in to Account'}
          </span>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 rtl:rotate-180" />}
        </button>
      </form>

      <div className="space-y-3 border-t border-[#F0F4F8] pt-4 text-center">
        <div className="text-xs text-[#334E68]">
          {lang === 'ro'
            ? 'Nu ai cont încă? Testează fără autentificare:'
            : lang === 'fa'
              ? 'حساب کاربری ندارید؟ ورود مستقیم به دموی تعاملی:'
              : 'No credentials yet? Explore the sandbox:'}
        </div>
        <Link
          href={`/${lang}/demo`}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#B2E5DF] bg-[#EAF8F5] px-4 py-2.5 text-xs font-bold text-[#087A6E] transition-all hover:bg-[#087A6E] hover:text-white"
        >
          <PlayCircle className="h-4 w-4" />
          <span>
            {lang === 'ro'
              ? 'Deschide Demo Interactiv Gratuit'
              : lang === 'fa'
                ? 'ورود به دموی آزمایشی رایگان'
                : 'Launch Free Interactive Demo'}
          </span>
        </Link>
      </div>
    </div>
  );
};
