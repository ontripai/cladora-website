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
        ? 'Fiecare Workspace activează propriul catalog: curățenia unității, reparații în interiorul unității, spălătorie auto, curățătorie chimică, catering și masa zilei, cumpărături curente și livrarea pâinii dimineața, rezervarea spațiilor ori echipamentelor și, în mediul industrial, descărcare și încărcare. Niciun serviciu nu este obligatoriu în toate Workspace-urile.'
        : lang === 'fa'
        ? 'هر Workspace کاتالوگ خودش را فعال می‌کند؛ مانند نظافت واحد، تعمیرات داخل واحد، کارواش، خشکشویی، catering و غذای روزانه، خرید روزانه و تحویل نان صبحانه، رزرو فضا یا تجهیزات و در محیط صنعتی، تخلیه و بارگیری. هیچ خدمت مشخصی برای همهٔ Workspaceها اجباری نیست.'
        : 'Each Workspace activates its own catalog, such as unit cleaning, in-unit repairs, car wash, dry cleaning, catering and daily meals, everyday shopping and morning bread delivery, space or equipment reservations, and loading or unloading for industrial sites. No individual service is mandatory across all Workspaces.',
      icon: Briefcase
    },
    {
      number: '02',
      title: lang === 'ro' ? '2. Modelul Potrivit pentru Fiecare Serviciu' : lang === 'fa' ? '۲. مدل مناسب برای هر خدمت' : '2. The Right Model for Each Service',
      desc: lang === 'ro'
        ? 'Un serviciu poate avea preț fix, poate fi inclus într-un beneficiu activ, poate funcționa prin abonament, rezervare sau consum măsurat ori poate necesita o ofertă. Compararea mai multor devize este doar unul dintre aceste trasee.'
        : lang === 'fa'
        ? 'هر خدمت می‌تواند قیمت ثابت داشته باشد، در مزایای فعال Workspace گنجانده شود، اشتراکی باشد، با رزرو یا میزان مصرف ارائه شود، یا به استعلام قیمت نیاز داشته باشد. مقایسه چند پیشنهاد فقط یکی از این مسیرهاست.'
        : 'A service may use fixed pricing, be included in an active benefit, run as a subscription, use booking or usage-based terms, or require a quotation. Comparing multiple proposals is one possible path, not the default for every service.',
      icon: Scale
    },
    {
      number: '03',
      title: lang === 'ro' ? '3. Alegere cu Termeni Expliciți' : lang === 'fa' ? '۳. انتخاب با شرایط روشن' : '3. Choice with Explicit Terms',
      desc: lang === 'ro'
        ? 'Membrul autorizat confirmă domeniul, disponibilitatea, programarea, beneficiul sau prețul aplicabil înainte de comandă. Dacă este necesară ofertarea, propunerile disponibile pot fi comparate fără a presupune existența unei rețele universale de furnizori.'
        : lang === 'fa'
        ? 'عضو مجاز پیش از سفارش، دامنه، ظرفیت، زمان‌بندی، مزیت یا قیمت قابل اعمال را تأیید می‌کند. اگر خدمت نیازمند استعلام باشد، پیشنهادهای موجود قابل مقایسه‌اند؛ بدون آنکه وجود شبکه سراسری ارائه‌دهندگان فرض شود.'
        : 'Before ordering, an authorized member confirms the scope, availability, schedule, benefit, or applicable price. When quotation is required, available proposals can be compared without implying a universal provider network.',
      icon: CheckCheck
    },
    {
      number: '04',
      title: lang === 'ro' ? '4. Comandă & Limita față de Mentenanță' : lang === 'fa' ? '۴. سفارش و مرز آن با عملیات و نگهداری' : '4. Order & Maintenance Boundary',
      desc: lang === 'ro'
        ? 'SERVICE acoperă ceea ce membrii pot solicita, rezerva sau cumpăra. Rezervarea liftului de marfă pentru o mutare poate fi un serviciu; revizia obligatorie a liftului și întreținerea infrastructurii comune aparțin Operațiuni & Mentenanță. Numai lucrările cu impact tehnic pot fi corelate cu o comandă de lucru operațională.'
        : lang === 'fa'
        ? 'SERVICE برای خدمات و مزایایی است که اعضا می‌توانند درخواست، رزرو یا خریداری کنند. رزرو آسانسور باربری برای جابه‌جایی می‌تواند یک خدمت باشد؛ اما نگهداری الزامی آسانسور و زیرساخت مشترک به «عملیات و نگهداری» تعلق دارد. فقط کاری که اثر فنی دارد می‌تواند به دستورکار عملیاتی مرتبط شود.'
        : 'SERVICE covers services and benefits that members can request, book, or purchase. A freight elevator reservation for a move can be a service; mandatory elevator servicing and shared-infrastructure upkeep belong to Operations & Maintenance. Only technically relevant work may link to an operations work order.',
      icon: Clock
    },
    {
      number: '05',
      title: lang === 'ro' ? '5. Livrare, Dovadă & Recepție' : lang === 'fa' ? '۵. تحویل، رسید و پذیرش' : '5. Delivery, Receipt & Acceptance',
      desc: lang === 'ro'
        ? 'Comanda își păstrează domeniul și termenii conveniți, iar livrarea, dovada și acceptarea sunt înregistrate în istoricul serviciului, în limitele funcțiilor activate pentru acel Workspace.'
        : lang === 'fa'
        ? 'دامنه و شرایط توافق‌شده همراه سفارش حفظ می‌شود و تحویل، رسید و پذیرش در سابقه همان خدمت ثبت می‌گردد؛ در محدوده قابلیت‌هایی که برای آن Workspace فعال شده‌اند.'
        : 'The order retains its agreed scope and terms. Delivery, receipt, and acceptance belong to the service history, within the capabilities activated for that Workspace.',
      icon: CheckCircle2
    },
    {
      number: '06',
      title: lang === 'ro' ? '6. Istoricul Corect pentru Fiecare Rezultat' : lang === 'fa' ? '۶. سابقه درست برای هر نتیجه' : '6. The Right History for Each Outcome',
      desc: lang === 'ro'
        ? 'Numai serviciile care modifică starea tehnică a unui activ intră în istoricul acelui activ. Curățenia, mesele, cumpărăturile, rezervările și celelalte servicii păstrează propria comandă, propriul document de livrare și propriul istoric de serviciu.'
        : lang === 'fa'
        ? 'فقط خدمتی که وضعیت فنی یک asset را تغییر می‌دهد وارد asset history همان دارایی می‌شود. نظافت، غذا، خرید، رزرو و سایر خدمات، order، receipt و service history مخصوص خود را نگه می‌دارند.'
        : 'Only a service that changes an asset’s technical condition enters that asset’s history. Cleaning, meals, shopping, reservations, and other services retain their own order, receipt, and service history.',
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
                ? 'Servicii, Rezervări & Beneficii pentru Membrii Workspace-ului'
                : lang === 'fa'
                ? 'خدمات، رزروها و مزایای اعضای Workspace'
                : 'Workspace Member Services, Bookings & Benefits'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' ? (
              <>
                SERVICE — Servicii și beneficii pe care membrii le pot <span className="text-teal-600">solicita, rezerva sau cumpăra</span>.
              </>
            ) : lang === 'fa' ? (
              <>
                SERVICE — خدمات و مزایایی که اعضای Workspace می‌توانند <span className="text-teal-600">درخواست، رزرو یا خریداری کنند</span>
              </>
            ) : (
              <>
                SERVICE — Services and benefits Workspace members can <span className="text-teal-600">request, book, or purchase</span>.
              </>
            )}
          </h1>

          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Fiecare Workspace decide ce catalog activează pentru membrii săi. SERVICE rămâne separat de mentenanța obligatorie a activelor și infrastructurii comune, administrată prin Operațiuni & Mentenanță.'
              : lang === 'fa'
              ? 'هر Workspace متناسب با اعضا و محیط خود تصمیم می‌گیرد کدام کاتالوگ را فعال کند. SERVICE از نگهداری الزامی دارایی‌ها و زیرساخت‌های مشترک که در «عملیات و نگهداری» مدیریت می‌شود جداست.'
              : 'Each Workspace decides which catalog to activate for its members. SERVICE stays distinct from mandatory upkeep of assets and shared infrastructure, which belongs to Operations & Maintenance.'}
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
                {lang === 'ro' ? 'Fiecare Workspace alege serviciile și modelele potrivite membrilor săi' : lang === 'fa' ? 'هر Workspace خدمات و مدل‌های مناسب اعضای خود را انتخاب می‌کند' : 'Each Workspace chooses the services and models that fit its members'}
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
              {lang === 'ro' ? 'Solicită Integrarea Modulului SERVICE' : lang === 'fa' ? 'درخواست فعال‌سازی SERVICE' : 'Inquire About SERVICE'}
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
