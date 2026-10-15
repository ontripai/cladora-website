'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Language } from '@/types';
import {
  Building2,
  Layers,
  ShieldCheck,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Users,
  HelpCircle,
  Briefcase,
  Wrench,
  Compass,
  FileCheck2,
  Store,
  Warehouse,
  Building,
  DollarSign,
  FileText,
  Cpu,
  LogIn,
  Home,
  Bot,
  Hotel,
  Factory,
  Car,
  BookOpen,
  BookA
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { CladoraBrand } from '@/components/brand/CladoraBrand';

interface HeaderProps {
  lang: Language;
}

type DropdownKey = 'platform' | 'solutions' | 'industries' | 'capabilities' | 'resources' | null;

export const Header: React.FC<HeaderProps> = ({ lang }) => {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
  const [expandedMobileGroup, setExpandedMobileGroup] = useState<string | null>(null);

  const navContainerRef = useRef<HTMLDivElement>(null);

  // Scroll listener for sticky header background styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown or mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  }

  // Accessibility: Focus management for Mobile Drawer
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const drawerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileMenuOpen) {
      // Move focus into the drawer container
      drawerContainerRef.current?.focus();
    } else {
      // Return focus to menu trigger when drawer closes
      triggerButtonRef.current?.focus();
    }
  }, [mobileMenuOpen]);

  const toggleDropdown = (key: DropdownKey) => {
    setActiveDropdown((prev) => (prev === key ? null : key));
  };

  const toggleMobileGroup = (group: string) => {
    setExpandedMobileGroup((prev) => (prev === group ? null : group));
  };

  // Nav Item Content / Localized labels
  const labels = {
    ro: {
      platform: 'Platformă',
      solutions: 'Soluții',
      industries: 'Industrii',
      capabilities: 'Capabilități',
      ai: 'Inteligență',
      resources: 'Resurse',
      signIn: 'Autentificare',
      startPartnership: 'Solicită Parteneriat',
      explorePlatform: 'Explorează Platforma',
    },
    en: {
      platform: 'Platform',
      solutions: 'Solutions',
      industries: 'Industries',
      capabilities: 'Capabilities',
      ai: 'Intelligence',
      resources: 'Resources',
      signIn: 'Sign In',
      startPartnership: 'Start Partnership',
      explorePlatform: 'Explore Platform',
    },
    fa: {
      platform: 'پلتفرم',
      solutions: 'راهکارها',
      industries: 'صنایع',
      capabilities: 'قابلیت‌ها',
      ai: 'هوش مصنوعی',
      resources: 'منابع',
      signIn: 'ورود',
      startPartnership: 'درخواست شروع همکاری',
      explorePlatform: 'آشنایی با پلتفرم',
    },
  }[lang] || {
    platform: 'Platform',
    solutions: 'Solutions',
    industries: 'Industries',
    capabilities: 'Capabilities',
    ai: 'AI',
    resources: 'Resources',
    signIn: 'Sign In',
    startPartnership: 'Start Partnership',
    explorePlatform: 'Explore Platform',
  };

  // 1. Platform Mega Menu Content
  const platformItems = [
    {
      title: lang === 'ro' ? 'Prezentare Platformă' : lang === 'fa' ? 'معرفی کلی پلتفرم' : 'Platform Overview',
      desc: lang === 'ro' ? 'Arhitectura unificată pentru active, spații și operațiuni' : lang === 'fa' ? 'معماری یکپارچه برای املاک، فضاها و عملیات' : 'Unified architecture across properties, units, and workflows',
      href: `/${lang}/platform`,
      icon: Building2,
    },
    {
      title: lang === 'ro' ? 'Arhitectură & Model Workspace' : lang === 'fa' ? 'معماری و مدل ورک‌اسپیس' : 'Architecture & Workspace Model',
      desc: lang === 'ro' ? 'Separare logică, granițe de mandat și delegare de autoritate' : lang === 'fa' ? 'تفکیک داده‌ها، حدود اختیارات و تفویض مسئولیت‌ها' : 'Logical boundaries, mandate-based authority, and safe delegation',
      href: `/${lang}/platform/architecture`,
      icon: Layers,
    },
    {
      title: lang === 'ro' ? 'Ciclul de Viață al Proprietății' : lang === 'fa' ? 'پیوستگی چرخهٔ عمر ملک' : 'Property Lifecycle',
      desc: lang === 'ro' ? 'De la pre-vânzare și dezvoltare până la operare pe termen lung' : lang === 'fa' ? 'از تعریف و پیش‌فروش تا بهره‌برداری و معاملات بعدی' : 'Preserving authorized record continuity across all property phases',
      href: `/${lang}/platform/lifecycle`,
      icon: TrendingUp,
    },
    {
      title: lang === 'ro' ? 'Securitate, Încredere & Audit' : lang === 'fa' ? 'امنیت، اعتماد و ممیزی' : 'Trust, Security & Audit',
      desc: lang === 'ro' ? 'Jurnal de audit aditiv, delimitare pe workspace și guvernanță UE' : lang === 'fa' ? 'ثبت رویدادهای ممیزی، تفکیک داده‌های ورک‌اسپیس و حاکمیت داده‌ها مطابق موازین اروپایی' : 'Auditable event trails, workspace boundaries, and EU data governance',
      href: `/${lang}/platform/trust`,
      icon: ShieldCheck,
    },
  ];

  // 2. Solutions Mega Menu Content (Role-based)
  const solutionsItems = [
    {
      title: lang === 'ro' ? 'Dezvoltatori & Constructori' : lang === 'fa' ? 'سازندگان و عرضه‌کنندگان' : 'Developers & Builders',
      desc: lang === 'ro' ? 'Identitate inițială, pre-vânzare, cartea tehnică și predare' : lang === 'fa' ? 'تعریف هویت ملک، فروش اولیه، پرونده فنی و تحویل واحدها' : 'Property identity, pre-sales tracking, document vault, and handover',
      href: `/${lang}/solutions/developers`,
      icon: Building,
    },
    {
      title: lang === 'ro' ? 'Proprietari & Portofolii' : lang === 'fa' ? 'مالکان و دارندگان سبد املاک' : 'Property Owners & Portfolios',
      desc: lang === 'ro' ? 'Vizibilitate financiară, randamente, audit și contracte' : lang === 'fa' ? 'دید شفاف مالی، وضعیت اجاره‌ها، صورت‌های مالی و قراردادها' : 'Unified financial truth, yield oversight, contracts, and unit audit',
      href: `/${lang}/solutions/property-owners`,
      icon: Briefcase,
    },
    {
      title: lang === 'ro' ? 'Asociații de Proprietari' : lang === 'fa' ? 'انجمن‌های مالکان و مجتمع‌ها' : 'Associations & Communities',
      desc: lang === 'ro' ? 'Cote statutare de întreținere, plăți transparente și avizier' : lang === 'fa' ? 'محاسبه سهم شارژ قانونی، شفافیت دریافت‌ها و اطلاع‌رسانی' : 'Statutory HOA quotas, auditable ledgers, and resident portal',
      href: `/${lang}/solutions/associations`,
      icon: Users,
    },
    {
      title: lang === 'ro' ? 'Companii de Administrare' : lang === 'fa' ? 'شرکت‌های مدیریت بهره‌برداری' : 'Property Management Companies',
      desc: lang === 'ro' ? 'Gestiune multi-clădire, dispecerat tichete și conformitate' : lang === 'fa' ? 'مدیریت چندساختمانی، سامانه تیکتینگ و انطباق قانونی' : 'Multi-asset operations, automated bank feeds, and ticket dispatch',
      href: `/${lang}/solutions/property-managers`,
      icon: Wrench,
    },
    {
      title: lang === 'ro' ? 'Rezidenți & Ocupanți' : lang === 'fa' ? 'ساکنان و بهره‌برداران' : 'Residents & Occupants',
      desc: lang === 'ro' ? 'Transparență cote, transmitere index, tichete și avizier digital' : lang === 'fa' ? 'شفافیت فیش شارژ، ثبت ارقام کنتور، تیکت‌های فنی و اطلاعیه‌ها' : 'Clear statements, meter reporting, maintenance tickets, and notices',
      href: `/${lang}/solutions/residents`,
      icon: Home,
    },
    {
      title: lang === 'ro' ? 'Furnizori de Servicii' : lang === 'fa' ? 'پیمانکاران و ارائه‌دهندگان خدمات' : 'Service Providers',
      desc: lang === 'ro' ? 'Comenzi de lucru verificate, procese-verbale și decontare' : lang === 'fa' ? 'سفارش‌های کار تاییدشده، گزارش انجام کار و تسویه' : 'Verified work orders, SLA accountability, and digitized signoffs',
      href: `/${lang}/solutions/service-providers`,
      icon: FileCheck2,
    },
  ];

  // 3. Industries Menu Content
  const industriesItems = [
    {
      title: lang === 'ro' ? 'Rezidențial' : lang === 'fa' ? 'املاک مسکونی' : 'Residential',
      href: `/${lang}/industries#residential`,
      icon: Building,
    },
    {
      title: lang === 'ro' ? 'Birouri & Workplace' : lang === 'fa' ? 'اداری و دفاتر کار' : 'Office & Workplace',
      href: `/${lang}/industries#office`,
      icon: Building2,
    },
    {
      title: lang === 'ro' ? 'Retail & Mall-uri' : lang === 'fa' ? 'تجاری و مراکز خرید' : 'Retail & Shopping',
      href: `/${lang}/industries#retail`,
      icon: Store,
    },
    {
      title: lang === 'ro' ? 'Ospitalitate' : lang === 'fa' ? 'اقامتی و هتلداری' : 'Hospitality',
      href: `/${lang}/industries#hospitality`,
      icon: Hotel,
    },
    {
      title: lang === 'ro' ? 'Industrial' : lang === 'fa' ? 'صنعتی و کارخانجات' : 'Industrial',
      href: `/${lang}/industries#industrial`,
      icon: Factory,
    },
    {
      title: lang === 'ro' ? 'Logistică & Depozitare' : lang === 'fa' ? 'لجستیک و انبارداری' : 'Logistics',
      href: `/${lang}/industries#logistics`,
      icon: Warehouse,
    },
    {
      title: lang === 'ro' ? 'Auto & Showroom' : lang === 'fa' ? 'املاک خودرویی' : 'Automotive Facilities',
      href: `/${lang}/industries#automotive`,
      icon: Car,
    },
    {
      title: lang === 'ro' ? 'Ansambluri Mixte' : lang === 'fa' ? 'مجتمع‌های چندمنظوره' : 'Mixed-Use Developments',
      href: `/${lang}/industries#mixed-use`,
      icon: Layers,
    },
  ];

  // 4. Capabilities Menu Content
  const capabilitiesItems = [
    {
      title: lang === 'ro' ? 'Fundația Platformei' : lang === 'fa' ? 'زیرساخت پلتفرم و ورک‌اسپیس' : 'Platform Foundation',
      desc: lang === 'ro' ? 'Workspace universal, identitate unică și roluri RBAC' : lang === 'fa' ? 'ورک‌اسپیس سراسری و حدود اختیارات کاربران' : 'Universal workspace model and role-based permissions',
      href: `/${lang}/capabilities`,
      icon: Building2,
    },
    {
      title: lang === 'ro' ? 'Evidență Financiară (Double-Entry)' : lang === 'fa' ? 'دفاتر مالی دوبل و کنترل تحلیلی' : 'Financial Truth & Ledgers',
      desc: lang === 'ro' ? 'Reconciliere bancară, cote statutare și transparență' : lang === 'fa' ? 'مغایرت‌گیری بانکی و فرمول‌های قانونی شارژ' : 'Statutory cost-sharing formulas and banking feed sync',
      href: `/${lang}/capabilities`,
      icon: DollarSign,
    },
    {
      title: lang === 'ro' ? 'Identitate Imobiliară & Documente' : lang === 'fa' ? 'شناسنامه دیجیتال و اسناد' : 'Property Identity & Documents',
      desc: lang === 'ro' ? 'Cartea tehnică a construcției și arhivă securizată' : lang === 'fa' ? 'پرونده فنی ملک و آرشیو امن مدارک' : 'Digital building passport and safe evidence archive',
      href: `/${lang}/capabilities`,
      icon: FileText,
    },
    {
      title: lang === 'ro' ? 'AIRPROP — Vânzări & Închirieri' : lang === 'fa' ? 'ایرپراپ — معاملات و اجاره' : 'AIRPROP — Sales & Leasing',
      desc: lang === 'ro' ? 'Gestiune disponibilitate și predare istoric activ' : lang === 'fa' ? 'مدیریت واحدها و انتقال پیوسته سوابق' : 'Inventory availability and seamless record continuity',
      href: `/${lang}/airprop`,
      icon: Sparkles,
    },
    {
      title: lang === 'ro' ? 'SERVICE — Operațiuni în Teren' : lang === 'fa' ? 'سرویس و عملیات فنی' : 'SERVICE & Field Operations',
      desc: lang === 'ro' ? 'Tichete de mentenanță, revizii și comenzi de lucru' : lang === 'fa' ? 'تیکت‌های خرابی، بازدید دوره‌ای و سفارش کار' : 'Maintenance work orders and verified service dispatches',
      href: `/${lang}/service`,
      icon: Wrench,
    },
    {
      title: lang === 'ro' ? 'Comunitate & Experiență (C&E)' : lang === 'fa' ? 'جامعه و تجربه کاربری (C&E)' : 'Community & Experience (C&E)',
      desc: lang === 'ro' ? 'Ghiduri de spațiu, interacțiuni autorizate și călătorii de utilizator' : lang === 'fa' ? 'راهنمای فضاها، تعاملات مجاز و مسیرهای کاربری' : 'Place guides, authorized interactions, and contextual journeys',
      href: `/${lang}/community-experience`,
      icon: Users,
    },
    {
      title: lang === 'ro' ? 'Securitate & Audit' : lang === 'fa' ? 'امنیت و ممیزی' : 'Security & Audit',
      desc: lang === 'ro' ? 'Jurnal de audit aditiv, delimitare și politici UE' : lang === 'fa' ? 'ثبت ترتیبی رویدادها، تفکیک داده‌ها و ضوابط حاکمیت داده‌ها' : 'Append-only event stream, isolation, and EU-aligned governance',
      href: `/${lang}/platform/trust`,
      icon: ShieldCheck,
    },
  ];

  // 5. Resources Menu Content
  const resourcesItems = [
    {
      title: lang === 'ro' ? 'Ghiduri & Bune Practici' : lang === 'fa' ? 'راهنماها و بستر معماری' : 'Guides & Best Practices',
      desc: lang === 'ro' ? 'Analize aprofundate privind arhitectura și adevărul canonic' : lang === 'fa' ? 'مقالات عمیق پیرامون معماری و مراجع داده‌ها' : 'Deep architectural essays and operational playbooks',
      href: `/${lang}/resources/guides`,
      icon: BookOpen,
    },
    {
      title: lang === 'ro' ? 'Hub de Migrare' : lang === 'fa' ? 'پایگاه مهاجرت اطلاعات' : 'Migration Hub',
      desc: lang === 'ro' ? 'Metodologie controlată de tranziție de la sisteme legacy' : lang === 'fa' ? 'روش استاندارد و کنترل‌شده انتقال اطلاعات املاک' : 'Controlled portfolio transition methodology & Zero-Write rules',
      href: `/${lang}/resources/migration-hub`,
      icon: Compass,
    },
    {
      title: lang === 'ro' ? 'Securitate & Încredere' : lang === 'fa' ? 'امنیت و اعتماد' : 'Security & Trust',
      desc: lang === 'ro' ? 'Granițe de workspace, guvernanță GDPR și supraveghere AI' : lang === 'fa' ? 'مرزهای تفکیک‌شده، حاکمیت داده و نظارت بر AI' : 'Workspace boundaries, GDPR-aware governance, and AI controls',
      href: `/${lang}/resources/security`,
      icon: ShieldCheck,
    },
    {
      title: lang === 'ro' ? 'Întrebări Frecvente (FAQ)' : lang === 'fa' ? 'پرسش‌های متداول (FAQ)' : 'Frequently Asked Questions',
      desc: lang === 'ro' ? 'Răspunsuri tehnice structurate pe 10 domenii de operare' : lang === 'fa' ? 'پاسخ‌های مستند به پرسش‌های کلیدی پلتفرم' : 'Authoritative answers across 10 operational domains',
      href: `/${lang}/faq`,
      icon: HelpCircle,
    },
    {
      title: lang === 'ro' ? 'Glosar Canonic' : lang === 'fa' ? 'واژه‌نامه مرجع اصطلاحات' : 'Canonical Glossary',
      desc: lang === 'ro' ? 'Definițiile oficiale ale celor 30 de concepte cheie' : lang === 'fa' ? 'تعاریف رسمی از مفاهیم و متولیان داده کلادورا' : 'Authoritative definitions for 30 foundational concepts',
      href: `/${lang}/resources/glossary`,
      icon: BookA,
    },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-card border-b border-[#E2E8F0]'
          : 'bg-white/80 backdrop-blur-sm border-b border-transparent'
      }`}
      ref={navContainerRef}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link
              href={`/${lang}`}
              className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] rounded-lg"
              aria-label={lang === 'ro' ? 'CLADORA Acasă' : lang === 'fa' ? 'صفحه اصلی کلادورا' : 'CLADORA Home'}
            >
              <CladoraBrand className="h-8 w-auto text-[#102A43]" />
            </Link>
          </div>

          {/* Desktop Navigation (6 Pillars) */}
          <nav className="hidden lg:flex items-center space-x-1 rtl:space-x-reverse" aria-label="Main Navigation">
            
            {/* 1. Platform */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('platform')}
                aria-expanded={activeDropdown === 'platform'}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                  activeDropdown === 'platform' || pathname?.startsWith(`/${lang}/platform`)
                    ? 'text-[#0E9F8E] bg-[#EAF8F5]'
                    : 'text-[#102A43] hover:text-[#0E9F8E] hover:bg-[#F0F4F8]'
                }`}
              >
                <span>{labels.platform}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    activeDropdown === 'platform' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'platform' && (
                <div
                  role="menu"
                  className="absolute start-0 mt-2 w-[420px] rounded-2xl bg-white border border-[#D3DCE6] shadow-elevated p-3 z-50 animate-in fade-in duration-150"
                >
                  <div className="space-y-1">
                    {platformItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.title}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#F6F9FC] transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0 group-hover:bg-[#0E9F8E] group-hover:text-white transition-colors">
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                              {item.title}
                            </div>
                            <div className="text-xs text-[#52667A] leading-relaxed mt-0.5">
                              {item.desc}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#F0F4F8] px-2 flex justify-between items-center text-xs">
                    <Link
                      href={`/${lang}/platform`}
                      onClick={() => setActiveDropdown(null)}
                      className="text-[#0E9F8E] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>{labels.explorePlatform}</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Solutions */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('solutions')}
                aria-expanded={activeDropdown === 'solutions'}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                  activeDropdown === 'solutions' || pathname?.startsWith(`/${lang}/solutions`)
                    ? 'text-[#0E9F8E] bg-[#EAF8F5]'
                    : 'text-[#102A43] hover:text-[#0E9F8E] hover:bg-[#F0F4F8]'
                }`}
              >
                <span>{labels.solutions}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    activeDropdown === 'solutions' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'solutions' && (
                <div
                  role="menu"
                  className="absolute start-0 mt-2 w-[580px] rounded-2xl bg-white border border-[#D3DCE6] shadow-elevated p-4 z-50 animate-in fade-in duration-150"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {solutionsItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.title}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F6F9FC] transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0 group-hover:bg-[#0E9F8E] group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-[#52667A] leading-tight mt-0.5">
                              {item.desc}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#F0F4F8] px-2 flex justify-between items-center text-xs">
                    <Link
                      href={`/${lang}/solutions`}
                      onClick={() => setActiveDropdown(null)}
                      className="text-[#0E9F8E] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>{labels.solutions} Overview</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Industries */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('industries')}
                aria-expanded={activeDropdown === 'industries'}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                  activeDropdown === 'industries' || pathname?.startsWith(`/${lang}/industries`)
                    ? 'text-[#0E9F8E] bg-[#EAF8F5]'
                    : 'text-[#102A43] hover:text-[#0E9F8E] hover:bg-[#F0F4F8]'
                }`}
              >
                <span>{labels.industries}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    activeDropdown === 'industries' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'industries' && (
                <div
                  role="menu"
                  className="absolute start-0 mt-2 w-[420px] rounded-2xl bg-white border border-[#D3DCE6] shadow-elevated p-3 z-50 animate-in fade-in duration-150"
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    {industriesItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.title}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-[#F6F9FC] transition-colors group"
                        >
                          <Icon className="w-4 h-4 text-[#0E9F8E] shrink-0" />
                          <span className="text-xs font-bold text-[#102A43] group-hover:text-[#0E9F8E] truncate">
                            {item.title}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#F0F4F8] px-2 flex justify-between items-center text-xs">
                    <Link
                      href={`/${lang}/industries`}
                      onClick={() => setActiveDropdown(null)}
                      className="text-[#0E9F8E] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>{labels.industries} Overview</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Capabilities */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('capabilities')}
                aria-expanded={activeDropdown === 'capabilities'}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                  activeDropdown === 'capabilities' || pathname?.startsWith(`/${lang}/capabilities`)
                    ? 'text-[#0E9F8E] bg-[#EAF8F5]'
                    : 'text-[#102A43] hover:text-[#0E9F8E] hover:bg-[#F0F4F8]'
                }`}
              >
                <span>{labels.capabilities}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    activeDropdown === 'capabilities' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'capabilities' && (
                <div
                  role="menu"
                  className="absolute start-0 mt-2 w-[520px] rounded-2xl bg-white border border-[#D3DCE6] shadow-elevated p-4 z-50 animate-in fade-in duration-150"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {capabilitiesItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.title}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#F6F9FC] transition-colors group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0 group-hover:bg-[#0E9F8E] group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-[#52667A] leading-tight mt-0.5">
                              {item.desc}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#F0F4F8] px-2 flex justify-between items-center text-xs">
                    <Link
                      href={`/${lang}/capabilities`}
                      onClick={() => setActiveDropdown(null)}
                      className="text-[#0E9F8E] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>{labels.capabilities} Overview</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 5. AI (Top-level direct link) */}
            <Link
              href={`/${lang}/ai`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                pathname === `/${lang}/ai`
                  ? 'text-[#0E9F8E] bg-[#EAF8F5]'
                  : 'text-[#102A43] hover:text-[#0E9F8E] hover:bg-[#F0F4F8]'
              }`}
            >
              <Bot className="w-4 h-4 text-[#0E9F8E]" />
              <span>{labels.ai}</span>
            </Link>

            {/* 6. Resources */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('resources')}
                aria-expanded={activeDropdown === 'resources'}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                  activeDropdown === 'resources' || pathname?.startsWith(`/${lang}/resources`)
                    ? 'text-[#0E9F8E] bg-[#EAF8F5]'
                    : 'text-[#102A43] hover:text-[#0E9F8E] hover:bg-[#F0F4F8]'
                }`}
              >
                <span>{labels.resources}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    activeDropdown === 'resources' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'resources' && (
                <div
                  role="menu"
                  className="absolute start-0 mt-2 w-[380px] rounded-2xl bg-white border border-[#D3DCE6] shadow-elevated p-3 z-50 animate-in fade-in duration-150"
                >
                  <div className="space-y-1">
                    {resourcesItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.title}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F6F9FC] transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0 group-hover:bg-[#0E9F8E] group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-[#52667A] leading-tight mt-0.5">
                              {item.desc}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#F0F4F8] px-2">
                    <Link
                      href={`/${lang}/resources`}
                      onClick={() => setActiveDropdown(null)}
                      className="text-xs text-[#0E9F8E] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>{labels.resources} Center</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

          </nav>

          {/* Desktop Right Action Bar: [Language] [Sign In] [Start Partnership] */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher currentLang={lang} variant="header" />

            {/* Member Action: Sign In */}
            <Link
              href={`/${lang}/login`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[#102A43] hover:text-[#0E9F8E] hover:bg-[#F0F4F8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{labels.signIn}</span>
            </Link>

            {/* Primary Global CTA: Start Partnership */}
            <Link
              href={`/${lang}/contact`}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold bg-[#0E9F8E] text-white hover:bg-[#0C8778] transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>{labels.startPartnership}</span>
            </Link>
          </div>

          {/* Mobile Menu Trigger & Language Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher currentLang={lang} variant="header" />
            <button
              ref={triggerButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl p-2 text-[#102A43] hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-drawer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-20 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-20 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div
            id="mobile-navigation-drawer"
            ref={drawerContainerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
            className="relative bg-white h-[calc(100vh-5rem)] overflow-y-auto border-t border-[#E2E8F0] px-6 py-6 flex flex-col justify-between shadow-elevated focus:outline-none"
          >
            <div className="space-y-4">
              
              {/* 1. Platform Mobile Group */}
              <div className="border-b border-[#F0F4F8] pb-3">
                <button
                  type="button"
                  onClick={() => toggleMobileGroup('platform')}
                  className="w-full flex items-center justify-between py-2 text-base font-bold text-[#102A43] text-start"
                >
                  <span>{labels.platform}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      expandedMobileGroup === 'platform' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedMobileGroup === 'platform' && (
                  <div className="pt-2 ps-3 space-y-2">
                    {platformItems.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1.5 text-sm text-[#52667A] hover:text-[#0E9F8E] font-medium"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Solutions Mobile Group */}
              <div className="border-b border-[#F0F4F8] pb-3">
                <button
                  type="button"
                  onClick={() => toggleMobileGroup('solutions')}
                  className="w-full flex items-center justify-between py-2 text-base font-bold text-[#102A43] text-start"
                >
                  <span>{labels.solutions}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      expandedMobileGroup === 'solutions' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedMobileGroup === 'solutions' && (
                  <div className="pt-2 ps-3 space-y-2">
                    {solutionsItems.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1.5 text-sm text-[#52667A] hover:text-[#0E9F8E] font-medium"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Industries Mobile Group */}
              <div className="border-b border-[#F0F4F8] pb-3">
                <button
                  type="button"
                  onClick={() => toggleMobileGroup('industries')}
                  className="w-full flex items-center justify-between py-2 text-base font-bold text-[#102A43] text-start"
                >
                  <span>{labels.industries}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      expandedMobileGroup === 'industries' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedMobileGroup === 'industries' && (
                  <div className="pt-2 ps-3 space-y-2">
                    {industriesItems.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2 py-1.5 text-sm text-[#52667A] hover:text-[#0E9F8E] font-medium"
                      >
                        <item.icon className="w-4 h-4 text-[#0E9F8E]" />
                        <span>{item.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Capabilities Mobile Group */}
              <div className="border-b border-[#F0F4F8] pb-3">
                <button
                  type="button"
                  onClick={() => toggleMobileGroup('capabilities')}
                  className="w-full flex items-center justify-between py-2 text-base font-bold text-[#102A43] text-start"
                >
                  <span>{labels.capabilities}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      expandedMobileGroup === 'capabilities' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedMobileGroup === 'capabilities' && (
                  <div className="pt-2 ps-3 space-y-2">
                    {capabilitiesItems.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1.5 text-sm text-[#52667A] hover:text-[#0E9F8E] font-medium"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. AI Direct Mobile Link */}
              <div className="border-b border-[#F0F4F8] pb-3">
                <Link
                  href={`/${lang}/ai`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2 text-base font-bold text-[#102A43] hover:text-[#0E9F8E]"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-[#0E9F8E]" />
                    <span>{labels.ai}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180 text-[#7B8A9A]" />
                </Link>
              </div>

              {/* 6. Resources Mobile Group */}
              <div className="border-b border-[#F0F4F8] pb-3">
                <button
                  type="button"
                  onClick={() => toggleMobileGroup('resources')}
                  className="w-full flex items-center justify-between py-2 text-base font-bold text-[#102A43] text-start"
                >
                  <span>{labels.resources}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      expandedMobileGroup === 'resources' ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {expandedMobileGroup === 'resources' && (
                  <div className="pt-2 ps-3 space-y-2">
                    {resourcesItems.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block py-1.5 text-sm text-[#52667A] hover:text-[#0E9F8E] font-medium"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Language Switcher Selector */}
              <div className="pt-2">
                <LanguageSwitcher currentLang={lang} variant="mobile-drawer" />
              </div>

            </div>

            {/* Mobile CTAs (Bottom fixed in drawer) */}
            <div className="pt-6 border-t border-[#E2E8F0] space-y-3 mt-6">
              <Link
                href={`/${lang}/contact`}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-bold bg-[#0E9F8E] text-white hover:bg-[#0C8778] transition shadow-card"
              >
                {labels.startPartnership}
              </Link>
              <Link
                href={`/${lang}/login`}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-bold bg-[#F0F4F8] text-[#102A43] hover:bg-[#E2E8F0] transition"
              >
                {labels.signIn}
              </Link>
            </div>

          </div>
        </div>
      )}
    </header>
  );
};
