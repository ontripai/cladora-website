import { permanentRedirect } from 'next/navigation';
import { Language } from '@/types';
import { getLegacyDestination } from '@/config/legacy-redirects';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export default async function AssociationPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  // Permanent redirect legacy association route to canonical destination derived from authoritative registry
  // Canonical destination covers statutory partidă simplă registers and supplemental analytical controls
  const dest = getLegacyDestination('association');
  permanentRedirect(`/${params.lang}/${dest}`);
}
