import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.generated';
import type { Language } from '@/types';

export const getCustomerDashboardRoute = (lang: Language) => `/${lang}/app/dashboard`;
export const getCustomerServicesRoute = (lang: Language) => `/${lang}/app/services`;
export const getAccountRoute = (lang: Language) => `/${lang}/account`;
export const getPlatformOverviewRoute = (lang: Language) => `/${lang}/platform/overview`;

export const isCoreServiceAssemblyProfile = (): boolean =>
  process.env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE === 'core-service-real-app-assembly.v1';

export const isPublicServiceAssemblyProfile = (): boolean =>
  process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY === 'v1';

export const isServiceAssemblyProfile = (): boolean =>
  isCoreServiceAssemblyProfile() || isPublicServiceAssemblyProfile();

const ALLOWED_NEXT_KEYS = new Set([
  'workspace-access',
  'cases',
  'invitation-continuation',
  'owner-portfolio',
  'pilot-reviewer',
  'services',
  'app/services',
  'account',
]);

export function sanitizeAllowedNextRoute(
  rawNext: string | undefined | null,
  lang: Language,
  isAssembly: boolean = isServiceAssemblyProfile(),
): string | null {
  if (!rawNext || typeof rawNext !== 'string') return null;
  const trimmed = rawNext.trim();
  if (!trimmed) return null;

  // Disallow protocols, scheme-relative URLs, backslashes, CRLF, and controls
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  if (trimmed.startsWith('//') || trimmed.startsWith('\\') || trimmed.includes('\\')) return null;

  // Normalized key check
  let normalizedKey = trimmed;
  const prefixWithLang = `/${lang}/`;
  if (normalizedKey.startsWith(prefixWithLang)) {
    normalizedKey = normalizedKey.slice(prefixWithLang.length);
  } else if (normalizedKey.startsWith('/')) {
    normalizedKey = normalizedKey.slice(1);
  }

  // Remove any query or hash from the key check
  const [cleanKey] = normalizedKey.split(/[?#]/);

  if (!ALLOWED_NEXT_KEYS.has(cleanKey)) {
    return null;
  }

  if (cleanKey === 'account' && isAssembly) {
    return getCustomerServicesRoute(lang);
  }
  if (cleanKey === 'services' || cleanKey === 'app/services') {
    return getCustomerServicesRoute(lang);
  }

  return `/${lang}/${cleanKey}`;
}

export async function hasActivePlatformAccess(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  if (isServiceAssemblyProfile()) {
    return false;
  }
  const { data, error } = await supabase
    .schema('customer_api')
    .rpc('has_platform_access_v1');

  if (error) throw error;
  return data === true;
}

export async function resolvePostAuthRoute(
  supabase: SupabaseClient<Database>,
  lang: Language,
): Promise<string> {
  if (isServiceAssemblyProfile()) {
    // Official Auth API only; zero dependency on uninstalled customer_api
    const [factorsResult, assuranceResult] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (factorsResult.error) throw factorsResult.error;
    if (assuranceResult.error) throw assuranceResult.error;

    const hasVerifiedFactor = (factorsResult.data?.totp ?? []).some(
      (factor) => factor.status === 'verified',
    );

    if (!hasVerifiedFactor) {
      return `/${lang}/mfa/setup?reason=customer_required`;
    }

    if (assuranceResult.data.currentLevel !== 'aal2') {
      return `/${lang}/mfa`;
    }

    return getCustomerServicesRoute(lang);
  }

  const [platformAccess, factorsResult, assuranceResult] = await Promise.all([
    hasActivePlatformAccess(supabase),
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (factorsResult.error) throw factorsResult.error;
  if (assuranceResult.error) throw assuranceResult.error;

  const hasVerifiedFactor = (factorsResult.data?.totp ?? []).some(
    (factor) => factor.status === 'verified',
  );
  // A magic link may return to the generic sign-in destination. The invitation
  // belongs to the verified email, so restore its destination from the database.
  const { data: pendingUnitInvites } = await supabase.schema('customer_api')
    .rpc('list_my_unit_invitations_v1' as never);
  const pending = pendingUnitInvites as unknown;
  if (Array.isArray(pending) && pending.length > 0) {
    const [{ data: contexts }, { data: ownerAccess }] = await Promise.all([
      supabase.schema('customer_api').rpc('list_contexts_v1'),
      supabase.schema('customer_api').rpc('my_multi_unit_owner_access_v1' as never),
    ]);
    const hasOtherAccess = platformAccess || ownerAccess === true || (Array.isArray(contexts) && contexts.length > 0);
    if (hasOtherAccess) {
      // Existing roles remain usable; the account chooser displays the invite.
      if (hasVerifiedFactor && assuranceResult.data.currentLevel !== 'aal2') return `/${lang}/mfa`;
      return getAccountRoute(lang);
    }
    if (hasVerifiedFactor && assuranceResult.data.currentLevel !== 'aal2') {
      return `/${lang}/mfa?next=invitation-continuation`;
    }
    return `/${lang}/invitation-continuation`;
  }
  const destination = platformAccess || hasVerifiedFactor
    ? getAccountRoute(lang)
    : getCustomerDashboardRoute(lang);

  if (platformAccess && !hasVerifiedFactor) {
    return `/${lang}/mfa/setup?reason=platform_required`;
  }

  if (hasVerifiedFactor && assuranceResult.data.currentLevel !== 'aal2') {
    return `/${lang}/mfa`;
  }

  return destination;
}
