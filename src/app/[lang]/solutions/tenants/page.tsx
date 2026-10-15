import { permanentRedirect } from 'next/navigation';
import { Language } from '@/types';
import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(props: { params: Promise<{ lang: Language }> }): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/solutions/tenants', params.lang);
}

export default async function TenantsPage(props: { params: Promise<{ lang: Language }> }) {
  const { lang } = await props.params;
  permanentRedirect(`/${lang}/solutions/residents`);
}
