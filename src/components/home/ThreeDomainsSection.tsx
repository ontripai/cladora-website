import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Database, 
  Sparkles, 
  Briefcase, 
  Wrench, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  FileText, 
  Layers, 
  TrendingUp, 
  Calendar, 
  FileSpreadsheet,
  Coins
} from 'lucide-react';

interface ThreeDomainsSectionProps {
  lang: Language;
}

export const ThreeDomainsSection: React.FC<ThreeDomainsSectionProps> = ({ lang }) => {
  return (
    <section className="py-20 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Ecosistemul Complet CLADORA' : lang === 'fa' ? 'ارکان پلتفرم و حوزههای خدمات' : 'The Connected Ecosystem'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Un nucleu comun solid și trei domenii operaționale conectate' 
              : lang === 'fa' 
              ? 'هستهٔ مشترک و سه حوزهٔ خدمات پیوسته' 
              : 'One Shared Core & Three Interconnected Domains'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'CLADORA nu împarte proprietatea în aplicații izolate. Nucleul comun păstrează identitatea și registrele oficiale, în timp ce domeniile specializate gestionează tranzacțiile, serviciile și mentenanța tehnică.'
              : lang === 'fa'
              ? 'کلادورا ملک را به نرم‌افزارهای پراکنده تقسیم نمی‌کند؛ هستهٔ مشترک، هویت واحد و اسناد رسمی را نگهداری می‌کند و سه حوزه تخصصی فرایندهای تجاری، خدمات و نگهداری را پیش می‌برند.'
              : 'CLADORA connects all activity on one persistent foundation: shared truth for identity and accounting, powering commercial transactions, service procurement, and facility maintenance.'}
          </p>
        </div>

        {/* 1. Core Shared Foundation Strip */}
        <div className="mb-12 p-8 rounded-3xl bg-[#F0F4F8] border border-[#D3DCE6] relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#0E9F8E]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
                  {lang === 'ro' ? 'Fundația Comună • Nucleul CLADORA' : lang === 'fa' ? 'زیرساخت تغییرناپذیر • هستهٔ مشترک CLADORA' : 'Shared Foundation • CLADORA Core'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#102A43]">
                {lang === 'ro' ? 'Adevărul Faptic & Registrele de Încredere' : lang === 'fa' ? 'شناسنامهٔ دارایی، دفاتر مالی و تاریخچهٔ قابل ردیابی' : 'Persistent Truth & Universal General Ledger'}
              </h3>
              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Identitatea imobilului și a spațiilor, granițele Workspace, dosarele persoanelor, seiful de documente, jurnalul contabil cu dublă înregistrare, mesageria oficială și pistele de audit imutabile.'
                  : lang === 'fa'
                  ? 'هویت ملک، واحدها و تجهیزات؛ مرزهای Workspace و حدود اختیار اعضا؛ اسناد و نسخه‌ها؛ دفاتر مالی و تسهیم هزینه‌ها؛ مکاتبات رسمی و ثبت تغییرناپذیر سوابق.'
                  : 'Property and unit registry, workspace boundaries, document vault, double-entry analytical ledger, official notices, and tamper-evident audit history.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium text-[#102A43]">
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1]">
                {lang === 'ro' ? 'Identitate Imobil & Unități' : lang === 'fa' ? 'هویت یکتای ملک' : 'Persistent ID'}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1]">
                {lang === 'ro' ? 'Seif Documente & Versiuni' : lang === 'fa' ? 'بایگانی اسناد' : 'Document Vault'}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1]">
                {lang === 'ro' ? 'Contabilitate & Alocări' : lang === 'fa' ? 'دفاتر مالی و تسهیم' : 'Double-entry Ledger'}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1]">
                {lang === 'ro' ? 'Jurnal Audit Imutabil' : lang === 'fa' ? 'سابقه حسابرسی' : 'Audit Trail'}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Operational Domains Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Domain 1: AIRPROP */}
          <div className="card-proptech p-8 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-amber-400 hover:shadow-lg transition-all group">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100/60 px-2.5 py-1 rounded-full">
                  AIRPROP
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#102A43] group-hover:text-amber-700 transition-colors">
                  {lang === 'ro' ? 'Tranzacții & Închirieri' : lang === 'fa' ? 'عرضه، معاملات و اجاره' : 'Real Estate & Leasing'}
                </h3>
                <p className="text-xs text-[#627D98] font-medium mt-0.5">
                  {lang === 'ro' ? 'Oportunități, vânzări, contracte & mandate' : lang === 'fa' ? 'متقاضیان، پیش‌فروش، ارزیابی و واگذاری مدیریت' : 'Inquiries, underwriting, sales & mandates'}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Prezentarea proprietății pe piață, gestionarea cererilor calificate, verificarea documentelor de proprietate, rezervări, antecontracte, gestiunea chiriilor și conectarea vânzării cu predarea către exploatare.'
                  : lang === 'fa'
                  ? 'معرفی و عرضه ملک، بررسی اسناد و شرایط متقاضیان، رزرو و پیش‌فروش، مدیریت روابط موجر و مستأجر، واگذاری مدیریت ملک و اتصال مستقیم فرایند تجاری به قرارداد و تحویل واحدها.'
                  : 'Property marketing showcase, qualified inquiry matching, title verification, pre-sales, lease administration, and property management mandates transitioning directly into operations.'}
              </p>

              <ul className="space-y-2 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Rezervări și vânzări sincronizate cu registrul' : lang === 'fa' ? 'رزرو و پیش‌فروش هماهنگ با هویت ملک' : 'Pre-sales tied to canonical units'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Gestiune chirii și relație proprietar-chiriaș' : lang === 'fa' ? 'مدیریت اجاره و تفکیک مطالبات' : 'Leasing & tenant relations'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Trecere fără cusur de la tranzacție la operare' : lang === 'fa' ? 'انتقال طبیعی به مدارک تحویل و بهره‌برداری' : 'Seamless handoff to operations'}</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[#F0F4F8]">
              <Link
                href={`/${lang}/airprop`}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center justify-between w-full"
              >
                <span>{lang === 'ro' ? 'Descoperă AIRPROP' : lang === 'fa' ? 'جزئیات سامانه AIRPROP' : 'Explore AIRPROP'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Domain 2: SERVICE */}
          <div className="card-proptech p-8 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-teal-400 hover:shadow-lg transition-all group">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center">
                  <Briefcase className="w-6 h-6" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-700 bg-teal-100/60 px-2.5 py-1 rounded-full">
                  SERVICE
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#102A43] group-hover:text-teal-700 transition-colors">
                  {lang === 'ro' ? 'Piața de Servicii & Comenzi' : lang === 'fa' ? 'کاتالوگ خدمات و نیازمندی‌ها' : 'Service Marketplace & Orders'}
                </h3>
                <p className="text-xs text-[#627D98] font-medium mt-0.5">
                  {lang === 'ro' ? 'Cereri, devize comparate, execuție & recepție' : lang === 'fa' ? 'استعلام قیمت، توافق بر دامنه و نظارت بر اجرا' : 'Briefs, quote comparison & verified sign-off'}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Alegerea din catalogul de servicii acreditate, lansarea cererii cu specificul spațiului, primirea și compararea ofertelor concurente, acordul pe preț și termen, urmărirea execuției și recepția calității.'
                  : lang === 'fa'
                  ? 'انتخاب از کاتالوگ خدمات، ثبت شرح نیاز برای واحد یا فضا، دریافت و مقایسه چند پیشنهاد قیمت و زمان، توافق شفاف، پیگیری اجرای کار توسط ارائه‌دهنده، پذیرش نتیجه و ثبت دائمی روی پرونده ملک.'
                  : 'Structured service requests: brief definition, competitive quote comparison, scope and cost agreement, dispatch tracking, verified acceptance, and permanent service history.'}
              </p>

              <ul className="space-y-2 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Comparare clară a ofertelor de preț și termen' : lang === 'fa' ? 'مقایسه شفاف پیشنهادها بدون هزینه‌های پنهان' : 'Transparent quote comparison'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Conectare la comenzi de lucru operaționale la nevoie' : lang === 'fa' ? 'اتصال سفارش به دستورکار عملیات در صورت نیاز فنی' : 'Unified link to operations work orders'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Atașarea facturii și garanției la fișa spațiului' : lang === 'fa' ? 'اتصال فاکتور و ضمانت به شناسنامه دارایی' : 'Service record attached to asset'}</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[#F0F4F8]">
              <Link
                href={`/${lang}/service`}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center justify-between w-full"
              >
                <span>{lang === 'ro' ? 'Descoperă modulul SERVICE' : lang === 'fa' ? 'جزئیات سامانه SERVICE' : 'Explore SERVICE'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Domain 3: Operations & Maintenance */}
          <div className="card-proptech p-8 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-blue-400 hover:shadow-lg transition-all group">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                  <Wrench className="w-6 h-6" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100/60 px-2.5 py-1 rounded-full">
                  OPERATIONS
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#102A43] group-hover:text-blue-700 transition-colors">
                  {lang === 'ro' ? 'Operațiuni & Mentenanță' : lang === 'fa' ? 'عملیات فنی و نگهداری' : 'Operations & Maintenance'}
                </h3>
                <p className="text-xs text-[#627D98] font-medium mt-0.5">
                  {lang === 'ro' ? 'Echipamente, revizii, comenzi de lucru & avarii' : lang === 'fa' ? 'تجهیزات، برنامه‌های دوره‌ای، دستورکار و رفع خرابی' : 'Assets, scheduled plans & work orders'}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Registrul tuturor echipamentelor tehnice din clădire, calendare de mentenanță preventivă periodică, raportare rapidă a defecțiunilor, emitere comenzi de lucru cu responsabil desemnat și istoric de revizii.'
                  : lang === 'fa'
                  ? 'ثبت و ردیابی کامل دارایی‌ها و تجهیزات فنی ساختمان، تعریف برنامه‌های نگهداری دوره‌ای، اعلام خرابی توسط ساکنان، صدور دستورکار با تخصیص مسئول اجرا، و نگهداری سوابق سرویس و هزینه‌ها.'
                  : 'Complete asset and technical equipment registers, recurring preventative maintenance schedules, incident ticket reporting, dispatched work orders, and auditable maintenance history.'}
              </p>

              <ul className="space-y-2 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Fișă tehnică digitală pentru fiecare echipament' : lang === 'fa' ? 'شناسنامه دیجیتال برای هر دستگاه و تأسیسات' : 'Digital logbook per equipment asset'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Planificare automată a reviziilor periodice' : lang === 'fa' ? 'تقویم خودکار سرویس‌ها و نگهداری پیشگیرانه' : 'Preventative maintenance schedules'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Control SLA și costuri aprobate de comitet' : lang === 'fa' ? 'کنترل زمان‌بندی SLA و هزینه‌های اجرایی' : 'SLA tracking & cost verification'}</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[#F0F4F8]">
              <Link
                href={`/${lang}/operations`}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center justify-between w-full"
              >
                <span>{lang === 'ro' ? 'Descoperă modulul Operațiuni' : lang === 'fa' ? 'جزئیات عملیات و نگهداری' : 'Explore Operations'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
