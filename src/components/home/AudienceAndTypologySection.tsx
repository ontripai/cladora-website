'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building, 
  TrendingUp, 
  Building2, 
  Layers, 
  KeyRound, 
  Wrench, 
  Scale, 
  ArrowRight, 
  CheckCircle2,
  Store,
  Factory,
  Home
} from 'lucide-react';

interface AudienceAndTypologySectionProps {
  lang: Language;
}

export const AudienceAndTypologySection: React.FC<AudienceAndTypologySectionProps> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<'audiences' | 'typologies'>('audiences');

  const audiences = [
    {
      title: lang === 'ro' ? 'Dezvoltatori & Constructori' : lang === 'fa' ? 'سازندگان و توسعه‌دهندگان' : 'Builders & Developers',
      problem: lang === 'ro' ? 'Fragmentarea datelor între vânzări, contracte și procesul greoi de predare către asociație.' : lang === 'fa' ? 'پراکندگی اطلاعات خریداران، عدم انسجام مدارک فنی و اصطکاک در تحویل رسمی واحدها.' : 'Disjointed pre-sales records, lost technical manuals, and chaotic handover friction.',
      solution: lang === 'ro' ? 'Identitate digitală din stadiul de proiect, antecontracte în AIRPROP și predare formală fără pierdere de date.' : lang === 'fa' ? 'تعریف هویت ملک پیش از تکمیل، اتصال پیش‌فروش به قراردادها و تحویل سیستماتیک با بایگانی مستندات.' : 'Digital property identity from project phase, pre-sales tracking, and clean verified handover.',
      link: `/${lang}/solutions#developers`,
      icon: Building
    },
    {
      title: lang === 'ro' ? 'Proprietari & Portofolii' : lang === 'fa' ? 'مالکان و صاحبان سبد املاک' : 'Owners & Portfolio Landlords',
      problem: lang === 'ro' ? 'Dificultatea de a monitoriza chirii, cote și reparații din mai multe blocuri diferite.' : lang === 'fa' ? 'عدم امکان پایش یکپارچه املاک متعدد در ساختمان‌های مختلف و تفکیک مبهم هزینه‌ها.' : 'Scattered accounting, manual rent chasing across multiple buildings, and obscure expenses.',
      solution: lang === 'ro' ? 'Tablou de bord consolidat pentru toate unitățile deținute, fluxuri de încasare și istoric pe termen lung.' : lang === 'fa' ? 'داشبورد متمرکز املاک در پروژه‌های مختلف، کنترل وصول اجاره و نظارت بر حفظ ارزش دارایی.' : 'Consolidated multi-property overview, automated rental receivables, and capital preservation.',
      link: `/${lang}/solutions/property-owners`,
      icon: TrendingUp
    },
    {
      title: lang === 'ro' ? 'Asociații & Comitete' : lang === 'fa' ? 'مدیران ساختمان و انجمن‌های مالکان' : 'HOAs & Residential Boards',
      problem: lang === 'ro' ? 'Dispute legate de cotele de întreținere, neîncredere între vecini și adunări generale greu de organizat.' : lang === 'fa' ? 'ابهام در محاسبات شارژ ماهانه، بی‌اعتمادی ساکنان و دشواری برگزاری جلسات و رأی‌گیری.' : 'Disputes over monthly payment lists, opacity, and poorly attended general meetings.',
      solution: lang === 'ro' ? 'Calcul matematic explicabil al fiecărei cote, avizier transparent și convocare adunări cu vot auditat.' : lang === 'fa' ? 'تسهیم کاملاً مستند و فرمول‌محور هزینه‌ها، شفافیت مالی و برگزاری مجامع با رأی‌گیری قانونی.' : 'Explainable mathematical charges, transparent digital notice boards, and auditable ballots.',
      link: `/${lang}/solutions/associations`,
      icon: Building2
    },
    {
      title: lang === 'ro' ? 'Companii de Administrare' : lang === 'fa' ? 'مدیران مجتمع و شرکت‌های مدیریت' : 'Property & Estate Managers',
      problem: lang === 'ro' ? 'Volum mare de muncă la sfârșit de lună, reconcilieri bancare manuale și furnizori greu de coordonat.' : lang === 'fa' ? 'فرآیندهای زمان‌بر بستن ماهانه حساب‌ها، تطبیق دستی بانک‌ها و اصطکاک با پیمانکاران فنی.' : 'Exhausting monthly closing marathons, manual bank reconciliations, and vendor chaos.',
      solution: lang === 'ro' ? 'Gestiune multi-clădire într-un singur cont, reconciliere bancară asistată și emitere automată a comenzilor de lucru.' : lang === 'fa' ? 'مدیریت متمرکز چند مجتمع، تطبیق هوشمند بانکی بدون مغایرت و ارجاع خودکار دستورکارهای نگهداری.' : 'Batch multi-property workflows, assisted bank matching, and unified maintenance SLAs.',
      link: `/${lang}/solutions/property-managers`,
      icon: Layers
    },
    {
      title: lang === 'ro' ? 'Chiriași & Rezidenți' : lang === 'fa' ? 'مستأجران و بهره‌برداران' : 'Tenants & Occupants',
      problem: lang === 'ro' ? 'Lipsa de claritate asupra consumurilor proprii și proceduri greoaie pentru raportarea unei avarii.' : lang === 'fa' ? 'ابهام در تفکیک مصارف شخصی و نبود راه ارتباطی سریع برای اعلام خرابی‌ها.' : 'Lack of insight into personal consumption costs and tedious channels for reporting faults.',
      solution: lang === 'ro' ? 'Acces strict la consumurile de utilități proprii, plăți simple și semnalare rapidă a solicitărilor tehnice.' : lang === 'fa' ? 'شفافیت در فیش مصرف انشعابات، پرداخت آسان و ثبت سریع درخواست رفع نقص با پیگیری وضعیت.' : 'Direct meter consumption history, simple payments, and fast ticket dispatch.',
      link: `/${lang}/solutions/tenants`,
      icon: KeyRound
    },
    {
      title: lang === 'ro' ? 'Furnizori de Servicii' : lang === 'fa' ? 'ارائه‌دهندگان خدمات و تیم‌های فنی' : 'Service Providers & Vendors',
      problem: lang === 'ro' ? 'Comenzi primite informal pe WhatsApp, termene neclare și întârzieri la aprobarea devizelor.' : lang === 'fa' ? 'ارجاع غیررسمی کارها، نبود مستندات شفاف از مشخصات فضا و تأخیر در تأیید و تسویه‌حساب.' : 'Informal chat orders, missing asset specs, and disputes over invoice approvals.',
      solution: lang === 'ro' ? 'Comenzi de lucru structurate cu fișa tehnică a activului, ofertare clară și recepție semnată digital.' : lang === 'fa' ? 'دریافت دستورکار با مشخصات کامل محل و دستگاه، ثبت پیشنهاد، ثبت انجام کار و پذیرش رسمی.' : 'Structured work orders, clear quote acceptance, and digital sign-off attached to assets.',
      link: `/${lang}/solutions#providers`,
      icon: Wrench
    }
  ];

  const typologies = [
    {
      title: lang === 'ro' ? 'Rezidențial (Blocuri & Vile)' : lang === 'fa' ? 'مسکونی (آپارتمان‌ها و شهرک‌ها)' : 'Residential (Condos & Villas)',
      desc: lang === 'ro' ? 'Asociații de proprietari, ansambluri rezidențiale, comunități închise și portofolii de locuințe.' : lang === 'fa' ? 'مجتمع‌های آپارتمانی، شهرک‌های ویلایی، انجمن‌های مالکان و سبد آپارتمان‌های اجاره‌ای.' : 'Condominiums, villa communities, homeowner boards, and single/multi-unit residential portfolios.',
      icon: Home,
      features: [
        lang === 'ro' ? 'Repartizare conform legii și cotelor de proprietate' : lang === 'fa' ? 'تسهیم بر اساس متراژ، نفرات و مصرف' : 'Statutory & quota cost sharing',
        lang === 'ro' ? 'Avizier digital și adunări de proprietari' : lang === 'fa' ? 'تابلو اعلانات و مجامع عمومی' : 'Digital notice board & owner meetings',
        lang === 'ro' ? 'Citire asistată a contoarelor de utilități' : lang === 'fa' ? 'ثبت و راستی‌آزمایی کنتورها' : 'Assisted utility meter readings'
      ]
    },
    {
      title: lang === 'ro' ? 'Comercial & Birouri' : lang === 'fa' ? 'تجاری و مراکز اداری' : 'Commercial & Business Centers',
      desc: lang === 'ro' ? 'Clădiri de birouri, centre comerciale, spații de retail și parcuri de afaceri.' : lang === 'fa' ? 'برج‌های اداری، مراکز خرید، پاساژها و مجتمع‌های تجاری.' : 'Office towers, retail malls, business centers, and co-working spaces.',
      features: [
        lang === 'ro' ? 'Separare riguroasă a cheltuielilor operaționale (OPEX)' : lang === 'fa' ? 'تفکیک دقیق هزینه‌های مشاعات اداری و اختصاصی' : 'Strict OPEX allocations',
        lang === 'ro' ? 'Contracte comerciale cu termene și garanții' : lang === 'fa' ? 'پایش قراردادهای اجاره تجاری و ضمانت‌ها' : 'Commercial lease agreements & guarantees',
        lang === 'ro' ? 'Control acces vizitatori și furnizori autorizați' : lang === 'fa' ? 'ثبت تردد مراجعان و پیمانکاران' : 'Visitor credentials & contractor gate pass'
      ]
    },
    {
      title: lang === 'ro' ? 'Logistic & Industrial' : lang === 'fa' ? 'لجستیک، انبارها و پارک‌های صنعتی' : 'Logistics & Industrial Parks',
      desc: lang === 'ro' ? 'Hale de depozitare, parcuri logistice și facilități de producție ușoară.' : lang === 'fa' ? 'انبارها، سوله‌های لجستیکی و شهرک‌های صنعتی.' : 'Warehouses, logistics depots, distribution hubs, and light industrial estates.',
      icon: Factory,
      features: [
        lang === 'ro' ? 'Registru de active mari: rampe, transformatoare, HVAC' : lang === 'fa' ? 'شناسنامه تجهیزات سنگین: ترانس، پمپ، دیزل‌ژنراتور' : 'Heavy equipment assets & substations',
        lang === 'ro' ? 'Contorizare de mare capacitate și putere' : lang === 'fa' ? 'پایش دیماند برق و کنتورهای صنعتی' : 'Industrial utility & power metering',
        lang === 'ro' ? 'Planuri preventive stricte pentru prevenirea opririlor' : lang === 'fa' ? 'نگهداری پیشگیرانه برای جلوگیری از توقف عملیات' : 'Preventative zero-downtime maintenance'
      ]
    },
    {
      title: lang === 'ro' ? 'Ansambluri Mixte' : lang === 'fa' ? 'مجتمع‌های چندمنظوره و مختلط' : 'Mixed-Use Developments',
      desc: lang === 'ro' ? 'Proiecte integrate combinând locuințe, galerii comerciale și birouri.' : lang === 'fa' ? 'پروژه‌های ترکیبی متشکل از بخش‌های مسکونی، تجاری، اداری و پارکینگ عمومی.' : 'Integrated ecosystems blending apartments, retail galleries, offices, and public parking.',
      icon: Store,
      features: [
        lang === 'ro' ? 'Trepte multiple de alocare: zonale și comune' : lang === 'fa' ? 'فرمول‌های چندسطحی تسهیم بر اساس زون‌ها' : 'Multi-tier zone allocation rules',
        lang === 'ro' ? 'Zone de acces diferențiate pentru rezidenți și public' : lang === 'fa' ? 'مرزبندی تردد عمومی و ساکنان خصوصی' : 'Differentiated access tiers',
        lang === 'ro' ? 'Workspace-uri multiple conectate la aceeași clădire' : lang === 'fa' ? 'چندین Workspace مجزا برای بخش‌های مختلف' : 'Multiple workspaces on one physical estate'
      ]
    }
  ];

  return (
    <section className="py-20 bg-[#F6F9FC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Adaptabilitate la Scenarii Reale' : lang === 'fa' ? 'پاسخ به نیازهای واقعی مخاطبان' : 'Real-World Adaptability'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Construit pentru toți actorii și toate tipurile de proprietate' 
              : lang === 'fa' 
              ? 'پوشش جامع مخاطبان و انواع محیط‌های ملکی' 
              : 'Built for Every Stakeholder & Every Property Typology'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'CLADORA nu forțează o clădire de birouri sau un parc industrial în tiparul unui apartament. Fiecare profil beneficiază de instrumente adaptate contextului său legal și operațional.'
              : lang === 'fa'
              ? 'کلادورا کاربردها را به یک آپارتمان مسکونی محدود نمی‌کند؛ بلکه برای هر نقش و هر نوع ملک، معماری متناسب و کارآمدی فراهم می‌آورد.'
              : 'CLADORA never forces a logistics park or mixed-use estate into a generic condo template. Workspaces adapt to the exact legal mandate and physical profile.'}
          </p>

          {/* Toggle Tab */}
          <div className="inline-flex p-1 bg-white rounded-2xl border border-[#CBD5E1] shadow-2xs mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('audiences')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'audiences'
                  ? 'bg-[#102A43] text-white shadow-2xs'
                  : 'text-[#627D98] hover:text-[#102A43]'
              }`}
            >
              {lang === 'ro' ? 'După Rol & Actori' : lang === 'fa' ? 'بر اساس مخاطبان و نقش‌ها' : 'By Stakeholder Role'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('typologies')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'typologies'
                  ? 'bg-[#102A43] text-white shadow-2xs'
                  : 'text-[#627D98] hover:text-[#102A43]'
              }`}
            >
              {lang === 'ro' ? 'După Tipul de Proprietate' : lang === 'fa' ? 'بر اساس نوع محیط و ملک' : 'By Property Typology'}
            </button>
          </div>
        </div>

        {/* Tab 1: Audiences */}
        {activeTab === 'audiences' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {audiences.map((aud, idx) => {
              const Icon = aud.icon;
              return (
                <div 
                  key={idx}
                  className="card-proptech p-6 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-[#0E9F8E] transition-all group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                        {aud.title}
                      </h3>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-bold text-[#627D98] block mb-0.5">
                          {lang === 'ro' ? 'Problema curentă:' : lang === 'fa' ? 'چالش موجود:' : 'Core challenge:'}
                        </span>
                        <p className="text-[#52667A] leading-relaxed">
                          {aud.problem}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#F0F4F8]">
                        <span className="font-bold text-[#0E9F8E] block mb-0.5">
                          {lang === 'ro' ? 'Soluția CLADORA:' : lang === 'fa' ? 'راهکار کلادورا:' : 'CLADORA solution:'}
                        </span>
                        <p className="text-[#334E68] leading-relaxed">
                          {aud.solution}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#F0F4F8]">
                    <Link
                      href={aud.link}
                      className="text-xs font-bold text-[#0E9F8E] hover:text-[#0A7E71] flex items-center justify-between"
                    >
                      <span>{lang === 'ro' ? 'Vezi fluxul dedicat' : lang === 'fa' ? 'مشاهده مسیر اختصاصی' : 'Explore workflow'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Typologies */}
        {activeTab === 'typologies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {typologies.map((typ, idx) => {
              const Icon = typ.icon || Building;
              return (
                <div 
                  key={idx}
                  className="card-proptech p-7 bg-white border-[#E2E8F0] space-y-4 hover:border-[#0E9F8E] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#102A43]">
                        {typ.title}
                      </h3>
                      <p className="text-xs text-[#627D98]">
                        {typ.desc}
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-[#334E68] pt-3 border-t border-[#F0F4F8]">
                    {typ.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Banner */}
        <div className="mt-12 text-center">
          <Link
            href={`/${lang}/solutions`}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#0E9F8E] hover:text-[#0A7E71]"
          >
            <span>{lang === 'ro' ? 'Explorează matricea completă a soluțiilor și scenariilor' : lang === 'fa' ? 'مشاهده ماتریس جامع راهکارها و سناریوهای استقرار' : 'Explore comprehensive solutions and deployment matrix'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </section>
  );
};
