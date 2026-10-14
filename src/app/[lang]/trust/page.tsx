import { permanentRedirect } from 'next/navigation';
import { Language } from '@/types';
import { getLegacyDestination } from '@/config/legacy-redirects';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export default async function TrustPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  // Permanent redirect legacy trust route to canonical platform trust architecture (HTTP 308)
  // Canonical destination articulates lawful basis (temei legal) and data minimization (minimizare a datelor) principles
  const dest = getLegacyDestination('trust');
  permanentRedirect(`/${params.lang}/${dest}`);
}
