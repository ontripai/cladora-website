import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { PricingCalculator } from '@/components/interactive/PricingCalculator';
import { Info } from 'lucide-react';

interface PricingPreviewProps {
  lang: Language;
}

export const PricingPreviewSection: React.FC<PricingPreviewProps> = ({ lang }) => {
  return (
    <section id="pricing" className="py-24 bg-[#F6F9FC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-[#0A6E62] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Prețuri Orientative de Lansare' : lang === 'fa' ? 'تعرفه‌های دوره راه‌اندازی و پایلوت' : 'Indicative Pilot Pricing'}
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Tarife Simple, Fără Costuri Ascunse' 
              : lang === 'fa'
              ? 'تعرفه‌های شفاف بر مبنای تعداد واحد، بدون هزینه پنهان'
              : 'Transparent Pricing per Unit or Property'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A]">
            {lang === 'ro'
              ? 'Pachetele pilot sprijină migrarea asistată și reconcilierea paralelă prin Shadow Ledger.'
              : lang === 'fa'
              ? 'پلن‌های پایلوت از مهاجرت هدایت‌شده و تطبیق موازی با Shadow Ledger پشتیبانی می‌کنند.'
              : 'Pilot plans support assisted migration and parallel Shadow Ledger reconciliation.'}
          </p>
        </div>

        {/* Live Interactive Pricing Calculator */}
        <div className="mt-14 max-w-4xl mx-auto">
          <PricingCalculator lang={lang} />
        </div>

        {/* Statutory & Commercial Disclaimer */}
        <div className="mt-10 max-w-3xl mx-auto p-4 rounded-xl bg-white border border-[#E2E8F0] flex items-start gap-3 text-xs text-[#52667A] shadow-sm">
          <Info className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {lang === 'ro'
              ? 'Notă: Tarifele afișate sunt orientative pentru cohorta pilot din București și Ilfov și nu conțin TVA. Unitățile facturabile reprezintă numărul de apartamente sau spații comerciale gestionate activ. Pentru portofolii de peste 500 unități, se aplică acorduri de nivel de serviciu (SLA) personalizate.'
              : lang === 'fa'
              ? 'یادداشت: تعرفه‌های نمایش‌داده‌شده ارشادی و ویژه دوره پایلوت بخارست و ایلفوف بوده و فاقد مالیات بر ارزش افزوده است. برای مجتمع‌ها یا شرکت‌های دارای بیش از ۵۰۰ واحد مسکونی، قراردادهای اختصاصی سطح خدمات (SLA) و تعرفه سازمانی اعمال می‌گردد.'
              : 'Indicative note: Rates shown are indicative for the Bucharest and Ilfov pilot validation cohort and exclude VAT. Billable units represent actively managed apartments or commercial units. Custom SLAs apply for portfolios over 500 units.'}
          </p>
        </div>

      </div>
    </section>
  );
};
