import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { CustomerUtilitiesDashboard } from '@/components/customer/CustomerUtilitiesDashboard';

export default async function UtilitiesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerUtilitiesDashboard lang={lang} />;
}
