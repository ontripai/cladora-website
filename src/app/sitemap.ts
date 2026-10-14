import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const languages = ['ro', 'en', 'fa'] as const;
  const staticLastMod = new Date('2026-10-15T00:00:00.000Z');

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
    '/solutions/associations',
    '/solutions/property-managers',
    '/solutions/property-owners',
    '/solutions/residents',
    '/solutions/tenants',
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
    '/resources/faq',
  ];

  const entries: MetadataRoute.Sitemap = [];

  languages.forEach((lang) => {
    publicRoutes.forEach((route) => {
      const isTopLevel = route === '' || route === '/platform' || route.startsWith('/platform') || route.startsWith('/solutions') || route === '/capabilities' || route === '/industries' || route === '/community-experience' || route === '/ai';
      entries.push({
        url: `${baseUrl}/${lang}${route}`,
        lastModified: staticLastMod,
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

  return entries;
}
