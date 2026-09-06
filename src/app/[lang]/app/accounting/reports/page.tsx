import { notFound } from 'next/navigation';
import { isSupportedLocale, Language } from '@/types';
import { CustomerFinancialReports } from '@/components/customer/CustomerFinancialReports';

export default async function FinancialReportsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerFinancialReports lang={lang as Language} />;
}
