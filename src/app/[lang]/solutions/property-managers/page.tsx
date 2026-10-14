import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Layers, 
  CheckCircle2, 
  Building2, 
  Users, 
  Wrench, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';

import { buildPageMetadata } from '@/config/seo';





export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/solutions/property-managers', params.lang);
}

export default async function PropertyManagersSolutionPage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = await props.params;
  const lang = params.lang;

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-[#52667A] mb-8 font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'خانه' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#52667A]">
            {lang === 'ro' ? 'Soluții' : lang === 'fa' ? 'راهکارها' : 'Solutions'}
          </span>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Companii de Administrare' : lang === 'fa' ? 'شرکت‌های مدیریت املاک' : 'Property Management Firms'}
          </span>
        </div>

        {/* Hero */}
        <div className="card-proptech p-8 sm:p-12 bg-white border-[#D3DCE6] space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62]">
            <Layers className="w-4 h-4 text-[#0E9F8E]" />
            <span>
              {lang === 'fa' 
                ? 'Manager OS — سیستم شرکت‌های مدیریت املاک' 
                : 'CLADORA Manager OS'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight max-w-3xl">
            {lang === 'ro'
              ? 'Dezvoltă-ți compania de administrare fără blocaje operaționale'
              : lang === 'fa'
              ? 'توسعه و رشد شرکت مدیریت املاک با هماهنگی و انضباط کامل عملیاتی'
              : 'Grow Your Property Management Operations Without Operational Bottlenecks'}
          </h1>

          <p className="text-base sm:text-lg text-[#52667A] max-w-3xl leading-relaxed">
            {lang === 'ro'
              ? 'Închidere organizată de lună pentru zeci de asociații simultan, dispecerat tichete mentenanță cu timpi de reacție clari și monitorizarea performanței furnizorilor.'
              : lang === 'fa'
              ? 'بستن منظم دوره‌های ماهانه برای ده‌ها مجتمع، ثبت و ارجاع دقیق تیکت‌های فنی به تکنسین‌ها و ارزیابی کیفیت کار پیمانکاران.'
              : 'Organized month-end close across multi-association portfolios, dispatch ticket SLAs, and vendor service oversight.'}
          </p>

          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              href={`/${lang}/demo`}
              className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <span>{lang === 'ro' ? 'Vezi demonstrația Manager Pro' : lang === 'fa' ? 'ورود به نسخه نمایشی شرکت مدیریت' : 'View Manager Pro demo'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/contact`}
              className="px-6 py-3.5 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold transition-all"
            >
              {lang === 'ro' ? 'Solicită parteneriat' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Request partnership intake'}
            </Link>
          </div>
        </div>

        {/* Feature Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="card-proptech p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Închidere Multi-Asociație' : lang === 'fa' ? 'موتور بستن دسته‌ای دوره‌ها (Batch Close)' : 'Batch Month-Close Engine'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Tablou unificat pentru progresul închiderii lunare pe toate clădirile din portofoliu.' 
                : lang === 'fa'
                ? 'داشبورد متمرکز جهت رصد پیشرفت بستن حساب‌ها و داده‌های ناقص در تمامی ساختمان‌های تحت قرارداد.'
                : 'Unified dashboard tracking closing progression and missing data across all client buildings.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDF5FF] text-[#2F80ED] flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Dispecerat Mentenanță & SLA' : lang === 'fa' ? 'مرکز دیسپچینگ تعمیرات و پایش SLA' : 'Maintenance Dispatch & SLA'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Alocare automată tichete către tehnicieni cu urmărirea timpului de reacție și rezolvare.' 
                : lang === 'fa'
                ? 'ارجاع هوشمند تیکت‌ها به تکنسین‌های داخلی یا پیمانکاران شخص ثالث با زمان‌سنج کنترل تعهدات SLA.'
                : 'Assign tasks to internal technicians or 3rd-party vendors with SLA countdown timers.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF7E6] text-[#D99B26] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Delegare de Roluri în Echipă' : lang === 'fa' ? 'تفکیک دسترسی‌ها و مدیریت تیم کارشناسان' : 'Team Role Delegation'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Permisiuni granulare pentru contabili, administratori de teren, casieri și tehnicieni.' 
                : lang === 'fa'
                ? 'سطوح دسترسی دقیق و مجزا برای حسابداران، مدیران اجرایی میدانی، صندوق‌داران و کارشناسان فنی.'
                : 'Granular staff permissions for accountants, field inspectors, and maintenance teams.'}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
