'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, ShieldAlert } from 'lucide-react';
import type { Language } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';

const MOCK_ROUTES = [
  '/app/portfolio',
  '/app/settings',
  '/app/accounting/month-close',
  '/app/migration/shadow-ledger',
] as const;

interface RouteRequirement {
  pathPrefix: string;
  exactOnly?: boolean;
  permissions?: string[];
  entitlements?: string[];
}

export const ROUTE_REQUIREMENTS: RouteRequirement[] = [
  {
    pathPrefix: '/app/accounting/allocations',
    permissions: ['finance.allocations.read'],
  },
  {
    pathPrefix: '/app/accounting',
    permissions: ['finance.ledger.read'],
  },
  {
    pathPrefix: '/app/billing',
    permissions: ['billing.receivables.read'],
  },
  {
    pathPrefix: '/app/payments',
    permissions: ['payments.reconciliation.read'],
  },
  {
    pathPrefix: '/app/reconciliation',
    permissions: ['payments.reconciliation.read'],
  },
  {
    pathPrefix: '/app/meters',
    permissions: ['utilities.metering.read'],
    entitlements: ['module.utilities'],
  },
  {
    pathPrefix: '/app/assets',
    permissions: ['maintenance.assets.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/maintenance',
    permissions: ['maintenance.assets.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/procurement',
    permissions: ['maintenance.procurement.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/vendors',
    permissions: ['maintenance.procurement.read'],
    entitlements: ['module.maintenance'],
  },
  {
    pathPrefix: '/app/governance',
    permissions: ['governance.meetings.read'],
    entitlements: ['module.governance'],
  },
  {
    pathPrefix: '/app/meetings',
    permissions: ['governance.meetings.read'],
    entitlements: ['module.governance'],
  },
  {
    pathPrefix: '/app/communications',
    permissions: ['communications.feed.read'],
    entitlements: ['module.communications'],
  },
  {
    pathPrefix: '/app/notifications',
    permissions: ['communications.feed.read'],
    entitlements: ['module.communications'],
  },
  {
    pathPrefix: '/app/documents',
    permissions: ['documents.vault.read'],
    entitlements: ['module.documents'],
  },
  {
    pathPrefix: '/app/occupancy',
    permissions: ['occupancy.registry.read'],
    entitlements: ['module.occupancy'],
  },
  {
    pathPrefix: '/app/ownership',
    permissions: ['occupancy.registry.read'],
    entitlements: ['module.occupancy'],
  },
  {
    pathPrefix: '/app/security-access',
    permissions: ['security.access.read'],
    entitlements: ['module.security'],
  },
  {
    pathPrefix: '/app/audit',
    permissions: ['audit.events.read'],
  },
];

const copy = {
  ro: {
    restrictedTitle: 'Acces Restricționat',
    restrictedBadge: 'Politici de Securitate CLADORA',
    mockMessage:
      'Această secțiune este un modul demonstrativ / sandbox nelansat și nu este disponibilă în panoul de producție.',
    permissionMessage:
      'Nu aveți permisiunile sau drepturile de modul necesare pentru a accesa această secțiune în contextul selectat.',
    noContextMessage:
      'Nu aveți un context activ alocat pentru această acțiune. Selectați un context valid din antet.',
    backToDashboard: 'Înapoi la Tabloul principal',
    verifying: 'Se verifică autorizarea...',
  },
  en: {
    restrictedTitle: 'Access Restricted',
    restrictedBadge: 'CLADORA Security Policy',
    mockMessage:
      'This section is an unreleased preview or sandbox module and is unavailable in the production customer panel.',
    permissionMessage:
      'You do not have the required role permissions or module entitlements to access this section in the current context.',
    noContextMessage:
      'No active customer context is assigned for this operation. Please select a valid context in the header.',
    backToDashboard: 'Back to Dashboard',
    verifying: 'Verifying authorization...',
  },
  fa: {
    restrictedTitle: 'دسترسی محدود شده است',
    restrictedBadge: 'سیاست‌های امنیتی CLADORA',
    mockMessage:
      'این بخش یک ماژول آزمایشی / پیش‌نمایش توسعه است و در پنل عملیاتی پروداکشن در دسترس نیست.',
    permissionMessage:
      'شما مجوزها یا دسترسی‌های لازم ماژول را برای مشاهده این بخش در زمینه کاری فعلی ندارید.',
    noContextMessage:
      'هیچ زمینه کاری فعالی برای این عملیات تعیین نشده است. لطفاً از نوار بالا یک مجتمع/واحد را انتخاب کنید.',
    backToDashboard: 'بازگشت به داشبورد',
    verifying: 'در حال بررسی سطوح دسترسی...',
  },
} as const;

export function AccessRestrictedCard({
  lang,
  reason = 'permission',
}: {
  lang: Language;
  reason?: 'mock' | 'permission' | 'context';
}) {
  const t = copy[lang] ?? copy.ro;
  const isRtl = lang === 'fa';

  const message =
    reason === 'mock'
      ? t.mockMessage
      : reason === 'context'
      ? t.noContextMessage
      : t.permissionMessage;

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="card-proptech max-w-lg w-full bg-white p-6 sm:p-8 text-center border-t-4 border-t-[#E5484D] shadow-elevated">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEE2E2] text-[#E5484D]">
          <ShieldAlert className="h-6 w-6" />
        </div>

        <span className="inline-block rounded-full bg-[#FEF2F2] px-3 py-1 text-[10px] font-bold text-[#DC2626] uppercase tracking-wider">
          {t.restrictedBadge}
        </span>

        <h2 className="mt-3 text-xl font-display font-extrabold text-[#102A43]">
          {t.restrictedTitle}
        </h2>

        <p className="mt-2 text-xs text-[#52667A] leading-relaxed">
          {message}
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href={`/${lang}/app/dashboard`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#102A43] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#243B53] shadow-sm"
          >
            {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span>{t.backToDashboard}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CustomerRouteGuard({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: Language;
}) {
  const pathname = usePathname() || '';
  const state = useCustomerContext();
  const t = copy[lang] ?? copy.ro;

  // Normalize path by stripping language prefix e.g. /ro/app/accounting -> /app/accounting
  const appPath = pathname.replace(/^\/(?:ro|en|fa)/, '');

  // 1. Fail-closed on mock / preview pages in production panel
  const isMockRoute = MOCK_ROUTES.some(
    (mockPath) => appPath === mockPath || appPath.startsWith(`${mockPath}/`)
  );

  if (isMockRoute) {
    return <AccessRestrictedCard lang={lang} reason="mock" />;
  }

  // 2. Loading state while customer context is resolving
  if (state.loading && !state.dashboard) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#0E9F8E]" />
          <span className="text-xs font-semibold text-[#52667A]">
            {t.verifying}
          </span>
        </div>
      </div>
    );
  }

  // 3. Ensure active context exists for all customer sub-routes
  if (!state.active && !state.loading) {
    return <AccessRestrictedCard lang={lang} reason="context" />;
  }

  // 4. Route-level permissions and entitlements
  const userPermissions = state.dashboard?.permissions ?? [];
  const userEntitlements = state.dashboard?.entitlements ?? [];

  // Find matching requirement (longest matching prefix first)
  const sortedRequirements = [...ROUTE_REQUIREMENTS].sort(
    (a, b) => b.pathPrefix.length - a.pathPrefix.length
  );

  const matchedRequirement = sortedRequirements.find((req) =>
    req.exactOnly
      ? appPath === req.pathPrefix
      : appPath === req.pathPrefix || appPath.startsWith(`${req.pathPrefix}/`)
  );

  if (matchedRequirement) {
    if (matchedRequirement.permissions) {
      const hasAllPermissions = matchedRequirement.permissions.every((p) =>
        userPermissions.includes(p)
      );
      if (!hasAllPermissions) {
        return <AccessRestrictedCard lang={lang} reason="permission" />;
      }
    }

    if (matchedRequirement.entitlements) {
      const hasAllEntitlements = matchedRequirement.entitlements.every((e) =>
        userEntitlements.includes(e)
      );
      if (!hasAllEntitlements) {
        return <AccessRestrictedCard lang={lang} reason="permission" />;
      }
    }
  }

  return <>{children}</>;
}
