'use client';

import React, { useState } from 'react';
import { Language } from '@/types';
import { ChevronDown } from 'lucide-react';

interface FaqSectionProps {
  lang: Language;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ lang }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: lang === 'ro' 
        ? 'Cine deține datele asociației și ale proprietarilor?' 
        : lang === 'fa'
        ? 'مالکیت داده‌های مالی و اطلاعات مالکان نزد چه کسی است؟'
        : 'Who owns the association and owner data?',
      a: lang === 'ro' 
        ? 'Asociația de proprietari și utilizatorii individuali sunt proprietarii exclusivi ai datelor lor. CLADORA acționează ca procesator conform GDPR. Poți exporta oricând baza de date completă (jurnale contabile, liste de plată, istoric index contoare) în formate standard deschise.'
        : lang === 'fa'
        ? 'انجمن مالکان و شخص کاربران، مالک انحصاری و ۱۰۰ درصدی داده‌های خود هستند. کلادورا صرفاً پردازشگر امن و منطبق بر استاندارد GDPR است. شما می‌توانید در هر زمان از تمامی دفاتر کل، فیش‌ها و سوابق کنتورها با فرمت‌های استاندارد خروجی بگیرید.'
        : 'The homeowner association and individual owners retain 100% data ownership. CLADORA operates strictly as a GDPR-compliant processor. You can export complete accounting ledgers, statements, and meter histories anytime.'
    },
    {
      q: lang === 'ro' 
        ? 'Cum funcționează migrarea din softul vechi (BlocManager, Xisoft, Excel)?' 
        : lang === 'fa'
        ? 'فرایند انتقال اطلاعات از نرم‌افزارهای قبلی یا اکسل چگونه انجام می‌شود؟'
        : 'How does migration work from legacy software or spreadsheets?',
      a: lang === 'ro'
        ? 'Prin protocolul nostru Shadow Ledger: importăm fișierele existente, generăm reconcilierea automată pentru a identifica eventualele discrepanțe istorice și rulăm în paralel timp de 1-3 luni până când comitetul și cenzorul aprobă comutarea definitivă.'
        : lang === 'fa'
        ? 'از طریق پروتکل اختصاصی Shadow Ledger: فایل‌های قبلی فراخوانی شده، مغایرت‌های تاریخی به صورت خودکار ممیزی می‌شوند و سیستم به مدت ۱ تا ۳ دوره به صورت موازی اجرا می‌گردد تا هیئت‌مدیره و بازرسان از صحت ۱۰۰٪ محاسبات اطمینان یابند.'
        : 'Through our Shadow Ledger protocol: we ingest legacy exports, run automated variance audits to catch historical balance discrepancies, and operate in parallel for 1-3 billing cycles before cutover.'
    },
    {
      q: lang === 'ro' 
        ? 'Poate o singură persoană să aibă mai multe roluri simultan?' 
        : lang === 'fa'
        ? 'آیا یک کاربر می‌تواند هم‌زمان چند نقش مختلف داشته باشد؟'
        : 'Can one person have multiple roles simultaneously?',
      a: lang === 'ro'
        ? 'Da. Arhitectura CLADORA suportă nativ utilizatori multi-rol: aceeași persoană poate fi proprietar într-un bloc, chiriaș în altul, membru în comitet sau administrator pentru un portofoliu de clienți, comutând instant contextul fără a se deconecta.'
        : lang === 'fa'
        ? 'بله. معماری کلادورا کاملاً چندنقشی است: یک حساب کاربری می‌تواند هم‌زمان مالک یک واحد، مستأجر در مجتمعی دیگر و بازرس مالی یک ساختمان باشد و بدون نیاز به خروج، بین این موقعیت‌ها جابه‌جا شود.'
        : 'Yes. CLADORA natively supports multi-role identities: one account can simultaneously manage home residency, rental properties, and board audit responsibilities with seamless context switching.'
    },
    {
      q: lang === 'ro' 
        ? 'Ce văd chiriașii în aplicație? Au acces la datele financiare ale proprietarului?' 
        : lang === 'fa'
        ? 'مستأجران چه اطلاعاتی را مشاهده می‌کنند؟ آیا به ارقام مالی مالک دسترسی دارند؟'
        : 'What do tenants see? Do they have access to owner financials?',
      a: lang === 'ro'
        ? 'Nu. Chiriașii au acces strict limitat la consumul lunar operațional (apă, salubrizare, cote de întreținere curente) și la tichetele de mentenanță. Ei nu au acces la veniturile din chirie, fondul de reparații de capital, datele altor apartamente sau documentele rezervate proprietarului.'
        : lang === 'fa'
        ? 'خیر. دسترسی مستأجران منحصراً به مصارف جاری انشعابات و ثبت تیکت‌های تعمیرات محدود است. اطلاعات صندوق تعمیرات اساسی، مبالغ اجاره، بازده ملک یا سوابق سایر واحدها کاملاً محرمانه باقی می‌ماند.'
        : 'No. Tenants only see day-to-day operational consumption costs and maintenance tickets. Capital reserve funds, rental yields, and private owner ledgers remain strictly confidential.'
    },
    {
      q: lang === 'ro' 
        ? 'Cum funcționează citirea indexului contoarelor prin foto OCR?' 
        : lang === 'fa'
        ? 'استخراج ارقام کنتور با عکس و هوش مصنوعی چگونه کار می‌کند؟'
        : 'How does photo OCR meter reading work?',
      a: lang === 'ro'
        ? 'Locatarii pot fotografia contorul din aplicație, iar algoritmul OCR extrage cifrele indexului și verifică automat dacă consumul se încadrează în marja istorică normală. Administratorul poate revizui oricând fotografia originală înainte de validarea listei de plată.'
        : lang === 'fa'
        ? 'ساکنان از صفحه شمارنده کنتور عکس می‌گیرند؛ هوش مصنوعی ارقام را می‌خواند و در صورت مشاهده جهش ناگهانی اخطار صادر می‌کند. مدیر ساختمان نیز می‌تواند تصویر اصلی را قبل از تأیید نهایی شارژ بررسی نماید.'
        : 'Residents take a photo of the meter via mobile web. AI OCR extracts digits and flags anomalous spikes. Administrators can review the photo proof prior to closing the month.'
    },
    {
      q: lang === 'ro' 
        ? 'Este CLADORA disponibilă ca aplicație mobilă?' 
        : lang === 'fa'
        ? 'آیا کلادورا به صورت اپلیکیشن موبایل قابل استفاده است؟'
        : 'Is CLADORA available as a mobile application?',
      a: lang === 'ro'
        ? 'CLADORA este o aplicație web responsive avansată (PWA-Ready) optimizată pentru orice telefon sau tabletă, permițând salvarea pe ecranul principal fără a fi necesară descărcarea din magazinul de aplicații.'
        : lang === 'fa'
        ? 'کلادورا یک وب‌اپلیکیشن پیش‌رونده (PWA) فوق‌سریع و ریسپانسیو است که روی تمامی گوشی‌های هوشمند و تبلت‌ها بدون نیاز به دانلود از اپ‌استورها اجرا و به صفحه اصلی افزوده می‌شود.'
        : 'CLADORA is a responsive Progressive Web Application (PWA-ready), optimized for iOS and Android browsers with instant home screen install support.'
    }
  ];

  return (
    <section className="py-24 bg-[#F6F9FC] border-b border-[#E2E8F0]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center space-y-3">
          <span className="text-xs font-bold text-[#0A6E62] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Răspunsuri la Întrebări Frecvente' : lang === 'fa' ? 'پاسخ به پرسش‌های پرتکرار' : 'Frequently Asked Questions'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43]">
            {lang === 'ro' ? 'Tot ce trebuie să știi despre CLADORA' : lang === 'fa' ? 'همه چیز درباره سیستم‌عامل کلادورا' : 'Everything You Need to Know'}
          </h2>
          <p className="text-base text-[#52667A]">
            {lang === 'ro' 
              ? 'Întrebări tehnice, legale și operaționale despre tranziția la sistemul de operare CLADORA.'
              : lang === 'fa'
              ? 'پاسخ به پرسش‌های فنی، حقوقی و عملیاتی پیرامون استقرار و بهره‌برداری از سامانه کلادورا.'
              : 'Technical, legal, and operational answers regarding the transition to CLADORA.'}
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="card-proptech bg-white border-[#E2E8F0] overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-start flex items-center justify-between gap-4 font-bold text-[#102A43] hover:text-[#0E9F8E] transition-colors"
                >
                  <span className="text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 shrink-0 text-[#52667A] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0E9F8E]' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#52667A] leading-relaxed border-t border-[#F0F4F8] animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
