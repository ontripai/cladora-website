/**
 * Authoritative Legacy Redirect Registry (WP10_REDIRECT_REGISTRY_V2)
 * Single code-level source of truth for public legacy route consolidation.
 * Used by next.config.mjs for edge-level HTTP 308 redirects and by legacy page stubs.
 */

export const LEGACY_REDIRECT_DEFINITIONS = [
  {
    source: 'modules',
    destination: 'capabilities',
    reason: 'Consolidated into 14-family Capabilities framework',
  },
  {
    source: 'association',
    destination: 'solutions/associations',
    reason: 'Consolidated into canonical HOA Solutions',
  },
  {
    source: 'manager',
    destination: 'solutions/property-managers',
    reason: 'Consolidated into canonical Property Manager Solutions',
  },
  {
    source: 'portfolio',
    destination: 'solutions/property-owners',
    reason: 'Consolidated into canonical Property Owner Solutions',
  },
  {
    source: 'lifecycle',
    destination: 'platform/lifecycle',
    reason: 'Consolidated into canonical Platform Lifecycle',
  },
  {
    source: 'building-dna',
    destination: 'platform/architecture',
    reason: 'Consolidated into canonical Platform Architecture',
  },
  {
    source: 'financial-truth',
    destination: 'capabilities',
    reason: 'Consolidated into CAP05 Financial Accounting in Capabilities',
  },
  {
    source: 'meters',
    destination: 'capabilities',
    reason: 'Consolidated into CAP08 Utility & Metering in Capabilities',
  },
  {
    source: 'migration',
    destination: 'resources/migration-hub',
    reason: 'Consolidated directly into canonical Migration Hub in Resources',
  },
  {
    source: 'trust',
    destination: 'platform/trust',
    reason: 'Consolidated into canonical Platform Trust',
  },
  {
    source: 'security',
    destination: 'platform/trust',
    reason: 'Consolidated into canonical Platform Trust',
  },
  {
    source: 'pilot',
    destination: 'contact',
    reason: 'Retired pilot cohort consolidated into direct partnership contact',
  },
];

/**
 * Returns destination path for a given legacy source slug.
 * @param {string} sourceSlug
 * @returns {string}
 */
export function getLegacyDestination(sourceSlug) {
  const match = LEGACY_REDIRECT_DEFINITIONS.find((d) => d.source === sourceSlug);
  if (!match) {
    throw new Error(`Unknown legacy source slug: ${sourceSlug}`);
  }
  return match.destination;
}

/**
 * Builds the Next.js async redirects() array with locale-aware 308 permanent redirect rules.
 * @returns {Array<{ source: string, destination: string, permanent: boolean }>}
 */
export function getNextConfigRedirects() {
  return LEGACY_REDIRECT_DEFINITIONS.map(({ source, destination }) => ({
    source: `/:lang(ro|en|fa)/${source}`,
    destination: `/:lang/${destination}`,
    permanent: true,
  }));
}
