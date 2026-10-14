import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Home, 
  CheckCircle2, 
  Receipt, 
  Camera, 
  Vote, 
  ShieldCheck, 
  ArrowRight,
  Megaphone
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
  return getRouteMetadata('/solutions/residents', params.lang);
}

export default async function ResidentsSolutionPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-[#52667A] mb-8 font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'خانه' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#52667A]">
            {lang === 'ro' ? 'Soluții' : lang === 'fa' ? 'راهکارها' : 'Solutions'}
          </span>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Proprietari & Rezidenți' : lang === 'fa' ? 'مالکان و ساکنان' : 'Owners & Residents'}
          </span>
        </div>

        {/* Hero */}
        <div className="card-proptech p-8 sm:p-12 bg-white border-[#D3DCE6] space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62]">
            <Home className="w-4 h-4 text-[#0E9F8E]" />
            <span>
              {lang === 'fa' 
                ? 'اپلیکیشن مالکان و ساکنان کلادورا' 
                : 'CLADORA Resident App'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight max-w-3xl">
            {lang === 'ro'
              ? 'Listă de plată clară, transmitere index prin poză și transparență completă'
              : lang === 'fa'
              ? 'فیش شفاف شارژ، ثبت آسان کنتورها و آرامش خاطر در خانه شما'
              : 'Clear Monthly Statements, Easy Meter Reads & Resident Peace of Mind'}
          </h1>

          <p className="text-base sm:text-lg text-[#52667A] max-w-3xl leading-relaxed">
            {lang === 'ro'
              ? 'Vezi exact de unde vine fiecare sumă de pe nota de plată, transmiți indexul contoarelor prin poză, primești notificări instant de la administrație și participi la deciziile blocului tău.'
              : lang === 'fa'
              ? 'منشأ دقیق هر ردیف در فیش شارژ را به‌روشنی مشاهده کنید، ارقام کنتورها را با ارسال یک عکس ثبت کنید، اطلاعیه‌های مهم را فوری دریافت نمایید و در تصمیم‌گیری‌های ساختمان سهم داشته باشید.'
              : 'Understand every line on your monthly maintenance bill, snap photos of water meters, receive urgent building notices, and vote on community improvements.'}
          </p>

          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              href={`/${lang}/demo`}
              className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <span>{lang === 'ro' ? 'Vezi demonstrația ca rezident' : lang === 'fa' ? 'ورود به نسخه نمایشی ساکنان' : 'View resident demo'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/contact`}
              className="px-6 py-3.5 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold transition-all"
            >
              {lang === 'ro' ? 'Solicită parteneriat' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Request partnership intake'}
            </Link>
          </div>
        </div>

        {/* Feature Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="card-proptech p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Explicație Matematică Completă' : lang === 'fa' ? 'سند توجیهی و محاسبات شفاف اقلام' : 'Explainable Math Proof'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Apasă pe orice rând din întreținere pentru a vedea factura furnizorului și cota ta parte.' 
                : lang === 'fa'
                ? 'با لمس هر ردیف از هزینه‌ها، فرمول تسهیم، سهم واحد و تصویر فاکتور اصلی شرکت خدماتی را مشاهده فرمایید.'
                : 'Click on any line item to verify supplier invoices and statutory allocation algorithms.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDF5FF] text-[#2F80ED] flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Citire Contor prin Poză' : lang === 'fa' ? 'قرائت کنتور با ارسال عکس (AI OCR)' : 'Photo Meter Submission'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Faci o poză contorului, iar algoritmul completează cifrele automat, eliminând erorile umane.' 
                : lang === 'fa'
                ? 'کافی است از شماره‌انداز کنتور عکس بگیرید؛ الگوریتم هوش مصنوعی ارقام را تشخیص داده و ثبت می‌نماید.'
                : 'Snap a picture of your meter; OCR digitizes readings with anomaly verification.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF7E6] text-[#D99B26] flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Avizier Digital Direct pe Mobil' : lang === 'fa' ? 'تابلوی اعلانات دیجیتال در موبایل' : 'Digital Noticeboard on Mobile'}
            </h2>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro' 
                ? 'Află din timp despre opririle de apă caldă, reviziile de gaze sau ședințele de bloc.' 
                : lang === 'fa'
                ? 'اطلاع به‌موقع از قطعی‌های برنامه‌ریزی‌شده تأسیسات، سرویس آسانسورها یا زمان‌بندی جلسات ساختمان.'
                : 'Stay informed about scheduled water shutoffs, gas checks, and board announcements.'}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
