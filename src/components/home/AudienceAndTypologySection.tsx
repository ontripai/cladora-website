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
      title: lang === 'ro' ? 'Dezvoltatori & Constructori' : lang === 'fa' ? 'سازندگان و شرکت‌های ساختمانی' : 'Builders & Developers',
      problem: lang === 'ro' ? 'Acte împrăștiate, liste de apartamente neactualizate și predarea haotică a cărții tehnice către noua asociație.' : lang === 'fa' ? 'پراکندگی پرونده‌ها، ناهماهنگی در قراردادهای پیش‌فروش و تحویل پردردسر مدارک به مدیر یا هیئت‌مدیره جدید.' : 'Scattered paperwork, out-of-date unit lists, and chaotic handovers to the new association.',
      solution: lang === 'ro' ? 'Organizarea digitală a apartamentelor încă din faza de proiect, urmărirea vânzărilor și predarea ordonată a documentelor către locatari.' : lang === 'fa' ? 'سازماندهی دیجیتال واحدها از فاز پروژه، ثبت قراردادهای پیش‌فروش و تحویل منظم اسناد و کلیدها به ساکنان.' : 'Digital unit registry from the project stage, sales tracking, and clean, orderly handovers to owners.',
      link: `/${lang}/solutions/developers`,
      icon: Building
    },
    {
      title: lang === 'ro' ? 'Proprietari de Locuințe, Spații sau Clădiri' : lang === 'fa' ? 'مالکان واحدهای مسکونی، تجاری یا اداری' : 'Owners of Residential, Commercial & Mixed Properties',
      problem: lang === 'ro' ? 'Timp pierdut pentru urmărirea chiriilor, verificarea cotelor de întreținere și a reparațiilor din imobile diferite.' : lang === 'fa' ? 'اتلاف وقت برای پیگیری پرداخت‌ها، بررسی شارژ و هزینه‌های تعمیرات در املاک گوناگون.' : 'Time lost tracking rent schedules, checking utility fees, and overseeing repairs across different properties.',
      solution: lang === 'ro' ? 'O privire de ansamblu asupra tuturor proprietăților deținute, evidența contractelor de închiriere și istoricul intervențiilor tehnice.' : lang === 'fa' ? 'نمای کلی و یکپارچه از تمام املاک، ساماندهی قراردادهای اجاره و ثبت منظم سوابق فنی و مالی.' : 'A clear overview across all your properties, tracking lease agreements, and maintaining an organized maintenance history.',
      link: `/${lang}/solutions/property-owners`,
      icon: TrendingUp
    },
    {
      title: lang === 'ro' ? 'Asociații de Proprietari & Comitete' : lang === 'fa' ? 'مدیران ساختمان و هیئت‌مدیره' : 'Homeowner Associations & Boards',
      problem: lang === 'ro' ? 'Discuții aprinse despre listele de plată, neîncredere între vecini și dificultatea de a aduna oamenii la ședințe.' : lang === 'fa' ? 'اختلاف‌نظر بر سر محاسبات شارژ، بی‌اعتمادی همسایگان و به حدنصاب نرسیدن جلسات ساختمان.' : 'Heated arguments over fee calculations, neighbor mistrust, and low turnout at general meetings.',
      solution: lang === 'ro' ? 'Calcul clar și verificabil pentru fiecare sumă de pe avizier, transparență în decizii și comunicare organizată cu toți membrii asociației.' : lang === 'fa' ? 'محاسبه شفاف و قابل بررسی مبالغ شارژ، مستندسازی تصمیمات و اطلاع‌رسانی منظم به مالکان و ساکنان.' : 'Clear and verifiable calculations for every fee breakdown, transparent record keeping, and organized communication with residents.',
      link: `/${lang}/solutions/associations`,
      icon: Building2
    },
    {
      title: lang === 'ro' ? 'Firme și Administratori Profesioniști' : lang === 'fa' ? 'مدیران حرفه‌ای و شرکت‌های مدیریت مجتمع' : 'Professional Property Managers',
      problem: lang === 'ro' ? 'Zile întregi pierdute la sfârșit de lună cu calcule manuale, chitanțe de hârtie și mesaje haotice de la zeci de locatari.' : lang === 'fa' ? 'اتلاف وقت فراوان در پایان ماه برای محاسبات دستی، صدور رسیدهای کاغذی و پاسخ‌گویی پراکنده به ساکنان.' : 'Endless hours spent each month-end doing manual calculations, paper receipts, and chasing tenant messages.',
      solution: lang === 'ro' ? 'Gestiunea mai multor asociații sau imobile dintr-un singur loc, evidența plăților încasate și transmiterea rapidă a comenzilor către echipele tehnice.' : lang === 'fa' ? 'مدیریت هم‌زمان چندین ساختمان یا مجتمع، ساماندهی دفاتر واریزی‌ها و ارجاع سریع دستورکارها به تیم‌های فنی.' : 'Managing multiple associations or properties in one portal, structured payment records, and fast dispatch of service orders to contractors.',
      link: `/${lang}/solutions/property-managers`,
      icon: Layers
    },
    {
      title: lang === 'ro' ? 'Locatari & Chiriași' : lang === 'fa' ? 'ساکنان و مستأجران' : 'Residents & Tenants',
      problem: lang === 'ro' ? 'Lipsa de claritate privind consumurile proprii, drumuri la avizier pentru plată și sesizări uitate când se strică ceva în bloc.' : lang === 'fa' ? 'ابهام در نحوه محاسبه آب و گاز، پرداخت حضوری شارژ و فراموش شدن پیگیری خرابی‌های مشاعات.' : 'Unclear utility bills, inconvenient paper payments, and reported maintenance issues that get forgotten.',
      solution: lang === 'ro' ? 'Vezi clar componența cotelor de întreținere și plățile înregistrate, accesezi anunțurile asociației și transmiți sesizări pentru problemele din clădire.' : lang === 'fa' ? 'مشاهدهٔ شفاف جزییات شارژ و وضعیت پرداخت‌ها، دسترسی به اعلانات ساختمان و ارسال گزارش خرابی برای پیگیری.' : 'Clearly see your fee breakdown and recorded payments, access community notices, and submit maintenance reports for building issues.',
      link: `/${lang}/solutions/residents`,
      icon: KeyRound
    },
    {
      title: lang === 'ro' ? 'Tehnicieni, Meșteri & Furnizori de Servicii' : lang === 'fa' ? 'تکنسین‌ها، پیمانکاران و تأمین‌کنندگان خدمات' : 'Technicians, Contractors & Service Providers',
      problem: lang === 'ro' ? 'Solicitări neclare, lipsa detaliilor despre echipamente sau locație și întârzieri la confirmarea lucrărilor executate.' : lang === 'fa' ? 'درخواست‌های مبهم، نبود مشخصات دستگاه یا محل دقیق، و معطلی در تأیید خدمات ارائه‌شده.' : 'Vague job descriptions, missing equipment specs or unit details, and delays in work confirmation.',
      solution: lang === 'ro' ? 'Comenzi scrise clar cu specificațiile echipamentului și locația exactă, devize aprobate înainte de intervenție și proces-verbal de recepție atașat la dosar.' : lang === 'fa' ? 'دریافت دستورکار با جزییات دستگاه و نشانی دقیق، توافق بر سر برآورد قیمت پیش از اعزام، و ثبت صورت‌جلسهٔ تحویل کار در پرونده.' : 'Clear work orders with equipment specifications and exact location, approved estimates before dispatch, and work completion protocols attached to records.',
      link: `/${lang}/solutions/service-providers`,
      icon: Wrench
    }
  ];

  const typologies = [
    {
      title: lang === 'ro' ? 'Blocuri de Locuințe & Ansambluri Rezidențiale' : lang === 'fa' ? 'آپارتمان‌ها و مجتمع‌های مسکونی' : 'Residential Buildings & Communities',
      desc: lang === 'ro' ? 'Asociații de proprietari, blocuri individuale, complexe cu mai multe scări și ansambluri de vile.' : lang === 'fa' ? 'ساختمان‌های مسکونی، برج‌ها، مجتمع‌های آپارتمانی و شهرک‌های ویلایی.' : 'Homeowner associations, apartment buildings, residential towers, and villa communities.',
      icon: Home,
      features: [
        lang === 'ro' ? 'Calculul structurat al cotelor de întreținere conform normelor asociației' : lang === 'fa' ? 'محاسبه مدون و شفاف سهم شارژ متناسب با آیین‌نامه و قواعد ساختمان' : 'Structured maintenance fee calculation aligned with association rules',
        lang === 'ro' ? 'Avizier digital și consultări ale vecinilor' : lang === 'fa' ? 'تابلوی اعلانات دیجیتال و نظرسنجی از مالکان' : 'Digital notice board and owner polling',
        lang === 'ro' ? 'Transmiterea ușoară a indexurilor la apă și căldură' : lang === 'fa' ? 'ثبت آسان ارقام کنتورهای آب و گاز' : 'Easy submission of water and heating meter readings'
      ]
    },
    {
      title: lang === 'ro' ? 'Clădiri de Birouri & Spații Comerciale' : lang === 'fa' ? 'برج‌های اداری و مراکز تجاری' : 'Commercial & Office Buildings',
      desc: lang === 'ro' ? 'Clădiri de birouri, centre de afaceri, magazine la parter și spații comerciale.' : lang === 'fa' ? 'ساختمان‌های اداری، مراکز خرید، پاساژها و دفاتر کار اشتراکی.' : 'Office buildings, business parks, ground-floor retail, and commercial centers.',
      features: [
        lang === 'ro' ? 'Evidența clară a cheltuielilor comune de funcționare' : lang === 'fa' ? 'تفکیک دقیق هزینه‌های مشاعات و نگهداری اداری' : 'Clear breakdown of shared operating expenses',
        lang === 'ro' ? 'Gestiunea contractelor de închiriere și a garanțiilor' : lang === 'fa' ? 'پایش قراردادهای اجاره تجاری و ضمانت‌ها' : 'Commercial lease and security deposit tracking',
        lang === 'ro' ? 'Acces organizat pentru firme și vizitatori' : lang === 'fa' ? 'کنترل منظم تردد مراجعان و پیمانکاران' : 'Organized visitor and contractor access'
      ]
    },
    {
      title: lang === 'ro' ? 'Hale, Depozite & Parcuri Industriale' : lang === 'fa' ? 'انبارها، سوله‌ها و شهرک‌های صنعتی' : 'Warehouses & Logistics Depots',
      desc: lang === 'ro' ? 'Spații de depozitare, centre de distribuție și hale pentru producție ușoară.' : lang === 'fa' ? 'انبارها، مراکز توزیع کالا و سوله‌های کارگاهی.' : 'Storage warehouses, distribution centers, and light industrial facilities.',
      icon: Factory,
      features: [
        lang === 'ro' ? 'Registrul utilajelor mari: rampe, transformatoare, pompe' : lang === 'fa' ? 'شناسنامه تجهیزات سنگین: ژنراتور، ترانس، سیستم تهویه' : 'Heavy equipment tracking: docks, generators, pump systems',
        lang === 'ro' ? 'Contorizare exactă pentru consumuri industriale mari' : lang === 'fa' ? 'پایش دقیق مصارف دیماند برق و کنتورهای صنعتی' : 'High-capacity industrial utility monitoring',
        lang === 'ro' ? 'Program strict de revizii pentru prevenirea opririlor' : lang === 'fa' ? 'برنامه منظم سرویس برای جلوگیری از توقف کار' : 'Preventative maintenance to prevent costly downtime'
      ]
    },
    {
      title: lang === 'ro' ? 'Proiecte Mixte (Locuințe, Magazine & Birouri)' : lang === 'fa' ? 'مجتمع‌های چندمنظوره و ترکیبی' : 'Mixed-Use Developments',
      desc: lang === 'ro' ? 'Clădiri moderne care combină apartamente la etaj, birouri și magazine la parter.' : lang === 'fa' ? 'پروژه‌های مدرن شامل واحدهای مسکونی، اداری، تجاری و پارکینگ مشترک.' : 'Modern developments combining residential apartments, offices, and street-level shops.',
      icon: Store,
      features: [
        lang === 'ro' ? 'Separarea cheltuielilor între zona comercială și cea de locuințe' : lang === 'fa' ? 'تسهیم دقیق و عادلانه هزینه‌ها بین بخش مسکونی و تجاری' : 'Fair expense separation between commercial and residential zones',
        lang === 'ro' ? 'Reguli diferite de acces pentru locatari și clienți' : lang === 'fa' ? 'مرزبندی تردد مشتریان و حفظ آرامش ساکنان' : 'Separate access rules for residents versus commercial visitors',
        lang === 'ro' ? 'Spații de lucru separate pentru fiecare componentă din complex' : lang === 'fa' ? 'فضاهای کاری مجزا برای مدیریت هر بخش از مجموعه' : 'Dedicated management spaces for each component'
      ]
    }
  ];

  return (
    <section className="py-20 bg-[#F6F9FC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Soluții pentru Oricine și Orice Clădire' : lang === 'fa' ? 'راهکارهای متناسب با نقش و نوع ساختمان' : 'Tailored Solutions for Every Property'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro'
              ? 'Adaptat pentru nevoile fiecărui rol și tip de clădire'
              : lang === 'fa'
              ? 'طراحی‌شده برای نیازهای واقعی ساکنان، مدیران و مالکان'
              : 'Built for Every Role & Every Building Type'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Fie că administrezi un bloc de locuințe, o clădire de birouri sau un spațiu comercial, CLADORA oferă instrumentele potrivite pentru fiecare persoană implicată, fără complicații inutile.'
              : lang === 'fa'
              ? 'چه یک آپارتمان مسکونی را اداره کنید و چه یک مجتمع اداری یا تجاری را، کلادورا ابزارهای کاربردی و ساده‌ای برای هر شخص فراهم می‌کند، بدون پیچیدگی‌های خسته‌کننده.'
              : 'Whether you manage a residential apartment block, an office building, or a commercial space, CLADORA gives every participant the right tools, without unnecessary friction.'}
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
              {lang === 'ro' ? 'După Rol' : lang === 'fa' ? 'بر اساس نقش شما' : 'By Role'}
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
              {lang === 'ro' ? 'După Tipul Clădirii' : lang === 'fa' ? 'بر اساس نوع ساختمان' : 'By Building Type'}
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
                      <span>{lang === 'ro' ? 'Vezi detalii' : lang === 'fa' ? 'مشاهده راهکار اختصاصی' : 'Explore solution'}</span>
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
            <span>{lang === 'ro' ? 'Află mai multe despre toate soluțiile CLADORA' : lang === 'fa' ? 'مشاهده تمام راهکارها و سناریوهای کاربردی' : 'Explore all CLADORA solutions and use cases'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </section>
  );
};
