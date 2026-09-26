import { redirect } from 'next/navigation';
import { AccountSecurityPanel } from '@/components/auth/AccountSecurityPanel';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { isSupportedLocale } from '@/types';
import { getAccountRoute, hasActivePlatformAccess } from '@/lib/auth/post-auth-route';

export const dynamic = 'force-dynamic';

export default async function MfaSetupPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ next?: string }> }) {
  const { lang } = await params;
  const { next } = await searchParams;
  if (!isSupportedLocale(lang)) redirect('/ro/login');
  if (!isSupabaseConfigured()) redirect(`/${lang}/login?reason=configuration`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect(`/${lang}/login${next === 'owner-portfolio' ? '?next=owner-portfolio' : ''}`);
  let platformAccess: boolean | null = null;
  try {
    platformAccess = await hasActivePlatformAccess(supabase);
  } catch {
    platformAccess = null;
  }
  if (platformAccess === null) redirect(`/${lang}/login?reason=security`);
  // Explicit owner navigation never grants owner access; the destination rechecks it.
  const continueTo = next === 'owner-portfolio'
    ? `/${lang}/owner-portfolio`
    : next === 'workspace-access' && !platformAccess
    ? `/${lang}/workspace-access`
    : next === 'cases' && !platformAccess
    ? `/${lang}/cases`
    : next === 'pilot-reviewer' && !platformAccess
    ? `/${lang}/pilot-reviewer`
    : getAccountRoute(lang);
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !assurance) redirect(`/${lang}/login?reason=security`);
  if (assurance.currentLevel === 'aal2') redirect(continueTo);
  if (assurance.nextLevel === 'aal2') redirect(`/${lang}/mfa${next === 'workspace-access' ? '?next=workspace-access' : next === 'cases' ? '?next=cases' : next === 'pilot-reviewer' ? '?next=pilot-reviewer' : next === 'owner-portfolio' ? '?next=owner-portfolio' : ''}`);
  return <main className="mx-auto flex min-h-screen max-w-3xl items-center bg-[#F6F9FC] p-6"><AccountSecurityPanel lang={lang} continueTo={continueTo} /></main>;
}
