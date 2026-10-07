import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Briefcase, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  Scale, 
  Clock, 
  CheckCheck, 
  ShieldCheck, 
  Building2,
  Coins,
  History
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
  return getRouteMetadata('/service', params.lang);
}

export default async function ServicePage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const steps = [
    {
      number: '01',
      title: lang === 'ro' ? '1. Catalog de Servicii & Descriere Nevoie' : lang === 'fa' ? '۱. کاتالوگ خدمات و ثبت شرح نیاز' : '1. Service Catalog & Briefing',
      desc: lang === 'ro'
        ? 'Alegerea categoriei de intervenție (curățenie, reparații instalații, revizii lifturi, deratizare, amenajări) și definirea clară a cerințelor pentru spațiul sau unitatea vizată.'
        : lang === 'fa'
        ? 'انتخاب نوع خدمت از کاتالوگ استاندارد (تأسیسات، نظافت، سرویس آسانسور، ضدعفونی، باغبانی) و تکمیل شرح نیاز دقیق متصل به واحد یا بخش مربوطه در ملک.'
        : 'Select service categories and specify requirements attached to the exact property space or physical asset.',
      icon: Briefcase
    },
    {
      number: '02',
      title: lang === 'ro' ? '2. Ofertare & Comparare Devize' : lang === 'fa' ? '۲. دریافت و مقایسه پیشنهادها' : '2. Competitive Quote Comparison',
      desc: lang === 'ro'
        ? 'Primirea propunerilor de la furnizori acreditați, compararea costurilor defalcate, termenelor de finalizare și a condițiilor de garanție într-o matrice transparentă.'
        : lang === 'fa'
        ? 'دریافت چند پیشنهاد قیمت و زمان از ارائه‌دهندگان معتبر، مقایسه اقلام هزینه و شرایط گارانتی در یک جدول مقایسه‌ای شفاف بدون ابهام.'
        : 'Receive structured quotes, compare itemized costs, timelines, and warranty terms side by side.',
      icon: Scale
    },
    {
      number: '03',
      title: lang === 'ro' ? '3. Acord pe Domeniu, Timp & Cost' : lang === 'fa' ? '۳. توافق شفاف بر دامنه، زمان و هزینه' : '3. Scope, Schedule & Price Agreement',
      desc: lang === 'ro'
        ? 'Aprobarea formală a ofertei selectate de către persoana sau comitetul autorizat, stabilirea reperelor de plată și confirmarea programării execuției.'
        : lang === 'fa'
        ? 'تأیید رسمی پیشنهاد منتخب توسط شخص یا مدیر مجاز، تثبیت تعهدات زمانی و مالی و صدور تاییدیه برای آغاز کار.'
        : 'Formal human approval by authorized parties, setting milestones, payment covenants, and execution schedules.',
      icon: CheckCheck
    },
    {
      number: '04',
      title: lang === 'ro' ? '4. Comandă & Conectare la Comenzi de Lucru Operaționale' : lang === 'fa' ? '۴. سفارش خدمت و اتصال به دستورکار عملیات (در صورت نیاز)' : '4. Service Order & Optional Operations Work Order Link',
      desc: lang === 'ro'
        ? 'Lansarea comenzii de serviciu. În cazul în care serviciul implică intervenții fizice sau reparații tehnice, comanda se leagă direct de motorul unic de comenzi de lucru din modulul Operațiuni & Mentenanță. Unele servicii simple nu necesită comandă de lucru, în timp ce un proiect amplu poate genera mai multe comenzi de lucru corelate, fără a crea sisteme paralele de dispecerizare.'
        : lang === 'fa'
        ? 'ثبت و قطعی‌سازی سفارش خدمت. در صورتی که خدمت نیازمند کار اجرایی یا فنی در محل باشد، این سفارش مستقیماً به دستورکارهای اجرایی در سامانه «عملیات و نگهداری» متصل می‌شود. هر خدمت الزاماً به دستورکار نیاز ندارد و سفارش‌های چندمرحله‌ای ممکن است چندین دستورکار مرتبط داشته باشند؛ کلادورا از ایجاد دو سامانه مستقل صدور دستورکار جلوگیری می‌کند.'
        : 'Finalizing the service order. When physical execution or technical repairs are required, the order directly links to the unified Operations & Maintenance work order system. Simpler advisory or routine tasks do not require work orders, while multi-phase orders may connect multiple related work orders without duplicate dispatch systems.',
      icon: Clock
    },
    {
      number: '05',
      title: lang === 'ro' ? '5. Recepție Rezultat & Semnare' : lang === 'fa' ? '۵. تحویل نتیجه، نظارت کیفی و پذیرش' : '5. Verification & Verified Sign-Off',
      desc: lang === 'ro'
        ? 'Verificarea conformității lucrării, atașarea fotografiilor doveditoare și semnarea digitală a procesului-verbal de recepție calitativă.'
        : lang === 'fa'
        ? 'بررسی کیفیت کار انجام‌شده، ضمیمه کردن تصاویر و مستندات پایان کار و امضای صورت‌جلسه رسمی پذیرش توسط سفارش‌دهنده.'
        : 'Inspection of delivered work, photographic proof upload, and verified digital acceptance protocol.',
      icon: CheckCircle2
    },
    {
      number: '06',
      title: lang === 'ro' ? '6. Atașare la Istoricul Activului' : lang === 'fa' ? '۶. ثبت ماندگار در شناسنامه دارایی' : '6. Permanent Asset History Logging',
      desc: lang === 'ro'
        ? 'Factura aprobată, garanția și detaliile intervenției rămân permanent legate de unitatea sau echipamentul respectiv în cartea tehnică digitală.'
        : lang === 'fa'
        ? 'فاکتور تسویه‌شده، ضمانت‌نامه قطعات و سوابق سرویس به طور دائمی بر روی پرونده همان واحد یا تجهیزات ثبت و بایگانی می‌شوند.'
        : 'Settled invoice, warranty vouchers, and technician logs attach permanently to the unit/asset ledger.',
      icon: History
    }
  ];

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#52667A] font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            SERVICE
          </span>
        </div>

        {/* Hero Section */}
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-teal-800">
            <Briefcase className="w-3.5 h-3.5 text-teal-600" />
            <span>
              {lang === 'ro' 
                ? 'Modulul de Servicii & Comenzi CLADORA' 
                : lang === 'fa' 
                ? 'سامانه جامع کاتالوگ، سفارش، نظارت و پذیرش خدمات' 
                : 'Service Procurement, Orders & Verification OS'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' ? (
              <>
                SERVICE — De la solicitare la execuție și recepție, <span className="text-teal-600">cu istoric păstrat pe activ</span>.
              </>
            ) : lang === 'fa' ? (
              <>
                SERVICE — از ثبت نیاز تا استعلام، اجرا و پذیرش با <span className="text-teal-600">ثبت دائمی در شناسنامه دارایی</span>
              </>
            ) : (
              <>
                SERVICE — From request brief to quote comparison, verified sign-off, and <span className="text-teal-600">permanent asset history</span>.
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'SERVICE elimină comenzile verbale și devizele opace. Toate intervențiile pentru proprietate parcurg un ciclu structurat: descriere nevoie, ofertare concurențială, aprobare de cost, execuție monitorizată și atașarea dovezilor în cartea tehnică.'
              : lang === 'fa'
              ? 'SERVICE روش‌های سنتی، پیام‌های غیررسمی و فاکتورهای مبهم را کنار می‌گذارد. تمام نیازهای خدماتی در یک گردش‌کار شفاف طی می‌شوند: ثبت نیاز، مقایسه پیشنهادها، توافق بر زمان و هزینه، پیگیری اجرا و ثبت ضمانت‌نامه در سابقه ملک.'
              : 'SERVICE replaces opaque quotes with verified procurement. Every service intervention connects to the asset registry, preserving scope agreements, invoices, and sign-offs.'}
          </p>
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div 
                key={idx}
                className="card-proptech p-7 bg-white border-[#E2E8F0] space-y-4 hover:border-teal-400 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center font-bold">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-extrabold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
                    {st.number}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#102A43]">
                  {st.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                  {st.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom Callout */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {lang === 'ro' ? 'Garanție și Responsabilitate Financiară' : lang === 'fa' ? 'تعهد مالی شفاف و تضمین کیفیت خدمات' : 'Financial Accountability & Quality Assured'}
              </h3>
              <p className="text-xs text-[#CBD5E1]">
                {lang === 'ro' ? 'Nicio plată eliberată fără recepție calitativă aprobată' : lang === 'fa' ? 'تسویه‌حساب مشروط به تأیید رسمی کیفیت کار است' : 'No payout without human verified acceptance'}
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-3xl">
            {lang === 'ro'
              ? 'Sistemul asigură că devizele acceptate nu pot fi modificate unilateral pe parcursul execuției. Fiecare recepție include atestarea stării tehnice, iar cheltuielile sunt reflectate automat în jurnalul contabil al asociației sau proprietarului.'
              : lang === 'fa'
              ? 'سامانه اجازه تغییر یک‌جانبه مبالغ توافق‌شده در حین کار را نمی‌دهد. پس از انجام کار، تأیید کیفیت صورت گرفته و اسناد مالی مستقیماً در دفاتر حسابداری ثبت می‌شوند.'
              : 'Agreed scopes and pricing remain locked against unilateral inflation. Verified sign-offs post directly to the accounting ledger.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-[#102A43] bg-teal-400 hover:bg-teal-300 rounded-xl transition-colors shadow-sm text-center"
            >
              {lang === 'ro' ? 'Solicită Integrarea Modulului SERVICE' : lang === 'fa' ? 'درخواست فعال‌سازی SERVICE' : 'Inquire About SERVICE'}
            </Link>
            <Link
              href={`/${lang}/operations`}
              className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-white bg-[#173F5F] hover:bg-[#204E75] border border-[#244A6F] rounded-xl transition-colors text-center"
            >
              {lang === 'ro' ? 'Vezi Modulul Operațiuni & Mentenanță' : lang === 'fa' ? 'مشاهده بخش عملیات و نگهداری' : 'View Operations & Maintenance'}
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
