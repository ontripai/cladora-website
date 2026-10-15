import { permanentRedirect } from 'next/navigation';
import { Language } from '@/types';
import { getLegacyDestination } from '@/config/legacy-redirects';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export default async function MetersPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const dest = getLegacyDestination('meters');
  permanentRedirect(`/${params.lang}/${dest}`);
}
