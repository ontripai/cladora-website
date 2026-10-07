import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  KeyRound, 
  FileCheck2, 
  TrendingUp, 
  ShieldCheck, 
  Users, 
  FileSpreadsheet,
  Clock,
  Briefcase
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
  return getRouteMetadata('/airprop', params.lang);
}

export default async function AirpropPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const capabilities = [
    {
      title: lang === 'ro' ? '1. Prezentarea & Oferirea Proprietății' : lang === 'fa' ? '۱. معرفی و عرضهٔ هدفمند ملک' : '1. Property Showcase & Presentation',
      desc: lang === 'ro'
        ? 'Prezentarea structurată a imobilelor, spațiilor comerciale sau unităților rezidențiale, sincronizată direct cu registrul fizic de unități al platformei CLADORA.'
        : lang === 'fa'
        ? 'معرفی استاندارد مشخصات ملک، واحدها، فضاهای تجاری و مشاعات، متصل به هویت یکتای ثبت‌شده در هسته مشترک کلادورا بدون دوباره‌کاری.'
        : 'Structured presentation of properties and units synchronized with CLADORA’s spatial topology.',
      icon: Building2
    },
    {
      title: lang === 'ro' ? '2. Oportunități Comerciale & Potrivire Asistată' : lang === 'fa' ? '۲. متقاضیان، فرصت‌های تجاری و تطبیق هوشمند' : '2. Inquiries & Intelligent Matching',
      desc: lang === 'ro'
        ? 'Gestionarea cererilor, colectarea preferințelor cumpărătorilor sau chiriașilor și corelarea asistată cu unitățile disponibile, fără promisiuni nerealiste de randament.'
        : lang === 'fa'
        ? 'ثبت و پیگیری متقاضیان، بررسی اولویت‌ها و تطبیق هوشمند نیاز متقاضی با فرصت‌های موجود در چارچوب مصوب، بدون وعده‌های تضمین‌شده نامعتبر.'
        : 'Systematic inquiry management and algorithmic opportunity matching without unrealistic speculative guarantees.',
      icon: Sparkles
    },
    {
      title: lang === 'ro' ? '3. Evaluare Condiții & Verificare Documente' : lang === 'fa' ? '۳. ارزیابی اسناد، شرایط و بررسی اولیه' : '3. Due Diligence & Document Verification',
      desc: lang === 'ro'
        ? 'Verificarea actelor de proprietate, cadastru, certificate de performanță energetică și stadiul sarcinilor înainte de angajament contractual.'
        : lang === 'fa'
        ? 'بررسی اسناد مالکیت، استعلامات فنی، گواهی‌ها و ارزیابی شرایط معامله پیش از عقد توافق‌نامه قطعی.'
        : 'Verification of title registries, floor plans, and technical certificates prior to legal commitments.',
      icon: FileCheck2
    },
    {
      title: lang === 'ro' ? '4. Rezervări, Pre-vânzări & Vânzare' : lang === 'fa' ? '۴. رزرو، پیش‌فروش و معاملات قطعی' : '4. Reservations, Pre-Sales & Closing',
      desc: lang === 'ro'
        ? 'Înregistrarea rezervărilor, antecontractelor, termenelor de plată în tranșe și sincronizarea vânzării cu predarea către exploatare.'
        : lang === 'fa'
        ? 'ثبت پیش‌قراردادها، اقساط، سپرده‌ها و پیش‌فروش واحدها، با اتصال بی‌وقفه فرایند مالی به تحویل نهایی و بهره‌برداری.'
        : 'Tracking reservations, milestone instalments, pre-sales agreements, and handoff to operations.',
      icon: KeyRound
    },
    {
      title: lang === 'ro' ? '5. Închirieri & Relația Proprietar-Chiriaș' : lang === 'fa' ? '۵. اجاره و مدیریت روابط موجر و مستأجر' : '5. Leasing & Tenancy Administration',
      desc: lang === 'ro'
        ? 'Administrarea contractelor de închiriere, urmărirea încasărilor, indexare automată și separarea cheltuielilor curente de fondul proprietarului.'
        : lang === 'fa'
        ? 'مدیریت قراردادهای اجاره، پیگیری پرداخت اجاره‌بها، تمدید یا تخلیه و تفکیک خودکار هزینه‌های مصرفی از سرمایه‌ای.'
        : 'Lease contract lifecycle, automated indexation, rent collection, and strict debtor/payer separation.',
      icon: TrendingUp
    },
    {
      title: lang === 'ro' ? '6. Mandat de Administrare a Proprietății' : lang === 'fa' ? '۶. واگذاری رسمی مدیریت ملک' : '6. Property Management Mandates',
      desc: lang === 'ro'
        ? 'Delegarea operativă a gestionării proprietății către administratori profesioniști, cu delimitarea precisă a plafonului de cheltuieli și raportare periodică.'
        : lang === 'fa'
        ? 'واگذاری مدیریت بهره‌برداری به شرکت‌های تخصصی املاک، با تعیین سقف اختیارات مالی و گزارش‌گیری شفاف دوره‌ای.'
        : 'Formal property management delegation with clear expense approval thresholds and automated reporting.',
      icon: Briefcase
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
            AIRPROP
          </span>
        </div>

        {/* Hero Section */}
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>
              {lang === 'ro' 
                ? 'Sistemul de Tranzacții, Vânzări & Închirieri CLADORA' 
                : lang === 'fa' 
                ? 'سامانه جامع معاملات، پیش‌فروش و اجاره در پلتفرم CLADORA' 
                : 'Property Commercialization, Sales & Leasing OS'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' ? (
              <>
                AIRPROP — Comercializarea, pre-vânzarea și gestiunea contractelor <span className="text-amber-600">pe același nucleu de date</span>.
              </>
            ) : lang === 'fa' ? (
              <>
                AIRPROP — عرضه، معاملات، پیش‌فروش و اجاره بر بستر <span className="text-amber-600">هسته مشترک کلادورا</span>
              </>
            ) : (
              <>
                AIRPROP — Real estate commercialization, pre-sales, and leasing on the <span className="text-amber-600">shared CLADORA core</span>.
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'AIRPROP răspunde la întrebarea: de ce, prin ce contracte și sub ce mandat este achiziționată, vândută sau închiriată această proprietate? Conectează vânzările direct cu documentele de predare și exploatare, fără a crea baze de date duplicate.'
              : lang === 'fa'
              ? 'AIRPROP پاسخ می‌دهد که یک ملک بر اساس کدام شرایط، قراردادها و اختیارات خریداری می‌شود، پیش‌فروش می‌گردد، اجاره داده می‌شود یا به شرکت مدیریت واگذار می‌شود. تمامی فرایندهای تجاری مستقیماً به تحویل و بهره‌برداری پیوند می‌خورند.'
              : 'AIRPROP covers property investment, underwriting, marketing, pre-sales, and leasing mandates, seamlessly transferring closing records into operational living workspaces.'}
          </p>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {capabilities.map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <div 
                key={idx}
                className="card-proptech p-7 bg-white border-[#E2E8F0] space-y-4 hover:border-amber-400 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#102A43]">
                  {cap.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                  {cap.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Seamless Bridge to Operations Banner */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {lang === 'ro' ? 'Puntea directă între Vânzare și Exploatare' : lang === 'fa' ? 'اتصال مستقیم معاملات به تحویل و بهره‌برداری' : 'The Direct Bridge from Closing to Living Operations'}
              </h3>
              <p className="text-xs text-[#CBD5E1]">
                {lang === 'ro' ? 'Nicio pierdere de informații la finalizarea tranzacției' : lang === 'fa' ? 'حفظ پیوستگی اسناد بدون نیاز به ورود مجدد اطلاعات' : 'Zero manual re-entry when properties transition to occupants'}
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-3xl">
            {lang === 'ro'
              ? 'Atunci când un cumpărător finalizează achiziția în AIRPROP, datele unității, indexurile de bază ale contoarelor și garanțiile trec automat în Workspace-ul de exploatare CLADORA. Noul proprietar primește acces instant la fisa unității sale, fără foi rătăcite sau dosare pierdute.'
              : lang === 'fa'
              ? 'هنگامی که معامله یا پیش‌فروش یک واحد در AIRPROP نهایی می‌شود، مشخصات دقیق واحد، ارقام اولیه کنتورها، نقشه‌ها و ضمانت‌ها مستقیماً وارد محیط بهره‌برداری کلادورا می‌شوند. مالک جدید بدون وقفه به کارپوشه اختصاصی واحد خود متصل می‌گردد.'
              : 'When a unit is sold or leased in AIRPROP, unit specs, baseline meter readings, and warranty covenants carry straight into CLADORA’s operational workspace.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-[#102A43] bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-sm text-center"
            >
              {lang === 'ro' ? 'Solicită Integrarea AIRPROP' : lang === 'fa' ? 'درخواست فعال‌سازی AIRPROP' : 'Inquire About AIRPROP'}
            </Link>
            <Link
              href={`/${lang}/lifecycle`}
              className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-white bg-[#173F5F] hover:bg-[#204E75] border border-[#244A6F] rounded-xl transition-colors text-center"
            >
              {lang === 'ro' ? 'Vezi Ciclul de Viață Complet' : lang === 'fa' ? 'مشاهده تمام چرخهٔ عمر ملک' : 'View Full Lifecycle'}
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
