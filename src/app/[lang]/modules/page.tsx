import { permanentRedirect } from 'next/navigation';
import { Language } from '@/types';
import { getLegacyDestination } from '@/config/legacy-redirects';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export default async function ModulesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const dest = getLegacyDestination('modules');
  permanentRedirect(`/${params.lang}/${dest}`);
}
