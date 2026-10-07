import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/contact', params.lang);
}

export default async function PilotPage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = await props.params;
  // Permanent redirect legacy pilot quota route to universal partnership inquiry (HTTP 308)
  permanentRedirect(`/${params.lang}/contact`);
}
