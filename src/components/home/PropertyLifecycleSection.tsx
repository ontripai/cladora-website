'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building, 
  Sparkles, 
  FileCheck2, 
  KeyRound, 
  Home, 
  Wrench, 
  TrendingUp, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface PropertyLifecycleSectionProps {
  lang: Language;
}

export const PropertyLifecycleSection: React.FC<PropertyLifecycleSectionProps> = ({ lang }) => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 'definition',
      number: '01',
      title: lang === 'ro' ? 'Definire Proiect & Pre-vânzare' : lang === 'fa' ? 'تعریف پروژه، اسناد و پیش‌فروش' : 'Project Definition & Pre-Sale',
      tag: lang === 'ro' ? 'Înainte de finalizarea clădirii' : lang === 'fa' ? 'پیش از تکمیل ساختمان' : 'Pre-construction phase',
      icon: Sparkles,
      desc: lang === 'ro'
        ? 'Stabilirea identității imobilului, structurarea unităților, gestionarea oportunităților comerciale, rezervări, contracte de pre-vânzare și seif digital pentru documentația tehnică inițială.'
        : lang === 'fa'
        ? 'آغاز همراهی کلادورا می‌تواند پیش از تکمیل ساختمان باشد: ثبت هویت ملک و واحدها، فرصت‌های تجاری و متقاضیان، رزرو، پیش‌فروش و نگهداری نقشه‌ها و اسناد اولیه.'
        : 'CLADORA begins before construction completes: establishing unit registries, commercial leads, reservations, pre-sales contracts, and digital vault for technical records.',
      scopeNote: lang === 'ro'
        ? 'Notă: Managementul de șantier și execuția efectivă a construcției nu fac parte din produs.'
        : lang === 'fa'
        ? 'توجه: مدیریت اجرایی کارگاه ساخت و عملیات پیمانکاری سازه خارج از دامنهٔ محصول است.'
        : 'Scope boundary: Physical construction site scheduling and contractor site execution remain out of scope.',
      capabilities: [
        lang === 'ro' ? 'Catalog digital al unităților și cotelor' : lang === 'fa' ? 'ثبت شناسنامه واحدها و متراژ' : 'Unit & share catalog',
        lang === 'ro' ? 'Gestiune rezervări și antecontracte' : lang === 'fa' ? 'مدیریت فرصت‌ها و پیش‌فروش' : 'Reservation & pre-sale ledger',
        lang === 'ro' ? 'Seif securizat de documente tehnice' : lang === 'fa' ? 'بایگانی امن اسناد و مدارک' : 'Secure technical document vault'
      ]
    },
    {
      id: 'handover',
      number: '02',
      title: lang === 'ro' ? 'Predare-Primire & Recepție (Completă / Parțială)' : lang === 'fa' ? 'تحویل کامل یا جزئی و پیگیری موارد باقیمانده' : 'Full or Partial Handover & Punch-List',
      tag: lang === 'ro' ? 'Tranziția către proprietari' : lang === 'fa' ? 'تحویل رسمی و رفع نقایص' : 'Delivery & punch-list',
      icon: KeyRound,
      desc: lang === 'ro'
        ? 'Predarea protocolară a unităților și spațiilor comune (recepție completă sau parțială/etapizată). Înregistrarea listelor de remedieri (punch-list), contoarelor inițiale și transferul de drepturi.'
        : lang === 'fa'
        ? 'فرایند رسمی تحویل کامل یا فازبندی‌شده/جزئی واحدها و مشاعات به خریداران یا انجمن مالکان. ثبت صورت‌جلسه تحویل، پیگیری دقیق نقایص و تعهدات باز (Punch-List) و ثبت ارقام اولیه کنتورها.'
        : 'Formal handover of units and common areas for full or partial deliveries. Punch-list defect resolution tracking, baseline utility meter registration, and initial occupancy rights activation.',
      scopeNote: lang === 'ro'
        ? 'Serviciile CLADORA nu se opresc la recepție—ele continuă pe toată durata vieții imobilului.'
        : lang === 'fa'
        ? 'خدمات محصول با تحویل ساختمان پایان نمی‌یابند؛ بلکه مرحله بهره‌برداری آغاز می‌شود.'
        : 'Services do not terminate at handover—they form the factual baseline for operations.',
      capabilities: [
        lang === 'ro' ? 'Protocol digital de predare (complet / parțial)' : lang === 'fa' ? 'صورت‌جلسه دیجیتال تحویل کامل یا جزئی' : 'Digital full or partial handover protocol',
        lang === 'ro' ? 'Urmărire punch-list și remedieri deschise' : lang === 'fa' ? 'پیگیری موارد باز و رفع نقایص تحویل' : 'Punch-list & defect resolution tracking',
        lang === 'ro' ? 'Înregistrare contoare și activare conturi' : lang === 'fa' ? 'ثبت کنتورهای پایه و دعوت ساکنان' : 'Meter baselines and occupant onboarding'
      ]
    },
    {
      id: 'operations',
      number: '03',
      title: lang === 'ro' ? 'Exploatare Zilnică & Servicii' : lang === 'fa' ? 'بهره‌برداری، زندگی و خدمات روزمره' : 'Active Living & Operations',
      tag: lang === 'ro' ? 'Viața de zi cu zi' : lang === 'fa' ? 'سکونت و فعالیت مستمر' : 'Daily living phase',
      icon: Home,
      desc: lang === 'ro'
        ? 'Evidența transparentă a cotelor de întreținere, citirea asistată a contoarelor, comunicări oficiale, adunări generale, acces securizat și catalog de servicii rezidențiale sau de birou.'
        : lang === 'fa'
        ? 'محاسبه شفاف هزینه‌ها و شارژ، قرائت کنتورها، مکاتبات و اعلانات، برگزاری جلسات و مجامع، کنترل دسترسی و اتصال به خدمات رفاهی و سکونتی.'
        : 'Day-to-day community operations: explainable cost allocation, utility metering, board notices, formal general meetings, access control, and amenity services.',
      scopeNote: lang === 'ro'
        ? 'Fiecare rol accesează strict datele permise (chiriașul nu vede contabilitatea proprietarului).'
        : lang === 'fa'
        ? 'دسترسی هر شخص دقیقاً بر اساس نوع نقش و مبنای معتبر او تعیین و کنترل می‌شود.'
        : 'Access strictly governed by relationship: tenants never view owner confidential financial books.',
      capabilities: [
        lang === 'ro' ? 'Calcul cote și plăți online securizate' : lang === 'fa' ? 'تسهیم دقیق هزینه‌ها و پرداخت' : 'Explainable charges & collections',
        lang === 'ro' ? 'Avizier digital și adunări votabile' : lang === 'fa' ? 'تابلو اعلانات دیجیتال و جلسات' : 'Digital notice board & voting ballots',
        lang === 'ro' ? 'Comenzi de servicii zilnice și mentenanță' : lang === 'fa' ? 'سفارش خدمات روزمره و نظافت' : 'Daily living requests & concierge'
      ]
    },
    {
      id: 'maintenance',
      number: '04',
      title: lang === 'ro' ? 'Mentenanță & Păstrare Activ' : lang === 'fa' ? 'نگهداری فنی و حفظ ارزش دارایی' : 'Maintenance & Asset Care',
      tag: lang === 'ro' ? 'Protecția valorii tehnice' : lang === 'fa' ? 'سرویس‌های دوره‌ای و اضطراری' : 'Facility management',
      icon: Wrench,
      desc: lang === 'ro'
        ? 'Evidența echipamentelor (ascensoare, centrale, hidrofoare), planuri de revizii periodice, sesizări de avarii, comenzi de lucru pentru tehnicieni și arhivarea costurilor pe fișa activului.'
        : lang === 'fa'
        ? 'ثبت و پایش تأسیسات و تجهیزات، تدوین برنامه‌های نگهداری پیشگیرانه، اعلام خرابی‌ها، صدور دستورکار برای تعمیرکاران و ثبت سوابق سرویس روی شناسنامه دارایی.'
        : 'Equipment registry, preventative maintenance schedules, breakdown reporting, vendor work orders, service logs, and capital reserve planning.',
      scopeNote: lang === 'ro'
        ? 'Sursa unică de adevăr tehnic care crește valoarea de piață a proprietății.'
        : lang === 'fa'
        ? 'تاریخچه مدون تعمیرات و هزینه‌ها سبب شفافیت و ارتقای ارزش واقعی ملک می‌شود.'
        : 'A documented maintenance history strengthens property valuation and reduces emergency breakdowns.',
      capabilities: [
        lang === 'ro' ? 'Registru de active și istoric de revizie' : lang === 'fa' ? 'شناسنامه فنی دارایی‌ها و تجهیزات' : 'Asset registers & maintenance logbooks',
        lang === 'ro' ? 'Flux comenzi de lucru și recepție tehnică' : lang === 'fa' ? 'صدور و پیگیری دستورکارهای فنی' : 'Work order dispatch & sign-off',
        lang === 'ro' ? 'SLA furnizori și devize aprobate' : lang === 'fa' ? 'ارزیابی پیمانکاران و هزینه‌های مصوب' : 'Contractor SLA & approved quotes'
      ]
    },
    {
      id: 'leasing',
      number: '05',
      title: lang === 'ro' ? 'Închiriere & Mandat de Administrare' : lang === 'fa' ? 'اجاره و مدیریت بهره‌برداری' : 'Leasing & Property Mandates',
      tag: lang === 'ro' ? 'Optimizare randament' : lang === 'fa' ? 'مدیریت موجر و مستأجر' : 'Tenancy lifecycle',
      icon: TrendingUp,
      desc: lang === 'ro'
        ? 'Gestiunea contractelor de închiriere, urmărirea încasărilor, separarea cheltuielilor de consum ale chiriașului de obligațiile proprietarului și delegarea către manageri profesioniști.'
        : lang === 'fa'
        ? 'مدیریت قراردادهای اجاره، پیگیری دریافت اجاره‌بها، تفکیک کامل هزینه‌های مصرفی مستأجر از تعهدات سرمایه‌ای مالک، و واگذاری مدیریت به کارگزاران املاک.'
        : 'Lease agreement administration, rental collections, isolation of operational tenant utilities from capital owner expenses, and third-party management mandates.',
      scopeNote: lang === 'ro'
        ? 'Schimbarea chiriașului nu șterge istoricul consumurilor sau identitatea unității.'
        : lang === 'fa'
        ? 'جابه‌جایی مستأجر هویت ملک و سوابق معتبر دوره‌های قبلی را مخدوش نمی‌کند.'
        : 'Tenant turnover never wipes unit history or approved historical consumptions.',
      capabilities: [
        lang === 'ro' ? 'Evidență contracte și indexuri de intrare/ieșire' : lang === 'fa' ? 'ثبت قرارداد و صورت‌جلسه تحویل و تخلیه' : 'Lease contracts & move-in/move-out logs',
        lang === 'ro' ? 'Separare automată chiriaș vs proprietar' : lang === 'fa' ? 'تفکیک اتوماتیک هزینه‌های مالک و مستأجر' : 'Automated debtor/payer separation',
        lang === 'ro' ? 'Mandate de administrare cu drepturi clare' : lang === 'fa' ? 'واگذاری مدیریت با اختیارات زمان‌دار' : 'Management mandates with bounded scope'
      ]
    },
    {
      id: 'succession',
      number: '06',
      title: lang === 'ro' ? 'Tranzacții, Ieșire din Serviciu & Predare' : lang === 'fa' ? 'معاملات بعدی، خروج از خدمت و تحویل مسئولیت' : 'Transfers, Decommissioning & Succession',
      tag: lang === 'ro' ? 'Continuitate fără pierdere de date' : lang === 'fa' ? 'انتقال مسئولیت و بستن تعهدات' : 'Accountable succession',
      icon: RefreshCw,
      desc: lang === 'ro'
        ? 'Vânzarea imobilului, schimbarea administratorului sau retragerea unui echipament din uz. Responsabilitățile se închid ordonat, sarcinile deschise se clarifică, iar succesorul preia doar evidențele autorizate conform politicii de retenție.'
        : lang === 'fa'
        ? 'تغییر مالک، مدیر یا خروج دارایی از خدمت. پایان مسئولیت قبلی با تعیین تکلیف کارهای باز، حفظ انتساب قطعی اسناد گذشته به عاملان اصلی و تحویل سوابق مجاز به جانشین طبق سیاست معتبر نگهداری همراه است.'
        : 'Ownership change, vendor turnover, or equipment decommissioning. Prior responsibilities close gracefully, open tasks are settled, past actions remain permanently credited to historical signatories, and successors receive authorized records under governance policy.',
      scopeNote: lang === 'ro'
        ? 'Predare ordonată, fără litigii și fără dosare pierdute conform politicii de arhivare.'
        : lang === 'fa'
        ? 'تحویل مسئولیت با شفافیت حقوقی، تعیین تکلیف کارهای باز و حفظ پیوستگی سوابق مجاز.'
        : 'Orderly succession without lost archives, hidden liabilities, or governance disputes under verified retention policy.',
      capabilities: [
        lang === 'ro' ? 'Predare formală a dosarului către succesor' : lang === 'fa' ? 'تحویل سیستمی پرونده به مدیر یا مالک جدید' : 'Controlled handover pack for successors',
        lang === 'ro' ? 'Păstrarea neatinsă a semnăturilor istorice' : lang === 'fa' ? 'ماندگاری اسناد گذشته به نام افراد پیشین' : 'Preserved historical signatures and logs',
        lang === 'ro' ? 'Încheierea responsabilităților și arhivare' : lang === 'fa' ? 'بستن مسئولیت‌ها و نگهداری سوابق مجاز' : 'Responsibility offboarding & compliant retention'
      ]
    }
  ];

  return (
    <section className="py-20 bg-[#F8FAFC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Continuitate & Ecosistem Ciclic' : lang === 'fa' ? 'پیوستگی سوابق و چرخهٔ غیرخطی ملک' : 'Non-Linear Property Lifecycle'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'CLADORA însoțește proprietatea în toate etapele vieții sale' 
              : lang === 'fa' 
              ? 'همراهی CLADORA در تمام مراحل زندگی ملک' 
              : 'CLADORA Accompanies the Property Through Every Life Phase'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Ciclul de viață al unei clădiri nu este o linie rigidă: mentenanța, închirierea, serviciile zilnice, schimbarea administratorilor și re-vânzarea au loc concomitent și ciclic. CLADORA păstrează firul roșu al identității și al evidențelor autorizate pe tot parcursul.'
              : lang === 'fa'
              ? 'چرخهٔ عمر ملک یک مسیر خطی و تک‌بُعدی نیست؛ بهره‌برداری، نگهداری فنی، اجاره، تغییر مدیر و معاملات مجدد می‌توانند هم‌زمان، تکرارشونده و در مراحل گوناگون رخ دهند. کلادورا پیوستگی سوابق مجاز را در تمامی این مراحل حفظ می‌کند.'
              : 'Property lifecycle is not a rigid linear conveyor: maintenance, tenancies, day-to-day services, managerial transitions, and resales happen concurrently and repeatedly across decades.'}
          </p>
        </div>

        {/* Interactive Step Navigator */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {steps.map((st, idx) => {
            const Icon = st.icon;
            const isCurrent = activeStep === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`p-3.5 rounded-2xl border text-start transition-all flex flex-col justify-between h-28 ${
                  isCurrent
                    ? 'bg-[#102A43] text-white border-[#102A43] shadow-md scale-[1.02]'
                    : 'bg-white text-[#334E68] border-[#E2E8F0] hover:border-[#0E9F8E] hover:bg-[#F0F4F8]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-extrabold ${isCurrent ? 'text-[#0E9F8E]' : 'text-[#627D98]'}`}>
                    {st.number}
                  </span>
                  <Icon className={`w-4 h-4 ${isCurrent ? 'text-[#14B8A6]' : 'text-[#627D98]'}`} />
                </div>
                <span className="text-xs font-bold line-clamp-2 leading-tight">
                  {st.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Stage Details Card */}
        {(() => {
          const current = steps[activeStep];
          const Icon = current.icon;
          return (
            <div className="card-proptech p-8 sm:p-10 bg-white border-[#D3DCE6] space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0F4F8] pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#0E9F8E]">
                        {lang === 'ro' ? `Etapa ${current.number}` : lang === 'fa' ? `مرحلهٔ ${current.number}` : `Stage ${current.number}`}
                      </span>
                      <span className="text-xs font-medium text-[#627D98] bg-[#F0F4F8] px-2.5 py-0.5 rounded-full">
                        {current.tag}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-[#102A43] mt-1">
                      {current.title}
                    </h3>
                  </div>
                </div>

                <Link
                  href={`/${lang}/lifecycle`}
                  className="text-xs font-bold text-[#0E9F8E] hover:text-[#0A7E71] flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>{lang === 'ro' ? 'Vezi ghidul ciclului de viață' : lang === 'fa' ? 'مشاهده توضیحات کامل چرخهٔ عمر' : 'Explore lifecycle details'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Description */}
              <p className="text-base text-[#334E68] leading-relaxed">
                {current.desc}
              </p>

              {/* Capabilities and Scope Boundary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#F0F4F8]">
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#627D98] block">
                    {lang === 'ro' ? 'Capabilități cheie în această etapă:' : lang === 'fa' ? 'قابلیت‌های کلیدی در این مرحله:' : 'Key capabilities at this stage:'}
                  </span>
                  <ul className="space-y-2 text-xs sm:text-sm text-[#334E68]">
                    {current.capabilities.map((cap, cIdx) => (
                      <li key={cIdx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-[#102A43] block">
                      {lang === 'ro' ? 'Delimitarea domeniului de responsabilitate' : lang === 'fa' ? 'حدود مسئولیت و دامنه محصول' : 'Bounded scope principle'}
                    </span>
                    <p className="text-xs text-[#52667A] leading-relaxed">
                      {current.scopeNote}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

      </div>
    </section>
  );
};
