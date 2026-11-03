import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { ArrowRight, ShieldCheck, KeyRound, Building2 } from 'lucide-react';

interface UniversalFinalCtaSectionProps {
  lang: Language;
}

export const UniversalFinalCtaSection: React.FC<UniversalFinalCtaSectionProps> = ({ lang }) => {
  return (
    <section className="py-20 bg-[#102A43] text-white relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-radial from-[#1A365D] via-[#102A43] to-[#0A1929] opacity-80 pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#173F5F] border border-[#244A6F] text-xs font-bold text-[#14B8A6]">
          <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          <span>
            {lang === 'ro'
              ? 'Tranziție Ușoară și Suport Dedicat'
              : lang === 'fa'
              ? 'راه‌اندازی آسان و پشتیبانی اختصاصی'
              : 'Smooth Setup & Dedicated Support'}
          </span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
          {lang === 'ro' ? (
            <>
              Pregătit să aduci mai multă claritate și organizare în <span className="text-[#14B8A6]">administrarea proprietății tale</span>?
            </>
          ) : lang === 'fa' ? (
            <>
              آماده برقراری آرامش، نظم و شفافیت در <span className="text-[#14B8A6]">مدیریت املاک و فضاهای خود</span> هستید؟
            </>
          ) : (
            <>
              Ready to bring clarity and confidence to <span className="text-[#14B8A6]">managing your property and spaces</span>?
            </>
          )}
        </h2>

        <p className="text-sm sm:text-base text-[#CBD5E1] max-w-2xl mx-auto leading-relaxed">
          {lang === 'ro'
            ? 'Trimite-ne câteva detalii despre imobilul, spațiile sau asociația ta. Echipa noastră te contactează pentru a discuta opțiunile potrivite și a stabili pașii următori.'
            : lang === 'fa'
            ? 'کافی است مشخصات مختصری از ملک، فضاها یا مجموعهٔ خود را ثبت کنید. کارشناسان ما برای بررسی گزینه‌های مناسب و تعیین مراحل بعدی با شما گفتگو خواهند کرد.'
            : 'Tell us a few details about your property, spaces, or association. Our team will get in touch to discuss suitable options and next steps.'}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href={`/${lang}/contact`}
            className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-[#102A43] bg-[#14B8A6] hover:bg-[#2DD4BF] rounded-xl shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            <span>{lang === 'ro' ? 'Solicită o Discuție' : lang === 'fa' ? 'درخواست مشاوره و گفتگو' : 'Talk to Our Team'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href={`/${lang}/login`}
            className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-white bg-[#173F5F] hover:bg-[#204E75] border border-[#2B567C] rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4 text-[#93E6DC]" />
            <span>{lang === 'ro' ? 'Intră în Cont' : lang === 'fa' ? 'ورود به حساب' : 'Sign In'}</span>
          </Link>
        </div>

        <div className="pt-8 border-t border-[#1C3D5A] max-w-xl mx-auto flex items-center justify-center gap-6 text-xs text-[#9FB3C8]">
          <span>{lang === 'ro' ? 'Fără obligații financiare la trimitere' : lang === 'fa' ? 'بدون تعهد مالی هنگام ارسال فرم' : 'No financial commitment upon inquiry'}</span>
          <span>•</span>
          <span>{lang === 'ro' ? 'Discuție directă cu echipa noastră' : lang === 'fa' ? 'گفتگوی مستقیم با تیم کارشناسان' : 'Direct conversation with our team'}</span>
        </div>

      </div>
    </section>
  );
};
