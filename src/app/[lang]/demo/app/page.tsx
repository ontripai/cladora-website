import { notFound, redirect } from 'next/navigation';
import { isSupportedLocale, Language } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export default async function DemoAppIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) {
    notFound();
  }

  if (!isSupabaseConfigured()) {
    redirect(`/${lang}/demo`);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect(`/${lang}/demo`);
  }

  const { data: workspaceData, error } = await (supabase.schema('customer_api') as any)
    .rpc('demo_get_my_workspace_v1');

  if (error || !workspaceData) {
    redirect(`/${lang}/demo`);
  }

  // Canonical destination for workspace-bound users arriving at demo/app root:
  // Exactly 1 internal hop from /[lang]/demo/app -> /[lang]/demo/app/dashboard
  redirect(`/${lang}/demo/app/dashboard`);
}
