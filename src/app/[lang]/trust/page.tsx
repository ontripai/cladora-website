import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { ShieldCheck, Lock, FileText, Server, Scale, CheckCircle2 } from 'lucide-react';





export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/trust', params.lang);
}

export default async function TrustPage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = await props.params;
  const dict = getDictionary(params.lang);
  const lang = params.lang;
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  const securityPillars = [
    {
      title: isRo 
        ? 'Criptare End-to-End & Protecție Date' 
        : isFa 
        ? 'رمزنگاری سرتاسری و جداسازی کامل پایگاه‌داده‌ها' 
        : 'End-to-End Encryption & Tenant Isolation',
      desc: isRo
        ? 'Datele fiecărei asociații sunt complet izolate (Multi-tenant database isolation). Criptare AES-256 în repaus și TLS 1.3 în tranzit.'
        : isFa
        ? 'اطلاعات هر مجتمع در لایه پایگاه‌داده کاملاً ایزوله است. رمزنگاری با استاندارد AES-256 در حالت ذخیره و پروتکل TLS 1.3 در انتقال.'
        : 'Complete multi-tenant database isolation. Encrypted with AES-256 at rest and TLS 1.3 in transit.',
      icon: Lock,
    },
    {
      title: isRo 
        ? 'Arhitectură GDPR & Minimizarea Datelor' 
        : isFa 
        ? 'انطباق با استانداردهای GDPR و به حداقل‌رسانی داده‌ها' 
        : 'GDPR Architecture & Purpose Minimization',
      desc: isRo
        ? 'Conceput pentru respectarea confidențialității locatarilor. Datele de contact și istoricul de acces sunt accesate strict pe bază de rol și scop justificat.'
        : isFa
        ? 'طراحی‌شده منطبق بر اصول حفظ حریم خصوصی ساکنان. دسترسی به سوابق صرفاً بر اساس نقش سازمانی تعریف‌شده و اهداف مشخص قانونی انجام می‌پذیرد.'
        : 'Designed to support GDPR principles. Contact details and access trails are strictly governed by purpose-bound role permissions.',
      icon: ShieldCheck,
    },
    {
      title: isRo 
        ? 'Jurnal de Audit Imuabil (Tamper-Evident)' 
        : isFa 
        ? 'سوابق و لاگ‌های ممیزی تغییرناپذیر با امضای دیجیتال' 
        : 'Immutable Tamper-Evident Audit Trails',
      desc: isRo
        ? 'Orice înregistrare contabilă, logare, export de fișiere sau modificare de permisiuni este stocată într-un registru criptografic imuabil.'
        : isFa
        ? 'کلیه اسناد حسابداری، ورودهای کاربران، خروجی فایل‌ها و تغییرات دسترسی در یک دفتر کل امن با هش رمزنگاری ثبت می‌گردند.'
        : 'Every journal entry, authentication event, file export, and permission escalation is committed to an immutable append-only audit trail.',
      icon: Server,
    },
    {
      title: isRo 
        ? 'Redundanță Cloud & Recuperare Asistată' 
        : isFa 
        ? 'تاب‌آوری ابری و پشتیبان‌گیری پیوسته اطلاعات' 
        : 'Cloud Resilience & Point-in-Time Recovery',
      desc: isRo
        ? 'Infrastructură cloud găzduită în regiuni europene, cu politici automate de backup și proceduri documentate de recuperare în caz de incident.'
        : isFa
        ? 'زیرساخت ابری سازمانی مستقر در دیتاسنترهای اتحادیه اروپا همراه با نسخه‌برداری خودکار و دستورالعمل‌های مدون بازیابی سوابق.'
        : 'Enterprise cloud infrastructure deployed in EU regions, featuring automated backup policies and recovery runbooks.',
      icon: Scale,
    },
  ];

  return (
    <div className="pt-32 pb-24 space-y-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Header Hero */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full glass-panel border border-brand-500/20 text-xs font-semibold text-brand-300">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
          <span>Trust & Compliance Core C17</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-display font-extrabold text-white tracking-tight">
          {isRo 
            ? 'Securitate și Încredere la Nivel Enterprise' 
            : isFa 
            ? 'امنیت، قابلیت اطمینان و انطباق در سطح سازمانی' 
            : 'Enterprise Security, Privacy & Reliability'}
        </h1>
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
          {dict.common.securityCertified}
        </p>
      </div>

      {/* 4 Security Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {securityPillars.map((p, idx) => {
          const IconComp = p.icon;
          return (
            <div key={idx} className="p-8 rounded-3xl glass-panel border border-white/10 space-y-3">
              <div className="p-3 rounded-xl bg-brand-500/10 text-brand-400 w-fit">
                <IconComp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">{p.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
            </div>
          );
        })}
      </div>

      {/* GDPR Section */}
      <div id="gdpr" className="p-8 sm:p-12 rounded-3xl bg-surface-100/90 border border-white/10 space-y-6">
        <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-brand-400" />
          <span>
            {isRo 
              ? 'Angajamentul Nostru GDPR pentru România și Uniunea Europeană' 
              : isFa 
              ? 'تعهدات کلادورا در قبال قوانین حریم خصوصی GDPR و حقوق ساکنان' 
              : 'GDPR Commitment & Resident Rights'}
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm text-slate-300">
          <div className="space-y-2 p-4 rounded-xl glass-panel">
            <span className="font-bold text-brand-300 block">
              {isRo ? 'Dreptul la Portabilitate' : isFa ? 'حق انتقال داده‌ها' : 'Data Portability'}
            </span>
            <p className="text-slate-400 text-xs">
              {isRo 
                ? 'Asociațiile și proprietarii pot exporta oricând toate datele financiare și istoricul de consum în formate standard (Excel, JSON, PDF).'
                : isFa
                ? 'مدیران مجتمع و مالکان می‌توانند در هر زمان کلیه تراکنش‌های مالی و سوابق مصارف را در قالب فایل‌های استاندارد (اکسل، JSON و PDF) دریافت کنند.'
                : 'HOAs and owners can export all transaction and meter history anytime in open standard formats.'}
            </p>
          </div>
          <div className="space-y-2 p-4 rounded-xl glass-panel">
            <span className="font-bold text-brand-300 block">
              {isRo ? 'Minimizarea Datelor' : isFa ? 'به حداقل‌رسانی داده‌ها' : 'Data Minimization'}
            </span>
            <p className="text-slate-400 text-xs">
              {isRo 
                ? 'Colectăm strict datele necesare bunei funcționări conform legii. Fără urmărire ascunsă sau vânzare de date către terți.'
                : isFa
                ? 'ما صرفاً داده‌های ضروری برای انجام تکالیف قانونی و محاسبات را ذخیره می‌کنیم؛ بدون هیچ‌گونه ردیابی تبلیغاتی یا اشتراک‌گذاری با اشخاص ثالث.'
                : 'We collect strictly the data required by statutory law. Zero third-party ad tracking or data brokering.'}
            </p>
          </div>
          <div className="space-y-2 p-4 rounded-xl glass-panel">
            <span className="font-bold text-brand-300 block">
              {isRo ? 'Dreptul de Acces & Ștergere' : isFa ? 'حق دسترسی و حذف سوابق' : 'Access & Erasure'}
            </span>
            <p className="text-slate-400 text-xs">
              {isRo 
                ? 'Fluxuri automatizate pentru solicitările de acces sau anonimizare a datelor personale ale foștilor locatari.'
                : isFa
                ? 'گردش‌کار خودکار جهت رسیدگی به درخواست‌های دسترسی به داده‌ها یا ناشناس‌سازی اطلاعات مستأجران پس از اتمام قرارداد.'
                : 'Automated workflows for Data Subject Requests (DSR) and tenant anonymization upon tenancy expiration.'}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
