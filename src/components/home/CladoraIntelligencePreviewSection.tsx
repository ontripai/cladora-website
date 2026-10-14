import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { Bot, ArrowRight, ShieldCheck, Lock } from 'lucide-react';

interface CladoraIntelligencePreviewSectionProps {
  lang: Language;
}

export const CladoraIntelligencePreviewSection: React.FC<CladoraIntelligencePreviewSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'INTELIGENȚĂ GUVERNATĂ & ASISTENȚĂ OPERAȚIONALĂ',
      title: 'CLADORA Intelligence: Înțelegere contextuală înainte de orice acțiune',
      subtitle:
        'Sistemele AI nu trebuie să acționeze niciodată autonom sau opac asupra registrelor financiare și juridice. CLADORA structurează asistența inteligentă printr-un model în 6 etape, supravegheat de operatori umani autorizați.',
      ctaText: 'Explorează CLADORA Intelligence',
      safetyNoteTitle: 'Arhitectură de limitare a acțiunilor autonome:',
      safetyNoteDesc:
        'Modelul operațional este conceput pentru a menține acțiunile cu impact în limitele autorității verificate și ale aprobării umane, generând chitanțe de audit trasabile pentru fiecare operațiune.',
      stages: [
        { num: '01', name: 'Context', desc: 'Identificarea entității imobiliare, a spațiului și a istoricului aplicabil.' },
        { num: '02', name: 'Intent', desc: 'Analiza cererii sau a sarcinii de mentenanță formulate de utilizator.' },
        { num: '03', name: 'Authority', desc: 'Verificarea rolului, limitelor financiare și a mandatului de acțiune.' },
        { num: '04', name: 'Plan', desc: 'Elaborarea propunerii de înregistrare sau deviz pentru aprobare umană.' },
        { num: '05', name: 'Action', desc: 'Execuția acțiunilor este proiectată în jurul confirmării explicite a responsabilului.' },
        { num: '06', name: 'Receipt', desc: 'Generarea chitanței de audit și consemnarea acțiunii în jurnalul de evenimente.' },
      ],
    },
    en: {
      badge: 'GOVERNED INTELLIGENCE & OPERATIONAL ASSISTANCE',
      title: 'CLADORA Intelligence: Context and authority before action',
      subtitle:
        'Artificial intelligence must never act autonomously or opaquely on statutory ledgers and contracts. CLADORA bounds AI assistance within a strict 6-stage lifecycle, governed by mandatory human validation.',
      ctaText: 'Explore CLADORA Intelligence',
      safetyNoteTitle: 'Authority & Human Boundary Design:',
      safetyNoteDesc:
        'The action model is designed to keep consequential actions within verified authority and human approval boundaries, producing traceable audit receipts for recorded operations.',
      stages: [
        { num: '01', name: 'Context', desc: 'Resolving property identity, spatial structure, and verified history.' },
        { num: '02', name: 'Intent', desc: 'Parsing precise operational intent, tenant inquiries, or maintenance needs.' },
        { num: '03', name: 'Authority', desc: 'Validating requester role, fiscal authorization thresholds, and mandate.' },
        { num: '04', name: 'Plan', desc: 'Formulating proposed allocations or work orders for explicit review.' },
        { num: '05', name: 'Action', desc: 'Executing changes according to explicit, authorized human confirmation workflows.' },
        { num: '06', name: 'Receipt', desc: 'Emitting auditable action receipts, operational timestamps, and journal logs.' },
      ],
    },
    fa: {
      badge: 'هوشمندی مقید به سیاست‌ها و دستیار عملیاتی',
      title: 'هوش عملیاتی کلادورا: درک زمینه و اختیارات پیش از هر اقدام',
      subtitle:
        'هوش مصنوعی هرگز نباید به صورت خودسرانه یا ناشفاف بر دفاتر مالی و حقوقی عمل کند. کلادورا هوش مصنوعی را در قالب چرخهٔ شش‌مرحله‌ای منضبط و تحت نظارت قطعی انسان قرار می‌دهد.',
      ctaText: 'مشاهدهٔ مدل هوش عملیاتی',
      safetyNoteTitle: 'مدل معماری مبتنی بر تایید انسان:',
      safetyNoteDesc:
        'مدل عملیاتی به نحوی طراحی شده است که کلیه اقدامات اثرگذار را در چارچوب اختیارات معتبر و تایید کاربر انسانی نگاه داشته و رسیدهای قابل ممیزی رویداد تولید کند.',
      stages: [
        { num: '۰۱', name: 'زمینه (Context)', desc: 'شناسایی مشخصات دارایی، فضا و سوابق ثبت‌شدهٔ مرتبط.' },
        { num: '۰۲', name: 'قصد (Intent)', desc: 'تحلیل دقیق درخواست، پیام ساکن یا نیاز فنی اعلام‌شده.' },
        { num: '۰۳', name: 'اختیار (Authority)', desc: 'اعتبارسنجی نقش، سقف اختیارات مالی و حدود تفویض‌شده.' },
        { num: '۰۴', name: 'طرح اقدام (Plan)', desc: 'پیش‌نویس گام‌های پیشنهادی جهت بررسی و تایید انسان.' },
        { num: '۰۵', name: 'اقدام (Action)', desc: 'اجرای عملیات در چارچوب جریان کاری مبتنی بر تایید صریح کاربر مسئول.' },
        { num: '۰۶', name: 'سند ممیزی (Receipt)', desc: 'ثبت رسید ممیزی قابل ردیابی با برچسب زمانی در لاگ رویدادهای سیستم.' },
      ],
    },
  }[lang] || {
    badge: 'GOVERNED INTELLIGENCE & OPERATIONAL ASSISTANCE',
    title: 'CLADORA Intelligence: Context and authority before action',
    subtitle: 'AI assistance within a strict 6-stage lifecycle.',
    ctaText: 'Explore CLADORA Intelligence',
    safetyNoteTitle: 'Zero Autonomous Drift Principle:',
    safetyNoteDesc: 'Every assisted proposal requires human validation.',
    stages: [],
  };

  return (
    <section className="py-24 bg-[#102A43] text-white border-b border-[#173F5F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 text-teal-300 text-xs font-bold mb-4">
            <Bot className="w-3.5 h-3.5 text-[#0E9F8E]" />
            <span>{content.badge}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4">
            {content.title}
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* 6-Stage Action Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-12">
          {content.stages.map((st) => (
            <div
              key={st.num}
              className="bg-white/5 rounded-2xl p-5 border border-white/10 flex flex-col justify-between hover:border-teal-400/40 transition-colors"
            >
              <div>
                <span className="text-xs font-bold text-[#0E9F8E] tracking-wider uppercase bg-white/10 px-2 py-0.5 rounded-md inline-block mb-3">
                  Stage {st.num}
                </span>
                <h3 className="text-sm font-bold text-white mb-1.5">{st.name}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{st.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Safety Note & CTA */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <ShieldCheck className="w-6 h-6 text-[#0E9F8E] shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-teal-300 mb-1">{content.safetyNoteTitle}</div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{content.safetyNoteDesc}</p>
            </div>
          </div>
          <Link
            href={`/${lang}/ai`}
            className="px-6 py-3 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
          >
            <span>{content.ctaText}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

      </div>
    </section>
  );
};
