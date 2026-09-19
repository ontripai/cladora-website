import React from 'react';
import { Language } from '@/types';
import { ShieldCheck, Scale, FileCheck, Layers, TrendingUp } from 'lucide-react';

interface TrustStripProps {
  lang: Language;
}

export const TrustStrip: React.FC<TrustStripProps> = ({ lang }) => {
  const items = [
    {
      icon: Scale,
      title: lang === 'ro' ? 'Alocare Explicabilă' : lang === 'fa' ? 'تخصیص شفاف هزینه‌ها' : 'Explainable Allocations',
      desc: lang === 'ro' ? 'Formule CPI și consum verificabile la nivel de cent' : lang === 'fa' ? 'محاسبه دقیق سهام مشاع و انشعابات با قابلیت ممیزی' : 'Auditable CPI and meter math down to the cent'
    },
    {
      icon: FileCheck,
      title: lang === 'ro' ? 'Control Analitic & Stornare' : lang === 'fa' ? 'کنترل تحلیلی و اسناد اصلاحی' : 'Analytical Control & Reversals',
      desc: lang === 'ro' ? 'Control analitic suplimentar, fără ștergeri — doar stornări auditate' : lang === 'fa' ? 'کنترل تحلیلی تکمیلی با اسناد اصلاحی بدون حذف داده‌های تاریخی' : 'Supplemental analytical ledger with reversals instead of deletions'
    },
    {
      icon: ShieldCheck,
      title: lang === 'ro' ? 'Permisiuni pe Roluri' : lang === 'fa' ? 'تفکیک دسترسی و حریم خصوصی' : 'Role-Based Access',
      desc: lang === 'ro' ? 'Date izolate strict între proprietari, chiriași și cenzori' : lang === 'fa' ? 'جداسازی داده‌های مالی مالک از دسترسی مستأجر' : 'Strict isolation between owner ledger and tenants'
    },
    {
      icon: Layers,
      title: lang === 'ro' ? 'Migrare Controlată' : lang === 'fa' ? 'مهاجرت کنترل‌شده با اجرای موازی' : 'Controlled Migration',
      desc: lang === 'ro' ? 'Shadow Ledger identifică erorile din softurile vechi' : lang === 'fa' ? 'کشف و رفع مغایرت‌ها پیش از استقرار قطعی' : 'Identify historical variances prior to cutover'
    },
    {
      icon: TrendingUp,
      title: lang === 'ro' ? 'Control Portofoliu' : lang === 'fa' ? 'مدیریت یکپارچه سبد املاک' : 'Consolidated Portfolios',
      desc: lang === 'ro' ? 'Un singur cont pentru locuință personală și proprietăți închiriate' : lang === 'fa' ? 'یک حساب کاربری برای سکونت شخصی و واحدهای اجاره‌ای' : 'One unified account for personal residency and rentals'
    }
  ];

  return (
    <div className="py-8 bg-white border-y border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#102A43] uppercase tracking-wide">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#52667A] mt-0.5 leading-snug">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
