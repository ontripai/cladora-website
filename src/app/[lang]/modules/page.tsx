import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Database, 
  Sparkles, 
  Briefcase, 
  Wrench, 
  ShieldCheck, 
  FileText, 
  Layers, 
  ArrowRight, 
  CheckCircle2,
  Cpu,
  TrendingUp,
  KeyRound,
  FileSpreadsheet
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
  return getRouteMetadata('/modules', params.lang);
}

export default async function ModulesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const modulesCategories = [
    {
      category: lang === 'ro' ? '1. Nucleul Comun de Date & Identitate' : lang === 'fa' ? '۱. هستهٔ مشترک، هویت و حقیقت مالی' : '1. Shared Core & Identity Foundation',
      icon: Database,
      items: [
        {
          name: lang === 'ro' ? 'Registrul de Proprietăți & Topologie' : lang === 'fa' ? 'شناسنامه پایدار ملک و واحدها' : 'Property & Spatial Topology',
          desc: lang === 'ro' ? 'Identitate persistentă pentru ansambluri, clădiri, spații, unități individuale și active fizice.' : lang === 'fa' ? 'شناسه یکتا و ساختار سلسله‌مراتبی مجموعه، ساختمان، واحد، فضا و تجهیزات.' : 'Canonical spatial hierarchy for estates, units, common areas, and assets.'
        },
        {
          name: lang === 'ro' ? 'Universal Workspace & Securitate Multi-Tenant' : lang === 'fa' ? 'مدل Workspace و تفکیک سازمان‌ها' : 'Universal Workspace & Multi-Tenant Isolation',
          desc: lang === 'ro' ? 'Granițe de date și colaborare strict izolate între asociații, dezvoltatori și companii.' : lang === 'fa' ? 'مرز دسترسی و همکاری امن بدون کوچک‌ترین درز اطلاعات میان سازمان‌ها.' : 'Strict isolation for organizational data, memberships, and contracts.'
        },
        {
          name: lang === 'ro' ? 'Adevăr Financiar & Dublă Înregistrare' : lang === 'fa' ? 'حسابداری، دفاتر قانونی و کنترل تحلیلی' : 'Financial Truth & Verifiable Ledger',
          desc: lang === 'ro' ? 'Registre statutare, contabilitate analitică în partidă dublă și reconciliere bancară fără diferențe.' : lang === 'fa' ? 'دفاتر قانونی، کنترل تحلیلی دوطرفه و تطبیق بانکی بدون مغایرت.' : 'Statutory records, double-entry analytical control, and zero-variance bank matching.'
        },
        {
          name: lang === 'ro' ? 'Seif Digital de Documente & Versiuni' : lang === 'fa' ? 'بایگانی امن اسناد و تاریخچه نسخه‌ها' : 'Digital Document Vault & Attestations',
          desc: lang === 'ro' ? 'Stocare criptată a contractelor, cărții tehnice și dovezilor de conformitate.' : lang === 'fa' ? 'بایگانی رمزنگاری‌شده اسناد مالکیت، نقشه‌ها، فاکتورها و تاییدیه‌ها.' : 'Encrypted retention of titles, blueprints, invoices, and certificates.'
        }
      ]
    },
    {
      category: lang === 'ro' ? '2. Domeniul Comercial & Tranzacțional (AIRPROP)' : lang === 'fa' ? '۲. حوزه تجاری و معاملات ملک (AIRPROP)' : '2. Commercial & Real Estate OS (AIRPROP)',
      icon: Sparkles,
      items: [
        {
          name: lang === 'ro' ? 'Prezentare Imobil & Oportunități Comerciale' : lang === 'fa' ? 'معرفی ملک و مدیریت متقاضیان' : 'Property Showcase & Inquiries',
          desc: lang === 'ro' ? 'Prezentare structurată a unităților și potrivirea asistată a cererilor cumpărătorilor.' : lang === 'fa' ? 'ثبت و عرضه مشخصات واحدها و تطبیق هوشمند با نیاز خریداران.' : 'Unit showcase and intelligent inquiry opportunity matching.'
        },
        {
          name: lang === 'ro' ? 'Rezervări, Pre-vânzări & Tranșe de Plată' : lang === 'fa' ? 'رزرو، پیش‌فروش و اقساط' : 'Reservations & Pre-Sales Ledger',
          desc: lang === 'ro' ? 'Gestiunea antecontractelor și conectarea vânzării cu predarea către exploatare.' : lang === 'fa' ? 'پیگیری قراردادهای پیش‌فروش و انتقال مستقیم به بهره‌برداری.' : 'Pre-sales contract administration and seamless handover transition.'
        },
        {
          name: lang === 'ro' ? 'Gestiune Chirii & Mandat de Administrare' : lang === 'fa' ? 'مدیریت اجاره و واگذاری بهره‌برداری' : 'Leasing & Property Management Mandates',
          desc: lang === 'ro' ? 'Urmărirea contractelor de închiriere și delegarea gestiunii către manageri profesioniști.' : lang === 'fa' ? 'پایش اجاره‌بها، تفکیک مطالبات و واگذاری مدیریت به کارگزاران املاک.' : 'Lease administration, rent collections, and management mandates.'
        }
      ]
    },
    {
      category: lang === 'ro' ? '3. Modulul de Servicii & Ofertare (SERVICE)' : lang === 'fa' ? '۳. کاتالوگ خدمات و نیازمندی‌ها (SERVICE)' : '3. Service Procurement & Execution (SERVICE)',
      icon: Briefcase,
      items: [
        {
          name: lang === 'ro' ? 'Catalog Servicii & Descriere Nevoie' : lang === 'fa' ? 'کاتالوگ خدمات و ثبت شرح نیاز' : 'Service Catalog & Briefing',
          desc: lang === 'ro' ? 'Lansarea cererilor de intervenție legate direct de spațiul sau echipamentul vizat.' : lang === 'fa' ? 'انتخاب خدمت و ثبت شرح نیاز متصل به واحد یا تجهیزات مشخص.' : 'Structured service requests tied to physical units or technical assets.'
        },
        {
          name: lang === 'ro' ? 'Ofertare Concurențială & Comparare Devize' : lang === 'fa' ? 'استعلام قیمت و مقایسه پیشنهادها' : 'Competitive Quote Comparison',
          desc: lang === 'ro' ? 'Matrice transparentă pentru compararea costurilor defalcate și a termenelor.' : lang === 'fa' ? 'مقایسه عادلانه چند پیشنهاد قیمت، زمان‌بندی و گارانتی.' : 'Transparent side-by-side comparison of itemized costs and timelines.'
        },
        {
          name: lang === 'ro' ? 'Urmărire Execuție & Recepție Calitativă' : lang === 'fa' ? 'پیگیری اجرا و پذیرش رسمی' : 'Milestone Tracking & Verified Sign-Off',
          desc: lang === 'ro' ? 'Monitorizarea etapelor de lucru și semnarea digitală a procesului-verbal.' : lang === 'fa' ? 'ردیابی پیشرفت کار و امضای صورت‌جلسه تاییدیه انجام تعهدات.' : 'Execution progress tracking and verified digital acceptance protocol.'
        }
      ]
    },
    {
      category: lang === 'ro' ? '4. Operațiuni Tehnice & Mentenanță' : lang === 'fa' ? '۴. عملیات فنی و نگهداری دوره‌ای' : '4. Facility Operations & Maintenance',
      icon: Wrench,
      items: [
        {
          name: lang === 'ro' ? 'Registru Echipamente & Fișe Tehnice' : lang === 'fa' ? 'شناسنامه دیجیتال تأسیسات و تجهیزات' : 'Equipment Registry & Logbooks',
          desc: lang === 'ro' ? 'Evidența completă a componentelor tehnice (lifturi, pompe, centrale, tablouri).' : lang === 'fa' ? 'شناسنامه فنی آسانسور، موتورخانه، پمپ‌ها و تجهیزات کلیدی.' : 'Digital logbooks for elevators, HVAC, pumps, and fire systems.'
        },
        {
          name: lang === 'ro' ? 'Mentenanță Preventivă Periodică' : lang === 'fa' ? 'برنامه‌ریزی نگهداری پیشگیرانه' : 'Scheduled Preventative Plans',
          desc: lang === 'ro' ? 'Planificarea automată a reviziilor obligatorii cu alerte timpurii.' : lang === 'fa' ? 'تنظیم تقویم دوره‌ای بازرسی‌های فنی و هشدارهای سررسید سرویس.' : 'Automated recurring maintenance cycles and statutory compliance alerts.'
        },
        {
          name: lang === 'ro' ? 'Tichete Avarii & Comenzi de Lucru' : lang === 'fa' ? 'اعلام خرابی و صدور دستورکار' : 'Incident Triage & Work Orders',
          desc: lang === 'ro' ? 'Sesizare rapidă a defecțiunilor și dispecerizare către tehnicieni cu SLA garantat.' : lang === 'fa' ? 'ثبت خرابی همراه با عکس و ارجاع سریع دستورکار با کنترل SLA.' : 'Photo-backed defect reporting and structured technician dispatch.'
        }
      ]
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
            {lang === 'ro' ? 'Capabilități & Module' : lang === 'fa' ? 'ماژول‌ها و ارکان پلتفرم' : 'Platform Capabilities'}
          </span>
        </div>

        {/* Hero */}
        <div className="max-w-4xl space-y-4">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Arhitectura Modulară CLADORA' : lang === 'fa' ? 'ارکان و ماژول‌های پلتفرم CLADORA' : 'CLADORA Modular Capabilities'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Capabilități Modulare pentru Întregul Ciclu de Viață' 
              : lang === 'fa' 
              ? 'مجموعه ماژول‌های یکپارچه برای تمام چرخهٔ عمر ملک' 
              : 'Integrated Modules Across the Property Lifecycle'}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Platforma combină modulele esențiale de gestiune, tranzacții și mentenanță pe o fundație unică de adevăr faptic. Fiecare organizație activează exact modulele necesare profilului său de proprietate.'
              : lang === 'fa'
              ? 'کلادورا ماژول‌های اصلی مدیریت، معاملات و نگهداری را بر بستر یکپارچه حقیقت مالی و هویت پایدار ملک ارائه می‌دهد. هر Workspace متناسب با کاربری خود ماژول‌های موردنیاز را فعال می‌سازد.'
              : 'CLADORA unifies core accounting, commercial transactions, and technical facility operations on a shared factual core. Workspaces configure precisely the modules required.'}
          </p>
        </div>

        {/* Module Categories Grid */}
        <div className="space-y-12">
          {modulesCategories.map((cat, cIdx) => {
            const CatIcon = cat.icon;
            return (
              <div key={cIdx} className="space-y-6">
                <div className="flex items-center gap-3 border-b border-[#E2E8F0] pb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                    <CatIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#102A43]">
                    {cat.category}
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {cat.items.map((item, iIdx) => (
                    <div 
                      key={iIdx}
                      className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-2 hover:border-[#0E9F8E] transition-all"
                    >
                      <h3 className="text-base font-bold text-[#102A43]">
                        {item.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Callout */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold max-w-2xl mx-auto">
            {lang === 'ro' ? 'Configurează pachetul de module pentru proprietatea ta' : lang === 'fa' ? 'تنظیم ماژول‌های متناسب با پروژه شما' : 'Configure the Module Stack for Your Property'}
          </h2>
          <p className="text-xs sm:text-sm text-[#CBD5E1] max-w-xl mx-auto leading-relaxed">
            {lang === 'ro'
              ? 'Completează formularul nostru de parteneriat. Specialiștii noștri configurează profilul optim fără costuri nejustificate.'
              : lang === 'fa'
              ? 'فرم شروع همکاری را تکمیل نمایید تا کارشناسان ترکیب ماژول‌های متناسب با ملک شما را تبیین کنند.'
              : 'Submit an inquiry through our adaptive questionnaire to match the optimal module configuration.'}
          </p>

          <Link
            href={`/${lang}/contact`}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-xs font-bold text-[#102A43] bg-[#14B8A6] hover:bg-[#2DD4BF] rounded-xl transition-all shadow-md"
          >
            <span>{lang === 'ro' ? 'Solicită Configurarea Modulelor' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Start Module Inquiry'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </main>
  );
}
