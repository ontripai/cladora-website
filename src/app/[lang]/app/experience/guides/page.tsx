import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import {isGuideNativeEntrySelectedV1} from '@/lib/app/guide-platform-provider-v1';
import {CustomerExperienceGuideNativeEntry} from '@/components/customer/CustomerExperienceGuideNativeEntry';
import { CustomerExperienceGuidePage } from '@/components/customer/CustomerExperienceGuidePage';

export default async function ExperienceGuidesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return isGuideNativeEntrySelectedV1()?<CustomerExperienceGuideNativeEntry lang={lang}/>:<CustomerExperienceGuidePage lang={lang} />;
}
