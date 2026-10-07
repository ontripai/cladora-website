import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const languages = ['ro', 'en', 'fa'] as const;
  const staticLastMod = new Date('2026-10-07T00:00:00.000Z');

  const publicRoutes = [
    '',
    '/platform',
    '/solutions',
    '/airprop',
    '/service',
    '/operations',
    '/lifecycle',
    '/contact',
    '/resources/faq',
    '/about',
    '/accessibility',
    '/association',
    '/building-dna',
    '/cookies',
    '/financial-truth',
    '/manager',
    '/meters',
    '/migration',
    '/modules',
    '/pilot',
    '/portfolio',
    '/pricing',
    '/privacy',
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
        priority: route === '' ? 1.0 : (route === '/platform' || route.startsWith('/solutions') || route === '/airprop' || route === '/service' || route === '/lifecycle' ? 0.9 : 0.7),
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
