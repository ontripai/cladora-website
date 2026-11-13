import { redirect } from 'next/navigation';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { isSupportedLocale } from '@/types';
import {
  getAccountRoute,
  getCustomerServicesRoute,
  hasActivePlatformAccess,
  isCoreServiceAssemblyProfile,
  sanitizeAllowedNextRoute,
} from '@/lib/auth/post-auth-route';

export const dynamic = 'force-dynamic';

export default async function MfaPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ next?: string }> }) {
  const { lang } = await params;
  const { next } = await searchParams;
  if (!isSupportedLocale(lang)) redirect('/ro/login');
  if (!isSupabaseConfigured()) redirect(`/${lang}/login?reason=configuration`);

  const isAssembly = typeof isCoreServiceAssemblyProfile === 'function' ? isCoreServiceAssemblyProfile() : false;
  const safeNext = typeof sanitizeAllowedNextRoute === 'function'
    ? sanitizeAllowedNextRoute(next, lang, isAssembly)
    : (next ? `/${lang}/${next}` : null);
  const safeNextKey = safeNext ? safeNext.replace(`/${lang}/`, '') : null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect(`/${lang}/login${safeNextKey ? `?next=${encodeURIComponent(safeNextKey)}` : ''}`);
  }

  let platformAccess: boolean | null = null;
  if (isAssembly || safeNextKey==='app/experience/guides') {
    platformAccess = false;
  } else {
    try {
      platformAccess = await hasActivePlatformAccess(supabase);
    } catch {
      platformAccess = null;
    }
  }
  if (platformAccess === null) redirect(`/${lang}/login?reason=security`);

  // Explicit owner navigation never grants owner access; the destination rechecks it.
  const continueTo = safeNextKey==='app/experience/guides'?`/${lang}/app/experience/guides`:safeNextKey === 'owner-portfolio'
    ? `/${lang}/owner-portfolio`
    : safeNextKey === 'invitation-continuation' && !platformAccess
    ? `/${lang}/invitation-continuation`
    : safeNextKey === 'workspace-access' && !platformAccess
    ? `/${lang}/workspace-access`
    : safeNextKey === 'cases' && !platformAccess
    ? `/${lang}/cases`
    : safeNextKey === 'pilot-reviewer' && !platformAccess
    ? `/${lang}/pilot-reviewer`
    : safeNextKey === 'services' || safeNextKey === 'app/services'
    ? getCustomerServicesRoute(lang)
    : isAssembly
    ? getCustomerServicesRoute(lang)
    : getAccountRoute(lang);

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !assurance) redirect(`/${lang}/login?reason=security`);
  if (assurance.currentLevel === 'aal2') redirect(continueTo);
  if (assurance.nextLevel !== 'aal2') {
    redirect(`/${lang}/mfa/setup?reason=${platformAccess ? 'platform_required' : 'customer_required'}${safeNextKey && (safeNextKey !== 'invitation-continuation' || !platformAccess) ? `&next=${encodeURIComponent(safeNextKey)}` : ''}`);
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#F6F9FC] p-6"><MfaChallengeForm lang={lang} continueTo={continueTo} /></main>;
}
