import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Briefcase, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  Scale, 
  Clock, 
  CheckCheck, 
  ShieldCheck, 
  Building2,
  Coins,
  History
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
  return getRouteMetadata('/service', params.lang);
}

export default async function ServicePage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const steps = [
    {
      number: '01',
      title: lang === 'ro' ? '1. Catalog de Servicii & Descriere Nevoie' : lang === 'fa' ? '۱. کاتالوگ خدمات و ثبت شرح نیاز' : '1. Service Catalog & Briefing',
      desc: lang === 'ro'
        ? 'Un Workspace își poate configura propriul catalog: curățenia unității, reparații în interiorul unității, spălătorie auto, curățătorie chimică, catering și masa zilei, cumpărături curente și livrarea pâinii dimineața, rezervarea spațiilor ori echipamentelor și, în mediul industrial, descărcare și încărcare. Niciun serviciu nu este obligatoriu în toate Workspace-urile.'
        : lang === 'fa'
        ? 'هر Workspace می‌تواند کاتالوگ خدمات خودش را پیکربندی یا انتخاب کند؛ مانند نظافت واحد، تعمیرات داخل واحد، کارواش، خشکشویی، catering و غذای روزانه، خرید روزانه و تحویل نان صبحانه، رزرو فضا یا تجهیزات و در محیط صنعتی، تخلیه و بارگیری. هیچ خدمت مشخصی برای همهٔ Workspaceها اجباری نیست.'
        : 'A Workspace can configure or choose its own service catalog, such as unit cleaning, in-unit repairs, car wash, dry cleaning, catering and daily meals, everyday shopping and morning bread delivery, space or equipment reservations, and loading or unloading for industrial sites. No individual service is mandatory across all Workspaces.',
      icon: Briefcase
    },
    {
      number: '02',
      title: lang === 'ro' ? '2. Modelul Potrivit pentru Fiecare Serviciu' : lang === 'fa' ? '۲. مدل مناسب برای هر خدمت' : '2. The Right Model for Each Service',
      desc: lang === 'ro'
        ? 'O Ofertă SERVICE poate folosi preț fix, tarifare în funcție de consum, abonament, rezervare, ofertare sau preț și domeniu stabilite după evaluare. Fiecare traseu este o comandă, rezervare sau achiziție independentă a membrului; compararea mai multor propuneri nu este implicită pentru orice serviciu.'
        : lang === 'fa'
        ? 'هر Offering در SERVICE می‌تواند قیمت ثابت، قیمت‌گذاری مبتنی بر مصرف، اشتراک، رزرو، استعلام قیمت یا قیمت و دامنه پس از ارزیابی داشته باشد. هر مسیر یک سفارش، رزرو یا خرید مستقل عضو است و مقایسه چند پیشنهاد برای همه خدمات پیش‌فرض نیست.'
        : 'A SERVICE Offering can use fixed price, usage-based, subscription, booking, quotation, or post-assessment terms. Each path is an independent member order, booking, or purchase; comparing multiple proposals is not the default for every service.',
      icon: Scale
    },
    {
      number: '03',
      title: lang === 'ro' ? '3. Alegere cu Termeni Expliciți' : lang === 'fa' ? '۳. انتخاب با شرایط روشن' : '3. Choice with Explicit Terms',
      desc: lang === 'ro'
        ? 'O experiență inclusă prin CE rămâne un flux separat, cu sursă de finanțare, drept de utilizare, consum și document propriu. După epuizarea alocării, membrul poate alege o Ofertă SERVICE independentă numai cu o identitate nouă, un preț nou, termeni noi, consimțământ explicit și un document separat.'
        : lang === 'fa'
        ? 'تجربه‌ای که در CE برای عضو لحاظ شده، مسیر جداگانه‌ای با منبع تأمین، استحقاق، استفاده و رسید مستقل دارد. پس از پایان سهمیه، عضو تنها با شناسه، قیمت، شرایط، رضایت صریح و رسیدی جدید و جداگانه می‌تواند یک Offering مستقل SERVICE را انتخاب کند.'
        : 'An included CE experience remains a separate flow with its own funding, entitlement, redemption, and receipt. After its allowance ends, a member may choose an independent SERVICE Offering only with a new identity, price, terms, explicit consent, and separate receipt.',
      icon: CheckCheck
    },
    {
      number: '04',
      title: lang === 'ro' ? '4. Comandă & Limita față de Mentenanță' : lang === 'fa' ? '۴. سفارش و مرز آن با عملیات و نگهداری' : '4. Order & Maintenance Boundary',
      desc: lang === 'ro'
        ? 'SERVICE acoperă ceea ce membrii pot solicita, rezerva sau cumpăra. Rezervarea liftului de marfă pentru o mutare poate fi un serviciu; revizia obligatorie a liftului și întreținerea infrastructurii comune aparțin Operațiuni & Mentenanță. Numai lucrările cu impact tehnic pot fi corelate cu o comandă de lucru operațională.'
        : lang === 'fa'
        ? 'SERVICE برای خدماتی است که اعضا می‌توانند درخواست، رزرو یا خریداری کنند. رزرو آسانسور باربری برای جابه‌جایی می‌تواند یک خدمت باشد؛ اما نگهداری الزامی آسانسور و زیرساخت مشترک به «عملیات و نگهداری» تعلق دارد. فقط کاری که اثر فنی دارد می‌تواند به دستورکار عملیاتی مرتبط شود.'
        : 'SERVICE covers services that members can request, book, or purchase. A freight elevator reservation for a move can be a service; mandatory elevator servicing and shared-infrastructure upkeep belong to Operations & Maintenance. Only technically relevant work may link to an operations work order.',
      icon: Clock
    },
    {
      number: '05',
      title: lang === 'ro' ? '5. Livrare, Dovadă & Recepție' : lang === 'fa' ? '۵. تحویل، رسید و پذیرش' : '5. Delivery, Receipt & Acceptance',
      desc: lang === 'ro'
        ? 'Modelul de evidență SERVICE poate păstra domeniul și termenii conveniți, împreună cu livrarea, documentul și acceptarea în istoricul serviciului, atunci când Workspace-ul configurează această funcție.'
        : lang === 'fa'
        ? 'مدل ثبت SERVICE می‌تواند دامنه و شرایط توافق‌شده را همراه تحویل، receipt و پذیرش در سابقه همان خدمت نگه دارد؛ مشروط به اینکه Workspace این قابلیت را پیکربندی کند.'
        : 'The SERVICE record model can keep the agreed scope and terms with delivery, receipt, and acceptance in service history when a Workspace configures that capability.',
      icon: CheckCircle2
    },
    {
      number: '06',
      title: lang === 'ro' ? '6. Istoricul Corect pentru Fiecare Rezultat' : lang === 'fa' ? '۶. سابقه درست برای هر نتیجه' : '6. The Right History for Each Outcome',
      desc: lang === 'ro'
        ? 'Modelul de evidență poate include în istoricul unui activ numai serviciile care îi modifică starea tehnică. Curățenia, mesele, cumpărăturile, rezervările și celelalte servicii pot păstra propria comandă, propriul document de livrare și propriul istoric de serviciu.'
        : lang === 'fa'
        ? 'مدل ثبت فقط می‌تواند خدمتی را وارد asset history کند که وضعیت فنی همان دارایی را تغییر می‌دهد. نظافت، غذا، خرید، رزرو و سایر خدمات می‌توانند order، receipt و service history مخصوص خود را نگه دارند.'
        : 'The record model can place a service in asset history only when it changes that asset’s technical condition. Cleaning, meals, shopping, reservations, and other services can keep their own order, receipt, and service history.',
      icon: History
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
            SERVICE
          </span>
        </div>

        {/* Hero Section */}
        <div className="max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-teal-800">
            <Briefcase className="w-3.5 h-3.5 text-teal-600" />
            <span>
              {lang === 'ro' 
                ? 'Servicii & Rezervări pentru Membrii Workspace-ului'
                : lang === 'fa'
                ? 'خدمات و رزروهای اعضای Workspace'
                : 'Workspace Member Services & Bookings'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' ? (
              <>
                SERVICE — Servicii pe care membrii le pot <span className="text-teal-600">solicita, rezerva sau cumpăra</span>.
              </>
            ) : lang === 'fa' ? (
              <>
                SERVICE — خدماتی که اعضای Workspace می‌توانند <span className="text-teal-600">درخواست، رزرو یا خریداری کنند</span>
              </>
            ) : (
              <>
                SERVICE — Services Workspace members can <span className="text-teal-600">request, book, or purchase</span>.
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Un Workspace poate configura sau alege catalogul potrivit membrilor și mediului său. SERVICE rămâne separat de mentenanța obligatorie a activelor și infrastructurii comune, administrată prin Operațiuni & Mentenanță.'
              : lang === 'fa'
              ? 'هر Workspace می‌تواند کاتالوگ خدمات مناسب اعضا و محیط خود را پیکربندی یا انتخاب کند. SERVICE از نگهداری الزامی دارایی‌ها و زیرساخت‌های مشترک که در «عملیات و نگهداری» مدیریت می‌شود جداست.'
              : 'A Workspace can configure or choose the service catalog that fits its members and setting. SERVICE stays distinct from mandatory upkeep of assets and shared infrastructure, which belongs to Operations & Maintenance.'}
          </p>
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div 
                key={idx}
                className="card-proptech p-7 bg-white border-[#E2E8F0] space-y-4 hover:border-teal-400 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center font-bold">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-extrabold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
                    {st.number}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#102A43]">
                  {st.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                  {st.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom Callout */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {lang === 'ro' ? 'Catalog Opțional, Evidență Clară' : lang === 'fa' ? 'کاتالوگ اختیاری، سابقه روشن' : 'Optional Catalog, Clear Records'}
              </h3>
              <p className="text-xs text-[#CBD5E1]">
                {lang === 'ro' ? 'Un Workspace poate alege serviciile și modelele potrivite membrilor săi' : lang === 'fa' ? 'هر Workspace می‌تواند خدمات و مدل‌های مناسب اعضای خود را انتخاب کند' : 'A Workspace can choose the services and models that fit its members'}
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-3xl">
            {lang === 'ro'
              ? 'Comenzile, documentele de livrare și istoricul serviciilor rămân distincte de cartea tehnică a activului. O legătură cu istoricul activului apare numai când rezultatul schimbă în mod real starea tehnică a acelui activ.'
              : lang === 'fa'
              ? 'سفارش، رسید و سابقه خدمات از شناسنامه فنی دارایی جدا می‌مانند. فقط وقتی نتیجه خدمت واقعاً وضعیت فنی asset را تغییر دهد، ارتباط آن با asset history ثبت می‌شود.'
              : 'Orders, receipts, and service history remain separate from technical asset records. A service links to asset history only when its outcome actually changes that asset’s technical condition.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-[#102A43] bg-teal-400 hover:bg-teal-300 rounded-xl transition-colors shadow-sm text-center"
            >
              {lang === 'ro' ? 'Află Mai Multe despre SERVICE' : lang === 'fa' ? 'درباره SERVICE بیشتر بدانید' : 'Inquire About SERVICE'}
            </Link>
            <Link
              href={`/${lang}/operations`}
              className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-white bg-[#173F5F] hover:bg-[#204E75] border border-[#244A6F] rounded-xl transition-colors text-center"
            >
              {lang === 'ro' ? 'Vezi Modulul Operațiuni & Mentenanță' : lang === 'fa' ? 'مشاهده بخش عملیات و نگهداری' : 'View Operations & Maintenance'}
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
