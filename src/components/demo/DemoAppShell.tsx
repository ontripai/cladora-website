'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Language } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type { DemoWorkspaceDescriptor, DemoNavigationItem } from '@/lib/demo/demo-types';
import {
  Building2,
  Home,
  Layers,
  FileSpreadsheet,
  Gauge,
  Wrench,
  Vote,
  Megaphone,
  FolderArchive,
  Settings,
  LogOut,
  ShieldCheck,
  Users,
  Calendar,
  Briefcase,
  BarChart3,
  Clock,
  Menu,
  X,
  Lock,
  ArrowRight,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { CladoraBrand } from '@/components/brand/CladoraBrand';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

interface DemoAppShellProps {
  workspace: DemoWorkspaceDescriptor;
  lang: Language;
  children: React.ReactNode;
}

const navIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: Home,
  properties: Building2,
  residents: Users,
  maintenance: Wrench,
  assets: Layers,
  utilities: Gauge,
  communications: Megaphone,
  documents: FolderArchive,
  bookings: Calendar,
  services: Briefcase,
  'community-experience': Users,
  community_experience: Users,
  governance: Vote,
  finance: FileSpreadsheet,
  reports: BarChart3,
  activity: Clock,
  payments: CreditCard,
  role_administration: UserCheck,
  settings: Settings,
};

const navLabels: Record<string, Record<Language, string>> = {
  dashboard: { ro: 'Panou Principal', fa: 'داشبورد اصلی', en: 'Dashboard' },
  properties: { ro: 'Proprietăți & Unități', fa: 'ساختمان‌ها و واحدها', en: 'Properties & Units' },
  residents: { ro: 'Rezidenți & Directoriu', fa: 'ساکنان و دفترچه اعضا', en: 'Residents & Directory' },
  maintenance: { ro: 'Mentenanță & Tichete', fa: 'تعمیرات و دستورکارها', en: 'Maintenance & Work Orders' },
  assets: { ro: 'Active & Echipamente', fa: 'تجهیزات و دارایی‌ها', en: 'Assets & Equipment' },
  utilities: { ro: 'Contoare & Utilități', fa: 'کنتورها و مصارف', en: 'Utilities & Meters' },
  communications: { ro: 'Comunicări & Anunțuri', fa: 'اطلاعیه‌ها و پیام‌ها', en: 'Notices & Announcements' },
  documents: { ro: 'Seif Documente', fa: 'بایگانی اسناد', en: 'Document Vault' },
  bookings: { ro: 'Rezervări Facilități', fa: 'رزرو امکانات رفاهی', en: 'Amenity Bookings' },
  services: { ro: 'Catalog Servicii', fa: 'کاتالوگ خدمات', en: 'Services & Requests' },
  'community-experience': { ro: 'Comunitate & Experiență (CE)', fa: 'جامعه و تجربه (CE)', en: 'Community & Experience (CE)' },
  community_experience: { ro: 'Comunitate & Experiență (CE)', fa: 'جامعه و تجربه (CE)', en: 'Community & Experience (CE)' },
  governance: { ro: 'Guvernanță & Ședințe', fa: 'مجامع و رأی‌گیری', en: 'Governance & Meetings' },
  finance: { ro: 'Financiar & Registru', fa: 'مدیریت مالی و هزینه‌ها', en: 'Finance & Ledger' },
  reports: { ro: 'Rapoarte & Indicatori', fa: 'گزارش‌های عملکردی', en: 'Reports & Metrics' },
  activity: { ro: 'Jurnal Activitate', fa: 'گزارش وقایع و فعالیت‌ها', en: 'Activity Log' },
  payments: { ro: 'Plăți & Tranzacții', fa: 'پرداخت‌ها و تراکنش‌ها', en: 'Payments & Transactions' },
  role_administration: { ro: 'Administrare Roluri', fa: 'مدیریت نقش‌ها و دسترسی‌ها', en: 'Role Administration' },
  settings: { ro: 'Setări Workspace', fa: 'تنظیمات دمو', en: 'Workspace Settings' },
};

export const DemoAppShell: React.FC<DemoAppShellProps> = ({
  workspace,
  lang,
  children,
}) => {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Keyboard accessibility and scroll locking for mobile drawer
  useEffect(() => {
    if (!mobileDrawerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileDrawerOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push(`/${lang}/demo`);
  };

  const appBase = `/${lang}/demo/app`;

  // Backend navigation items map
  const backendNavMap = new Map<string, DemoNavigationItem>();
  if (Array.isArray(workspace.navigation)) {
    workspace.navigation.forEach((item) => {
      backendNavMap.set(item.key, item);
    });
  }

  // Canonical ordering prioritizing backend descriptor order
  const descriptorKeys = Array.isArray(workspace.navigation) && workspace.navigation.length > 0
    ? workspace.navigation.map((i) => i.key)
    : [
        'dashboard',
        'properties',
        'residents',
        'maintenance',
        'assets',
        'utilities',
        'communications',
        'documents',
        'bookings',
        'services',
        'community_experience',
        'governance',
        'finance',
        'reports',
        'activity',
        'payments',
        'role_administration',
        'settings',
      ];

  // Ensure community-experience is present in navigation if not already
  const finalKeys = [...descriptorKeys];
  if (!finalKeys.includes('community-experience') && !finalKeys.includes('community_experience')) {
    const servicesIndex = finalKeys.indexOf('services');
    if (servicesIndex !== -1) {
      finalKeys.splice(servicesIndex + 1, 0, 'community_experience');
    } else {
      finalKeys.push('community_experience');
    }
  }

  const navItems = finalKeys.map((key) => {
    const backendItem = backendNavMap.get(key) || backendNavMap.get(key.replace('_', '-')) || backendNavMap.get(key.replace('-', '_'));
    const access = backendItem ? backendItem.access : (key === 'payments' || key === 'role_administration' ? 'locked' : 'read_only');
    const label = navLabels[key]?.[lang] || backendItem?.title || key;
    const pathSlug = key === 'community_experience' ? 'community-experience' : key;
    const href = `${appBase}/${pathSlug}`;
    const Icon = navIconMap[key] || Building2;

    return {
      key,
      label,
      href,
      access,
      Icon,
    };
  });

  return (
    <div className="min-h-screen bg-[#F6F9FC] flex flex-col">
      {/* Top Disclaimer Banner */}
      <div className="bg-[#102A43] text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-[#243B53]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span className="font-medium">
            {lang === 'ro'
              ? 'Previzualizare demo CLADORA: Toate formularele sunt exclusiv demonstrative. Salvarea și modificările reale sunt active în versiunea completă.'
              : lang === 'fa'
              ? 'پیش‌نمایش دموی کلادورا: تمامی فرم‌ها صرفاً پیش‌نمایش هستند. ذخیره، ادامه و تغییر وضعیت در نسخه کامل فعال است.'
              : 'CLADORA Demo Preview: All forms are read-only previews. Operational mutation and saves are enabled in the full version.'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] bg-[#0E9F8E]/20 text-[#0E9F8E] border border-[#0E9F8E]/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            {workspace.demo_mode}
          </span>
          <span className="text-[11px] text-[#9FB3C8]">
            {workspace.profile.first_name} {workspace.profile.last_name}
          </span>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40 px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="p-1.5 rounded-lg text-[#334E68] hover:bg-[#F0F4F8] lg:hidden"
            aria-label={mobileDrawerOpen ? 'Închide meniul' : 'Deschide meniul'}
            aria-expanded={mobileDrawerOpen}
            aria-controls="mobile-navigation-drawer"
          >
            {mobileDrawerOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <Link href={`/${lang}/demo/app/dashboard`} className="flex items-center gap-2">
            <CladoraBrand className="h-6 w-auto" />
            <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#EAF8F5] text-[#0E9F8E] border border-[#B2E5DF]">
              DEMO
            </span>
          </Link>

          {/* Workspace Title Pill */}
          <div className="hidden sm:flex items-center gap-2 pl-4 rtl:pr-4 border-l rtl:border-r rtl:border-l-0 border-[#CBD5E1]">
            <Building2 className="w-4 h-4 text-[#0E9F8E]" />
            <span className="text-xs sm:text-sm font-bold text-[#102A43] max-w-[200px] truncate">
              {workspace.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher currentLang={lang} variant="header" />

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="px-3 py-1.5 text-xs font-bold text-[#52667A] hover:text-[#102A43] bg-[#F0F4F8] hover:bg-[#E2E8F0] rounded-xl transition-colors flex items-center gap-1.5"
            title={lang === 'ro' ? 'Ieșire din Demo' : lang === 'fa' ? 'خروج از دمو' : 'Sign Out'}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ro' ? 'Ieșire' : lang === 'fa' ? 'خروج' : 'Sign Out'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:flex w-64 flex-col bg-white border-r rtl:border-l rtl:border-r-0 border-[#E2E8F0] overflow-y-auto">
          <div className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9FB3C8] px-3 pb-2 block">
              {lang === 'ro' ? 'Module & Resurse Demo' : lang === 'fa' ? 'ماژول‌های محیط دمو' : 'Demo Modules & Records'}
            </span>

            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.key !== 'dashboard' && pathname.startsWith(item.href));
              const isLocked = item.access === 'locked';
              const Icon = item.Icon;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all group ${
                    isActive
                      ? 'bg-[#EAF8F5] text-[#0E9F8E] font-extrabold shadow-2xs'
                      : isLocked
                      ? 'text-[#627D98] hover:bg-[#F8FAFC] opacity-75'
                      : 'text-[#334E68] hover:bg-[#F8FAFC] hover:text-[#102A43]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#0E9F8E]' : isLocked ? 'text-[#9FB3C8]' : 'text-[#627D98] group-hover:text-[#102A43]'
                    }`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {isLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#627D98] bg-[#F0F4F8] px-1.5 py-0.5 rounded border border-[#CBD5E1] shrink-0">
                      <Lock className="w-2.5 h-2.5 text-[#9FB3C8]" />
                      <span>{lang === 'ro' ? 'Blocat' : lang === 'fa' ? 'قفل' : 'Locked'}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto p-4 border-t border-[#F0F4F8]">
            <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] text-center space-y-1">
              <span className="text-[11px] font-bold text-[#102A43] block">
                {lang === 'ro' ? 'Pregătit pentru producție?' : lang === 'fa' ? 'آماده بهره‌برداری واقعی؟' : 'Ready for Production?'}
              </span>
              <p className="text-[10px] text-[#627D98]">
                {lang === 'ro' ? 'Contactează echipa pentru onboarding.' : lang === 'fa' ? 'جهت راه‌اندازی با ما تماس بگیرید.' : 'Contact our onboarding team.'}
              </p>
              <Link
                href={`/${lang}/contact`}
                className="mt-2 text-[11px] font-bold text-[#0E9F8E] hover:underline flex items-center justify-center gap-1"
              >
                <span>{lang === 'ro' ? 'Începe Colaborarea' : lang === 'fa' ? 'درخواست شروع' : 'Start Journey'}</span>
                <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileDrawerOpen && (
          <div
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'ro' ? 'Meniu de navigare mobil' : lang === 'fa' ? 'منوی ناوبری موبایل' : 'Mobile navigation menu'}
            className="lg:hidden fixed inset-0 z-50 flex"
          >
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col overflow-y-auto p-4 space-y-2">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <CladoraBrand className="h-5 w-auto" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EAF8F5] text-[#0E9F8E]">DEMO</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-[#627D98] hover:bg-[#F0F4F8]"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-2 space-y-1 flex-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.key !== 'dashboard' && pathname.startsWith(item.href));
                  const isLocked = item.access === 'locked';
                  const Icon = item.Icon;

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                        isActive
                          ? 'bg-[#EAF8F5] text-[#0E9F8E] font-extrabold'
                          : isLocked
                          ? 'text-[#627D98] hover:bg-[#F8FAFC] opacity-75'
                          : 'text-[#334E68] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#0E9F8E]' : isLocked ? 'text-[#9FB3C8]' : 'text-[#627D98]'
                        }`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {isLocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#627D98] bg-[#F0F4F8] px-1.5 py-0.5 rounded border border-[#CBD5E1] shrink-0">
                          <Lock className="w-2.5 h-2.5 text-[#9FB3C8]" />
                          <span>{lang === 'ro' ? 'Blocat' : lang === 'fa' ? 'قفل' : 'Locked'}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-3 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{lang === 'ro' ? 'Deconectare din Demo' : lang === 'fa' ? 'خروج از حساب دمو' : 'Sign Out of Demo'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
