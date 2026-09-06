'use client';

import React, { use } from 'react';
import type { Language } from '@/types';
import { AccessRestrictedCard } from '@/components/customer/CustomerRouteGuard';

export default function MonthClosePage(props: { params: Promise<{ lang: Language }> }) {
  const params = use(props.params);
  const { lang } = params;

  return <AccessRestrictedCard lang={lang} reason="mock" />;
}
