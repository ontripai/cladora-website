import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { getDictionary } from '@/dictionaries';
import { HeroExperienceSwitcher } from './HeroExperienceSwitcher';

interface HeroSectionProps {
  lang: Language;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ lang }) => {
  const dict = getDictionary(lang);

  return (
    <section className="relative pt-32 pb-20 overflow-hidden bg-gradient-to-b from-[#F0F4F8] via-[#F6F9FC] to-[#F6F9FC] mesh-subtle">
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-[#0E9F8E]/10 via-[#2F80ED]/10 to-[#FF7A59]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Top Pilot Badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#B2E5DF] shadow-sm text-xs font-bold text-[#0A6E62]">
            <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <span>
              {dict.hero.badge}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#0A6E62] rtl:rotate-180" />
          </div>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="text-center max-w-4xl mx-auto mt-6 space-y-5">
          <h1 className="text-4xl sm:text-6xl font-display font-extrabold text-[#102A43] tracking-tight leading-[1.15]">
            {dict.hero.titleLine1}{' '}
            <span className="gradient-text-teal">{dict.hero.titleLine2}</span>
          </h1>

          <p className="text-lg sm:text-xl text-[#52667A] max-w-3xl mx-auto leading-relaxed font-normal">
            {dict.hero.description}
          </p>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-[#087A6E] hover:bg-[#066056] text-white font-display font-bold text-base shadow-card-hover hover:scale-[1.02] transition-all"
            >
              <span>{dict.hero.ctaPrimary}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>

            <Link
              href={`/${lang}/demo`}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-white hover:bg-[#F0F4F8] text-[#102A43] border border-[#D3DCE6] font-display font-bold text-base shadow-card transition-all"
            >
              <PlayCircle className="w-5 h-5 text-[#0A6E62]" />
              <span>{dict.hero.ctaSecondary}</span>
            </Link>
          </div>
        </div>

        {/* 3-OS Experience Switcher */}
        <HeroExperienceSwitcher lang={lang} />

      </div>
    </section>
  );
};
