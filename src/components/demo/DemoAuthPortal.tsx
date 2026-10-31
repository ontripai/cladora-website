'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Language } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { 
  Building2, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  LogOut, 
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  fetchDemoWorkspace, 
  initializeDemoWorkspace 
} from '@/lib/demo/demo-client';
import type { DemoWorkspaceDescriptor } from '@/lib/demo/demo-types';

interface DemoAuthPortalProps {
  lang: Language;
}

export const DemoAuthPortal: React.FC<DemoAuthPortalProps> = ({ lang }) => {
  const router = useRouter();
  const configured = isSupabaseConfigured();

  const [isLoadingSession, setIsLoadingSession] = useState(configured);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [existingWorkspace, setExistingWorkspace] = useState<DemoWorkspaceDescriptor | null>(null);

  // Tab state: 'signup' | 'signin'
  const [activeTab, setActiveTab] = useState<'signup' | 'signin'>('signup');

  // Registration Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobile, setMobile] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Status & Error
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState(false);

  // Check current session on mount
  useEffect(() => {
    if (!configured) return;
    let isMounted = true;
    const client = createClient();

    async function checkAuth() {
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          setCurrentUser(session.user);
          const ws = await fetchDemoWorkspace(client);
          if (isMounted) {
            setExistingWorkspace(ws);
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        if (isMounted) {
          setIsLoadingSession(false);
        }
      }
    }

    void checkAuth();

    return () => {
      isMounted = false;
    };
  }, [configured]);

  const handleSignOut = async () => {
    setIsSubmitting(true);
    if (isSupabaseConfigured()) {
      const client = createClient();
      await client.auth.signOut();
    }
    setCurrentUser(null);
    setExistingWorkspace(null);
    setIsSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!privacyAccepted) {
      setErrorMessage(
        lang === 'ro' 
          ? 'Acceptarea Politicii de Confidențialitate este obligatorie.' 
          : lang === 'fa' 
          ? 'پذیرش سیاست حفظ حریم خصوصی الزامی است.' 
          : 'Acceptance of the Privacy Policy is mandatory.'
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        lang === 'ro'
          ? 'Parola trebuie să conțină cel puțin 8 caractere.'
          : lang === 'fa'
          ? 'رمز عبور باید حداقل ۸ کاراکتر باشد.'
          : 'Password must be at least 8 characters long.'
      );
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !workspaceName.trim()) {
      setErrorMessage(
        lang === 'ro'
          ? 'Te rugăm să completezi toate câmpurile obligatorii.'
          : lang === 'fa'
          ? 'لطفاً تمامی فیلدهای الزامی را تکمیل کنید.'
          : 'Please complete all required fields.'
      );
      return;
    }

    if (!isSupabaseConfigured()) {
      setErrorMessage(
        lang === 'ro'
          ? 'Serviciul de autentificare nu este configurat.'
          : lang === 'fa'
          ? 'سرویس احراز هویت پیکربندی نشده است.'
          : 'Authentication service is not configured.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/${lang}/demo`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            workspace_name: workspaceName.trim(),
            mobile_contact: mobile.trim() || null,
          },
        },
      });

      if (authError) {
        setErrorMessage(authError.message);
        setIsSubmitting(false);
        return;
      }

      // Check if email confirmation is required
      if (!authData.session || (authData.user?.identities && authData.user.identities.length === 0)) {
        setPendingVerification(true);
        setIsSubmitting(false);
        return;
      }

      // Session established immediately
      setCurrentUser(authData.user);

      // Verify or initialize demo workspace
      const existing = await fetchDemoWorkspace(supabase);
      if (existing) {
        setExistingWorkspace(existing);
        router.push(`/${lang}/demo/app/dashboard`);
      } else {
        const initResult = await initializeDemoWorkspace(supabase, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          mobile: mobile.trim() || '+40700000000',
          workspaceName: workspaceName.trim(),
          marketingConsent,
          privacyAccepted: true,
          locale: lang,
        });
        setExistingWorkspace(initResult.workspace);
        router.push(`/${lang}/demo/app/dashboard`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during demo workspace provisioning.');
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isSupabaseConfigured()) {
      setErrorMessage(
        lang === 'ro'
          ? 'Serviciul de autentificare nu este configurat.'
          : lang === 'fa'
          ? 'سرویس احراز هویت پیکربندی نشده است.'
          : 'Authentication service is not configured.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setErrorMessage(
          lang === 'ro'
            ? 'Date de autentificare invalide sau cont neverificat.'
            : lang === 'fa'
            ? 'اطلاعات ورود نامعتبر است یا ایمیل حساب تأیید نشده است.'
            : 'Invalid credentials or unconfirmed account.'
        );
        setIsSubmitting(false);
        return;
      }

      setCurrentUser(authData.user);

      // Check existing workspace
      const ws = await fetchDemoWorkspace(supabase);
      if (ws) {
        setExistingWorkspace(ws);
        router.push(`/${lang}/demo/app/dashboard`);
      } else {
        // Prompt for one-time initialization if user has no workspace yet
        setActiveTab('signup');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error signing in.');
      setIsSubmitting(false);
    }
  };

  if (isLoadingSession) {
    return (
      <div className="max-w-md mx-auto p-12 bg-white rounded-3xl border border-[#E2E8F0] shadow-card text-center space-y-4">
        <Loader2 className="w-8 h-8 text-[#0E9F8E] animate-spin mx-auto" />
        <p className="text-xs font-semibold text-[#627D98]">
          {lang === 'ro' ? 'Se verifică sesiunea de lucru...' : lang === 'fa' ? 'در حال بررسی نشست کاربری...' : 'Verifying demo session...'}
        </p>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="max-w-md mx-auto p-12 bg-white rounded-3xl border border-[#E2E8F0] shadow-card text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-[#94A3B8] mx-auto" />
        <h2 className="text-xl font-bold text-[#0F172A]">
          {lang === 'ro' ? 'Configurare demonstrativă în curs' : lang === 'fa' ? 'پیکربندی محیط دمو' : 'Demo Setup'}
        </h2>
        <p className="text-sm text-[#475569]">
          {lang === 'ro'
            ? 'Serviciul de autentificare demonstrativ nu este configurat în acest mediu.'
            : lang === 'fa'
            ? 'سرویس احراز هویت دمو در این محیط پیکربندی نشده است.'
            : 'Demo authentication service is not configured in this environment.'}
        </p>
      </div>
    );
  }

  // State 1: User already authenticated with provisioned workspace
  if (currentUser && existingWorkspace) {
    return (
      <div className="max-w-xl mx-auto p-8 sm:p-10 bg-white rounded-3xl border border-[#CBD5E1] shadow-card text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center mx-auto">
          <Building2 className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0E9F8E] bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Workspace Demo Activ' : lang === 'fa' ? 'ورک‌اسپیس نمونهٔ فعال' : 'Active Demo Workspace'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43]">
            {existingWorkspace.name}
          </h2>
          <p className="text-xs sm:text-sm text-[#52667A] max-w-md mx-auto leading-relaxed">
            {lang === 'ro'
              ? `Autentificat ca ${existingWorkspace.profile.first_name} ${existingWorkspace.profile.last_name} (${currentUser.email}). Datele tale de probă (75 înregistrări) sunt pregătite.`
              : lang === 'fa'
              ? `ورود با هویت ${existingWorkspace.profile.first_name} ${existingWorkspace.profile.last_name} (${currentUser.email}). داده‌های نمونه اختصاصی شما آماده مشاهده است.`
              : `Signed in as ${existingWorkspace.profile.first_name} ${existingWorkspace.profile.last_name} (${currentUser.email}). Your isolated 75 sample records are loaded.`}
          </p>
        </div>

        <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] text-xs text-[#627D98] flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span>
            {lang === 'ro'
              ? 'Mod Previzualizare Activ: Butoanele de salvare/continuare sunt securizate.'
              : lang === 'fa'
              ? 'حالت فقط پیش‌نمایش: دکمه‌های ثبت و ویرایش غیرفعال هستند.'
              : 'Preview-Only Mode: Save and submit actions are strictly disabled.'}
          </span>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/${lang}/demo/app/dashboard`}
            className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <span>{lang === 'ro' ? 'Accesează Spațiul Demo' : lang === 'fa' ? 'ورود به محیط دمو' : 'Enter Demo Workspace'}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-3 text-xs font-bold text-[#52667A] hover:text-[#102A43] bg-[#F0F4F8] hover:bg-[#E2E8F0] rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === 'ro' ? 'Deconectare' : lang === 'fa' ? 'خروج از حساب' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    );
  }

  // State 2: Verification pending notification
  if (pendingVerification) {
    return (
      <div className="max-w-lg mx-auto p-8 sm:p-10 bg-white rounded-3xl border border-[#CBD5E1] shadow-card text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <Mail className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-display font-extrabold text-[#102A43]">
            {lang === 'ro' ? 'Verifică adresa de email' : lang === 'fa' ? 'تأیید آدرس ایمیل' : 'Verify Your Email'}
          </h2>
          <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? `Un link de activare a fost trimis la ${email}. Te rugăm să deschizi emailul și să apeși pe link pentru a accesa workspace-ul demo.`
              : lang === 'fa'
              ? `لینک تأیید و ورود به ${email} ارسال گردید. لطفاً صندوق ورودی خود را باز کرده و روی لینک کلیک کنید تا ورک‌اسپیس نمونه فعال شود.`
              : `A verification link has been sent to ${email}. Please click the link in your email to activate and enter your demo workspace.`}
          </p>
        </div>

        <div className="p-4 bg-[#F0F4F8] rounded-2xl border border-[#CBD5E1] text-xs text-[#52667A] text-start">
          <p className="font-semibold text-[#102A43] mb-1">
            {lang === 'ro' ? 'Ce se întâmplă în continuare?' : lang === 'fa' ? 'گام بعدی چیست؟' : 'What happens next?'}
          </p>
          <p>
            {lang === 'ro'
              ? 'După confirmare, vei fi redirecționat automat înapoi în aplicația demo cu cele 75 de înregistrări de probă pregătite.'
              : lang === 'fa'
              ? 'پس از تأیید، به‌طور خودکار به داشبورد دمو با ۷۵ رکورد و گزارش‌های نمونه منتقل خواهید شد.'
              : 'After confirming, you will be automatically returned to the demo dashboard with all 75 sample records provisioned.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => { setPendingVerification(false); setActiveTab('signin'); }}
          className="text-xs font-bold text-[#0E9F8E] hover:underline"
        >
          {lang === 'ro' ? 'Înapoi la Autentificare' : lang === 'fa' ? 'بازگشت به صفحه ورود' : 'Back to Sign In'}
        </button>
      </div>
    );
  }

  // State 3: Registration / Sign In Form
  return (
    <div className="max-w-xl mx-auto px-4">
      <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-card overflow-hidden">
        
        {/* Header */}
        <div className="p-6 sm:p-8 bg-[#F8FAFC] border-b border-[#E2E8F0] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center mx-auto border border-[#B2E5DF]">
            <Sparkles className="w-6 h-6" />
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-[#0E9F8E] block">
            {lang === 'ro' ? 'Portal Demo CLADORA' : lang === 'fa' ? 'درگاه دموی اختصاصی کلادورا' : 'CLADORA Demo Portal'}
          </span>

          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#102A43]">
            {lang === 'ro' 
              ? 'Explorează platforma cu propriul Workspace de probă' 
              : lang === 'fa' 
              ? 'مشاهده قابلیت‌ها در ورک‌اسپیس نمونه اختصاصی' 
              : 'Explore CLADORA with Your Private Demo Workspace'}
          </h1>

          <p className="text-xs sm:text-sm text-[#52667A] max-w-md mx-auto leading-relaxed">
            {lang === 'ro'
              ? 'Configurează un cont demonstrativ pentru a explora meniurile, 75 de date de probă și formularele inițiale ale produsului.'
              : lang === 'fa'
              ? 'با ایجاد حساب کاربری، منوها، ۷۵ قلم داده نمونه و فرم‌های اولیه را در محیطی امن و بدون تعهد بررسی فرمایید.'
              : 'Create your preview account to experience menus, 75 sample records, and initial forms without operational commitment.'}
          </p>

          {/* Tab Switcher */}
          <div className="pt-2 flex justify-center">
            <div className="p-1 bg-[#F0F4F8] rounded-xl flex items-center border border-[#CBD5E1]">
              <button
                type="button"
                onClick={() => { setActiveTab('signup'); setErrorMessage(null); }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'signup'
                    ? 'bg-white text-[#102A43] shadow-xs'
                    : 'text-[#627D98] hover:text-[#102A43]'
                }`}
              >
                {lang === 'ro' ? 'Înregistrare Demo' : lang === 'fa' ? 'ثبت‌نام دمو' : 'Create Demo'}
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('signin'); setErrorMessage(null); }}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'signin'
                    ? 'bg-white text-[#102A43] shadow-xs'
                    : 'text-[#627D98] hover:text-[#102A43]'
                }`}
              >
                {lang === 'ro' ? 'Autentificare' : lang === 'fa' ? 'ورود به دمو' : 'Sign In'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1 leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        {activeTab === 'signup' ? (
          <form onSubmit={handleSignUp} className="p-6 sm:p-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Nume *' : lang === 'fa' ? 'نام *' : 'First Name *'}
                </label>
                <div className="relative">
                  <User className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={lang === 'ro' ? 'Ion' : lang === 'fa' ? 'علی' : 'John'}
                    className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                  />
                </div>
              </div>

              {/* Last Name */}
              <div>
                <label className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Prenume *' : lang === 'fa' ? 'نام خانوادگی *' : 'Last Name *'}
                </label>
                <div className="relative">
                  <User className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={lang === 'ro' ? 'Popescu' : lang === 'fa' ? 'رضایی' : 'Doe'}
                    className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-bold text-[#102A43] block mb-1">
                {lang === 'ro' ? 'Email de acces *' : lang === 'fa' ? 'پست الکترونیک (ایمیل) *' : 'Email Address *'}
              </label>
              <div className="relative">
                <Mail className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@example.com"
                  className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-bold text-[#102A43] block mb-1">
                {lang === 'ro' ? 'Parolă (minim 8 caractere) *' : lang === 'fa' ? 'رمز عبور (حداقل ۸ کاراکتر) *' : 'Password (min. 8 characters) *'}
              </label>
              <div className="relative">
                <Lock className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-9' : 'pl-9 pr-9'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-2.5 text-[#627D98] hover:text-[#102A43] ${lang === 'fa' ? 'left-3' : 'right-3'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Mobile Contact */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#102A43]">
                  {lang === 'ro' ? 'Telefon de contact' : lang === 'fa' ? 'شماره موبایل تماس' : 'Contact Phone'}
                </label>
                <span className="text-[10px] text-[#627D98]">
                  {lang === 'ro' ? '(Neverificat prin SMS)' : lang === 'fa' ? '(بدون نیاز به تأیید پیامکی)' : '(Contact-only, not SMS verified)'}
                </span>
              </div>
              <div className="relative">
                <Phone className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder={lang === 'fa' ? '۰۹۱۲۱۲۳۴۵۶۷' : '+40 700 000 000'}
                  className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                />
              </div>
            </div>

            {/* Workspace Name */}
            <div>
              <label className="text-xs font-bold text-[#102A43] block mb-1">
                {lang === 'ro' ? 'Numele Workspace-ului tău Demo *' : lang === 'fa' ? 'نام ورک‌اسپیس نمونه شما *' : 'Your Demo Workspace Name *'}
              </label>
              <div className="relative">
                <Building2 className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder={lang === 'ro' ? 'ex. Ansamblul Aviației 12B' : lang === 'fa' ? 'مثال: برج مسکونی آویاتسی ۱۲B' : 'e.g. Aviatiei Residence 12B'}
                  className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                />
              </div>
            </div>

            {/* Consents */}
            <div className="space-y-3 pt-2">
              {/* Mandatory Privacy Acceptance */}
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#52667A]">
                <input
                  type="checkbox"
                  required
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-[#CBD5E1] text-[#0E9F8E] focus:ring-[#0E9F8E]"
                />
                <span className="leading-relaxed">
                  {lang === 'ro' ? (
                    <>
                      Am citit și accept{' '}
                      <Link href={`/${lang}/privacy`} className="text-[#0E9F8E] underline font-semibold" target="_blank">
                        Politica de Confidențialitate
                      </Link>{' '}
                      CLADORA. *
                    </>
                  ) : lang === 'fa' ? (
                    <>
                      با{' '}
                      <Link href={`/${lang}/privacy`} className="text-[#0E9F8E] underline font-semibold" target="_blank">
                        سیاست حفظ حریم خصوصی
                      </Link>{' '}
                      کلادورا موافقت می‌نمایم. *
                    </>
                  ) : (
                    <>
                      I have read and agree to the{' '}
                      <Link href={`/${lang}/privacy`} className="text-[#0E9F8E] underline font-semibold" target="_blank">
                        Privacy Policy
                      </Link>
                      . *
                    </>
                  )}
                </span>
              </label>

              {/* Optional Marketing Consent */}
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#52667A]">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 rounded border-[#CBD5E1] text-[#0E9F8E] focus:ring-[#0E9F8E]"
                />
                <span className="leading-relaxed">
                  {lang === 'ro'
                    ? 'Sunt de acord să primesc actualizări și noutăți legate de produs (Opțional).'
                    : lang === 'fa'
                    ? 'مایل به دریافت به‌روزرسانی‌ها و اخبار محصول هستم (اختیاری).'
                    : 'I agree to receive occasional product updates and news (Optional).'}
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-6 text-xs sm:text-sm font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ro' ? 'Se configurează spațiul demo...' : lang === 'fa' ? 'در حال راه‌اندازی ورک‌اسپیس نمونه...' : 'Provisioning demo workspace...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'ro' ? 'Creează Workspace Demo' : lang === 'fa' ? 'ساخت و ورود به ورک‌اسپیس نمونه' : 'Create Demo Workspace'}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Sign In Form */
          <form onSubmit={handleSignIn} className="p-6 sm:p-8 space-y-4">
            <div>
              <label className="text-xs font-bold text-[#102A43] block mb-1">
                {lang === 'ro' ? 'Email de acces' : lang === 'fa' ? 'پست الکترونیک (ایمیل)' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@example.com"
                  className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#102A43] block mb-1">
                {lang === 'ro' ? 'Parolă' : lang === 'fa' ? 'رمز عبور' : 'Password'}
              </label>
              <div className="relative">
                <Lock className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-9' : 'pl-9 pr-9'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-2.5 text-[#627D98] hover:text-[#102A43] ${lang === 'fa' ? 'left-3' : 'right-3'}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-6 text-xs sm:text-sm font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ro' ? 'Se autentifică...' : lang === 'fa' ? 'در حال ورود...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'ro' ? 'Intră în Contul Demo' : lang === 'fa' ? 'ورود به حساب دمو' : 'Sign In to Demo'}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer Guarantee */}
        <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] text-center text-xs text-[#627D98] flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0E9F8E]" />
          <span>
            {lang === 'ro'
              ? 'Date de probă izolate • Fără obligații comerciale • Fără card bancar'
              : lang === 'fa'
              ? 'داده‌های نمونه مستقل • بدون تعهد تجاری • بدون نیاز به کارت بانکی'
              : 'Isolated sample data • No commercial obligation • No credit card needed'}
          </span>
        </div>

      </div>
    </div>
  );
};
