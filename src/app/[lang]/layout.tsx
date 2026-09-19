import React from 'react';
import type { Metadata } from 'next';
import { Inter, Manrope, Vazirmatn } from 'next/font/google';
import { SUPPORTED_LOCALES, getLocaleConfig, getIntlLocale, isSupportedLocale } from '@/types';
import { notFound } from 'next/navigation';
import { AppOrMarketingLayout } from '@/components/layout/AppOrMarketingLayout';
import { getSiteUrl } from '@/config/site';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-vazirmatn',
  display: 'swap',
});

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const isRo = params.lang === 'ro';
  const isFa = params.lang === 'fa';

  let title = 'CLADORA | Residential Asset Operating System & Statutory Accounting';
  let description = 'CLADORA unifies statutory simple-entry accounting, supplemental double-entry controls, 5D owner-tenant rights, and meter OCR on an auditable platform.';
  let keywords = [
    'homeowner association software',
    'condo management operating system',
    'statutory simple entry accounting',
    'double entry analytical ledger',
    'tenant meter readings ocr',
    'residential portfolio software',
    'cladora',
  ];

  if (isRo) {
    title = 'CLADORA | Sistemul de Operare pentru Active Rezidențiale & Contabilitate';
    description = 'CLADORA este concepută pentru a susține registrele statutare în partidă simplă, Legea 196/2018, controlul analitic suplimentar în partidă dublă, drepturile proprietar-chiriaș și citirea contoarelor într-un singur sistem de operare.';
    keywords = [
      'soft asociatie de proprietari',
      'program administrare bloc',
      'contabilitate asociatii proprietari legea 196 2018',
      'avizier digital',
      'citire contoare ocr',
      'software gestiune chirii portofoliu proprietar',
      'migrare xisoft bloc manager',
      'cladora',
    ];
  } else if (isFa) {
    title = 'کلادورا | سیستم‌عامل مدیریت دارایی‌های مسکونی و کنترل‌های حسابداری';
    description = 'کلادورا برای پشتیبانی از دفاتر قانونی حسابداری یک‌طرفه (قانون ۱۹۶/۲۰۱۸)، کنترل تحلیلی تکمیلی دوطرفه، تفکیک ۵ بعدی حقوق مالک و مستأجر و قرائت تصویری کنتورها طراحی شده است.';
    keywords = [
      'نرم افزار مدیریت ساختمان',
      'حسابداری انجمن مالکان',
      'سامانه جامع مدیریت املاک',
      'تابلو اعلانات دیجیتال ساختمان',
      'قرائت هوشمند کنتور آب با عکس',
      'مدیریت سبد املاک استیجاری',
      'کلادورا',
    ];
  }

  const intlLocale = getIntlLocale(params.lang).replace('-', '_');
  const baseUrl = getSiteUrl();

  return {
    title: {
      default: title,
      template: '%s | CLADORA',
    },
    description,
    keywords,
    metadataBase: new URL(baseUrl),
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/brand/favicon.ico' },
        { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
        { url: '/brand/favicon-48.png', sizes: '48x48', type: 'image/png' },
        { url: '/brand/favicon-64.png', sizes: '64x64', type: 'image/png' },
      ],
      apple: [
        { url: '/brand/app/cladora-app-icon-180.png', sizes: '180x180', type: 'image/png' },
      ],
      shortcut: ['/brand/favicon.ico'],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'CLADORA',
    },
    alternates: {
      canonical: `/${params.lang}`,
      languages: {
        ro: '/ro',
        en: '/en',
        fa: '/fa',
        'x-default': '/ro',
      },
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${params.lang}`,
      siteName: 'CLADORA Asset OS',
      locale: intlLocale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LangLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ lang: string }>;
  }
) {
  const params = await props.params;

  if (!isSupportedLocale(params.lang)) {
    notFound();
  }

  const {
    children
  } = props;

  const locale = getLocaleConfig(params.lang);
  const baseUrl = getSiteUrl();
  const isRo = params.lang === 'ro';
  const isFa = params.lang === 'fa';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'CLADORA Asset OS',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0.60',
      priceCurrency: 'EUR',
    },
    description: isRo
      ? 'Sistem de operare pentru active rezidențiale: conceput pentru susținerea registrelor statutare în partidă simplă, control analitic în partidă dublă, Legea 196/2018 și administrare portofoliu.'
      : isFa
      ? 'سیستم‌عامل مدیریت دارایی‌های مسکونی: طراحی‌شده برای پشتیبانی از دفاتر قانونی یک‌طرفه، کنترل تحلیلی تکمیلی، تفکیک حقوق مالک و مستأجر و مدیریت مجتمع‌ها.'
      : 'Residential Asset Operating System designed to support statutory simple-entry accounting, supplemental double-entry controls, meter OCR, and multi-property portfolio management.',
    creator: {
      '@type': 'Organization',
      name: 'CLADORA',
      url: baseUrl,
    },
  };

  const fontVariables = isFa
    ? `${vazirmatn.variable} ${inter.variable}`
    : `${inter.variable} ${manrope.variable}`;

  return (
    <html 
      lang={locale.code} 
      dir={locale.direction}
      className={`${fontVariables} scroll-smooth`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`font-sans min-h-screen bg-[#F6F9FC] text-[#102A43] antialiased ${locale.isRtl ? 'font-vazirmatn' : ''}`}>
        <AppOrMarketingLayout lang={params.lang}>
          {children}
        </AppOrMarketingLayout>
      </body>
    </html>
  );
}
