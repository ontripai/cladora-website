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

  let title = 'CLADORA | The Operating Platform for the Built World';
  let description = 'CLADORA is the unified operating platform for properties, spaces, and physical assets—connecting property identity, authorized workspaces, and operational domains across the asset lifecycle.';
  let keywords = [
    'property operating platform',
    'built world operating system',
    'real estate lifecycle operations',
    'property identity registry',
    'workspace authorization model',
    'airprop sales and leasing',
    'facility maintenance operations',
    'cladora',
  ];

  if (isRo) {
    title = 'CLADORA | Platforma de Operare pentru Proprietăți & Active Imobiliare';
    description = 'CLADORA este platforma unificată de operare pentru proprietăți, spații și active fizice. Conectează identitatea activelor, spațiile de lucru autorizate și domeniile operaționale pe întregul ciclu de viață.';
    keywords = [
      'platforma operare proprietati',
      'sistem operare active imobiliare',
      'ciclul de viata al proprietatii',
      'identitate imobiliara persistenta',
      'workspace imobiliar unificat',
      'mentenanta tehnica si operatiuni',
      'cladora',
    ];
  } else if (isFa) {
    title = 'CLADORA | پلتفرم جامع عملیات و مدیریت برای املاک، فضا و دارایی‌ها';
    description = 'CLADORA پلتفرم یکپارچهٔ عملیات و مدیریت برای املاک، فضاها و دارایی‌های فیزیکی است که هویت پایدار ملک، ورک‌اسپیس‌های مجاز و دامنه‌های عملیاتی را در سراسر چرخهٔ عمر به یکدیگر پیوند می‌دهد.';
    keywords = [
      'پلتفرم مدیریت دارایی و املاک',
      'سیستم عامل یکپارچه ملک',
      'پیوستگی چرخه عمر املاک',
      'معماری ورک اسپیس سازمانی',
      'عملیات و نگهداری فنی ساختمان',
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
    name: 'CLADORA Property & Asset Operating Platform',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    description: isRo
      ? 'CLADORA este platforma de operare unificată pentru proprietăți, spații și active fizice. Conectează identitatea activelor, spațiile de lucru autorizate și domeniile operaționale pe întregul ciclu de viață.'
      : isFa
      ? 'CLADORA پلتفرم یکپارچهٔ عملیات و مدیریت برای املاک، فضاها و دارایی‌های فیزیکی است که هویت پایدار ملک، ورک‌اسپیس‌های مجاز و دامنه‌های عملیاتی را در سراسر چرخهٔ عمر به یکدیگر پیوند می‌دهد.'
      : 'CLADORA is the unified operating platform for properties, spaces, and physical assets—connecting property identity, authorized workspaces, and operational domains across the asset lifecycle.',
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
      <body className={`font-sans min-h-screen bg-[#F6F9FC] text-[#102A43] antialiased overflow-x-hidden ${locale.isRtl ? 'font-vazirmatn' : ''}`}>
        <AppOrMarketingLayout lang={params.lang}>
          {children}
        </AppOrMarketingLayout>
      </body>
    </html>
  );
}
