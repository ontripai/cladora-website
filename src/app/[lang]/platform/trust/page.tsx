import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  Database, 
  Layers, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle2,
  FileCheck2,
  AlertTriangle,
  Server,
  Globe
} from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/platform/trust', params.lang);
}

export default async function PlatformTrustPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumb: { home: 'Acasă', platform: 'Platformă', current: 'Încredere & Securitate' },
      hero: {
        badge: 'ARHITECTURĂ DE SECURITATE & GUVERNANȚĂ',
        title: 'Arhitectura de Încredere & Guvernanță CLADORA',
        subtitle:
          'O abordare inginerească riguroasă a securității: delimitare pe workspace, autoritate contextuală pe mandat, cerințe AAL2, principiul Zero-Write Denial și rezidență europeană a datelor.',
      },
      pillarsTitle: 'Pilonii Arhitecturali de Securitate și Conformitate',
      pillars: [
        {
          title: 'Granițe Logice de Workspace',
          desc: 'Fiecare organizație, asociație sau companie de property management operează în propriul spațiu logic de date. Izolarea la nivel de interogare previne expunerea neautorizată între entități.',
          icon: Layers,
        },
        {
          title: 'Autoritate Contextuală pe Mandat',
          desc: 'Drepturile de acces sunt legate de mandate legale cu termen definit și responsabilitate clară. Sistemul respinge permisiunile globale opace.',
          icon: KeyRound,
        },
        {
          title: 'Cerințe de Autentificare AAL2',
          desc: 'Operațiunile sensibile și accesul la panourile de control sunt proiectate în jurul cerințelor avansate de autentificare (AAL2), incluzând verificarea celui de-al doilea factor (MFA/TOTP).',
          icon: Lock,
        },
        {
          title: 'Principiul Zero-Write Denial',
          desc: 'Când autoritatea sau mandatul nu pot fi verificate cert, starea implicită și de siguranță a platformei este refuzul oricărei mutații de date.',
          icon: AlertTriangle,
        },
        {
          title: 'Jurnal de Audit Aditiv',
          desc: 'Fiecare operațiune cu impact înregistrează o consemnare cronologică aditivă și verificabilă, permițând reconstituirea exactă a istoricului decizional.',
          icon: ShieldCheck,
        },
        {
          title: 'Proveniența Migrării de Date',
          desc: 'Metodologia de import a asociațiilor din sisteme vechi urmează o procedură controlată: sursă → mapare → transformare → validare → import → reconciliere.',
          icon: RefreshCw,
        },
        {
          title: 'Idempotență & Disciplină de Rollback',
          desc: 'Mutațiile financiare și tehnice sunt proiectate ca operațiuni idempotente, prevenind dublarea debitelor sau plăților în cazul reluării tranzacțiilor.',
          icon: Database,
        },
        {
          title: 'Protecția Datelor & Rezidență UE',
          desc: 'Infrastructura este găzduită în Uniunea Europeană, respectând cerințele GDPR privind minimizarea colectării și limitarea scopului prelucrării datelor.',
          icon: Globe,
        },
      ],
      canonicalNote: {
        title: 'Integritatea Adevărului Canonic',
        desc: 'Niciun subsistem secundar sau modul extern nu poate suprascrie registrul contabil (FIN01) sau evidența de identitate (CORE). Această disciplină arhitecturală protejează sistemul împotriva reconcilierilor conflictuale sau coruperii datelor statutare.',
      },
      cta: {
        title: 'Verifică Specificațiile Tehnice',
        desc: 'Explorează arhitectura decuplată pe 4 niveluri sau ciclul de viață al activelor.',
        archLink: 'Arhitectura de Sistem Detaliată',
        lifecycleLink: 'Ciclul de Viață al Proprietății',
      },
    },
    en: {
      breadcrumb: { home: 'Home', platform: 'Platform', current: 'Trust & Governance' },
      hero: {
        badge: 'SECURITY & GOVERNANCE ARCHITECTURE',
        title: 'CLADORA Trust & Governance Architecture',
        subtitle:
          'An engineering-first approach to security: workspace-scoped boundaries, mandate-based authority, AAL2 security controls, the Zero-Write Denial principle, and European data residency.',
      },
      pillarsTitle: 'Architectural Security & Governance Pillars',
      pillars: [
        {
          title: 'Workspace-Scoped Boundaries',
          desc: 'Every organization, HOA, or management company operates within an isolated logical data boundary. Query-level multi-tenant filters prevent cross-tenant data exposure.',
          icon: Layers,
        },
        {
          title: 'Contextual, Mandate-Based Authority',
          desc: 'Access rights derive strictly from verified legal mandates with defined spatial scope and expiration dates, eliminating untracked global administrator accounts.',
          icon: KeyRound,
        },
        {
          title: 'AAL2-Aligned Authentication',
          desc: 'Consequential operations and administrative control plane access are designed around elevated authentication assurance (AAL2), including verified MFA/TOTP factors.',
          icon: Lock,
        },
        {
          title: 'Zero-Write Denial Principle',
          desc: 'When authorization, temporal validity, or mandate context cannot be conclusively established, the safe default state is immediate mutation denial.',
          icon: AlertTriangle,
        },
        {
          title: 'Auditable Event Journal',
          desc: 'Every consequential operational action generates an append-only, chronological event record, enabling complete post-hoc operational audits.',
          icon: ShieldCheck,
        },
        {
          title: 'Governed Migration Provenance',
          desc: 'Historical data ingestion protocols follow a structured runbook: source extraction → schema mapping → data transformation → validation → ingestion → balance reconciliation.',
          icon: RefreshCw,
        },
        {
          title: 'Idempotency & Rollback Discipline',
          desc: 'Transactional operations are engineered for idempotency, ensuring network retries or batch re-runs never result in duplicate financial postings or invoice double-entry.',
          icon: Database,
        },
        {
          title: 'GDPR Compliance & EU Residency',
          desc: 'Data infrastructure is hosted within the European Union, adhering to GDPR data minimization, purpose limitation, and strict user privacy principles.',
          icon: Globe,
        },
      ],
      canonicalNote: {
        title: 'Canonical Truth Integrity',
        desc: 'No downstream subsystem or third-party extension can bypass or overwrite canonical financial ledgers (FIN01) or core identity records (CORE). This architectural barrier prevents conflicting reconciliations and preserves statutory truth.',
      },
      cta: {
        title: 'Review Complete Platform Architecture',
        desc: 'Inspect the 4-tier system model or review the property lifecycle architecture.',
        archLink: 'Deep System Architecture',
        lifecycleLink: 'Property Lifecycle Hub',
      },
    },
    fa: {
      breadcrumb: { home: 'صفحه اصلی', platform: 'پلتفرم', current: 'اعتماد و امنیت' },
      hero: {
        badge: 'معماری امنیت، اعتماد و حاکمیت داده‌ها',
        title: 'معماری اعتماد و حاکمیت سیستم در کلادورا',
        subtitle:
          'رویکردی کاملاً مهندسی و ساختاریافته به مقولهٔ امنیت: مرزهای تفکیک‌شدهٔ ورک‌اسپیس، اختیارات بر مبنای مجوز قانونی، استانداردهای AAL2، اصل عدم تغییر بدون مجوز و میزبانی امن در اروپا.',
      },
      pillarsTitle: 'ارکان ساختاری امنیت و انضباط داده‌ها',
      pillars: [
        {
          title: 'مرزهای تفکیک‌شدهٔ ورک‌اسپیس',
          desc: 'هر سازمان، مجتمع یا شرکت مدیریت در محیط منطقی مستقل فعالیت می‌کند. فیلترهای سطح پایگاه داده مانع از هرگونه افشای ناخواسته اطلاعات میان سازمان‌ها می‌شوند.',
          icon: Layers,
        },
        {
          title: 'اختیارات بر مبنای مجوز معتبر',
          desc: 'سطح دسترسی منحصراً حاصل مجوز قانونی معتبر، دارای محدوده مشخص و زمان انقضا است و حساب‌های مدیریتی کلی و بدون نظارت در سیستم وجود ندارد.',
          icon: KeyRound,
        },
        {
          title: 'الزامات امنیتی ورود AAL2',
          desc: 'عملیات حساس و دسترسی به بخش‌های مدیریتی بر پایه سطوح ارتقایافتهٔ احراز هویت (AAL2) شامل ورود دومرحله‌ای (MFA/TOTP) طراحی گردیده‌اند.',
          icon: Lock,
        },
        {
          title: 'اصل عدم تغییر بدون مجوز (Zero-Write Denial)',
          desc: 'هرگاه حدود اختیار، زمان اعتبار یا اصالت مجوز کاربر اثبات نشود، واکنش پیش‌فرض و ایمن سیستم رد کامل و بلادرنگ درخواست تغییر خواهد بود.',
          icon: AlertTriangle,
        },
        {
          title: 'لاگ ترتیبی و افزایشی ممیزی',
          desc: 'هر عمل اثرگذار در سیستم، یک رکورد دائمی با مهر زمانی در لاگ رویدادها بر جای می‌گذارد تا امکان ممیزی دقیق عملیات و حسابرسی وجود داشته باشد.',
          icon: ShieldCheck,
        },
        {
          title: 'فرایند استاندارد و مدون مهاجرت داده‌ها',
          desc: 'انتقال سوابق از سیستم‌های سنتی بر اساس یک راهنمای مدون انجام می‌گیرد: استخراج داده ← نگاشت ساختار ← تبدیل ← اعتبارسنجی ← ورود داده‌ها ← مغایرت‌گیری تراز.',
          icon: RefreshCw,
        },
        {
          title: 'قاعدهٔ عدم تکرار تراکنش (Idempotency)',
          desc: 'تراکنش‌های مالی و فنی به صورت پایدار طراحی شده‌اند؛ به‌گونه‌ای که تکرار یک دستور در اثر قطعی ارتباط هرگز منجر به ثبت بدهی دوبل یا فاکتور تکراری نمی‌شود.',
          icon: Database,
        },
        {
          title: 'حریم خصوصی GDPR و میزبانی در اروپا',
          desc: 'زیرساخت داده‌های کلادورا در مراکز داده اتحادیه اروپا میزبانی می‌شود و از اصول تفکیک داده‌ها و استانداردهای حفاظت اطلاعات هویتی و مالی پیروی می‌کند.',
          icon: Globe,
        },
      ],
      canonicalNote: {
        title: 'حفاظت از یکپارچگی حقیقت واحد داده‌ها',
        desc: 'هیچ زیرسیستم فرعی یا بخش خارجی اجازه بازنویسی یا دستکاری سرخود در دفاتر مالی (FIN01) یا هویت دارایی‌ها (CORE) را ندارد. این انضباط معماری مانع از ایجاد ترازهای مغایر و فساد در اسناد قانونی می‌گردد.',
      },
      cta: {
        title: 'بررسی مشخصات فنی پلتفرم',
        desc: 'مدل تفکیک‌شده چهارلایه یا چرخهٔ عمر دارایی‌های فیزیکی را مطالعه فرمایید.',
        archLink: 'معماری تفصیلی سیستم',
        lifecycleLink: 'پیوستگی چرخهٔ عمر ملک',
      },
    },
  }[lang] || {
    breadcrumb: { home: 'Home', platform: 'Platform', current: 'Trust' },
    hero: { badge: '', title: '', subtitle: '' },
    pillarsTitle: '',
    pillars: [],
    canonicalNote: { title: '', desc: '' },
    cta: { title: '', desc: '', archLink: '', lifecycleLink: '' },
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* HERO */}
        <section className="space-y-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#52667A] font-medium">
            <Link href={`/${lang}`} className="hover:text-[#102A43]">
              {content.breadcrumb.home}
            </Link>
            <span>/</span>
            <Link href={`/${lang}/platform`} className="hover:text-[#102A43]">
              {content.breadcrumb.platform}
            </Link>
            <span>/</span>
            <span className="text-[#102A43] font-bold">
              {content.breadcrumb.current}
            </span>
          </nav>

          <div className="max-w-4xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <span className="w-2 h-2 rounded-full bg-[#0E9F8E]" />
              <span>{content.hero.badge}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#102A43] tracking-tight">
              {content.hero.title}
            </h1>
            <p className="text-base sm:text-lg text-[#52667A] leading-relaxed max-w-3xl">
              {content.hero.subtitle}
            </p>
          </div>
        </section>

        {/* 8 TRUST PILLARS GRID */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
            {content.pillarsTitle}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.pillars.map((pil) => {
              const Icon = pil.icon;
              return (
                <div 
                  key={pil.title}
                  className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-[#102A43]">{pil.title}</h3>
                    <p className="text-xs text-[#52667A] leading-relaxed">{pil.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CANONICAL INTEGRITY NOTE */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-elevated flex items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0 mt-1">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-[#102A43]">{content.canonicalNote.title}</h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.canonicalNote.desc}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-xl sm:text-2xl font-bold text-[#102A43]">{content.cta.title}</h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">{content.cta.desc}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link
              href={`/${lang}/platform/architecture`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card flex items-center justify-center gap-2"
            >
              <span>{content.cta.archLink}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/platform/lifecycle`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#F6F9FC] text-[#102A43] border border-[#D3DCE6] text-xs font-bold hover:bg-[#E2E8F0] transition flex items-center justify-center gap-2"
            >
              <span>{content.cta.lifecycleLink}</span>
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
