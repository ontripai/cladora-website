import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { Building, Briefcase, Users, Wrench, Home, FileCheck2, ArrowRight } from 'lucide-react';

interface SolutionsWhoSectionProps {
  lang: Language;
}

export const SolutionsWhoSection: React.FC<SolutionsWhoSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'ROLURI & BENEFICIARI',
      title: 'Cui i se adresează arhitectura CLADORA',
      subtitle:
        'Fiecare actor din ciclul imobiliar are nevoi diferite. CLADORA oferă interfețe dedicate fiecărui rol, păstrând în spate o evidență autorizată unică.',
      learnMore: 'Află mai multe',
      roles: [
        {
          id: 'builders',
          name: 'Dezvoltatori & Constructori',
          problem: 'Evidențe fragmentate de pre-vânzare și predări anevoioase către asociații.',
          solution:
            'Identitate digitală din faza de proiect, antecontracte și protocol formal de predare cu evidența documentației tehnice.',
          href: `/${lang}/solutions/developers`,
          icon: Building,
        },
        {
          id: 'owners',
          name: 'Proprietari & Portofolii',
          problem: 'Lipsa transparenței randamentelor și contracte dispersate în mai multe fișiere.',
          solution:
            'Adevăr financiar consolidat, urmărirea încasărilor de chirii și audit complet al stării unităților deținute.',
          href: `/${lang}/solutions/property-owners`,
          icon: Briefcase,
        },
        {
          id: 'associations',
          name: 'Asociații & Comunități',
          problem: 'Dispute legate de cotele de întreținere și lipsa de transparență în cheltuieli.',
          solution:
            'Calcul explicabil al cotelor statutare, reconciliere bancară asistată și avizier digital securizat.',
          href: `/${lang}/solutions/associations`,
          icon: Users,
        },
        {
          id: 'managers',
          name: 'Companii de Administrare',
          problem: 'Gestiune manuală pe multiple blocuri și dificultăți în coordonarea meșterilor.',
          solution:
            'Operare multi-clădire într-un singur cont, triere a tichetelor de mentenanță și evidență structurată.',
          href: `/${lang}/solutions/property-managers`,
          icon: Wrench,
        },
        {
          id: 'residents',
          name: 'Rezidenți & Ocupanți',
          problem: 'Plăți complicate la ghișeu și incertitudine privind istoricul propriilor consumuri.',
          solution:
            'Portal intuitiv pentru transmiterea indexurilor, plata cotelor și solicitarea rapidă a reparațiilor.',
          href: `/${lang}/solutions/residents`,
          icon: Home,
        },
        {
          id: 'providers',
          name: 'Furnizori de Servicii',
          problem: 'Comenzi neclare, devize contestate și termene de plată imprevizibile.',
          solution:
            'Comenzi de lucru cu specificații exacte, probe foto la recepție și decontare ordonată.',
          href: `/${lang}/solutions/service-providers`,
          icon: FileCheck2,
        },
      ],
    },
    en: {
      badge: 'STAKEHOLDERS & ROLES',
      title: 'Who uses the CLADORA operating architecture',
      subtitle:
        'Every participant across the built environment requires purpose-built workflows. CLADORA serves each role with dedicated interfaces connected to the same authorized record.',
      learnMore: 'Learn more',
      roles: [
        {
          id: 'builders',
          name: 'Developers & Builders',
          problem: 'Fragmented pre-sales spreadsheets and contentious handovers to new associations.',
          solution:
            'Single property identity established early, traceable pre-sales records, and formal digital handover.',
          href: `/${lang}/solutions/developers`,
          icon: Building,
        },
        {
          id: 'owners',
          name: 'Property Owners & Portfolios',
          problem: 'Scattered yield data, opacity around repairs, and untracked tenancy agreements.',
          solution:
            'Consolidated financial oversight, rental cashflow verification, and auditable unit histories.',
          href: `/${lang}/solutions/property-owners`,
          icon: Briefcase,
        },
        {
          id: 'associations',
          name: 'Associations & Communities',
          problem: 'Statutory cost allocation disputes, mistrust, and opaque manual accounting.',
          solution:
            'Explainable allocation formulas, assisted banking reconciliation, and auditable digital notice records.',
          href: `/${lang}/solutions/associations`,
          icon: Users,
        },
        {
          id: 'managers',
          name: 'Property Management Companies',
          problem: 'Juggling disparate tools across buildings and managing vendor dispatches manually.',
          solution:
            'Multi-asset operational scale, maintenance ticket coordination, and structured statutory reporting.',
          href: `/${lang}/solutions/property-managers`,
          icon: Wrench,
        },
        {
          id: 'residents',
          name: 'Residents & Occupants',
          problem: 'Inconvenient bill payment processes and lack of clear meter consumption records.',
          solution:
            'Self-service mobile portal, direct meter submissions, clear invoices, and service requests.',
          href: `/${lang}/solutions/residents`,
          icon: Home,
        },
        {
          id: 'providers',
          name: 'Service Providers & Trades',
          problem: 'Vague work scopes, disputed invoices, and unpredictable sign-off delays.',
          solution:
            'Structured work orders, verified site check-ins, and auditable work acceptance records.',
          href: `/${lang}/solutions/service-providers`,
          icon: FileCheck2,
        },
      ],
    },
    fa: {
      badge: 'مخاطبان و نقش‌های کلیدی',
      title: 'چه کسانی از معماری پلتفرم کلادورا استفاده می‌کنند',
      subtitle:
        'هر یک از فعالان حوزهٔ املاک نیازمندی‌های متمایزی دارند. کلادورا برای هر نقش رابط کاربری ویژه‌ای متصل به سوابق معتبر واحد فراهم می‌آورد.',
      learnMore: 'اطلاعات بیشتر',
      roles: [
        {
          id: 'builders',
          name: 'سازندگان و توسعه‌دهندگان',
          problem: 'فایل‌های پراکندهٔ پیش‌فروش و تحویل پردردسر ساختمان به هیئت‌مدیره جدید.',
          solution:
            'ثبت هویت واحدها از فاز پروژه، پیگیری تعهدات پیش‌فروش و چارچوب صورت‌جلسه تحویل با اسناد فنی.',
          href: `/${lang}/solutions/developers`,
          icon: Building,
        },
        {
          id: 'owners',
          name: 'مالکان و دارندگان سبد املاک',
          problem: 'عدم شفافیت در بازدهی اجاره‌ها و فقدان گزارش تجمیعی وضعیت واحدها.',
          solution:
            'دید جامع مالی، پیگیری منظم واریز اجاره‌ها و ممیزی کامل وضعیت نگهداری هر ملک.',
          href: `/${lang}/solutions/property-owners`,
          icon: Briefcase,
        },
        {
          id: 'associations',
          name: 'مجتمع‌ها و انجمن‌های مالکان',
          problem: 'اختلاف‌نظر در محاسبه سهم شارژ و ابهام در ترازهای مالی دوره‌ای.',
          solution:
            'فرمول‌های قانونی و شفاف تسهیم هزینه‌ها، تطبیق حسابداری بانکی و تابلوی اعلانات دیجیتال مستند.',
          href: `/${lang}/solutions/associations`,
          icon: Users,
        },
        {
          id: 'managers',
          name: 'شرکت‌های مدیریت بهره‌برداری',
          problem: 'مدیریت سنتی همزمان چند ساختمان و دشواری در هماهنگی پیمانکاران.',
          solution:
            'مدیریت چند پروژه در یک حساب کاربری، هماهنگی تیکت‌های فنی و گزارش‌های ساختاریافته مالی.',
          href: `/${lang}/solutions/property-managers`,
          icon: Wrench,
        },
        {
          id: 'residents',
          name: 'ساکنان و بهره‌برداران',
          problem: 'فرایندهای زمان‌بر پرداخت هزینه‌ها و عدم دسترسی به سوابق مصارف گذشته.',
          solution:
            'پنل آسان کاربری برای اعلام ارقام کنتور، پرداخت مستقیم شارژ و ثبت درخواست تعمیرات.',
          href: `/${lang}/solutions/residents`,
          icon: Home,
        },
        {
          id: 'providers',
          name: 'پیمانکاران و تیم‌های فنی',
          problem: 'شرح کار مبهم، تاخیر در تایید نهایی کار و ابهام در تسویه‌حساب‌ها.',
          solution:
            'سفارش‌های کار مدون با محدوده مشخص، ثبت شواهد انجام کار در محل و تسویه بر پایه مستندات.',
          href: `/${lang}/solutions/service-providers`,
          icon: FileCheck2,
        },
      ],
    },
  }[lang] || {
    badge: 'STAKEHOLDERS & ROLES',
    title: 'Who uses the CLADORA operating architecture',
    subtitle: 'Every participant requires purpose-built workflows.',
    learnMore: 'Learn more',
    roles: [],
  };

  return (
    <section className="py-24 bg-white border-b border-[#E2E8F0]">
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

        {/* 6 Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.roles.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.id}
                className="bg-[#F6F9FC] rounded-2xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#102A43] mb-2">{role.name}</h3>
                  <div className="text-xs text-[#DC2626] font-medium mb-2">
                    <span className="font-bold">Problem: </span>{role.problem}
                  </div>
                  <p className="text-xs text-[#52667A] leading-relaxed mb-6">
                    <span className="font-bold text-[#102A43]">CLADORA: </span>{role.solution}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E2E8F0]">
                  <Link
                    href={role.href}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0E9F8E] group-hover:underline"
                  >
                    <span>{content.learnMore}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
