import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { ShieldCheck, Lock, FileText } from 'lucide-react';




import { getLegalDocumentDate, getLegalOperatorName } from '@/config/legal';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/privacy', params.lang);
}

export default async function PrivacyPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;
  const docDate = getLegalDocumentDate(lang);
  const operatorName = getLegalOperatorName(lang);

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-[#52667A] mb-8 font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Politica de Confidențialitate' : lang === 'fa' ? 'حفظ حریم خصوصی' : 'Privacy Policy'}
          </span>
        </div>

        <div className="card-proptech p-8 sm:p-12 bg-white space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43]">
                {lang === 'ro' ? 'Politica de Confidențialitate & GDPR' : lang === 'fa' ? 'سیاست حفظ حریم خصوصی و انطباق با مقررات GDPR' : 'Privacy Policy & GDPR Compliance'}
              </h1>
              <p className="text-xs text-[#7B8A9A]">
                {lang === 'ro' ? `Actualizat: ${docDate}` : lang === 'fa' ? `آخرین به‌روزرسانی: ${docDate}` : `Last updated: ${docDate}`}
              </p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-[#52667A] space-y-4 text-xs sm:text-sm leading-relaxed border-t border-[#F0F4F8] pt-6">
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? '1. Angajamentul CLADORA' : lang === 'fa' ? '۱. تعهد بنیادین کلادورا' : '1. CLADORA Commitment'}
            </h2>
            <p>
              {lang === 'ro'
                ? `${operatorName} respectă confidențialitatea utilizatorilor săi și se angajează să protejeze datele cu caracter personal prelucrate prin intermediul platformei în conformitate cu Regulamentul (UE) 2016/679 (GDPR) și legislația aplicabilă din România.`
                : lang === 'fa'
                ? `${operatorName} به حریم خصوصی کلیه کاربران، مالکان و ساکنان احترام کامل می‌گذارد و متعهد به حفاظت از داده‌های شخصی پردازش‌شده در سامانه بر اساس مقررات عمومی حفاظت از داده‌های اتحادیه اروپا (GDPR) است.`
                : `${operatorName} respects your privacy and is committed to protecting personal data processed via our operating platform in accordance with Regulation (EU) 2016/679 (GDPR).`}
            </p>

            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? '2. Calitatea de Procesator vs. Operator de Date' : lang === 'fa' ? '۲. تفکیک نقش پردازشگر داده و کنترل‌کننده' : '2. Data Controller vs. Data Processor'}
            </h2>
            <p>
              {lang === 'ro'
                ? 'Asociația de proprietari sau compania de administrare este Operatorul de Date în ceea ce privește listele de plată, numărul de persoane, cotele și datele imobiliare. CLADORA acționează exclusiv ca Persoană Împuternicită (Data Processor).'
                : lang === 'fa'
                ? 'انجمن مالکان یا شرکت مدیریت ساختمان به عنوان کنترل‌کننده داده‌ها (Data Controller) در خصوص اطلاعات واحدها، ساکنان و فیش‌های شارژ عمل می‌نماید و کلادورا منحصراً در جایگاه پردازشگر امن داده‌ها (Data Processor) فعالیت دارد.'
                : 'The condominium association or property manager acts as the Data Controller regarding tenant lists, unit shares, and statements. CLADORA operates strictly as a Data Processor.'}
            </p>

            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? '3. Izolarea Datelor și Drepturile Utilizatorilor' : lang === 'fa' ? '۳. جداسازی داده‌ها و حقوق قانونی کاربران' : '3. Data Isolation and User Rights'}
            </h2>
            <p>
              {lang === 'ro'
                ? 'Datele financiare ale proprietarilor sunt strict izolate de cele ale chiriașilor. Utilizatorii au dreptul de acces, rectificare, ștergere și export al datelor lor în formate standard deschise.'
                : lang === 'fa'
                ? 'اطلاعات سرمایه‌ای و صندوق‌های مالکان کاملاً از دسترسی مستأجران ایزوله است. کلیه کاربران از حقوق کامل دسترسی، تصحیح، قابلیت انتقال و خروج سوابق خود در فرمت‌های استاندارد برخوردارند.'
                : 'Owner financial ledgers are isolated from tenants. Users maintain full rights of access, rectification, portability, and erasure under GDPR guidelines.'}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
