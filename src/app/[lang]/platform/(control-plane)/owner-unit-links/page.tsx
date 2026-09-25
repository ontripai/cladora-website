import { OwnerLinkReviewPanel } from '@/components/owner/OwnerLinkReviewPanel';
import { isSupportedLocale } from '@/types';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function PlatformOwnerLinksPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSupportedLocale(lang)) notFound();
  return <OwnerLinkReviewPanel lang={lang} platform />;
}
