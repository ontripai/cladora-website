'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { Mail, MapPin, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { trackEvent } from '@/lib/analytics/events';

interface ContactFormProps {
  lang: Language;
}

const copy = {
  ro: {
    home: 'Acasă',
    contact: 'Contact',
    badge: 'Hai să vorbim',
    heading: 'Contactează echipa CLADORA',
    description:
      'Suntem aici pentru a răspunde întrebărilor tale despre migrarea structurată a asociației, integrarea portofoliului sau înscrierea în programul pilot din București și Ilfov.',
    emailLabel: 'contact@cladora.ro',
    locationLabel: 'București & Ilfov, România',
    fullName: 'Nume & Prenume',
    fullNamePlaceholder: 'Ion Popescu',
    email: 'Email',
    emailPlaceholder: 'contact@example.com',
    message: 'Mesaj sau detalii clădire',
    messagePlaceholder: 'Avem un bloc de 80 apartamente în Sector 1...',
    privacyConsent:
      'Am citit și sunt de acord cu Politica de confidențialitate privind prelucrarea datelor transmise prin acest formular.',
    privacyLinkText: 'Politica de confidențialitate',
    sending: 'Se trimite...',
    send: 'Trimite Mesajul',
    successTitle: 'Mesaj transmis cu succes!',
    successDesc:
      'Solicitarea ta a fost înregistrată în siguranță în sistem. Un specialist CLADORA te va contacta în cel mai scurt timp.',
    refLabel: 'Cod de referință solicitare',
    sendAnother: 'Trimite un alt mesaj',
    errorTitle: 'Eroare la transmiterea mesajului',
    defaultError: 'A apărut o problemă temporară la procesarea mesajului. Te rugăm să reîncerci.',
    tryAgain: 'Reîncearcă transmiterea',
  },
  en: {
    home: 'Home',
    contact: 'Contact Us',
    badge: 'Get in Touch',
    heading: 'Contact CLADORA Team',
    description:
      'We are here to assist with migration assessments, portfolio onboarding, or pilot enrollment across residential communities.',
    emailLabel: 'contact@cladora.ro',
    locationLabel: 'Bucharest & Ilfov, Romania',
    fullName: 'Full Name',
    fullNamePlaceholder: 'John Doe',
    email: 'Email Address',
    emailPlaceholder: 'contact@example.com',
    message: 'Message or Building Details',
    messagePlaceholder: 'We manage an 80-unit condominium in Bucharest...',
    privacyConsent:
      'I have read and agree to the Privacy Policy regarding the processing of personal data submitted via this form.',
    privacyLinkText: 'Privacy Policy',
    sending: 'Sending...',
    send: 'Send Message',
    successTitle: 'Message Sent Successfully!',
    successDesc:
      'Your request has been securely recorded in our system. A CLADORA specialist will follow up shortly.',
    refLabel: 'Reference Code',
    sendAnother: 'Send another message',
    errorTitle: 'Submission Error',
    defaultError: 'A temporary error occurred while processing your request. Please try again.',
    tryAgain: 'Try Again',
  },
  fa: {
    home: 'صفحه اصلی',
    contact: 'تماس با ما',
    badge: 'گفت‌وگو با ما',
    heading: 'ارتباط با تیم پشتیبانی کلادورا',
    description:
      'ما آماده پاسخگویی به پرسش‌های شما در خصوص فرایند مهاجرت سوابق، اتصال سبد املاک یا ثبت‌نام در برنامه پایلوت هستیم.',
    emailLabel: 'contact@cladora.ro',
    locationLabel: 'بخارست و ایلفوف، رومانی',
    fullName: 'نام و نام خانوادگی',
    fullNamePlaceholder: 'مثال: علی رضایی',
    email: 'پست الکترونیک (ایمیل)',
    emailPlaceholder: 'contact@example.com',
    message: 'متن پیام یا مشخصات ساختمان',
    messagePlaceholder: 'مجتمع مسکونی ما دارای ۶۰ واحد آپارتمان است...',
    privacyConsent:
      'سیاست حفظ حریم خصوصی را مطالعه نموده و با پردازش اطلاعات ارسالی از طریق این فرم موافقت می‌نمایم.',
    privacyLinkText: 'سیاست حفظ حریم خصوصی',
    sending: 'در حال ارسال...',
    send: 'ارسال پیام',
    successTitle: 'پیام شما با موفقیت ثبت گردید!',
    successDesc:
      'درخواست شما به صورت امن در سیستم ثبت شد. کارشناسان کلادورا در اسرع وقت با شما تماس خواهند گرفت.',
    refLabel: 'شناسه پیگیری درخواست',
    sendAnother: 'ارسال پیام جدید',
    errorTitle: 'خطا در ثبت درخواست',
    defaultError: 'در برقراری ارتباط مشکلی پیش آمده است. لطفاً مجدداً تلاش نمایید.',
    tryAgain: 'تلاش مجدد',
  },
};

export const ContactForm: React.FC<ContactFormProps> = ({ lang }) => {
  const t = copy[lang] || copy.en;
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);

  const handleStart = () => {
    trackEvent('contact_form_started', { locale: lang, sourcePage: '/contact', formType: 'contact' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;

    if (!consentPrivacy) {
      setErrorMessage(t.privacyConsent);
      setStatus('error');
      statusRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          email,
          message,
          locale: lang,
          sourcePage: `/${lang}/contact`,
          consentPrivacy: true,
          honeypot: honeypot || undefined,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        const errorDetail = data.message || t.defaultError;
        setErrorMessage(errorDetail);
        setStatus('error');
        trackEvent('contact_form_failed', {
          locale: lang,
          sourcePage: '/contact',
          formType: 'contact',
          errorCategory: res.status === 429 ? 'rate_limit' : 'validation',
        });
        statusRef.current?.focus();
        return;
      }

      setReferenceId(data.referenceId);
      setStatus('success');
      trackEvent('contact_form_submitted', { locale: lang, sourcePage: '/contact', formType: 'contact' });
      statusRef.current?.focus();
    } catch {
      setErrorMessage(t.defaultError);
      setStatus('error');
      trackEvent('contact_form_failed', {
        locale: lang,
        sourcePage: '/contact',
        formType: 'contact',
        errorCategory: 'network',
      });
      statusRef.current?.focus();
    }
  };

  const handleReset = () => {
    setFullName('');
    setEmail('');
    setMessage('');
    setConsentPrivacy(false);
    setHoneypot('');
    setTurnstileToken(null);
    setReferenceId(null);
    setErrorMessage(null);
    setStatus('idle');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#334E68] mb-8 font-medium">
        <Link href={`/${lang}`} className="hover:text-[#102A43]">
          {t.home}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[#102A43] font-bold" aria-current="page">
          {t.contact}
        </span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 space-y-6">
          <span className="text-xs font-bold text-[#087A6E] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {t.badge}
          </span>
          <h1 className="text-3xl font-display font-extrabold text-[#102A43]">
            {t.heading}
          </h1>
          <p className="text-xs text-[#334E68] leading-relaxed">
            {t.description}
          </p>

          <div className="space-y-3 text-xs text-[#334E68]">
            <a
              href="mailto:contact@cladora.ro"
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#087A6E] transition-colors group"
            >
              <Mail className="w-4 h-4 text-[#087A6E] shrink-0" />
              <span className="font-semibold text-[#102A43] font-mono ltr-isolate group-hover:text-[#087A6E]">
                {t.emailLabel}
              </span>
            </a>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#E2E8F0]">
              <MapPin className="w-4 h-4 text-[#087A6E] shrink-0" />
              <span className="font-semibold text-[#102A43]">
                {t.locationLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-7">
          <div className="card-proptech p-6 sm:p-8 bg-white space-y-4 shadow-elevated rounded-2xl border border-[#E2E8F0]">
            <div
              ref={statusRef}
              tabIndex={-1}
              aria-live="polite"
              className="outline-none"
            >
              {status === 'success' && (
                <div className="text-center py-8 space-y-4 animate-fadeIn">
                  <div className="w-14 h-14 rounded-2xl bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-[#102A43]">
                    {t.successTitle}
                  </h3>
                  <p className="text-xs text-[#334E68] max-w-md mx-auto leading-relaxed">
                    {t.successDesc}
                  </p>
                  {referenceId && (
                    <div className="inline-flex flex-col items-center gap-1 p-3 rounded-xl bg-[#F0F4F8] border border-[#D3DCE6]">
                      <span className="text-[11px] font-medium text-[#52667A]">{t.refLabel}</span>
                      <span className="font-mono text-sm font-extrabold text-[#102A43] tracking-wider ltr-isolate">
                        {referenceId}
                      </span>
                    </div>
                  )}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-xs font-bold text-[#087A6E] hover:underline"
                    >
                      {t.sendAnother}
                    </button>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div
                  role="alert"
                  className="mb-4 p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs space-y-2"
                >
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
                    <span>{t.errorTitle}</span>
                  </div>
                  <p className="leading-relaxed">{errorMessage || t.defaultError}</p>
                </div>
              )}
            </div>

            {status !== 'success' && (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
                {/* Honeypot field - visually hidden, traps spam bots */}
                <div
                  style={{ display: 'none', position: 'absolute', left: '-9999px' }}
                  aria-hidden="true"
                >
                  <label htmlFor="website">Website</label>
                  <input
                    type="text"
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="contactFullName" className="block font-bold text-[#102A43] mb-1">
                    {t.fullName} <span className="text-[#E5484D]">*</span>
                  </label>
                  <input
                    id="contactFullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    disabled={status === 'submitting'}
                    value={fullName}
                    onFocus={handleStart}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t.fullNamePlaceholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D3DCE6] text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#087A6E] disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label htmlFor="contactEmail" className="block font-bold text-[#102A43] mb-1">
                    {t.email} <span className="text-[#E5484D]">*</span>
                  </label>
                  <input
                    id="contactEmail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={status === 'submitting'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D3DCE6] text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#087A6E] disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label htmlFor="contactMessage" className="block font-bold text-[#102A43] mb-1">
                    {t.message} <span className="text-[#E5484D]">*</span>
                  </label>
                  <textarea
                    id="contactMessage"
                    name="message"
                    rows={4}
                    required
                    disabled={status === 'submitting'}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D3DCE6] text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#087A6E] disabled:bg-slate-50"
                  />
                </div>

                {/* Mandatory Privacy Consent Checkbox */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer text-[#334E68] leading-relaxed">
                    <input
                      type="checkbox"
                      required
                      checked={consentPrivacy}
                      disabled={status === 'submitting'}
                      onChange={(e) => setConsentPrivacy(e.target.checked)}
                      className="mt-0.5 rounded border-[#CBD5E1] text-[#087A6E] focus:ring-[#087A6E] w-4 h-4 shrink-0"
                    />
                    <span>
                      {t.privacyConsent}{' '}
                      <Link
                        href={`/${lang}/privacy`}
                        target="_blank"
                        className="text-[#087A6E] underline hover:text-[#065F55] font-semibold"
                      >
                        {t.privacyLinkText}
                      </Link>
                    </span>
                  </label>
                </div>

                {/* Cloudflare Turnstile (only if site key configured) */}
                {captchaSiteKey && (
                  <div className="pt-2">
                    <TurnstileWidget
                      siteKey={captchaSiteKey}
                      lang={lang}
                      onToken={(token) => setTurnstileToken(token)}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'submitting' || !consentPrivacy}
                  className="w-full py-3 px-4 rounded-xl bg-[#087A6E] hover:bg-[#065F55] disabled:bg-[#94A3B8] disabled:cursor-not-allowed text-white font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.sending}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{t.send}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
