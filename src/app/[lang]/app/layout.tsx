import { redirect } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { CustomerAppShell } from '@/components/customer/CustomerAppShell';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';
import {isGuideNativeEntrySelectedV1} from '@/lib/app/guide-platform-provider-v1';
import { isCoreServiceAssemblyProfile } from '@/lib/auth/post-auth-route';

export const dynamic = 'force-dynamic';

export default async function AppLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ lang: string }>;
  }
) {
  const params = await props.params;

  const { lang } = params;

  if (!isSupportedLocale(lang)) {
    redirect('/ro/login');
  }

  const {
    children
  } = props;

  if (!isSupabaseConfigured()) {
    redirect(`/${lang}/login?reason=configuration`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect(`/${lang}/login`);
  }

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) redirect(`/${lang}/login?reason=security`);
  const hasVerifiedFactor = factors.totp.some((factor) => factor.status === 'verified');

  const guideNativeSelected=isGuideNativeEntrySelectedV1();
  const isAssembly = isCoreServiceAssemblyProfile()||guideNativeSelected;
  if (isAssembly) {
    // Selected native assembly: official Auth API only; MFA remains mandatory.
    if (!hasVerifiedFactor) {
      redirect(`/${lang}/mfa/setup?reason=customer_required${guideNativeSelected?'&next=app%2Fexperience%2Fguides':''}`);
    }

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) redirect(`/${lang}/login?reason=security`);
    if (assurance.currentLevel !== 'aal2') {
      redirect(`/${lang}/mfa${guideNativeSelected?'?next=app%2Fexperience%2Fguides':''}`);
    }

    return <CustomerAppShell lang={lang} guideNativeSelected={isGuideNativeEntrySelectedV1()}>{children}</CustomerAppShell>;
  }

  // Customer API Gateway: delegates to platform.my_customer_mfa_requirement
  const { data: mfaRequired, error: requirementError } = await supabase
    .schema('customer_api')
    .rpc('my_mfa_requirement_v1');
  if (requirementError) redirect(`/${lang}/login?reason=security`);
  if (mfaRequired && !hasVerifiedFactor) {
    redirect(`/${lang}/mfa/setup?reason=customer_required${guideNativeSelected?'&next=app%2Fexperience%2Fguides':''}`);
  }

  if (!mfaRequired && !hasVerifiedFactor) {
    return <CustomerAppShell lang={lang} guideNativeSelected={isGuideNativeEntrySelectedV1()}>{children}</CustomerAppShell>;
  }

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) redirect(`/${lang}/login?reason=security`);
  if (assurance.currentLevel !== 'aal2') {
    redirect(`/${lang}/mfa`);
  }

  return <CustomerAppShell lang={lang} guideNativeSelected={isGuideNativeEntrySelectedV1()}>{children}</CustomerAppShell>;
}
