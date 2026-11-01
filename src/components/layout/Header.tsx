'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Language } from '@/types';
import {
  Building2,
  Layers,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  TrendingUp,
  KeyRound,
  Sparkles,
  Briefcase,
  Wrench,
  Building,
  Users
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
  const [activeDropdown, setActiveDropdown] = useState<'solutions' | 'services' | null>(null);

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

  // Close on Escape key
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

  const toggleDropdown = (name: 'solutions' | 'services') => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const solutionsAudiences = [
    {
      title: lang === 'ro' ? 'Dezvoltatori & Constructori' : lang === 'fa' ? 'سازندگان و عرضه‌کنندگان ملک' : 'Developers & Builders',
      desc: lang === 'ro' ? 'Identitate inițială, pre-vânzare, documente tehnice și protocol de predare' : lang === 'fa' ? 'تعریف اولیه هویت پروژه، ارتباط پیش‌فروش، اسناد و تحویل واحدها' : 'Property identity, pre-sales tracking, document vault, and handover',
      href: `/${lang}/solutions/developers`,
      icon: Building,
      badge: lang === 'ro' ? 'Pre-vânzare & Predare' : lang === 'fa' ? 'پیش‌فروش و تحویل' : 'Pre-sale & Handover'
    },
    {
      title: lang === 'ro' ? 'Proprietari & Portofolii' : lang === 'fa' ? 'مالکان و صاحبان سبد املاک' : 'Owners & Portfolio Landlords',
      desc: lang === 'ro' ? 'Urmărire consolidată pe mai multe clădiri, chirii, costuri și randamente' : lang === 'fa' ? 'پایش تجمیعی املاک در ساختمان‌های مختلف، وصول اجاره و بازده خالص' : 'Consolidated tracking across buildings, rents, expenses, and asset value',
      href: `/${lang}/solutions/property-owners`,
      icon: TrendingUp,
      badge: lang === 'ro' ? 'Multi-imobil' : lang === 'fa' ? 'چندملکی' : 'Multi-Property'
    },
    {
      title: lang === 'ro' ? 'Asociații de Proprietari' : lang === 'fa' ? 'انجمن‌های مالکان و هیئت‌مدیره' : 'HOAs & Residential Boards',
      desc: lang === 'ro' ? 'Conformitate legală, cote clare, adunări generale și transparență' : lang === 'fa' ? 'محاسبه دقیق سهم شارژ، برگزاری مجامع، صورت‌های مالی و شفافیت' : 'Statutory allocations, general meetings, payment lists, and governance',
      href: `/${lang}/solutions/associations`,
      icon: Building2,
      badge: lang === 'ro' ? 'Guvernanță' : lang === 'fa' ? 'مدیریت و شفافیت' : 'Governance'
    },
    {
      title: lang === 'ro' ? 'Companii de Administrare' : lang === 'fa' ? 'مدیران مجتمع و شرکت‌های مدیریت' : 'Property & Estate Managers',
      desc: lang === 'ro' ? 'Gestiune multi-clădire, contracte de servicii, SLA și mentenanță' : lang === 'fa' ? 'مدیریت چندمجموعه‌ای، قراردادهای خدمات، نظارت بر نگهداری و تسویه' : 'Multi-building operations, vendor contracts, SLAs, and facilities',
      href: `/${lang}/solutions/property-managers`,
      icon: Layers,
      badge: lang === 'ro' ? 'Operațiuni' : lang === 'fa' ? 'عملیات و قراردادها' : 'Operations'
    },
    {
      title: lang === 'ro' ? 'Rezidenți & Ocupanți' : lang === 'fa' ? 'ساکنان و بهره‌برداران' : 'Residents & Occupants',
      desc: lang === 'ro' ? 'Vizualizare consumuri proprii, solicitări de service și notificări' : lang === 'fa' ? 'شفافیت در مصارف و هزینه‌ها، ثبت نیازهای خدماتی بدون دسترسی به اسناد مالک' : 'Personal consumption transparency, service requests, and notices',
      href: `/${lang}/solutions/residents`,
      icon: KeyRound,
      badge: lang === 'ro' ? 'Servicii Zilnice' : lang === 'fa' ? 'خدمات روزمره' : 'Daily Living'
    },
    {
      title: lang === 'ro' ? 'Furnizori de Servicii' : lang === 'fa' ? 'ارائه‌دهندگان خدمات و تیم‌های فنی' : 'Service Providers & Vendors',
      desc: lang === 'ro' ? 'Primire comenzi de lucru, transmitere devize, execuție și recepție' : lang === 'fa' ? 'دریافت دستورکار، ارائه پیشنهاد قیمت، ثبت اجرای کار و پذیرش رسمی' : 'Work orders, quotes, dispatch tracking, verified acceptance, and logs',
      href: `/${lang}/solutions/service-providers`,
      icon: Wrench,
      badge: lang === 'ro' ? 'Recepție Servicii' : lang === 'fa' ? 'پذیرش و تسویه' : 'Work Orders'
    }
  ];

  const servicesList = [
    {
      title: 'AIRPROP',
      subtitle: lang === 'ro' ? 'Vânzare, Închiriere & Tranzacții' : lang === 'fa' ? 'عرضه، خرید، پیش‌فروش، فروش و اجاره' : 'Property Sales, Pre-sale & Leasing',
      desc: lang === 'ro'
        ? 'Prezentarea proprietății, gestionarea oportunităților, verificare documente, rezervări, pre-vânzări, închirieri și mandat de administrare.'
        : lang === 'fa'
        ? 'معرفی و عرضه ملک، متقاضیان و فرصت‌ها، بررسی شرایط و اسناد، رزرو، پیش‌فروش، اجاره و واگذاری مدیریت با انتقال امن به بهره‌برداری.'
        : 'Property showcase, verified inquiries, underwriting, reservations, sales, leasing, and property management mandates.',
      href: `/${lang}/airprop`,
      icon: Sparkles,
      color: 'text-amber-600 bg-amber-50 border-amber-200'
    },
    {
      title: 'SERVICE',
      subtitle: lang === 'ro' ? 'Catalog, Cereri, Ofertare & Recepție' : lang === 'fa' ? 'کاتالوگ خدمات، سفارش، نظارت و پذیرش' : 'Service Catalog, Quotes & Verification',
      desc: lang === 'ro'
        ? 'Alegerea serviciilor, lansarea cererii, compararea ofertelor de cost și termen, urmărirea execuției și atașarea rezultatului la istoricul activului.'
        : lang === 'fa'
        ? 'انتخاب خدمات، ثبت نیاز، دریافت و مقایسه پیشنهادها، توافق بر دامنه و هزینه، پیگیری اجرا، پذیرش نتیجه و ثبت سابقه روی دارایی.'
        : 'Service catalog, request brief, quote comparison, scope/cost agreement, execution tracking, sign-off, and permanent asset history.',
      href: `/${lang}/service`,
      icon: Briefcase,
      color: 'text-teal-600 bg-teal-50 border-teal-200'
    },
    {
      title: lang === 'ro' ? 'Operațiuni & Mentenanță' : lang === 'fa' ? 'عملیات فنی و نگهداری دوره‌ای' : 'Operations & Maintenance',
      subtitle: lang === 'ro' ? 'Active tehnice, planuri preventive & tichete' : lang === 'fa' ? 'تجهیزات، برنامه‌ریزی دوره‌ای و دستورکار' : 'Asset registry, preventive plans & work orders',
      desc: lang === 'ro'
        ? 'Evidența echipamentelor, calendare de revizie periodică, semnalare defecțiuni, comenzi de lucru și rapoarte de service pentru persoanele autorizate.'
        : lang === 'fa'
        ? 'ثبت و ردیابی تجهیزات و دارایی‌ها، نگهداری دوره‌ای، اعلام خرابی، دستورکار با مسئول اجرا، سوابق سرویس و مدارک هزینه.'
        : 'Asset equipment registries, recurring maintenance schedules, breakdown reporting, work orders, service logs, and auditable history.',
      href: `/${lang}/operations`,
      icon: Wrench,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      title: 'CE',
      subtitle: lang === 'ro' ? 'Comunitate & Experiență' : lang === 'fa' ? 'جامعه و تجربه' : 'Community & Experience',
      desc: lang === 'ro'
        ? 'Experiență de locuire, viață comunitară, ghiduri de spațiu, facilități și comunicare contextuală ancorată în identitatea proprietății.'
        : lang === 'fa'
        ? 'تجربه سکونت، زندگی اجتماعی، راهنمای فضاها و مشاعات، امکانات رفاهی و ارتباطات مستقیم با ساکنان بر پایگاه امن ملک.'
        : 'Resident living experience, community life, amenity booking, localized space guides, and contextual property communications.',
      href: `/${lang}/community-experience`,
      icon: Users,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
    }
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-[#E2E8F0] py-3'
          : 'bg-white/80 backdrop-blur-sm border-b border-[#F0F4F8] py-4'
      }`}
    >
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">

          {/* Brand Logo */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              href={`/${lang}`}
              className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] rounded-lg"
              aria-label={lang === 'ro' ? 'CLADORA Acasă' : lang === 'fa' ? 'صفحه اصلی کلادورا' : 'CLADORA Home'}
            >
              <CladoraBrand variant="primary" className="h-6 sm:h-8 w-auto max-w-[130px] sm:max-w-none shrink-0" />
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-semibold text-[#334E68]"
            ref={dropdownRef}
            aria-label={lang === 'ro' ? 'Navigare principală' : lang === 'fa' ? 'ناوبری اصلی' : 'Main Navigation'}
          >

            {/* 1. Platform & Workspace */}
            <Link
              href={`/${lang}/platform`}
              className={`px-3 py-2 rounded-lg hover:text-[#102A43] hover:bg-[#F0F4F8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                pathname?.includes(`/${lang}/platform`) && !pathname?.includes(`/${lang}/platform/lifecycle`) ? 'text-[#0E9F8E] font-bold bg-[#EAF8F5]' : ''
              }`}
            >
              {lang === 'ro' ? 'Platformă & Workspace' : lang === 'fa' ? 'پلتفرم و Workspace' : 'Platform & Workspace'}
            </Link>

            {/* 2. Solutions Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('solutions')}
                aria-expanded={activeDropdown === 'solutions'}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg hover:text-[#102A43] hover:bg-[#F0F4F8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                  activeDropdown === 'solutions' || pathname?.includes(`/${lang}/solutions`)
                    ? 'text-[#0E9F8E] font-bold bg-[#EAF8F5]'
                    : ''
                }`}
              >
                <span>{lang === 'ro' ? 'Soluții' : lang === 'fa' ? 'راهکارها' : 'Solutions'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'solutions' ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {activeDropdown === 'solutions' && (
                <div
                  role="menu"
                  className={`absolute top-full mt-2 w-[540px] p-4 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] grid grid-cols-2 gap-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${lang === 'fa' ? 'right-0' : 'left-0'}`}
                >
                  <div className="col-span-2 pb-2 mb-1 border-b border-[#F0F4F8] flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#627D98]">
                      {lang === 'ro' ? 'Pe roluri & tipuri de proprietate' : lang === 'fa' ? 'بر اساس مخاطب و نوع ملک' : 'By Audience & Property Type'}
                    </span>
                    <Link
                      href={`/${lang}/solutions`}
                      role="menuitem"
                      onClick={() => setActiveDropdown(null)}
                      className="text-xs font-bold text-[#0E9F8E] hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0E9F8E] rounded"
                    >
                      <span>{lang === 'ro' ? 'Vezi toate soluțiile' : lang === 'fa' ? 'نمای کلی راهکارها' : 'View all solutions'}</span>
                      <ArrowRight className="w-3 h-3 rtl:rotate-180" aria-hidden="true" />
                    </Link>
                  </div>
                  {solutionsAudiences.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={idx}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setActiveDropdown(null)}
                        className="p-2.5 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 rounded-lg bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center group-hover:bg-[#0E9F8E] group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <span className="font-bold text-xs text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#627D98] line-clamp-2 leading-relaxed">
                          {item.desc}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Services Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleDropdown('services')}
                aria-expanded={activeDropdown === 'services'}
                aria-haspopup="true"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg hover:text-[#102A43] hover:bg-[#F0F4F8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                  activeDropdown === 'services' || pathname?.includes(`/${lang}/airprop`) || pathname?.includes(`/${lang}/service`) || pathname?.includes(`/${lang}/operations`) || pathname?.includes(`/${lang}/community-experience`)
                    ? 'text-[#0E9F8E] font-bold bg-[#EAF8F5]'
                    : ''
                }`}
              >
                <span>{lang === 'ro' ? 'Servicii & Module' : lang === 'fa' ? 'خدمات و ارکان' : 'Services & Domains'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'services' ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {activeDropdown === 'services' && (
                <div
                  role="menu"
                  className={`absolute top-full mt-2 w-[440px] p-3 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] space-y-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${lang === 'fa' ? 'right-0' : 'left-0'}`}
                >
                  <div className="pb-1.5 px-2 border-b border-[#F0F4F8]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#627D98]">
                      {lang === 'ro' ? 'Domenii Operaționale Integrate' : lang === 'fa' ? 'حوزه‌های عملیاتی متصل' : 'Connected Operational Domains'}
                    </span>
                  </div>
                  {servicesList.map((svc, idx) => {
                    const Icon = svc.icon;
                    return (
                      <Link
                        key={idx}
                        href={svc.href}
                        role="menuitem"
                        onClick={() => setActiveDropdown(null)}
                        className="p-3 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-all flex items-start gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
                      >
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${svc.color}`}>
                          <Icon className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                              {svc.title}
                            </span>
                            <span className="text-[10px] text-[#627D98] font-medium">
                              {svc.subtitle}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#627D98] mt-0.5 line-clamp-2 leading-relaxed">
                            {svc.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Property Lifecycle */}
            <Link
              href={`/${lang}/platform/lifecycle`}
              className={`px-3 py-2 rounded-lg hover:text-[#102A43] hover:bg-[#F0F4F8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                pathname?.includes(`/${lang}/platform/lifecycle`) ? 'text-[#0E9F8E] font-bold bg-[#EAF8F5]' : ''
              }`}
            >
              {lang === 'ro' ? 'Ciclul de Viață' : lang === 'fa' ? 'چرخهٔ عمر ملک' : 'Property Lifecycle'}
            </Link>

            {/* 5. Resources & Guides */}
            <Link
              href={`/${lang}/resources`}
              className={`px-3 py-2 rounded-lg hover:text-[#102A43] hover:bg-[#F0F4F8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E] ${
                pathname?.includes(`/${lang}/resources`) ? 'text-[#0E9F8E] font-bold bg-[#EAF8F5]' : ''
              }`}
            >
              {lang === 'ro' ? 'Ghid & Resurse' : lang === 'fa' ? 'راهنما و منابع' : 'Guides & Resources'}
            </Link>
          </nav>

          {/* Right Action Bar */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language Switcher */}
            <LanguageSwitcher currentLang={lang} variant="header" />

            {/* Sign In Button */}
            <Link
              href={`/${lang}/login`}
              className="px-3.5 py-2 text-xs font-bold text-[#102A43] hover:text-[#0E9F8E] hover:bg-[#F0F4F8] rounded-xl transition-colors border border-transparent hover:border-[#D3DCE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              {lang === 'ro' ? 'Autentificare' : lang === 'fa' ? 'ورود' : 'Sign In'}
            </Link>

            {/* Start Partnership CTA */}
            <Link
              href={`/${lang}/contact`}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl shadow-sm transition-all hover:shadow hover:-translate-y-0.5 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>{lang === 'ro' ? 'Solicită Parteneriat' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Start Partnership'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher currentLang={lang} variant="header" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#334E68] hover:text-[#102A43] hover:bg-[#F0F4F8] rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
              aria-label={mobileMenuOpen ? (lang === 'fa' ? 'بستن منو' : lang === 'ro' ? 'Închide meniul' : 'Close menu') : (lang === 'fa' ? 'باز کردن منو' : lang === 'ro' ? 'Deschide meniul' : 'Open menu')}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E2E8F0] bg-white px-4 pt-3 pb-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <nav
            className="flex flex-col space-y-1"
            aria-label={lang === 'ro' ? 'Navigare mobilă' : lang === 'fa' ? 'ناوبری موبایل' : 'Mobile Navigation'}
          >
            <Link
              href={`/${lang}/platform`}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-sm font-bold text-[#102A43] hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              {lang === 'ro' ? 'Platformă & Workspace' : lang === 'fa' ? 'پلتفرم و Workspace' : 'Platform & Workspace'}
            </Link>

            <Link
              href={`/${lang}/solutions`}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-sm font-bold text-[#102A43] hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              {lang === 'ro' ? 'Soluții pe Roluri & Tipuri de Proprietate' : lang === 'fa' ? 'راهکارها بر اساس نقش و نوع ملک' : 'Solutions & Audiences'}
            </Link>

            <div className="px-3 py-2 text-xs font-bold text-[#627D98] uppercase tracking-wider">
              {lang === 'ro' ? 'Servicii & Module' : lang === 'fa' ? 'خدمات و ارکان محصول' : 'Services & Domains'}
            </div>

            <Link
              href={`/${lang}/airprop`}
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#334E68] hover:bg-[#F8FAFC] flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>AIRPROP — {lang === 'ro' ? 'Vânzări & Închirieri' : lang === 'fa' ? 'عرضه، فروش و اجاره' : 'Sales & Leasing'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#627D98] rtl:rotate-180" aria-hidden="true" />
            </Link>

            <Link
              href={`/${lang}/service`}
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#334E68] hover:bg-[#F8FAFC] flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>SERVICE — {lang === 'ro' ? 'Cereri & Ofertare' : lang === 'fa' ? 'سفارش و نظارت بر خدمات' : 'Quotes & Execution'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#627D98] rtl:rotate-180" aria-hidden="true" />
            </Link>

            <Link
              href={`/${lang}/operations`}
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#334E68] hover:bg-[#F8FAFC] flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>{lang === 'ro' ? 'Operațiuni & Mentenanță' : lang === 'fa' ? 'عملیات فنی و نگهداری' : 'Operations & Maintenance'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#627D98] rtl:rotate-180" aria-hidden="true" />
            </Link>

            <Link
              href={`/${lang}/community-experience`}
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#334E68] hover:bg-[#F8FAFC] flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>CE — {lang === 'ro' ? 'Comunitate & Experiență' : lang === 'fa' ? 'جامعه و تجربه' : 'Community & Experience'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#627D98] rtl:rotate-180" aria-hidden="true" />
            </Link>

            <Link
              href={`/${lang}/platform/lifecycle`}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-sm font-bold text-[#102A43] hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              {lang === 'ro' ? 'Ciclul de Viață al Proprietății' : lang === 'fa' ? 'چرخهٔ عمر ملک' : 'Property Lifecycle'}
            </Link>

            <Link
              href={`/${lang}/resources`}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 rounded-xl text-sm font-bold text-[#102A43] hover:bg-[#F0F4F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              {lang === 'ro' ? 'Ghid & Resurse' : lang === 'fa' ? 'راهنما و منابع' : 'Guides & Resources'}
            </Link>
          </nav>

          <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
            <Link
              href={`/${lang}/login`}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-bold text-[#102A43] bg-[#F0F4F8] hover:bg-[#E2E8F0] rounded-xl block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              {lang === 'ro' ? 'Autentificare în Workspace' : lang === 'fa' ? 'ورود به محیط کاری' : 'Sign In to Workspace'}
            </Link>

            <Link
              href={`/${lang}/contact`}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl block shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>{lang === 'ro' ? 'Solicită Începerea Colaborării' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Start Partnership Inquiry'}</span>
            </Link>

            <div className="pt-2">
              <LanguageSwitcher currentLang={lang} variant="mobile-drawer" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
