import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { ShieldCheck, ArrowUpRight, Lock, CheckCircle2 } from 'lucide-react';
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
          
          {/* Brand & Canonical Definition Column */}
          <div className="lg:col-span-2 space-y-4">
            <CladoraBrand variant="reverse" className="h-9 w-auto" />
            
            <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed max-w-sm">
              {lang === 'ro'
                ? 'CLADORA este mediul unificat de colaborare, gestiune și servicii pentru proprietăți, clădiri, unități, spații și active. Rămâne alături de proprietate de la definirea identității sale, prin fazele de pre-vânzare, vânzare, predare-primire, exploatare, mentenanță, servicii, închiriere și tranzacții ulterioare, păstrând continuitatea evidențelor autorizate.'
                : lang === 'fa'
                ? 'CLADORA محیط یکپارچهٔ همکاری، مدیریت و خدمات برای ملک، ساختمان، واحد، فضا و دارایی است. از زمان تعریف و شکل‌گیری هویت یک پروژه یا ملک، در مراحل پیش‌فروش، فروش، تحویل، بهره‌برداری، نگهداری، خدمات، اجاره و معاملات بعدی همراه آن می‌ماند و پیوستگی سوابق مجاز را حفظ می‌کند.'
                : 'CLADORA is the unified environment for collaboration, management, and services across properties, buildings, units, spaces, and physical assets—maintaining authorized record continuity from early pre-sales through operation, leasing, and subsequent transactions.'}
            </p>

            <div className="pt-2 flex items-center gap-2 text-xs text-[#14B8A6] font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>
                {lang === 'ro' 
                  ? 'Separare în Workspace, autoritate pe bază de mandat & evidență auditabilă' 
                  : lang === 'fa'
                  ? 'تفکیک منطقی Workspace، اختیارات مبتنی بر مجوز و سوابق قابل ردیابی'
                  : 'Workspace boundaries, mandate-based authority & auditable records'}
              </span>
            </div>

            {/* Language Switcher in Footer */}
            <div className="pt-3">
              <LanguageSwitcher currentLang={lang} variant="footer" />
            </div>
          </div>

          {/* Solutions by Audience & Typology */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {lang === 'ro' ? 'Soluții & Roluri' : lang === 'fa' ? 'راهکارها و مخاطبان' : 'Solutions & Audiences'}
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/solutions#developers`} className="hover:text-white transition-colors">
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
                  {lang === 'ro' ? 'Asociații de Proprietari' : lang === 'fa' ? 'انجمن‌های مالکان و هیئت‌مدیره' : 'HOAs & Boards'}
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
                <Link href={`/${lang}/solutions#providers`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Furnizori de Servicii' : lang === 'fa' ? 'ارائه‌دهندگان خدمات و تیم‌های فنی' : 'Service Providers'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Core Domains & Services */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {lang === 'ro' ? 'Piloni & Servicii' : lang === 'fa' ? 'خدمات و ارکان پلتفرم' : 'Services & Pillars'}
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/platform`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Platformă & Workspace' : lang === 'fa' ? 'پلتفرم و مدل Workspace' : 'Platform & Workspace'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/airprop`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'AIRPROP — Vânzări & Închirieri' : lang === 'fa' ? 'AIRPROP — معاملات و اجاره' : 'AIRPROP — Sales & Leasing'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/service`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'SERVICE — Cereri & Execuție' : lang === 'fa' ? 'SERVICE — بازار خدمات و سفارش' : 'SERVICE — Marketplace'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/operations`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Operațiuni & Mentenanță' : lang === 'fa' ? 'عملیات و نگهداری دوره‌ای' : 'Operations & Maintenance'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/lifecycle`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Ciclul de Viață al Proprietății' : lang === 'fa' ? 'پیوستگی چرخهٔ عمر ملک' : 'Property Lifecycle'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/trust`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Securitate & Încredere' : lang === 'fa' ? 'امنیت و حفظ محرمانگی' : 'Security & Trust'}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources & Contact */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#93E6DC] uppercase tracking-wider">
              {lang === 'ro' ? 'Resurse & Contact' : lang === 'fa' ? 'راهنما و دسترسی' : 'Resources & Access'}
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-[#CBD5E1]">
              <li>
                <Link href={`/${lang}/resources/faq`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Întrebări Frecvente' : lang === 'fa' ? 'پرسش‌های متداول و راهنما' : 'FAQ & Knowledge Base'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/contact`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Solicită Parteneriat' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Start Partnership'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/login`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Autentificare Workspace' : lang === 'fa' ? 'ورود اعضا به Workspace' : 'Workspace Sign In'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/privacy`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Politica de Confidențialitate' : lang === 'fa' ? 'حفظ حریم خصوصی' : 'Privacy Policy'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/terms`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Termeni & Condiții' : lang === 'fa' ? 'شرایط و مقررات استفاده' : 'Terms of Service'}
                </Link>
              </li>
              <li>
                <Link href={`/${lang}/cookies`} className="hover:text-white transition-colors">
                  {lang === 'ro' ? 'Politica Cookies' : lang === 'fa' ? 'سیاست کوکی‌ها' : 'Cookie Policy'}
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Strip */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9FB3C8]">
          <p>
            © {currentYear} CLADORA. {lang === 'ro' ? 'Toate drepturile rezervate.' : lang === 'fa' ? 'کلیه حقوق محفوظ است.' : 'All rights reserved.'}
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>{lang === 'ro' ? 'Evidență conformă în partidă simplă și control analitic suplimentar.' : lang === 'fa' ? 'ثبت دفاتر قانونی و ابزار کنترل تحلیلی تکمیلی.' : 'Statutory simple-entry records with supplemental analytical control.'}</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
