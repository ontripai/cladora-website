'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2, Lock, ShieldAlert } from 'lucide-react';
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
 * Authoritative unavailable routes (defined in access-matrix):
 * - /app/portfolio
 * - /app/migration/shadow-ledger
 * Settings routes are classified individually and remain permission gated.
 */


const copy = {
  ro: {
    restrictedTitle: 'Acces Restricționat',
    restrictedBadge: 'Politici de Securitate CLADORA',
    sessionExpiredTitle: 'Sesiune Expirată',
    sessionExpiredBadge: 'Autentificare Necesară',
    sessionExpiredMessage:
      'Sesiunea dumneavoastră a expirat sau nu mai este validă. Vă rugăm să vă autentificați din nou pentru a continua.',
    reloginButton: 'Autentificare din nou',
    forbiddenTitle: 'Acces Nepermis',
    forbiddenBadge: 'Permisiune Refuzată',
    forbiddenMessage:
      'Rolul sau nivelul de autorizare curent nu vă permite accesul la această resursă în spațiul de lucru selectat.',
    noContextTitle: 'Niciun Spațiu de Lucru',
    noContextBadge: 'Alocare în Așteptare',
    emptyWorkspaceMessage:
      'Contul dumneavoastră este activ, dar nu are încă niciun spațiu de lucru sau asociație alocată. Vă rugăm să contactați administratorul.',
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
    sessionExpiredTitle: 'Session Expired',
    sessionExpiredBadge: 'Sign In Required',
    sessionExpiredMessage:
      'Your session has expired or is no longer valid. Please sign in again to continue.',
    reloginButton: 'Sign in again',
    forbiddenTitle: 'Access Denied',
    forbiddenBadge: 'Permission Denied',
    forbiddenMessage:
      'Your current role or authorization level does not permit access to this resource in the selected workspace.',
    noContextTitle: 'No Workspace Assigned',
    noContextBadge: 'Assignment Pending',
    emptyWorkspaceMessage:
      'Your account is active, but no workspace or association has been assigned yet. Please contact your property administrator.',
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
    sessionExpiredTitle: 'نشست کاری منقضی شده است',
    sessionExpiredBadge: 'ورود مجدد الزامی است',
    sessionExpiredMessage:
      'نشست کاربری شما منقضی شده است یا دیگر معتبر نیست. لطفاً برای ادامه دوباره وارد حساب کاربری خود شوید.',
    reloginButton: 'ورود مجدد به سامانه',
    forbiddenTitle: 'دسترسی غیرمجاز',
    forbiddenBadge: 'عدم دسترسی',
    forbiddenMessage:
      'نقش یا سطح دسترسی فعلی شما در فضای کاری انتخاب‌شده اجازه مشاهده این بخش را نمی‌دهد.',
    noContextTitle: 'فضای کاری تخصیص نیافته است',
    noContextBadge: 'در انتظار انتساب',
    emptyWorkspaceMessage:
      'حساب شما فعال است، اما هنوز هیچ فضا یا مجتمعی به آن تخصیص نیافته است. لطفاً با مدیر ساختمان یا مجموعه تماس بگیرید.',
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
  reason?: 'mock' | 'permission' | 'context' | 'unknown' | 'session_expired' | 'forbidden' | 'no_context';
}) {
  const t = copy[lang] ?? copy.ro;
  const isRtl = lang === 'fa';

  const isSessionExpired = reason === 'session_expired';
  const isForbidden = reason === 'forbidden';
  const isNoContext = reason === 'no_context';

  const title = isSessionExpired
    ? t.sessionExpiredTitle
    : isForbidden
    ? t.forbiddenTitle
    : isNoContext
    ? t.noContextTitle
    : t.restrictedTitle;

  const badge = isSessionExpired
    ? t.sessionExpiredBadge
    : isForbidden
    ? t.forbiddenBadge
    : isNoContext
    ? t.noContextBadge
    : t.restrictedBadge;

  const message = isSessionExpired
    ? t.sessionExpiredMessage
    : isForbidden
    ? t.forbiddenMessage
    : isNoContext
    ? t.emptyWorkspaceMessage
    : reason === 'mock'
    ? t.mockMessage
    : reason === 'context'
    ? t.noContextMessage
    : reason === 'unknown'
    ? t.unknownMessage
    : t.permissionMessage;

  const actionHref = isSessionExpired
    ? `/${lang}/login?reason=session_expired`
    : isNoContext
    ? `/${lang}/profile`
    : `/${lang}/app/dashboard`;

  const actionLabel = isSessionExpired
    ? t.reloginButton
    : isNoContext
    ? (lang === 'fa' ? 'مشاهده پروفایل من' : lang === 'ro' ? 'Profilul meu' : 'My profile')
    : t.backToDashboard;

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div
        className={`card-proptech max-w-lg w-full bg-white p-6 sm:p-8 text-center border-t-4 shadow-elevated ${
          isSessionExpired ? 'border-t-amber-500' : 'border-t-[#E5484D]'
        }`}
      >
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
            isSessionExpired
              ? 'bg-amber-100 text-amber-700'
              : 'bg-[#FEE2E2] text-[#E5484D]'
          }`}
        >
          {isSessionExpired ? <Lock className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
        </div>

        <span
          className={`inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isSessionExpired
              ? 'bg-amber-100 text-amber-900'
              : 'bg-[#FEF2F2] text-[#DC2626]'
          }`}
        >
          {badge}
        </span>

        <h2 className="mt-3 text-xl font-display font-extrabold text-[#102A43]">
          {title}
        </h2>

        <p className="mt-2 text-xs text-[#52667A] leading-relaxed">
          {message}
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href={actionHref}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white transition shadow-sm ${
              isSessionExpired
                ? 'bg-amber-700 hover:bg-amber-800'
                : 'bg-[#102A43] hover:bg-[#243B53]'
            }`}
          >
            {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            <span>{actionLabel}</span>
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

  // 0. Explicit session expiration denial
  if (state.error === 'session_expired') {
    return <AccessRestrictedCard lang={lang} reason="session_expired" />;
  }

  // 0b. Explicit workspace permission / authorization denial
  if (state.error === 'forbidden') {
    return <AccessRestrictedCard lang={lang} reason="forbidden" />;
  }

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
  if (classification.status === 'pre-context allowed') {
    return <>{children}</>;
  }

  // Native discovery cannot use a legacy physical dashboard as workspace authority.
  // This only opens the selector; both target discovery and every domain RPC
  // independently authenticate and evaluate current canonical core assignments.
  if (classification.requirement?.nativeWorkspaceDiscovery) {
    // The Core page discovers only authorized native contexts inside its RPC.
    // Setup reviewers have no customer dashboard and keep their review context
    // out of the ordinary dashboard selector.
    return (appPath === '/app/ownership/relationships' || state.active?.scope_type === 'tenant')
      ? <>{children}</>
      : <AccessRestrictedCard lang={lang} reason="context" />;
  }

  // 5. Context requirement (all other customer routes require an assigned context)
  if (!state.active || !state.dashboard) {
    return (
      <AccessRestrictedCard
        lang={lang}
        reason={state.contexts.length === 0 ? 'no_context' : 'context'}
      />
    );
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
