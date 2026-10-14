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
  return getRouteMetadata('/capabilities', params.lang);
}

export default async function MigrationPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  // Permanent redirect legacy migration route to capabilities migration family (HTTP 308)
  permanentRedirect(`/${params.lang}/capabilities`);
}
