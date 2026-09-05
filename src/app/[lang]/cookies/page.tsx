import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { Cookie } from 'lucide-react';




import { getLegalDocumentDate } from '@/config/legal';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/cookies', params.lang);
}

export default async function CookiesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;
  const docDate = getLegalDocumentDate(lang);

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex items-center gap-2 text-xs text-[#52667A] mb-8 font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Politica Cookie' : lang === 'fa' ? 'سیاست کوکی‌ها' : 'Cookie Policy'}
          </span>
        </div>

        <div className="card-proptech p-8 sm:p-12 bg-white space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center shrink-0">
              <Cookie className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43]">
                {lang === 'ro' ? 'Politica privind Modulele Cookie' : lang === 'fa' ? 'سیاست استفاده از کوکی‌ها و حافظه مرورگر' : 'Cookie Policy'}
              </h1>
              <p className="text-xs text-[#7B8A9A]">
                {lang === 'ro' ? `Actualizat: ${docDate}` : lang === 'fa' ? `آخرین به‌روزرسانی: ${docDate}` : `Last updated: ${docDate}`}
              </p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-[#52667A] space-y-4 text-xs sm:text-sm leading-relaxed border-t border-[#F0F4F8] pt-6">
            <p>
              {lang === 'ro'
                ? 'CLADORA utilizează module cookie esențiale strict necesare pentru funcționarea platformei, autentificarea utilizatorilor și memorarea preferințelor de limbă (RO/EN/FA). Nu utilizăm cookie-uri de urmărire terță fără consimțământul tău expres.'
                : lang === 'fa'
                ? 'کلادورا صرفاً از کوکی‌های ضروری برای حفظ نشست‌های امن کاربری و ذخیره‌سازی ترجیحات زبانی (فارسی/رومانیایی/انگلیسی) استفاده می‌نماید. ما هیچ‌گونه کوکی ردیابی شخص ثالث بدون رضایت صریح شما فعال نمی‌کنیم.'
                : 'CLADORA uses essential cookies strictly necessary for application authentication and language preferences (RO/EN/FA). We do not deploy third-party trackers without consent.'}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
