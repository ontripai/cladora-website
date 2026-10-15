import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building2, 
  Home, 
  TrendingUp, 
  Layers, 
  KeyRound, 
  Wrench,
  ArrowRight
} from 'lucide-react';

interface RoleQuickEntryProps {
  lang: Language;
}

export const RoleQuickEntry: React.FC<RoleQuickEntryProps> = ({ lang }) => {
  const options = [
    {
      title: lang === 'ro' ? 'O asociație / bloc de locuințe' : lang === 'fa' ? 'یک مجتمع مسکونی / بلوک آپارتمانی' : 'One association or residential block',
      desc: lang === 'ro' ? 'Sunt administrator, președinte sau cenzor pentru blocul meu' : lang === 'fa' ? 'من مدیر ساختمان، رئیس هیئت‌مدیره یا بازرس مجتمع هستم' : 'I am an administrator, president, or auditor for my building',
      icon: Building2,
      href: `/${lang}/solutions/associations`,
      tag: lang === 'fa' ? 'Association OS • سیستم مدیریت انجمن مالکان' : 'Association OS'
    },
    {
      title: lang === 'ro' ? 'Mai multe proprietăți închiriate' : lang === 'fa' ? 'چندین واحد مسکونی استیجاری (سبد املاک)' : 'Several owned properties (Portfolios)',
      desc: lang === 'ro' ? 'Dețin 2+ apartamente și vreau să urmăresc chirii, cheltuieli și randament' : lang === 'fa' ? 'مالک ۲ یا چند واحد استیجاری هستم و خواهان پایش اجاره و بازده خالصم' : 'I own 2+ properties and need consolidated yields, rent and cost tracking',
      icon: TrendingUp,
      href: `/${lang}/solutions/property-owners`,
      tag: lang === 'fa' ? 'Portfolio OS • سیستم مدیریت سبد املاک' : 'Portfolio OS'
    },
    {
      title: lang === 'ro' ? 'Portofoliu clienți pentru compania mea' : lang === 'fa' ? 'مدیریت مجتمع‌های متعدد برای مشتریان' : 'Multiple associations for clients',
      desc: lang === 'ro' ? 'Conduc o firmă de administrare imobile cu multiple clădiri în portofoliu' : lang === 'fa' ? 'مدیرعامل شرکت ارائه‌دهنده خدمات تخصصی مدیریت و نگهداری ساختمان هستم' : 'I run a professional property management firm with multiple buildings',
      icon: Layers,
      href: `/${lang}/solutions/property-managers`,
      tag: lang === 'fa' ? 'Manager OS • سیستم شرکت‌های مدیریت املاک' : 'Manager OS'
    },
    {
      title: lang === 'ro' ? 'Locuința mea și lista de plată' : lang === 'fa' ? 'واحد مسکونی و فیش شارژ ماهانه من' : 'My home and monthly statements',
      desc: lang === 'ro' ? 'Sunt proprietar rezident și vreau transparență totală la cote și contoare' : lang === 'fa' ? 'مالک ساکن در مجتمع هستم و شفافیت کامل در فیش و کنتورها می‌خواهم' : 'I am a resident owner looking for transparent charges and meter submission',
      icon: Home,
      href: `/${lang}/solutions/residents`,
      tag: lang === 'ro' ? 'Aplicația Rezidenților' : lang === 'fa' ? 'اپلیکیشن مالکان و ساکنان' : 'Resident App'
    },
    {
      title: lang === 'ro' ? 'Un apartament în care locuiesc cu chirie' : lang === 'fa' ? 'واحدی که در آن مستأجر هستم' : 'A rented home where I live',
      desc: lang === 'ro' ? 'Sunt chiriaș și am nevoie de calculul corect al consumului și plăți directe' : lang === 'fa' ? 'مستأجر هستم و محاسبه دقیق مصارف انشعابات و پرداخت آسان شارژ می‌خواهم' : 'I am a tenant needing accurate consumption bills and direct maintenance',
      icon: KeyRound,
      href: `/${lang}/solutions/residents`,
      tag: lang === 'ro' ? 'Portalul Ocupanților' : lang === 'fa' ? 'پرتال ساکنان و بهره‌برداران' : 'Resident Portal'
    },
    {
      title: lang === 'ro' ? 'Operațiuni tehnice și mentenanță' : lang === 'fa' ? 'عملیات فنی و نگهداری تأسیسات' : 'Building operations and maintenance',
      desc: lang === 'ro' ? 'Sunt prestator tehnic, instalator sau responsabil revizii ISCIR' : lang === 'fa' ? 'تکنسین فنی، مجری نگهداری آسانسور یا تأسیسات ساختمان هستم' : 'I handle technical repairs, HVAC, elevator maintenance, and work orders',
      icon: Wrench,
      href: `/${lang}/solutions/service-providers`,
      tag: lang === 'ro' ? 'Furnizori de Servicii' : lang === 'fa' ? 'ارائه‌دهندگان خدمات' : 'Service Providers'
    }
  ];

  return (
    <section className="py-20 bg-[#F6F9FC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-[#0A6E62] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Ghidare pe Măsura Nevoilor Tale' : lang === 'fa' ? 'انتخاب مسیر متناسب با نیاز شما' : 'Tailored Role Entry'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43]">
            {lang === 'ro' ? 'Ce dorești să administrezi?' : lang === 'fa' ? 'قصد مدیریت چه دارایی‌هایی را دارید؟' : 'What do you want to manage?'}
          </h2>
          <p className="text-base text-[#52667A]">
            {lang === 'ro' 
              ? 'Alege situația ta pentru a vedea experiența de produs optimizată pentru cerințele tale operaționale.'
              : lang === 'fa'
              ? 'حوزه فعالیت خود را انتخاب کنید تا راهکار متناسب با نیازهای عملیاتی خود را مشاهده فرمایید.'
              : 'Select your operational context to explore the dedicated solution flow.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {options.map((opt, idx) => {
            const Icon = opt.icon;
            return (
              <Link
                key={idx}
                href={opt.href}
                className="card-proptech card-proptech-hover p-6 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center group-hover:bg-[#0E9F8E] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F0F4F8] text-[#52667A]">
                      {opt.tag}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#102A43] mt-4 group-hover:text-[#0E9F8E] transition-colors">
                    {opt.title}
                  </h3>

                  <p className="text-xs text-[#52667A] mt-2 leading-relaxed">
                    {opt.desc}
                  </p>
                </div>

                <div className="pt-6 flex items-center gap-1.5 text-xs font-bold text-[#0A6E62]">
                  <span>{lang === 'ro' ? 'Explorează fluxul' : lang === 'fa' ? 'مشاهده جزئیات راهکار' : 'Explore solution'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </section>
  );
};
