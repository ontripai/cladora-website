/**
 * CLADORA Site & SEO Canonical Configuration
 * Single source of truth for canonical URLs, sitemap, robots, OpenGraph, and metadataBase.
 */

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  'https://cladora.ro';

export const getSiteUrl = (): string => {
  return siteUrl.replace(/\/+$/, '');
};
