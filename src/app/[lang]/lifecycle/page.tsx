import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building, 
  Sparkles, 
  KeyRound, 
  Home, 
  Wrench, 
  TrendingUp, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Clock,
  Compass
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
  return getRouteMetadata('/lifecycle', params.lang);
}

export default async function LifecyclePage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const stages = [
    {
      num: '01',
      title: lang === 'ro' ? 'Definire Identitate & Pre-vânzare' : lang === 'fa' ? 'تعریف هویت پروژه، مستندات و پیش‌فروش' : 'Project Definition & Pre-Sale',
      tag: lang === 'ro' ? 'Înainte de recepția clădirii' : lang === 'fa' ? 'پیش از تکمیل فیزیکی ساختمان' : 'Pre-construction phase',
      icon: Sparkles,
      desc: lang === 'ro'
        ? 'CLADORA începe înainte de finalizarea construcției: stabilirea topologiei unităților, cotelor indivize, atragerea oportunităților în AIRPROP, rezervări și stocarea securizată a documentației tehnice inițiale.'
        : lang === 'fa'
        ? 'همراهی کلادورا می‌تواند پیش از تکمیل ساختمان آغاز شود: تعریف شناسنامه واحدها، سهم مشاعات، ثبت متقاضیان و پیش‌فروش در AIRPROP و بایگانی نقشه‌ها و تاییدیه‌های فنی.'
        : 'CLADORA begins before construction completion: spatial topologies, joint-ownership quotas, pre-sales leads, reservations, and technical blueprints vaulting.',
      boundaries: lang === 'ro'
        ? 'Delimitare: Managementul șantierului și dirigenția de șantier nu fac parte din produs.'
        : lang === 'fa'
        ? 'مرز محصول: کنترل عملیات اجرایی کارگاه ساخت و مدیریت پیمانکاران سازه خارج از دامنهٔ سیستم است.'
        : 'Boundary: Physical construction site scheduling and contractor site execution remain out of scope.',
    },
    {
      num: '02',
      title: lang === 'ro' ? 'Predare-Primire Completă sau Parțială & Punch-List' : lang === 'fa' ? 'تحویل کامل یا جزئی و پیگیری موارد باقیمانده' : 'Full or Partial Handover & Punch-List Tracking',
      tag: lang === 'ro' ? 'Tranziția către locatari' : lang === 'fa' ? 'نقطه تحویل و رفع نقایص' : 'Delivery & defect resolution',
      icon: KeyRound,
      desc: lang === 'ro'
        ? 'Predarea protocolară a fiecărui spațiu și a părților comune (recepție completă sau pe etape/parțială). Urmărirea remedierilor (punch-list), citirea inițială a contoarelor și activarea conturilor de proprietar.'
        : lang === 'fa'
        ? 'فرایند رسمی تحویل کامل یا فازبندی‌شده/جزئی واحدها و مشاعات به خریداران یا انجمن مالکان. ثبت صورت‌جلسه تحویل، پیگیری دقیق نقایص و تعهدات باز (Punch-List)، ثبت ارقام اولیه کنتورها و مستندسازی حقوق.'
        : 'Formal digital unit acceptance protocols for full or partial phased handovers, punch-list defect resolution tracking, baseline utility meter registration, and initial owner onboarding.',
      boundaries: lang === 'ro'
        ? 'Delimitare: Serviciile CLADORA nu se opresc aici—ele continuă pe toată durata vieții imobilului.'
        : lang === 'fa'
        ? 'مرز محصول: خدمات با تحویل واحدها پایان نمی‌یابند؛ بلکه داده‌های تحویل مبنای دهه‌ها بهره‌برداری بعدی قرار می‌گیرند.'
        : 'Boundary: Services do not end at handover—they establish the factual foundation for ongoing operations.',
    },
    {
      num: '03',
      title: lang === 'ro' ? 'Exploatare Zilnică & Servicii de Locuire' : lang === 'fa' ? 'بهره‌برداری فعال، سکونت و خدمات روزمره' : 'Active Living & Operations',
      tag: lang === 'ro' ? 'Viața activă a comunității' : lang === 'fa' ? 'دوره سکونت و فعالیت مستمر' : 'Daily living phase',
      icon: Home,
      desc: lang === 'ro'
        ? 'Evidența transparentă a cotelor lunare de plată, reconciliere bancară fără erori, avizier digital, adunări generale cu vot auditat și acces securizat pentru vizitatori.'
        : lang === 'fa'
        ? 'تسهیم کاملاً مستند هزینه‌ها و شارژ ماهانه، تطبیق تراکنش‌های بانکی، اعلانات دیجیتال، برگزاری مجامع با رأی‌گیری و هماهنگی تردد مراجعان.'
        : 'Statutory payment lists, zero-variance bank reconciliations, digital notice boards, verified AGM votes, and visitor access control.',
      boundaries: lang === 'ro'
        ? 'Delimitare: Accesul este strict condiționat de rol (chiriașul vede doar consumurile proprii).'
        : lang === 'fa'
        ? 'مرز محصول: دسترسی هر شخص فقط در حد نقش اوست؛ مستأجر هرگز دفاتر مالی یا اسناد محرمانه مالک را نمی‌بیند.'
        : 'Boundary: Strict role-based isolation ensures tenants never view confidential owner ledgers.',
    },
    {
      num: '04',
      title: lang === 'ro' ? 'Mentenanță & Păstrare Valoare Activ' : lang === 'fa' ? 'نگهداری پیشگیرانه و حفظ ارزش دارایی' : 'Maintenance & Asset Care',
      tag: lang === 'ro' ? 'Integritatea tehnică' : lang === 'fa' ? 'پایش سلامت تجهیزات فنی' : 'Preventative care',
      icon: Wrench,
      desc: lang === 'ro'
        ? 'Evidența echipamentelor tehnice pe fișa activului, calendare de revizii periodice, sesizări de avarii, emiterea comenzilor de lucru și istoricul costurilor.'
        : lang === 'fa'
        ? 'ثبت و ردیابی تجهیزات در شناسنامه دارایی، تقویم سرویس‌های دوره‌ای، گزارش خرابی‌ها، صدور دستورکار برای تعمیرکاران و ثبت سوابق هزینه‌ها.'
        : 'Equipment logbooks, scheduled preventative plans, fault ticket triage, work order dispatch, and auditable maintenance costs.',
      boundaries: lang === 'ro'
        ? 'Delimitare: Nu se fac plăți fără proces-verbal de recepție calitativă semnat.'
        : lang === 'fa'
        ? 'مرز محصول: هیچ پرداختی بدون تاییدیه کیفی انجام کار در سیستم نهایی نمی‌شود.'
        : 'Boundary: No repair invoice is paid without verified technical acceptance.',
    },
    {
      num: '05',
      title: lang === 'ro' ? 'Închiriere & Mandat de Administrare' : lang === 'fa' ? 'مدیریت اجاره و واگذاری بهره‌برداری' : 'Leasing & Property Mandates',
      tag: lang === 'ro' ? 'Randament și conformitate' : lang === 'fa' ? 'تنظیم روابط موجر و مستأجر' : 'Tenancy lifecycle',
      icon: TrendingUp,
      desc: lang === 'ro'
        ? 'Gestiunea contractelor de închiriere, urmărirea încasărilor, separarea automată a utilităților curente de fondul de rulment și delegarea către manageri autorizați.'
        : lang === 'fa'
        ? 'مدیریت قراردادهای اجاره، پیگیری دریافت اجاره‌بها، تفکیک خودکار هزینه‌های مصرفی مستأجر از تعهدات مالک و واگذاری مدیریت به کارگزاران املاک.'
        : 'Lease tracking, rent receivables, automated tenant utility separation, and property management mandates with bounded spending limits.',
      boundaries: lang === 'ro'
        ? 'Delimitare: Schimbarea chiriașului nu resetează istoricul unității sau indexurile vechi.'
        : lang === 'fa'
        ? 'مرز محصول: تخلیه یا تعویض مستأجر هرگز سابقه معتبر واحد یا کنتورها را مخدوش نمی‌کند.'
        : 'Boundary: Tenant turnover never destroys unit history or verified historical readings.',
    },
    {
      num: '06',
      title: lang === 'ro' ? 'Tranzacții Viitoare, Ieșire din Serviciu & Predare Responsabilitate' : lang === 'fa' ? 'معاملات بعدی، خروج از خدمت و تحویل مسئولیت' : 'Subsequent Transfers, Decommissioning & Succession',
      tag: lang === 'ro' ? 'Continuitate patrimonială & arhivare' : lang === 'fa' ? 'انتقال مسئولیت و بستن تعهدات' : 'Accountable succession & retention',
      icon: RefreshCw,
      desc: lang === 'ro'
        ? 'Vânzarea imobilului, schimbarea administratorului sau retragerea unui echipament/spațiu din exploatare. Responsabilitățile se încheie ordonat, sarcinile deschise se clarifică, acțiunile istorice rămân atribuite autorilor inițiali, iar noul titular preia doar evidențele autorizate conform politicii de retenție.'
        : lang === 'fa'
        ? 'فروش مجدد ملک، تغییر شرکت مدیریت یا خروج یک فضا/تجهیز از بهره‌برداری. مسئولیت‌های پیشین با تعیین تکلیف کارهای باز به‌صورت شفاف بسته می‌شوند؛ اقدامات گذشته به نام اشخاص قبلی محفوظ می‌مانند و جانشین صرفاً سوابق مجاز را طبق سیاست معتبر نگهداری تحویل می‌گیرد.'
        : 'Resale, management turnover, or equipment decommissioning. Prior responsibilities close gracefully, open tasks are settled, historical actions remain permanently credited to initial actors, and successors receive authorized records under governance retention policy.',
      boundaries: lang === 'ro'
        ? 'Delimitare: Retenția datelor respectă politicile autorizate; datele vechi nu se rescriu.'
        : lang === 'fa'
        ? 'مرز محصول: نگهداری سوابق تابع مجوز و سیاست نگهداری است؛ اقدامات گذشته بازنویسی نمی‌شوند.'
        : 'Boundary: Record retention operates under verified policy; historical entries are never rewritten.',
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
            {lang === 'ro' ? 'Ciclul de Viață al Proprietății' : lang === 'fa' ? 'چرخهٔ عمر ملک' : 'Property Lifecycle'}
          </span>
        </div>

        {/* Hero Section */}
        <div className="max-w-4xl space-y-4">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Viziunea de Ansamblu CLADORA' : lang === 'fa' ? 'پیوستگی اطلاعات در طول زمان' : 'Enduring Lifecycle Vision'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Ciclul de Viață Complet al unei Proprietăți Gestionate' 
              : lang === 'fa' 
              ? 'پیوستگی سوابق و خدمات در تمام مراحل چرخهٔ عمر ملک' 
              : 'The Full Lifecycle of Managed Real Estate'}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'CLADORA oferă o coloană vertebrală digitală stabilă care traversează etapele unui imobil. Schimbarea dezvoltatorului, a proprietarului, a chiriașului sau a administratorului nu șterge adevărul faptic și nu întrerupe evidența contabilă.'
              : lang === 'fa'
              ? 'CLADORA ستون فقرات دیجیتال پایداری است که از شکل‌گیری نخستین نقشه تا دهه‌ها زندگی و انتقال مالکیت همراه ملک می‌ماند؛ بدون آنکه جابه‌جایی افراد یا سازمان‌ها باعث گسست در مدارک و سوابق شود.'
              : 'CLADORA provides an enduring operational spine. Transitions in tenancy, management mandates, or property ownership never wipe verified historical records.'}
          </p>
        </div>

        {/* 6 Stages Timeline */}
        <div className="space-y-8">
          {stages.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div 
                key={idx}
                className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-4 hover:border-[#0E9F8E] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0F4F8] pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-mono font-extrabold text-[#0E9F8E]">
                        {lang === 'ro' ? `ETAPA ${st.num}` : lang === 'fa' ? `مرحلهٔ ${st.num}` : `STAGE ${st.num}`}
                      </span>
                      <h3 className="text-xl sm:text-2xl font-bold text-[#102A43]">
                        {st.title}
                      </h3>
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-[#627D98] bg-[#F0F4F8] px-3 py-1 rounded-full self-start sm:self-auto">
                    {st.tag}
                  </span>
                </div>

                <p className="text-sm sm:text-base text-[#334E68] leading-relaxed">
                  {st.desc}
                </p>

                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#52667A] leading-relaxed">
                    {st.boundaries}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Action Box */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold max-w-2xl mx-auto">
            {lang === 'ro' 
              ? 'Conectează-ți proprietatea la un sistem conceput pe termen lung' 
              : lang === 'fa' 
              ? 'ملک خود را به سامانه‌ای با نگاه پایدار و درازمدت متصل کنید' 
              : 'Connect Your Property to Long-Term Operational Continuity'}
          </h2>
          <p className="text-xs sm:text-sm text-[#CBD5E1] max-w-xl mx-auto leading-relaxed">
            {lang === 'ro'
              ? 'Indiferent dacă ești în faza de proiect, în curs de predare sau gestionezi un imobil locuit de mulți ani, CLADORA structurează datele imediat.'
              : lang === 'fa'
              ? 'چه در مرحله تعریف نقشه و پیش‌فروش باشید، چه در حال تحویل و چه در حال بهره‌برداری از ساختمانی باسابقه، کلادورا داده‌های شما را منظم می‌کند.'
              : 'Whether you are marketing pre-sales or managing seasoned commercial estates, CLADORA brings immediate structural order.'}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-8 py-3.5 text-xs font-bold text-[#102A43] bg-[#14B8A6] hover:bg-[#2DD4BF] rounded-xl transition-all shadow-md"
            >
              {lang === 'ro' ? 'Solicită Evaluarea Proiectului' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Start Project Inquiry'}
            </Link>
            <Link
              href={`/${lang}/platform`}
              className="w-full sm:w-auto px-8 py-3.5 text-xs font-bold text-white bg-[#173F5F] hover:bg-[#204E75] border border-[#244A6F] rounded-xl transition-all"
            >
              {lang === 'ro' ? 'Vezi Modelul Workspace' : lang === 'fa' ? 'بررسی مدل Workspace' : 'Explore Workspace Architecture'}
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
