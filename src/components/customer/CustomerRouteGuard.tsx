'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, ShieldAlert } from 'lucide-react';
import type { Language } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';

import {
  EXPLICITLY_ALLOWED_ROUTES,
  EXPLICITLY_UNAVAILABLE_ROUTES,
  ROUTE_REQUIREMENTS,
  classifyCustomerRoute,
  type RouteRequirement,
  type RouteStatus,
} from '@/lib/customer/route-classifier';
import {
  isCanonicalRole,
  isRouteAllowedForPersona,
  isPreContextRoute,
} from '@/lib/customer/access-matrix';

export {
  EXPLICITLY_ALLOWED_ROUTES,
  EXPLICITLY_UNAVAILABLE_ROUTES,
  ROUTE_REQUIREMENTS,
  classifyCustomerRoute,
  type RouteRequirement,
  type RouteStatus,
};

/**
 * Authoritative fail-closed unavailable routes (defined in access-matrix):
 * - /app/portfolio
 * - /app/settings
 * - /app/accounting/month-close
 * - /app/migration/shadow-ledger
 */


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
    unknownMessage:
      'Această pagină nu este configurată sau accesul este restricționat conform politicilor de securitate.',
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
    unknownMessage:
      'This route is unconfigured or access is restricted by security policy.',
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
    unknownMessage:
      'این مسیر تعریف‌نشده است یا دسترسی به آن بر اساس سیاست‌های امنیتی مسدود می‌باشد.',
    backToDashboard: 'بازگشت به داشبورد',
    verifying: 'در حال بررسی سطوح دسترسی...',
  },
} as const;

export function AccessRestrictedCard({
  lang,
  reason = 'permission',
}: {
  lang: Language;
  reason?: 'mock' | 'permission' | 'context' | 'unknown';
}) {
  const t = copy[lang] ?? copy.ro;
  const isRtl = lang === 'fa';

  const message =
    reason === 'mock'
      ? t.mockMessage
      : reason === 'context'
      ? t.noContextMessage
      : reason === 'unknown'
      ? t.unknownMessage
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
  const rawPath = pathname.replace(/^\/(?:ro|en|fa)/, '');
  const appPath = rawPath === '/app' ? '/app/dashboard' : rawPath;

  const classification = classifyCustomerRoute(appPath);

  // 1. Fail-closed on unknown routes under /app by default
  if (!classification) {
    return <AccessRestrictedCard lang={lang} reason="unknown" />;
  }

  // 2. Fail-closed on explicitly unavailable mock / preview routes
  if (classification.status === 'explicitly unavailable') {
    return <AccessRestrictedCard lang={lang} reason="mock" />;
  }

  // 3. Loading state while customer context is resolving
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

  // 4. Pre-context route policy check (e.g. onboarding before context assignment)
  if (isPreContextRoute(appPath)) {
    return <>{children}</>;
  }

  // 5. Context requirement (all other customer routes require an assigned context)
  if (!state.active || !state.dashboard) {
    return <AccessRestrictedCard lang={lang} reason="context" />;
  }

  // 6. Role-aware Persona canonical check
  const roleCode = state.dashboard.context?.role_code;
  if (!roleCode || !isCanonicalRole(roleCode)) {
    return <AccessRestrictedCard lang={lang} reason="unknown" />;
  }

  // 7. Persona route allowlist check (routes outside allowlist are strictly rejected)
  if (!isRouteAllowedForPersona(roleCode, appPath)) {
    return <AccessRestrictedCard lang={lang} reason="permission" />;
  }

  // 8. Explicitly allowed routes (e.g. dashboard) pass through once persona allowlist is confirmed
  if (classification.status === 'explicitly allowed') {
    return <>{children}</>;
  }

  // 6. Permission protected routes: verify modules, entitlements, and permissions
  const req = classification.requirement!;
  const userPermissions = state.dashboard?.permissions ?? [];
  const userEntitlements = state.dashboard?.entitlements ?? [];
  const userModules = state.dashboard?.modules ?? [];

  if (req.modules) {
    const hasModules = req.modules.every(
      (m: string) =>
        userModules.includes(m) ||
        userEntitlements.includes(m) ||
        userEntitlements.includes(`module.${m}`)
    );
    if (!hasModules) {
      return <AccessRestrictedCard lang={lang} reason="permission" />;
    }
  }

  if (req.entitlements) {
    const hasEntitlements = req.entitlements.every(
      (e: string) =>
        userEntitlements.includes(e) ||
        userModules.includes(e) ||
        userModules.includes(e.replace(/^module\./, ''))
    );
    if (!hasEntitlements) {
      return <AccessRestrictedCard lang={lang} reason="permission" />;
    }
  }

  if (req.permissions) {
    const hasPermissions = req.permissions.every((p: string) =>
      userPermissions.includes(p)
    );
    if (!hasPermissions) {
      return <AccessRestrictedCard lang={lang} reason="permission" />;
    }
  }

  return <>{children}</>;
}
