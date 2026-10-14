import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  TrendingUp, 
  CheckCircle2, 
  Building, 
  DollarSign, 
  Calendar, 
  ShieldCheck, 
  ArrowRight,
  FileSpreadsheet
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
  return getRouteMetadata('/solutions/property-owners', params.lang);
}

export default async function PropertyOwnersSolutionPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

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
            {lang === 'ro' ? 'Proprietari cu Portofoliu' : lang === 'fa' ? 'مالکان دارای چند ملک' : 'Multi-Property Owners'}
          </span>
        </div>

        {/* Hero */}
        <div className="card-proptech p-8 sm:p-12 bg-white border-[#D3DCE6] space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62]">
            <TrendingUp className="w-4 h-4 text-[#0E9F8E]" />
            <span>
              {lang === 'fa' 
                ? 'Portfolio OS — سیستم مدیریت سبد املاک' 
                : 'CLADORA Portfolio OS'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight max-w-3xl">
            {lang === 'ro'
              ? 'Un singur tablou de bord pentru toate proprietățile tale închiriate'
              : lang === 'fa'
              ? 'یک داشبورد متمرکز و یکپارچه برای مدیریت کلیه واحدهای استیجاری'
              : 'One Consolidated Dashboard for All Your Rental Properties'}
          </h1>

          <p className="text-base sm:text-lg text-[#52667A] max-w-3xl leading-relaxed">
            {lang === 'ro'
              ? 'Dacă deții mai multe apartamente în blocuri diferite din București, CLADORA îți consolidează automat chiriile încasate, cheltuielile de fond reparații suportate de tine și costurile de întreținere decontate de chiriași.'
              : lang === 'fa'
              ? 'اگر مالک چندین واحد در ساختمان‌های گوناگون هستید، کلادورا دریافتی اجاره‌ها، مخارج صندوق تعمیرات پرداختی توسط شما و هزینه‌های مصرفی شارژ مندرج در حساب مستأجران را به‌طور خودکار تجمیع و تفکیک می‌کند.'
              : 'Manage multiple apartments across different associations. Track rent payments, tenant cost recovery, net yields, and contract renewals from one screen.'}
          </p>

          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              href={`/${lang}/demo`}
              className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <span>{lang === 'ro' ? 'Vezi demonstrația portofoliu' : lang === 'fa' ? 'ورود به نسخه نمایشی سبد املاک' : 'View portfolio demo'}</span>
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
              <DollarSign className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Calcul Automat Yield Net' : lang === 'fa' ? 'محاسبه خودکار بازده خالص (Net Yield)' : 'Automated Net Yield Math'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Randament calculat corect după deducerea fondurilor de reparații, impozitelor și asigurărilor.' 
                : lang === 'fa'
                ? 'محاسبه واقعی و بلادرنگ بازده خالص پس از کسر هزینه‌های استهلاک، بیمه، مالیات و روزهای خالی ماندن ملک.'
                : 'Accurate real-time yield tracking after factoring in capital repair funds, insurance, and taxes.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDF5FF] text-[#2F80ED] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Alerte Expirare Contracte' : lang === 'fa' ? 'سامانه هشدار تمدید قراردادهای اجاره' : 'Lease Renewal Alerts'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Notificări automate cu 60 și 30 de zile înainte de expirarea contractelor de închiriere sau a garanțiilor.' 
                : lang === 'fa'
                ? 'اعلام هشدارهای هوشمند ۳۰ و ۶۰ روز قبل از سررسید قراردادهای اجاره یا تاریخ آزادسازی ودیعه مستأجران.'
                : 'Automated reminders 60/30 days ahead of lease expirations or deposit release dates.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF7E6] text-[#D99B26] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Separare Costuri Proprietar/Chiriaș' : lang === 'fa' ? 'تفکیک ساخت‌یافته هزینه‌های مالک و مستأجر' : 'Clean Expense Allocation'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Listele de întreținere sunt separate automat pe articole pentru a evita neînțelegerile la decontare.' 
                : lang === 'fa'
                ? 'فیش‌های شارژ ماهانه به‌طور خودکار به سهم‌های سرمایه‌ای مالک و مصارف انشعابات مستأجر تفکیک می‌شوند.'
                : 'Monthly condo invoices are parsed into owner capital shares vs tenant consumption lines.'}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
