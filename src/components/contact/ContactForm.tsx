'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building, 
  TrendingUp, 
  Building2, 
  Layers, 
  Wrench, 
  KeyRound, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  ShieldCheck,
  Compass,
  FileCheck2,
  Mail,
  Phone,
  User,
  MapPin,
  MessageSquare
} from 'lucide-react';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';

interface ContactFormProps {
  lang: Language;
}

export const ContactForm: React.FC<ContactFormProps> = ({ lang }) => {
  // Wizard step: 1 = Role, 2 = Property, 3 = Stage, 4 = Services, 5 = Workspace, 6 = Details
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [role, setRole] = useState<string>('');
  const [portfolioScope, setPortfolioScope] = useState<'single_building' | 'multi_building_portfolio'>('single_building');
  const [propertyType, setPropertyType] = useState<string>('');
  const [stage, setStage] = useState<string>('');
  const [services, setServices] = useState<string[]>([]);
  const [workspaceStatus, setWorkspaceStatus] = useState<string>('');
  
  // Contact details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [unitsCount, setUnitsCount] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleService = (srv: string) => {
    setServices((prev) => 
      prev.includes(srv) ? prev.filter((s) => s !== srv) : [...prev, srv]
    );
  };

  const isStepValid = () => {
    if (currentStep === 1) return !!role;
    if (currentStep === 2) return !!propertyType;
    if (currentStep === 3) return !!stage;
    if (currentStep === 4) return services.length > 0;
    if (currentStep === 5) return !!workspaceStatus;
    if (currentStep === 6) {
      return fullName.trim().length >= 2 && email.trim().includes('@') && privacyConsent;
    }
    return true;
  };

  const handleNext = () => {
    if (isStepValid()) {
      setCurrentStep((prev) => Math.min(6, prev + 1));
      setErrorMessage(null);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStepValid() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const compiledMessage = `
[CLADORA PARTNERSHIP INQUIRY]
• Applicant Role: ${role}
• Asset Scope: ${portfolioScope === 'multi_building_portfolio' ? 'Multi-Building Portfolio' : 'Single Building Asset'}
• Property Typology: ${propertyType}
• Current Lifecycle Need: ${stage}
• Desired Services: ${services.join(', ')}
• Workspace Status: ${workspaceStatus}
• Location / City: ${city || 'Not specified'}
• Units Count: ${unitsCount || 'Not specified'}
• Project Notes: ${additionalNotes.trim() || 'No additional notes provided.'}
    `.trim();

    try {
      const response = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          message: compiledMessage,
          role: role || null,
          propertyType: propertyType || null,
          portfolioScope: portfolioScope,
          stage: stage || null,
          services: services,
          workspaceStatus: workspaceStatus || null,
          city: city.trim() || null,
          unitsCount: unitsCount.trim() || null,
          locale: lang,
          sourcePage: `/${lang}/contact`,
          consentPrivacy: true,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setSubmissionSuccess(true);
        setReferenceCode(data.referenceId || data.referenceCode || 'CLD-' + Math.floor(100000 + Math.random() * 900000));
      } else {
        setErrorMessage(
          data.message || 
          (lang === 'ro' 
            ? 'A apărut o problemă temporară. Datele tale au fost păstrate; te rugăm să reîncerci.' 
            : lang === 'fa' 
            ? 'خطایی رخ داد. اطلاعات واردشده شما حفظ شده است؛ لطفاً مجدداً تلاش کنید.' 
            : 'A temporary error occurred. Your entered data has been preserved; please try again.')
        );
      }
    } catch (err) {
      setErrorMessage(
        lang === 'ro'
          ? 'Nu s-a putut realiza conexiunea cu serverul. Te rugăm să verifici rețeaua și să reîncerci.'
          : lang === 'fa'
          ? 'برقراری ارتباط با سرور با خطا مواجه شد. لطفاً اتصال اینترنت را بررسی و مجدداً امتحان کنید.'
          : 'Network error. Please check your connection and retry.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const roles = [
    { id: 'developer', label: lang === 'ro' ? 'Dezvoltator / Constructor' : lang === 'fa' ? 'سازنده یا عرضه‌کننده ملک' : 'Developer / Builder', icon: Building },
    { id: 'owner_portfolio', label: lang === 'ro' ? 'Proprietar portofoliu / Multi-unitate' : lang === 'fa' ? 'مالک چندواحدی / صاحب سبد املاک' : 'Multi-Unit Landlord / Portfolio Owner', icon: TrendingUp },
    { id: 'owner_single', label: lang === 'ro' ? 'Proprietar individual (Locuință / Spațiu)' : lang === 'fa' ? 'مالک تک‌واحدی (مسکونی یا تجاری)' : 'Individual Property Owner', icon: KeyRound },
    { id: 'property_manager', label: lang === 'ro' ? 'Manager de proprietăți / Companie de administrare' : lang === 'fa' ? 'مدیر مجتمع یا شرکت مدیریت املاک' : 'Property / Estate Manager', icon: Layers },
    { id: 'association_board', label: lang === 'ro' ? 'Asociație de proprietari / Comitet' : lang === 'fa' ? 'مدیر ساختمان یا انجمن مالکان' : 'HOA / Resident Board', icon: Building2 },
    { id: 'service_provider', label: lang === 'ro' ? 'Furnizor de servicii tehnice / Contractor' : lang === 'fa' ? 'ارائه‌دهنده خدمات، پیمانکار یا تیم فنی' : 'Service Provider / Contractor', icon: Wrench },
    { id: 'tenant', label: lang === 'ro' ? 'Chiriaș / Utilizator spațiu' : lang === 'fa' ? 'مستأجر یا بهره‌بردار تجاری/مسکونی' : 'Tenant / Occupant', icon: User },
  ];

  const propertyTypes = [
    { id: 'residential', label: lang === 'ro' ? 'Rezidențial (Blocuri, condominii, vile)' : lang === 'fa' ? 'مسکونی (آپارتمان‌ها، برج‌ها، ویلایی)' : 'Residential (Condos, apartments, villas)' },
    { id: 'commercial', label: lang === 'ro' ? 'Comercial & Birouri (Clădiri de birouri, retail, mall)' : lang === 'fa' ? 'تجاری و اداری (برج‌های اداری، مراکز خرید، دفاتر)' : 'Commercial & Offices (Office towers, retail, business centers)' },
    { id: 'industrial', label: lang === 'ro' ? 'Industrial & Logistică (Depozite, hale, parcuri logistice)' : lang === 'fa' ? 'صنعتی و لجستیک (انبارها، سوله‌ها، پارک‌های صنعتی)' : 'Industrial & Logistics (Warehouses, industrial parks, depots)' },
    { id: 'mixed_use', label: lang === 'ro' ? 'Ansamblu mixt (Rezidențial + Comercial + Birouri)' : lang === 'fa' ? 'کاربری مختلط (ترکیب مسکونی، تجاری و اداری)' : 'Mixed-Use Development (Residential, commercial & office)' },
  ];

  const stages = [
    { id: 'presale_resale', label: lang === 'ro' ? 'Pre-vânzare, vânzare & cesiuni (AIRPROP)' : lang === 'fa' ? 'پیش‌فروش، فروش مجدد و واگذاری (AIRPROP)' : 'Pre-sales, Resale & Handover (AIRPROP)' },
    { id: 'rental_leasing', label: lang === 'ro' ? 'Închiriere, contracte & gestiune chiriași' : lang === 'fa' ? 'اجاره، قراردادها و مدیریت مستأجران' : 'Long-term Leasing & Tenancy Management' },
    { id: 'operations_maintenance', label: lang === 'ro' ? 'Servicii curente, mentenanță tehnică & intervenții' : lang === 'fa' ? 'خدمات جاری، نگهداری فنی و دستورکارها' : 'Daily Operations, Facility Maintenance & Work Orders' },
    { id: 'management_transition', label: lang === 'ro' ? 'Schimbare sau preluare administrație (Tranziție management)' : lang === 'fa' ? 'تغییر مدیریت، تحویل و تحول یا انتقال اداره ساختمان' : 'Management Handover & Transition' },
    { id: 'active_living', label: lang === 'ro' ? 'Administrare curentă & comunitate activă' : lang === 'fa' ? 'مدیریت و بهره‌برداری جاری ساختمان و ساکنان' : 'Active Living & Ongoing Administration' },
  ];

  const availableServices = [
    { id: 'airprop', label: 'AIRPROP', desc: lang === 'ro' ? 'Prezentare imobil, oportunități, pre-vânzări & închirieri' : lang === 'fa' ? 'عرضه ملک، فرصت‌ها، پیش‌فروش و قراردادهای اجاره' : 'Property marketing, pre-sales & leasing' },
    { id: 'service', label: 'SERVICE', desc: lang === 'ro' ? 'Catalog servicii, ofertare, comenzi & recepție lucrări' : lang === 'fa' ? 'کاتالوگ خدمات، استعلام قیمت، سفارش و نظارت بر اجرا' : 'Service catalog, quote comparison & execution' },
    { id: 'operations', label: lang === 'ro' ? 'Operațiuni & Mentenanță' : lang === 'fa' ? 'عملیات و نگهداری' : 'Operations & Maintenance', desc: lang === 'ro' ? 'Active tehnice, planuri preventive & tichete avarii' : lang === 'fa' ? 'تجهیزات فنی، نگهداری دوره‌ای و دستورکارها' : 'Equipment logs, recurring plans & work orders' },
    { id: 'finance', label: lang === 'ro' ? 'Adevăr Financiar' : lang === 'fa' ? 'مدیریت مالی و تسهیم هزینه‌ها' : 'Financial Truth & Ledger', desc: lang === 'ro' ? 'Calcul cote, liste de plată, reconciliere bancară' : lang === 'fa' ? 'محاسبه شفاف سهم شارژ، تطبیق بانکی و گزارش‌ها' : 'Explainable charges, payment lists & bank matching' },
    { id: 'governance', label: lang === 'ro' ? 'Guvernanță & Seif' : lang === 'fa' ? 'مدیریت اسناد، جلسات و آرا' : 'Governance & Vault', desc: lang === 'ro' ? 'Seif documente, adunări generale & comunicări' : lang === 'fa' ? 'بایگانی اسناد، مجامع عمومی و اعلانات رسمی' : 'Document vault, AGM voting & notices' },
  ];

  const workspaceStatuses = [
    { id: 'existing_workspace_service', label: lang === 'ro' ? 'Avem deja un Workspace CLADORA activ și solicităm servicii / module noi' : lang === 'fa' ? 'یک Workspace فعال در کلادورا داریم و متقاضی سفارش خدمات یا ماژول جدید هستیم' : 'We have an active CLADORA Workspace and request new services / modules' },
    { id: 'new_workspace', label: lang === 'ro' ? 'Configurarea unui nou Workspace pentru proprietate sau portofoliu' : lang === 'fa' ? 'نیاز به ایجاد و پیکربندی یک Workspace جدید برای ملک یا سبد املاک داریم' : 'We need a newly provisioned Workspace for our property or portfolio' },
    { id: 'migration_existing', label: lang === 'ro' ? 'Migrare de la o administrație clasică sau soft anterior către CLADORA' : lang === 'fa' ? 'مهاجرت از سیستم سنتی یا نرم‌افزار قبلی به پلتفرم CLADORA' : 'Migration from legacy property software or traditional management' },
    { id: 'consultation_only', label: lang === 'ro' ? 'Evaluare preliminară și consultanță arhitecturală pentru proiect' : lang === 'fa' ? 'در حال بررسی اولیه هستیم و نیازمند مشاوره معماری پلتفرم متناسب با پروژه می‌باشیم' : 'Preliminary discovery and architecture consultation' },
  ];

  if (submissionSuccess) {
    return (
      <div className="max-w-2xl mx-auto p-8 sm:p-12 bg-white rounded-3xl border border-[#D3DCE6] shadow-card text-center space-y-6 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-[#10B981]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43]">
            {lang === 'ro' ? 'Solicitarea a fost înregistrată cu succes!' : lang === 'fa' ? 'درخواست شما با موفقیت ثبت گردید!' : 'Request Successfully Received!'}
          </h2>
          <p className="text-sm sm:text-base text-[#52667A] leading-relaxed max-w-lg mx-auto">
            {lang === 'ro'
              ? 'Detaliile proiectului tău au fost transmise echipei de integrare CLADORA. Un specialist va analiza profilul indicat și te va contacta pentru următorii pași.'
              : lang === 'fa'
              ? 'مشخصات ارسالی شما در سامانه ثبت شد و در اختیار تیم فنی کلادورا قرار گرفت. کارشناسان ما پس از بررسی اولیه جهت هماهنگی گام‌های بعدی با شما تماس خواهند گرفت.'
              : 'Your requirements have been securely recorded. A CLADORA integration specialist will review your property profile and reach out with next steps.'}
          </p>
        </div>

        {referenceCode && (
          <div className="p-4 bg-[#F0F4F8] rounded-2xl border border-[#CBD5E1] inline-block max-w-xs mx-auto">
            <span className="text-xs text-[#627D98] block uppercase tracking-wider font-semibold">
              {lang === 'ro' ? 'Cod de Referință Solicitare' : lang === 'fa' ? 'شناسه رهگیری درخواست' : 'Inquiry Reference Code'}
            </span>
            <span className="text-lg font-mono font-bold text-[#102A43] tracking-wide mt-1 block select-all">
              {referenceCode}
            </span>
          </div>
        )}

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/${lang}`}
            className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-[#102A43] bg-[#F0F4F8] hover:bg-[#E2E8F0] rounded-xl transition-colors"
          >
            {lang === 'ro' ? 'Înapoi la Pagina Principală' : lang === 'fa' ? 'بازگشت به صفحه اصلی' : 'Back to Home'}
          </Link>
          <Link
            href={`/${lang}/platform`}
            className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-colors"
          >
            {lang === 'ro' ? 'Explorează Arhitectura Platformei' : lang === 'fa' ? 'مشاهده معماری پلتفرم' : 'Explore Platform Architecture'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-6">
      
      {/* Form Card */}
      <div className="w-full bg-white rounded-3xl border border-[#E2E8F0] shadow-card overflow-hidden">
        
        {/* Header & Step Indicator */}
        <div className="p-4 sm:p-8 bg-[#F8FAFC] border-b border-[#E2E8F0] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
                {lang === 'ro' ? 'Formular Adaptiv de Colaborare' : lang === 'fa' ? 'مسیر تطبیقی شروع همکاری' : 'Adaptive Partnership Questionnaire'}
              </span>
              <h1 className="text-xl sm:text-3xl font-display font-extrabold text-[#102A43] leading-snug">
                {lang === 'ro' ? 'Inițiază colaborarea cu CLADORA' : lang === 'fa' ? 'درخواست شروع همکاری و ارزیابی ملک' : 'Start Your CLADORA Journey'}
              </h1>
            </div>

            <div className="text-xs font-extrabold text-[#102A43] bg-white border border-[#CBD5E1] px-3 py-1.5 rounded-xl self-start sm:self-auto shadow-2xs">
              {lang === 'ro' ? `Pasul ${currentStep} din 6` : lang === 'fa' ? `گام ${currentStep} از ۶` : `Step ${currentStep} of 6`}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-[#0E9F8E] h-full transition-all duration-300"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            />
          </div>

          <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Răspunde la câteva întrebări simple pentru a adapta profilul viitorului tău Workspace la cerințele specifice ale imobilului.'
              : lang === 'fa'
              ? 'لطفاً به چند پرسش کوتاه پاسخ دهید تا ساختار متناسب با ملک و نوع نیاز شما توسط کارشناسان تنظیم گردد.'
              : 'Answer a few structured questions so we can match the exact workspace profile to your property needs.'}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* Step 1: Role */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base sm:text-lg font-bold text-[#102A43]">
                {lang === 'ro' ? '1. Care este rolul sau profilul tău principal?' : lang === 'fa' ? '۱. نقش یا موقعیت اصلی شما چیست؟' : '1. What is your primary role or stakeholder profile?'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roles.map((r) => {
                  const Icon = r.icon;
                  const isSelected = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id)}
                      className={`p-4 rounded-2xl border text-start flex items-center gap-3 transition-all ${
                        isSelected
                          ? 'border-[#0E9F8E] bg-[#EAF8F5] text-[#102A43] shadow-2xs ring-1 ring-[#0E9F8E]'
                          : 'border-[#E2E8F0] bg-white text-[#334E68] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#0E9F8E] text-white' : 'bg-[#F0F4F8] text-[#627D98]'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold">
                        {r.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Property Typology & Scope */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Asset Scope */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#627D98] uppercase tracking-wider block">
                  {lang === 'ro' ? 'Domeniu & Scară Gestiune' : lang === 'fa' ? 'مقیاس و دامنه مدیریت املاک' : 'Asset Scope & Scale'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPortfolioScope('single_building')}
                    className={`p-3 rounded-xl border text-start flex items-center justify-between transition-all ${
                      portfolioScope === 'single_building'
                        ? 'border-[#0E9F8E] bg-[#EAF8F5] text-[#102A43] ring-1 ring-[#0E9F8E]'
                        : 'border-[#E2E8F0] bg-white text-[#334E68] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold">
                      {lang === 'ro' ? 'Imobil / Clădire unică' : lang === 'fa' ? 'تک‌ساختمان / ملک منفرد' : 'Single Building Asset'}
                    </span>
                    {portfolioScope === 'single_building' && <CheckCircle2 className="w-4 h-4 text-[#0E9F8E] shrink-0" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortfolioScope('multi_building_portfolio')}
                    className={`p-3 rounded-xl border text-start flex items-center justify-between transition-all ${
                      portfolioScope === 'multi_building_portfolio'
                        ? 'border-[#0E9F8E] bg-[#EAF8F5] text-[#102A43] ring-1 ring-[#0E9F8E]'
                        : 'border-[#E2E8F0] bg-white text-[#334E68] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold">
                      {lang === 'ro' ? 'Portofoliu multi-clădire' : lang === 'fa' ? 'سبد املاک چندگانه (چندین ساختمان)' : 'Multi-Building Portfolio'}
                    </span>
                    {portfolioScope === 'multi_building_portfolio' && <CheckCircle2 className="w-4 h-4 text-[#0E9F8E] shrink-0" />}
                  </button>
                </div>
              </div>

              {/* Property Typology */}
              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-[#102A43]">
                  {lang === 'ro' ? '2. Ce tip de folosință sau tipologie are proprietatea?' : lang === 'fa' ? '۲. نوع کاربری یا تیپولوژی غالب ملک چیست؟' : '2. What is the predominant property typology?'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {propertyTypes.map((p) => {
                    const isSelected = propertyType === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPropertyType(p.id)}
                        className={`p-4 rounded-2xl border text-start transition-all ${
                          isSelected
                            ? 'border-[#0E9F8E] bg-[#EAF8F5] text-[#102A43] shadow-2xs ring-1 ring-[#0E9F8E]'
                            : 'border-[#E2E8F0] bg-white text-[#334E68] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-bold block">
                          {p.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Lifecycle Stage */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base sm:text-lg font-bold text-[#102A43]">
                {lang === 'ro' ? '3. În ce etapă a ciclului de viață se află proprietatea?' : lang === 'fa' ? '۳. ملک در حال حاضر در کدام مرحله از چرخه عمر قرار دارد؟' : '3. What is the current lifecycle stage of the property?'}
              </h3>
              <div className="space-y-2.5">
                {stages.map((st) => {
                  const isSelected = stage === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStage(st.id)}
                      className={`w-full p-4 rounded-2xl border text-start transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-[#0E9F8E] bg-[#EAF8F5] text-[#102A43] shadow-2xs ring-1 ring-[#0E9F8E]'
                          : 'border-[#E2E8F0] bg-white text-[#334E68] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold">
                        {st.label}
                      </span>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Desired Services */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-[#102A43]">
                  {lang === 'ro' ? '4. Ce servicii sau capabilități te interesează?' : lang === 'fa' ? '۴. کدام حوزه‌های خدمات یا ماژول‌ها مورد نیاز شماست؟' : '4. Which service domains are you seeking?'}
                </h3>
                <span className="text-xs text-[#627D98]">
                  {lang === 'ro' ? '(Selectează una sau mai multe)' : lang === 'fa' ? '(امکان انتخاب چند مورد)' : '(Select all that apply)'}
                </span>
              </div>
              <div className="space-y-2.5">
                {availableServices.map((srv) => {
                  const isChecked = services.includes(srv.id);
                  return (
                    <div
                      key={srv.id}
                      onClick={() => toggleService(srv.id)}
                      className={`p-4 rounded-2xl border cursor-pointer text-start transition-all flex items-start gap-3 ${
                        isChecked
                          ? 'border-[#0E9F8E] bg-[#EAF8F5] text-[#102A43] ring-1 ring-[#0E9F8E]'
                          : 'border-[#E2E8F0] bg-white text-[#334E68] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 shrink-0 ${isChecked ? 'bg-[#0E9F8E] border-[#0E9F8E] text-white' : 'border-[#CBD5E1] bg-white'}`}>
                        {isChecked && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-bold block">
                          {srv.label}
                        </span>
                        <span className="text-xs text-[#52667A]">
                          {srv.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 5: Workspace Status */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base sm:text-lg font-bold text-[#102A43]">
                {lang === 'ro' ? '5. Care este situația mediului tău Workspace?' : lang === 'fa' ? '۵. وضعیت محیط کاری (Workspace) شما چگونه است؟' : '5. What is your current Workspace operational status?'}
              </h3>
              <div className="space-y-2.5">
                {workspaceStatuses.map((ws) => {
                  const isSelected = workspaceStatus === ws.id;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => setWorkspaceStatus(ws.id)}
                      className={`w-full p-4 rounded-2xl border text-start transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-[#0E9F8E] bg-[#EAF8F5] text-[#102A43] shadow-2xs ring-1 ring-[#0E9F8E]'
                          : 'border-[#E2E8F0] bg-white text-[#334E68] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-bold">
                        {ws.label}
                      </span>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] text-xs text-[#52667A] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0E9F8E] shrink-0" />
                <span>
                  {lang === 'ro'
                    ? 'Trimiterea acestui formular nu reprezintă crearea automată a unui cont cu plată. Datele servesc exclusiv evaluării preliminare.'
                    : lang === 'fa'
                    ? 'ثبت این فرم به منزله خرید قطعی اشتراک یا ایجاد تعهد مالی نیست؛ اطلاعات صرفاً جهت ارزیابی فنی و مشاوره استفاده خواهد شد.'
                    : 'Submitting this form does not execute a paid subscription. Data is used strictly for onboarding discovery.'}
                </span>
              </div>
            </div>
          )}

          {/* Step 6: Contact Information & Submission */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-base sm:text-lg font-bold text-[#102A43]">
                {lang === 'ro' ? '6. Date de contact & Detalii proiect' : lang === 'fa' ? '۶. اطلاعات تماس و مشخصات تکمیلی پروژه' : '6. Contact Details & Additional Project Notes'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#102A43] block mb-1">
                    {lang === 'ro' ? 'Nume & Prenume *' : lang === 'fa' ? 'نام و نام خانوادگی *' : 'Full Name *'}
                  </label>
                  <div className="relative">
                    <User className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={lang === 'ro' ? 'Ion Popescu' : lang === 'fa' ? 'مثال: علی رضایی' : 'John Doe'}
                      className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#102A43] block mb-1">
                    {lang === 'ro' ? 'Email de contact *' : lang === 'fa' ? 'پست الکترونیک (ایمیل) *' : 'Email Address *'}
                  </label>
                  <div className="relative">
                    <Mail className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@example.com"
                      className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#102A43] block mb-1">
                    {lang === 'ro' ? 'Număr de telefon' : lang === 'fa' ? 'شماره تماس' : 'Phone Number'}
                  </label>
                  <div className="relative">
                    <Phone className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+40 700 000 000"
                      className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#102A43] block mb-1">
                    {lang === 'ro' ? 'Oraș / Regiune' : lang === 'fa' ? 'شهر / استان' : 'City / Region'}
                  </label>
                  <div className="relative">
                    <MapPin className={`w-4 h-4 text-[#627D98] absolute top-3 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={lang === 'ro' ? 'București, Cluj, Timișoara...' : lang === 'fa' ? 'تهران، بخارست یا...' : 'Bucharest, London...'}
                      className={`w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#102A43] block mb-1">
                    {lang === 'ro' ? 'Număr estimat de unități / spații' : lang === 'fa' ? 'تعداد تقریبی واحدها یا مساحت کل' : 'Estimated Units / Spaces Count'}
                  </label>
                  <input
                    type="text"
                    value={unitsCount}
                    onChange={(e) => setUnitsCount(e.target.value)}
                    placeholder={lang === 'ro' ? 'ex. 1 bloc de 80 apartamente sau 5 spații comerciale' : lang === 'fa' ? 'مثال: یک مجتمع ۶۰ واحدی یا ۳ سوله انبار' : 'e.g. 80 residential units or 12 commercial offices'}
                    className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#102A43] block mb-1">
                    {lang === 'ro' ? 'Note suplimentare sau întrebări specifice' : lang === 'fa' ? 'توضیحات تکمیلی یا پرسش‌های ویژه' : 'Additional Notes or Questions'}
                  </label>
                  <textarea
                    rows={3}
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder={lang === 'ro' ? 'Menționează detalii despre data estimată de începere, softurile anterioare folosite etc.' : lang === 'fa' ? 'توضیحات بیشتر درباره زمان‌بندی مدنظر، نرم‌افزارهای قبلی یا نیازهای خاص...' : 'Mention any timing, legacy software, or specific requests...'}
                    className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none"
                  />
                </div>
              </div>

              {/* Privacy Consent Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#52667A]">
                  <input
                    type="checkbox"
                    required
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    className="mt-0.5 rounded border-[#CBD5E1] text-[#0E9F8E] focus:ring-[#0E9F8E]"
                  />
                  <span>
                    {lang === 'ro' ? (
                      <>
                        Sunt de acord cu prelucrarea datelor transmise conform{' '}
                        <Link href={`/${lang}/privacy`} className="text-[#0E9F8E] underline font-semibold">
                          Politicii de Confidențialitate
                        </Link>{' '}
                        CLADORA.
                      </>
                    ) : lang === 'fa' ? (
                      <>
                        با پردازش اطلاعات ارسالی در چارچوب{' '}
                        <Link href={`/${lang}/privacy`} className="text-[#0E9F8E] underline font-semibold">
                          سیاست حفظ حریم خصوصی
                        </Link>{' '}
                        کلادورا موافقت می‌نمایم.
                      </>
                    ) : (
                      <>
                        I consent to the processing of submitted details in accordance with the{' '}
                        <Link href={`/${lang}/privacy`} className="text-[#0E9F8E] underline font-semibold">
                          Privacy Policy
                        </Link>
                        .
                      </>
                    )}
                  </span>
                </label>
              </div>

              {/* Turnstile Captcha if required */}
              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <div className="pt-2">
                  <TurnstileWidget
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    lang={lang}
                    onToken={(token: string | null) => setTurnstileToken(token)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error Message Box */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="pt-4 border-t border-[#F0F4F8] flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-[#334E68] bg-[#F0F4F8] hover:bg-[#E2E8F0] rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === 'ro' ? 'Înapoi' : lang === 'fa' ? 'مرحله قبل' : 'Back'}</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!isStepValid()}
                className={`px-6 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  isStepValid()
                    ? 'bg-[#0E9F8E] hover:bg-[#0A7E71] text-white shadow-sm'
                    : 'bg-[#E2E8F0] text-[#9FB3C8] cursor-not-allowed'
                }`}
              >
                <span>{lang === 'ro' ? 'Continuă' : lang === 'fa' ? 'گام بعدی' : 'Continue'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!isStepValid() || isSubmitting}
                className={`px-7 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                  isStepValid() && !isSubmitting
                    ? 'bg-[#0E9F8E] hover:bg-[#0A7E71] text-white shadow-md hover:shadow-lg'
                    : 'bg-[#E2E8F0] text-[#9FB3C8] cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ro' ? 'Se transmite cererea...' : lang === 'fa' ? 'در حال ثبت درخواست...' : 'Submitting inquiry...'}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === 'ro' ? 'Transmite Solicitarea' : lang === 'fa' ? 'ثبت و ارسال نهایی درخواست' : 'Submit Partnership Inquiry'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>

        </form>

      </div>

    </div>
  );
};
