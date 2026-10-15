import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import { getSiteUrl } from '@/config/site';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { Building2, ShieldCheck, HeartHandshake, ArrowRight } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/about', params.lang);
}

export default async function AboutPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;
  const baseUrl = getSiteUrl();

  const homeLabel = lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home';
  const aboutLabel = lang === 'ro' ? 'Despre Noi' : lang === 'fa' ? 'درباره کلادورا' : 'About CLADORA';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: homeLabel,
        item: `${baseUrl}/${lang}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: aboutLabel,
        item: `${baseUrl}/${lang}/about`,
      },
    ],
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex items-center gap-2 text-xs text-[#52667A] mb-8 font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {homeLabel}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {aboutLabel}
          </span>
        </div>

        <div className="card-proptech p-8 sm:p-12 bg-white space-y-6">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Misiunea Noastră' : lang === 'fa' ? 'ماموریت سازمانی ما' : 'Our Mission'}
          </span>

          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43]">
            {lang === 'ro' 
              ? 'Construim platforma de operare pentru clădiri și comunități de proprietari'
              : lang === 'fa'
              ? 'توسعه پلتفرم جامع عملیات و مدیریت برای ساختمان‌ها و دارایی‌های ملکی'
              : 'Building the Operating Platform for Properties & Built Assets'}
          </h1>

          <div className="text-sm text-[#52667A] leading-relaxed space-y-4 pt-4 border-t border-[#F0F4F8]">
            <p>
              {lang === 'ro'
                ? 'CLADORA a fost fondată pornind de la o realitate evidentă: administrarea proprietăților și a activelor construite suferă adesea din cauza tabelelor Excel fragmentate, a instrumentelor software izolate și a lipsei de transparență dintre administratori, proprietari și ocupanți.'
                : lang === 'fa'
                ? 'کلادورا با درک یک چالش واقعی بنیان نهاده شد: سامانه‌های سنتی مدیریت املاک و مجتمع‌ها غالباً بر پایه فایل‌های اکسل پراکنده، ابزارهای جزیره‌ای و فقدان شفافیت عملیاتی میان مالکان، مدیران و ساکنان استوار بوده‌اند.'
                : 'CLADORA was founded to transform property operations from fragmented spreadsheets and disconnected desktop tools into modern, explainable, and unified software.'}
            </p>
            <p>
              {lang === 'ro'
                ? 'Misiunea noastră este să oferim claritate operațională și transparență financiară pentru activele imobiliare, sprijinind fluxurile de lucru locale conform cadrului Legii 196/2018 și relațiile transparente dintre actori.'
                : lang === 'fa'
                ? 'ماموریت ما ایجاد زیرساختی شفاف و قابل‌اتکا برای حقیقت مالی و عملیاتی املاک، تسهیل گردش‌کارهای منطبق بر موازین قانونی و ارتقای شفافیت میان تمامی ذی‌نفعان است.'
                : 'Our mission is to establish an authoritative, verifiable source of operational and financial truth for property environments, supporting local regulatory workflows and transparent multi-participant governance.'}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
