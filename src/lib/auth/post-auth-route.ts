import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.generated';
import type { Language } from '@/types';

export const getCustomerDashboardRoute = (lang: Language) => `/${lang}/app/dashboard`;
export const getAccountRoute = (lang: Language) => `/${lang}/account`;
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
