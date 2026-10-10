import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { CustomerExperienceGuidePage } from '@/components/customer/CustomerExperienceGuidePage';

export default async function ExperienceGuidesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <CustomerExperienceGuidePage lang={lang} />;
}
