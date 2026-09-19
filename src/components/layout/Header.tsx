'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Language } from '@/types';
import { 
  Building2, 
  Layers, 
  ShieldCheck, 
  Cpu, 
  ChevronDown, 
  Menu, 
  X, 
  ArrowRight, 
  TrendingUp, 
  KeyRound, 
  Home, 
  FileSpreadsheet, 
  PlayCircle, 
  Sparkles, 
  Users, 
  HelpCircle,
  Database
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { CladoraBrand } from '@/components/brand/CladoraBrand';

interface HeaderProps {
  lang: Language;
}

export const Header: React.FC<HeaderProps> = ({ lang }) => {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'solutions' | 'modules' | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const solutions = [
    {
      title: lang === 'ro' ? 'Asociații de Proprietari' : lang === 'fa' ? 'انجمن‌های مالکان' : 'Homeowner Associations',
      desc: lang === 'ro' ? 'Gestiune Legea 196/2018, liste de plată, cenzori și adunări generale' : lang === 'fa' ? 'محاسبه شارژ قانونی، دسترسی بازرسان و برگزاری مجامع عمومی' : 'Statutory compliance, payment lists, censors, and AGM governance',
      href: `/${lang}/solutions/associations`,
      icon: Building2,
      tag: lang === 'ro' ? 'Association OS' : lang === 'fa' ? 'Association OS • سیستم مدیریت انجمن مالکان' : 'Association OS'
    },
    {
      title: lang === 'ro' ? 'Proprietari cu Portofoliu' : lang === 'fa' ? 'مالکان دارای چند ملک' : 'Multi-Property Owners',
      desc: lang === 'ro' ? 'Consolidare apartamente, monitorizare chirii, randament net și contracte' : lang === 'fa' ? 'پایش تجمیعی املاک، بازده خالص، وصول اجاره و تفکیک هزینه‌ها' : 'Consolidated rental income, net yields, tenant costs, and contracts',
      href: `/${lang}/solutions/property-owners`,
      icon: TrendingUp,
      tag: lang === 'fa' ? 'Portfolio OS • سیستم مدیریت سبد املاک' : 'Portfolio OS'
    },
    {
      title: lang === 'ro' ? 'Companii de Administrare' : lang === 'fa' ? 'شرکت‌های مدیریت املاک' : 'Property Management Firms',
      desc: lang === 'ro' ? 'Închidere centralizată multi-bloc, SLA mentenanță și furnizori' : lang === 'fa' ? 'بستن دسته‌ای دوره‌ها، دیسپچ تیکت‌های فنی و پایش SLA' : 'Multi-association batch close, maintenance SLAs, and operations',
      href: `/${lang}/solutions/property-managers`,
      icon: Layers,
      tag: lang === 'fa' ? 'Manager OS • سیستم شرکت‌های مدیریت املاک' : 'Manager OS'
    },
    {
      title: lang === 'ro' ? 'Proprietari & Rezidenți' : lang === 'fa' ? 'مالکان و ساکنان' : 'Owners & Residents',
      desc: lang === 'ro' ? 'Transparență totală la calculul cotelor, index contoare și plăți' : lang === 'fa' ? 'شفافیت کامل در فیش شارژ، ثبت تصویری کنتورها و پرداخت' : 'Explainable charges, online meter submission, and notices',
      href: `/${lang}/solutions/residents`,
      icon: Home,
      tag: lang === 'ro' ? 'Aplicația Rezidenților' : lang === 'fa' ? 'اپلیکیشن مالکان و ساکنان' : 'Resident App'
    },
    {
      title: lang === 'ro' ? 'Chiriași' : lang === 'fa' ? 'مستأجران' : 'Tenants',
      desc: lang === 'ro' ? 'Acces strict la cheltuielile operaționale de consum și tichete' : lang === 'fa' ? 'مشاهده مصارف انشعابات بدون دسترسی به صندوق‌های مالک' : 'Direct access to consumption costs without owner ledger access',
      href: `/${lang}/solutions/tenants`,
      icon: KeyRound,
      tag: lang === 'ro' ? 'Portalul Chiriașilor' : lang === 'fa' ? 'پرتال مستأجران' : 'Tenant Portal'
    }
  ];

  const modulesPreview = [
    {
      title: lang === 'ro' ? 'C01 — Financial Truth & Contabilitate' : lang === 'fa' ? 'C01 — حسابداری و دفاتر قانونی' : 'C01 — Financial Truth & Accounting',
      desc: lang === 'ro' ? 'Partidă simplă statutară, control analitic în partidă dublă și stornare' : lang === 'fa' ? 'دفاتر قانونی یک‌طرفه، کنترل تحلیلی تکمیلی دوطرفه و سند اصلاحی' : 'Statutory simple-entry, supplemental double-entry ledger, auditable reversals',
      href: `/${lang}/modules`
    },
    {
      title: lang === 'ro' ? 'C02 — Alocare & Drepturi 5D' : lang === 'fa' ? 'C02 — تسهیم هزینه‌ها و تفکیک حقوق' : 'C02 — Allocation & Rights Engine',
      desc: lang === 'ro' ? 'Algoritmi CPI, persoane, suprafață și separare debitor/plătitor' : lang === 'fa' ? 'فرمول‌های مشاعات، نفرات و تفکیک مدیون از پرداخت‌کننده' : 'Statutory CPI shares, person count, and debtor/payer isolation',
      href: `/${lang}/modules`
    },
    {
      title: lang === 'ro' ? 'C08 — Contoare & Consum' : lang === 'fa' ? 'C08 — قرائت کنتورها و هوش مصنوعی' : 'C08 — Utilities & Meter Readings',
      desc: lang === 'ro' ? 'Citire index foto OCR, detecție anomalii și validare' : lang === 'fa' ? 'استخراج خودکار ارقام با عکس، تشخیص نشتی و اتلاف شبکه' : 'Photo OCR validation, anomaly detection, and radio meters',
      href: `/${lang}/modules`
    },
    {
      title: lang === 'ro' ? 'C16 — Migrare & Shadow Ledger' : lang === 'fa' ? 'C16 — مهاجرت کنترل‌شده و دفتر کل موازی' : 'C16 — Shadow Ledger Migration',
      desc: lang === 'ro' ? 'Reconciliere asistată cu softurile vechi în paralel' : lang === 'fa' ? 'تطبیق هم‌زمان با سامانه‌های قبلی تا رفع کامل مغایرت‌ها' : 'Assisted parallel reconciliation against legacy exports',
      href: `/${lang}/modules`
    }
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-sm py-3'
          : 'bg-[#F6F9FC]/90 backdrop-blur-sm border-b border-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <Link href={`/${lang}`} aria-label="CLADORA" className="group rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]">
            <CladoraBrand
              variant="primary"
              className="h-8 w-auto transition-transform group-hover:scale-[1.02] sm:h-10"
              priority
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2" ref={dropdownRef}>
            <Link
              href={`/${lang}/platform`}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-[#52667A] hover:text-[#102A43] hover:bg-[#F0F4F8] transition-colors"
            >
              {lang === 'ro' ? 'Platformă' : lang === 'fa' ? 'معماری پلتفرم' : 'Platform'}
            </Link>

            {/* Solutions Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'solutions' ? null : 'solutions')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeDropdown === 'solutions'
                    ? 'text-[#0E9F8E] bg-[#EAF8F5]'
                    : 'text-[#52667A] hover:text-[#102A43] hover:bg-[#F0F4F8]'
                }`}
              >
                <span>{lang === 'ro' ? 'Soluții' : lang === 'fa' ? 'راهکارها' : 'Solutions'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'solutions' ? 'rotate-180 text-[#0E9F8E]' : ''}`} />
              </button>

              {activeDropdown === 'solutions' && (
                <div className="absolute top-full start-0 mt-2 w-[480px] bg-white rounded-2xl border border-[#E2E8F0] shadow-elevated p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="text-xs font-bold text-[#7B8A9A] uppercase tracking-wider px-3 pb-2 border-b border-[#F0F4F8]">
                    {lang === 'ro' ? 'Soluții pe Tipuri de Utilizatori' : lang === 'fa' ? 'راهکارهای تفکیک‌شده بر اساس نقش' : 'Solutions by Customer Type'}
                  </div>
                  <div className="mt-2 space-y-1">
                    {solutions.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#F6F9FC] transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center shrink-0 group-hover:bg-[#0E9F8E] group-hover:text-white transition-colors">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                                {item.title}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0F4F8] text-[#52667A]">
                                {item.tag}
                              </span>
                            </div>
                            <p className="text-xs text-[#52667A] mt-0.5 line-clamp-1">
                              {item.desc}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modules Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveDropdown(activeDropdown === 'modules' ? null : 'modules')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeDropdown === 'modules'
                    ? 'text-[#0E9F8E] bg-[#EAF8F5]'
                    : 'text-[#52667A] hover:text-[#102A43] hover:bg-[#F0F4F8]'
                }`}
              >
                <span>{lang === 'ro' ? 'Module' : lang === 'fa' ? 'ماژول‌ها' : 'Modules'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'modules' ? 'rotate-180 text-[#0E9F8E]' : ''}`} />
              </button>

              {activeDropdown === 'modules' && (
                <div className="absolute top-full start-0 mt-2 w-[460px] bg-white rounded-2xl border border-[#E2E8F0] shadow-elevated p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0F4F8]">
                    <span className="text-xs font-bold text-[#7B8A9A] uppercase tracking-wider">
                      {lang === 'ro' ? 'Arhitectura Celor 17 Nuclee' : lang === 'fa' ? 'معماری ۱۷ هسته نرم‌افزاری' : 'The 17 Logical Cores'}
                    </span>
                    <Link
                      href={`/${lang}/modules`}
                      onClick={() => setActiveDropdown(null)}
                      className="text-xs font-bold text-[#0E9F8E] hover:underline"
                    >
                      {lang === 'ro' ? 'Toate cele 17' : lang === 'fa' ? 'مشاهده همه ۱۷ هسته' : 'View all 17'} →
                    </Link>
                  </div>
                  <div className="mt-2 space-y-1">
                    {modulesPreview.map((item, idx) => (
                      <Link
                        key={idx}
                        href={item.href}
                        onClick={() => setActiveDropdown(null)}
                        className="block p-2.5 rounded-xl hover:bg-[#F6F9FC] transition-colors"
                      >
                        <div className="text-xs font-bold text-[#102A43] hover:text-[#0E9F8E]">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[#52667A] mt-0.5">
                          {item.desc}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link
              href={`/${lang}/migration`}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-[#52667A] hover:text-[#102A43] hover:bg-[#F0F4F8] transition-colors"
            >
              {lang === 'ro' ? 'Migrare Controlată' : lang === 'fa' ? 'مهاجرت کنترل‌شده' : 'Migration'}
            </Link>

            <Link
              href={`/${lang}/pricing`}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-[#52667A] hover:text-[#102A43] hover:bg-[#F0F4F8] transition-colors"
            >
              {lang === 'ro' ? 'Tarife' : lang === 'fa' ? 'تعرفه‌ها' : 'Pricing'}
            </Link>

            <Link
              href={`/${lang}/pilot`}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-[#0E9F8E] hover:bg-[#EAF8F5] transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'ro' ? 'Program Pilot' : lang === 'fa' ? 'برنامه پایلوت' : 'Pilot Cohort'}</span>
            </Link>
          </nav>

          {/* Desktop Right CTAs + Flag Language Switcher */}
          <div className="hidden lg:flex items-center gap-3">
            
            {/* Accessible Flag Language Switcher */}
            <LanguageSwitcher currentLang={lang} variant="header" />

            <Link
              href={`/${lang}/login`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#102A43] hover:bg-[#F0F4F8] transition-colors"
            >
              {lang === 'ro' ? 'Autentificare' : lang === 'fa' ? 'ورود به حساب' : 'Sign in'}
            </Link>

            <Link
              href={`/${lang}/demo`}
              className="px-4 py-2.5 rounded-xl bg-[#102A43] hover:bg-[#173F5F] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4 text-[#75CFC3]" />
              <span>{lang === 'ro' ? 'Demo Interactiv' : lang === 'fa' ? 'دموی تعاملی' : 'Live Sandbox'}</span>
            </Link>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher currentLang={lang} variant="header" />
            
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-[#102A43] hover:bg-[#F0F4F8] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={mobileMenuOpen ? 'Închide meniul' : 'Deschide meniul'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[65px] bg-white z-50 overflow-y-auto p-6 space-y-6 animate-in slide-in-from-top-4 duration-200">
          
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#7B8A9A] uppercase tracking-wider pb-2 border-b border-[#F0F4F8]">
              {lang === 'ro' ? 'Navigare Principală' : lang === 'fa' ? 'بخش‌های اصلی' : 'Main Navigation'}
            </div>
            
            <Link
              href={`/${lang}/platform`}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-base font-bold text-[#102A43]"
            >
              {lang === 'ro' ? 'Arhitectura Platformei' : lang === 'fa' ? 'معماری پلتفرم' : 'Platform Architecture'}
            </Link>

            <Link
              href={`/${lang}/modules`}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-base font-bold text-[#102A43]"
            >
              {lang === 'ro' ? 'Cele 17 Module Logice' : lang === 'fa' ? 'مشاهده ۱۷ هسته نرم‌افزاری' : 'The 17 Logical Cores'}
            </Link>

            <Link
              href={`/${lang}/migration`}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-base font-bold text-[#102A43]"
            >
              {lang === 'ro' ? 'Migrare Controlată (Shadow Ledger)' : lang === 'fa' ? 'مهاجرت کنترل‌شده (Shadow Ledger)' : 'Controlled Migration (Shadow Ledger)'}
            </Link>

            <Link
              href={`/${lang}/pricing`}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-base font-bold text-[#102A43]"
            >
              {lang === 'ro' ? 'Tarife & Calculator' : lang === 'fa' ? 'تعرفه‌ها و محاسبه‌گر' : 'Pricing & Calculator'}
            </Link>

            <Link
              href={`/${lang}/pilot`}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 text-base font-bold text-[#0E9F8E]"
            >
              {lang === 'ro' ? 'Program Pilot' : lang === 'fa' ? 'برنامه پایلوت' : 'Pilot Cohort'}
            </Link>
          </div>

          {/* Solutions List */}
          <div className="space-y-2 pt-2 border-t border-[#F0F4F8]">
            <div className="text-xs font-bold text-[#7B8A9A] uppercase tracking-wider pb-2">
              {lang === 'ro' ? 'Soluții pe Roluri' : lang === 'fa' ? 'راهکارها بر اساس نقش' : 'Solutions by Persona'}
            </div>
            {solutions.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between py-2 text-sm font-semibold text-[#52667A] hover:text-[#102A43]"
              >
                <span>{item.title}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF8F5] text-[#0A6E62]">
                  {item.tag}
                </span>
              </Link>
            ))}
          </div>

          {/* Mobile Language Switcher (3-flag grid) */}
          <div className="pt-4 border-t border-[#F0F4F8]">
            <LanguageSwitcher currentLang={lang} variant="mobile-drawer" />
          </div>

          {/* Mobile CTAs */}
          <div className="pt-4 space-y-3">
            <Link
              href={`/${lang}/demo`}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3.5 px-4 rounded-xl bg-[#102A43] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <PlayCircle className="w-4 h-4 text-[#75CFC3]" />
              <span>{lang === 'ro' ? 'Deschide Demo Interactiv' : lang === 'fa' ? 'ورود به دموی تعاملی' : 'Open Live Sandbox'}</span>
            </Link>

            <Link
              href={`/${lang}/login`}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3.5 px-4 rounded-xl bg-[#F0F4F8] text-[#102A43] text-sm font-bold flex items-center justify-center"
            >
              {lang === 'ro' ? 'Autentificare în Cont' : lang === 'fa' ? 'ورود به حساب کاربری' : 'Sign in to Account'}
            </Link>
          </div>

        </div>
      )}
    </header>
  );
};
