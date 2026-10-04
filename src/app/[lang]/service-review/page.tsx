import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupportedLocale } from '@/types';
import { listServiceReviewTargets } from '@/lib/customer/service-catalog-review-targets';
import { CustomerServiceManagement } from '@/components/customer/CustomerServiceManagement';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
const copy = {
  fa: { title: 'تأیید کاتالوگ SERVICE', intro: 'پیشنهادهای خدمات را در فضای کاری مجاز خود بررسی کنید. انتشار به تأییدکننده‌ای جدا از سازنده نیاز دارد.', empty: 'دسترسی فعال برای تأیید کاتالوگ ندارید.', failed: 'بررسی دسترسی انجام نشد؛ صفحه را دوباره بارگذاری کنید.', back: 'انتخاب محیط کار' },
  ro: { title: 'Aprobarea catalogului SERVICE', intro: 'Verifică ofertele din spațiul autorizat. Publicarea necesită un aprobator diferit de autor.', empty: 'Nu ai acces activ pentru aprobarea catalogului.', failed: 'Accesul nu a putut fi verificat. Reîncarcă pagina.', back: 'Alege spațiul de lucru' },
  en: { title: 'SERVICE catalogue approval', intro: 'Review offers in your authorized workspace. Publication requires an approver different from the author.', empty: 'You have no active catalogue approval access.', failed: 'Access could not be verified. Reload the page.', back: 'Choose your workspace' },
};
export default async function ServiceReviewPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  const t = copy[lang];
  const db = await createClient();
  const { data: claims, error } = await db.auth.getClaims();
  if (error || !claims?.claims?.sub) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/service-review`)}`);
  const { data: aal, error: aalError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || !aal) redirect(`/${lang}/login?reason=security`);
  if (aal.currentLevel !== 'aal2') redirect(`/${lang}/mfa`);
  let targets: Awaited<ReturnType<typeof listServiceReviewTargets>> = [];
  let failed = false;
  try { targets = await listServiceReviewTargets(db); } catch { failed = true; }
  return <main dir={lang === 'fa' ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl space-y-6 p-6 sm:p-10">
    <header><h1 className="text-3xl font-bold text-slate-900">{t.title}</h1><p className="mt-3 text-slate-600">{t.intro}</p><Link href={`/${lang}/account?choose=1`} className="mt-3 inline-block text-teal-800 underline">{t.back}</Link></header>
    {failed ? <p role="alert">{t.failed}</p> : !targets.length ? <p role="status">{t.empty}</p> : targets.map(target => <section key={`${target.contextId}:${target.workspaceId}`} className="space-y-4"><h2 className="text-xl font-bold">{target.label}</h2><CustomerServiceManagement contextId={target.contextId} workspaceId={target.workspaceId} lang={lang} /></section>)}
  </main>;
}
