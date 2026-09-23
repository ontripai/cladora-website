import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.generated';
import type { Language } from '@/types';

export const getCustomerDashboardRoute = (lang: Language) => `/${lang}/app/dashboard`;
export const getPlatformOverviewRoute = (lang: Language) => `/${lang}/platform/overview`;

export async function hasActivePlatformAccess(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
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
  const destination = platformAccess
    ? getPlatformOverviewRoute(lang)
    : getCustomerDashboardRoute(lang);

  if (platformAccess && !hasVerifiedFactor) {
    return `/${lang}/mfa/setup?reason=platform_required`;
  }

  if (hasVerifiedFactor && assuranceResult.data.currentLevel !== 'aal2') {
    return `/${lang}/mfa`;
  }

  return destination;
}
