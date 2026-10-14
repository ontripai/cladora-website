import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { ShieldCheck } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { CladoraBrand } from '@/components/brand/CladoraBrand';

interface FooterProps {
  lang: Language;
}

export const Footer: React.FC<FooterProps> = ({ lang }) => {
  const currentYear = new Date().getFullYear();

  const labels = {
    ro: {
      tagline:
        'CLADORA este mediul unificat de colaborare, gestiune și servicii pentru proprietăți, clădiri, unități, spații și active. Însoțește proprietatea de la pre-vânzare până la exploatare și tranzacții ulterioare, păstrând continuitatea evidențelor autorizate.',
      governance: 'Separare în Workspace, autoritate pe bază de mandat & evidență auditabilă',
      colPlatform: 'Platformă',
      colSolutions: 'Soluții',
      colIndustries: 'Industrii',
      colCapabilities: 'Capabilități',
      colResources: 'Resurse & Legal',
      allRights: 'Toate drepturile rezervate.',
      legalNote: 'Evidență conformă în partidă simplă și control analitic suplimentar.',
    },
    en: {
      tagline:
        'CLADORA is the unified environment for collaboration, management, and services across properties, buildings, units, spaces, and physical assets—maintaining authorized record continuity from pre-sales through operation and subsequent transactions.',
      governance: 'Workspace boundaries, mandate-based authority & auditable records',
      colPlatform: 'Platform',
      colSolutions: 'Solutions',
      colIndustries: 'Industries',
      colCapabilities: 'Capabilities',
      colResources: 'Resources & Legal',
      allRights: 'All rights reserved.',
      legalNote: 'Statutory simple-entry records with supplemental analytical control.',
    },
    fa: {
      tagline:
        'CLADORA محیط یکپارچهٔ همکاری، مدیریت و خدمات برای ملک، ساختمان، واحد، فضا و دارایی است؛ از زمان تعریف و پیش‌فروش تا تحویل، بهره‌برداری، نگهداری و معاملات بعدی، پیوستگی سوابق مجاز را حفظ می‌کند.',
      governance: 'تفکیک منطقی Workspace، اختیارات مبتنی بر مجوز و سوابق قابل ردیابی',
      colPlatform: 'پلتفرم',
      colSolutions: 'راهکارها',
      colIndustries: 'صنایع',
      colCapabilities: 'قابلیت‌ها',
      colResources: 'منابع و قوانین',
      allRights: 'کلیه حقوق محفوظ است.',
      legalNote: 'ثبت دفاتر قانونی و ابزار کنترل تحلیلی تکمیلی.',
    },
  }[lang] || {
    tagline: 'CLADORA is the unified environment for collaboration, management, and services.',
    governance: 'Workspace boundaries & auditable records',
    colPlatform: 'Platform',
    colSolutions: 'Solutions',
    colIndustries: 'Industries',
    colCapabilities: 'Capabilities',
    colResources: 'Resources & Legal',
    allRights: 'All rights reserved.',
    legalNote: 'Statutory compliance and analytical control.',
  };

  return (
    <footer className="bg-[#102A43] text-white pt-16 pb-12 border-t border-[#173F5F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 pb-12 border-b border-[#173F5F]">
          {/* Brand & Canonical Definition Column */}
          <div className="lg:col-span-2 space-y-4">
            <CladoraBrand variant="reverse" className="h-9 w-auto" />
            <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-sm">
              {labels.tagline}
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-[#14B8A6] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{labels.governance}</span>
            </div>
            {/* Language Switcher in Footer */}
            <div className="pt-3">
              <LanguageSwitcher currentLang={lang} variant="footer" />
            </div>
          </div>

          {/* 1. Platform */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {labels.colPlatform}
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/platform`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Prezentare Platformă' : lang === 'fa' ? 'نمای کلی پلتفرم' : 'Platform Overview'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/platform/architecture`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Modelul Workspace' : lang === 'fa' ? 'معماری و مدل ورک‌اسپیس' : 'Workspace Model'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/platform/lifecycle`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Ciclul de Viață' : lang === 'fa' ? 'چرخهٔ عمر دارایی' : 'Property Lifecycle'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/platform/trust`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Securitate & Audit' : lang === 'fa' ? 'امنیت و ممیزی' : 'Trust & Security'}
                </Link>
              </li>
            </ul>
          </div>

          {/* 2. Solutions */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {labels.colSolutions}
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/solutions`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Dezvoltatori & Constructori' : lang === 'fa' ? 'سازندگان و توسعه‌دهندگان' : 'Builders & Developers'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions/property-owners`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Proprietari & Portofolii' : lang === 'fa' ? 'مالکان و صاحبان سبد املاک' : 'Owners & Portfolios'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions/associations`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Asociații de Proprietari' : lang === 'fa' ? 'انجمن‌ها و هیئت‌مدیره' : 'HOAs & Boards'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions/property-managers`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Companii de Administrare' : lang === 'fa' ? 'مدیران مجتمع و شرکت‌ها' : 'Property Managers'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions/tenants`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Chiriași & Rezidenți' : lang === 'fa' ? 'مستأجران و بهره‌برداران' : 'Tenants & Occupants'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Furnizori de Servicii' : lang === 'fa' ? 'ارائه‌دهندگان خدمات' : 'Service Providers'}
                </Link>
              </li>
            </ul>
          </div>

          {/* 3. Industries & Capabilities */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {labels.colIndustries} & {labels.colCapabilities}
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/industries`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Arhitectura Industriilor' : lang === 'fa' ? 'معماری صنایع' : 'Industries Architecture'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/capabilities`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Arhitectura Capabilităților' : lang === 'fa' ? 'معماری قابلیت‌ها' : 'Capabilities Architecture'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/airprop`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'AIRPROP — Tranzacții' : lang === 'fa' ? 'ایرپراپ — معاملات' : 'AIRPROP Transactions'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/service`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'SERVICE — Operațiuni' : lang === 'fa' ? 'سرویس — عملیات' : 'SERVICE Marketplace'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/ai`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Inteligență Ghidată (AI)' : lang === 'fa' ? 'هوش عملیاتی (AI)' : 'Governed AI'}
                </Link>
              </li>
            </ul>
          </div>

          {/* 4. Resources & Legal */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {labels.colResources}
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/resources`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Centru de Resurse' : lang === 'fa' ? 'مرکز منابع' : 'Resources Center'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/resources/faq`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Întrebări Frecvente' : lang === 'fa' ? 'پرسش‌های متداول' : 'FAQ'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/migration`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Ghid de Migrare' : lang === 'fa' ? 'راهنمای مهاجرت' : 'Migration Guide'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/privacy`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Confidențialitate' : lang === 'fa' ? 'حفظ حریم خصوصی' : 'Privacy Policy'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/terms`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Termeni & Condiții' : lang === 'fa' ? 'شرایط و مقررات' : 'Terms of Service'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/cookies`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Politica Cookies' : lang === 'fa' ? 'سیاست کوکی‌ها' : 'Cookie Policy'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/contact`} className="hover:text-white transition-colors text-[#0E9F8E] font-semibold">
                  {lang === 'ro' ? 'Solicită Parteneriat' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Start Partnership'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/login`} className="hover:text-white transition-colors text-slate-300">
                  {lang === 'ro' ? 'Autentificare' : lang === 'fa' ? 'ورود اعضا' : 'Sign In'}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9FB3C8]">
          <p>
            © {currentYear} CLADORA. {labels.allRights}
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>{labels.legalNote}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
