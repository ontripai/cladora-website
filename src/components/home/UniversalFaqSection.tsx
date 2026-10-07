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
        ? 'Care este diferența exactă dintre o Proprietate, un Workspace și o Persoană?' 
        : lang === 'fa' 
        ? 'تفاوت دقیق بین «ملک و دارایی»، «Workspace» و «شخص» چیست؟' 
        : 'What is the precise difference between a Property, a Workspace, and a Person?',
      a: lang === 'ro'
        ? 'Proprietatea este obiectul fizic (clădirea, apartamentul, spațiul comercial sau echipamentul tehnic) care rămâne în timp. Workspace-ul este granița de colaborare și de date a unei organizații (dezvoltator, asociație de proprietari sau companie de administrare). Persoana este utilizatorul uman care primește un rol într-un Workspace pe baza unei relații juridice valide și pentru o perioadă determinată.'
        : lang === 'fa'
        ? 'ملک و دارایی بستر فیزیکی خدمت است (مجموعه، واحد، تأسیسات یا فضاها) که در گذر زمان پایدار می‌ماند. Workspace مرز دسترسی، اطلاعات و همکاری یک سازمان یا گروه است (مانند انجمن مالکان یا شرکت مدیریت). شخص فردی است که در یک یا چند Workspace، بر اساس مبنایی مشخص و برای بازه زمانی معتبر، اختیارات مشاهده یا اقدام دریافت می‌کند.'
        : 'The Property is the enduring physical subject (building, unit, common equipment). The Workspace is the organization’s secure collaboration and data boundary. The Person is the human actor who holds scoped, time-bound roles within specific workspaces based on verified legal relationships.'
    },
    {
      q: lang === 'ro' 
        ? 'Poate un utilizator să aibă roluri multiple în imobile sau organizații diferite?' 
        : lang === 'fa' 
        ? 'آیا یک فرد می‌تواند هم‌زمان چند نقش در ساختمان‌ها یا سازمان‌های مختلف داشته باشد؟' 
        : 'Can a single user have multiple roles across different buildings or organizations?',
      a: lang === 'ro'
        ? 'Da. Aceeași persoană poate fi proprietar într-un bloc, chiriaș într-un alt complex, membru în comitetul altuia și administrator pentru un portofoliu de clienți. Identitatea unică este protejată, iar comutarea contextului de lucru se face instantaneu, fără amestecarea datelor sau a documentelor.'
        : lang === 'fa'
        ? 'بله. یک حساب کاربری می‌تواند هم‌زمان مالک یک واحد در ساختمانی مسکونی، مستأجر در مجتمعی دیگر، عضو هیئت‌مدیره در ساختمانی سوم یا ارائه‌دهنده خدمت برای چندین مجموعه باشد و بدون خروج از سیستم، میان این محیط‌ها جابه‌جا شود.'
        : 'Yes. CLADORA natively supports multi-role identity. One account can act as a unit owner in one building, tenant in another, and audit board member in a third, switching workspaces without data cross-bleed.'
    },
    {
      q: lang === 'ro' 
        ? 'Ce se întâmplă cu datele și semnăturile istorice la schimbarea administratorului sau la vânzarea unității?' 
        : lang === 'fa' 
        ? 'هنگام تغییر مدیر یا فروش ملک، چه بر سر اسناد، امضاها و سوابق گذشته می‌آید؟' 
        : 'What happens to historical records and signatures when a manager changes or a unit is sold?',
      a: lang === 'ro'
        ? 'Semnăturile, aprobările de plată și listele afișate în trecut rămân neatins atribuite persoanelor care le-au semnat la momentul respectiv. Predarea responsabilității se face cu dată de efect: succesorul primește acces doar la arhivele autorizate necesare continuării activității și preia sarcinile deschise, iar acțiunile noi se înregistrează pe numele său.'
        : lang === 'fa'
        ? 'امضاها، پرداخت‌ها و اقدامات گذشته همواره به نام اشخاص قبلی محفوظ و مستند می‌مانند. تحویل مسئولیت با تاریخ مؤثر ثبت می‌شود؛ جانشین صرفاً به سوابق مجاز برای پیگیری کارهای جاری دسترسی می‌یابد و اقدامات جدید به نام او ثبت می‌گردند.'
        : 'Historical signatures, payments, and approvals permanently preserve their original author attributions. Succession activates at a specific timestamp: successors inherit only permitted operational records, while all future actions are logged under the new party.'
    },
    {
      q: lang === 'ro' 
        ? 'Ce informații poate vedea un chiriaș? Are acces la actele de proprietate sau la veniturile proprietarului?' 
        : lang === 'fa' 
        ? 'مستأجر چه اطلاعاتی را مشاهده می‌کند؟ آیا به اسناد مالک یا مبالغ اجاره سایر واحدها دسترسی دارد؟' 
        : 'What can tenants see? Do they have access to title documents or owner income?',
      a: lang === 'ro'
        ? 'Nu. Chiriașul are acces strict la consumurile sale lunare de utilități, la cotele operaționale repartizate pentru perioada sa contractuală și la tichetele de service. Actele de proprietate, fondul de reparații de capital, veniturile din chirie și mesajele rezervate proprietarilor sunt complet inaccesibile chiriașului.'
        : lang === 'fa'
        ? 'خیر. دسترسی مستأجر منحصراً به مصارف جاری انشعابات واحد، هزینه‌های مصرفی مربوط به دوره قرارداد خود و ثبت درخواست‌های خدماتی محدود است. اسناد مالکیت، صندوق‌های تعمیرات اساسی، صورت‌حساب‌های مالک و اطلاعات سایر واحدها کاملاً محرمانه می‌مانند.'
        : 'Never. Tenants only access their own consumption records, current period operational utilities, and service requests. Title documents, capital repair funds, and private owner financial books remain strictly private.'
    },
    {
      q: lang === 'ro' 
        ? 'În ce etapă a construcției intervine CLADORA și ce nu face sistemul?' 
        : lang === 'fa' 
        ? 'کلادورا در چه مرحله‌ای از ساخت وارد می‌شود و چه کارهایی در دامنهٔ محصول قرار ندارند؟' 
        : 'At what construction stage does CLADORA enter, and what is out of scope?',
      a: lang === 'ro'
        ? 'CLADORA poate interveni înainte de finalizarea clădirii pentru definirea identității unităților, gestionarea oportunităților, rezervări și seiful de documente tehnice. Însă conducerea operativă a șantierului, planificarea utilajelor și controlul execuției de construcție nu fac parte din produs.'
        : lang === 'fa'
        ? 'همراهی کلادورا می‌تواند پیش از تکمیل ساختمان برای ثبت مشخصات واحدها، پیش‌فروش، رزرو و بایگانی نقشه‌ها آغاز شود. اما مدیریت اجرایی کارگاه ساخت، برنامه‌ریزی پیمانکاران سازه و کنترل عملیات فیزیکی ساخت خارج از دامنهٔ محصول است.'
        : 'CLADORA can begin before building completion to establish unit registries, pre-sales tracking, reservations, and technical vaults. However, physical construction job-site scheduling and civil contractor management are outside product scope.'
    },
    {
      q: lang === 'ro' 
        ? 'Ce înseamnă trimiterea unei cereri de colaborare? Creează automat un Workspace plătit?' 
        : lang === 'fa' 
        ? 'ثبت فرم شروع همکاری به چه معناست؟ آیا بلافاصله هزینه یا حساب قطعی ایجاد می‌کند؟' 
        : 'What does submitting a partnership request mean? Does it create a paid workspace automatically?',
      a: lang === 'ro'
        ? 'Nu. Trimiterea formularului este o solicitare de evaluare a cerințelor și configurare asistată. Echipa noastră analizează specificul imobilului sau portofoliului tău, stabilește profilul potrivit și te contactează pentru a ghida inițierea mediului de lucru fără costuri ascunse sau activări forțate.'
        : lang === 'fa'
        ? 'خیر. ثبت درخواست به معنی ایجاد قطعی حساب، خرید اشتراک یا تحمیل تعهد مالی نیست؛ بلکه درخواست شما برای بررسی مشخصات ملک یا سبد دارایی ثبت شده و کارشناسان کلادورا جهت ارائه راهکار متناسب و تنظیم محیط کاری با شما ارتباط خواهند گرفت.'
        : 'No. Submitting an inquiry is a consultative onboarding request. Our team evaluates your property profile, requirements, and jurisdictional needs before any workspace provisioning or commercial commitment is executed.'
    }
  ];

  return (
    <section className="py-20 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center space-y-4 mb-14">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Claritate & Transparență' : lang === 'fa' ? 'پاسخ به ابهامات متداول' : 'Clarity & FAQ'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Întrebări frecvente despre funcționarea CLADORA' 
              : lang === 'fa' 
              ? 'پرسش‌های متداول درباره ساختار و عملکرد کلادورا' 
              : 'Frequently Asked Questions on CLADORA Architecture'}
          </h2>
          <p className="text-sm sm:text-base text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Răspunsuri concrete la întrebările practice legate de roluri, succesiune, confidențialitate și procesul de începere a colaborării.'
              : lang === 'fa'
              ? 'پاسخ‌های دقیق و شفاف به سؤالات اساسی درباره نقش‌ها، حفظ سوابق، محرمانگی و نحوه آغاز همکاری.'
              : 'Grounded answers to key architectural questions regarding workspaces, role succession, and onboarding.'}
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
          <span>{lang === 'ro' ? 'Ai nevoie de clarificări suplimentare?' : lang === 'fa' ? 'سؤال دیگری در رابطه با پروژه خود دارید؟' : 'Need more specialized guidance?'}</span>
          <Link
            href={`/${lang}/contact`}
            className="font-bold text-[#0E9F8E] hover:underline flex items-center gap-1"
          >
            <span>{lang === 'ro' ? 'Contactează echipa' : lang === 'fa' ? 'ثبت پرسش در فرم ارتباط' : 'Contact team'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </section>
  );
};
