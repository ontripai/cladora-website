'use client';

import React, { use } from 'react';
import type { Language } from '@/types';
import { CustomerAuditDashboard } from '@/components/customer/CustomerAuditDashboard';

export default function AuditTrailPage(props: { params: Promise<{ lang: Language }> }) {
  const params = use(props.params);
  const { lang } = params;

  return <CustomerAuditDashboard lang={lang} />;
}
