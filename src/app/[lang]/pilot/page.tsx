import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { PilotApplicationModal } from '@/components/interactive/PilotApplicationModal';
import { Sparkles, CheckCircle2, MapPin } from 'lucide-react';





export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/pilot', params.lang);
}

export default async function PilotPage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = await props.params;
  const dict = getDictionary(params.lang);
  const lang = params.lang;
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  return (
    <div className="pt-32 pb-24 space-y-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Header Hero */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-800">
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          <span>{dict.pilot.badge}</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-display font-extrabold text-[#102A43] tracking-tight">
          {dict.pilot.title}
        </h1>
        <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
          {dict.pilot.description}
        </p>
      </div>

      {/* Cohort Composition & Benefits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Pilot Details & Cohort criteria */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-[#102A43] border border-[#34536B] space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-400" />
              <span>{isRo ? 'Structura Cohortei de Validare' : isFa ? 'ظرفیت و ترکیب دوره پایلوت' : 'Cohort Composition'}</span>
            </h3>
            
            <div className="space-y-3 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>
                  {isRo ? 'Spații rezidențiale, comerciale, retail și birouri'
                    : isFa ? 'فضاهای مسکونی، تجاری، فروشگاهی و اداری'
                    : 'Residential, commercial, retail and office spaces'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-brand-400 shrink-0" />
                <span>
                  {isRo ? 'Spații industriale, logistice și cu utilizare mixtă'
                    : isFa ? 'فضاهای صنعتی، لجستیکی و چندمنظوره'
                    : 'Industrial, logistics and mixed-use spaces'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                <span>
                  {isRo ? 'Spații comune între clădiri și solicitări cu mai multe spații de lucru'
                    : isFa ? 'فضاهای مشترک چندساختمانی و درخواست‌های چندورک‌اسپیسی'
                    : 'Shared spaces across buildings and multi-workspace requests'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300">{isRo ? 'Fiecare solicitare este evaluată individual; completarea formularului nu creează și nu activează un spațiu de lucru.' : isFa ? 'هر درخواست جداگانه بررسی می‌شود؛ ارسال فرم، ورک‌اسپیس ایجاد یا فعال نمی‌کند.' : 'Each request is reviewed individually. Submitting this form does not create or activate a workspace.'}</p>
          </div>

          {/* Benefits */}
          <div className="p-6 rounded-3xl bg-[#102A43] border border-emerald-500/30 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{isRo ? 'Beneficii Exclusive pentru Participanți' : isFa ? 'مزایای ویژه اعضای دوره آزمایشی' : 'Cohort Exclusive Perks'}</span>
            </h3>

            <div className="space-y-3 text-xs sm:text-sm text-slate-300">
              {dict.pilot.benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Application Form */}
        <div className="lg:col-span-7">
          <PilotApplicationModal lang={lang} />
        </div>

      </div>

    </div>
  );
}
