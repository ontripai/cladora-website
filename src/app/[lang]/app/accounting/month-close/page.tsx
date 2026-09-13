import { notFound } from 'next/navigation';
import { isSupportedLocale, Language } from '@/types';
import { CustomerMonthlyCycleDashboard } from '@/components/customer/CustomerMonthlyCycleDashboard';

export default async function MonthClosePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerMonthlyCycleDashboard lang={lang as Language} />;
}
