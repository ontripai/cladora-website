import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  ArrowRight, 
  ShieldCheck, 
  KeyRound, 
  Building2, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight,
  Boxes,
  Compass
} from 'lucide-react';

interface UniversalHeroSectionProps {
  lang: Language;
}

export const UniversalHeroSection: React.FC<UniversalHeroSectionProps> = ({ lang }) => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-b from-[#F0F4F8] via-[#F6F9FC] to-white border-b border-[#E2E8F0]">
      {/* Subtle architectural background grid */}
      <div className="absolute inset-0 mesh-subtle pointer-events-none opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF8F5] border border-[#B2E5DF] text-xs font-bold text-[#0A7E71] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>
              {lang === 'ro' 
                ? 'Arhitectura CLADORA • Mediu Unificat pentru Proprietăți & Active' 
                : lang === 'fa' 
                ? 'معماری جامع CLADORA • پلتفرم یکپارچه همکاری، مدیریت و خدمات ملک' 
                : 'CLADORA Architecture • Unified Environment for Property & Assets'}
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-extrabold text-[#102A43] tracking-tight leading-[1.15]">
            {lang === 'ro' ? (
              <>
                Mediul unificat de colaborare, gestiune și servicii pentru <span className="text-[#0E9F8E]">orice proprietate</span>.
              </>
            ) : lang === 'fa' ? (
              <>
                محیط یکپارچهٔ همکاری، مدیریت و خدمات برای <span className="text-[#0E9F8E]">ملک، فضا و دارایی</span>
              </>
            ) : (
              <>
                The unified environment for property operations, management, and <span className="text-[#0E9F8E]">lifecycle services</span>.
              </>
            )}
          </h1>

          {/* Canonical Definition Text */}
          <p className="text-base sm:text-lg lg:text-xl text-[#334E68] leading-relaxed max-w-3xl mx-auto font-normal">
            {lang === 'ro' ? (
              'De la definirea identității unui proiect sau imobil, în fazele de pre-vânzare, vânzare, predare-primire, exploatare, mentenanță, servicii, închiriere și tranzacții ulterioare—CLADORA păstrează continuitatea evidențelor autorizate și conectează toți actorii într-un cadru securizat.'
            ) : lang === 'fa' ? (
              'از زمان تعریف و شکل‌گیری هویت یک پروژه یا ملک، در مراحل پیش‌فروش، فروش، تحویل، بهره‌برداری، نگهداری، خدمات، اجاره و معاملات بعدی همراه آن می‌ماند و پیوستگی سوابق مجاز را حفظ می‌کند.'
            ) : (
              'From early project definition and pre-sales, through handover, daily living, maintenance, third-party services, leasing, and subsequent transactions—CLADORA preserves authorized record continuity across the entire property lifecycle.'
            )}
          </p>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <span>{lang === 'ro' ? 'Solicită Începerea Colaborării' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Start Partnership Inquiry'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href={`/${lang}/platform`}
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-[#102A43] bg-white hover:bg-[#F0F4F8] border border-[#D3DCE6] rounded-xl transition-all hover:border-[#102A43] flex items-center justify-center gap-2"
            >
              <Compass className="w-4 h-4 text-[#0E9F8E]" />
              <span>{lang === 'ro' ? 'Explorează Modelul Workspace' : lang === 'fa' ? 'آشنایی با مدل Workspace' : 'Explore Workspace Model'}</span>
            </Link>

            <Link
              href={`/${lang}/login`}
              className="w-full sm:w-auto px-5 py-3.5 text-sm font-bold text-[#334E68] hover:text-[#102A43] rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-4 h-4 text-[#627D98]" />
              <span>{lang === 'ro' ? 'Autentificare Membri' : lang === 'fa' ? 'ورود اعضا' : 'Member Sign In'}</span>
            </Link>
          </div>

          {/* Key Principles Strip */}
          <div className="pt-8 border-t border-[#E2E8F0] grid grid-cols-2 md:grid-cols-4 gap-4 text-start">
            <div className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-xs font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Hrană Unică de Date' : lang === 'fa' ? 'هویت پایدار ملک' : 'Persistent Identity'}
              </span>
              <span className="text-[11px] text-[#627D98] leading-tight block mt-0.5">
                {lang === 'ro' ? 'Identitate unică pentru imobil, spații și active' : lang === 'fa' ? 'شناسه یکتا برای مجموعه، واحدها و تجهیزات' : 'Unique registry for units, spaces, and physical assets'}
              </span>
            </div>

            <div className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-xs font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Model Workspace' : lang === 'fa' ? 'مرز امن همکاری' : 'Workspace Boundary'}
              </span>
              <span className="text-[11px] text-[#627D98] leading-tight block mt-0.5">
                {lang === 'ro' ? 'Granițe de date clare între organizații' : lang === 'fa' ? 'تفکیک دسترسی و مرز اطلاعات سازمان‌ها' : 'Clean data and governance boundaries'}
              </span>
            </div>

            <div className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-xs font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Autoritate Scadențată' : lang === 'fa' ? 'مدت اختیار و جانشینی' : 'Delegation & Succession'}
              </span>
              <span className="text-[11px] text-[#627D98] leading-tight block mt-0.5">
                {lang === 'ro' ? 'Delegare cu termen și predare responsabilități' : lang === 'fa' ? 'تحویل مسئولیت با حفظ سوابق و بدون ابهام' : 'Time-bound roles and traceable handover'}
              </span>
            </div>

            <div className="p-3 bg-white/70 rounded-xl border border-[#E2E8F0] shadow-2xs">
              <span className="text-xs font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Ciclul de Viață Complet' : lang === 'fa' ? 'تمام چرخهٔ عمر' : 'Full Lifecycle'}
              </span>
              <span className="text-[11px] text-[#627D98] leading-tight block mt-0.5">
                {lang === 'ro' ? 'De la pre-vânzare până la tranzacții viitoare' : lang === 'fa' ? 'از پیش‌فروش تا بهره‌برداری و انتقال مالکیت' : 'From pre-sale through decades of operation'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
