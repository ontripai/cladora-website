import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { CustomerCommunityBasePage } from '@/components/customer/CustomerCommunityBasePage';

export default async function CommunityPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerCommunityBasePage lang={lang} />;
}
