import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { UniversalFaqSection } from '@/components/home/UniversalFaqSection';
import { HelpCircle, ArrowRight } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/resources/faq', params.lang);
}

export default async function FaqPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-[#52667A] font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#52667A]">
            {lang === 'ro' ? 'Resurse' : lang === 'fa' ? 'منابع' : 'Resources'}
          </span>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Întrebări Frecvente' : lang === 'fa' ? 'پرسش‌های متداول' : 'FAQ'}
          </span>
        </div>

        {/* Universal FAQ Component */}
        <UniversalFaqSection lang={lang} />

        {/* Help Banner */}
        <div className="card-proptech p-8 bg-white border-[#D3DCE6] text-center max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center mx-auto">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-[#102A43]">
            {lang === 'ro' 
              ? 'Ai o întrebare specifică despre proiectul tău?' 
              : lang === 'fa' 
              ? 'سؤال خاصی درباره مشخصات ملک یا سازمان خود دارید؟' 
              : 'Have a specific question about your property portfolio?'}
          </h3>
          <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Consultanții noștri de integrare te pot ajuta să configurezi structura de Workspace potrivită.'
              : lang === 'fa'
              ? 'کارشناسان ما آماده بررسی دقیق شرایط ملک و راهنمایی شما در تنظیم ساختار Workspace هستند.'
              : 'Our integration specialists are ready to guide you in structuring your workspace profile.'}
          </p>
          <div className="pt-2">
            <Link
              href={`/${lang}/contact`}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-colors shadow-sm"
            >
              <span>{lang === 'ro' ? 'Contactează echipa' : lang === 'fa' ? 'ارسال پیام به تیم پشتیبانی' : 'Contact Support'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
