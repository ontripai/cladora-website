import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { Bot, ShieldAlert, CheckCircle2, ArrowRight, Sparkles, FileText, Lock } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/ai', params.lang);
}

export default async function AIPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      badge: 'Inteligență Operațională & Asistență Guvernată',
      title: 'Asistență inteligentă ghidată de politici și supraveghere umană',
      subtitle: 'În CLADORA, asistența AI nu acționează autonom pe registre, plăți sau documente statutare. Fiecare propunere respectă ciclul riguros în 6 etape și necesită aprobarea explicită a unui responsabil autorizat.',
      sixStagesTitle: 'Ciclul de acțiune în 6 etape',
      stages: [
        { num: '01', title: 'Context', desc: 'Identificarea entității imobiliare, istoricului și drepturilor aplicabile.' },
        { num: '02', title: 'Intent', desc: 'Formularea clară a obiectivului operațional sau cererii de service.' },
        { num: '03', title: 'Authority', desc: 'Verificarea rolului, limitelor de sumă și mandatului utilizatorului.' },
        { num: '04', title: 'Plan', desc: 'Generarea pașilor propuși, impactului bugetar și părților afectate.' },
        { num: '05', title: 'Action', desc: 'Execuția acțiunii NUMAI după validarea și semnarea umană obligatorie.' },
        { num: '06', title: 'Receipt', desc: 'Înregistrarea ireversibilă a chitanței de audit și jurnalului de evenimente.' },
      ],
      disclaimerTitle: 'Garanții de guvernanță & transparență',
      disclaimerDesc: 'Fără execuție automată pe registre financiare, fără decizii opace de alocare a cotelor de întreținere și fără modificări de contracte fără aprobare formală.',
      ctaPrimary: 'Solicită Parteneriat',
      ctaSecondary: 'Explorează Platforma',
    },
    en: {
      badge: 'Operational Intelligence & Governed Assistance',
      title: 'Policy-guided intelligence with mandatory human oversight',
      subtitle: 'In CLADORA, AI assistance does not execute autonomously on statutory ledgers, payments, or legal contracts. Every operation follows a rigorous 6-stage lifecycle and requires explicit authorized human confirmation.',
      sixStagesTitle: 'The 6-Stage Action Model',
      stages: [
        { num: '01', title: 'Context', desc: 'Resolving property identity, space structure, and operational history.' },
        { num: '02', title: 'Intent', desc: 'Parsing precise operational purpose, maintenance request, or query.' },
        { num: '03', title: 'Authority', desc: 'Validating role mandates, fiscal thresholds, and delegation bounds.' },
        { num: '04', title: 'Plan', desc: 'Drafting proposed ledger changes, allocations, or dispatches for review.' },
        { num: '05', title: 'Action', desc: 'Executing ONLY after explicit human approval and cryptographic signing.' },
        { num: '06', title: 'Receipt', desc: 'Emitting immutable audit logs, ledger receipts, and timestamps.' },
      ],
      disclaimerTitle: 'Governance & Safety Guarantees',
      disclaimerDesc: 'Zero black-box autonomous financial execution, zero unverified maintenance allocations, and zero legal adjustments without designated operational authority.',
      ctaPrimary: 'Start Partnership',
      ctaSecondary: 'Explore Platform',
    },
    fa: {
      badge: 'هوش عملیاتی و دستیار مقید به حاکمیت داده',
      title: 'هوشمندی مقید به سیاست‌ها با نظارت قطعی و تایید نهایی انسان',
      subtitle: 'در کلادورا، هوش مصنوعی هرگز به صورت خودسرانه بر دفاتر مالی، پرداخت‌ها، یا قراردادها عمل نمی‌کند. هر پیشنهاد از چرخهٔ شش‌مرحله‌ای عبور کرده و نیاز به تأیید کاربر مجاز دارد.',
      sixStagesTitle: 'مدل شش‌مرحله‌ای اقدام',
      stages: [
        { num: '۰۱', title: 'زمینه (Context)', desc: 'شناسایی دقیق ملک، ساختار فضا و پیشینهٔ مستندات.' },
        { num: '۰۲', title: 'قصد (Intent)', desc: 'تحلیل دقیق درخواست عملیاتی، پیام یا نیاز اعلام‌شده.' },
        { num: '۰۳', title: 'اختیار (Authority)', desc: 'اعتبارسنجی نقش، سقف اختیارات مالی و حدود تفویض‌شده.' },
        { num: '۰۴', title: 'طرح اقدام (Plan)', desc: 'پیش‌نویس گام‌های اجرایی و تأثیر آن بر بودجه و ساکنان جهت بازبینی.' },
        { num: '۰۵', title: 'اقدام (Action)', desc: 'اجرا صرفاً پس از تایید و امضای قطعی توسط انسان مسئول.' },
        { num: '۰۶', title: 'سند ممیزی (Receipt)', desc: 'ثبت تغییرات در لاگ تغییرناپذیر ممیزی با برچسب زمانی یکتا.' },
      ],
      disclaimerTitle: 'تضمین‌های امنیتی و حقوقی',
      disclaimerDesc: 'هیچ اقدام بدون نظارت، هیچ تصمیم‌گیری جعبه‌سیاه روی سهم شارژ و هیچ تغییر قراردادی بدون اجازهٔ مستقیم مدیر مجاز انجام نمی‌شود.',
      ctaPrimary: 'درخواست شروع همکاری',
      ctaSecondary: 'آشنایی با پلتفرم',
    },
  }[lang] || {
    badge: 'Operational Intelligence & Governed Assistance',
    title: 'Policy-guided intelligence with mandatory human oversight',
    subtitle: 'In CLADORA, AI assistance does not execute autonomously on statutory ledgers, payments, or legal contracts.',
    sixStagesTitle: 'The 6-Stage Action Model',
    stages: [],
    disclaimerTitle: 'Governance & Safety Guarantees',
    disclaimerDesc: 'Zero black-box autonomous financial execution.',
    ctaPrimary: 'Start Partnership',
    ctaSecondary: 'Explore Platform',
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0E9F8E] text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{content.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight mb-6">
            {content.title}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* 6-Stage Action Model Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-[#102A43] text-center mb-8">
            {content.sixStagesTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.stages.map((stage) => (
              <div
                key={stage.num}
                className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-[#0E9F8E] tracking-wider uppercase bg-teal-50 px-2.5 py-1 rounded-md">
                    Stage {stage.num}
                  </span>
                  <Bot className="w-4 h-4 text-[#52667A]" />
                </div>
                <h3 className="text-lg font-bold text-[#102A43] mb-2">{stage.title}</h3>
                <p className="text-sm text-[#52667A] leading-relaxed">{stage.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Governance & Human-in-the-loop Box */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 mb-16 shadow-elevated">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-300 text-xs font-medium mb-4">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero Autonomous Drift</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4">{content.disclaimerTitle}</h3>
              <p className="text-slate-300 text-base leading-relaxed">{content.disclaimerDesc}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Link
                href={`/${lang}/contact`}
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-[#0E9F8E] text-white font-semibold hover:bg-[#0C8778] transition shadow-card"
              >
                {content.ctaPrimary}
              </Link>
              <Link
                href={`/${lang}/platform`}
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition border border-white/15"
              >
                {content.ctaSecondary}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
