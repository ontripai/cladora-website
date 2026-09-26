import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { SeventeenCoresExplorer } from '@/components/home/SeventeenCoresExplorer';




export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}


export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/modules', params.lang);
}

export default async function ModulesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-[#334E68] mb-8 font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Module & Capabilități' : lang === 'fa' ? 'ماژول‌ها و هسته‌های نرم‌افزاری' : 'Modules & Capabilities'}
          </span>
        </div>

        {/* Hero */}
        <div className="max-w-3xl space-y-4">
          <span className="text-xs font-bold text-[#087A6E] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Arhitectura celor 17 Nuclee' : lang === 'fa' ? 'معماری ۱۷ هسته نرم‌افزاری' : 'The 17 Logical Cores'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro'
              ? 'Arhitectura Modulară CLADORA'
              : lang === 'fa'
              ? 'معماری ماژولار و یکپارچه کلادورا'
              : 'CLADORA Modular Architecture'}
          </h1>
          <p className="text-base sm:text-lg text-[#334E68] leading-relaxed">
            {lang === 'ro'
              ? 'Platforma este structurată în 17 nuclee logice organizate pe 3 faze evolutive: P1 (Fundația MVP & Adevăr Financiar), P2 (Operațiuni & Guvernanță) și P3 (Inteligență de Cost & Valoare Activ).'
              : lang === 'fa'
              ? 'پلتفرم کلادورا در قالب ۱۷ هسته نرم‌افزاری و در قالب نقشهٔ راه ۳ فازی طراحی شده است: فاز ۱ (فونداسیون حسابداری و دفتر کل تغییرناپذیر)، فاز ۲ (عملیات روزمره، کنتورها و مجامع) و فاز ۳ (هوش مصنوعی و ارتقای ارزش دارایی).'
              : 'Structured into 17 logical cores across 3 progressive phases: P1 (MVP Foundation & Financial Truth), P2 (Operations & Governance), and P3 (Cost Intelligence & Asset Value).'}
          </p>
        </div>

        {/* Phase Summary Legend */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-8">
          <div className="card-proptech p-5 bg-white border-l-4 border-l-[#087A6E]">
            <div className="text-xs font-bold text-[#087A6E] uppercase tracking-wider">
              {lang === 'ro' ? 'Faza P1 — MVP Foundation' : lang === 'fa' ? 'فاز ۱ — فونداسیون هسته و حسابداری' : 'Phase P1 — MVP Foundation'}
            </div>
            <div className="text-sm font-bold text-[#102A43] mt-1 font-mono ltr-isolate">C01, C02, C06, C08, C11, C16, C17</div>
            <p className="text-xs text-[#334E68] mt-1">
              {lang === 'ro'
                ? 'Conceput pentru: evidență statutară în partidă simplă, control analitic în partidă dublă, alocare CPI, contoare, avizier și Shadow Ledger.'
                : lang === 'fa'
                ? 'طراحی‌شده برای: دفاتر قانونی یک‌طرفه، کنترل تحلیلی تکمیلی دوطرفه، تسهیم سهم مشاع، قرائت کنتورها و Shadow Ledger.'
                : 'Designed for: statutory simple-entry accounting, supplemental double-entry ledger, CPI allocation, meters, and Shadow Ledger.'}
            </p>
          </div>

          <div className="card-proptech p-5 bg-white border-l-4 border-l-[#2F80ED]">
            <div className="text-xs font-bold text-[#2F80ED] uppercase tracking-wider">
              {lang === 'ro' ? 'Faza P2 — Operațiuni & Guvernanță' : lang === 'fa' ? 'فاز ۲ — عملیات و حاکمیت مجامع' : 'Phase P2 — Ops & Governance'}
            </div>
            <div className="text-sm font-bold text-[#102A43] mt-1 font-mono ltr-isolate">C03, C04, C05, C07, C09, C10, C12</div>
            <p className="text-xs text-[#334E68] mt-1">
              {lang === 'ro' 
                ? 'Trezorerie, restanțe, calendar fiscal, mentenanță, contracte furnizori și vot Adunare Generală.' 
                : lang === 'fa'
                ? 'خزانه‌داری، وصول مطالبات، تقویم مالیاتی، تعمیرات، قراردادها و رأی‌گیری مجمع عمومی.'
                : 'Treasury, arrears, fiscal calendar, maintenance, supplier contracts, and AGM voting.'}
            </p>
          </div>

          <div className="card-proptech p-5 bg-white border-l-4 border-l-[#047857]">
            <div className="text-xs font-bold text-[#047857] uppercase tracking-wider">
              {lang === 'ro' ? 'Faza P3 — Inteligență & Valoare' : lang === 'fa' ? 'فاز ۳ — هوش مصنوعی و ارزش دارایی' : 'Phase P3 — Intelligence & Value'}
            </div>
            <div className="text-sm font-bold text-[#102A43] mt-1 font-mono ltr-isolate">C13, C14, C15</div>
            <p className="text-xs text-[#334E68] mt-1">
              {lang === 'ro' 
                ? 'Parcări inteligente, benchmarking de cost între blocuri și economii verificate de energie.' 
                : lang === 'fa'
                ? 'پارکینگ هوشمند، مقایسه تطبیقی هزینه‌ها میان مجتمع‌ها و پایش بهینه‌سازی انرژی.'
                : 'Smart parking, cross-building benchmarking, and verified energy savings.'}
            </p>
          </div>
        </div>

        {/* 17 Cores Explorer Component */}
        <SeventeenCoresExplorer lang={lang} />

      </div>
    </main>
  );
}
