"use client";

import React from "react";
import Link from "next/link";
import {
  Bell,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Gauge,
  Gavel,
  Home,
  KeyRound,
  Landmark,
  Megaphone,
  ReceiptText,
  RefreshCw,
  Scale,
  ShieldCheck,
  UsersRound,
  Wrench,
} from "lucide-react";
import type { Language } from "@/types";
import { CladoraBrand } from "@/components/brand/CladoraBrand";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { CustomerRouteGuard } from "./CustomerRouteGuard";
import {
  CustomerContextProvider,
  useCustomerContext,
} from "./CustomerContextProvider";

const copy = {
  ro: {
    dashboard: "Tablou principal",
    accounting: "Registru contabil",
    allocations: "Alocări și drepturi",
    utilities: "Contoare și utilități",
    assets: "Active",
    maintenance: "Mentenanță",
    procurement: "Furnizori și achiziții",
    governance: "Guvernanță",
    meetings: "Ședințe",
    communications: "Comunicări",
    notifications: "Notificări",
    documents: "Documente",
    occupancy: "Ocupare și rezidenți",
    ownership: "Proprietate și contracte",
    security: "Acces și securitate",
    billing: "Facturi și creanțe",
    payments: "Plăți",
    reconciliation: "Reconciliere",
    audit: "Jurnal audit",
    context: "Context activ",
    empty: "Nu există niciun context activ alocat.",
    secure: "Context verificat de server",
  },
  en: {
    dashboard: "Dashboard",
    accounting: "Accounting ledger",
    allocations: "Allocations & rights",
    utilities: "Meters & utilities",
    assets: "Assets",
    maintenance: "Maintenance",
    procurement: "Vendors & procurement",
    governance: "Governance",
    meetings: "Meetings",
    communications: "Communications",
    notifications: "Notifications",
    documents: "Documents",
    occupancy: "Occupancy & residents",
    ownership: "Ownership & leases",
    security: "Access & security",
    billing: "Billing & receivables",
    payments: "Payments",
    reconciliation: "Reconciliation",
    audit: "Audit log",
    context: "Active context",
    empty: "No active assigned context is available.",
    secure: "Server-verified context",
  },
  fa: {
    dashboard: "داشبورد",
    accounting: "دفتر کل حسابداری",
    allocations: "تسهیم و حقوق مالی",
    utilities: "کنتورها و خدمات",
    assets: "دارایی‌ها",
    maintenance: "نگهداری",
    procurement: "فروشندگان و تدارکات",
    governance: "حاکمیت",
    meetings: "جلسات",
    communications: "ارتباطات",
    notifications: "اعلان‌ها",
    documents: "اسناد",
    occupancy: "سکونت و ساکنان",
    ownership: "مالکیت و اجاره‌ها",
    security: "دسترسی و امنیت",
    billing: "صورتحساب‌ها و مطالبات",
    payments: "پرداخت‌ها",
    reconciliation: "تطبیق بانکی",
    audit: "گزارش بازرسی",
    context: "زمینه فعال",
    empty: "هیچ زمینه تخصیص‌یافته فعالی وجود ندارد.",
    secure: "زمینه تأییدشده توسط سرور",
  },
};

function Shell({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: Language;
}) {
  const state = useCustomerContext();
  const t = copy[lang];

  const accounting = state.dashboard?.modules.includes("accounting"),
    billing = state.dashboard?.modules.includes("billing"),
    payments = state.dashboard?.modules.includes("payments"),
    utilities = state.dashboard?.entitlements.includes("module.utilities"),
    maintenance = state.dashboard?.entitlements.includes("module.maintenance"),
    procurement =
      maintenance &&
      state.dashboard?.permissions.includes("maintenance.procurement.read"),
    governance = state.dashboard?.entitlements.includes("module.governance"),
    communications = state.dashboard?.entitlements.includes(
      "module.communications",
    ),
    documents = state.dashboard?.entitlements.includes("module.documents"),
    occupancy = state.dashboard?.entitlements.includes("module.occupancy"),
    security = state.dashboard?.entitlements.includes("module.security"),
    audit = state.dashboard?.permissions.includes("audit.events.read");

  const navItems = [
    { href: `/${lang}/app/dashboard`, label: t.dashboard, icon: Home, visible: true },
    { href: `/${lang}/app/accounting`, label: t.accounting, icon: FileSpreadsheet, visible: accounting },
    { href: `/${lang}/app/accounting/allocations`, label: t.allocations, icon: Scale, visible: accounting },
    { href: `/${lang}/app/meters`, label: t.utilities, icon: Gauge, visible: utilities },
    { href: `/${lang}/app/assets`, label: t.assets, icon: Boxes, visible: maintenance },
    { href: `/${lang}/app/maintenance`, label: t.maintenance, icon: Wrench, visible: maintenance },
    { href: `/${lang}/app/vendors`, label: t.procurement, icon: BriefcaseBusiness, visible: procurement },
    { href: `/${lang}/app/governance`, label: t.governance, icon: Gavel, visible: governance },
    { href: `/${lang}/app/meetings`, label: t.meetings, icon: UsersRound, visible: governance },
    { href: `/${lang}/app/communications`, label: t.communications, icon: Megaphone, visible: communications },
    { href: `/${lang}/app/notifications`, label: t.notifications, icon: Bell, visible: communications },
    { href: `/${lang}/app/documents`, label: t.documents, icon: FileText, visible: documents },
    { href: `/${lang}/app/occupancy`, label: t.occupancy, icon: UsersRound, visible: occupancy },
    { href: `/${lang}/app/ownership`, label: t.ownership, icon: Landmark, visible: occupancy },
    { href: `/${lang}/app/security-access`, label: t.security, icon: KeyRound, visible: security },
    { href: `/${lang}/app/billing`, label: t.billing, icon: ReceiptText, visible: billing },
    { href: `/${lang}/app/payments`, label: t.payments, icon: CreditCard, visible: payments },
    { href: `/${lang}/app/reconciliation`, label: t.reconciliation, icon: Landmark, visible: payments },
    { href: `/${lang}/app/audit`, label: t.audit, icon: ShieldCheck, visible: audit },
  ].filter((item) => Boolean(item.visible));

  return (
    <div
      className="min-h-screen bg-[#F6F9FC] text-[#102A43]"
      dir={lang === "fa" ? "rtl" : "ltr"}
    >
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 py-2 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/${lang}`} aria-label="CLADORA">
            <CladoraBrand variant="symbol" className="h-8 w-8" />
          </Link>
          <Building2 className="h-4 w-4 shrink-0 text-[#0E9F8E]" />
          <label className="min-w-0 text-xs font-bold">
            <span className="sr-only">{t.context}</span>
            <select
              aria-label={t.context}
              value={state.active?.context_id ?? ""}
              onChange={(e) => state.select(e.target.value)}
              disabled={!state.contexts.length}
              className="max-w-[230px] rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2"
            >
              <option value="">{t.empty}</option>
              {state.contexts.map((c) => (
                <option value={c.context_id} key={c.context_id}>
                  {c.tenant_name} · {c.context_label} · {c.role_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={state.refresh}
            disabled={!state.active || state.loading}
            aria-label="Refresh"
            className="rounded-xl border border-[#E2E8F0] p-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`}
            />
          </button>
          <LanguageSwitcher currentLang={lang} variant="header" />
          <SignOutButton lang={lang} variant="customer" />
        </div>
      </header>

      {/* Mobile Horizontal Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="flex md:hidden items-center gap-2 overflow-x-auto border-b border-[#E2E8F0] bg-white px-3 py-2.5 text-xs font-semibold whitespace-nowrap shadow-sm"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1.5 text-xs font-bold text-[#102A43] hover:bg-[#F1F5F9] shrink-0"
            >
              <Icon className="h-3.5 w-3.5 text-[#0E9F8E]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden min-h-[calc(100vh-4rem)] w-64 border-e border-[#E2E8F0] bg-white p-4 md:block">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#102A43] hover:bg-[#F6F9FC]"
                >
                  <Icon className="h-4 w-4 text-[#0E9F8E]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-xl border border-[#B2E5DF] bg-[#EAF8F5] p-3 text-xs text-[#0A6E62]">
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              {t.secure}
            </div>
            {state.active ? (
              <div className="mt-2 text-[11px]">
                {state.active.role_name} · {state.active.scope_type}
              </div>
            ) : null}
          </div>
        </aside>

        {/* Main Content protected by CustomerRouteGuard */}
        <main className="min-w-0 flex-1 p-4 sm:p-8">
          <CustomerRouteGuard lang={lang}>{children}</CustomerRouteGuard>
        </main>
      </div>
    </div>
  );
}

export function CustomerAppShell({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: Language;
}) {
  return (
    <CustomerContextProvider>
      <Shell lang={lang}>{children}</Shell>
    </CustomerContextProvider>
  );
}
