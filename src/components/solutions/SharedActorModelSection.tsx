import React from 'react';
import { Language } from '@/types';
import { 
  Building2, 
  Layers, 
  Users, 
  UserCheck, 
  ShieldCheck, 
  Boxes,
  ArrowDown,
  Info
} from 'lucide-react';

interface SharedActorModelSectionProps {
  lang: Language;
}

export const SharedActorModelSection: React.FC<SharedActorModelSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'MODELUL DE ACTORI & AUTORITATE',
      title: 'Cum Se Compune Experiența Fiecărui Participant',
      subtitle: 'În CLADORA, experiența unui utilizator sau a unei organizații nu provine dintr-o aplicație separată, ci derivă matematic din contextul proprietății, workspace, relație și autoritate.',
      hierarchy: [
        {
          step: '01',
          title: 'PROPRIETATE / ACTIV FIZIC',
          desc: 'Identitatea unică și persistentă a clădirii, ansamblului sau spațiului fizic (CORE).',
          icon: Building2,
          color: 'bg-[#102A43] text-white',
        },
        {
          step: '02',
          title: 'WORKSPACE OPERAȚIONAL',
          desc: 'Granița logică de izolare a datelor (ex: Asociație, Companie de Management, Portofoliu, Furnizor).',
          icon: Layers,
          color: 'bg-[#0E9F8E] text-white',
        },
        {
          step: '03',
          title: 'PERSOANĂ / ORGANIZAȚIE',
          desc: 'Participantul legal sau fizic identificat în sistem (ex: Companie Dezvoltatoare, Proprietar, Locatar, Prestator).',
          icon: Users,
          color: 'bg-[#243B53] text-white',
        },
        {
          step: '04',
          title: 'ROL & RELAȚIE JURIDICĂ',
          desc: 'Raportul contractual sau faptic cu imobilul (ex: proprietar-locatar, membru asociație, administrator delegat, tehnician autorizat).',
          icon: UserCheck,
          color: 'bg-[#0A6E62] text-white',
        },
        {
          step: '05',
          title: 'AUTORITATE SCOPATĂ',
          desc: 'Permisiuni strict delimitate în funcție de mandat, resursă, perimetru (scope) și interval de timp.',
          icon: ShieldCheck,
          color: 'bg-[#334E68] text-white',
        },
        {
          step: '06',
          title: 'DOMENII & CAPABILITĂȚI RELEVANTE',
          desc: 'Accesul autorizat la vizualizare sau inițiere către furnizorii canonici (FIN01, DOCUMENTS, SERVICE, OPERATIONS, C&E).',
          icon: Boxes,
          color: 'bg-[#627D98] text-white',
        },
      ],
      principlesTitle: 'Principii Arhitecturale Fundamentale',
      principles: [
        {
          title: 'Persona Nu Înseamnă Autoritate',
          desc: 'Faptul că un utilizator navighează ca «Proprietar», «Administrator» sau «Prestator» nu îi conferă de la sine permisiuni pe sistem. Autoritatea depinde strict de workspace, resursă, mandat activ și verificarea din CORE.',
        },
        {
          title: 'Persona Nu Înseamnă Cont de Utilizator Separat',
          desc: 'Aceeași persoană fizică poate fi proprietar în Imobilul A, membru în comitetul Imobilului B, chiriaș în Spațiul C și reprezentant al unui prestator pentru Imobilul D. Sistemul rezolvă contextul înainte de autoritate.',
        },
        {
          title: 'Actori Organizaționali cu Relații Delegate',
          desc: 'Dezvoltatorii, firmele de administrare și companiile de servicii acționează ca entități juridice. Utilizatorii individuali acționează în numele lor prin mandate și relații autorizate în workspace.',
        },
      ],
    },
    en: {
      badge: 'ACTOR & AUTHORITY MODEL',
      title: 'How Every Participant Experience Is Composed',
      subtitle: 'In CLADORA, user and organizational experiences do not come from isolated apps. They derive systematically from physical property context, workspace boundaries, relationships, and scoped authority.',
      hierarchy: [
        {
          step: '01',
          title: 'PROPERTY / PHYSICAL ASSET',
          desc: 'The persistent, single identity of the building, estate, or physical space (CORE).',
          icon: Building2,
          color: 'bg-[#102A43] text-white',
        },
        {
          step: '02',
          title: 'OPERATIONAL WORKSPACE',
          desc: 'The logical boundary of data isolation (e.g., Association, Management Firm, Portfolio, Vendor).',
          icon: Layers,
          color: 'bg-[#0E9F8E] text-white',
        },
        {
          step: '03',
          title: 'PERSON / ORGANIZATION',
          desc: 'The identified legal entity or individual participant (e.g., Developer Entity, Owner, Resident, Contractor).',
          icon: Users,
          color: 'bg-[#243B53] text-white',
        },
        {
          step: '04',
          title: 'ROLE & RELATIONSHIP',
          desc: 'The contractual or operational standing with the property (e.g., owner-occupier, HOA member, appointed manager, authorized technician).',
          icon: UserCheck,
          color: 'bg-[#0A6E62] text-white',
        },
        {
          step: '05',
          title: 'SCOPED AUTHORITY',
          desc: 'Strictly bounded permissions based on mandate, resource, scope, and time.',
          icon: ShieldCheck,
          color: 'bg-[#334E68] text-white',
        },
        {
          step: '06',
          title: 'RELEVANT DOMAINS & CAPABILITIES',
          desc: 'Authorized read/action visibility into single-capability canonical providers (FIN01, DOCUMENTS, SERVICE, OPERATIONS, C&E).',
          icon: Boxes,
          color: 'bg-[#627D98] text-white',
        },
      ],
      principlesTitle: 'Core Architectural Axioms',
      principles: [
        {
          title: 'Persona Is Not Authority',
          desc: 'Labeling an actor as an "Owner", "Manager", or "Vendor" does not grant intrinsic platform permissions. Authority strictly requires an active workspace relationship, resource scope, time window, and mandate verified by CORE.',
        },
        {
          title: 'Persona Is Not a Separate User Account',
          desc: 'A single individual may be an owner in Property A, an HOA board member in Property B, a tenant in Property C, and a vendor engineer in Property D. The architecture resolves context before evaluating authority.',
        },
        {
          title: 'Organizational Actors with Delegated Authority',
          desc: 'Developers, management firms, and service contractors act as organizational entities. Individual team members interact through delegated roles and scoped mandates inside their respective workspaces.',
        },
      ],
    },
    fa: {
      badge: 'مدل ساختاری ذی‌نفعان و سطوح اختیارات',
      title: 'تجربه کاربری چگونه برای هر مشارکت‌کننده شکل می‌گیرد؟',
      subtitle: 'در کلادورا، تجربه مخاطب از نرم‌افزارهای جداگانه و جزیره‌ای حاصل نمی‌شود؛ بلکه بر پایه هویت واحد ملک، مرز ورک‌اسپیس، رابطه حقوقی و اختیارات تفویض‌شده شکل می‌گیرد.',
      hierarchy: [
        {
          step: '۰۱',
          title: 'ملک / دارایی فیزیکی',
          desc: 'هویت پایدار و غیرقابل‌تغییر ساختمان، شهرک یا فضای فیزیکی (هسته CORE).',
          icon: Building2,
          color: 'bg-[#102A43] text-white',
        },
        {
          step: '۰۲',
          title: 'ورک‌اسپیس عملیاتی',
          desc: 'مرز منطقی تفکیک داده‌ها (مانند انجمن مالکان، شرکت مدیریت، سبد املاک یا شرکت پیمانکار).',
          icon: Layers,
          color: 'bg-[#0E9F8E] text-white',
        },
        {
          step: '۰۳',
          title: 'شخص حقیقی / سازمان',
          desc: 'مشارکت‌کننده ثبت‌شده در سیستم (مانند شرکت سازنده، مالک، بهره‌بردار یا ارائه‌دهنده خدمات).',
          icon: Users,
          color: 'bg-[#243B53] text-white',
        },
        {
          step: '۰۴',
          title: 'نقش و رابطه حقوقی',
          desc: 'نسبت قراردادی یا واقعی با ملک (مانند مالک مقیم، عضو مجمع، مدیر منتخب یا تکنسین مجاز).',
          icon: UserCheck,
          color: 'bg-[#0A6E62] text-white',
        },
        {
          step: '۰۵',
          title: 'اختیارات محدود به مجوز',
          desc: 'دسترسی‌های دقیق بر اساس نوع مصوبه، دامنه دارایی، منابع مجاز و بازه زمانی مشخص.',
          icon: ShieldCheck,
          color: 'bg-[#334E68] text-white',
        },
        {
          step: '۰۶',
          title: 'دامنه‌ها و قابلیت‌های متصل',
          desc: 'امکان مشاهده یا ثبت درخواست در متولیان مرجع داده‌ها (FIN01، اسناد، SERVICE، OPERATIONS، C&E).',
          icon: Boxes,
          color: 'bg-[#627D98] text-white',
        },
      ],
      principlesTitle: 'اصول بنیادین معماری ذی‌نفعان',
      principles: [
        {
          title: 'عنوان نقش به‌تنهایی مجوزی ایجاد نمی‌کند',
          desc: 'نام‌گذاری یک کاربر به عنوان «مالک»، «مدیر» یا «پیمانکار» به خودی خود اختیاری در سیستم تولید نمی‌کند. اختیارات مستلزم رابطه فعال در ورک‌اسپیس، دامنه مشخص، بازه زمانی و تأییدیه هسته CORE است.',
        },
        {
          title: 'نقش، معادل حساب کاربری مجزا نیست',
          desc: 'یک فرد حقیقی می‌تواند هم‌زمان مالک در مجتمع الف، عضو هیئت‌مدیره در مجتمع ب، مستأجر در مجتمع ج و تکنسین شرکت پیمانکار در مجتمع د باشد. سیستم ابتدا بستر تعامل را تعیین و سپس اختیارات را بررسی می‌کند.',
        },
        {
          title: 'سازمان‌ها و تفویض اختیارات سازمانی',
          desc: 'شرکت‌های سازنده، مجموعه‌های مدیریت املاک و پیمانکاران فنی به عنوان اشخاص حقوقی در سیستم تعریف می‌شوند و اعضای تیم آنها از طریق نمایندگی‌های دارای بازه زمانی و مجوز محدود فعالیت می‌کنند.',
        },
      ],
    },
  }[lang];

  return (
    <section className="py-20 bg-white border-y border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62] border border-[#B2E5DF]">
            <Info className="w-3.5 h-3.5 text-[#0E9F8E]" />
            <span>{content.badge}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {content.title}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* Visual Flow Hierarchy */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 relative">
          {content.hierarchy.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                className="card-proptech p-5 bg-[#F6F9FC] border-[#E2E8F0] flex flex-col justify-between hover:border-[#0E9F8E] transition-all relative"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#0E9F8E]">{item.step}</span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xs font-bold text-[#102A43] uppercase tracking-wide">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                {idx < content.hierarchy.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-[#CBD5E1] items-center justify-center text-[#52667A] rtl:rotate-180">
                    <ArrowDown className="w-3 h-3 -rotate-90 rtl:rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Three Foundational Principles */}
        <div className="bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 space-y-6">
          <h3 className="text-base sm:text-lg font-bold text-[#102A43]">
            {content.principlesTitle}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.principles.map((p, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0E9F8E]" />
                  <h4 className="text-sm font-bold text-[#102A43]">{p.title}</h4>
                </div>
                <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
