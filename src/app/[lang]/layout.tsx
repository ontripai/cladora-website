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

  let title = 'CLADORA | Unified Environment for Property Operations, Management & Services';
  let description = 'CLADORA is the unified environment for collaboration, management, and services across properties, buildings, units, spaces, and assets—preserving record continuity from pre-sales through decades of operation.';
  let keywords = [
    'property management platform',
    'universal workspace os',
    'real estate lifecycle operations',
    'airprop sales and leasing',
    'facility maintenance work orders',
    'double entry analytical ledger',
    'cladora',
  ];

  if (isRo) {
    title = 'CLADORA | Mediul Unificat de Colaborare, Gestiune & Servicii Imobiliare';
    description = 'CLADORA este mediul unificat de colaborare, gestiune și servicii pentru proprietăți, clădiri, unități, spații și active. Însoțește proprietatea de la pre-vânzare până la exploatare și tranzacții ulterioare, păstrând continuitatea evidențelor autorizate.';
    keywords = [
      'soft administrare imobile',
      'platforma gestiune proprietati',
      'workspace imobiliar universal',
      'airprop vanzari si inchirieri',
      'mentenanta tehnica si revizii',
      'evidenta statutara si contabilitate analitica',
      'cladora',
    ];
  } else if (isFa) {
    title = 'CLADORA | محیط یکپارچهٔ همکاری، مدیریت و خدمات ملک، فضا و دارایی';
    description = 'CLADORA محیط یکپارچهٔ همکاری، مدیریت و خدمات برای ملک، ساختمان، واحد، فضا و دارایی است. از زمان تعریف و پیش‌فروش تا تحویل، بهره‌برداری، نگهداری و معاملات بعدی، پیوستگی سوابق مجاز را حفظ می‌کند.';
    keywords = [
      'سامانه جامع مدیریت املاک',
      'پلتفرم یکپارچه ملک و ساختمان',
      'معماری ورک‌اسپیس املاک',
      'سامانه ایرپراپ خرید و فروش و اجاره',
      'تعمیرات و نگهداری دوره‌ای ساختمان',
      'دفاتر مالی و تسهیم شفاف هزینه‌ها',
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
    name: 'CLADORA Universal Property & Asset OS',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    offers: {
      '@type': 'Offer',
      price: '0.60',
      priceCurrency: 'EUR',
    },
    description: isRo
      ? 'CLADORA este mediul unificat de colaborare, gestiune și servicii pentru proprietăți, clădiri, unități, spații și active. Însoțește proprietatea de la pre-vânzare până la exploatare și tranzacții ulterioare.'
      : isFa
      ? 'CLADORA محیط یکپارچهٔ همکاری، مدیریت و خدمات برای ملک، ساختمان، واحد، فضا و دارایی است؛ از تعریف و پیش‌فروش تا بهره‌برداری، نگهداری و معاملات بعدی.'
      : 'CLADORA is the unified environment for collaboration, management, and services across properties, buildings, units, spaces, and physical assets.',
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
