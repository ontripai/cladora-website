'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Bell,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Gavel,
  Home,
  Layers3,
  Loader2,
  Lock,
  Megaphone,
  Receipt,
  Scale,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
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
    kpis: {
      properties: 'Proprietăți în context',
      buildings: 'Clădiri în context',
      units: 'Unități în context',
      work: 'Lucrări deschise',
      notifications: 'Notificări necitite',
      receivables: 'Sold restant',
      pendingApprovals: 'Aprobări în așteptare',
      financialRecords: 'Înregistrări financiare',
      myUnits: 'Unitățile mele',
      myOpenRequests: 'Cereri active de service',
      myOpenTickets: 'Tichete deschise',
      outstandingCharges: 'Cote & cheltuieli restante',
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
      contracts: 'Contracte Furnizori & SLA',
      contractsDesc: 'Evidența acordurilor comerciale, prestărilor de servicii și conformității.',
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
      myDocuments: 'Documente & Acte',
      myDocumentsDesc: 'Contracte, adeverințe și documente oficiale emise pentru dumneavoastră.',
      serviceRequests: 'Cereri de Mentenanță & Suport',
      serviceRequestsDesc: 'Transmiteți și urmăriți intervențiile tehnice pentru spațiul dumneavoastră.',
      audit: 'Jurnal de Audit Securizat',
      auditDesc: 'Urmărirea evenimentelor administrative cu trasabilitate criptografică.',
      modules: 'Module Active în Spațiu',
      modulesDesc: 'Capabilitățile licențiate și activate pentru acest complex rezidențial.',
    },
    actions: {
      viewDetails: 'Vizualizează detalii',
      manageWork: 'Gestionează intervenții',
      viewInvoices: 'Vezi facturi & creanțe',
      inspectLedger: 'Inspectează registru contabil',
      viewGovernance: 'Vezi hotărâri asociație',
      submitRequest: 'Trimite cerere service',
      viewMeters: 'Vezi contoare & consum',
      viewAudit: 'Consultă jurnal audit',
      payNow: 'Plătește securizat',
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
    kpis: {
      properties: 'Properties in context',
      buildings: 'Buildings in context',
      units: 'Units in context',
      work: 'Open work orders',
      notifications: 'Unread notifications',
      receivables: 'Outstanding balance',
      pendingApprovals: 'Pending approvals',
      financialRecords: 'Financial records',
      myUnits: 'My units',
      myOpenRequests: 'My service requests',
      myOpenTickets: 'Open repair tickets',
      outstandingCharges: 'Outstanding charges',
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
      contracts: 'Vendor Contracts & SLAs',
      contractsDesc: 'Register of commercial agreements, supplier performance, and compliance.',
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
      myDocuments: 'Documents & Records',
      myDocumentsDesc: 'Contracts, certificates, and official documents issued for your context.',
      serviceRequests: 'Maintenance & Service Requests',
      serviceRequestsDesc: 'Submit and track technical requests for your private premises.',
      audit: 'Cryptographic Audit Trail',
      auditDesc: 'Chronological tracking of administrative actions and compliance logs.',
      modules: 'Active Workspace Modules',
      modulesDesc: 'Entitled capabilities enabled for this residential community.',
    },
    actions: {
      viewDetails: 'View details',
      manageWork: 'Manage work orders',
      viewInvoices: 'View invoices & receivables',
      inspectLedger: 'Inspect ledger',
      viewGovernance: 'View governance records',
      submitRequest: 'Submit service request',
      viewMeters: 'View meters & readings',
      viewAudit: 'View audit trail',
      payNow: 'Pay securely',
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
    kpis: {
      properties: 'املاک در این زمینه',
      buildings: 'ساختمان‌های فعال',
      units: 'واحدهای تحت پوشش',
      work: 'کارهای باز نگهداری',
      notifications: 'اعلان‌های خوانده‌نشده',
      receivables: 'مانده کل مطالبات',
      pendingApprovals: 'موارد نیازمند بررسی / مصوبه',
      financialRecords: 'اسناد مالی ثبت‌شده',
      myUnits: 'واحدهای تحت مالکیت من',
      myOpenRequests: 'درخواست‌های باز من',
      myOpenTickets: 'تیکت‌های باز تعمیرات',
      outstandingCharges: 'مانده بدهی جاری واحد',
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
      contracts: 'قراردادها و پیمانکاران',
      contractsDesc: 'فهرست قراردادهای خدماتی، توافق‌نامه‌ها و شاخص‌های کیفی.',
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
      myDocuments: 'اسناد و مدارک',
      myDocumentsDesc: 'اسناد مالکیت، صورتجلسات و مدارک رسمی مرتبط.',
      serviceRequests: 'درخواست‌های خدمات و نگهداری',
      serviceRequestsDesc: 'ثبت درخواست‌های فنی و پیگیری روند رفع ایرادات واحد.',
      audit: 'ردیابی و بازرسی امنیتی',
      auditDesc: 'لاگ دقیق رویدادها و تصمیمات مدیریتی با قابلیت اعتبارسنجی.',
      modules: 'ماژول‌های فعال مجتمع',
      modulesDesc: 'سرویس‌ها و ماژول‌های فعال‌شده در فضای کاری این مجتمع.',
    },
    actions: {
      viewDetails: 'مشاهده جزئیات',
      manageWork: 'مدیریت سفارش‌ها',
      viewInvoices: 'مشاهده صورتحساب‌ها',
      inspectLedger: 'بازرسی دفاتر کل',
      viewGovernance: 'مشاهده مصوبات',
      submitRequest: 'ثبت درخواست جدید',
      viewMeters: 'مشاهده کنتورها',
      viewAudit: 'مشاهده گزارش بازرسی',
      payNow: 'پرداخت امن',
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

  const roleCode = (dashboard.context.role_code || '').toLowerCase();

  // Fail-closed if role is non-canonical or unauthenticated
  if (!isCanonicalRole(roleCode)) {
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

  // Helper formatting for integer counters
  const formatInt = (val: number | string | undefined) => {
    const numeric = typeof val === 'number' ? val : Number(val) || 0;
    return new Intl.NumberFormat(
      lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US'
    ).format(numeric);
  };

  // ---------------------------------------------------------------------------
  // KPI Definitions based on Authoritative Persona
  // ---------------------------------------------------------------------------
  const renderKpis = () => {
    if (role === 'association_admin' || role === 'property_manager') {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.properties}</span>
              <Home className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.properties)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.buildings}</span>
              <Building2 className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.buildings)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.units}</span>
              <Layers3 className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.units)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.work}</span>
              <Wrench className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.open_work_orders)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.notifications}</span>
              <Bell className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.unread_notifications)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.receivables}</span>
              <Wallet className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatCurrency(k.outstanding_amount)}</div>
          </div>
        </div>
      );
    }

    if (role === 'president') {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.buildings}</span>
              <Building2 className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.buildings)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.units}</span>
              <Layers3 className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.units)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.work}</span>
              <Wrench className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.open_work_orders)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.pendingApprovals}</span>
              <Gavel className="h-5 w-5 text-[#D97706]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#D97706]">{formatInt(k.pending_approvals)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.notifications}</span>
              <Bell className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.unread_notifications)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.receivables}</span>
              <Wallet className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatCurrency(k.outstanding_amount)}</div>
          </div>
        </div>
      );
    }

    if (role === 'censor') {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.receivables}</span>
              <Scale className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatCurrency(k.outstanding_amount)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.work}</span>
              <Wrench className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.open_work_orders)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.financialRecords}</span>
              <FileSpreadsheet className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.financial_records)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.notifications}</span>
              <Bell className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.unread_notifications)}</div>
          </div>
        </div>
      );
    }

    if (role === 'owner') {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.myUnits}</span>
              <Home className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.my_units_count ?? 1)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.receivables}</span>
              <CreditCard className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatCurrency(k.outstanding_amount)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.myOpenRequests}</span>
              <Wrench className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.my_open_requests)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.notifications}</span>
              <Bell className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.unread_notifications)}</div>
          </div>
        </div>
      );
    }

    if (role === 'tenant_resident') {
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.outstandingCharges}</span>
              <CreditCard className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatCurrency(k.outstanding_amount)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.myOpenTickets}</span>
              <Wrench className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.my_open_tickets)}</div>
          </div>

          <div className="card-proptech rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#52667A]">{t.kpis.notifications}</span>
              <Bell className="h-5 w-5 text-[#0E9F8E]" />
            </div>
            <div className="mt-3 text-2xl font-extrabold text-[#102A43]">{formatInt(k.unread_notifications)}</div>
          </div>
        </div>
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Persona Badges & Headers
  // ---------------------------------------------------------------------------
  const getBadge = () => {
    if (role === 'censor') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800">
          <Eye className="h-3.5 w-3.5 text-amber-600" />
          {t.readOnlyBadge}
        </span>
      );
    }
    if (role === 'president') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-800">
          <Gavel className="h-3.5 w-3.5 text-blue-600" />
          {t.governanceBadge}
        </span>
      );
    }
    if (role === 'owner') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-800">
          <Home className="h-3.5 w-3.5 text-teal-600" />
          {t.ownerBadge}
        </span>
      );
    }
    if (role === 'tenant_resident') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-bold text-purple-800">
          <UserCheck className="h-3.5 w-3.5 text-purple-600" />
          {t.residentBadge}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        {t.managementBadge}
      </span>
    );
  };

  return (
    <section aria-label={t.title} className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            {dashboard.context.scope_type}
            {dashboard.context.unit_id ? ` · unit` : ''}
          </span>
        </div>
      </div>

      {/* Scoped Dynamic KPIs */}
      {renderKpis()}

      {/* --------------------------------------------------------------------- */}
      {/* Persona-Specific Scoped Sections (Hard Security: Unallowed not emitted) */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* SECTION: Operations & Assets (association_admin & property_manager) */}
        {isSectionAllowed(role, 'operations') && (
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
                {formatInt(k.buildings)} clădiri · {formatInt(k.units)} unități
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
        {isSectionAllowed(role, 'financials') && (
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
        {isSectionAllowed(role, 'governance') && (
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
                {formatInt(k.pending_approvals)} {t.kpis.pendingApprovals}
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
        {isSectionAllowed(role, 'financial_summary') && (
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
              <span className="text-xs text-[#52667A] italic">ReadOnly Oversight</span>
            </div>
          </div>
        )}

        {/* SECTION: Financial Controls & Censor Audit (censor) */}
        {isSectionAllowed(role, 'financial_controls') && (
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
        {isSectionAllowed(role, 'my_units') && (
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
                {formatInt(k.my_units_count ?? 1)} {t.kpis.myUnits}
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
        {isSectionAllowed(role, 'my_financials') && (
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#102A43] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#243B53]"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>{t.actions.payNow}</span>
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: My Residence (tenant_resident) */}
        {isSectionAllowed(role, 'my_residence') && (
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
        {isSectionAllowed(role, 'my_expenses') && (
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#102A43] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#243B53]"
              >
                <span>{t.actions.payNow}</span>
              </Link>
            </div>
          </div>
        )}

        {/* SECTION: Consumption & Meters (tenant_resident & managers) */}
        {isSectionAllowed(role, 'my_consumption') && (
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
              <span className="text-xs font-semibold text-[#52667A]">Active meters</span>
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

        {/* SECTION: Audit Trail (Only rendered if capability is held!) */}
        {isSectionAllowed(role, 'audit') && capabilities.includes('can_view_audit') && (
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
              <span className="text-xs font-semibold text-[#52667A]">AAL2 Encrypted</span>
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
