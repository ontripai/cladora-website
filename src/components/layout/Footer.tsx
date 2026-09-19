import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { CladoraBrand } from '@/components/brand/CladoraBrand';

interface FooterProps {
  lang: Language;
}

export const Footer: React.FC<FooterProps> = ({ lang }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#102A43] text-white pt-16 pb-12 border-t border-[#173F5F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[#173F5F]">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <CladoraBrand variant="reverse" className="h-9 w-auto" />
            
            <p className="text-sm text-[#CBD5E1] leading-relaxed max-w-sm">
              {lang === 'ro'
                ? 'Sistemul de operare pentru active rezidențiale. Unifică registrele statutare în partidă simplă, Legea 196/2018, controlul analitic în partidă dublă, drepturile proprietar-chiriaș și citirea contoarelor într-un singur adevăr financiar.'
                : lang === 'fa'
                ? 'سیستم‌عامل یکپارچه مدیریت دارایی‌های مسکونی. اتصال دفاتر قانونی یک‌طرفه (قانون ۱۹۶/۲۰۱۸)، کنترل تحلیلی تکمیلی دوطرفه، تفکیک حقوق مالک و مستأجر و قرائت کنتورها.'
                : 'The residential asset operating system. Unifying statutory simple-entry accounting under Law 196/2018, supplemental double-entry ledger controls, 5D owner-tenant rights, and meter readings.'}
            </p>

            <div className="pt-2 flex items-center gap-2 text-xs text-[#14B8A6] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span>
                {lang === 'ro' 
                  ? 'Creat pentru piața rezidențială din România' 
                  : lang === 'fa'
                  ? 'طراحی‌شده برای املاک مسکونی رومانی و چارچوب قانونی ۱۹۶/۲۰۱۸'
                  : 'Engineered for Romanian Residential Real Estate & Statutory Compliance'}
              </span>
            </div>

            {/* Language Switcher in Footer */}
            <div className="pt-3">
              <LanguageSwitcher currentLang={lang} variant="footer" />
            </div>
          </div>

          {/* Solutions Column */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {lang === 'ro' ? 'Soluții pe Roluri' : lang === 'fa' ? 'راهکارها بر اساس نقش' : 'Solutions by Role'}
            </div>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/solutions/associations`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Asociații de Proprietari' : lang === 'fa' ? 'انجمن‌های مالکان' : 'Homeowner Associations'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions/property-owners`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Proprietari Portofoliu' : lang === 'fa' ? 'مالکان سبد املاک' : 'Portfolio Landlords'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions/property-managers`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Companii de Administrare' : lang === 'fa' ? 'شرکت‌های مدیریت املاک' : 'Property Managers'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions/residents`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Proprietari & Rezidenți' : lang === 'fa' ? 'مالکان و ساکنان' : 'Owners & Residents'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/solutions/tenants`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Chiriași (Consum & Tichete)' : lang === 'fa' ? 'پرتال مستأجران' : 'Tenants Portal'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform & Modules Column */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {lang === 'ro' ? 'Platformă & Module' : lang === 'fa' ? 'پلتفرم و ماژول‌ها' : 'Platform & Modules'}
            </div>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/platform`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Arhitectura Platformei' : lang === 'fa' ? 'معماری جامع پلتفرم' : 'Platform Architecture'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/modules`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Toate cele 17 Module (C01-C17)' : lang === 'fa' ? 'کلیه ۱۷ ماژول سیستمی' : 'All 17 Modules (C01-C17)'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/migration`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Protocolul Shadow Ledger' : lang === 'fa' ? 'پروتکل مهاجرت سوابق' : 'Shadow Ledger Migration'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/pricing`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Prețuri Pilot & Calculator' : lang === 'fa' ? 'تعرفه‌ها و محاسبه‌گر' : 'Pilot Pricing Calculator'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/demo`} className="hover:text-white transition-colors flex items-center gap-1">
                  <span>{lang === 'ro' ? 'Mediu Demonstrativ Public' : lang === 'fa' ? 'دموی تعاملی سندباکس' : 'Public Demo Sandbox'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#14B8A6]" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources & Legal Column */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {lang === 'ro' ? 'Resurse & Conformitate' : lang === 'fa' ? 'منابع و امنیت' : 'Resources & Trust'}
            </div>
            <ul className="space-y-2 text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/resources/faq`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Întrebări Frecvente (FAQ)' : lang === 'fa' ? 'پرسش‌های متداول (FAQ)' : 'Frequently Asked Questions'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/security`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Securitate & Izolare Date' : lang === 'fa' ? 'امنیت و جداسازی داده‌ها' : 'Security & Data Isolation'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/privacy`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Politica de Confidențialitate (GDPR)' : lang === 'fa' ? 'حفظ حریم خصوصی (GDPR)' : 'Privacy Policy (GDPR)'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/terms`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Termeni și Condiții' : lang === 'fa' ? 'شرایط و قوانین استفاده' : 'Terms of Service'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/accessibility`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Declarație Accesibilitate (WCAG)' : lang === 'fa' ? 'بیانیه دسترس‌پذیری (WCAG)' : 'Accessibility Statement'}
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Legal Disclaimer & Regulatory Note */}
        <div className="py-6 text-xs text-[#9FB3C8] leading-relaxed border-b border-[#173F5F]">
          <p>
            {lang === 'ro'
              ? 'Notă legală și metodologică: Estimările de economii și calculele de randament sunt orientative și depind de specificul clădirii, starea instalațiilor, istoricul de consum și calitatea datelor importate. Algoritmii de repartizare a cheltuielilor sunt proiectați în conformitate cu prevederile Legii nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari și administrarea condominiilor din România. Funcționalitatea de migrare Shadow Ledger este concepută pentru a identifica discrepanțele înainte de trecerea operațională efectivă.'
              : lang === 'fa'
              ? 'یادداشت حقوقی و روش‌شناسی: نسخه فارسی برای سهولت مطالعه ارائه شده است. در صورت بروز اختلاف تفسیری، متن حقوقی مصوب برای بازار رومانی و نسخه قراردادی مورد تأیید ملاک خواهد بود. برآوردهای مالی و صرفه‌جویی جنبه ارشادی دارند و به شرایط ساختمان، قراردادها و داده‌های ورودی وابسته هستند. الگوریتم‌های تسهیم شارژ بر مبنای استانداردهای قانون ۱۹۶/۲۰۱۸ رومانی طراحی شده‌اند و دفتر کل موازی (Shadow Ledger) جهت شناسایی و رفع مغایرت‌های پیشین پیش از استقرار قطعی عمل می‌کند.'
              : 'Legal & methodological disclaimer: Savings estimates and yield projections are indicative and subject to building conditions, contract terms, consumption patterns, and data fidelity. Allocation algorithms are designed to support Romanian Law 196/2018 for condominium management. Shadow Ledger migration is designed to identify historical accounting discrepancies prior to cutover.'}
          </p>
        </div>

        {/* Bottom Strip */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9FB3C8]">
          <div>
            © {currentYear} CLADORA Technologies. {lang === 'ro' ? 'Toate drepturile rezervate.' : lang === 'fa' ? 'تمامی حقوق برای کلادورا محفوظ است.' : 'All rights reserved.'}
          </div>
          <div className="flex items-center gap-6">
            <Link href={`/${lang}/privacy`} className="hover:text-white transition-colors">
              {lang === 'ro' ? 'Confidențialitate' : lang === 'fa' ? 'حریم خصوصی' : 'Privacy'}
            </Link>
            <Link href={`/${lang}/terms`} className="hover:text-white transition-colors">
              {lang === 'ro' ? 'Termeni' : lang === 'fa' ? 'قوانین' : 'Terms'}
            </Link>
            <Link href={`/${lang}/cookies`} className="hover:text-white transition-colors">
              {lang === 'ro' ? 'Cookies' : lang === 'fa' ? 'کوکی‌ها' : 'Cookies'}
            </Link>
            <Link href={`/${lang}/accessibility`} className="hover:text-white transition-colors">
              {lang === 'ro' ? 'Accesibilitate' : lang === 'fa' ? 'دسترس‌پذیری' : 'Accessibility'}
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
};
