import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Language } from '@/types';
import DashboardPage from '@/components/demo/DemoDashboardPage';
import AccountingPage from '@/components/demo/DemoAccountingPage';

export default async function DemoAppPage({ params }: { params: Promise<{ lang: Language; slug: string[] }> }) {
  const { lang, slug } = await params;
  const route = slug.join('/');
  const pageParams = Promise.resolve({ lang });
  // A demo route never mounts an authenticated app page outside its app layout.
  // Only components backed by the isolated demo store are rendered here.
  const unavailable = (
    <section className="card-proptech bg-white p-8 text-sm text-[#334E68]">
      <p>{lang === 'fa' ? 'این ماژول در دمو فعال نیست. برای استفاده از اپلیکیشن واقعی وارد حساب خود شوید.' : lang === 'ro' ? 'Acest modul nu este activ în demo. Autentifică-te pentru a utiliza aplicația reală.' : 'This module is unavailable in the demo. Sign in to use the real application.'}</p>
      <Link href={`/${lang}/login`} className="mt-4 inline-block underline">{lang === 'fa' ? 'ورود به اپلیکیشن' : lang === 'ro' ? 'Autentificare' : 'Sign in'}</Link>
    </section>
  );
  const pages: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage params={pageParams} demoMode />,
    accounting: <AccountingPage params={pageParams} demoMode />,
    'accounting/month-close': unavailable,
    'accounting/allocations': unavailable,
    meters: unavailable,
    maintenance: unavailable,
    governance: unavailable,
    communications: unavailable,
    documents: unavailable,
    portfolio: unavailable,
    'migration/shadow-ledger': unavailable,
    audit: unavailable,
    settings: <div className="card-proptech bg-white p-8 text-sm text-[#334E68]">{lang === 'fa' ? 'تنظیمات امنیتی حساب فقط در اپلیکیشن واقعی در دسترس است؛ محیط دمو به حساب کاربری متصل نیست.' : lang === 'ro' ? 'Setările de securitate sunt disponibile doar în aplicația reală; demo-ul nu este conectat la un cont.' : 'Account security settings are available only in the real application; the demo is not connected to an account.'}</div>,
  };
  return pages[route] ?? notFound();
}
