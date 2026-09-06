'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  Building2,
  FileCheck2,
  Layers,
  Users2,
  KeyRound,
  Terminal,
  FileText,
  LifeBuoy,
  Lock,
  LogOut,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import type { PlatformAuthContext, PlatformRole } from '@/types/platform';
import { isRtlLocale, type Language } from '@/types';
import { CladoraBrand } from '@/components/brand/CladoraBrand';
import { SignOutButton } from '@/components/auth/SignOutButton';

interface PlatformShellProps {
  children: React.ReactNode;
  lang: string;
  authCtx: PlatformAuthContext;
}

export function PlatformShell({ children, lang, authCtx }: PlatformShellProps) {
  const pathname = usePathname();
  const isRtl = isRtlLocale(lang as 'ro' | 'en' | 'fa');

  const navItems = [
    {
      href: `/${lang}/platform/overview`,
      label: lang === 'ro' ? 'Prezentare Generală' : lang === 'fa' ? 'نمای کلی پلتفرم' : 'Platform Overview',
      icon: ShieldCheck,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_FINANCE', 'PLATFORM_SUPPORT', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
    {
      href: `/${lang}/platform/workspaces`,
      label: lang === 'ro' ? 'Spații de Lucru & Clienți' : lang === 'fa' ? 'محیط‌های کاری و مشتریان' : 'Customers & Workspaces',
      icon: Building2,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_FINANCE', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
    {
      href: `/${lang}/platform/contracts`,
      label: lang === 'ro' ? 'Contracte & Facturare' : lang === 'fa' ? 'قراردادها و صدور صورت‌حساب' : 'Contracts & Billing',
      icon: FileCheck2,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_FINANCE', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
    {
      href: `/${lang}/platform/plans`,
      label: lang === 'ro' ? 'Planuri & Drepturi' : lang === 'fa' ? 'طرح‌ها و دسترسی‌های مجاز' : 'Plans & Entitlements',
      icon: Layers,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_FINANCE', 'PLATFORM_OPERATIONS', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
    {
      href: `/${lang}/platform/users`,
      label: lang === 'ro' ? 'Utilizatori Interni' : lang === 'fa' ? 'کاربران داخلی پلتفرم' : 'Internal Users & Roles',
      icon: Users2,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
    {
      href: `/${lang}/platform/assignments`,
      label: lang === 'ro' ? 'Alocări Clienți' : lang === 'fa' ? 'تخصیص مشتریان به کارشناسان' : 'Customer Assignments',
      icon: KeyRound,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
    {
      href: `/${lang}/platform/provisioning`,
      label: lang === 'ro' ? 'Rulări Provizionare' : lang === 'fa' ? 'سوابق آماده‌سازی و فعال‌سازی' : 'Provisioning Runs',
      icon: Terminal,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_OPERATIONS', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
    {
      href: `/${lang}/platform/audit`,
      label: lang === 'ro' ? 'Jurnal Audit & Securitate' : lang === 'fa' ? 'گزارش‌های ممیزی و امنیت' : 'Security & Audit Logs',
      icon: FileText,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
    {
      href: `/${lang}/platform/support`,
      label: lang === 'ro' ? 'Acces Suport & Tichete' : lang === 'fa' ? 'دسترسی پشتیبانی فنی' : 'Support Access (Dual-Control)',
      icon: LifeBuoy,
      roles: ['PLATFORM_SUPER_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_OPERATIONS', 'PLATFORM_AUDITOR'] as PlatformRole[],
    },
  ];

  const userRoles = authCtx.roles;
  const filteredNav = navItems.filter((item) =>
    item.roles.some((r) => userRoles.includes(r))
  );

  return (
    <div
      className={`min-h-screen bg-[#0C1929] text-white flex flex-col md:flex-row ${
        isRtl ? 'font-vazirmatn text-right' : 'font-sans text-left'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#08121D] border-r md:border-b-0 border-[#1B324D] flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Platform Badge */}
          <div className="p-5 border-b border-[#1B324D] flex items-center justify-between">
            <Link href={`/${lang}/platform/overview`} aria-label="CLADORA Control Plane" className="flex items-center gap-2">
              <CladoraBrand variant="symbol" className="h-8 w-8" />
              <div>
                <span className="text-[10px] font-semibold text-emerald-400 tracking-wider uppercase block mt-0.5">
                  CONTROL PLANE
                </span>
              </div>
            </Link>
          </div>

          {/* Actor Profile & Security Level */}
          <div className="p-4 mx-3 my-3 bg-[#0F2236] rounded border border-[#1E3A5A]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-200 truncate">
                {authCtx.platformUser?.display_name || 'Platform Operator'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Ref: {authCtx.platformUser?.employee_ref || 'EMP-SYSTEM'}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {authCtx.roles.map((r) => (
                <span
                  key={r}
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#14324F] text-emerald-300 border border-[#1D4A73]"
                >
                  {r.replace('PLATFORM_', '')}
                </span>
              ))}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            {filteredNav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-[#12283E] hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer / Status */}
        <div className="p-4 border-t border-[#1B324D] text-[11px] text-slate-400 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>ADR-CLD-023</span>
            </span>
            <span className="px-1.5 py-0.5 bg-[#142A40] text-[10px] rounded font-mono text-emerald-400">
              AUDITED
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            Customer Data Plane Separation strictly enforced.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-[#0B1726] flex flex-col">
        {/* Top Header */}
        <header className="h-14 border-b border-[#1B324D] bg-[#091522] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Platform Control Plane</span>
            {isRtl ? (
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="text-emerald-400 font-semibold truncate">
              {pathname.split('/').pop() || 'Overview'}
            </span>
          </div>

          {/* Locale & Exit */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs">
              <Link
                href={`/ro/platform/overview`}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  lang === 'ro' ? 'bg-emerald-500/30 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                RO
              </Link>
              <Link
                href={`/en/platform/overview`}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  lang === 'en' ? 'bg-emerald-500/30 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </Link>
              <Link
                href={`/fa/platform/overview`}
                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  lang === 'fa' ? 'bg-emerald-500/30 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                FA
              </Link>
            </div>
            <SignOutButton lang={lang as Language} variant="platform" />
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
