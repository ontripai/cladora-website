import { notFound, redirect } from 'next/navigation';
import type { Language } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { DemoDashboardView } from '@/components/demo/DemoDashboardView';
import { DemoModuleView } from '@/components/demo/DemoModuleView';
import type { DemoWorkspaceDescriptor } from '@/lib/demo/demo-types';

export const dynamic = 'force-dynamic';

export default async function DemoAppPage({
  params,
}: {
  params: Promise<{ lang: Language; slug: string[] }>;
}) {
  const { lang, slug } = await params;
  const route = slug.join('/');

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

  const workspace = (workspaceData as unknown) as DemoWorkspaceDescriptor;

  if (route === 'dashboard') {
    return <DemoDashboardView workspace={workspace} lang={lang} />;
  }

  const supportedModules = [
    'properties',
    'residents',
    'maintenance',
    'assets',
    'utilities',
    'communications',
    'documents',
    'bookings',
    'services',
    'community-experience',
    'community_experience',
    'governance',
    'finance',
    'reports',
    'activity',
    'settings',
    'accounting',
    'meters',
    'payments',
    'role_administration',
    'role-administration',
  ];

  const normalizedModule =
    route === 'accounting'
      ? 'finance'
      : route === 'meters'
      ? 'utilities'
      : route === 'role-administration'
      ? 'role_administration'
      : route;

  if (supportedModules.includes(route) || supportedModules.includes(normalizedModule)) {
    return <DemoModuleView workspace={workspace} moduleKey={normalizedModule} lang={lang} />;
  }

  return notFound();
}
