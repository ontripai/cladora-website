import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/*/app/',
        '/*/demo',
        '/*/login',
        '/*/forgot-password',
        '/*/reset-password',
        '/*/set-password',
        '/*/mfa',
        '/*/accept-invitation',
        '/*/invitation-continuation',
        '/*/invitation-result',
        '/*/auth-result',
        '/*/password-recovery-result',
        '/*/prototype',
        '/*/user-testing',
        '/*/wireframes/',
        '/*/ui/',
        '/*/information-architecture',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
