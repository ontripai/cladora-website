'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { CheckCircle2, ArrowRight, MapPin } from 'lucide-react';
import { PilotApplicationModal } from '@/components/interactive/PilotApplicationModal';

interface PilotSectionProps {
  lang: Language;
}

export const PilotProgramSection: React.FC<PilotSectionProps> = ({ lang }) => {
  const [modalOpen, setModalOpen] = useState(false);

  const perks = [
    lang === 'ro' 
      ? 'Migrare gratuită a bazei de date din softul vechi (BlocManager, Xisoft, Excel)' 
      : lang === 'fa'
      ? 'مهاجرت رایگان پایگاه داده از سامانه‌های قدیمی یا فایل‌های اکسل'
      : 'Free historical database migration from legacy software or spreadsheets',
    lang === 'ro' 
      ? '1-3 luni rulare în paralel fără costuri suplimentare (Shadow Ledger)' 
      : lang === 'fa'
      ? '۱ تا ۳ ماه اجرای آزمایشی موازی با پروتکل Shadow Ledger بدون هیچ هزینه اضافی'
      : '1-3 months parallel reconciliation with zero financial risk',
    lang === 'ro' 
      ? 'Asistență tehnică dedicată la prima închidere de lună' 
      : lang === 'fa'
      ? 'پشتیبانی فنی و حسابداری اختصاصی هنگام بستن نخستین دوره مالی'
      : 'Dedicated technical onboarding support during the first month-close',
    lang === 'ro' 
      ? 'Evaluarea inițială a tipului de spațiu și a funcțiilor necesare'
      : lang === 'fa'
      ? 'ارزیابی اولیه نوع ورک‌اسپیس و امکانات موردنیاز'
      : 'Initial assessment of workspace type and required features',
    lang === 'ro' 
      ? 'Garanție de tarif blocat pe 24 luni după finalizarea pilotului' 
      : lang === 'fa'
      ? 'تضمین ثبات تعرفه به مدت ۲۴ ماه پس از پایان موفق دوره آزمایشی'
      : 'Guaranteed 24-month locked pricing post-pilot graduation'
  ];

  return (
    <section id="pilot" className="py-24 bg-white border-b border-[#E2E8F0] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="rounded-3xl p-8 sm:p-14 bg-gradient-to-br from-[#102A43] via-[#173F5F] to-[#0B2239] text-white relative overflow-hidden shadow-elevated border border-[#102A43]">
          
          {/* Subtle background glow */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#0E9F8E]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            
            <div className="lg:col-span-7 space-y-6">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-[#93E6DC]">
                <MapPin className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>
                  {lang === 'ro' 
                    ? 'Cohorta Pilot: București & Județul Ilfov' 
                    : lang === 'fa'
                    ? 'دوره پایلوت: بخارست و استان ایلفوف'
                    : 'Pilot Cohort: Bucharest & Ilfov County'}
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
                {lang === 'ro' 
                  ? 'Solicită evaluarea spațiului tău pentru pilotul CLADORA'
                  : lang === 'fa'
                  ? 'درخواست ارزیابی ورک‌اسپیس در پایلوت کلادورا'
                  : 'Request a CLADORA Pilot Workspace Assessment'}
              </h2>

              <p className="text-base text-[#CBD5E1] leading-relaxed">
                {lang === 'ro'
                  ? 'Acceptăm solicitări pentru spații rezidențiale, comerciale, industriale, de birouri și comune. Potrivirea funcțiilor și condițiile pilotului sunt evaluate individual înainte de activare.'
                  : lang === 'fa'
                  ? 'برای فضاهای مسکونی، تجاری، صنعتی، اداری و مشترک درخواست می‌پذیریم. تناسب امکانات و شرایط پایلوت پیش از فعال‌سازی جداگانه بررسی می‌شود.'
                  : 'Submit a request for residential, commercial, industrial, office or shared spaces. Feature fit and pilot conditions are assessed individually before activation.'}
              </p>

              <div className="space-y-3 pt-2">
                {perks.map((perk, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs text-[#E2E8F0]">
                    <CheckCircle2 className="w-4 h-4 text-[#14B8A6] shrink-0 mt-0.5" />
                    <span>{perk}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#087A6E] hover:bg-[#066056] text-white font-display font-bold text-sm shadow-card-hover transition-all flex items-center justify-center gap-2"
                >
                  <span>{lang === 'ro' ? 'Completează cererea de pilot' : lang === 'fa' ? 'تکمیل فرم ثبت‌نام پایلوت' : 'Submit Pilot Application'}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>

                <Link
                  href={`/${lang}/pilot`}
                  className="text-xs text-[#CBD5E1] hover:text-white font-semibold underline underline-offset-4"
                >
                  {lang === 'ro' ? 'Află mai multe despre criteriile de selecție →' : lang === 'fa' ? 'مشاهده شرایط و معیارهای پذیرش در پایلوت →' : 'Learn about selection criteria →'}
                </Link>
              </div>

            </div>

            <div className="lg:col-span-5">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 backdrop-blur-sm">
                <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
                  {lang === 'ro' ? 'Profiluri Eligibile pentru Pilot' : lang === 'fa' ? 'متقاضیان واجد شرایط شرکت در پایلوت' : 'Eligible Cohort Profiles'}
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="font-bold text-white">
                      {lang === 'ro' ? 'Spații rezidențiale și mixte' : lang === 'fa' ? 'فضاهای مسکونی و چندمنظوره' : 'Residential and mixed-use spaces'}
                    </div>
                    <div className="text-[#CBD5E1] mt-0.5">
                      {lang === 'ro' ? 'O clădire sau un ansamblu; fiecare spațiu este evaluat separat' : lang === 'fa' ? 'یک ساختمان یا یک مجموعه؛ هر ورک‌اسپیس جدا بررسی می‌شود' : 'A building or a complex; each workspace is assessed separately'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="font-bold text-white">
                      {lang === 'ro' ? 'Spații comerciale, retail și birouri' : lang === 'fa' ? 'فضاهای تجاری، فروشگاهی و اداری' : 'Commercial, retail and office spaces'}
                    </div>
                    <div className="text-[#CBD5E1] mt-0.5">
                      {lang === 'ro' ? 'Solicitări evaluate în funcție de cerințele operaționale' : lang === 'fa' ? 'ارزیابی درخواست بر اساس نیازهای عملیاتی' : 'Requests assessed against operational needs'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="font-bold text-white">
                      {lang === 'ro' ? 'Spații industriale și comune între clădiri' : lang === 'fa' ? 'فضاهای صنعتی و مشترک چندساختمانی' : 'Industrial and cross-building shared spaces'}
                    </div>
                    <div className="text-[#CBD5E1] mt-0.5">
                      {lang === 'ro' ? 'Inclusiv solicitări pentru mai multe spații de lucru' : lang === 'fa' ? 'شامل درخواست برای چند ورک‌اسپیس' : 'Including requests for multiple workspaces'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      <PilotApplicationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        lang={lang}
      />
    </section>
  );
};
