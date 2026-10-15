import React from 'react';
import { Language } from '@/types';
import { 
  Building2, 
  KeyRound, 
  Users, 
  FileText, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  ShieldCheck, 
  Compass, 
  Lock 
} from 'lucide-react';

interface SharedFoundationSectionProps {
  lang: Language;
}

export const SharedFoundationSection: React.FC<SharedFoundationSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'ADEVĂR CANONIC & INFRASTRUCTURĂ COMUNĂ',
      title: 'Fluxuri diferite. Un singur adevăr de sistem.',
      subtitle:
        'Fiecare capabilitate are un singur deținător canonic de adevăr. Această decizie arhitecturală elimină datele duplicate, reconcilierile manuale și confuziile de roluri.',
      pillars: [
        {
          name: 'Identitate de Activ',
          desc: 'Identificatori persistenți pentru terenuri, clădiri, unități, spații și echipamente.',
          icon: Building2,
        },
        {
          name: 'Autoritate & Mandate',
          desc: 'Delegare de drepturi pe termen limitat, roluri de securitate și succesiune auditabilă.',
          icon: KeyRound,
        },
        {
          name: 'Relații & Roluri',
          desc: 'Definirea clară a legăturii dintre persoane și spații (proprietar, chiriaș, manager).',
          icon: Users,
        },
        {
          name: 'Documente & Seif',
          desc: 'Arhivă securizată cu verificarea integrității documentelor tehnice și contractelor.',
          icon: FileText,
        },
        {
          name: 'Registru Financiar',
          desc: 'Evidență contabilă analitică dublă și reconciliere bancară cu pistă de audit.',
          icon: DollarSign,
        },
        {
          name: 'Rezervări & Programări',
          desc: 'Model centralizat de timp și disponibilitate pentru spații și vizite tehnice.',
          icon: Calendar,
        },
        {
          name: 'Comunicații Oficiale',
          desc: 'Canal securizat de mesagerie, notificări statutare și procese-verbale semnate.',
          icon: MessageSquare,
        },
        {
          name: 'Jurnal de Audit Aditiv',
          desc: 'Înregistrare cronologică aditivă a fiecărui eveniment de sistem și a acțiunilor auditate.',
          icon: ShieldCheck,
        },
        {
          name: 'Metodologie & Asistență Migrare',
          desc: 'Proceduri ghidate pentru importul reconciliat al asociațiilor și portofoliilor din sisteme vechi.',
          icon: Compass,
        },
        {
          name: 'Securitate & Izolare',
          desc: 'Găzduire în Uniunea Europeană, confidențialitate GDPR și delimitare per Workspace.',
          icon: Lock,
        },
      ],
      canonicalPledgeTitle: 'Principiul de bază CLADORA:',
      canonicalPledgeDesc:
        'O singură capabilitate este deținută de un singur subsistem canonic. Domeniile externe citesc și solicită acțiuni prin interfețe de încredere, garantând integritatea evidențelor indiferent de volumul de activitate.',
    },
    en: {
      badge: 'CANONICAL TRUTH & SHARED INFRASTRUCTURE',
      title: 'Different workflows. One shared truth.',
      subtitle:
        'Every capability has a single canonical owner of truth. This architectural discipline prevents duplicate records, conflicting data reconciliations, and unauthorized boundary drift.',
      pillars: [
        {
          name: 'Asset Identity',
          desc: 'Persistent hierarchical identifiers for land, buildings, units, and equipment.',
          icon: Building2,
        },
        {
          name: 'Authority & Mandates',
          desc: 'Time-bounded delegation protocols, security roles, and traceable succession.',
          icon: KeyRound,
        },
        {
          name: 'Relationships & Roles',
          desc: 'Formal contextual links connecting persons to physical spaces (owner, tenant, manager).',
          icon: Users,
        },
        {
          name: 'Evidence & Documents',
          desc: 'Secure technical archives with document integrity verification, warranties, and contracts.',
          icon: FileText,
        },
        {
          name: 'Financial Ledger',
          desc: 'Analytical double-entry ledgers, banking feeds, and auditable allocations.',
          icon: DollarSign,
        },
        {
          name: 'Booking & Schedules',
          desc: 'Centralized scheduling framework governing spaces, amenities, and site visits.',
          icon: Calendar,
        },
        {
          name: 'Formal Communications',
          desc: 'Authorized messaging channels, formal notices, and verified general assembly ballots.',
          icon: MessageSquare,
        },
        {
          name: 'Auditable Event Trail',
          desc: 'Append-only chronological event logs and traceable action records across subsystems.',
          icon: ShieldCheck,
        },
        {
          name: 'Migration Runbooks & Tools',
          desc: 'Structured data ingestion protocols for transitioning legacy HOAs and portfolios.',
          icon: Compass,
        },
        {
          name: 'Security & Isolation',
          desc: 'Workspace-scoped boundary isolation, GDPR purpose minimization, and EU residency.',
          icon: Lock,
        },
      ],
      canonicalPledgeTitle: 'The Canonical Truth Principle:',
      canonicalPledgeDesc:
        'One capability has exactly one canonical source of truth. Operational domains interact via strictly governed interfaces, preserving ledger integrity regardless of scale.',
    },
    fa: {
      badge: 'حقیقت واحد و زیرساخت مشترک',
      title: 'گردش‌کارهای گوناگون، یک حقیقت مشترک',
      subtitle:
        'هر بخش از اطلاعات در سامانه دارای یک متولی مشخص و معتبر است. این انضباط معماری مانع از ثبت داده‌های تکراری، مغایرت‌های مالی و تداخل وظایف می‌شود.',
      pillars: [
        {
          name: 'شناسنامه و هویت دارایی',
          desc: 'شناسه‌های یکتا و ساختار سلسله‌مراتبی برای ملک، ساختمان، فضا و دستگاه‌ها.',
          icon: Building2,
        },
        {
          name: 'اختیارات و مجوزها',
          desc: 'تفویض زمان‌دار مسئولیت‌ها، سطوح دسترسی امنیتی و واگذاری ثبت‌شده.',
          icon: KeyRound,
        },
        {
          name: 'نقش‌ها و روابط حقوقی',
          desc: 'تعریف شفاف رابطه افراد با فضا (مالک، مستأجر، مدیر و پیمانکار).',
          icon: Users,
        },
        {
          name: 'بایگانی و مدارک',
          desc: 'آرشیو دیجیتال امن نقشه‌ها، قراردادها و مستندات با اعتبارسنجی یکپارچگی فایل.',
          icon: FileText,
        },
        {
          name: 'دفاتر مالی و حسابداری',
          desc: 'حسابداری تحلیلی دوبل، اتصال صورت‌حساب بانکی و گزارش‌های قابل ممیزی.',
          icon: DollarSign,
        },
        {
          name: 'رزرو و زمان‌بندی',
          desc: 'چارچوب متمرکز تقویم و تخصیص زمان برای امکانات مشترک و بازدیدهای فنی.',
          icon: Calendar,
        },
        {
          name: 'مکاتبات رسمی',
          desc: 'سامانه ابلاغ مصوبات، اعلانات قانونی و صورت‌جلسات مجمع با ثبت تاریخچه.',
          icon: MessageSquare,
        },
        {
          name: 'ثبت رخدادهای ممیزی',
          desc: 'ثبت ترتیبی و افزایشی کلیه رخدادها و ردگیری عملیات در زیرسیستم‌ها با برچسب زمانی.',
          icon: ShieldCheck,
        },
        {
          name: 'متدولوژی و ابزارهای مهاجرت',
          desc: 'روش‌های استاندارد برای انتقال ساختاریافته سوابق مالی و مالکان از نرم‌افزارهای قدیمی.',
          icon: Compass,
        },
        {
          name: 'امنیت و جداسازی داده‌ها',
          desc: 'جداسازی داده‌ها در سطح ورک‌اسپیس، انطباق با GDPR و میزبانی امن در اروپا.',
          icon: Lock,
        },
      ],
      canonicalPledgeTitle: 'اصل بنیادین حقیقت واحد در کلادورا:',
      canonicalPledgeDesc:
        'هر قابلیت در پلتفرم تنها یک مرجع اصلی دارد. دامنه‌های عملیاتی از طریق رابط‌های استاندارد و امن اطلاعات را فراخوانی کرده و سلامت اسناد را تضمین می‌کنند.',
    },
  }[lang] || {
    badge: 'CANONICAL TRUTH & SHARED INFRASTRUCTURE',
    title: 'Different workflows. One shared truth.',
    subtitle: 'Every capability has a single canonical owner of truth.',
    pillars: [],
    canonicalPledgeTitle: 'The Canonical Truth Principle:',
    canonicalPledgeDesc: 'One capability has one canonical owner.',
  };

  return (
    <section className="py-24 bg-[#F6F9FC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0E9F8E]" />
            <span>{content.badge}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#102A43] tracking-tight mb-4">
            {content.title}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* 10 Foundation Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          {content.pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.name}
                className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-[#102A43] mb-1.5">{pillar.name}</h3>
                  <p className="text-[11px] text-[#52667A] leading-relaxed">{pillar.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Canonical Architecture Note */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D3DCE6] shadow-card flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#102A43] mb-1">{content.canonicalPledgeTitle}</div>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">{content.canonicalPledgeDesc}</p>
          </div>
        </div>

      </div>
    </section>
  );
};
