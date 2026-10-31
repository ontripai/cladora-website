import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import {
  ArrowRight,
  KeyRound,
  Compass
} from 'lucide-react';

interface UniversalHeroSectionProps {
  lang: Language;
}

export const UniversalHeroSection: React.FC<UniversalHeroSectionProps> = ({ lang }) => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-b from-[#F0F4F8] via-[#F6F9FC] to-white border-b border-[#E2E8F0]">
      {/* Subtle architectural background grid */}
      <div className="absolute inset-0 mesh-subtle pointer-events-none opacity-60" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-6">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF8F5] border border-[#B2E5DF] text-xs font-bold text-[#0A7E71] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" aria-hidden="true" />
            <span>
              {lang === 'ro'
                ? 'CLADORA • Administrare clară și organizată pentru imobile, spații și echipamente'
                : lang === 'fa'
                ? 'سامانهٔ CLADORA • مدیریت شفاف و منظم برای املاک، فضاها و تجهیزات'
                : 'CLADORA • Clear and organized management for properties, spaces, and equipment'}
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-extrabold text-[#102A43] tracking-tight leading-[1.15]">
            {lang === 'ro' ? (
              <>
                Mai multă claritate și organizare în <span className="text-[#0E9F8E]">administrarea proprietății tale</span>.
              </>
            ) : lang === 'fa' ? (
              <>
                شفافیت، نظم و آسودگی در <span className="text-[#0E9F8E]">مدیریت املاک و فضاهای شما</span>
              </>
            ) : (
              <>
                Clarity and confidence in <span className="text-[#0E9F8E]">managing your property and spaces</span>.
              </>
            )}
          </h1>

          {/* Canonical Definition Text */}
          <p className="text-base sm:text-lg lg:text-xl text-[#334E68] leading-relaxed max-w-3xl mx-auto font-normal">
            {lang === 'ro' ? (
              'Toate informațiile importante ale clădirii într-un singur loc: cheltuieli, reparații, contracte și comunicarea dintre administratori, proprietari și locatari, pentru o gestiune mai bine organizată.'
            ) : lang === 'fa' ? (
              'اطلاعات کلیدی ساختمان در یک سامانهٔ منظم: پیگیری هزینه‌ها، تعمیرات، قراردادها و ارتباط مستقیم میان مدیران، مالکان و ساکنان برای هماهنگی بهتر.'
            ) : (
              'Key building information organized in one place: expenses, maintenance, contracts, and clear communication between managers, owners, and residents.'
            )}
          </p>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>{lang === 'ro' ? 'Solicită o Discuție' : lang === 'fa' ? 'درخواست مشاوره و گفتگو' : 'Talk to Our Team'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            </Link>

            <Link
              href={`/${lang}/platform`}
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-[#102A43] bg-white hover:bg-[#F0F4F8] border border-[#D3DCE6] rounded-xl transition-all hover:border-[#102A43] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <Compass className="w-4 h-4 text-[#0E9F8E]" aria-hidden="true" />
              <span>{lang === 'ro' ? 'Cum Funcționează' : lang === 'fa' ? 'نحوه کارکرد پلتفرم' : 'How It Works'}</span>
            </Link>

            <Link
              href={`/${lang}/login`}
              className="w-full sm:w-auto px-5 py-3.5 text-sm font-bold text-[#334E68] hover:text-[#102A43] rounded-xl transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <KeyRound className="w-4 h-4 text-[#627D98]" aria-hidden="true" />
              <span>{lang === 'ro' ? 'Intră în Cont' : lang === 'fa' ? 'ورود به حساب' : 'Sign In'}</span>
            </Link>
          </div>

          {/* Key Principles Strip */}
          <div className="pt-8 border-t border-[#E2E8F0] grid grid-cols-2 md:grid-cols-4 gap-4 text-start">
            <div className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-xs font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Evidență Clară' : lang === 'fa' ? 'سوابق یکپارچه' : 'Organized Records'}
              </span>
              <span className="text-[11px] text-[#627D98] leading-tight block mt-0.5">
                {lang === 'ro' ? 'Toate detaliile clădirii și unităților într-un loc sigur' : lang === 'fa' ? 'مشخصات دقیق ساختمان و واحدها در مکانی امن' : 'Building and unit records kept secure in one place'}
              </span>
            </div>

            <div className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-xs font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Spațiu Dedicat (Workspace)' : lang === 'fa' ? 'فضای کاری مستقل' : 'Dedicated Workspace'}
              </span>
              <span className="text-[11px] text-[#627D98] leading-tight block mt-0.5">
                {lang === 'ro' ? 'Fiecare asociație sau organizație are propriul spațiu de lucru dedicat' : lang === 'fa' ? 'هر انجمن یا سازمان فضای کاری اختصاصی و تفکیک‌شدهٔ خود را دارد' : 'Protected space for each association or organization'}
              </span>
            </div>

            <div className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-xs font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Roluri și Predare Ușoară' : lang === 'fa' ? 'نقش‌های مشخص و تحویل آسان' : 'Clear Roles & Handover'}
              </span>
              <span className="text-[11px] text-[#627D98] leading-tight block mt-0.5">
                {lang === 'ro' ? 'Documente și informații organizate pentru o predare mai clară a gestiunii' : lang === 'fa' ? 'اسناد و اطلاعات منظم برای تحویل شفاف‌تر مسئولیت و مدیریت' : 'Organized records for a clearer handover and role transitions'}
              </span>
            </div>

            <div className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-xs font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Pe Tot Cursul Clădirii' : lang === 'fa' ? 'پوشش کامل دورهٔ ساختمان' : 'Across the Full Lifecycle'}
              </span>
              <span className="text-[11px] text-[#627D98] leading-tight block mt-0.5">
                {lang === 'ro' ? 'De la recepție și primele mutări, la întreținerea zilnică' : lang === 'fa' ? 'از تحویل اولیه و سکونت تا نگهداری روزمره و سالیانه' : 'From initial handover to everyday living and maintenance'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
