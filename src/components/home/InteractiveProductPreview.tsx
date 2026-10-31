'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Language, UserRole } from '@/types';
import { 
  PlayCircle, 
  ArrowRight 
} from 'lucide-react';
import { DEMO_ROLES } from '@/data/mockData';
import { Money } from '@/components/ui/Money';

interface ProductPreviewProps {
  lang: Language;
}

export const InteractiveProductPreview: React.FC<ProductPreviewProps> = ({ lang }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('association_admin');

  const roleInfo = DEMO_ROLES.find(r => r.key === selectedRole) || DEMO_ROLES[0];

  return (
    <section className="py-24 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-[#0A6E62] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Demo interactiv al produsului' : lang === 'fa' ? 'دموی تعاملی محصول' : 'Interactive Product Demo'}
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Interfață Adaptată Fiecărui Rol' 
              : lang === 'fa'
              ? 'محیط کاربری اختصاصی برای هر نقش سازمانی'
              : 'An Interface Designed for Every Role'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A]">
            {lang === 'ro'
              ? 'Selectează un rol pentru a vedea cum arată panoul de control dedicat. În aplicația reală, permisiunile configurează automat vizualizarea.'
              : lang === 'fa'
              ? 'نقش مورد نظر را انتخاب کنید تا چیدمان داشبورد و ابزارهای مرتبط با آن را مشاهده نمایید.'
              : 'Select a role to preview the purpose-built dashboard layout.'}
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="flex justify-center mt-12 mb-8">
          <div className="p-1.5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex flex-wrap gap-2 max-w-4xl w-full justify-center">
            
            <button
              type="button"
              onClick={() => setSelectedRole('association_admin')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                selectedRole === 'association_admin'
                  ? 'bg-[#102A43] text-white shadow-sm'
                  : 'text-[#52667A] hover:bg-white hover:text-[#102A43]'
              }`}
            >
              {lang === 'ro' ? 'Administrator' : lang === 'fa' ? 'مدیر مجتمع' : 'Administrator'}
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('owner')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                selectedRole === 'owner'
                  ? 'bg-[#087A6E] text-white shadow-sm'
                  : 'text-[#52667A] hover:bg-white hover:text-[#102A43]'
              }`}
            >
              {lang === 'ro' ? 'Proprietar' : lang === 'fa' ? 'مالک ساکن' : 'Owner'}
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('tenant_resident')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                selectedRole === 'tenant_resident'
                  ? 'bg-[#2F80ED] text-white shadow-sm'
                  : 'text-[#52667A] hover:bg-white hover:text-[#102A43]'
              }`}
            >
              {lang === 'ro' ? 'Chiriaș' : lang === 'fa' ? 'مستأجر' : 'Tenant'}
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('censor')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                selectedRole === 'censor'
                  ? 'bg-[#B45309] text-white shadow-sm'
                  : 'text-[#52667A] hover:bg-white hover:text-[#102A43]'
              }`}
            >
              {lang === 'ro' ? 'Cenzor / Auditor' : lang === 'fa' ? 'بازرس و حسابرس' : 'Censor / Auditor'}
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('portfolio_owner')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                selectedRole === 'portfolio_owner'
                  ? 'bg-[#047857] text-white shadow-sm'
                  : 'text-[#52667A] hover:bg-white hover:text-[#102A43]'
              }`}
            >
              {lang === 'ro' ? 'Proprietar Portofoliu' : lang === 'fa' ? 'سرمایه‌گذار چند ملک' : 'Portfolio Owner'}
            </button>

          </div>
        </div>

        {/* Dashboard Preview Shell */}
        <div className="card-proptech p-6 sm:p-10 bg-[#F6F9FC] border-[#D3DCE6]">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0A6E62] uppercase tracking-wider">
                  {roleInfo.badge[lang]}
                </span>
                <span className="text-xs text-[#52667A]">
                  · {lang === 'ro' ? 'Mod Sandbox Live' : lang === 'fa' ? 'محیط سندباکس تعاملی' : 'Live Sandbox Mode'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-display font-extrabold text-[#102A43] mt-1">
                {roleInfo.title[lang]}
              </h3>
              <p className="text-xs text-[#52667A] mt-1">{roleInfo.description[lang]}</p>
            </div>

            <Link
              href={`/${lang}/demo`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#087A6E] hover:bg-[#066056] text-white text-xs font-bold shadow-sm self-start sm:self-auto"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{lang === 'ro' ? 'Deschide în Demo App' : lang === 'fa' ? 'اجرا در دموی کامل' : 'Launch Full Demo App'}</span>
            </Link>
          </div>

          {/* Role-specific widget mockup */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            
            <div className="card-proptech p-5 bg-white space-y-3">
              <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
                {lang === 'ro' ? 'Acțiuni Primare' : lang === 'fa' ? 'اقدامات دارای اولویت' : 'Primary Actions'}
              </span>
              <div className="space-y-2 text-xs font-bold text-[#102A43]">
                {selectedRole === 'association_admin' && (
                  <>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Închidere Lună Octombrie' : lang === 'fa' ? 'بستن دوره ماه جاری' : 'Month Close'}</span>
                      <span className="text-[#B45309]">{lang === 'ro' ? 'În Curs' : lang === 'fa' ? 'در حال انجام' : 'In Progress'}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Index Contoare Neverificate' : lang === 'fa' ? 'کنتورهای نیازمند بررسی' : 'Meters Pending Review'}</span>
                      <span className="text-[#0A6E62]">{lang === 'ro' ? '4 Rămase' : lang === 'fa' ? '۴ مورد' : '4 Left'}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Plăți Bancare de Reconciliat' : lang === 'fa' ? 'تراکنش‌های بانکی جدید' : 'Bank Matches'}</span>
                      <span className="text-[#047857]">{lang === 'ro' ? '12 Noi' : lang === 'fa' ? '۱۲ تراکنش' : '12 New'}</span>
                    </div>
                  </>
                )}
                {selectedRole === 'owner' && (
                  <>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Total Listă de Plată' : lang === 'fa' ? 'مبلغ کل شارژ ماهانه' : 'Monthly Statement'}</span>
                      <span className="text-[#102A43]">
                        <Money amount={241.77} currency="RON" locale={lang} />
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Transmitere Contor Apă' : lang === 'fa' ? 'ثبت رقم کنتور آب' : 'Meter Submission'}</span>
                      <span className="text-[#047857]">{lang === 'ro' ? '✓ Transmis' : lang === 'fa' ? '✓ ثبت شد' : '✓ Submitted'}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Vot Adunare Generală' : lang === 'fa' ? 'رأی‌گیری مجمع عمومی' : 'AGM Voting'}</span>
                      <span className="text-[#0A6E62]">{lang === 'ro' ? '1 Activ' : lang === 'fa' ? '۱ رأی‌گیری فعال' : '1 Active'}</span>
                    </div>
                  </>
                )}
                {selectedRole === 'tenant_resident' && (
                  <>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Consum Utilizator Octombrie' : lang === 'fa' ? 'سهم مصرفی مستأجر' : 'Tenant Consumption'}</span>
                      <span className="text-[#102A43]">
                        <Money amount={179.27} currency="RON" locale={lang} />
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Acces Cheltuieli Fond Rulment' : lang === 'fa' ? 'دسترسی به صندوق‌های مالک' : 'Reserve Funds Access'}</span>
                      <span className="text-[#52667A]">{lang === 'ro' ? 'Mascat (Proprietar)' : lang === 'fa' ? 'محفوظ (مالک)' : 'Masked (Owner)'}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Tichet Mentenanță Deschis' : lang === 'fa' ? 'تیکت تعمیرات واحد' : 'Maintenance Ticket'}</span>
                      <span className="text-[#0A6E62]">{lang === 'ro' ? '1 În Lucru' : lang === 'fa' ? '۱ در دست اقدام' : '1 In Progress'}</span>
                    </div>
                  </>
                )}
                {selectedRole === 'censor' && (
                  <>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Luni Așteptând Validare Audit' : lang === 'fa' ? 'دوره در انتظار ممیزی' : 'Pending Audit Month'}</span>
                      <span className="text-[#B45309]">{lang === 'ro' ? 'Septembrie 2026' : lang === 'fa' ? 'شهریور ۱۴۰۵' : 'Sep 2026'}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Discrepanțe Balanță' : lang === 'fa' ? 'مغایرت تراز مالی' : 'Ledger Variances'}</span>
                      <span className="text-[#047857]">{lang === 'ro' ? '0 Erori' : lang === 'fa' ? '۰ مغایرت' : '0 Errors'}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Documente Sursă Lipsă' : lang === 'fa' ? 'فاکتورهای فاقد سند' : 'Missing Documents'}</span>
                      <span className="text-[#047857]">0</span>
                    </div>
                  </>
                )}
                {selectedRole === 'portfolio_owner' && (
                  <>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Total Chirii Încasate Luna Curentă' : lang === 'fa' ? 'مجموع اجاره وصول‌شده' : 'Collected Rents'}</span>
                      <span className="text-[#047857] tabular-nums font-mono">3.180 EUR</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Contracte Expirând în 90 Zile' : lang === 'fa' ? 'سررسید قرارداد تا ۹۰ روز' : 'Expiring in 90 Days'}</span>
                      <span className="text-[#B45309]">{lang === 'ro' ? '1 Contract' : lang === 'fa' ? '۱ قرارداد' : '1 Lease'}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F6F9FC] flex justify-between">
                      <span>{lang === 'ro' ? 'Randament Mediu Portofoliu' : lang === 'fa' ? 'میانگین بازدهی سبد املاک' : 'Portfolio Yield'}</span>
                      <span className="text-[#2F80ED]">{lang === 'ro' ? '6.8% Net' : lang === 'fa' ? '۶.۸٪ خالص' : '6.8% Net'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card-proptech p-5 bg-white space-y-3">
              <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
                {lang === 'ro' ? 'Securitate & Vizibilitate' : lang === 'fa' ? 'امنیت و سطوح دسترسی' : 'Security & Scope'}
              </span>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Fiecare utilizator vede doar datele la care are dreptul legal conform rolului. Fără scurgeri de informații între apartamente sau proprietari.'
                  : lang === 'fa'
                  ? 'هر نقش تنها به اطلاعاتی دسترسی دارد که طبق قانون و قرارداد مجاز است. بدون هیچ‌گونه نشت اطلاعات میان مالکان و مستأجران.'
                  : 'Strict attribute-based permissions enforce clear visibility boundaries tailored to this role.'}
              </p>
              <div className="p-3 rounded-lg bg-[#EAF8F5] text-xs text-[#0A6E62] font-bold">
                ✓ {lang === 'ro' ? 'Izolare automată la nivel de sesiune' : lang === 'fa' ? 'جداسازی داده‌ها در سطح نشست کاربر' : 'Session-level data isolation'}
              </div>
            </div>

            <div className="card-proptech p-5 bg-white space-y-3">
              <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
                {lang === 'ro' ? 'Sandbox Interactiv' : lang === 'fa' ? 'محیط سندباکس تعاملی' : 'Interactive Sandbox'}
              </span>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Poți testa toate aceste fluxuri chiar acum, comutând între roluri cu date de test fictive din București.'
                  : lang === 'fa'
                  ? 'همین حالا می‌توانید تمامی این قابلیت‌ها را در محیط تعاملی دمو بدون نیاز به ثبت‌نام بیازمایید.'
                  : 'Explore all workflows directly in our sandbox environment with zero registration required.'}
              </p>
              <Link
                href={`/${lang}/demo`}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#102A43] hover:bg-[#173F5F] text-white text-xs font-bold transition-colors"
              >
                <span>{lang === 'ro' ? 'Intră în Sandbox' : lang === 'fa' ? 'ورود به محیط سندباکس' : 'Enter Sandbox'}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </Link>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
