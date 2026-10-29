'use client';

import React, { useState } from 'react';
import { Language } from '@/types';
import { ChevronDown, HelpCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface UniversalFaqSectionProps {
  lang: Language;
}

export const UniversalFaqSection: React.FC<UniversalFaqSectionProps> = ({ lang }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: lang === 'ro'
        ? 'Care este diferența dintre Clădire, Spațiul de Lucru (Workspace) și Utilizatori?'
        : lang === 'fa'
        ? 'تفاوت بین «ساختمان»، «فضای کاری (Workspace)» و «کاربران» چیست؟'
        : 'What is the difference between a Building, a Workspace, and a User?',
      a: lang === 'ro'
        ? 'Clădirea reprezintă imobilul fizic (blocul, apartamentele, spațiile comune și echipamentele tehnice) care rămâne stabil în timp. Spațiul de Lucru (Workspace) este mediul dedicat al asociației sau al firmei de administrare, unde se păstrează documentele interne și evidențele de lucru. Utilizatorii sunt persoanele fizice (proprietari, administratori, locatari) care au acces în baza rolului și autorizării lor active.'
        : lang === 'fa'
        ? 'ساختمان همان بستر فیزیکی (مجتمع، واحدها، فضاهای مشاع و تجهیزات) است که پایدار می‌ماند. فضای کاری (Workspace) محیط عملیاتی اختصاصی هر انجمن یا شرکت مدیریت برای نگهداری سوابق و دفاتر کاری است. کاربران نیز اشخاص حقیقی (مالکان، مدیران و ساکنان) هستند که متناسب با نقش و مجوز معتبر خود دسترسی دارند.'
        : 'The Building is the physical property (apartments, commercial units, shared spaces, and equipment). The Workspace is the dedicated operational environment for an association or management firm where internal records and accounts are maintained. Users are individual people (owners, managers, residents) who access permitted sections based on their active role.'
    },
    {
      q: lang === 'ro'
        ? 'Pot folosi un singur cont dacă am mai multe apartamente sau roluri diferite?'
        : lang === 'fa'
        ? 'آیا با یک حساب کاربری می‌توان در چند ساختمان یا با چند نقش فعالیت کرد؟'
        : 'Can I use one account if I have multiple units or different roles?',
      a: lang === 'ro'
        ? 'Da. Folosești un singur cont de utilizator și poți comuta dintr-un clic între rolul de proprietar într-o clădire, locatar în alta sau administrator. Informațiile și evidențele fiecărui spațiu de lucru rămân separate.'
        : lang === 'fa'
        ? 'بله. با یک حساب کاربری واحد می‌توانید با یک کلیک بین نقش مالک در یک ساختمان، ساکن در ساختمانی دیگر یا مدیر مجتمع جابه‌جا شوید. اسناد و سوابق هر فضای کاری تفکیک‌شده باقی می‌ماند.'
        : 'Yes. You use a single user account and can switch with one click between being an owner in one building, a resident in another, or a property manager. Records and ledgers for each workspace remain separate.'
    },
    {
      q: lang === 'ro'
        ? 'Ce se întâmplă cu actele și istoricul plăților când se schimbă administratorul sau se vinde un apartament?'
        : lang === 'fa'
        ? 'با تغییر مدیر یا فروش آپارتمان، چه بر سر اسناد و سوابق قبلی می‌آید؟'
        : 'What happens to files and payment records when a manager changes or an apartment is sold?',
      a: lang === 'ro'
        ? 'Documentele, evidențele și procesele-verbale întocmite în trecut păstrează asocierea cu persoanele care le-au înregistrat la acea dată. Noul administrator sau noul proprietar preia gestiunea de la data stabilită, având acces la evidențele necesare pentru o predare clară și verificabilă a responsabilităților.'
        : lang === 'fa'
        ? 'سوابق مالی، صورت‌جلسات و اسناد گذشته، انتساب خود را به ثبت‌کنندگان وقت حفظ می‌کنند. مدیر یا مالک جدید امور را از تاریخ معین با مدارک منظم و مدون برای تحویل شفاف مسئولیت‌ها تحویل می‌گیرد.'
        : 'Past records, receipts, and minutes retain their recorded author attributions. The incoming manager or new owner takes over from the designated handover date, with organized documentation for a clear and verifiable management transition.'
    },
    {
      q: lang === 'ro'
        ? 'Ce vede un chiriaș? Poate vedea actele de proprietate sau veniturile proprietarului?'
        : lang === 'fa'
        ? 'مستأجر چه مواردی را می‌بیند؟ آیا به اسناد مالک یا اطلاعات مالی دسترسی دارد؟'
        : 'What does a tenant see? Do they have access to title deeds or landlord income?',
      a: lang === 'ro'
        ? 'Nu. Chiriașul vede doar cotele lunare de întreținere din perioada în care locuiește acolo, consumurile la contoare și eventualele sesizări trimise. Actele de proprietate, fondul de reparații și plățile confidențiale ale proprietarului sunt complet ascunse.'
        : lang === 'fa'
        ? 'خیر. مستأجر تنها سهم شارژ ماهانه دوره سکونت خود، ارقام کنتورها و درخواست‌های ثبت‌شده‌اش را می‌بیند. اسناد مالکیت، صندوق اندوخته و اطلاعات شخصی مالک کاملاً مخفی و محرمانه است.'
        : 'No. Tenants only see their own monthly utility dues, meter readings, and service requests. Title deeds, capital reserve funds, and private landlord accounts remain completely hidden.'
    },
    {
      q: lang === 'ro'
        ? 'Când începe utilitatea CLADORA pentru o clădire nouă și ce sarcini NU acoperă platforma?'
        : lang === 'fa'
        ? 'کلادورا از چه زمانی برای ساختمان‌های نوساز قابل استفاده است و چه کارهایی را انجام نمی‌دهد؟'
        : 'When does CLADORA become useful for new builds, and what is outside its scope?',
      a: lang === 'ro'
        ? 'Poți începe încă din faza de proiect pentru organizarea apartamentelor, rezervări, antecontracte și păstrarea cărții tehnice. Totuși, CLADORA nu gestionează șantierul propriu-zis, orarul muncitorilor sau utilajele de construcție.'
        : lang === 'fa'
        ? 'می‌توان از فاز ساخت برای تعریف مشخصات واحدها، پیش‌فروش، رزروها و بایگانی مدارک فنی استفاده کرد. با این حال، مدیریت اجرایی کارگاه ساخت، هماهنگی پیمانکاران سازه و ماشین‌آلات ساختمانی در دامنه این سامانه نیست.'
        : 'You can start during the project phase to organize units, track reservations, and store technical documentation. However, physical construction job-site logistics and contractor execution are outside the platform’s scope.'
    },
    {
      q: lang === 'ro'
        ? 'Ce implică trimiterea formularului de contact? Trebuie să plătesc ceva pe loc?'
        : lang === 'fa'
        ? 'ثبت فرم تماس چه تعهدی ایجاد می‌کند؟ آیا پرداخت فوری لازم است؟'
        : 'What does submitting the contact form mean? Is there an immediate payment?',
      a: lang === 'ro'
        ? 'Nu, trimiterea formularului reprezintă o solicitare de dialog. Echipa noastră te contactează pentru a discuta specificul proprietății tale, pentru a-ți prezenta opțiunile potrivite și a răspunde la întrebări, fără plăți automate sau angajamente la transmitere.'
        : lang === 'fa'
        ? 'خیر، ارسال فرم صرفاً درخواستی برای گفتگوی اولیه است. تیم ما برای بررسی نیازهای ملک، معرفی راهکارهای متناسب و پاسخ به پرسش‌ها با شما گفتگو می‌کند، بدون آنکه ارسال فرم تعهد مالی یا پرداختی ایجاد کند.'
        : 'No, submitting the form is simply a request for a conversation. Our team gets in touch to understand your property requirements, explain relevant options, and answer questions, with no automatic charges or commitments upon submission.'
    }
  ];

  return (
    <section className="py-20 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center space-y-4 mb-14">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Întrebări și Răspunsuri' : lang === 'fa' ? 'پرسش‌های متداول' : 'Questions & Answers'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro'
              ? 'Răspunsuri la cele mai frecvente întrebări'
              : lang === 'fa'
              ? 'پاسخ به متداول‌ترین پرسش‌های کاربران'
              : 'Frequently Asked Questions About CLADORA'}
          </h2>
          <p className="text-sm sm:text-base text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Tot ce trebuie să știi despre cum funcționează CLADORA, confidențialitatea datelor și pașii de început.'
              : lang === 'fa'
              ? 'همه چیز درباره نحوه کارکرد سامانه، حفظ محرمانگی و چگونگی شروع استفاده.'
              : 'Everything you need to know about how CLADORA works, data privacy, and getting started.'}
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-[#E2E8F0] overflow-hidden bg-white transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-5 text-start flex items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors"
                >
                  <span className="font-bold text-sm sm:text-base text-[#102A43]">
                    {faq.q}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-[#627D98] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0E9F8E]' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#52667A] leading-relaxed border-t border-[#F0F4F8] bg-[#FAFCFE] animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Help Link Footer */}
        <div className="mt-10 text-center text-xs text-[#627D98] flex items-center justify-center gap-2">
          <span>{lang === 'ro' ? 'Ai o întrebare la care nu ai găsit răspunsul aici?' : lang === 'fa' ? 'سؤال دیگری درباره ساختمان خود دارید؟' : 'Have a question that isn’t answered here?'}</span>
          <Link
            href={`/${lang}/contact`}
            className="font-bold text-[#0E9F8E] hover:underline flex items-center gap-1"
          >
            <span>{lang === 'ro' ? 'Discută cu echipa noastră' : lang === 'fa' ? 'گفتگو با کارشناسان' : 'Talk to our team'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </section>
  );
};
