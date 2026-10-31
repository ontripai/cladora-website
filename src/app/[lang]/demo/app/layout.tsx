import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { isSupportedLocale, Language } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { DemoAppShell } from '@/components/demo/DemoAppShell';
import type { DemoWorkspaceDescriptor } from '@/lib/demo/demo-types';

export const dynamic = 'force-dynamic';

export default async function DemoAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();

  if (authError || !claimsData?.claims) {
    redirect(`/${lang}/demo`);
  }

  const { data: workspace, error: wsError } = await (supabase.schema('customer_api') as any)
    .rpc('demo_get_my_workspace_v1');

  if (wsError || !workspace) {
    redirect(`/${lang}/demo`);
  }

  return (
    <DemoAppShell workspace={(workspace as unknown) as DemoWorkspaceDescriptor} lang={lang as Language}>
      {children}
    </DemoAppShell>
  );
}
