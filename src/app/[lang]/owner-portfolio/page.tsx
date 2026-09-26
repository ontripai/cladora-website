import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupportedLocale } from '@/types';
import { OwnerPortfolioPanel } from '@/components/owner/OwnerPortfolioPanel';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function OwnerPortfolioPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) redirect('/ro/login');
  const db = await createClient();
  const { data: claims, error } = await db.auth.getClaims();
  if (error || !claims?.claims?.sub) redirect(`/${lang}/login?next=owner-portfolio`);
  const { data: assurance, error: mfaError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaError || assurance?.currentLevel !== 'aal2') redirect(`/${lang}/mfa?next=owner-portfolio`);
  const { data: allowed, error: roleError } = await db.schema('customer_api').rpc('my_multi_unit_owner_access_v1' as never);
  if (roleError || allowed !== true) return <main className="mx-auto max-w-3xl p-8" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
    <h1 className="text-2xl font-bold">{lang === 'fa' ? 'کارتابل مالک چندواحدی' : lang === 'ro' ? 'Portofoliul proprietarului' : 'Multi-unit owner portfolio'}</h1>
    <p className="mt-4">{lang === 'fa' ? 'نقش مالک چندواحدی هنوز به حساب شما تخصیص نیافته یا اعتبار آن پایان یافته است.' : lang === 'ro' ? 'Rolul proprietarului cu mai multe unități nu este activ pentru acest cont.' : 'The multi-unit owner role is not active for this account.'}</p>
  </main>;
  return <OwnerPortfolioPanel lang={lang} />;
}
