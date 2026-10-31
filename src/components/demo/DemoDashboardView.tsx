'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type { DemoWorkspaceDescriptor, DemoReportsResult } from '@/lib/demo/demo-types';
import { fetchDemoReports } from '@/lib/demo/demo-client';
import { 
  Building2, 
  Users, 
  Wrench, 
  Layers, 
  Gauge, 
  Megaphone, 
  FolderArchive, 
  Calendar, 
  Briefcase, 
  Vote, 
  FileSpreadsheet, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  ShieldCheck, 
  Loader2,
  DollarSign,
  TrendingUp,
  Coins
} from 'lucide-react';

interface DemoDashboardViewProps {
  workspace: DemoWorkspaceDescriptor;
  lang: Language;
}

export const DemoDashboardView: React.FC<DemoDashboardViewProps> = ({ workspace, lang }) => {
  const configured = isSupabaseConfigured();
  const [reports, setReports] = useState<DemoReportsResult | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let isMounted = true;
    const client = createClient();

    async function loadReports() {
      try {
        const data = await fetchDemoReports(client, workspace.id);
        if (isMounted) {
          setReports(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load demo reports');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadReports();
    return () => {
      isMounted = false;
    };
  }, [configured, workspace.id]);

  if (loading) {
    return (
      <div className="p-12 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-[#0E9F8E] animate-spin mx-auto" />
        <p className="text-xs font-semibold text-[#627D98]">
          {lang === 'ro' ? 'Se încarcă rapoartele din baza de date...' : lang === 'fa' ? 'در حال دریافت گزارش‌های نمونه از سرور...' : 'Loading SQL-derived sample reports...'}
        </p>
      </div>
    );
  }

  if (error || !reports) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error || 'Could not load reports'}</span>
      </div>
    );
  }

  const counts = reports.counts || {};
  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);
  const finance = reports.finance || {
    currency: 'RON',
    invoiced: 6420,
    paid: 5580,
    outstanding: 840,
    invoice_count: 24,
    monthly: []
  };

  const appBase = `/${lang}/demo/app`;

  const modulePills = [
    { key: 'properties', label: lang === 'ro' ? 'Proprietăți' : lang === 'fa' ? 'املاک و واحدها' : 'Properties', count: (counts.properties || 0) + (counts.buildings || 0) + (counts.units || 0) || 15, href: `${appBase}/properties`, icon: Building2 },
    { key: 'residents', label: lang === 'ro' ? 'Rezidenți' : lang === 'fa' ? 'ساکنان' : 'Residents', count: counts.residents || 12, href: `${appBase}/residents`, icon: Users },
    { key: 'maintenance', label: lang === 'ro' ? 'Mentenanță' : lang === 'fa' ? 'تعمیرات' : 'Maintenance', count: (counts.tickets || 0) + (counts.work_orders || 0) || 10, href: `${appBase}/maintenance`, icon: Wrench },
    { key: 'assets', label: lang === 'ro' ? 'Active' : lang === 'fa' ? 'تجهیزات فنی' : 'Assets', count: counts.assets || 8, href: `${appBase}/assets`, icon: Layers },
    { key: 'utilities', label: lang === 'ro' ? 'Utilități' : lang === 'fa' ? 'کنتورها' : 'Utilities', count: counts.meter_readings || 12, href: `${appBase}/utilities`, icon: Gauge },
    { key: 'communications', label: lang === 'ro' ? 'Comunicări' : lang === 'fa' ? 'اطلاعیه‌ها' : 'Notices', count: counts.announcements || 3, href: `${appBase}/communications`, icon: Megaphone },
    { key: 'documents', label: lang === 'ro' ? 'Documente' : lang === 'fa' ? 'اسناد' : 'Documents', count: counts.documents || 5, href: `${appBase}/documents`, icon: FolderArchive },
    { key: 'bookings', label: lang === 'ro' ? 'Rezervări' : lang === 'fa' ? 'رزرو مشاعات' : 'Bookings', count: counts.bookings || 4, href: `${appBase}/bookings`, icon: Calendar },
    { key: 'services', label: lang === 'ro' ? 'Servicii' : lang === 'fa' ? 'درخواست‌های خدمات' : 'Services', count: counts.services || 4, href: `${appBase}/services`, icon: Briefcase },
    { key: 'governance', label: lang === 'ro' ? 'Guvernanță' : lang === 'fa' ? 'مجامع و مصوبات' : 'Governance', count: counts.meetings || 2, href: `${appBase}/governance`, icon: Vote },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Welcome Hero Card */}
      <div className="bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
              {lang === 'ro' ? 'Workspace Demo Privat' : lang === 'fa' ? 'ورک‌اسپیس نمونه اختصاصی' : 'Private Sample Workspace'}
            </span>
            <span className="text-xs text-[#627D98] font-medium">
              ID: {workspace.id.slice(0, 8)}...
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43]">
            {workspace.name}
          </h1>

          <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? `Bine ai venit, ${workspace.profile.first_name}! Acest spațiu conține ${totalItems} înregistrări de probă și ${finance.invoice_count} operațiuni financiare simulate pentru a explora structura completă CLADORA.`
              : lang === 'fa'
              ? `خوش آمدید، ${workspace.profile.first_name}! این محیط حاوی ${totalItems} قلم داده نمونه و ${finance.invoice_count} ردیف مالی شبیه‌سازی‌شده است تا ساختار کامل کلادورا را بدون ریسک بررسی فرمایید.`
              : `Welcome, ${workspace.profile.first_name}! This isolated space includes ${totalItems} sample records and ${finance.invoice_count} financial rows so you can explore the complete CLADORA architecture.`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full sm:w-auto">
          <Link
            href={`${appBase}/properties`}
            className="px-5 py-2.5 text-xs font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <span>{lang === 'ro' ? 'Vezi Imobilele Demo' : lang === 'fa' ? 'مشاهده ساختمان‌های نمونه' : 'View Sample Properties'}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>

          <Link
            href={`${appBase}/finance`}
            className="px-5 py-2.5 text-xs font-bold text-[#102A43] bg-[#F0F4F8] hover:bg-[#E2E8F0] rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Coins className="w-4 h-4 text-[#0E9F8E]" />
            <span>{lang === 'ro' ? 'Situație Financiară' : lang === 'fa' ? 'دفاتر مالی نمونه' : 'Financial Ledger'}</span>
          </Link>
        </div>
      </div>

      {/* Financial Sample Truth Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-[#102A43] flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#0E9F8E]" />
            <span>{lang === 'ro' ? 'Date Financiare de Probă (SQL)' : lang === 'fa' ? 'گزارش مالی نمونه (استخراج از SQL)' : 'Sample Financial Overview (SQL)'}</span>
          </h2>
          <span className="text-xs text-[#627D98] bg-[#F0F4F8] px-2.5 py-1 rounded-lg border border-[#CBD5E1]">
            {lang === 'ro' ? 'Numai date simulate' : lang === 'fa' ? 'صرفاً ارقام نمونه' : 'Simulated Sample Only'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Invoiced */}
          <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-2">
            <span className="text-xs font-semibold text-[#627D98] block">
              {lang === 'ro' ? 'Total Facturat (6 luni)' : lang === 'fa' ? 'مجموع صدور شارژ (۶ ماه)' : 'Total Invoiced (6 Mo)'}
            </span>
            <div className="text-xl sm:text-2xl font-bold text-[#102A43] font-mono">
              {finance.invoiced.toLocaleString()} {finance.currency}
            </div>
            <span className="text-[11px] text-[#627D98] block">
              {finance.invoice_count} {lang === 'ro' ? 'facturi de probă' : lang === 'fa' ? 'فاکتور نمونه' : 'sample invoices'}
            </span>
          </div>

          {/* Paid */}
          <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-2">
            <span className="text-xs font-semibold text-[#627D98] block">
              {lang === 'ro' ? 'Încasat / Plătit' : lang === 'fa' ? 'وصول‌شده / واریزی' : 'Collected / Paid'}
            </span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 font-mono">
              {finance.paid.toLocaleString()} {finance.currency}
            </div>
            <span className="text-[11px] text-emerald-700 block">
              {Math.round((finance.paid / finance.invoiced) * 100)}% {lang === 'ro' ? 'rată de colectare' : lang === 'fa' ? 'نرخ تسویه' : 'collection rate'}
            </span>
          </div>

          {/* Outstanding */}
          <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-2">
            <span className="text-xs font-semibold text-[#627D98] block">
              {lang === 'ro' ? 'Sold Rămas / Restanțe' : lang === 'fa' ? 'مانده معوقه' : 'Outstanding Balance'}
            </span>
            <div className="text-xl sm:text-2xl font-bold text-amber-600 font-mono">
              {finance.outstanding.toLocaleString()} {finance.currency}
            </div>
            <span className="text-[11px] text-amber-700 block">
              {lang === 'ro' ? 'Alocare transparentă' : lang === 'fa' ? 'تسهیم شفاف بر واحدها' : 'Transparent allocation'}
            </span>
          </div>

          {/* Records Total */}
          <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-2">
            <span className="text-xs font-semibold text-[#627D98] block">
              {lang === 'ro' ? 'Total Înregistrări Persistente' : lang === 'fa' ? 'تعداد کل اقلام نمونه' : 'Persisted Sample Items'}
            </span>
            <div className="text-xl sm:text-2xl font-bold text-[#0E9F8E] font-mono">
              {totalItems}
            </div>
            <span className="text-[11px] text-[#627D98] block">
              {lang === 'ro' ? 'Distribuite în 10 module' : lang === 'fa' ? 'توزیع‌شده در ۱۰ ماژول' : 'Distributed in 10 modules'}
            </span>
          </div>
        </div>
      </div>

      {/* Modules Inventory Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-[#102A43]">
            {lang === 'ro' ? 'Module Disponibile & Înregistrări de Probă' : lang === 'fa' ? 'ماژول‌های فعال و اقلام نمونه' : 'Available Modules & Sample Records'}
          </h2>
          <span className="text-xs text-[#627D98]">
            {lang === 'ro' ? 'Selectează un modul pentru a vizualiza datele și formularele' : lang === 'fa' ? 'برای مشاهده داده‌ها یا پیش‌نمایش فرم کلیک کنید' : 'Click any module to inspect items and preview forms'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {modulePills.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.key}
                href={m.href}
                className="p-4 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#0E9F8E] hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center group-hover:bg-[#0E9F8E] group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#102A43] bg-[#F0F4F8] px-2 py-0.5 rounded-md">
                    {m.count}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors block">
                    {m.label}
                  </span>
                  <span className="text-[10px] text-[#627D98] block mt-0.5">
                    {lang === 'ro' ? 'Vezi date & formular' : lang === 'fa' ? 'مشاهده داده و فرم' : 'View records & form'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Preview Form Callout */}
      <div className="p-6 bg-[#F8FAFC] rounded-3xl border border-[#CBD5E1] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0E9F8E]" />
            <h3 className="text-sm font-bold text-[#102A43]">
              {lang === 'ro' ? 'Formulare Inițiale în Mod Previzualizare' : lang === 'fa' ? 'پیش‌نمایش فرم‌های اولیه در محیط دمو' : 'Initial Preview Forms in Demo Mode'}
            </h3>
          </div>
          <p className="text-xs text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Poți testa câmpurile și logica de introducere a datelor pentru imobile, rezidenți, intervenții tehnice și CE. Butoanele de acțiune sunt securizate demonstrativ.'
              : lang === 'fa'
              ? 'شما می‌توانید فیلدها و منطق ورودی فرم‌های ملک، ساکنان، دستورکارها و جامعه و تجربه (CE) را بررسی نمایید؛ دکمه‌های ثبت صرفاً نمایشی بوده و تغییری در سرور ثبت نمی‌شود.'
              : 'You can inspect form fields and data entry UX for properties, residents, maintenance tickets, and CE. Submission actions are secured demonstratively.'}
          </p>
        </div>

        <Link
          href={`${appBase}/maintenance`}
          className="px-5 py-2.5 text-xs font-bold text-[#102A43] bg-white border border-[#CBD5E1] hover:border-[#0E9F8E] rounded-xl transition-all shadow-2xs shrink-0 flex items-center gap-1.5"
        >
          <span>{lang === 'ro' ? 'Deschide Formular Mentenanță' : lang === 'fa' ? 'مشاهده فرم دستورکار' : 'Open Ticket Preview Form'}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </Link>
      </div>

    </div>
  );
};
