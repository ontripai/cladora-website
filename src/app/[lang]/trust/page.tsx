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
  return getRouteMetadata('/platform/trust', params.lang);
}

export default async function TrustPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  // Permanent redirect legacy trust route to canonical platform trust architecture (HTTP 308)
  // Canonical destination articulates lawful basis (temei legal) and data minimization (minimizare a datelor) principles
  permanentRedirect(`/${params.lang}/platform/trust`);
}
