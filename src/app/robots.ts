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
        '/*/platform/assignments',
        '/*/platform/audit',
        '/*/platform/contracts',
        '/*/platform/dashboard-lab',
        '/*/platform/internal-messages',
        '/*/platform/module-registry',
        '/*/platform/overview',
        '/*/platform/owner-unit-links',
        '/*/platform/plans',
        '/*/platform/provisioning',
        '/*/platform/retention-operations',
        '/*/platform/start-requests',
        '/*/platform/support',
        '/*/platform/users',
        '/*/platform/workspaces',
        '/*/account',
        '/*/owner-portfolio',
        '/*/cases',
        '/*/profile',
        '/*/workspace-access',
        '/*/pilot-reviewer',
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
