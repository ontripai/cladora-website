'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  FileSpreadsheet,
  FileText,
  Gavel,
  Home,
  Loader2,
  Lock,
  Megaphone,
  Receipt,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  Wallet,
  Wrench,
  Gauge,
} from 'lucide-react';
import type { Language } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';
import {
  isCanonicalRole,
  isSectionAllowed,
  isPersonaReadOnly,
  type CanonicalRole,
} from '@/lib/customer/access-matrix';
import { AccessRestrictedCard } from './CustomerRouteGuard';

const copy = {
  ro: {
    title: 'Tablou principal',
    subtitle: 'Prezentare securizată autorizată la nivel de server conform rolului și contextului',
    loading: 'Se încarcă datele securizate ale contextului…',
    empty: 'Nu există niciun context activ alocat. Selectați un context din antet.',
    error: 'Datele tabloului nu au putut fi încărcate securizat.',
    unknownRole: 'Rolul activ nu este autorizat pentru acces în panoul de producție.',
    verifiedBadge: 'Autorizat Server & DB',
    readOnlyBadge: 'Mod Inspecție — Exclusiv Citire',
    governanceBadge: 'Supraveghere & Guvernanță',
    ownerBadge: 'Panou Proprietar',
    residentBadge: 'Panou Rezident / Chiriaș',
    managementBadge: 'Panou Operativ & Administrare',
    supervisoryOversight: 'Supraveghere — Exclusiv Citire',
    activeMeters: 'Contoare active',
    auditEncryption: 'Criptat AAL2',
    buildingsUnits: (b: string | number, u: string | number) => `${b} clădiri · ${u} unități`,
    scopes: {
      tenant: 'Asociație',
      property: 'Proprietate',
      building: 'Clădire',
      unit: 'Unitate',
    },
    kpis: {
      properties: 'Proprietăți în context',
      buildings: 'Clădiri în context',
      units: 'Unități în context',
      work: 'Lucrări deschise',
      notifications: 'Notificări necitite',
      receivables: 'Sold restant',
      financialRecords: 'Înregistrări financiare',
      myUnits: 'Unitățile mele',
      myOpenRequests: 'Cereri active de service',
      myOpenTickets: 'Tichete deschise',
      outstandingCharges: 'Cote & cheltuieli restante',
    },
    kpiSubtitles: {
      activeMaintenance: 'Lucrări active de mentenanță',
      totalCommunityDues: 'Total creanțe asociație',
      unreadNotices: 'Înștiințări necitite',
      governanceOversight: 'Supraveghere guvernanță',
      associationReceivables: 'Creanțe asociație',
      inProgressJobs: 'Lucrări în derulare',
      boardDispatches: 'Comunicări comitet',
      ledgerAuditCorpus: 'Registru general pentru audit',
      reconciledBalance: 'Sold reconciliat',
      auditAlerts: 'Alerte de audit',
      titleRegisteredUnits: 'Unități înregistrate cu titlu',
      maintenanceReserveDues: 'Întreținere & fond rulment',
      technicalTickets: 'Tichete tehnice',
      buildingNotices: 'Înștiințări imobil',
      assignedUtilitiesMaintenance: 'Utilități & cotă întreținere',
      activeMaintenanceIssues: 'Probleme tehnice active',
      residentialUpdates: 'Actualizări rezidențiale',
    },
    sections: {
      operations: 'Operațiuni & Patrimoniu',
      operationsDesc: 'Monitorizarea clădirilor, unităților și infrastructurii din contextul activ.',
      financials: 'Situație Financiară & Creanțe',
      financialsDesc: 'Urmărirea facturilor emise, plăților recepționate și soldurilor restante.',
      governance: 'Guvernanță & Decizii de Asociație',
      governanceDesc: 'Ședințe programate, hotărâri statutare și procese-verbale validate.',
      financialSummary: 'Sinteză Financiară Supervizor',
      financialSummaryDesc: 'Raport sintetic al activelor, colectărilor și angajamentelor financiare.',
      financialControls: 'Controale Financiare & Cenzorat',
      financialControlsDesc: 'Inspecție nealterabilă a registrelor contabile, jurnalelor și reconcilierilor.',
      myUnits: 'Proprietățile Mele',
      myUnitsDesc: 'Unitățile deținute conform actelor de proprietate înregistrate.',
      myFinancials: 'Situația Mea Financiară',
      myFinancialsDesc: 'Defalcarea cotelor de întreținere, fondurilor de rulment și plăților.',
      myResidence: 'Locuința Mea',
      myResidenceDesc: 'Datele de identificare și utilizare a unității locative alocate.',
      myExpenses: 'Cheltuieli & Utilități Alocate',
      myExpensesDesc: 'Detalierea cheltuielilor de întreținere și a consumurilor de utilități.',
      myConsumption: 'Contoare & Consumuri Individuale',
      myConsumptionDesc: 'Indexurile contoarelor de apă, energie și termie asociate unității.',
      audit: 'Jurnal de Audit Securizat',
      auditDesc: 'Urmărirea evenimentelor administrative cu trasabilitate criptografică.',
    },
    actions: {
      viewDetails: 'Vizualizează detalii',
      viewWorkOrders: 'Vezi comenzi de lucru',
      viewInvoices: 'Vezi facturi & creanțe',
      inspectLedger: 'Inspectează registru contabil',
      viewGovernance: 'Vezi hotărâri asociație',
      viewMeters: 'Vezi contoare & consum',
      viewAudit: 'Consultă jurnal audit',
    },
  },
  en: {
    title: 'Dashboard',
    subtitle: 'Server-authoritative presentation scoped strictly to active role and context',
    loading: 'Loading verified customer context data…',
    empty: 'No active customer context is assigned. Please select a context from the header.',
    error: 'The dashboard data could not be securely loaded.',
    unknownRole: 'The active role is not authorized for production portal access.',
    verifiedBadge: 'Server & DB Verified',
    readOnlyBadge: 'Audit Inspection Mode — Read Only',
    governanceBadge: 'Supervisory & Governance',
    ownerBadge: 'Owner Portal',
    residentBadge: 'Resident / Tenant Portal',
    managementBadge: 'Operations & Management Portal',
    supervisoryOversight: 'ReadOnly Oversight',
    activeMeters: 'Active meters',
    auditEncryption: 'AAL2 Encrypted',
    buildingsUnits: (b: string | number, u: string | number) => `${b} buildings · ${u} units`,
    scopes: {
      tenant: 'Association',
      property: 'Property',
      building: 'Building',
      unit: 'Unit',
    },
    kpis: {
      properties: 'Properties in context',
      buildings: 'Buildings in context',
      units: 'Units in context',
      work: 'Open work orders',
      notifications: 'Unread notifications',
      receivables: 'Outstanding balance',
      financialRecords: 'Financial records',
      myUnits: 'My units',
      myOpenRequests: 'My service requests',
      myOpenTickets: 'Open repair tickets',
      outstandingCharges: 'Outstanding charges',
    },
    kpiSubtitles: {
      activeMaintenance: 'Active maintenance',
      totalCommunityDues: 'Total community dues',
      unreadNotices: 'Unread notices',
      governanceOversight: 'Governance oversight',
      associationReceivables: 'Association receivables',
      inProgressJobs: 'In-progress jobs',
      boardDispatches: 'Board dispatches',
      ledgerAuditCorpus: 'Ledger audit corpus',
      reconciledBalance: 'Reconciled balance',
      auditAlerts: 'Audit alerts',
      titleRegisteredUnits: 'Title-registered units',
      maintenanceReserveDues: 'Maintenance & reserve dues',
      technicalTickets: 'Technical tickets',
      buildingNotices: 'Building notices',
      assignedUtilitiesMaintenance: 'Assigned utilities & maintenance',
      activeMaintenanceIssues: 'Active maintenance issues',
      residentialUpdates: 'Residential updates',
    },
    sections: {
      operations: 'Operations & Assets',
      operationsDesc: 'Monitoring of buildings, units, and infrastructure in the active context.',
      financials: 'Financial Status & Receivables',
      financialsDesc: 'Tracking of issued invoices, collected payments, and balances.',
      governance: 'Governance & Association Decisions',
      governanceDesc: 'Scheduled meetings, statutory resolutions, and approved minutes.',
      financialSummary: 'Supervisory Financial Summary',
      financialSummaryDesc: 'Executive overview of assets, collections, and financial commitments.',
      financialControls: 'Financial Controls & Censor Audit',
      financialControlsDesc: 'Immutable inspection of general ledger journals and reconciliation checks.',
      myUnits: 'My Properties',
      myUnitsDesc: 'Units owned according to recorded property registry titles.',
      myFinancials: 'My Financial Account',
      myFinancialsDesc: 'Breakdown of maintenance fees, reserve funds, and receipts.',
      myResidence: 'My Residence',
      myResidenceDesc: 'Identification and occupancy details of your assigned residential unit.',
      myExpenses: 'Assigned Expenses & Utilities',
      myExpensesDesc: 'Itemized maintenance charges and utility consumption shares.',
      myConsumption: 'Individual Meters & Consumption',
      myConsumptionDesc: 'Meter readings for water, electricity, and heating for your unit.',
      audit: 'Cryptographic Audit Trail',
      auditDesc: 'Chronological tracking of administrative actions and compliance logs.',
    },
    actions: {
      viewDetails: 'View details',
      viewWorkOrders: 'View work orders',
      viewInvoices: 'View invoices & receivables',
      inspectLedger: 'Inspect ledger',
      viewGovernance: 'View governance records',
      viewMeters: 'View meters & readings',
      viewAudit: 'View audit trail',
    },
  },
  fa: {
    title: 'داشبورد',
    subtitle: 'نمای اختصاصی و معتبر تعیین‌شده توسط سرور بر اساس نقش، زمینه و مجوزها',
    loading: 'در حال بارگذاری امن داده‌های زمینه فعال…',
    empty: 'هیچ زمینه تخصیص‌یافته فعالی وجود ندارد. لطفاً از نوار بالا یک زمینه را انتخاب کنید.',
    error: 'بارگذاری امن داده‌های داشبورد ناموفق بود.',
    unknownRole: 'نقش فعال دارای مجوز دسترسی به پنل عملیاتی نیست.',
    verifiedBadge: 'تأییدشده توسط پایگاه داده و سرور',
    readOnlyBadge: 'حالت بازرسی — کاملاً فقط خواندنی',
    governanceBadge: 'نظارت و حاکمیت',
    ownerBadge: 'پنل اختصاصی مالک',
    residentBadge: 'پنل اختصاصی ساکن / مستأجر',
    managementBadge: 'پنل مدیریت و عملیات',
    supervisoryOversight: 'نظارت حاکمیتی — صرفاً خواندنی',
    activeMeters: 'کنتورهای فعال',
    auditEncryption: 'رمزنگاری‌شده AAL2',
    buildingsUnits: (b: string | number, u: string | number) => `${b} ساختمان · ${u} واحد`,
    scopes: {
      tenant: 'انجمن',
      property: 'مجتمع',
      building: 'ساختمان',
      unit: 'واحد',
    },
    kpis: {
      properties: 'املاک در این زمینه',
      buildings: 'ساختمان‌های فعال',
      units: 'واحدهای تحت پوشش',
      work: 'کارهای باز نگهداری',
      notifications: 'اعلان‌های خوانده‌نشده',
      receivables: 'مانده کل مطالبات',
      financialRecords: 'اسناد مالی ثبت‌شده',
      myUnits: 'واحدهای تحت مالکیت من',
      myOpenRequests: 'درخواست‌های باز من',
      myOpenTickets: 'تیکت‌های باز تعمیرات',
      outstandingCharges: 'مانده بدهی جاری واحد',
    },
    kpiSubtitles: {
      activeMaintenance: 'کارهای نگهداری فعال',
      totalCommunityDues: 'کل مطالبات مجتمع',
      unreadNotices: 'اعلان‌های جدید',
      governanceOversight: 'نظارت بر تصمیمات و مصوبات',
      associationReceivables: 'مطالبات دریافتنی انجمن',
      inProgressJobs: 'کارهای در دست اقدام',
      boardDispatches: 'مکاتبات هیئت‌مدیره',
      ledgerAuditCorpus: 'مجموعه اسناد دفتر کل',
      reconciledBalance: 'مانده تطبیق‌یافته حساب‌ها',
      auditAlerts: 'هشدارهای ثبت بازرسی',
      titleRegisteredUnits: 'واحدهای ثبت‌شده با سند',
      maintenanceReserveDues: 'شارژ نگهداری و اندوخته',
      technicalTickets: 'درخواست‌های فنی ثبت‌شده',
      buildingNotices: 'اطلاعیه‌های ساختمان',
      assignedUtilitiesMaintenance: 'سهم شارژ و قبوض تخصیصی',
      activeMaintenanceIssues: 'موارد فعال تعمیراتی',
      residentialUpdates: 'اطلاعیه‌های سکونت',
    },
    sections: {
      operations: 'عملیات و دارایی‌ها',
      operationsDesc: 'مدیریت و نظارت بر ابنیه، واحدها و زیرساخت‌های مجتمع.',
      financials: 'وضعیت مالی و دریافتنی‌ها',
      financialsDesc: 'صورتحساب‌های صادرشده، دریافت‌ها و پیگیری معوقات.',
      governance: 'حاکمیت و تصمیمات هیئت‌مدیره',
      governanceDesc: 'جلسات، مصوبات رسمی، آرا و صورتجلسات قانونی.',
      financialSummary: 'خلاصه مالی نظارتی',
      financialSummaryDesc: 'نمای راهبردی دریافت‌ها، پرداخت‌ها و بودجه مصوب.',
      financialControls: 'کنترل‌های مالی و بازرسی (بازرس)',
      financialControlsDesc: 'بازرسی مستقل دفاتر کل، اسناد حسابداری و تطبیق‌های مالی بدون امکان تغییر.',
      myUnits: 'واحدهای من',
      myUnitsDesc: 'مشخصات واحدهای ثبت‌شده تحت مالکیت شما.',
      myFinancials: 'وضعیت مالی واحد من',
      myFinancialsDesc: 'شارژ ماهیانه، سهم از هزینه‌های مشترک و سوابق پرداخت.',
      myResidence: 'اطلاعات سکونت من',
      myResidenceDesc: 'مشخصات واحد مسکونی تخصیص‌یافته و قرارداد سکونت.',
      myExpenses: 'هزینه‌ها و قبوض واحد',
      myExpensesDesc: 'ریز هزینه‌های شارژ، خدمات و سهم مصرفی واحد.',
      myConsumption: 'کنتورها و مصارف اختصاصی',
      myConsumptionDesc: 'ثبت و پیگیری ارقام کنتورهای آب، برق و گاز اختصاصی.',
      audit: 'ردیابی و بازرسی امنیتی',
      auditDesc: 'لاگ دقیق رویدادها و تصمیمات مدیریتی با قابلیت اعتبارسنجی.',
    },
    actions: {
      viewDetails: 'مشاهده جزئیات',
      viewWorkOrders: 'مشاهده دستور کارها',
      viewInvoices: 'مشاهده صورتحساب‌ها',
      inspectLedger: 'بازرسی دفاتر کل',
      viewGovernance: 'مشاهده مصوبات',
      viewMeters: 'مشاهده کنتورها',
      viewAudit: 'مشاهده گزارش بازرسی',
    },
  },
} as const;

export function CustomerDashboard({ lang }: { lang: Language }) {
  const { active, dashboard, loading, error } = useCustomerContext();
  const t = copy[lang] ?? copy.ro;
  const isRtl = lang === 'fa';
  const NextArrow = isRtl ? ArrowLeft : ArrowRight;

  if (loading && !dashboard) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#0E9F8E]" />
          <span className="text-xs font-semibold text-[#52667A]">{t.loading}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800 shadow-sm"
      >
        <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
        <div>{t.error}</div>
      </div>
    );
  }

  if (!active || !dashboard) {
    return (
      <div className="rounded-2xl border border-[#CBD5E1] bg-white p-8 text-center text-sm font-semibold text-[#52667A] shadow-sm">
        {t.empty}
      </div>
    );
  }

  // 1. Version enforcement: payload must be version 1
  if (dashboard.version !== 1) {
    return <AccessRestrictedCard lang={lang} reason="unknown" />;
  }

  const roleCode = (dashboard.context?.role_code || '').toLowerCase();

  // 2. Canonical role enforcement
  if (!isCanonicalRole(roleCode)) {
    return <AccessRestrictedCard lang={lang} reason="unknown" />;
  }

  // 3. Persona / context role consistency enforcement
  if (!dashboard.persona || dashboard.persona.toLowerCase() !== roleCode) {
    return <AccessRestrictedCard lang={lang} reason="unknown" />;
  }

  // 4. Arrays integrity enforcement
  if (!Array.isArray(dashboard.sections) || !Array.isArray(dashboard.capabilities)) {
    return <AccessRestrictedCard lang={lang} reason="unknown" />;
  }

  const role = roleCode as CanonicalRole;
  const k = dashboard.kpis ?? {};
  const isReadOnly = isPersonaReadOnly(role);
  const permissions = dashboard.permissions ?? [];
  const modules = dashboard.modules ?? [];
  const capabilities = dashboard.capabilities ?? [];

  // Helper formatting for currency amounts
  const formatCurrency = (amount: number | string | undefined) => {
    const numeric = typeof amount === 'number' ? amount : Number(amount) || 0;
    return new Intl.NumberFormat(
      lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US',
      { maximumFractionDigits: 2, minimumFractionDigits: 2 }
    ).format(numeric);
  };

  // Helper formatting for integer quantities
  const formatInt = (amount: number | string | undefined) => {
    const numeric = typeof amount === 'number' ? amount : Number(amount) || 0;
    return new Intl.NumberFormat(
      lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US'
    ).format(numeric);
  };

  /**
   * Safe, server-authoritative section check.
   * Section must be allowed in local matrix AND returned by the server RPC response.
   */
  const canRenderDashboardSection = (
    section: string,
    requiredCapability?: string,
    requiredModule?: string,
    requiredPermission?: string
  ) => {
    if (!isSectionAllowed(role, section)) return false;
    const serverSections = dashboard.sections ?? [];
    if (!serverSections.includes(section)) return false;
    if (requiredCapability && !capabilities.includes(requiredCapability)) return false;
    if (requiredModule && !modules.includes(requiredModule)) return false;
    if (requiredPermission && !permissions.includes(requiredPermission)) return false;
    return true;
  };

  const getBadge = () => {
    if (isReadOnly) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
          <Eye className="h-3 w-3" />
          {t.readOnlyBadge}
        </span>
      );
    }
    if (role === 'president') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
          <Gavel className="h-3 w-3" />
          {t.governanceBadge}
        </span>
      );
    }
    if (role === 'owner') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[10px] font-bold text-teal-700 uppercase tracking-wider">
          <Home className="h-3 w-3" />
          {t.ownerBadge}
        </span>
      );
    }
    if (role === 'tenant_resident') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 uppercase tracking-wider">
          <UsersRound className="h-3 w-3" />
          {t.residentBadge}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
        <Building2 className="h-3 w-3" />
        {t.managementBadge}
      </span>
    );
  };

  const renderKpis = () => {
    const cards: React.ReactNode[] = [];
    const perms = dashboard.permissions ?? [];
    const ents = dashboard.entitlements ?? [];

    const hasMaintenance =
      (perms.includes('maintenance.assets.read') || role === 'association_admin') &&
      ents.includes('module.maintenance');
    const hasFinancial =
      (perms.includes('billing.receivables.read') ||
        perms.includes('finance.ledger.read') ||
        role === 'association_admin') &&
      (ents.includes('module.billing') || ents.includes('module.accounting'));
    const hasCommunications =
      perms.includes('communications.feed.read') && ents.includes('module.communications');

    switch (role) {
      case 'association_admin':
      case 'property_manager':
        if (k.buildings !== undefined) {
          cards.push(
            <div key="buildings" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.buildings}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#102A43]">
                {formatInt(k.buildings)}
              </div>
              <span className="text-[11px] text-[#52667A]">
                {t.buildingsUnits(formatInt(k.buildings), k.units !== undefined ? formatInt(k.units) : '-')}
              </span>
            </div>
          );
        }
        if (k.open_work_orders !== undefined && hasMaintenance) {
          cards.push(
            <div key="work" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.work}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#0E9F8E]">
                {formatInt(k.open_work_orders)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.activeMaintenance}</span>
            </div>
          );
        }
        if (k.outstanding_amount !== undefined && hasFinancial) {
          cards.push(
            <div key="receivables" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.receivables}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#102A43]">
                {formatCurrency(k.outstanding_amount)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.totalCommunityDues}</span>
            </div>
          );
        }
        if (k.unread_notifications !== undefined && hasCommunications) {
          cards.push(
            <div key="notifications" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.notifications}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#243B53]">
                {formatInt(k.unread_notifications)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.unreadNotices}</span>
            </div>
          );
        }
        break;

      case 'president':
        if (k.buildings !== undefined) {
          cards.push(
            <div key="buildings" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.buildings}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#102A43]">
                {formatInt(k.buildings)}
              </div>
              <span className="text-[11px] text-[#52667A]">
                {t.buildingsUnits(formatInt(k.buildings), k.units !== undefined ? formatInt(k.units) : '-')}
              </span>
            </div>
          );
        }
        if (k.outstanding_amount !== undefined && hasFinancial) {
          cards.push(
            <div key="receivables" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.receivables}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#102A43]">
                {formatCurrency(k.outstanding_amount)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.associationReceivables}</span>
            </div>
          );
        }
        if (k.open_work_orders !== undefined && hasMaintenance) {
          cards.push(
            <div key="work" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.work}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#0E9F8E]">
                {formatInt(k.open_work_orders)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.inProgressJobs}</span>
            </div>
          );
        }
        if (k.unread_notifications !== undefined && hasCommunications) {
          cards.push(
            <div key="notifications" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.notifications}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#243B53]">
                {formatInt(k.unread_notifications)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.boardDispatches}</span>
            </div>
          );
        }
        break;

      case 'censor':
        if (k.financial_records !== undefined && ents.includes('module.accounting')) {
          cards.push(
            <div key="financial_records" className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
              <span className="text-xs font-semibold text-amber-900">{t.kpis.financialRecords}</span>
              <div className="mt-2 text-2xl font-bold font-display text-amber-950">
                {formatInt(k.financial_records)}
              </div>
              <span className="text-[11px] text-amber-800">{t.kpiSubtitles.ledgerAuditCorpus}</span>
            </div>
          );
        }
        if (k.outstanding_amount !== undefined && ents.includes('module.accounting')) {
          cards.push(
            <div key="receivables" className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
              <span className="text-xs font-semibold text-amber-900">{t.kpis.receivables}</span>
              <div className="mt-2 text-2xl font-bold font-display text-amber-950">
                {formatCurrency(k.outstanding_amount)}
              </div>
              <span className="text-[11px] text-amber-800">{t.kpiSubtitles.reconciledBalance}</span>
            </div>
          );
        }
        if (k.unread_notifications !== undefined && hasCommunications) {
          cards.push(
            <div key="notifications" className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
              <span className="text-xs font-semibold text-amber-900">{t.kpis.notifications}</span>
              <div className="mt-2 text-2xl font-bold font-display text-amber-950">
                {formatInt(k.unread_notifications)}
              </div>
              <span className="text-[11px] text-amber-800">{t.kpiSubtitles.auditAlerts}</span>
            </div>
          );
        }
        break;

      case 'owner':
        if (k.my_units_count !== undefined) {
          cards.push(
            <div key="my_units" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.myUnits}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#102A43]">
                {formatInt(k.my_units_count)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.titleRegisteredUnits}</span>
            </div>
          );
        }
        if (k.outstanding_amount !== undefined && hasFinancial) {
          cards.push(
            <div key="receivables" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.outstandingCharges}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#102A43]">
                {formatCurrency(k.outstanding_amount)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.maintenanceReserveDues}</span>
            </div>
          );
        }
        if (k.my_open_requests !== undefined && hasMaintenance) {
          cards.push(
            <div key="my_requests" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.myOpenRequests}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#0E9F8E]">
                {formatInt(k.my_open_requests)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.technicalTickets}</span>
            </div>
          );
        }
        if (k.unread_notifications !== undefined && hasCommunications) {
          cards.push(
            <div key="notifications" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.notifications}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#243B53]">
                {formatInt(k.unread_notifications)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.buildingNotices}</span>
            </div>
          );
        }
        break;

      case 'tenant_resident':
        if (k.outstanding_amount !== undefined && hasFinancial) {
          cards.push(
            <div key="receivables" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.outstandingCharges}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#102A43]">
                {formatCurrency(k.outstanding_amount)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.assignedUtilitiesMaintenance}</span>
            </div>
          );
        }
        if (k.my_open_tickets !== undefined && hasMaintenance) {
          cards.push(
            <div key="my_tickets" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.myOpenTickets}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#9333EA]">
                {formatInt(k.my_open_tickets)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.activeMaintenanceIssues}</span>
            </div>
          );
        }
        if (k.unread_notifications !== undefined && hasCommunications) {
          cards.push(
            <div key="notifications" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#52667A]">{t.kpis.notifications}</span>
              <div className="mt-2 text-2xl font-bold font-display text-[#243B53]">
                {formatInt(k.unread_notifications)}
              </div>
              <span className="text-[11px] text-[#52667A]">{t.kpiSubtitles.residentialUpdates}</span>
            </div>
          );
        }
        break;
    }

    if (cards.length === 0) return null;

    const gridCols =
      role === 'censor' || role === 'tenant_resident'
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2 lg:grid-cols-4';

    return <div className={`grid gap-4 ${gridCols}`}>{cards}</div>;
  };

  return (
    <section className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Context & Role Header Banner */}
      <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-display text-[#102A43]">{t.title}</h1>
              {getBadge()}
            </div>
            <p className="mt-1 text-xs text-[#52667A]">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-1.5 text-xs font-bold text-[#0A6E62]">
            <ShieldCheck className="h-4 w-4" />
            <span>{t.verifiedBadge}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-[#52667A] border-t border-[#F1F5F9] pt-3">
          <span className="font-bold text-[#102A43]">{dashboard.context.tenant_name}</span>
          <span>•</span>
          <span>{dashboard.context.role_name}</span>
          <span>•</span>
          <span>
            {t.scopes[dashboard.context.scope_type as keyof typeof t.scopes] || dashboard.context.scope_type}
            {dashboard.context.unit_id ? ` · ${t.scopes.unit}` : ''}
          </span>
        </div>
      </div>

      {/* Scoped Dynamic KPIs */}
      {renderKpis()}

      {/* --------------------------------------------------------------------- */}
      {/* Persona-Specific Scoped Sections (Server Authoritative: Unallowed omitted) */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* SECTION: Operations & Assets (association_admin & property_manager) */}
        {canRenderDashboardSection('operations', 'can_view_operations', 'maintenance', 'maintenance.assets.read') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#EAF8F5] p-2.5 text-[#0E9F8E]">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.operations}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.operationsDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-bold text-[#52667A]">
                {t.buildingsUnits(formatInt(k.buildings), formatInt(k.units))}
              </span>
              <Link
                href={`/${lang}/app/assets`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0E9F8E] hover:underline"
              >
                <span>{t.actions.viewDetails}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: Financials & Receivables (association_admin, property_manager) */}
        {canRenderDashboardSection('financials', 'can_view_financials', 'billing', 'billing.receivables.read') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#EFF6FF] p-2.5 text-[#2563EB]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.financials}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.financialsDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-bold text-[#102A43]">
                {formatCurrency(k.outstanding_amount)}
              </span>
              <Link
                href={`/${lang}/app/billing`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] hover:underline"
              >
                <span>{t.actions.viewInvoices}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: Governance & Approvals (president) */}
        {canRenderDashboardSection('governance', 'can_view_governance', 'governance', 'governance.meetings.read') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#FEF3C7] p-2.5 text-[#D97706]">
                <Gavel className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.governance}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.governanceDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-bold text-[#D97706]">
                {t.sections.governance}
              </span>
              <Link
                href={`/${lang}/app/governance`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D97706] hover:underline"
              >
                <span>{t.actions.viewGovernance}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: Supervisory Financial Summary (president) */}
        {canRenderDashboardSection('financial_summary', 'can_view_financial_summary') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#EFF6FF] p-2.5 text-[#2563EB]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.financialSummary}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.financialSummaryDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-bold text-[#102A43]">
                {formatCurrency(k.outstanding_amount)}
              </span>
              <span className="text-xs text-[#52667A] italic">{t.supervisoryOversight}</span>
            </div>
          </div>
        )}

        {/* SECTION: Financial Controls & Censor Audit (censor) - Strictly Read-Only */}
        {canRenderDashboardSection('financial_controls', 'can_view_financial_controls', 'accounting', 'finance.ledger.read') && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-amber-100 p-2.5 text-amber-800">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold">{t.sections.financialControls}</h2>
                  <Lock className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <p className="text-xs text-[#52667A]">{t.sections.financialControlsDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-amber-200 pt-4">
              <span className="text-xs font-bold text-amber-900">
                {formatInt(k.financial_records)} {t.kpis.financialRecords}
              </span>
              <Link
                href={`/${lang}/app/accounting`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:underline"
              >
                <span>{t.actions.inspectLedger}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: My Units (owner) */}
        {canRenderDashboardSection('my_units', 'can_view_my_units') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#EAF8F5] p-2.5 text-[#0E9F8E]">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.myUnits}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.myUnitsDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-bold text-[#102A43]">
                {k.my_units_count !== undefined ? `${formatInt(k.my_units_count)} ${t.kpis.myUnits}` : t.sections.myUnits}
              </span>
              <Link
                href={`/${lang}/app/documents`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0E9F8E] hover:underline"
              >
                <span>{t.actions.viewDetails}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: My Financials (owner) */}
        {canRenderDashboardSection('my_financials', 'can_view_my_financials', 'billing', 'billing.receivables.read') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#EFF6FF] p-2.5 text-[#2563EB]">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.myFinancials}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.myFinancialsDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-bold text-[#102A43]">
                {formatCurrency(k.outstanding_amount)}
              </span>
              <Link
                href={`/${lang}/app/billing`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] hover:underline"
              >
                <span>{t.actions.viewInvoices}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: My Residence (tenant_resident) */}
        {canRenderDashboardSection('my_residence', 'can_view_my_residence') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#FAF5FF] p-2.5 text-[#9333EA]">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.myResidence}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.myResidenceDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-semibold text-[#52667A]">
                {dashboard.context.tenant_name}
              </span>
              <Link
                href={`/${lang}/app/documents`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9333EA] hover:underline"
              >
                <span>{t.actions.viewDetails}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: My Expenses (tenant_resident) */}
        {canRenderDashboardSection('my_expenses', 'can_view_my_expenses', 'billing', 'billing.receivables.read') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#EFF6FF] p-2.5 text-[#2563EB]">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.myExpenses}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.myExpensesDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-bold text-[#102A43]">
                {formatCurrency(k.outstanding_amount)}
              </span>
              <Link
                href={`/${lang}/app/billing`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] hover:underline"
              >
                <span>{t.actions.viewInvoices}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: Consumption & Meters (tenant_resident) */}
        {canRenderDashboardSection('my_consumption', 'can_view_my_consumption', 'utilities', 'utilities.metering.read') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#ECFDF5] p-2.5 text-[#059669]">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.myConsumption}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.myConsumptionDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-semibold text-[#52667A]">{t.activeMeters}</span>
              <Link
                href={`/${lang}/app/meters`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#059669] hover:underline"
              >
                <span>{t.actions.viewMeters}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: Audit Trail (Requires capability and audit section) */}
        {canRenderDashboardSection('audit', 'can_view_audit', undefined, 'audit.events.read') && (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 text-[#102A43]">
              <div className="rounded-xl bg-[#F1F5F9] p-2.5 text-[#334155]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">{t.sections.audit}</h2>
                <p className="text-xs text-[#52667A]">{t.sections.auditDesc}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
              <span className="text-xs font-semibold text-[#52667A]">{t.auditEncryption}</span>
              <Link
                href={`/${lang}/app/audit`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#334155] hover:underline"
              >
                <span>{t.actions.viewAudit}</span>
                <NextArrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
