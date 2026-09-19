'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Language, UserRole } from '@/types';
import { 
  Building2, 
  Home, 
  TrendingUp, 
  Layers, 
  FileSpreadsheet, 
  Gauge, 
  Wrench, 
  Vote, 
  Megaphone, 
  FolderArchive, 
  Database, 
  ShieldCheck, 
  Settings, 
  ChevronDown, 
  Menu, 
  X, 
  RotateCcw,
  LogOut,
  Sparkles,
  CheckCircle2,
  Receipt,
  User,
  Sliders,
  FileCheck2
} from 'lucide-react';
import { useDemoStore } from '@/data/demoStore';
import { DEMO_ROLES } from '@/data/mockData';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { formatUnitLabel, formatAccountingPeriod } from '@/config/formatters';
import { CladoraBrand } from '@/components/brand/CladoraBrand';

export function AppShell({
  children,
  params,
  demoMode = false,
}: {
  children: React.ReactNode;
  params: { lang: Language };
  demoMode?: boolean;
}) {
  const { lang } = params;
  const pathname = usePathname();
  const router = useRouter();

  const { 
    activeRole, 
    setActiveRole, 
    context, 
    resetDemoData 
  } = useDemoStore();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const appBase = `/${lang}/${demoMode ? 'demo/app' : 'app'}`;

  const navItems = [
    { label: lang === 'ro' ? 'Tablou Principal' : lang === 'fa' ? 'داشبورد اصلی' : 'Dashboard', href: `${appBase}/dashboard`, icon: Home },
    { label: lang === 'ro' ? 'Contabilitate & Registre' : lang === 'fa' ? 'حسابداری و دفاتر مالی' : 'Accounting & Registers', href: `${appBase}/accounting`, icon: FileSpreadsheet },
    { label: lang === 'ro' ? 'Închidere Lunară' : lang === 'fa' ? 'بستن دوره ماهانه' : 'Month-End Close', href: `${appBase}/accounting/month-close`, icon: CheckCircle2 },
    { label: lang === 'ro' ? 'Cote & Alocare (CPI)' : lang === 'fa' ? 'تخصیص سهم مشاع (CPI)' : 'Allocations & Rights', href: `${appBase}/accounting/allocations`, icon: Receipt },
    { label: lang === 'ro' ? 'Contoare & Consum' : lang === 'fa' ? 'کنتورها و مصارف' : 'Utilities & Meters', href: `${appBase}/meters`, icon: Gauge },
    { label: lang === 'ro' ? 'Mentenanță & Tichete' : lang === 'fa' ? 'تعمیرات و تیکت‌ها' : 'Maintenance & Tickets', href: `${appBase}/maintenance`, icon: Wrench },
    { label: lang === 'ro' ? 'Adunare Generală & Vot' : lang === 'fa' ? 'مجمع عمومی و رأی‌گیری' : 'Governance & Voting', href: `${appBase}/governance`, icon: Vote },
    { label: lang === 'ro' ? 'Avizier & Comunicare' : lang === 'fa' ? 'تابلو اعلانات و پیام‌ها' : 'Noticeboard & Comms', href: `${appBase}/communications`, icon: Megaphone },
    { label: lang === 'ro' ? 'Documente & Registru' : lang === 'fa' ? 'اسناد و مدارک' : 'Documents & Registry', href: `${appBase}/documents`, icon: FolderArchive },
    { label: lang === 'ro' ? 'Portofoliu Proprietar' : lang === 'fa' ? 'سبد املاک سرمایه‌گذار' : 'Portfolio OS', href: `${appBase}/portfolio`, icon: TrendingUp },
    { label: lang === 'ro' ? 'Migrare Shadow Ledger' : lang === 'fa' ? 'مهاجرت Shadow Ledger' : 'Shadow Ledger Migration', href: `${appBase}/migration/shadow-ledger`, icon: Database },
    { label: lang === 'ro' ? 'Jurnal de Audit' : lang === 'fa' ? 'ردپای حسابرسی' : 'Audit Trail', href: `${appBase}/audit`, icon: FileCheck2 },
    { label: lang === 'ro' ? 'Setări & Permisiuni' : lang === 'fa' ? 'تنظیمات و دسترسی‌ها' : 'Settings & Roles', href: `${appBase}/settings`, icon: Settings },
  ];

  const currentRoleDef = DEMO_ROLES.find(r => r.key === activeRole) || DEMO_ROLES[0];

  return (
    <div className="min-h-screen bg-[#F6F9FC] flex flex-col font-sans">
      
      {/* Top Application Context Bar */}
      <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        
        {/* Left / Start: Brand + Context Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href={`/${lang}`} aria-label="CLADORA" className="flex items-center">
            <CladoraBrand variant="symbol" className="h-8 w-8 sm:hidden" />
            <CladoraBrand variant="primary" className="hidden h-8 w-auto sm:block" />
          </Link>

          <div className="h-5 w-[1px] bg-[#E2E8F0] hidden sm:block" />

          {/* Context Display (Org / Building / Unit) */}
          <div className="flex items-center gap-2 bg-[#F6F9FC] px-3 py-1.5 rounded-xl border border-[#E2E8F0] text-xs">
            <Building2 className="w-4 h-4 text-[#0E9F8E] shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold text-[#102A43] truncate max-w-[130px] sm:max-w-[220px]">
                {lang === 'fa' ? 'مجتمع مسکونی آویاتسی ۱۲B' : context.associationName}
              </span>
              <span className="text-[10px] text-[#7B8A9A] -mt-0.5">
                {lang === 'fa' 
                  ? `${formatUnitLabel(context.unitNumber || 'Ap. 14', lang)} · دوره: ${formatAccountingPeriod(context.accountingPeriod, lang)}` 
                  : `${context.unitNumber} · ${lang === 'ro' ? 'Perioadă:' : 'Period:'} `}
                {lang !== 'fa' && <strong className="text-[#0E9F8E] font-mono">{context.accountingPeriod}</strong>}
              </span>
            </div>
          </div>
        </div>

        {/* Right / End: Role Switcher + Language Switcher + Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Active Role Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EAF8F5] border border-[#B2E5DF] text-xs font-bold text-[#0A6E62] hover:bg-[#D5F2ED] transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{currentRoleDef.title[lang]}</span>
              <span className="sm:hidden">{currentRoleDef.badge[lang]}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {roleDropdownOpen && (
              <div className="absolute end-0 mt-2 w-64 bg-white rounded-2xl border border-[#E2E8F0] shadow-elevated p-2 z-50 animate-in fade-in duration-150">
                <div className="text-[10px] font-bold text-[#7B8A9A] uppercase tracking-wider px-3 py-1 border-b border-[#F0F4F8]">
                  {lang === 'ro' ? 'Comută Rolul Activ în Demo' : lang === 'fa' ? 'انتخاب نقش در محیط دموی تعاملی' : 'Switch Demo Role Persona'}
                </div>
                <div className="space-y-1 mt-1">
                  {DEMO_ROLES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => {
                        setActiveRole(r.key);
                        setRoleDropdownOpen(false);
                      }}
                      className={`w-full text-start p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        activeRole === r.key
                          ? 'bg-[#102A43] text-white font-bold'
                          : 'hover:bg-[#F6F9FC] text-[#52667A] font-medium'
                      }`}
                    >
                      <span>{r.title[lang]}</span>
                      {activeRole === r.key && <CheckCircle2 className="w-3.5 h-3.5 text-[#0E9F8E]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reset Demo Data Button */}
          <button
            type="button"
            onClick={resetDemoData}
            title={lang === 'ro' ? 'Resetează datele demo' : lang === 'fa' ? 'بازنشانی داده‌های دمو' : 'Reset demo sandbox'}
            className="p-2 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] text-[#52667A] hover:text-[#102A43] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Accessible Flag Language Switcher */}
          <LanguageSwitcher currentLang={lang} variant="header" />

          {/* Exit to Public Site */}
          <Link
            href={`/${lang}`}
            title={lang === 'ro' ? 'Ieșire pe site-ul public' : lang === 'fa' ? 'بازگشت به سایت اصلی' : 'Exit to marketing website'}
            className="p-2 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] text-[#7B8A9A] hover:text-[#E5484D] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </Link>

        </div>

      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-white border-e border-[#E2E8F0] transition-all duration-200 ${
            sidebarOpen ? 'w-64' : 'w-20'
          }`}
        >
          <div className="p-4 border-b border-[#F0F4F8] flex items-center justify-between">
            <span className={`text-xs font-bold text-[#7B8A9A] uppercase tracking-wider ${!sidebarOpen && 'hidden'}`}>
              {lang === 'ro' ? 'Module Operaționale' : lang === 'fa' ? 'ماژول‌های فعال' : 'Core Modules'}
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 rounded-lg text-[#7B8A9A] hover:bg-[#F6F9FC]"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== `${appBase}/dashboard` && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#102A43] text-white shadow-sm'
                      : 'text-[#52667A] hover:bg-[#F6F9FC] hover:text-[#102A43]'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#75CFC3]' : 'text-[#7B8A9A]'}`} />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-[#F0F4F8]">
            <div className="p-3 rounded-xl bg-[#EAF8F5] border border-[#B2E5DF] text-[11px] text-[#0A6E62]">
              {sidebarOpen ? (
                <>
                  <div className="font-bold">
                    {lang === 'ro' ? '✓ Mediu Demo Sandbox' : lang === 'fa' ? '✓ محیط نمایشی سندباکس' : '✓ Demo Sandbox Mode'}
                  </div>
                  <div className="text-[10px] text-[#52667A] mt-0.5">
                    {lang === 'ro' ? 'Modificările sunt salvate local' : lang === 'fa' ? 'تغییرات در حافظه مرورگر ذخیره می‌شوند' : 'Changes saved locally'}
                  </div>
                </>
              ) : (
                <div className="text-center font-bold">DEMO</div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

      </div>

      {/* Mobile Bottom Navigation Bar (5 Primary Actions) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#E2E8F0] h-16 px-4 flex items-center justify-around z-40 shadow-lg">
        <Link
          href={`${appBase}/dashboard`}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            pathname === `${appBase}/dashboard` ? 'text-[#0E9F8E]' : 'text-[#7B8A9A]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>{lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'داشبورد' : 'Home'}</span>
        </Link>

        <Link
          href={`${appBase}/accounting/allocations`}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            pathname?.includes('allocations') ? 'text-[#0E9F8E]' : 'text-[#7B8A9A]'
          }`}
        >
          <Receipt className="w-5 h-5" />
          <span>{lang === 'ro' ? 'Plată' : lang === 'fa' ? 'شارژ' : 'Due'}</span>
        </Link>

        <Link
          href={`${appBase}/meters`}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            pathname?.includes('meters') ? 'text-[#0E9F8E]' : 'text-[#7B8A9A]'
          }`}
        >
          <Gauge className="w-5 h-5" />
          <span>{lang === 'ro' ? 'Contoare' : lang === 'fa' ? 'کنتورها' : 'Meters'}</span>
        </Link>

        <Link
          href={`${appBase}/maintenance`}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
            pathname?.includes('maintenance') ? 'text-[#0E9F8E]' : 'text-[#7B8A9A]'
          }`}
        >
          <Wrench className="w-5 h-5" />
          <span>{lang === 'ro' ? 'Tichete' : lang === 'fa' ? 'تیکت‌ها' : 'Tickets'}</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-bold text-[#7B8A9A]"
        >
          <Menu className="w-5 h-5" />
          <span>{lang === 'ro' ? 'Module' : lang === 'fa' ? 'ماژول‌ها' : 'More'}</span>
        </button>
      </div>

      {/* Mobile Drawer for Full Navigation */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-80 bg-white h-full p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                <span className="font-bold text-sm text-[#102A43]">
                  {lang === 'ro' ? 'Toate Modulele' : lang === 'fa' ? 'تمامی ماژول‌های سامانه' : 'All Application Cores'}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-[#7B8A9A] hover:bg-[#F6F9FC]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-[#102A43] hover:bg-[#F6F9FC]"
                    >
                      <Icon className="w-4 h-4 text-[#0E9F8E]" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
              <LanguageSwitcher currentLang={lang} variant="mobile-drawer" />
              
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setMobileDrawerOpen(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#EAF8F5] text-[#0A6E62] text-xs font-bold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{lang === 'ro' ? 'Resetează datele demo' : lang === 'fa' ? 'بازنشانی داده‌های دمو' : 'Reset demo data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
