import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { FileText, ShieldAlert } from 'lucide-react';




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
  return getRouteMetadata('/terms', params.lang);
}

export default async function TermsPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const lang = params.lang;
  const docDate = getLegalDocumentDate(lang);

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-[#52667A] mb-8 font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Termeni și Condiții' : lang === 'fa' ? 'شرایط و قوانین استفاده' : 'Terms of Service'}
          </span>
        </div>

        <div className="card-proptech p-8 sm:p-12 bg-white space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43]">
                {lang === 'ro' ? 'Termeni și Condiții de Utilizare' : lang === 'fa' ? 'شرایط و قوانین استفاده از خدمات کلادورا' : 'Terms of Service'}
              </h1>
              <p className="text-xs text-[#7B8A9A]">
                {lang === 'ro' ? `Versiunea 1.2 · Actualizat la ${docDate}` : lang === 'fa' ? `نسخه ۱.۲ · آخرین به‌روزرسانی: ${docDate}` : `Version 1.2 · Last updated ${docDate}`}
              </p>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-[#52667A] space-y-4 text-xs sm:text-sm leading-relaxed border-t border-[#F0F4F8] pt-6">
            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? '1. Obiectul Serviciilor' : lang === 'fa' ? '۱. موضوع خدمات' : '1. Service Scope'}
            </h2>
            <p>
              {lang === 'ro'
                ? 'CLADORA pune la dispoziție o platformă software de tip SaaS destinată administrării financiare, tehnice și operaționale a clădirilor rezidențiale, asociațiilor de proprietari și portofoliilor de active imobiliare.'
                : lang === 'fa'
                ? 'کلادورا ارائه‌دهنده پلتفرم ابری (SaaS) مدیریت جامع مالی، فنی و عملیاتی مجتمع‌های مسکونی، انجمن‌های مالکان و سبدهای سرمایه‌گذاری املاک است.'
                : 'CLADORA provides a SaaS operating platform for the financial, technical, and operational administration of condominium associations and residential real estate assets.'}
            </p>

            <h2 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? '2. Conformitate cu Legislația Aplicabilă' : lang === 'fa' ? '۲. انطباق با قوانین و استانداردهای حاکم' : '2. Statutory Compliance'}
            </h2>
            <p>
              {lang === 'ro'
                ? 'Algoritmii de calcul și repartizare a cheltuielilor respectă normele prevăzute de Legea nr. 196/2018. Răspunderea privind exactitatea datelor de intrare (indecși, facturi introduse, număr persoane) revine administratorului sau comitetului executiv al asociației.'
                : lang === 'fa'
                ? 'الگوریتم‌های محاسباتی و تسهیم هزینه‌های کلادورا کاملاً بر مبنای موازین حقوقی، سهم مشاعات و مقررات مربوطه تدوین شده‌اند. صحت داده‌های ورودی اولیّه (ارقام فاکتورها، تعداد نفرات) بر عهده مدیر مجتمع یا متصدی مربوطه است.'
                : 'Allocation formulas align with Romanian Law 196/2018. The association board and designated administrator remain responsible for input data fidelity.'}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
