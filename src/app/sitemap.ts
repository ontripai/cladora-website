import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/config/site';
import { getAllGuideArticles } from '@/data/guides-articles';

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

  // Core public routes (32 routes across 3 languages = 96 URLs)
  languages.forEach((lang) => {
    publicRoutes.forEach((route) => {
      const isTopLevel =
        route === '' ||
        route === '/platform' ||
        route.startsWith('/platform') ||
        route.startsWith('/solutions') ||
        route === '/capabilities' ||
        route === '/industries' ||
        route === '/community-experience' ||
        route === '/ai';

      entries.push({
        url: `${baseUrl}/${lang}${route}`,
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : isTopLevel ? 0.9 : 0.7,
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

  // Author transparency page across ro, en, fa (3 URLs)
  languages.forEach((lang) => {
    entries.push({
      url: `${baseUrl}/${lang}/resources/autori/cladora-research`,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: {
        languages: {
          ro: `${baseUrl}/ro/resources/autori/cladora-research`,
          en: `${baseUrl}/en/resources/autori/cladora-research`,
          fa: `${baseUrl}/fa/resources/autori/cladora-research`,
          'x-default': `${baseUrl}/ro/resources/autori/cladora-research`,
        },
      },
    });
  });

  // Dynamic Canonical Articles from Registry (Single-Language Market-Fit Canonical, NO fake hreflangs)
  const articles = getAllGuideArticles();
  articles.forEach((article) => {
    entries.push({
      url: `${baseUrl}/${article.lang}/resources/guides/${article.slug}`,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  });

  return entries;
}
