import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Language } from '@/types';
import { buildPageMetadata } from '@/config/seo';
import { getSiteUrl } from '@/config/site';
import { getGuideArticlesForLang } from '@/data/guides-articles';
import {
  ShieldCheck,
  BookOpen,
  Scale,
  FileCheck2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Layers,
  Award,
} from 'lucide-react';

interface AuthorPageProps {
  params: Promise<{ lang: Language; authorSlug: string }>;
}

export async function generateStaticParams() {
  return [
    { lang: 'ro', authorSlug: 'cladora-research' },
    { lang: 'en', authorSlug: 'cladora-research' },
    { lang: 'fa', authorSlug: 'cladora-research' },
  ];
}

export async function generateMetadata(props: AuthorPageProps): Promise<Metadata> {
  const { lang, authorSlug } = await props.params;

  if (authorSlug !== 'cladora-research') {
    return {};
  }

  const titles = {
    ro: 'Echipa de Cercetare & Arhitectură CLADORA | Metodologie & Autori',
    en: 'CLADORA Research & Architecture Team | Methodology & Authors',
    fa: 'تیم پژوهش و معماری کلادورا | متدولوژی و معرفی نگارندگان',
  };

  const descriptions = {
    ro: 'Cine sunt autorii ghidurilor CLADORA: responsabilități, metodologia de cercetare pe baze legale oficiale, politica de revizuire și delimitarea de consultanța juridică.',
    en: 'Authors behind CLADORA canonical guides: research scope, statutory methodology, review cycle, and professional governance boundaries.',
    fa: 'معرفی تیم نگارندگان و پژوهش کلادورا: اصول متدولوژیک، استفاده از مراجع قانونی رسمی، چرخه بازبینی و تفکیک محتوای آموزشی از مشاوره حقوقی.',
  };

  return buildPageMetadata({
    lang,
    path: `/resources/autori/${authorSlug}`,
    title: titles[lang],
    description: descriptions[lang],
  });
}

export default async function AuthorProfilePage(props: AuthorPageProps) {
  const { lang, authorSlug } = await props.params;

  if (authorSlug !== 'cladora-research') {
    notFound();
  }

  const baseUrl = getSiteUrl();
  const canonicalUrl = `${baseUrl}/${lang}/resources/autori/${authorSlug}`;
  const articles = getGuideArticlesForLang(lang);

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        resources: 'Resurse',
        current: 'Echipa de Cercetare CLADORA',
      },
      hero: {
        badge: 'Transparență Editorială & Arhitectură',
        title: 'Echipa de Cercetare & Arhitectură Operațională CLADORA',
        subtitle:
          'Un grup interdisciplinar format din arhitecți de software, consultanți în operațiuni de property management și analiști de procese imobiliare dedicați creării de conținut educativ, transparent și riguros ancorat în legislație.',
      },
      sections: [
        {
          id: 'responsabilitate',
          title: '1. Domeniul de Responsabilitate al Echipei',
          icon: ShieldCheck,
          text: 'Echipa de Cercetare & Arhitectură CLADORA răspunde de definirea standardelor metodologice, documentarea ghidurilor canonice și modelarea proceselor operaționale pentru clădiri rezidențiale, comerciale și mixte. Misiunea noastră este de a transforma procedurile opace din administrarea tradițională în fluxuri verificabile, bazate pe date curate și algoritmi explicabili.',
        },
        {
          id: 'metodologie',
          title: '2. Metodologia de Cercetare și Documentare',
          icon: BookOpen,
          text: 'Fiecare ghid publicat parcurge un proces riguros de verificare: 1. Cartografierea problemelor reale întâmpinate de administratori, proprietari și companii de facility management; 2. Analiza matematică și algoritmică a formulelor de repartizare; 3. Validarea pe scenarii practice din condominii reale; 4. Redactarea unor explicații clare, accesibile atât nespecialiștilor, cât și experților.',
        },
        {
          id: 'surse-oficiale',
          title: '3. Utilizarea Exclusivă a Surselor Legislative Oficiale',
          icon: Scale,
          text: 'Pentru analizele privind piața din România, ne raportăm strict la actele normative oficiale publicate în Monitorul Oficial al României și accesibile pe portalul legislativ al Ministerului Justiției (legislatie.just.ro), cu prioritate: Legea nr. 196/2018 (asociații de proprietari), Legea nr. 64/2008 (regimul ISCIR), H.G. nr. 273/1994 (cartea tehnică a construcției) și Legea nr. 82/1991 (contabilitate). Nu utilizăm interpretări neverificate sau surse secundare nesigure.',
        },
        {
          id: 'politica-revizuire',
          title: '4. Politica de Revizuire Periodică și Corectură',
          icon: RefreshCw,
          text: 'Ghidurile noastre sunt supuse unei revizuiri tehnice periodice pentru a reflecta modificările legislative, deciziile Curții Constituționale sau ale Înaltei Curți de Casație și Justiție, precum și noile standarde inginerești. Orice eroare semnalată de cititori sau colaboratori este investigată cu promptitudine, iar actualizările sunt marcate transparent cu data ultimei revizuiri.',
        },
        {
          id: 'delimitare-legala',
          title: '5. Delimitarea dintre Ghiduri și Consultanța de Specialitate',
          icon: AlertTriangle,
          text: 'Toate materialele publicate de echipa CLADORA au scop strict educativ, metodologic și informativ. Acestea nu reprezintă și nu pot înlocui asistența sau consultanța juridică autorizată (acordată de avocați), consultanța financiar-contabilă (oferită de experți contabili autorizați CECCAR) sau expertizele tehnice autorizate. Pentru spețe concrete sau litigii particulare, recomandăm întotdeauna apelarea la profesioniști acreditați.',
        },
      ],
      articlesSectionTitle: 'Ghiduri Elaborate de Această Echipă',
      readGuide: 'Citește ghidul complet',
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        resources: 'Resources',
        current: 'CLADORA Research Team',
      },
      hero: {
        badge: 'Editorial Governance & Transparency',
        title: 'CLADORA Research & Operational Architecture Team',
        subtitle:
          'An interdisciplinary group of software architects, property operations consultants, and real estate systems analysts dedicated to producing rigorous, evidence-based canonical literature for the built environment.',
      },
      sections: [
        {
          id: 'responsabilitate',
          title: '1. Team Scope & Responsibilities',
          icon: ShieldCheck,
          text: 'The CLADORA Research & Architecture team is tasked with establishing operational standards, authoring canonical architectural playbooks, and analyzing property workflows across residential, commercial, and mixed-use portfolios.',
        },
        {
          id: 'metodologie',
          title: '2. Research & Documentation Methodology',
          icon: BookOpen,
          text: 'Every published guide undergoes a structured vetting process: analyzing field fragmentation points, validating mathematical allocation models, and drafting transparent operational frameworks.',
        },
        {
          id: 'surse-oficiale',
          title: '3. Grounding in Official Statutory Sources',
          icon: Scale,
          text: 'Our technical literature references authoritative legal documents, national building codes, and engineering standards published in official gazettes and statutory registers.',
        },
        {
          id: 'politica-revizuire',
          title: '4. Continuous Review & Update Policy',
          icon: RefreshCw,
          text: 'Guides are reviewed periodically to reflect regulatory updates, judicial rulings, and advancements in operating technology. Revisions are timestamped with full version transparency.',
        },
        {
          id: 'delimitare-legala',
          title: '5. Boundary Between Education and Professional Counsel',
          icon: AlertTriangle,
          text: 'All published articles serve educational and architectural purposes. They do not constitute formal legal, financial, or engineering advice for individual disputes or specific deployments.',
        },
      ],
      articlesSectionTitle: 'Articles Authored by this Team',
      readGuide: 'Read full guide',
    },
    fa: {
      breadcrumbs: {
        home: 'صفحه اصلی',
        resources: 'منابع و مستندات',
        current: 'تیم پژوهش کلادورا',
      },
      hero: {
        badge: 'شفافیت تحریریه و متدولوژی',
        title: 'گروه پژوهش و معماری سیستم‌های عملیاتی کلادورا',
        subtitle:
          'تیمی چندرشته‌ای از معماران نرم‌افزار، مشاوران مدیریت بهره‌برداری املاک و تحلیل‌گران سیستم‌ها که به تولید متون مرجع، مستندات آموزشی و تحلیل‌های ساختاریافته می‌پردازند.',
      },
      sections: [
        {
          id: 'responsabilitate',
          title: '۱. حوزه مسئولیت و ماموریت تیم',
          icon: ShieldCheck,
          text: 'این گروه مسئول تدوین چارچوب‌های استاندارد، تبیین معماری پلتفرم و مستندسازی متدولوژی‌های مدیریت عملیاتی در ساختمان‌های مسکونی، تجاری و مختلط است.',
        },
        {
          id: 'metodologie',
          title: '۲. روش پژوهش و اعتبارسنجی',
          icon: BookOpen,
          text: 'فرآیند تدوین مقالات شامل شناسایی چالش‌های واقعی مدیران، اعتبارسنجی الگوهای محاسباتی و ارائه پاسخ‌های روشن و مستند است.',
        },
        {
          id: 'surse-oficiale',
          title: '۳. تکیه بر مراجع رسمی و استانداردهای معتبر',
          icon: Scale,
          text: 'مطالب منتشرشده همواره با قوانین رسمی، آیین‌نامه‌های ساختمانی و استانداردهای تخصصی مطابقت داده می‌شوند.',
        },
        {
          id: 'politica-revizuire',
          title: '۴. سیاست بازبینی ادواری و به‌روزرسانی',
          icon: RefreshCw,
          text: 'مستندات به صورت منظم بازبینی شده و در صورت تغییر قوانین یا ارتقای استانداردها، نسخه‌های به‌روزشده با ذکر تاریخ منتشر می‌شوند.',
        },
        {
          id: 'delimitare-legala',
          title: '۵. تفکیک محتوای آموزشی از مشاوره تخصصی',
          icon: AlertTriangle,
          text: 'تمامی مقالات دارای جنبه تبیینی و آموزشی هستند و جایگزین خدمات مشاوره حقوقی، مالی یا مهندسی رسمی برای پرونده‌های خاص تلقی نمی‌شوند.',
        },
      ],
      articlesSectionTitle: 'راهنماهای تدوین‌شده توسط این تیم',
      readGuide: 'مطالعه کامل راهنما',
    },
  }[lang];

  const authorSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: lang === 'fa' ? 'گروه پژوهش و معماری کلادورا' : 'CLADORA Research & Operational Architecture',
    url: canonicalUrl,
    description: content.hero.subtitle,
    publisher: {
      '@type': 'Organization',
      name: 'CLADORA',
      url: baseUrl,
    },
  };

  return (
    <main className="min-h-screen pt-28 pb-20 bg-[#F8FAFC] text-[#1E293B]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center space-x-2 rtl:space-x-reverse text-xs text-[#64748B] font-medium"
        >
          <Link href={`/${lang}`} className="hover:text-[#0F766E] transition-colors">
            {content.breadcrumbs.home}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 rtl:rotate-180 text-[#94A3B8]" />
          <Link href={`/${lang}/resources`} className="hover:text-[#0F766E] transition-colors">
            {content.breadcrumbs.resources}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 rtl:rotate-180 text-[#94A3B8]" />
          <span className="text-[#0F172A] font-semibold">{content.breadcrumbs.current}</span>
        </nav>

        {/* Hero Header */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F4F1] text-[#0A6E62] border border-[#B2E5DF] text-xs font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            <span>{content.hero.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-[#0F172A] tracking-tight leading-tight">
            {content.hero.title}
          </h1>
          <p className="text-base sm:text-lg text-[#475569] leading-relaxed">
            {content.hero.subtitle}
          </p>
        </header>

        {/* Methodology Standards Cards */}
        <section className="space-y-6">
          {content.sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <div
                key={sec.id}
                className="p-6 sm:p-7 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#E6F4F1] text-[#0A6E62] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-[#0F172A]">{sec.title}</h2>
                </div>
                <p className="text-sm sm:text-base text-[#475569] leading-relaxed pl-12 rtl:pl-0 rtl:pr-12">
                  {sec.text}
                </p>
              </div>
            );
          })}
        </section>

        {/* Authored Guides Listing */}
        <section className="space-y-6 pt-6 border-t border-[#CBD5E1]">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-extrabold text-[#0F172A]">
              {content.articlesSectionTitle} ({articles.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {articles.map((art) => (
              <article
                key={art.id}
                className="p-6 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#0E9F8E] transition-all shadow-sm flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#64748B]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#475569] font-semibold">
                      {art.category}
                    </span>
                    <span>{art.readTime}</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#0F172A] group-hover:text-[#0A6E62] transition-colors">
                    <Link href={`/${lang}/resources/guides/${art.slug}`}>{art.title}</Link>
                  </h3>
                  <p className="text-xs sm:text-sm text-[#475569] line-clamp-2">
                    {art.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#0A6E62]">
                  <Link
                    href={`/${lang}/resources/guides/${art.slug}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <span>{content.readGuide}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Link>
                  <span className="text-[#94A3B8] font-normal">{art.publicationDate}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Return to Guides Hub */}
        <div className="pt-4 flex justify-center">
          <Link
            href={`/${lang}/resources/guides`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] font-bold text-sm transition-all shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-[#0E9F8E]" />
            <span>
              {lang === 'ro'
                ? 'Înapoi la Centrul de Ghiduri'
                : lang === 'fa'
                ? 'بازگشت به کتابخانه راهنماها'
                : 'Back to Guides Library'}
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
