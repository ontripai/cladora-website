import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Language } from '@/types';
import { buildPageMetadata } from '@/config/seo';
import { getSiteUrl } from '@/config/site';
import { getGuideArticle, getAllGuideArticles } from '@/data/guides-articles';
import {
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Layers,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

export async function generateStaticParams() {
  return [
    { lang: 'en', slug: 'what-is-property-operating-platform' },
    { lang: 'en', slug: 'property-management-software-vs-property-operating-platform' },
    { lang: 'ro', slug: 'asociatii-proprietari-legea-196-2018' },
    { lang: 'ro', slug: 'repartizare-cheltuieli-asociatie-proprietari' },
    { lang: 'fa', slug: 'platform-modiriat-amlak' },
  ];
}

export async function generateMetadata(props: {
  params: Promise<{ lang: Language; slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const article = getGuideArticle(params.slug, params.lang);
  if (!article) {
    return {};
  }

  return buildPageMetadata({
    lang: params.lang,
    path: `/resources/guides/${article.slug}`,
    title: article.seoTitle,
    description: article.description,
    ogType: 'article',
    singleLanguageOnly: true,
  });
}

export default async function GuideArticlePage(props: {
  params: Promise<{ lang: Language; slug: string }>;
}) {
  const params = await props.params;
  const { lang, slug } = params;
  const article = getGuideArticle(slug, lang);

  if (!article) {
    notFound();
  }

  const baseUrl = getSiteUrl();
  const canonicalUrl = `${baseUrl}/${lang}/resources/guides/${article.slug}`;

  const labels = {
    ro: {
      home: 'Acasă',
      resources: 'Resurse',
      guides: 'Ghiduri & Bune Practici',
      directAnswerTitle: 'Răspuns Direct',
      legalDisclaimerTitle: 'Notă privind Caracterul Informativ & Legal',
      faqTitle: 'Întrebări Frecvente Aferente',
      relatedTitle: 'Ghiduri Conexe Recomandate',
      tableOfContents: 'Cuprinsul Articolului',
    },
    en: {
      home: 'Home',
      resources: 'Resources',
      guides: 'Guides & Best Practices',
      directAnswerTitle: 'Direct Answer',
      legalDisclaimerTitle: 'Operational & Legal Disclaimer',
      faqTitle: 'Frequently Asked Questions',
      relatedTitle: 'Related Technical Guides',
      tableOfContents: 'Article Table of Contents',
    },
    fa: {
      home: 'صفحه اصلی',
      resources: 'منابع و مستندات',
      guides: 'راهنماها و معماری',
      directAnswerTitle: 'پاسخ مستقیم',
      legalDisclaimerTitle: 'سلب مسئولیت حقوقی و عملیاتی',
      faqTitle: 'پرسش‌های متداول مرتبط',
      relatedTitle: 'راهنماهای مرتبط',
      tableOfContents: 'سرفصل‌های مقاله',
    },
  }[lang];

  // BreadcrumbList JSON-LD
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: labels.home,
        item: `${baseUrl}/${lang}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: labels.resources,
        item: `${baseUrl}/${lang}/resources`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: labels.guides,
        item: `${baseUrl}/${lang}/resources/guides`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: article.title,
        item: canonicalUrl,
      },
    ],
  };

  // Article / TechArticle JSON-LD
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': article.schemaType,
    headline: article.title,
    description: article.description,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    inLanguage: lang,
    author: {
      '@type': 'Organization',
      name: 'CLADORA',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'CLADORA',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/brand/cladora-logo.svg`,
      },
    },
    datePublished: article.publicationDate,
    dateModified: article.publicationDate,
  };

  return (
    <article className="min-h-screen bg-[#F8FAFC] text-[#1E293B]">
      {/* JSON-LD Schemas */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumbs"
          className="flex items-center space-x-2 rtl:space-x-reverse text-xs text-[#64748B] mb-8 font-medium"
        >
          <Link href={`/${lang}`} className="hover:text-[#0F766E] transition-colors">
            {labels.home}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 rtl:rotate-180 text-[#94A3B8]" />
          <Link href={`/${lang}/resources`} className="hover:text-[#0F766E] transition-colors">
            {labels.resources}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 rtl:rotate-180 text-[#94A3B8]" />
          <Link href={`/${lang}/resources/guides`} className="hover:text-[#0F766E] transition-colors">
            {labels.guides}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 rtl:rotate-180 text-[#94A3B8]" />
          <span className="text-[#0F172A] font-semibold truncate max-w-[200px] sm:max-w-xs">
            {article.category}
          </span>
        </nav>

        {/* Article Header */}
        <header className="mb-10 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <span className="px-3 py-1 rounded-full bg-[#E6F4F1] text-[#0A6E62] border border-[#B2E5DF]">
              {article.category}
            </span>
            <div className="flex items-center gap-1.5 text-[#64748B]">
              <Calendar className="w-3.5 h-3.5" />
              <time dateTime={article.publicationDate}>{article.publicationDate}</time>
            </div>
            <div className="flex items-center gap-1.5 text-[#64748B]">
              <Clock className="w-3.5 h-3.5" />
              <span>{article.readTime}</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-extrabold text-[#0F172A] tracking-tight leading-tight">
            {article.title}
          </h1>

          <p className="text-lg sm:text-xl text-[#475569] leading-relaxed">
            {article.description}
          </p>
        </header>

        {/* Legal / Operational Disclaimer if present */}
        {article.disclaimer && (
          <aside
            aria-label="Legal Disclaimer"
            className="mb-8 p-4 sm:p-5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-xs sm:text-sm leading-relaxed flex items-start gap-3 shadow-sm"
          >
            <ShieldAlert className="w-5 h-5 shrink-0 text-[#D97706] mt-0.5" />
            <div>
              <strong className="block font-bold mb-1 text-[#78350F]">
                {labels.legalDisclaimerTitle}
              </strong>
              <span>{article.disclaimer}</span>
            </div>
          </aside>
        )}

        {/* Direct Answer Callout Box */}
        <section
          aria-labelledby="direct-answer-heading"
          className="mb-12 p-6 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm space-y-3 relative overflow-hidden"
        >
          <div className="absolute top-0 start-0 w-1.5 h-full bg-[#0E9F8E]" />
          <h2
            id="direct-answer-heading"
            className="text-xs font-bold uppercase tracking-wider text-[#0A6E62] flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#0E9F8E]" />
            {labels.directAnswerTitle}
          </h2>
          <p className="text-base sm:text-lg font-medium text-[#1E293B] leading-relaxed">
            {article.directAnswer}
          </p>
        </section>

        {/* Article Body Content */}
        <main className="space-y-12">
          {article.sections.map((section) => (
            <section key={section.id} id={section.id} className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0F172A] pt-4 border-t border-[#E2E8F0]">
                {section.title}
              </h2>
              {section.content.map((p, idx) => (
                <p key={idx} className="text-base text-[#334155] leading-relaxed">
                  {p}
                </p>
              ))}

              {section.subsections && section.subsections.length > 0 && (
                <div className="space-y-6 pt-2 ps-2 sm:ps-4 border-s-2 border-[#E2E8F0]">
                  {section.subsections.map((sub, sIdx) => (
                    <div key={sIdx} className="space-y-2">
                      <h3 className="text-lg sm:text-xl font-bold text-[#1E293B]">
                        {sub.title}
                      </h3>
                      {sub.content.map((subP, subPIdx) => (
                        <p key={subPIdx} className="text-sm sm:text-base text-[#475569] leading-relaxed">
                          {subP}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Comparison / Classification Table */}
          {article.table && (
            <section className="space-y-3 pt-6 border-t border-[#E2E8F0]">
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A]">
                {article.table.caption}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-[#CBD5E1] shadow-sm bg-white">
                <table className="w-full text-left rtl:text-right border-collapse text-xs sm:text-sm">
                  <caption className="sr-only">{article.table.caption}</caption>
                  <thead className="bg-[#F1F5F9] text-[#0F172A] border-b border-[#CBD5E1]">
                    <tr>
                      {article.table.headers.map((h, hIdx) => (
                        <th key={hIdx} className="p-3 sm:p-4 font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {article.table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`p-3 sm:p-4 leading-relaxed ${
                              cIdx === 0 ? 'font-semibold text-[#0F172A]' : 'text-[#475569]'
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* FAQ Section */}
          {article.faqs && article.faqs.length > 0 && (
            <section className="space-y-4 pt-8 border-t border-[#E2E8F0]">
              <div className="flex items-center gap-2 text-[#0A6E62]">
                <HelpCircle className="w-5 h-5 text-[#0E9F8E]" />
                <h2 className="text-2xl font-display font-bold text-[#0F172A]">
                  {labels.faqTitle}
                </h2>
              </div>
              <div className="space-y-3">
                {article.faqs.map((faq, fIdx) => (
                  <div
                    key={fIdx}
                    className="p-5 rounded-xl bg-white border border-[#CBD5E1] space-y-2 shadow-sm"
                  >
                    <h3 className="text-base font-bold text-[#0F172A]">
                      {faq.q}
                    </h3>
                    <p className="text-sm text-[#475569] leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related Guides */}
          {article.relatedGuides && article.relatedGuides.length > 0 && (
            <section className="space-y-4 pt-8 border-t border-[#E2E8F0]">
              <h2 className="text-xl font-bold text-[#0F172A]">
                {labels.relatedTitle}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {article.relatedGuides.map((rel, rIdx) => (
                  <Link
                    key={rIdx}
                    href={`/${rel.lang}/resources/guides/${rel.slug}`}
                    className="p-4 rounded-xl bg-white border border-[#CBD5E1] hover:border-[#0E9F8E] transition-all group shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-[#0E9F8E] shrink-0" />
                      <span className="text-sm font-bold text-[#1E293B] group-hover:text-[#0A6E62] transition-colors">
                        {rel.title}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0E9F8E] shrink-0 rtl:rotate-180" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Contextual Commercial Bridge */}
          <aside className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white shadow-lg space-y-4 mt-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1E293B] border border-[#334155] text-xs font-semibold text-[#2DD4BF]">
              <Layers className="w-3.5 h-3.5" />
              <span>CLADORA Platform</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
              {article.bridge.title}
            </h2>
            <p className="text-sm sm:text-base text-[#94A3B8] max-w-2xl leading-relaxed">
              {article.bridge.description}
            </p>
            <div className="pt-2">
              <Link
                href={article.bridge.href}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0E9F8E] hover:bg-[#0A6E62] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg"
              >
                <span>{article.bridge.buttonText}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
          </aside>
        </main>
      </div>
    </article>
  );
}
