import type { Metadata } from 'next';
import { Language, getIntlLocale } from '@/types';
import { getSiteUrl } from '@/config/site';

interface PageMetadataOptions {
  lang: Language;
  path: string; // e.g. '', '/migration', '/solutions/property-managers'
  title: string; // clean title WITHOUT trailing "| CLADORA"
  description: string;
  keywords?: string[];
  noIndex?: boolean;
  ogType?: 'website' | 'article';
  singleLanguageOnly?: boolean;
}

/**
 * Builds standard, claim-safe, accessible Next.js Metadata with:
 * 1. Self-referencing canonical URL matching current page pathname
 * 2. Reciprocal path-preserving hreflang alternates across ro, en, fa + x-default (ro)
 * 3. Exact single brand suffix (preventing duplicate "| CLADORA | CLADORA")
 * 4. Fully qualified OpenGraph and Twitter metadata matching canonical
 */
export function buildPageMetadata({
  lang,
  path,
  title,
  description,
  keywords,
  noIndex = false,
  ogType = 'website',
  singleLanguageOnly = false,
}: PageMetadataOptions): Metadata {
  const baseUrl = getSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : path ? `/${path}` : '';
  const canonicalUrl = `${baseUrl}/${lang}${normalizedPath}`;

  const brandSuffix = lang === 'fa' ? 'کلادورا' : 'CLADORA';
  // Strip any accidental trailing brand suffixes from input title
  const cleanTitle = title
    .replace(/\s*\|\s*CLADORA\s*$/i, '')
    .replace(/\s*\|\s*کلادورا\s*$/i, '')
    .trim();

  const formattedTitle = `${cleanTitle} | ${brandSuffix}`;
  const intlLocale = getIntlLocale(lang).replace('-', '_');

  return {
    title: {
      absolute: formattedTitle,
    },
    description,
    keywords,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `/${lang}${normalizedPath}`,
      languages: singleLanguageOnly
        ? undefined
        : {
            ro: `/ro${normalizedPath}`,
            en: `/en${normalizedPath}`,
            fa: `/fa${normalizedPath}`,
            'x-default': `/ro${normalizedPath}`,
          },
    },
    openGraph: {
      title: formattedTitle,
      description,
      url: canonicalUrl,
      siteName: 'CLADORA',
      locale: intlLocale,
      type: ogType,
      images: [
        {
          url: `${baseUrl}/brand/cladora-og.png`,
          width: 1200,
          height: 630,
          alt:
            lang === 'ro'
              ? 'CLADORA — Platformă de operare pentru proprietăți și active'
              : lang === 'fa'
              ? 'کلادورا — پلتفرم عملیات و مدیریت املاک'
              : 'CLADORA — Property Operating Platform',
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: formattedTitle,
      description,
      images: [`${baseUrl}/brand/cladora-og.png`],
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
    },
  };
}
