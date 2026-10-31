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
      title: lang === 'ro' ? 'Pregătire Proiect & Pre-vânzare' : lang === 'fa' ? 'تعریف پروژه و پیش‌فروش' : 'Project Setup & Pre-Sales',
      tag: lang === 'ro' ? 'Înainte de finalizarea clădirii' : lang === 'fa' ? 'پیش از اتمام ساخت' : 'Before building completion',
      icon: Sparkles,
      desc: lang === 'ro'
        ? 'Evidența clară a apartamentelor, cotelor și spațiilor încă din faza de proiect. Înregistrarea rezervărilor, a antecontractelor și păstrarea într-un loc sigur a cărții tehnice și a planurilor clădirii.'
        : lang === 'fa'
        ? 'ثبت مشخصات واحدها، متراژها و مشاعات از ابتدای پروژه؛ مدیریت رزروها، پیش‌فروش و نگهداری امن نقشه‌ها و پرونده‌های فنی ساختمان.'
        : 'Clear registry of units, shares, and spaces from project inception. Tracking reservations, purchase agreements, and storing technical plans securely.',
      scopeNote: lang === 'ro'
        ? 'Notă: Programarea lucrărilor fizice pe șantier și execuția efectivă nu fac parte din platformă.'
        : lang === 'fa'
        ? 'توجه: زمان‌بندی عملیات اجرایی کارگاه ساختمانی و پیمانکاری عمرانی خارج از دامنه این سامانه است.'
        : 'Note: Physical construction work and on-site contractor scheduling are outside the platform’s scope.',
      capabilities: [
        lang === 'ro' ? 'Catalog digital al apartamentelor și cotelor-părți' : lang === 'fa' ? 'شناسنامه دیجیتال واحدها و سهم مشاعات' : 'Digital catalog of units and shared shares',
        lang === 'ro' ? 'Gestiunea rezervărilor și a antecontractelor' : lang === 'fa' ? 'مدیریت رزروها و قراردادهای اولیه' : 'Reservation and agreement management',
        lang === 'ro' ? 'Păstrarea în siguranță a dosarului tehnic' : lang === 'fa' ? 'بایگانی امن مدارک و نقشه‌های فنی' : 'Secure technical documentation storage'
      ]
    },
    {
      id: 'handover',
      number: '02',
      title: lang === 'ro' ? 'Predare-Primire & Verificare' : lang === 'fa' ? 'تحویل واحدها و رفع نواقص' : 'Handover & Defect Checklist',
      tag: lang === 'ro' ? 'Primirea cheilor și mutarea' : lang === 'fa' ? 'کلیدتحویل و صورت‌جلسه' : 'Key handover & move-in',
      icon: KeyRound,
      desc: lang === 'ro'
        ? 'Predarea organizată a apartamentelor și spațiilor comune. Se consemnează pe loc eventualele remedieri necesare (punch-list), indexurile inițiale ale contoarelor de apă și căldură și se creează conturile locatarilor.'
        : lang === 'fa'
        ? 'تحویل رسمی واحدها و فضاهای مشترک همراه با ثبت نقایص احتمالی برای رفع، ثبت ارقام اولیه کنتورها و فعال‌سازی دسترسی ساکنان جدید.'
        : 'Organized delivery of apartments and common areas. Log any defects needing resolution (punch-list), record baseline utility meters, and onboard residents.',
      scopeNote: lang === 'ro'
        ? 'Platforma continuă să fie utilă și după predare—ea devine baza de date pentru întreaga viață a blocului.'
        : lang === 'fa'
        ? 'خدمات سامانه با تحویل کلید پایان نمی‌یابد، بلکه پایهٔ اطلاعاتی برای ادارهٔ روزمره ساختمان خواهد شد.'
        : 'The platform continues well beyond handover, becoming the operational foundation for daily building life.',
      capabilities: [
        lang === 'ro' ? 'Proces-verbal digital de predare-primire' : lang === 'fa' ? 'صورت‌جلسه دیجیتال تحویل واحد و مشاعات' : 'Digital handover checklists and protocols',
        lang === 'ro' ? 'Lista clară a remedierilor de finalizat' : lang === 'fa' ? 'فهرست شفاف موارد باقیمانده برای اصلاح' : 'Track list of pending repairs and fixes',
        lang === 'ro' ? 'Înregistrarea indexurilor inițiale la contoare' : lang === 'fa' ? 'ثبت ارقام اولیه کنتورهای آب، برق و گاز' : 'Initial utility meter readings and account invites'
      ]
    },
    {
      id: 'operations',
      number: '03',
      title: lang === 'ro' ? 'Viața de Zi cu Zi & Administrare' : lang === 'fa' ? 'سکونت، شارژ و امور روزمره' : 'Daily Living & Building Operations',
      tag: lang === 'ro' ? 'Locuire și întreținere curentă' : lang === 'fa' ? 'زندگی و مدیریت جاری' : 'Everyday living and operations',
      icon: Home,
      desc: lang === 'ro'
        ? 'Evidența cotelor de întreținere, transmiterea indexurilor, avizier digital, comunicări pentru comunitate și consultări ale asociației—pentru o viață de zi cu zi organizată.'
        : lang === 'fa'
        ? 'ثبت هزینه‌های نگهداری و شارژ، ثبت ارقام کنتورها، تابلوی اعلانات، اطلاع‌رسانی به ساکنان و هماهنگی امور انجمن برای نظم بیشتر در زندگی روزمره.'
        : 'Clear maintenance fee breakdowns, meter reading logs, digital notice boards, resident communications, and community consultations for well-organized daily operations.',
      scopeNote: lang === 'ro'
        ? 'Fiecare vede doar ce îl privește: chiriașul nu vede datele private ale proprietarului, iar vecinii nu văd plățile confidențiale ale altora.'
        : lang === 'fa'
        ? 'هر شخص فقط اطلاعات مجاز خود را می‌بیند؛ مستأجر به امور محرمانه مالک دسترسی ندارد و اطلاعات مالی هر واحد محفوظ است.'
        : 'Strict privacy: tenants never see private owner ledgers, and neighbors cannot access confidential personal records.',
      capabilities: [
        lang === 'ro' ? 'Afișarea cotelor de întreținere și a situației plăților' : lang === 'fa' ? 'نمایش شفاف سهم شارژ و وضعیت پرداخت‌ها' : 'Clear breakdown of maintenance fees and payment status',
        lang === 'ro' ? 'Avizier digital și consultări ale asociației' : lang === 'fa' ? 'تابلوی اعلانات دیجیتال و نظرسنجی از ساکنان' : 'Digital notice board and community polling',
        lang === 'ro' ? 'Sesizări rapide pentru probleme curente' : lang === 'fa' ? 'ثبت سریع درخواست‌ها و گزارش مشکلات روزمره' : 'Quick issue reporting and daily requests'
      ]
    },
    {
      id: 'maintenance',
      number: '04',
      title: lang === 'ro' ? 'Revizii Tehnice & Reparații' : lang === 'fa' ? 'تعمیرات، نگهداری و سرویس‌های دوره‌ای' : 'Maintenance & Equipment Care',
      tag: lang === 'ro' ? 'Păstrarea stării tehnice bune' : lang === 'fa' ? 'سرویس منظم آسانسور و تأسیسات' : 'Routine checks & breakdown fixes',
      icon: Wrench,
      desc: lang === 'ro'
        ? 'Evidența echipamentelor comune (lifturi, pompe de apă, centrale termice), calendarul reviziilor obligatorii, trimiterea comenzilor către tehnicieni și păstrarea facturilor de reparații.'
        : lang === 'fa'
        ? 'شناسنامه تجهیزات ساختمان (آسانسور، موتورخانه، پمپ‌ها)، زمان‌بندی سرویس‌های دوره‌ای، صدور دستورکار برای تعمیرکاران و نگهداری فاکتورها.'
        : 'Tracking shared equipment (lifts, heating, booster pumps), scheduling mandatory inspections, dispatching work orders to technicians, and keeping repair invoices on file.',
      scopeNote: lang === 'ro'
        ? 'Istoricul intervențiilor ajută la planificarea întreținerii și la urmărirea stării echipamentelor.'
        : lang === 'fa'
        ? 'سابقهٔ سرویس‌ها به برنامه‌ریزی نگهداری و پیگیری وضعیت تجهیزات کمک می‌کند.'
        : 'Maintenance history helps plan upkeep and track equipment condition.',
      capabilities: [
        lang === 'ro' ? 'Registrul echipamentelor și reviziilor periodice' : lang === 'fa' ? 'شناسنامه تجهیزات و تاریخچه سرویس‌ها' : 'Equipment registry and scheduled maintenance log',
        lang === 'ro' ? 'Comenzi clare pentru tehnicieni și meșteri' : lang === 'fa' ? 'ارسال دستورکار و تأیید انجام کار توسط تعمیرکار' : 'Clear work orders and technician sign-offs',
        lang === 'ro' ? 'Istoric de costuri și devize aprobate' : lang === 'fa' ? 'سابقه هزینه‌ها و فاکتورهای تأییدشده' : 'Repair expense history and approved estimates'
      ]
    },
    {
      id: 'leasing',
      number: '05',
      title: lang === 'ro' ? 'Închiriere & Relația Proprietar-Chiriaș' : lang === 'fa' ? 'مدیریت اجاره و تفکیک هزینه‌ها' : 'Rentals & Tenant Management',
      tag: lang === 'ro' ? 'Venituri și cheltuieli separate' : lang === 'fa' ? 'ارتباط مالک و مستأجر' : 'Tenant & landlord clarity',
      icon: TrendingUp,
      desc: lang === 'ro'
        ? 'Evidența contractelor de închiriere, urmărirea distinctă a cheltuielilor de consum față de fondul de reparații și colaborarea organizată cu firmele de administrare.'
        : lang === 'fa'
        ? 'ثبت قراردادهای اجاره، پیگیری مجزای هزینه‌های مصرفی از سهم تعمیرات اساسی، و همکاری منظم با شرکت‌های مدیریت اجاره.'
        : 'Tracking lease agreements, keeping tenant utility dues distinct from capital reserve contributions, and organized collaboration with property managers.',
      scopeNote: lang === 'ro'
        ? 'Când pleacă un chiriaș, istoricul apartamentului rămâne intact, iar noul locatar pornește de la zero cu datele sale.'
        : lang === 'fa'
        ? 'با جابه‌جایی مستأجر، پیشینه و مصرف‌های گذشته ملک محفوظ می‌ماند و مستأجر جدید از نقطه مشخص آغاز می‌کند.'
        : 'When a tenant moves out, unit history stays intact and the incoming tenant begins with a clean personal slate.',
      capabilities: [
        lang === 'ro' ? 'Evidența contractelor și a predării cheilor la mutare' : lang === 'fa' ? 'ثبت قرارداد و صورت‌جلسه ورود و تخلیه مستأجر' : 'Lease registry and move-in/move-out checks',
        lang === 'ro' ? 'Evidența distinctă a cheltuielilor chiriașului și proprietarului' : lang === 'fa' ? 'ثبت جداگانهٔ هزینه‌های مستأجر و مالک' : 'Separate records of tenant and owner expenses',
        lang === 'ro' ? 'Acces delegat pentru firmele de administrare' : lang === 'fa' ? 'دسترسی مشخص برای مدیران املاک استیجاری' : 'Delegated access for rental management firms'
      ]
    },
    {
      id: 'succession',
      number: '06',
      title: lang === 'ro' ? 'Predare Imobil, Schimbare Rol sau Scoatere din Uz' : lang === 'fa' ? 'تحویل ملک، انتقال مدیریت و خروج تجهیزات از خدمت' : 'Property Handover, Role Succession & Decommissioning',
      tag: lang === 'ro' ? 'Documente organizate pentru o predare mai clară' : lang === 'fa' ? 'اسناد منظم برای تحویل روشن‌تر مسئولیت' : 'Organized records for a clearer handover',
      icon: RefreshCw,
      desc: lang === 'ro'
        ? 'La schimbarea conducerii, transferul unui imobil sau scoaterea din uz a unor spații și echipamente, documentele tehnice, istoricul intervențiilor și evidențele financiare sunt organizate pentru o predare clară și verificabilă către succesori.'
        : lang === 'fa'
        ? 'هنگام تغییر مدیریت، انتقال واحدها یا خروج فضاها و تجهیزات فرسوده از چرخه، سوابق فنی، تاریخچهٔ سرویس‌ها و دفاتر مالی برای تحویل منظم و شفاف به جانشینان مستند می‌شوند.'
        : 'When leadership changes, property or units are transferred, or spaces and equipment are decommissioned, technical records, maintenance history, and financial logs are organized for a clear, verifiable handover to successors.',
      scopeNote: lang === 'ro'
        ? 'Predare structurată a gestiunii, cu respectarea confidențialității pe bază de rol și a politicilor de păstrare a documentelor.'
        : lang === 'fa'
        ? 'تحویل ساختاریافتهٔ مسئولیت‌ها با رعایت تفکیک دسترسی‌ها و سیاست‌های نگهداری اسناد.'
        : 'Structured handover of management, respecting role-based privacy and document retention policies.',
      capabilities: [
        lang === 'ro' ? 'Dosar structurat pentru predarea către noul administrator sau proprietar' : lang === 'fa' ? 'پروندهٔ مدون برای تحویل به مدیر جدید یا مالک بعدی' : 'Structured handover documentation for new managers or owners',
        lang === 'ro' ? 'Scoaterea din uz a echipamentelor vechi și arhivarea intervențiilor' : lang === 'fa' ? 'ثبت سوابق خروج تجهیزات فرسوده از خدمت و بایگانی پیشینهٔ اقدامات' : 'Decommissioning records for retired equipment and archived logs',
        lang === 'ro' ? 'Închiderea clară a mandatelor precedente conform politicilor stabilite' : lang === 'fa' ? 'خاتمهٔ منظم دوره‌های مسئولیتی پیشین طبق اختیارات و سیاست‌های مصوب' : 'Clear transition of prior roles in accordance with established policy'
      ]
    }
  ];

  return (
    <section className="py-20 bg-[#F8FAFC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'De la Construcție la Viața de Zi cu Zi' : lang === 'fa' ? 'از آغاز ساخت تا زندگی روزمره' : 'From New Build to Everyday Living'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro'
              ? 'CLADORA este alături de tine în toate etapele clădirii'
              : lang === 'fa'
              ? 'همراهی CLADORA در تمام مراحل ساختمان'
              : 'CLADORA Supports Your Building at Every Stage'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Administrarea unei clădiri nu este un proces rigid: întreținerea curentă, închirierea, reparațiile neprevăzute sau schimbarea administratorilor se întâmplă continuu. CLADORA păstrează toate actele și plățile în ordine, de la primele chei până peste ani.'
              : lang === 'fa'
              ? 'مدیریت ساختمان یک مسیر ثابت نیست؛ نگهداری روزمره، اجاره واحدها، تعمیرات پیش‌بینی‌نشده یا تغییر مدیر به مرور زمان رخ می‌دهند. کلادورا تمام اسناد و هزینه‌ها را از زمان تحویل کلید تا سال‌های متمادی منظم نگه می‌دارد.'
              : 'Managing a building is not a rigid one-off process: ongoing maintenance, rentals, unexpected repairs, or management handovers happen continuously. CLADORA keeps every record and invoice in order, from initial handover through decades of operation.'}
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
                  href={`/${lang}/platform/lifecycle`}
                  className="text-xs font-bold text-[#0E9F8E] hover:text-[#0A7E71] flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>{lang === 'ro' ? 'Află mai multe despre etapele clădirii' : lang === 'fa' ? 'توضیحات بیشتر درباره مراحل ساختمان' : 'Learn more about building stages'}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
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
                    {lang === 'ro' ? 'Capabilități principale în această etapă:' : lang === 'fa' ? 'امکانات کلیدی در این مرحله:' : 'Key capabilities at this stage:'}
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
