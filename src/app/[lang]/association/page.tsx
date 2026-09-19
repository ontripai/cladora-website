import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { 
  Building2, 
  FileCheck2, 
  Scale, 
  Users, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  Layers
} from 'lucide-react';





export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/association', params.lang);
}

export default async function AssociationPage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = await props.params;
  const dict = getDictionary(params.lang);
  const lang = params.lang;
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  const capabilities = [
    {
      title: isRo 
        ? 'Calcul Cote Întreținere (Legea 196/2018)' 
        : isFa 
        ? 'محاسبه سهم شارژ بر اساس سهم مشاع و استانداردهای قانونی' 
        : 'Statutory Fee Distribution (Law 196/2018)',
      desc: isRo
        ? 'Împărțire automată și fără erori pe: număr de persoane, suprafață utilă, cotă-parte indiviză (CPI), consumuri individuale de contoare și servicii speciale.'
        : isFa
        ? 'تسهیم خودکار و بدون خطای هزینه‌ها بر پایه: تعداد نفرات ساکن، متراژ مفید، سهم مشاع (CPI)، قرائت کنتورهای فرعی و خدمات اختصاصی.'
        : 'Automated, zero-error distribution based on person count, usable area, undivided equity share (CPI), individual meter readings, and dedicated services.',
    },
    {
      title: isRo 
        ? 'Portal Dedicat pentru Cenzor & Comitet' 
        : isFa 
        ? 'میز کار اختصاصی بازرس مالی و هیئت‌مدیره' 
        : 'Auditor (Cenzor) & Board Portal',
      desc: isRo
        ? 'Cenzorul are acces direct la toate facturile originale, jurnalele contabile, extrasele de cont și fișele de apartament pentru o verificare rapidă înainte de publicare.'
        : isFa
        ? 'دسترسی آنلاین ممیز به کلیه فایل‌های اصلی فاکتورها، دفاتر روزنامه، صورت‌حساب‌های بانکی و کارتکس واحدها پیش از صدور و انتشار رسمی فیش‌ها.'
        : 'Auditors get instant read-only audit access to source invoice PDFs, bank statements, GL posting logs, and unit sheets before month-end publishing.',
    },
    {
      title: isRo 
        ? 'Adunări Generale Online & Vot Securizat' 
        : isFa 
        ? 'برگزاری آنلاین مجامع عمومی و رأی‌گیری رسمی الکترونیک' 
        : 'Online General Assemblies & Legal E-Voting',
      desc: isRo
        ? 'Organizează adunări generale statutare cu calcul automat al cvorumului, vot secret sau deschis cu semnătură electronică și generare automată a procesului verbal.'
        : isFa
        ? 'برگزاری مجامع حضوری یا هیبریدی با محاسبه خودکار حد نصاب، ثبت رأی با امضای دیجیتال و تبدیل آنی مصوبات به وظایف مالی.'
        : 'Conduct statutory hybrid or digital assemblies with automated quorum calculation, certified e-voting, and instant minute-to-task conversion.',
    },
    {
      title: isRo 
        ? 'Reconciliere Bancară & Plăți Digitale' 
        : isFa 
        ? 'تطبیق خودکار تراکنش‌های بانکی و درگاه پرداخت آنلاین' 
        : 'Bank Feed Reconciliation & Online Payments',
      desc: isRo
        ? 'Import automat al extraselor bancare MT940 / CAMT.053 și potrivire automată a plăților de întreținere cu soldul fiecărui apartament.'
        : isFa
        ? 'دریافت مستقیم صورت‌حساب بانکی و تسویه خودکار قبوض شارژ با مانده حساب هر واحد مسکونی بدون نیاز به ثبت دستی فیش‌ها.'
        : 'Automated bank feed synchronization (MT940/CAMT.053) that matches inbound transfers to apartment ledger balances with zero manual entry.',
    },
  ];

  return (
    <div className="pt-32 pb-24 space-y-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full glass-panel border border-brand-500/20 text-xs font-semibold text-brand-300">
          <Building2 className="w-3.5 h-3.5 text-brand-400" />
          <span>Association OS</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-display font-extrabold text-white tracking-tight">
          {isRo 
            ? 'Sistemul de Operare pentru Asociații de Proprietari' 
            : isFa 
            ? 'سیستم‌عامل جامع برای مدیریت انجمن‌های مالکان' 
            : 'The HOA Operating System Built for Financial Truth'}
        </h1>
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
          {isRo
            ? 'Elimină erorile din tabelele Excel, recâștigă încrederea proprietarilor și gestionează închiderea lunară în partidă simplă conform Legii 196/2018.'
            : isFa
            ? 'پایان دادن به خطاهای اکسل، بازیابی اعتماد ساکنان و مدیریت منظم بستن دوره‌های مالی دفاتر قانونی با شفافیت ۱۰۰٪.'
            : 'Eliminate spreadsheet drift, restore community trust, and maintain statutory simple-entry month-end closes with optional supplemental analytical controls.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href={`/${lang}/demo`}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <span>{dict.common.liveDemo}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
          <Link
            href={`/${lang}/pilot`}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl glass-panel hover:bg-white/10 text-white font-bold transition-all border border-white/10 flex items-center justify-center"
          >
            <span>{dict.common.startPilot}</span>
          </Link>
        </div>
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {capabilities.map((cap, idx) => (
          <div key={idx} className="p-8 rounded-3xl glass-panel border border-white/10 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">{cap.title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{cap.desc}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
