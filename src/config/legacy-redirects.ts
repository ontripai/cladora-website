/**
 * TypeScript wrapper for the Authoritative Legacy Redirect Registry (WP10_REDIRECT_REGISTRY_V2).
 */
import {
  LEGACY_REDIRECT_DEFINITIONS as _LEGACY_REDIRECT_DEFINITIONS,
  getLegacyDestination as _getLegacyDestination,
  getNextConfigRedirects as _getNextConfigRedirects,
} from './legacy-redirects.mjs';

export interface LegacyRedirectEntry {
  source: string;
  destination: string;
  reason: string;
}

export const LEGACY_REDIRECT_DEFINITIONS: LegacyRedirectEntry[] = _LEGACY_REDIRECT_DEFINITIONS;
export const getLegacyDestination = _getLegacyDestination as (sourceSlug: string) => string;
export const getNextConfigRedirects = _getNextConfigRedirects as () => Array<{
  source: string;
  destination: string;
  permanent: boolean;
}>;
