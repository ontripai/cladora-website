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
  Coins,
  Users
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
            {lang === 'ro' ? 'Structura Platformei CLADORA' : lang === 'fa' ? 'ارکان پلتفرم و بخش‌های کاربردی' : 'The Complete CLADORA System'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro'
              ? 'O bază sigură de date și patru domenii practice pentru clădirea ta'
              : lang === 'fa'
              ? 'پایگاه امن اطلاعات و چهار حوزهٔ کاربردی برای ساختمان شما'
              : 'One Secure Foundation & Four Practical Domains for Your Building'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'CLADORA adună totul la un loc: datele clădirii, plățile și actele sunt păstrate în siguranță, în timp ce domeniile dedicate se ocupă de tranzacții și închirieri, comenzi de servicii, reparații tehnice și experiența comunitară.'
              : lang === 'fa'
              ? 'کلادورا همه چیز را یکپارچه می‌کند: مشخصات ساختمان، حساب‌ها و اسناد در مکانی امن نگهداری می‌شوند و چهار حوزه مجزا به امور اجاره و فروش، سفارش خدمات، تعمیرات فنی و جامعه و تجربه سکونت اختصاص دارند.'
              : 'CLADORA brings everything together: building records, payments, and documents stay organized in one place, while dedicated domains handle transactions & leasing, service requests, technical operations, and community experience.'}
          </p>
        </div>

        {/* 1. Core Shared Foundation Strip */}
        <div className="mb-12 p-8 rounded-3xl bg-[#F0F4F8] border border-[#D3DCE6] relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#0E9F8E]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
                  {lang === 'ro' ? 'Baza Comună • Nucleul CLADORA' : lang === 'fa' ? 'پایگاه مشترک • هستهٔ سامانه' : 'Shared Core • Platform Foundation'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#102A43]">
                {lang === 'ro' ? 'Informațiile de Bază & Evidența Cheltuielilor' : lang === 'fa' ? 'شناسنامه ساختمان، دفاتر هزینه‌ها و سوابق معتبر' : 'Building Records & Transparent Accounting'}
              </h3>
              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Datele clădirii și ale apartamentelor, spațiile fiecărei asociații, dosarele locatarilor, arhiva de documente, calculul clar al cotelor de întreținere și istoricul verificabil al tuturor plăților.'
                  : lang === 'fa'
                  ? 'مشخصات ساختمان و واحدها، تفکیک اطلاعات هر مجتمع، پرونده ساکنان، بایگانی اسناد، محاسبه شفاف شارژ و تاریخچهٔ مستند و قابل بررسی پرداخت‌ها.'
                  : 'Building and unit records, dedicated association spaces, resident profiles, document vault, clear fee calculations, and an auditable payment history.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium text-[#102A43]">
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1]">
                {lang === 'ro' ? 'Identitate Clădire & Unități' : lang === 'fa' ? 'مشخصات ملک و واحدها' : 'Building & Unit Registry'}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1]">
                {lang === 'ro' ? 'Arhivă Documente & Contracte' : lang === 'fa' ? 'بایگانی اسناد و قراردادها' : 'Document & Contract Vault'}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1]">
                {lang === 'ro' ? 'Evidență Plăți & Întreținere' : lang === 'fa' ? 'دفاتر هزینه‌ها و شارژ' : 'Fee & Ledger Tracking'}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white border border-[#CBD5E1]">
                {lang === 'ro' ? 'Istoric Verificabil' : lang === 'fa' ? 'سوابق قابل استناد' : 'Verifiable History'}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Operational Domains Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Domain 1: AIRPROP */}
          <div className="card-proptech p-6 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-amber-400 hover:shadow-lg transition-all group">
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
                  {lang === 'ro' ? 'Tranzacții, Închirieri & Gestionare Spații' : lang === 'fa' ? 'معاملات، اجاره و مدیریت فضاها' : 'Transactions, Leasing & Space Management'}
                </h3>
                <p className="text-xs text-[#627D98] font-medium mt-0.5">
                  {lang === 'ro' ? 'Locuințe, birouri, spații comerciale, depozite și contracte conexe' : lang === 'fa' ? 'واحدهای مسکونی، تجاری، اداری، انبارها و قراردادهای وابسته' : 'Residential, commercial spaces, offices, storage units, and contracts'}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Evidența spațiilor și unităților disponibile (locuințe, birouri, spații comerciale sau depozite), gestionarea cererilor, rezervări, contracte de închiriere sau vânzare și predarea organizată a folosinței.'
                  : lang === 'fa'
                  ? 'مدیریت فضاها و املاک در دسترس (واحدهای مسکونی، اداری، تجاری و انبارها)، ثبت درخواست‌ها، قراردادهای فروش یا اجاره و تحویل ساختاریافتهٔ فضاها.'
                  : 'Managing available properties and spaces (residential units, offices, commercial premises, storage), buyer and tenant inquiries, agreements, and organized handovers.'}
              </p>

              <ul className="space-y-2 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Rezervări și tranzacții legate direct de spațiul sau imobilul respectiv' : lang === 'fa' ? 'ثبت رزرو و معاملات متصل به شناسنامهٔ ملک یا فضای مربوطه' : 'Reservations and transactions linked directly to the property or unit'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Evidența contractelor de închiriere și a plăților convenite' : lang === 'fa' ? 'پیگیری قراردادهای اجاره و ثبت تعهدات مالی' : 'Lease agreement tracking and agreed payment records'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Tranziție clară de la contract la predarea și utilizarea spațiului' : lang === 'fa' ? 'انتقال شفاف از مرحلهٔ قرارداد به تحویل و بهره‌برداری از فضا' : 'Clear transition from agreement to space handover and use'}</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[#F0F4F8]">
              <Link
                href={`/${lang}/airprop`}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center justify-between w-full"
              >
                <span>{lang === 'ro' ? 'Află mai multe despre AIRPROP' : lang === 'fa' ? 'اطلاعات بیشتر درباره AIRPROP' : 'Learn more about AIRPROP'}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Domain 2: SERVICE */}
          <div className="card-proptech p-6 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-teal-400 hover:shadow-lg transition-all group">
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
                  {lang === 'ro' ? 'Comenzi de Servicii & Furnizori' : lang === 'fa' ? 'سفارش خدمات و تأمین‌کنندگان' : 'Service Orders & Providers'}
                </h3>
                <p className="text-xs text-[#627D98] font-medium mt-0.5">
                  {lang === 'ro' ? 'Cereri de oferte, devize clare și recepția lucrărilor' : lang === 'fa' ? 'استعلام قیمت، برآورد روشن هزینه‌ها و تحویل کار' : 'Service requests, clear estimates, and work acceptance'}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Colaborare cu meșteri, tehnicieni și companii specializate de servicii: curățenie, verificări periodice, reparații sau mentenanță generală. Înregistrezi cereri, compari devize, alegi furnizorul potrivit și atașezi facturile la dosarul clădirii.'
                  : lang === 'fa'
                  ? 'همکاری با تکنسین‌ها، پیمانکاران تخصصی و شرکت‌های خدماتی: نظافت، بازرسی‌های فنی یا تعمیرات اساسی. ثبت درخواست‌ها، مقایسه پیشنهادها، انتخاب تأمین‌کننده و پیوست فاکتورها به پرونده ملک.'
                  : 'Connecting with technicians, specialized contractors, and service providers for cleaning, routine inspections, or repairs. Log requests, compare estimates, select the right vendor, and keep invoices with property records.'}
              </p>

              <ul className="space-y-2 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Compararea ofertelor și a costurilor estimate' : lang === 'fa' ? 'مقایسه پیشنهادها و برآورد شفاف هزینه‌ها' : 'Comparing estimates and transparent cost breakdowns'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Transmiterea cererilor către echipele tehnice și furnizori' : lang === 'fa' ? 'ارجاع درخواست‌های خدمات به تیم‌های فنی و پیمانکاران' : 'Dispatching service requests to technical teams and suppliers'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Facturile și documentele de recepție rămân salvate la dosar' : lang === 'fa' ? 'ثبت فاکتورها و صورت‌جلسات تحویل در پروندهٔ ساختمان' : 'Invoices and work acceptance records attached to the property'}</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[#F0F4F8]">
              <Link
                href={`/${lang}/service`}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center justify-between w-full"
              >
                <span>{lang === 'ro' ? 'Află mai multe despre Servicii' : lang === 'fa' ? 'اطلاعات بیشتر درباره بخش خدمات' : 'Learn more about Service orders'}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Domain 3: Operations & Maintenance */}
          <div className="card-proptech p-6 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-blue-400 hover:shadow-lg transition-all group">
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
                  {lang === 'ro' ? 'Reparații & Mentenanță Tehnică' : lang === 'fa' ? 'تعمیرات و نگهداری تأسیسات' : 'Repairs & Technical Maintenance'}
                </h3>
                <p className="text-xs text-[#627D98] font-medium mt-0.5">
                  {lang === 'ro' ? 'Lifturi, centrale, pompe, revizii periodice și evidența avariilor' : lang === 'fa' ? 'آسانسورها، موتورخانه‌ها، پمپ‌ها، سرویس‌های دوره‌ای و ثبت خرابی‌ها' : 'Lifts, heating, pumps, scheduled maintenance, and incident logs'}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Evidența echipamentelor tehnice din clădire, planificarea reviziilor periodice, semnalarea incidentelor și urmărirea intervențiilor până la remedierea completă.'
                  : lang === 'fa'
                  ? 'شناسنامهٔ تجهیزات فنی ساختمان، برنامه‌ریزی سرویس‌های دوره‌ای، ثبت گزارش‌های خرابی و پیگیری تعمیرات تا رفع کامل نقص.'
                  : 'Registry of all building equipment, planning routine inspections, logging resident incident reports, and tracking repairs through completion.'}
              </p>

              <ul className="space-y-2 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Fișă tehnică pentru fiecare echipament și instalație' : lang === 'fa' ? 'شناسنامهٔ فنی برای هر دستگاه و تأسیسات مشترک' : 'Clear technical record for each installation and equipment asset'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Evidența reviziilor tehnice și a termenelor de verificare' : lang === 'fa' ? 'برنامه‌ریزی سرویس‌های فنی و مواعد بازرسی دوره‌ای' : 'Tracking maintenance schedules and inspection deadlines'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Urmărirea costurilor și a stadiului fiecărei intervenții' : lang === 'fa' ? 'ثبت هزینه‌های تعمیرات و پیگیری وضعیت پیشرفت کار' : 'Tracking repair costs and intervention progress'}</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[#F0F4F8]">
              <Link
                href={`/${lang}/operations`}
                className="text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center justify-between w-full"
              >
                <span>{lang === 'ro' ? 'Află mai multe despre Operațiuni' : lang === 'fa' ? 'اطلاعات بیشتر درباره بخش عملیات و نگهداری' : 'Learn more about Operations'}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Domain 4: CE (Community & Experience) */}
          <div className="card-proptech p-6 bg-white border-[#E2E8F0] flex flex-col justify-between hover:border-indigo-400 hover:shadow-lg transition-all group">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-100/60 px-2.5 py-1 rounded-full">
                  CE
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#102A43] group-hover:text-indigo-700 transition-colors">
                  {lang === 'ro' ? 'Comunitate & Experiență' : lang === 'fa' ? 'جامعه و تجربه' : 'Community & Experience'}
                </h3>
                <p className="text-xs text-[#627D98] font-medium mt-0.5">
                  {lang === 'ro' ? 'Ghiduri de spațiu, facilități & comunicare' : lang === 'fa' ? 'راهنمای فضاها، امکانات رفاهی و ارتباط مستقیم' : 'Space guides, amenities & resident updates'}
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Conectează rezidenții și utilizatorii clădirii la facilități, evenimente și ghiduri utile de utilizare a spațiului, păstrând comunicarea directă și sigură fără a amesteca rolurile de administrare.'
                  : lang === 'fa'
                  ? 'ساکنان و بهره‌برداران را به امکانات رفاهی، رویدادها و راهنمای فضاهای ساختمان متصل می‌کند؛ با برقراری ارتباط مستقیم و امن، بدون تداخل با اختیارات مدیریتی یا دسترسی‌های محرمانه.'
                  : 'Connects residents and occupants to amenities, local events, and practical space guides, maintaining direct and secure communication without conflating administrative roles.'}
              </p>

              <ul className="space-y-2 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Ghiduri practice de spațiu și utilizare a facilităților clădirii' : lang === 'fa' ? 'راهنمای کاربردی استفاده از مشاعات و فضاهای مشترک' : 'Practical space guides and building amenity utilization'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Canale clare de anunțuri și consultare a comunității' : lang === 'fa' ? 'کانال‌های اطلاع‌رسانی رسمی و نظرسنجی از ساکنان' : 'Structured announcements and community notice channels'}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>{lang === 'ro' ? 'Rezervarea facilităților fără suprapuneri sau conflicte' : lang === 'fa' ? 'رزرو امکانات رفاهی بدون تداخل یا تعارض نوبت‌ها' : 'Amenity reservation without schedule conflicts'}</span>
                </li>
              </ul>
            </div>

            <div className="pt-6 mt-6 border-t border-[#F0F4F8]">
              <Link
                href={`/${lang}/community-experience`}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-800 flex items-center justify-between w-full"
              >
                <span>{lang === 'ro' ? 'Află mai multe despre Comunitate' : lang === 'fa' ? 'اطلاعات بیشتر درباره جامعه و تجربه' : 'Learn more about Community'}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
