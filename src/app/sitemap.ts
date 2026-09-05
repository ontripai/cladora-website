import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const languages = ['ro', 'en', 'fa'] as const;
  const staticLastMod = new Date('2026-09-05T00:00:00.000Z');

  const publicRoutes = [
    '',
    '/about',
    '/accessibility',
    '/association',
    '/building-dna',
    '/contact',
    '/cookies',
    '/financial-truth',
    '/manager',
    '/meters',
    '/migration',
    '/modules',
    '/pilot',
    '/platform',
    '/portfolio',
    '/pricing',
    '/privacy',
    '/resources/faq',
    '/security',
    '/solutions/associations',
    '/solutions/property-managers',
    '/solutions/property-owners',
    '/solutions/residents',
    '/solutions/tenants',
    '/terms',
    '/trust',
  ];

  const entries: MetadataRoute.Sitemap = [];

  languages.forEach((lang) => {
    publicRoutes.forEach((route) => {
      entries.push({
        url: `${baseUrl}/${lang}${route}`,
        lastModified: staticLastMod,
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : (route.startsWith('/solutions') || route === '/pricing' || route === '/platform' ? 0.9 : 0.7),
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

  return entries;
}
