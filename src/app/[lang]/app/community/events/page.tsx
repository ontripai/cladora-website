import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { CustomerEventInterestPage } from '@/components/customer/CustomerEventInterestPage';

export default async function CommunityEventsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerEventInterestPage lang={lang} />;
}
