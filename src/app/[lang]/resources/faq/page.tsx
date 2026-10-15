import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
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

export default async function ResourcesFaqRedirectPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-center">
        {/* Breadcrumbs */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#52667A] font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home'}
          </Link>
          <span>/</span>
          <Link href={`/${lang}/resources`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Resurse' : lang === 'fa' ? 'منابع' : 'Resources'}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">FAQ</span>
        </div>

        {/* Content Box */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#E2E8F0] shadow-card space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center mx-auto">
            <HelpCircle className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A43]">
            {lang === 'ro'
              ? 'Centrul Canonic de Întrebări Frecvente'
              : lang === 'fa'
              ? 'مرکز رسمی پرسش‌های متداول'
              : 'Canonical Frequently Asked Questions Center'}
          </h1>

          <p className="text-sm sm:text-base text-[#52667A] leading-relaxed max-w-xl mx-auto">
            {lang === 'ro'
              ? 'Secțiunea completă de întrebări și răspunsuri arhitecturale este acum găzduită canonic la adresa dedicată /faq.'
              : lang === 'fa'
              ? 'مجموعه کامل پرسش‌ها و پاسخ‌های معماری اکنون در آدرس مرجع /faq در دسترس است.'
              : 'Our complete architectural questions and answers library is canonically maintained at our dedicated /faq center.'}
          </p>

          <div className="pt-4">
            <Link
              href={`/${lang}/faq`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0E9F8E] text-white text-sm font-bold hover:bg-[#0C8778] transition shadow-card"
            >
              <span>
                {lang === 'ro'
                  ? 'Accesează FAQ Canonic'
                  : lang === 'fa'
                  ? 'مشاهده پرسش‌های متداول در /faq'
                  : 'Go to Canonical FAQ'}
              </span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
