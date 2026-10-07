import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
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
  ShieldCheck, 
  Store, 
  Factory, 
  Home,
  UserCheck
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
  return getRouteMetadata('/solutions', params.lang);
}

export default async function SolutionsHubPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const stakeholders = [
    {
      id: 'developers',
      title: lang === 'ro' ? 'Dezvoltatori & Constructori Imobiliari' : lang === 'fa' ? 'سازندگان و عرضه‌کنندگان ملک' : 'Real Estate Developers & Builders',
      desc: lang === 'ro'
        ? 'Stabilește identitatea digitală a clădirii încă din faza de proiect. Gestionează antecontractele în AIRPROP, organizează seiful tehnic și predă unitățile către cumpărători fără litigii.'
        : lang === 'fa'
        ? 'ثبت هویت پروژه از فاز اولیه، مدیریت پیش‌فروش و قراردادها در AIRPROP، ایجاد بایگانی امن نقشه‌ها و صورت‌جلسات، و تحویل روان واحدها به خریداران بدون اصطکاک.'
        : 'Establish digital property identity early, track pre-sales in AIRPROP, secure blueprints, and deliver units via structured handover.',
      linkText: lang === 'ro' ? 'Solicită soluție dezvoltatori' : lang === 'fa' ? 'درخواست راهکار سازندگان' : 'Developer solutions',
      href: `/${lang}/contact`,
      icon: Building
    },
    {
      id: 'owners',
      title: lang === 'ro' ? 'Proprietari & Deținători de Portofoliu' : lang === 'fa' ? 'مالکان و صاحبان سبد املاک' : 'Property Owners & Portfolio Landlords',
      desc: lang === 'ro'
        ? 'Monitorizează chirii, cheltuieli de întreținere și randamente nete pentru mai multe unități situate în blocuri diferite, dintr-un singur ecran securizat.'
        : lang === 'fa'
        ? 'پایش متمرکز واحدها و املاک در مجتمع‌های مختلف، کنترل وصول اجاره‌بها، تفکیک خودکار هزینه‌ها و نظارت بر حفظ و ارتقای ارزش دارایی.'
        : 'Consolidated performance overview across units in multiple buildings, rental tracking, and capital maintenance.',
      linkText: lang === 'ro' ? 'Vezi soluția pentru proprietari' : lang === 'fa' ? 'مشاهده راهکار مالکان' : 'View owner solutions',
      href: `/${lang}/solutions/property-owners`,
      icon: TrendingUp
    },
    {
      id: 'associations',
      title: lang === 'ro' ? 'Asociații de Proprietari & Comitete' : lang === 'fa' ? 'مدیران ساختمان و انجمن‌های مالکان' : 'HOAs & Residential Boards',
      desc: lang === 'ro'
        ? 'Conformitate legală impecabilă, cote de întreținere calculate matematic, avizier digital transparent, adunări generale cu vot auditat și reconciliere bancară completă.'
        : lang === 'fa'
        ? 'تسهیم کاملاً مستند و فرمول‌محور هزینه‌های ماهانه، تطبیق تراکنش‌های بانکی، شفافیت کامل برای ساکنان، و برگزاری مجامع با رأی‌گیری رسمی.'
        : 'Statutory compliance, explainable mathematical charges, transparent digital notice boards, and auditable general meeting votes.',
      linkText: lang === 'ro' ? 'Vezi soluția pentru asociații' : lang === 'fa' ? 'مشاهده راهکار انجمن‌ها' : 'View HOA solutions',
      href: `/${lang}/solutions/associations`,
      icon: Building2
    },
    {
      id: 'managers',
      title: lang === 'ro' ? 'Companii de Administrare & Facility' : lang === 'fa' ? 'مدیران مجتمع و شرکت‌های مدیریت املاک' : 'Property & Estate Management Firms',
      desc: lang === 'ro'
        ? 'Închidere centralizată a lunii pentru sute de clădiri, dispecerizarea comenzilor de lucru către furnizori acreditați și controlul respectării contractelor SLA.'
        : lang === 'fa'
        ? 'مدیریت متمرکز چندین مجتمع مسکونی یا اداری، بستن دسته‌ای دوره‌ها، صدور دستورکارهای فنی به پیمانکاران و پایش رعایت تعهدات زمانی و کیفی.'
        : 'Multi-building batch close workflows, contractor work order dispatching, and contractual maintenance SLA monitoring.',
      linkText: lang === 'ro' ? 'Vezi soluția pentru administratori' : lang === 'fa' ? 'مشاهده راهکار شرکت‌های مدیریت' : 'View manager solutions',
      href: `/${lang}/solutions/property-managers`,
      icon: Layers
    },
    {
      id: 'tenants',
      title: lang === 'ro' ? 'Chiriași & Rezidenți' : lang === 'fa' ? 'مستأجران و بهره‌برداران' : 'Tenants & Occupants',
      desc: lang === 'ro'
        ? 'Transparență totală asupra propriilor consumuri de apă și utilități, plăți rapide și semnalarea facilă a avariilor direct către echipa de intervenție.'
        : lang === 'fa'
        ? 'مشاهده شفاف مصارف و فیش هزینه‌های دوره خود، پرداخت آنلاین و اعلام سریع خرابی‌ها با امکان پیگیری زنده تا زمان رفع کامل نقص.'
        : 'Personal consumption transparency, direct utility statements, easy online payments, and instant maintenance fault ticketing.',
      linkText: lang === 'ro' ? 'Vezi portalul chiriașilor' : lang === 'fa' ? 'مشاهده پرتال مستأجران' : 'View tenant portal',
      href: `/${lang}/solutions/tenants`,
      icon: KeyRound
    },
    {
      id: 'providers',
      title: lang === 'ro' ? 'Furnizori de Servicii & Echipe Tehnice' : lang === 'fa' ? 'ارائه‌دهندگان خدمات و تیم‌های فنی' : 'Service Providers & Vendors',
      desc: lang === 'ro'
        ? 'Primirea comenzilor de lucru direct în aplicație, transmiterea devizelor transparente, executarea lucrărilor cu dovezi fotografice și recepție semnată.'
        : lang === 'fa'
        ? 'دریافت دستورکار با مشخصات دقیق محل و دستگاه، ثبت پیشنهاد شفاف قیمت، ثبت اتمام کار همراه با عکس و اخذ صورت‌جلسه تاییدیه پذیرش.'
        : 'Structured dispatch orders, transparent quotes, photographic execution logs, and signed digital acceptance sign-offs.',
      linkText: lang === 'ro' ? 'Alătură-te ca furnizor' : lang === 'fa' ? 'همکاری به عنوان ارائه‌دهنده خدمت' : 'Join as service provider',
      href: `/${lang}/contact`,
      icon: Wrench
    }
  ];

  const propertyTypes = [
    {
      title: lang === 'ro' ? 'Mediu Rezidențial' : lang === 'fa' ? 'املاک و مجتمع‌های مسکونی' : 'Residential Environments',
      desc: lang === 'ro' ? 'Condominii, blocuri urbane, comunități de vile și ansambluri rezidențiale de mare anvergură.' : lang === 'fa' ? 'آپارتمان‌ها، برج‌های مسکونی، شهرک‌های ویلایی و انبوه‌سازی‌های شهری.' : 'Condominiums, apartment blocks, gated villa communities, and large estates.',
      features: [
        lang === 'ro' ? 'Calcul cote conform suprafeței și numărului de persoane' : lang === 'fa' ? 'محاسبه سهم شارژ بر اساس متراژ و نفرات' : 'Area & occupant-count quota allocations',
        lang === 'ro' ? 'Citire asistată foto a contoarelor de apă' : lang === 'fa' ? 'ثبت و راستی‌آزمایی ارقام کنتورها' : 'Assisted meter readings validation',
        lang === 'ro' ? 'Avizier digital și transparență conformă' : lang === 'fa' ? 'تابلو اعلانات دیجیتال و آرای قانونی' : 'Digital statutory notice board'
      ],
      icon: Home
    },
    {
      title: lang === 'ro' ? 'Comercial & Birouri' : lang === 'fa' ? 'املاک تجاری و مراکز اداری' : 'Commercial & Office Towers',
      desc: lang === 'ro' ? 'Centre de afaceri, galerii comerciale, mall-uri și spații de retail.' : lang === 'fa' ? 'برج‌های اداری، مراکز تجاری، پاساژها و مجتمع‌های بازرگانی.' : 'Office towers, retail centres, malls, and business parks.',
      features: [
        lang === 'ro' ? 'Alocare precisă a cheltuielilor operaționale (OPEX)' : lang === 'fa' ? 'تسهیم دقیق هزینه‌های مشاعات اداری (OPEX)' : 'Precise OPEX and utility reconciliation',
        lang === 'ro' ? 'Gestiune contracte de închiriere comercială' : lang === 'fa' ? 'مدیریت قراردادهای اجاره تجاری و ضمانت‌ها' : 'Commercial lease agreements & guarantees',
        lang === 'ro' ? 'Control acces vizitatori și furnizori' : lang === 'fa' ? 'مدیریت تردد مراجعان و پیمانکاران' : 'Visitor gate credentials & logs'
      ],
      icon: Store
    },
    {
      title: lang === 'ro' ? 'Logistic & Industrial' : lang === 'fa' ? 'لجستیک، انبارها و پارک‌های صنعتی' : 'Logistics & Industrial Parks',
      desc: lang === 'ro' ? 'Parcuri industriale, hale de depozitare și centre de distribuție.' : lang === 'fa' ? 'شهرک‌های صنعتی، سوله‌های انبارداری و مراکز پخش لجستیک.' : 'Warehouses, distribution hubs, and light industrial estates.',
      features: [
        lang === 'ro' ? 'Registru de active mari (transformatoare, rampe)' : lang === 'fa' ? 'شناسنامه تجهیزات سنگین و تأسیسات زیربنایی' : 'Heavy equipment & substation logs',
        lang === 'ro' ? 'Contorizare putere și utilități industriale' : lang === 'fa' ? 'پایش کنتورها و دیماند مصرف صنعتی' : 'Industrial power & utility metering',
        lang === 'ro' ? 'Planuri preventive pentru zero opriri accidentale' : lang === 'fa' ? 'نگهداری پیشگیرانه بدون وقفه در تولید' : 'Zero-downtime preventative scheduling'
      ],
      icon: Factory
    },
    {
      title: lang === 'ro' ? 'Ansambluri Mixte' : lang === 'fa' ? 'پروژه‌های چندمنظوره و مختلط' : 'Mixed-Use Ecosystems',
      desc: lang === 'ro' ? 'Complexe integrate combinând locuințe, birouri, retail și parcări publice.' : lang === 'fa' ? 'پروژه‌های کلان ترکیبی متشکل از بخش‌های مسکونی، تجاری، اداری و رفاهی.' : 'Integrated complexes blending apartments, retail, offices, and public facilities.',
      features: [
        lang === 'ro' ? 'Reguli de repartizare zonale multi-nivel' : lang === 'fa' ? 'فرمول‌های تسهیم چندسطحی بر اساس کاربری' : 'Multi-level zone allocation rules',
        lang === 'ro' ? 'Workspace-uri multiple pe aceeași entitate fizică' : lang === 'fa' ? 'چندین Workspace مجزا برای بخش‌های مختلف' : 'Multiple workspaces on one property',
        lang === 'ro' ? 'Securitate contextuală fără amestec de date' : lang === 'fa' ? 'مرزبندی کامل دسترسی بدون تداخل داده‌ها' : 'Strict contextual security isolation'
      ],
      icon: Building
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
            {lang === 'ro' ? 'Soluții' : lang === 'fa' ? 'راهکارها' : 'Solutions'}
          </span>
        </div>

        {/* Hero Section */}
        <div className="max-w-4xl space-y-4">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Matricea Completă CLADORA' : lang === 'fa' ? 'ماتریس جامع راهکارهای تخصصی' : 'Tailored Solutions Matrix'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Soluții Adaptate pe Roluri & Tipuri de Proprietate' 
              : lang === 'fa' 
              ? 'راهکارهای تخصصی بر اساس نقش مخاطب و نوع ملک' 
              : 'Solutions Tailored by Stakeholder & Property Typology'}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Fiecare actor are responsabilități diferite, iar fiecare tip de clădire are o dinamică operațională specifică. Descoperă instrumentele calibrate pentru nevoile tale exacte.'
              : lang === 'fa'
              ? 'هر ذی‌نفع مسئولیت‌ها و نیازهای متفاوتی دارد و هر نوع ملک نیازمند پویایی عملیاتی خاص خود است. در این بخش راهکار متناسب با نقش و نوع دارایی خود را بررسی کنید.'
              : 'Different stakeholders have distinct responsibilities, and different properties exhibit unique operational dynamics. Explore calibrated workflows built for your scenario.'}
          </p>
        </div>

        {/* Section 1: By Stakeholder */}
        <div className="space-y-8">
          <div className="border-b border-[#E2E8F0] pb-4">
            <h2 className="text-2xl font-bold text-[#102A43]">
              {lang === 'ro' ? 'Soluții pe Roluri & Actori Cheie' : lang === 'fa' ? 'راهکارها بر اساس نقش و جایگاه مخاطب' : 'Solutions by Stakeholder Role'}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] mt-1">
              {lang === 'ro' ? 'Fluxuri optimizate pentru dezvoltatori, proprietari, comitete, administratori și chiriași' : lang === 'fa' ? 'جریان‌های کاری بهینه‌شده برای سازندگان، مالکان، مدیران، مستأجران و پیمانکاران' : 'Calibrated experiences from acquisition to daily living'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {stakeholders.map((stk, idx) => {
              const Icon = stk.icon;
              return (
                <div 
                  key={idx}
                  id={stk.id}
                  className="card-proptech p-7 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-[#0E9F8E] transition-all"
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-[#102A43]">
                      {stk.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                      {stk.desc}
                    </p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-[#F0F4F8]">
                    <Link
                      href={stk.href}
                      className="text-xs font-bold text-[#0E9F8E] hover:text-[#0A7E71] flex items-center justify-between"
                    >
                      <span>{stk.linkText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: By Property Typology */}
        <div className="space-y-8 pt-8 border-t border-[#E2E8F0]">
          <div className="border-b border-[#E2E8F0] pb-4">
            <h2 className="text-2xl font-bold text-[#102A43]">
              {lang === 'ro' ? 'Soluții pe Tipuri de Proprietate' : lang === 'fa' ? 'راهکارها بر اساس نوع محیط و ملک' : 'Solutions by Property Typology'}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] mt-1">
              {lang === 'ro' ? 'Infrastructură flexibilă adaptată cerințelor rezidențiale, comerciale sau industriale' : lang === 'fa' ? 'زیرساخت منعطف منطبق با ویژگی‌های املاک مسکونی، اداری، تجاری و صنعتی' : 'Adaptable operating engines for any physical environment'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {propertyTypes.map((pt, idx) => {
              const Icon = pt.icon;
              return (
                <div 
                  key={idx}
                  className="card-proptech p-8 bg-white border-[#E2E8F0] space-y-4 hover:border-[#0E9F8E] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#102A43]">
                        {pt.title}
                      </h3>
                      <p className="text-xs text-[#627D98]">
                        {pt.desc}
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs sm:text-sm text-[#334E68] pt-3 border-t border-[#F0F4F8]">
                    {pt.features.map((feat, fIdx) => (
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
        </div>

        {/* Bottom Callout */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold max-w-2xl mx-auto">
            {lang === 'ro' ? 'Identifică profilul optim pentru proiectul tău' : lang === 'fa' ? 'پروفایل متناسب با پروژه خود را بیابید' : 'Match the Optimal Profile for Your Project'}
          </h2>
          <p className="text-xs sm:text-sm text-[#CBD5E1] max-w-xl mx-auto leading-relaxed">
            {lang === 'ro'
              ? 'Completează formularul nostru adaptiv. Analizăm componența imobilului și îți propunem pachetul potrivit de module.'
              : lang === 'fa'
              ? 'فرم ارزیابی هوشمند را پر کنید تا متخصصان ما ساختار ماژول‌ها و نحوه راه‌اندازی را برای شما تبیین کنند.'
              : 'Submit your requirements via our adaptive onboarding form for an expert assessment.'}
          </p>

          <Link
            href={`/${lang}/contact`}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-xs font-bold text-[#102A43] bg-[#14B8A6] hover:bg-[#2DD4BF] rounded-xl transition-all shadow-md"
          >
            <span>{lang === 'ro' ? 'Inițiază Solicitarea' : lang === 'fa' ? 'شروع فرآیند همکاری' : 'Start Partnership Inquiry'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </main>
  );
}
