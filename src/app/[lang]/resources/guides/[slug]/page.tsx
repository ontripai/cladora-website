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
  ExternalLink,
  UserCheck,
} from 'lucide-react';

export async function generateStaticParams() {
  const articles = getAllGuideArticles();
  return articles.map((article) => ({
    lang: article.lang,
    slug: article.slug,
  }));
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
  const authorUrl = `${baseUrl}${article.authorUrl.startsWith('/') ? article.authorUrl : `/${article.authorUrl}`}`;

  const labels = {
    ro: {
      home: 'Acasă',
      resources: 'Resurse',
      guides: 'Ghiduri & Bune Practici',
      directAnswerTitle: 'Răspuns Direct',
      legalDisclaimerTitle: 'Notă privind Caracterul Informativ & Cadrul Legal',
      faqTitle: 'Întrebări Frecvente Aferente',
      relatedTitle: 'Ghiduri Conexe Recomandate',
      tableOfContents: 'Cuprinsul Articolului',
      authorLabel: 'Autor:',
      reviewerLabel: 'Revizuit de:',
      publishedOn: 'Publicat:',
      updatedOn: 'Actualizat:',
      editorialNote: 'Metodologie editorială: Documentat pe baza cadrului normativ oficial și a standardelor tehnice de operare imobiliară.',
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
      authorLabel: 'Author:',
      reviewerLabel: 'Reviewed by:',
      publishedOn: 'Published:',
      updatedOn: 'Updated:',
      editorialNote: 'Editorial methodology: Documented against statutory regulations and technical property operations frameworks.',
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
      authorLabel: 'نویسنده:',
      reviewerLabel: 'بازبینی‌شده توسط:',
      publishedOn: 'تاریخ انتشار:',
      updatedOn: 'تاریخ بازبینی:',
      editorialNote: 'متدولوژی تدوین: نگارش بر مبنای استانداردهای معماری عملیاتی و مراجع معتبر فنی.',
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
    image: `${baseUrl}/brand/cladora-og.png`,
    author: {
      '@type': 'Organization',
      name: article.authorName,
      url: authorUrl,
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
    datePublished: article.datePublished || article.publicationDate,
    dateModified: article.dateModified || article.publicationDate,
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
              <span>{labels.publishedOn}</span>
              <time dateTime={article.publicationDate}>{article.publicationDate}</time>
            </div>
            {article.dateModified && article.dateModified !== article.publicationDate && (
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <span>{labels.updatedOn}</span>
                <time dateTime={article.dateModified}>{article.dateModified}</time>
              </div>
            )}
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

          {/* Author & Reviewer Byline */}
          <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#64748B]">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#0E9F8E]" />
              <span>{labels.authorLabel}</span>
              <Link
                href={article.authorUrl}
                className="font-semibold text-[#0F172A] hover:text-[#0E9F8E] transition-colors underline underline-offset-2"
              >
                {article.authorName}
              </Link>
            </div>
            {article.reviewedBy && (
              <div className="flex items-center gap-1.5 text-[#64748B]">
                <span className="text-[#CBD5E1] hidden sm:inline">•</span>
                <span>{labels.reviewerLabel}</span>
                <span className="font-semibold text-[#334155]">{article.reviewedBy}</span>
              </div>
            )}
          </div>
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

        {/* Direct Answer Box (Core Snippet / Intent Response) */}
        <section
          aria-label="Direct Answer"
          className="mb-10 p-6 sm:p-7 rounded-2xl bg-[#E6F4F1] border-2 border-[#0A6E62]/30 shadow-card space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0A6E62]">
            <CheckCircle2 className="w-4 h-4 text-[#0A6E62]" />
            <span>{labels.directAnswerTitle}</span>
          </div>
          <p className="text-base sm:text-lg text-[#102A43] font-medium leading-relaxed">
            {article.directAnswer}
          </p>
        </section>

        {/* Table of Contents */}
        <nav
          aria-label="Table of Contents"
          className="mb-12 p-6 rounded-2xl bg-white border border-[#CBD5E1] shadow-sm space-y-3"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
            {labels.tableOfContents}
          </div>
          <ul className="space-y-2 text-sm">
            {article.sections.map((sec, idx) => (
              <li key={sec.id} className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold text-xs">{idx + 1}.</span>
                <a
                  href={`#${sec.id}`}
                  className="text-[#1E293B] hover:text-[#0A6E62] transition-colors hover:underline font-medium"
                >
                  {sec.title}
                </a>
              </li>
            ))}
            {article.table && (
              <li className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold text-xs">📊</span>
                <a
                  href="#tabel-comparativ"
                  className="text-[#1E293B] hover:text-[#0A6E62] transition-colors hover:underline font-medium"
                >
                  {article.table.caption}
                </a>
              </li>
            )}
            {article.faqs && article.faqs.length > 0 && (
              <li className="flex items-center gap-2">
                <span className="text-[#0E9F8E] font-bold text-xs">❓</span>
                <a
                  href="#intrebari-frecvente"
                  className="text-[#1E293B] hover:text-[#0A6E62] transition-colors hover:underline font-medium"
                >
                  {labels.faqTitle}
                </a>
              </li>
            )}
          </ul>
        </nav>

        {/* Article Body Content */}
        <main className="space-y-12 leading-relaxed text-[#334155] text-base sm:text-lg">
          {article.sections.map((sec) => (
            <section key={sec.id} id={sec.id} className="space-y-4 scroll-mt-24">
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#0F172A] tracking-tight">
                {sec.title}
              </h2>

              <div className="space-y-4 text-[#334155]">
                {sec.content.map((p, pIdx) => (
                  <p key={pIdx} className="leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>

              {sec.subsections && sec.subsections.length > 0 && (
                <div className="space-y-6 pt-4">
                  {sec.subsections.map((sub, subIdx) => (
                    <div
                      key={subIdx}
                      className="p-5 rounded-xl bg-white border border-[#E2E8F0] space-y-2 shadow-sm"
                    >
                      <h3 className="text-lg sm:text-xl font-bold text-[#0F172A]">
                        {sub.title}
                      </h3>
                      {sub.content.map((sp, spIdx) => (
                        <p key={spIdx} className="text-sm sm:text-base text-[#475569] leading-relaxed">
                          {sp}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Structured Practical Comparison / Reference Table */}
          {article.table && (
            <section id="tabel-comparativ" className="space-y-4 pt-6 scroll-mt-24">
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#0F172A] tracking-tight">
                {article.table.caption}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-[#CBD5E1] bg-white shadow-sm">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <caption className="sr-only">{article.table.caption}</caption>
                  <thead>
                    <tr className="bg-[#F1F5F9] border-b border-[#CBD5E1] text-[#0F172A]">
                      {article.table.headers.map((h, hIdx) => (
                        <th key={hIdx} className="p-3 sm:p-4 font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {article.table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#F8FAFC] transition-colors">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`p-3 sm:p-4 text-[#334155] ${
                              cIdx === 0 ? 'font-bold text-[#0F172A]' : ''
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

          {/* Visible FAQ Section */}
          {article.faqs && article.faqs.length > 0 && (
            <section id="intrebari-frecvente" className="space-y-6 pt-6 scroll-mt-24">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0A6E62]">
                <HelpCircle className="w-4 h-4 text-[#0A6E62]" />
                <span>{labels.faqTitle}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#0F172A] tracking-tight">
                {labels.faqTitle}
              </h2>
              <div className="space-y-4">
                {article.faqs.map((faq, fIdx) => (
                  <div
                    key={fIdx}
                    className="p-5 sm:p-6 rounded-2xl bg-white border border-[#CBD5E1] space-y-2 shadow-sm"
                  >
                    <h3 className="text-lg sm:text-xl font-bold text-[#0F172A]">
                      {faq.q}
                    </h3>
                    <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related Guides Context Links */}
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

          {/* Legal Sources and Context */}
          {article.legalSources && article.legalSources.length > 0 && (
            <section className="space-y-3 pt-6 border-t border-[#E2E8F0]">
              <h2 className="text-xl font-bold text-[#0F172A]">
                {lang === 'ro' ? 'Surse Legislative & Cadrul Oficial' : 'Legal Sources & Official Context'}
              </h2>
              <ul className="space-y-2 text-xs sm:text-sm text-[#475569]">
                {article.legalSources.map((src, sIdx) => (
                  <li key={sIdx} className="p-4 rounded-xl bg-white border border-[#E2E8F0] space-y-1">
                    <div className="font-semibold text-[#0F172A] flex items-center justify-between gap-2">
                      <span>{src.title}</span>
                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0E9F8E] hover:underline text-xs"
                        >
                          <span>Portal Legislativ</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-[#64748B]">{src.reference}</div>
                    <div className="text-xs text-[#94A3B8]">
                      {lang === 'ro' ? 'Verificat / text consolidat:' : 'Verified:'} {src.accessDate}
                    </div>
                  </li>
                ))}
              </ul>
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
