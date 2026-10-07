import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupportedLocale } from '@/types';
import { OwnerLinkReviewPanel } from '@/components/owner/OwnerLinkReviewPanel';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function OwnerLinkReviewPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) redirect('/ro/login');
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/${lang}/login?next=owner-link-review`);
  const { data: assurance } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== 'aal2') redirect(`/${lang}/mfa?next=owner-link-review`);
  return <OwnerLinkReviewPanel lang={lang} platform={false} />;
}
