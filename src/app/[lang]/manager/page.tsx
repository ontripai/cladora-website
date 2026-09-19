import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import {
  Layers,
  Zap,
  Users2,
  BarChart4,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Building,
  Clock
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
  return getRouteMetadata('/manager', params.lang);
}

export default async function ManagerPage(
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
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EAF8F5] border border-[#B2E5DF] text-xs font-bold text-[#0A6E62]">
          <Layers className="w-3.5 h-3.5 text-[#0A6E62]" />
          <span>Manager OS</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-display font-extrabold text-white tracking-tight">
          {isRo
            ? 'Scalează Compania de Administrare la Mii de Apartamente'
            : isFa
            ? 'مقیاس‌پذیری عملیات مدیریت املاک به هزاران واحد مسکونی'
            : 'Scale Your Property Management Operations'}
        </h1>
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
          {dict.modesSection.manager.tagline}
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <Link
            href={`/${lang}/pilot`}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#0A6E62] hover:bg-[#08544B] shadow-sm flex items-center gap-2 transition-all"
          >
            <span>{dict.common.startPilot}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
          <Link
            href={`/${lang}/pricing`}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-slate-300 glass-panel hover:text-white"
          >
            {dict.nav.pricing}
          </Link>
        </div>
      </div>

      {/* Enterprise Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-8 rounded-3xl glass-panel border border-white/10 space-y-3">
          <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400 w-fit">
            <Zap className="w-6 h-6 text-[#0A6E62]" />
          </div>
          <h3 className="text-xl font-bold text-white">
            {isRo
              ? 'Închidere de Lună în Masă (Mass Billing)'
              : isFa
              ? 'بستن دسته‌ای و هم‌زمان دوره‌های ماهانه'
              : 'Batch Month-End Billing'}
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            {isRo
              ? 'Procesează 10,000 de apartamente din zeci de asociații în mai puțin de 30 de minute, cu generarea automată a listelor oficiale de plată.'
              : isFa
              ? 'محاسبه و صدور خودکار قبوض شارژ برای بیش از ۱۰٬۰۰۰ واحد مسکونی در ده‌ها مجتمع ظرف کمتر از ۳۰ دقیقه بدون تداخل پایگاه‌داده.'
              : 'Execute batch calculations across 10,000+ units in under 30 minutes with zero database contention and instantaneous PDF statement rendering.'}
          </p>
        </div>

        <div className="p-8 rounded-3xl glass-panel border border-white/10 space-y-3">
          <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400 w-fit">
            <Clock className="w-6 h-6 text-[#0A6E62]" />
          </div>
          <h3 className="text-xl font-bold text-white">
            {isRo
              ? 'Dispecerat Tichete & Monitorizare SLA'
              : isFa
              ? 'مرکز دیسپچینگ تیکت‌ها و پایش تعهدات SLA'
              : 'Ticket Dispatch & Contractor SLAs'}
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            {isRo
              ? 'Atribuie comenzi de lucru instalatorilor, electricienilor și firmelor de curățenie. Măsoară timpul de răspuns și satisfacția locatarilor.'
              : isFa
              ? 'تخصیص هوشمند درخواست‌های تعمیرات به تکنسین‌ها و پیمانکاران تخصصی به همراه سنجش زمان پاسخگویی و رضایت ساکنان.'
              : 'Dispatch work orders to technicians and facilities contractors. Track resolution time against contractual SLAs and resident feedback.'}
          </p>
        </div>

        <div className="p-8 rounded-3xl glass-panel border border-white/10 space-y-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit">
            <Users2 className="w-6 h-6 text-[#065F46]" />
          </div>
          <h3 className="text-xl font-bold text-white">
            {isRo
              ? 'Delegare Roluri & Drepturi Echipă'
              : isFa
              ? 'تفکیک دسترسی‌های سازمانی و ردپای ممیزی'
              : 'Granular Staff Delegation & Audit'}
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            {isRo
              ? 'Restricționează accesul administratorilor de teren doar la blocurile din zona lor. Cenzorii și contabilii au roluri strict auditate.'
              : isFa
              ? 'محدودسازی دسترسی کارشناسان به مجتمع‌های حوزه مسئولیت، همراه با نظارت یکپارچه بر عملکرد حسابداران و بازرسان مالی.'
              : 'Scope on-site managers to their specific geographical zones while centralizing financial auditing and legal compliance under leadership.'}
          </p>
        </div>
      </div>

      {/* M25 Utility Bills & Invoice Intelligence Spotlight */}
      <div className="card-proptech p-6 sm:p-8 bg-white border-[#E2E8F0] shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#EAF8F5] text-[#0A6E62] font-mono text-xs font-bold border border-[#B2E5DF]">
              Workspace M25
            </span>
            <span className="text-xs text-[#52667A]">
              {isRo ? 'Inteligență Financiară & Facturi' : isFa ? 'هوش پردازش قبوض و اسناد' : 'Invoice Intelligence'}
            </span>
          </div>
          <h2 className="text-2xl font-display font-extrabold text-[#102A43]">
            {isRo
              ? 'Facturi Utilități & OCR Asistat'
              : isFa
              ? 'قبوض آب و برق و هوش استخراج صورت‌حساب‌ها'
              : 'Utility Bills & Invoice Intelligence'}
          </h2>
          <p className="text-sm text-[#52667A] max-w-2xl leading-relaxed">
            {isRo
              ? 'Ingestie multi-canal (format XML e-Factura, Email, OCR, CSV), reconciliere indexuri contoare, verificare tarife și aprobare umană obligatorie conform Legii 196/2018.'
              : isFa
              ? 'دریافت چندکاناله صورت‌حساب‌ها، تطبیق خودکار شاخص کنتورها، بررسی انطباق تعرفه‌ها و تأیید نهایی توسط کاربر مجاز انسانی.'
              : 'Multi-channel invoice ingestion, OCR parsing, meter index reconciliation, tariff validation, and mandatory authorized human sign-off.'}
          </p>
        </div>

        <Link
          href={`/${lang}/ui/manager/utility-bills`}
          className="px-6 py-3 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <span>{isRo ? 'Deschide Spațiul de Lucru M25' : isFa ? 'ورود به پنل M25' : 'Open M25 Workspace'}</span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
