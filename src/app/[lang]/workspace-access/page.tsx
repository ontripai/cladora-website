import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WorkspaceAccessActivation } from '@/components/auth/WorkspaceAccessActivation';
import { isSupportedLocale } from '@/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CLADORA access activation', robots: { index: false, follow: false } };

export default async function WorkspaceAccessPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) redirect('/ro/login');
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims?.sub) redirect(`/${lang}/login?next=workspace-access`);
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== 'aal2') redirect(`/${lang}/mfa?next=workspace-access`);
  return <main className="mx-auto min-h-screen max-w-2xl px-4 pb-24 pt-32">
    <WorkspaceAccessActivation lang={lang} />
  </main>;
}
