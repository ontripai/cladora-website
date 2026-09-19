import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Cpu, 
  Layers, 
  Database, 
  ShieldCheck, 
  Scale, 
  ArrowRight, 
  CheckCircle2,
  FileSpreadsheet,
  Server,
  Zap
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
  return getRouteMetadata('/platform', params.lang);
}

export default async function PlatformPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-[#52667A] mb-8 font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'خانه' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Arhitectura Platformei' : lang === 'fa' ? 'معماری پلتفرم' : 'Platform Architecture'}
          </span>
        </div>

        {/* Hero Section */}
        <div className="max-w-3xl space-y-4">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Arhitectura Sistemului de Operare' : lang === 'fa' ? 'معماری سیستم‌عامل مدیریت دارایی' : 'Operating System Architecture'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Un singur model de date pentru întregul ciclu de viață rezidențial' 
              : lang === 'fa'
              ? 'یک مدل داده واحد و تغییرناپذیر برای کل چرخه عمر دارایی‌های مسکونی'
              : 'One Unified Data Model for the Entire Residential Lifecycle'}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'CLADORA nu este o colecție de module disparate legate cu scripturi, ci o platformă integrată construită pe principiul adevărului financiar unic, izolării multi-tenant și trasabilității complete.'
              : lang === 'fa'
              ? 'کلادورا صرفاً مجموعه‌ای از نرم‌افزارهای پراکنده نیست؛ بلکه پلتفرمی مهندسی‌شده بر پایه اصل حقیقت مالی واحد، جداسازی پایگاه‌داده‌ها و ردیابی کامل اسناد است.'
              : 'CLADORA connects accounting, metering, occupancy, and asset governance on an immutable financial ledger.'}
          </p>
        </div>

        {/* 3 Core Layers of Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-14">
          
          <div className="card-proptech p-6 bg-white space-y-4 border-t-4 border-t-[#102A43]">
            <div className="w-10 h-10 rounded-xl bg-[#F0F4F8] text-[#102A43] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[#102A43]">
              {lang === 'ro' ? '1. Stratul Adevărului Financiar' : lang === 'fa' ? '۱. لایه حقیقت مالی و حسابداری' : '1. Financial Truth Layer'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Registre obligatorii în partidă simplă, control analitic suplimentar în partidă dublă, reconciliere bancară asistată și stornări auditate.'
                : lang === 'fa'
                ? 'دفاتر قانونی یک‌طرفه، کنترل تحلیلی تکمیلی دوطرفه، تطبیق هدایت‌شده با صورت‌حساب بانکی و اسناد اصلاحی مستند.'
                : 'Statutory simple-entry registers, supplemental analytical double-entry verification, assisted bank reconciliation, and auditable logs.'}
            </p>
            <ul className="space-y-2 text-xs text-[#52667A] pt-2 border-t border-[#F0F4F8]">
              <li className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold">✓</span>
                <span>{lang === 'ro' ? 'Plan de conturi analitic adaptat legislației' : lang === 'fa' ? 'کدینگ حسابداری تحلیلی منطبق با نیازهای مجتمع' : 'Analytical chart of accounts for association controls'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold">✓</span>
                <span>{lang === 'ro' ? 'Fără ștergeri neînregistrate' : lang === 'fa' ? 'تغییرناپذیری اسناد بدون حذف مخفی' : 'Zero silent retroactive edits'}</span>
              </li>
            </ul>
          </div>

          <div className="card-proptech p-6 bg-white space-y-4 border-t-4 border-t-[#0E9F8E]">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[#102A43]">
              {lang === 'ro' ? '2. Motorul de Drepturi & Alocare' : lang === 'fa' ? '۲. موتور تسهیم حقوق و هزینه‌ها' : '2. Allocation & Rights Engine'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Calcul matematic determinist pentru cote-părți indivize (CPI), persoane, contoare foto OCR și separare proprietar vs chiriaș.'
                : lang === 'fa'
                ? 'محاسبات ریاضی قطعی برای سهم مشاعات، تعداد نفرات، قرائت کنتورها با هوش مصنوعی و تفکیک هزینه‌های مالک و مستأجر.'
                : 'Deterministic computation for CPI shares, resident counts, meter readings, and debtor vs payer roles.'}
            </p>
            <ul className="space-y-2 text-xs text-[#52667A] pt-2 border-t border-[#F0F4F8]">
              <li className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold">✓</span>
                <span>{lang === 'ro' ? 'Algoritmi CPI certificabili' : lang === 'fa' ? 'فرمول‌های قابل‌اثبات تسهیم سهم مشاع' : 'Auditable CPI formulas'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold">✓</span>
                <span>{lang === 'ro' ? 'Separare 5D drepturi chiriaș' : lang === 'fa' ? 'جداسازی ۵ بعدی حساب مستأجر از مالک' : '5D tenant privacy isolation'}</span>
              </li>
            </ul>
          </div>

          <div className="card-proptech p-6 bg-white space-y-4 border-t-4 border-t-[#2F80ED]">
            <div className="w-10 h-10 rounded-xl bg-[#EDF5FF] text-[#2F80ED] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[#102A43]">
              {lang === 'ro' ? '3. Interfața Operațională Multi-Rol' : lang === 'fa' ? '۳. پوسته عملیاتی متناسب با نقش کاربر' : '3. Multi-Role Operating Shell'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Comutare instantanee între Association OS, Portfolio OS și Manager OS, adaptată rolului exact și dispozitivului folosit.'
                : lang === 'fa'
                ? 'سوئیچ بلادرنگ میان سیستم‌عامل‌های انجمن مالکان، سبد املاک و شرکت مدیریت، متناسب با اختیارات و دستگاه کاربر.'
                : 'Seamless context switching between Association, Portfolio, and Manager OS modes.'}
            </p>
            <ul className="space-y-2 text-xs text-[#52667A] pt-2 border-t border-[#F0F4F8]">
              <li className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold">✓</span>
                <span>{lang === 'ro' ? 'PWA optimizat pentru mobil & tabletă' : lang === 'fa' ? 'وب‌اپلیکیشن واکنش‌گرا (PWA) برای موبایل' : 'PWA-ready mobile and tablet shell'}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold">✓</span>
                <span>{lang === 'ro' ? 'Avizier digital cu confirmare de citire' : lang === 'fa' ? 'تابلوی اعلانات همراه با ثبت دریافت' : 'Digital noticeboard with receipts'}</span>
              </li>
            </ul>
          </div>

        </div>

        {/* CTA Strip */}
        <div className="mt-14 card-proptech p-8 bg-[#102A43] text-white flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white">
              {lang === 'ro' 
                ? 'Vrei să vezi cum funcționează în detaliu cele 17 module?' 
                : lang === 'fa'
                ? 'مایلید با جزئیات عملکرد تمامی ۱۷ هسته نرم‌افزاری آشنا شوید؟'
                : 'Ready to explore all 17 logical cores?'}
            </h3>
            <p className="text-xs text-[#BCCCDC] mt-1">
              {lang === 'ro' 
                ? 'Descoperă matricea completă de capabilități P1, P2 și P3.' 
                : lang === 'fa'
                ? 'ماتریس کامل قابلیت‌ها و نقشه راه فازهای سه‌گانه کلادورا را مرور فرمایید.'
                : 'View the complete capabilities roadmap and functional specs.'}
            </p>
          </div>
          <Link
            href={`/${lang}/modules`}
            className="px-6 py-3 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shrink-0 transition-colors flex items-center gap-2"
          >
            <span>{lang === 'ro' ? 'Explorează cele 17 Module' : lang === 'fa' ? 'مشاهده ۱۷ ماژول نرم‌افزاری' : 'Explore the 17 Modules'}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

      </div>
    </main>
  );
}
