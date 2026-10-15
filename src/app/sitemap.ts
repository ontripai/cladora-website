import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const languages = ['ro', 'en', 'fa'] as const;

  const publicRoutes = [
    '',
    '/platform',
    '/platform/architecture',
    '/platform/lifecycle',
    '/platform/trust',
    '/capabilities',
    '/industries',
    '/community-experience',
    '/ai',
    '/solutions',
    '/solutions/developers',
    '/solutions/property-owners',
    '/solutions/associations',
    '/solutions/property-managers',
    '/solutions/residents',
    '/solutions/service-providers',
    '/airprop',
    '/service',
    '/operations',
    '/pricing',
    '/contact',
    '/about',
    '/accessibility',
    '/privacy',
    '/terms',
    '/cookies',
    '/resources',
    '/resources/guides',
    '/resources/migration-hub',
    '/resources/security',
    '/resources/glossary',
    '/faq',
  ];

  const entries: MetadataRoute.Sitemap = [];

  languages.forEach((lang) => {
    publicRoutes.forEach((route) => {
      const isTopLevel = route === '' || route === '/platform' || route.startsWith('/platform') || route.startsWith('/solutions') || route === '/capabilities' || route === '/industries' || route === '/community-experience' || route === '/ai';
      entries.push({
        url: `${baseUrl}/${lang}${route}`,
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : (isTopLevel ? 0.9 : 0.7),
        alternates: {
          languages: {
            ro: `${baseUrl}/ro${route}`,
            en: `${baseUrl}/en${route}`,
            fa: `${baseUrl}/fa${route}`,
            'x-default': `${baseUrl}/ro${route}`,
          },
        },
      });
    });
  });

  // WP-14: Batch 1 Primary SEO Articles (Market-Fit, Single-Language Canonical)
  const batch1Articles: Array<{ lang: 'en' | 'ro' | 'fa'; slug: string }> = [
    { lang: 'en', slug: 'what-is-property-operating-platform' },
    { lang: 'en', slug: 'property-management-software-vs-property-operating-platform' },
    { lang: 'ro', slug: 'asociatii-proprietari-legea-196-2018' },
    { lang: 'ro', slug: 'repartizare-cheltuieli-asociatie-proprietari' },
    { lang: 'fa', slug: 'platform-modiriat-amlak' },
  ];

  batch1Articles.forEach(({ lang, slug }) => {
    entries.push({
      url: `${baseUrl}/${lang}/resources/guides/${slug}`,
      changeFrequency: 'monthly',
      priority: 0.8,
    });
  });

  return entries;
}
