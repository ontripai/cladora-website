import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { PlayCircle, Building2 } from 'lucide-react';

interface FinalCtaProps {
  lang: Language;
}

export const FinalCtaSection: React.FC<FinalCtaProps> = ({ lang }) => {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="rounded-3xl p-10 sm:p-16 bg-[#102A43] text-white text-center space-y-6 shadow-elevated relative overflow-hidden border border-[#102A43]">
          
          <div className="max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider bg-white/10 px-3.5 py-1.5 rounded-full border border-white/15">
              {lang === 'ro' ? 'Tranziția la Noul Standard de Administrare' : lang === 'fa' ? 'گذر به استاندارد نوین مدیریت دارایی‌های مسکونی' : 'Upgrade to the Modern Standard'}
            </span>

            <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight">
              {lang === 'ro' 
                ? 'Pregătit să aduci transparență și claritate în blocul tău?' 
                : lang === 'fa'
                ? 'آماده‌اید شفافیت، آرامش و نظم مالی را به ساختمان خود بیاورید؟'
                : 'Ready to Bring Truth & Clarity to Your Residential Assets?'}
            </h2>

            <p className="text-base sm:text-lg text-[#CBD5E1] max-w-2xl mx-auto leading-relaxed">
              {lang === 'ro'
                ? 'Explorează demo-ul interactiv cu date de test sau programează o discuție tehnică pentru asociația sau portofoliul tău.'
                : lang === 'fa'
                ? 'هم‌اکنون محیط دموی تعاملی را بدون نیاز به ورود آزمایش کنید یا درخواست استقرار پایلوت را برای مجتمع خود ثبت نمایید.'
                : 'Explore our interactive demo with test data or discuss dedicated onboarding for your condominium.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href={`/${lang}/demo`}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-[#087A6E] hover:bg-[#066056] text-white font-display font-bold text-base shadow-card-hover hover:scale-[1.02] transition-all"
            >
              <PlayCircle className="w-5 h-5" />
              <span>{lang === 'ro' ? 'Lansează Demo Interactiv' : lang === 'fa' ? 'ورود به دموی تعاملی' : 'Launch Interactive Demo'}</span>
            </Link>

            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-display font-bold text-base transition-all"
            >
              <Building2 className="w-5 h-5 text-[#93E6DC]" />
              <span>{lang === 'ro' ? 'Solicită parteneriat' : lang === 'fa' ? 'ثبت‌نام و شروع همکاری' : 'Initiate Partnership Inquiry'}</span>
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
};
