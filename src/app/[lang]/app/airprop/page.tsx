import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { CustomerAirpropWorkspace } from '@/components/customer/CustomerAirpropWorkspace';
export default async function AirpropPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerAirpropWorkspace lang={lang} />;
}
