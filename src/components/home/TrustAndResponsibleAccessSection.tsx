import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import {
  ShieldCheck,
  Lock,
  EyeOff,
  FileCheck2,
  Database,
  Server,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface TrustAndResponsibleAccessSectionProps {
  lang: Language;
}

export const TrustAndResponsibleAccessSection: React.FC<TrustAndResponsibleAccessSectionProps> = ({ lang }) => {
  return (
    <section className="py-20 bg-[#F8FAFC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Siguranță și Confidențialitate' : lang === 'fa' ? 'امنیت و حفظ حریم خصوصی' : 'Privacy & Data Protection'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro'
              ? 'Datele tale sunt protejate, iar confidențialitatea este respectată'
              : lang === 'fa'
              ? 'امنیت در پشت صحنه، شفافیت و آرامش برای کاربران'
              : 'Your Data is Protected and Kept Strictly Confidential'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Actele de proprietate și plățile asociației au nevoie de siguranță maximă. CLADORA folosește reguli clare de securitate: fiecare utilizator vede doar informațiile la care are dreptul, fără complicații inutile.'
              : lang === 'fa'
              ? 'اسناد ملکی و حساب‌های مالی ساختمان نیازمند بیشترین سطح امنیت هستند. در کلادورا، هر کاربر صرفاً اطلاعات مربوط به خود را می‌بیند و حریم خصوصی همه به خوبی حفظ می‌شود.'
              : 'Property documents and financial records require top-tier protection. CLADORA applies strict privacy rules: everyone sees only what they are authorized to see, without unnecessary friction.'}
          </p>
        </div>

        {/* 4 Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Spații Separate de Lucru' : lang === 'fa' ? 'فضاهای کاری مجزا برای هر مجموعه' : 'Separate Spaces for Each Organization'}
            </h3>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Nicio asociație sau firmă nu poate vedea actele sau registrele alteia. Datele fiecărui client sunt izolate și protejate.'
                : lang === 'fa'
                ? 'هیچ ساختمانی به اسناد یا دفاتر ساختمان دیگر دسترسی ندارد. اطلاعات هر مجموعه کاملاً مستقل و محفوظ نگهداری می‌شود.'
                : 'No building or company can see another’s files or ledgers. Every client’s data is strictly isolated and protected.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Confidențialitate Între Locatari' : lang === 'fa' ? 'حفظ حریم خصوصی ساکنان' : 'Privacy Between Residents'}
            </h3>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Chiriașul își vede doar cheltuielile proprii de consum. Actele private ale proprietarului și fondul de reparații nu sunt expuse.'
                : lang === 'fa'
                ? 'مستأجر فقط سهم هزینه‌های مصرفی خود را می‌بیند؛ اسناد مالکیت و امور خصوصی مالک کاملاً محرمانه می‌ماند.'
                : 'Tenants see only their own utility dues. Owner private records and reserve funds remain private.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Confirmare Suplimentară la Decizii Importante' : lang === 'fa' ? 'تأیید مجدد برای عملیات حساس' : 'Extra Confirmation for Critical Actions'}
            </h3>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Schimbarea contului bancar al blocului, închiderea lunii sau votul la adunare cer o confirmare în plus pentru a evita greșelile.'
                : lang === 'fa'
                ? 'تغییر حساب بانکی ساختمان، بستن حساب‌های ماهانه یا ثبت رأی نیازمند تأیید دوباره است تا از هرگونه اشتباه جلوگیری شود.'
                : 'Changing bank details, closing monthly accounts, or official voting requires an extra confirmation step to prevent mistakes.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Istoric al Acțiunilor Înregistrate' : lang === 'fa' ? 'سوابق اقدامات ثبت‌شده' : 'History of Recorded Actions'}
            </h3>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Sumele încasate, facturile aprobate sau indexurile transmise rămân consemnate cu autorul și data respectivă, pentru o verificare clară a evidențelor.'
                : lang === 'fa'
                ? 'پرداخت‌های ثبت‌شده، فاکتورهای تأییدشده یا ارقام کنتور با مشخصات ثبت‌کننده و زمان ثبت نگهداری می‌شوند تا بررسی سوابق همیشه آسان و روشن باشد.'
                : 'Recorded payments, approved invoices, and submitted meter readings retain their author attribution and timestamp for clear verification.'}
            </p>
          </div>

        </div>

        {/* Responsible Access Callout */}
        <div className="p-6 rounded-2xl bg-white border border-[#CBD5E1] text-xs text-[#52667A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-[#0E9F8E] shrink-0" />
            <span>
              {lang === 'ro'
                ? 'Datele asociației sunt gestionate transparent: poți genera rapoarte și extrase de activitate autorizate, în conformitate cu politicile de acces și confidențialitate.'
                : lang === 'fa'
                ? 'داده‌های ساختمان با شفافیت مدیریت می‌شوند: امکان دریافت گزارش‌ها و خلاصه‌های مجاز متناسب با دسترسی‌ها و سیاست‌های حفظ حریم خصوصی فراهم است.'
                : 'Building records are managed transparently: generate authorized reports and summaries in accordance with access and data policies.'}
            </span>
          </div>

          <Link
            href={`/${lang}/platform/trust`}
            className="text-xs font-bold text-[#0E9F8E] hover:underline shrink-0 flex items-center gap-1"
          >
            <span>{lang === 'ro' ? 'Citește mai multe despre securitate' : lang === 'fa' ? 'اطلاعات بیشتر درباره امنیت داده‌ها' : 'Learn more about data security'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </section>
  );
};
