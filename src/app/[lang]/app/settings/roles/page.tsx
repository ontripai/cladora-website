'use client';

import React, { use } from 'react';
import type { Language } from '@/types';
import { CustomerWorkspaceRolesDashboard } from '@/components/customer/CustomerWorkspaceRolesDashboard';

export default function WorkspaceRolesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = use(props.params);
  const { lang } = params;

  return <CustomerWorkspaceRolesDashboard lang={lang} />;
}
