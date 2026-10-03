import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { CustomerServiceCatalog } from '@/components/customer/CustomerServiceCatalog';
export default async function ServicesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerServiceCatalog lang={lang} />;
}
