import { notFound } from 'next/navigation';
import { isSupportedLocale, Language } from '@/types';
import { CustomerFinancialReports } from '@/components/customer/CustomerFinancialReports';
import { ExportScannerObservability } from '@/components/customer/ExportScannerObservability';

export default async function FinancialReportsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <div className="space-y-6"><CustomerFinancialReports lang={lang as Language} /><ExportScannerObservability lang={lang as Language} /></div>;
}
