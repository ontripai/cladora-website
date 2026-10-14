import React from 'react';
import { Language } from '@/types';
import { Building2, Layers, KeyRound, Database, TrendingUp, Activity, CheckCircle2 } from 'lucide-react';

interface WhyCladoraSectionProps {
  lang: Language;
}

export const WhyCladoraSection: React.FC<WhyCladoraSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'DIFERENȚIATORI STRUCTURALI',
      title: 'De ce arhitectura CLADORA este diferită',
      subtitle:
        'Nu facem comparații agresive de marketing. Ne definim prin șase principii structurale fundamentale de proiectare a sistemului.',
      differentiators: [
        {
          name: 'Identitate Unică a Proprietății',
          principle:
            'Proprietatea fizică este subiectul central persistent. Schimbările de administrație sau vânzările nu șterg cartea tehnică sau evidențele istorice.',
          icon: Building2,
        },
        {
          name: 'Izolarea Strictă a Workspace-urilor',
          principle:
            'Organizațiile și comunitățile operează în granițe logice securizate, eliminând riscul scurgerilor de date sau accesului neautorizat.',
          icon: Layers,
        },
        {
          name: 'Autoritate Contextuală pe Mandat',
          principle:
            'Drepturile de acces sunt legate de mandate legale cu termen definit și responsabilitate clară, nu de permisiuni globale opace.',
          icon: KeyRound,
        },
        {
          name: 'Adevăr Canonic de Sistem',
          principle:
            'Fiecare capabilitate are un singur subsistem responsabil de adevăr. Datele financiare și starea unităților nu sunt duplicate.',
          icon: Database,
        },
        {
          name: 'Continuitate pe Ciclul de Viață',
          principle:
            'Evidențele autorizate sunt concepute să dureze zeci de ani, asigurând o predare fără fricțiuni între dezvoltator, asociație și proprietari.',
          icon: TrendingUp,
        },
        {
          name: 'Domenii Compozabile',
          principle:
            'AIRPROP, SERVICE și Operațiunile funcționează ca extensii specializate sincronizate pe același registru, nu ca produse deconectate.',
          icon: Activity,
        },
      ],
    },
    en: {
      badge: 'STRUCTURAL DIFFERENTIATORS',
      title: 'Why CLADORA architecture is structurally different',
      subtitle:
        'Rather than relying on aggressive marketing comparisons, we ground our platform on six foundational system design principles.',
      differentiators: [
        {
          name: 'One Property Identity',
          principle:
            'The physical property is the persistent subject. Administrative turnovers or property transfers never erase the asset history or digital logbook.',
          icon: Building2,
        },
        {
          name: 'Workspace Isolation',
          principle:
            'Operational entities and communities function within strictly segregated boundaries, eliminating cross-tenant leakage or boundary drift.',
          icon: Layers,
        },
        {
          name: 'Contextual Authority',
          principle:
            'Access rights derive from verifiable, time-bounded legal mandates with clear accountability, rather than untracked global accounts.',
          icon: KeyRound,
        },
        {
          name: 'Canonical Truth',
          principle:
            'Every capability has a single definitive subsystem owner. Financial ledgers and unit identities are never duplicated across parallel silos.',
          icon: Database,
        },
        {
          name: 'Lifecycle Continuity',
          principle:
            'Authorized operational records persist across decades of asset ownership, enabling frictionless handovers between stakeholders.',
          icon: TrendingUp,
        },
        {
          name: 'Composable Domains',
          principle:
            'AIRPROP, SERVICE, and Operations run as specialized workflow engines synchronized to the same ledger, not disparate third-party silos.',
          icon: Activity,
        },
      ],
    },
    fa: {
      badge: 'تمایزهای بنیادین در معماری سامانه',
      title: 'چرا معماری کلادورا از ریشه متفاوت طراحی شده است',
      subtitle:
        'به جای ادعاهای تبلیغاتی اغراق‌آمیز، کلادورا بر پایهٔ شش اصل استاندارد در مهندسی نرم‌افزار و معماری داده‌ها بنا شده است.',
      differentiators: [
        {
          name: 'یکتایی هویت ملک',
          principle:
            'ملک فیزیکی موضوع پایدار سیستم است. تغییر مدیران یا انتقال مالکیت، شناسنامه فنی یا سوابق گذشته را پاک نمی‌کند.',
          icon: Building2,
        },
        {
          name: 'جداسازی دقیق ورک‌اسپیس‌ها',
          principle:
            'سازمان‌ها و مجتمع‌ها در مرزهای امن و کاملاً ایزوله فعالیت می‌کنند که مانع از تداخل اطلاعاتی یا دسترسی غیرمجاز می‌شود.',
          icon: Layers,
        },
        {
          name: 'اختیارات بر مبنای مجوز قانونی',
          principle:
            'سطح دسترسی حاصل مجوزهای معتبر، دارای محدوده مشخص و زمان‌دار است و با پایان مسئولیت به‌طور شفاف منتقل می‌شود.',
          icon: KeyRound,
        },
        {
          name: 'حقیقت واحد داده‌ها',
          principle:
            'هر نوع اطلاعات تنها یک مرجع اصلی در سیستم دارد. اسناد مالی و مشخصات واحدها در بخش‌های گوناگون کپی و ناهماهنگ نمی‌شوند.',
          icon: Database,
        },
        {
          name: 'پیوستگی در تمام چرخهٔ عمر',
          principle:
            'سوابق مجاز برای دهه‌ها بهره‌برداری پیوسته طراحی شده‌اند و امکان تحویل بدون اختلاف میان سازنده، مدیران و مالکان را میسر می‌سازند.',
          icon: TrendingUp,
        },
        {
          name: 'دامنه‌های مکمل و هماهنگ',
          principle:
            'ایرپراپ، سرویس و عملیات فنی به عنوان موتورهای اجرایی تخصصی روی یک دفتر کل عمل می‌کنند و برنامه‌های جزیره‌ای نیستند.',
          icon: Activity,
        },
      ],
    },
  }[lang] || {
    badge: 'STRUCTURAL DIFFERENTIATORS',
    title: 'Why CLADORA architecture is different',
    subtitle: 'Six foundational system design principles.',
    differentiators: [],
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

        {/* 6 Differentiators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {content.differentiators.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className="bg-[#F6F9FC] rounded-2xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#102A43] mb-2">{item.name}</h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">{item.principle}</p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
