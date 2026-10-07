import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Wrench, 
  ArrowRight, 
  CheckCircle2, 
  Calendar, 
  AlertTriangle, 
  FileSpreadsheet, 
  ShieldCheck, 
  Clock, 
  FileText,
  Building2,
  Cpu
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
  return getRouteMetadata('/operations', params.lang);
}

export default async function OperationsPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const features = [
    {
      title: lang === 'ro' ? '1. Registrul Digital de Echipamente & Active' : lang === 'fa' ? '۱. شناسنامه دیجیتال تجهیزات و تأسیسات' : '1. Equipment & Physical Asset Registers',
      desc: lang === 'ro'
        ? 'Evidența completă a tuturor componentelor tehnice ale clădirii: ascensoare, centrale termice, hidrofoare, pompe de incendiu, transformatoare și sisteme de ventilație, cu date de fabricație și garanții.'
        : lang === 'fa'
        ? 'ثبت و ردیابی کامل تمامی اجزای فنی و تأسیساتی ساختمان: آسانسورها، موتورخانه و چیلر، پمپ‌های آب و آتش‌نشانی، دیزل‌ژنراتور و هواسازها، با ثبت تاریخچه گارانتی و مدارک سازنده.'
        : 'Comprehensive registry of technical assets: elevators, HVAC, fire pumps, boilers, and transformers with serials and warranty metadata.',
      icon: Cpu
    },
    {
      title: lang === 'ro' ? '2. Programe de Mentenanță Preventivă Periodică' : lang === 'fa' ? '۲. برنامه‌های زمان‌بندی نگهداری دوره‌ای' : '2. Scheduled Preventative Maintenance',
      desc: lang === 'ro'
        ? 'Planificarea automată a reviziilor obligatorii (ISCIR, stingătoare, curățare tubulaturi, panouri electrice) cu alerte timpurii către administratori și contractori.'
        : lang === 'fa'
        ? 'تنظیم تقویم دوره‌ای سرویس‌های فنی الزامی و بازرسی‌های استاندارد، با ارسال هشدارهای هوشمند پیش از سررسید برای تیم‌های مسئول.'
        : 'Automated recurring service schedules (safety inspections, filter replacements, fire drills) with advance alerts.',
      icon: Calendar
    },
    {
      title: lang === 'ro' ? '3. Sesizarea Avariilor & Tichete Tehnice' : lang === 'fa' ? '۳. اعلام خرابی و رهگیری تیکت‌های رفع نقص' : '3. Incident & Defect Reporting',
      desc: lang === 'ro'
        ? 'Transmiterea facilă a defecțiunilor de către locatari sau personalul de pază, cu fotografii doveditoare, nivel de urgență și alocare automată pe zone.'
        : lang === 'fa'
        ? 'ثبت سریع موارد خرابی توسط ساکنان، مدیران یا نگهبانی همراه با تصویر، تعیین سطح اضطرار و انتساب مستقیم به زون یا تجهیز مربوطه.'
        : 'Fast incident reporting by occupants or security teams with photo evidence, urgency triage, and spatial tagging.',
      icon: AlertTriangle
    },
    {
      title: lang === 'ro' ? '4. Comenzi de Lucru & Desemnare Responsabil' : lang === 'fa' ? '۴. صدور دستورکار و تعیین مسئول اجرا' : '4. Work Orders & Technician Dispatch',
      desc: lang === 'ro'
        ? 'Transformarea sesizărilor în comenzi de lucru formale către tehnicieni interni sau firme partenere, cu instrucțiuni clare și orar de intervenție.'
        : lang === 'fa'
        ? 'تبدیل گزارش خرابی به دستورکار رسمی با تخصیص مستقیم تکنسین یا پیمانکار طرف قرارداد، مشخصات دقیق محل و بازه زمانی اجرا.'
        : 'Converting tickets into structured work orders dispatched to certified technicians with access credentials.',
      icon: Wrench
    },
    {
      title: lang === 'ro' ? '5. Dosar de Service & Documentație de Cost' : lang === 'fa' ? '۵. سوابق سرویس، صورت‌هزینه‌ها و فاکتورها' : '5. Service Logbooks & Expense Auditing',
      desc: lang === 'ro'
        ? 'Fiecare piesă schimbată, oră de manoperă și raport de service sunt arhivate digital pe fișa activului, fiind accesibile pentru verificarea cenzorilor.'
        : lang === 'fa'
        ? 'قطعات تعویض‌شده، ساعات کارکرد و گزارش فنی در شناسنامه همان دستگاه بایگانی می‌شود و برای بازرسان مالی و مدیران مجاز قابل استناد است.'
        : 'Replaced parts, labor hours, and technical sign-offs archived permanently on the asset logbook for board auditor review.',
      icon: FileSpreadsheet
    },
    {
      title: lang === 'ro' ? '6. Rapoarte Operaționale pentru Persoane Autorizate' : lang === 'fa' ? '۶. گزارش‌های عملیاتی برای افراد و مراجع مجاز' : '6. Operational Health Reports',
      desc: lang === 'ro'
        ? 'Rapoarte de disponibilitate a echipamentelor, timpi medii de remediere (MTTR), respectarea contractelor SLA și estimări pentru fondul de reparații.'
        : lang === 'fa'
        ? 'تحلیل وضعیت سلامت تأسیسات، میانگین زمان رفع خرابی، سنجش عملکرد پیمانکاران (SLA) و برآورد بودجه لازم برای صندوق ذخیره و نوسازی.'
        : 'Asset health indicators, mean-time-to-repair metrics, contractor SLA compliance, and long-term capital replacement forecasts.',
      icon: FileText
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
            {lang === 'ro' ? 'Operațiuni & Mentenanță' : lang === 'fa' ? 'عملیات و نگهداری' : 'Operations & Maintenance'}
          </span>
        </div>

        {/* Hero Section */}
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800">
            <Wrench className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {lang === 'ro' 
                ? 'Gestiunea Tehnică a Clădirilor & Echipamentelor' 
                : lang === 'fa' 
                ? 'سامانه جامع مدیریت فنی، تجهیزات و عملیات نگهداری ملک' 
                : 'Facility Management & Operations OS'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' ? (
              <>
                Operațiuni & Mentenanță — Active tehnice, revizii periodice și comenzi de lucru <span className="text-blue-600">într-un flux integrat</span>.
              </>
            ) : lang === 'fa' ? (
              <>
                عملیات و نگهداری — تجهیزات فنی، سرویس‌های دوره‌ای و دستورکارها <span className="text-blue-600">در گردشی یکپارچه و قابل ردیابی</span>
              </>
            ) : (
              <>
                Operations & Maintenance — Asset registries, recurring preventative plans, and <span className="text-blue-600">dispatched work orders</span>.
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Menținerea valorii patrimoniale a unei proprietăți depinde de rigoarea tehnică. CLADORA transformă intervențiile reactive în mentenanță preventivă documentată, cu alocare clară a sarcinilor și istoric digital permanent.'
              : lang === 'fa'
              ? 'حفظ ارزش سرمایه‌ای ملک وابسته به نگهداری اصولی تأسیسات است. کلادورا مراجعات پراکنده را به سیستمی مدون از پیشگیری، ثبت خرابی، دستورکار با مسئول مشخص و بایگانی شفاف هزینه‌ها تبدیل می‌کند.'
              : 'Preserving real estate asset value demands rigorous preventative care. CLADORA replaces reactive fire-fighting with scheduled maintenance plans, work orders, and equipment audit history.'}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx}
                className="card-proptech p-7 bg-white border-[#E2E8F0] space-y-4 hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#102A43]">
                  {feat.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Block */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {lang === 'ro' ? 'Transparență Tehnică și Control al Costurilor' : lang === 'fa' ? 'شفافیت فنی و نظارت بر هزینه‌های تعمیرات' : 'Technical Transparency & Cost Control'}
              </h3>
              <p className="text-xs text-[#CBD5E1]">
                {lang === 'ro' ? 'Toate comenzile de lucru generează dovezi auditate pentru cenzori și comitete' : lang === 'fa' ? 'تمامی اسناد هزینه و دستورکارها مستقیماً در اختیار بازرسان مالی و مالکان قرار می‌گیرند' : 'All maintenance records form audited proof for boards and auditors'}
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-3xl">
            {lang === 'ro'
              ? 'Fiecare factură de service este corelată cu raportul de recepție tehnică semnat, prevenind facturile nejustificate sau lucrările fictive. Istoricul echipamentelor rămâne intact chiar și la schimbarea echipei tehnice.'
              : lang === 'fa'
              ? 'هر فاکتور سرویس به صورت مستقیم به صورت‌جلسه پذیرش فنی پیوست می‌شود و از هزینه‌تراشی‌های غیرواقعی جلوگیری می‌کند. شناسنامه تجهیزات حتی با تغییر پیمانکاران برای همیشه حفظ می‌شود.'
              : 'Every maintenance invoice matches a verified work order and sign-off report. Asset logbooks endure across technician and vendor rotations.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-[#102A43] bg-blue-400 hover:bg-blue-300 rounded-xl transition-colors shadow-sm text-center"
            >
              {lang === 'ro' ? 'Solicită Modulul de Operațiuni' : lang === 'fa' ? 'درخواست فعال‌سازی عملیات و نگهداری' : 'Inquire About Operations'}
            </Link>
            <Link
              href={`/${lang}/platform`}
              className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-white bg-[#173F5F] hover:bg-[#204E75] border border-[#244A6F] rounded-xl transition-colors text-center"
            >
              {lang === 'ro' ? 'Vezi Arhitectura Platformei' : lang === 'fa' ? 'مشاهده معماری جامع پلتفرم' : 'Explore Platform Architecture'}
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
