import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  ShieldCheck, 
  Lock, 
  EyeOff, 
  FileCheck2, 
  Database, 
  Server, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface TrustAndResponsibleAccessSectionProps {
  lang: Language;
}

export const TrustAndResponsibleAccessSection: React.FC<TrustAndResponsibleAccessSectionProps> = ({ lang }) => {
  return (
    <section className="py-20 bg-[#F8FAFC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Securitate Fără Compromis' : lang === 'fa' ? 'امنیت، حریم خصوصی و دسترسی مسئولانه' : 'Responsible Access & Trust'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Protecția datelor și securitatea la nivel de arhitectură' 
              : lang === 'fa' 
              ? 'امنیت در پشت صحنه؛ سادگی در برابر کاربر' 
              : 'Security in the Foundation, Clarity for the User'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Datele financiare și documentele de proprietate necesită o protecție riguroasă. CLADORA aplică reguli stricte de confidențialitate și acces contextual, fără a complica experiența de zi cu zi.'
              : lang === 'fa'
              ? 'اطلاعات ملکی و دفاتر مالی نیازمند بالاترین سطح محرمانگی هستند. کنترل‌های سخت‌گیرانه امنیتی در هسته سیستم اعمال می‌شوند و کاربر با محیطی شفاف، ساده و بدون پیچیدگی روبه‌رو است.'
              : 'Financial records and title documentation demand bank-grade safeguards. CLADORA enforces strict context-based isolation while keeping daily workflows clean and intuitive.'}
          </p>
        </div>

        {/* 4 Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          
          <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Separare Logică în Workspace' : lang === 'fa' ? 'تفکیک منطقی داده‌ها در Workspace' : 'Logical Workspace Boundaries'}
            </h3>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Nicio organizație sau asociație nu poate accesa registrele alteia. Datele sunt separate logic prin politici stricte de autorizare și context de lucru.'
                : lang === 'fa'
                ? 'اطلاعات هیچ سازمان یا انجمنی بدون مجوز برای دیگری قابل مشاهده نیست. مرزهای امن داده‌ها با کنترل‌های دقیق دسترسی و هویت در سامانه تفکیک می‌شوند.'
                : 'Workspaces enforce strict authorization boundaries and tenant context so that no organization accesses another’s operational ledgers.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Vizibilitate pe Baza Relației' : lang === 'fa' ? 'دسترسی مبتنی بر رابطه و نقش' : 'Relationship-Aware Scopes'}
            </h3>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Chiriașul vede doar cheltuielile operaționale proprii; registrele contabile, fondurile de reparații și actele proprietarului rămân confidențiale.'
                : lang === 'fa'
                ? 'مستأجر منحصراً مصارف و خدمات مربوط به خود را مشاهده می‌کند؛ اسناد مالکیت، صندوق‌های سرمایه‌ای و اطلاعات اختصاصی مالک محرمانه می‌مانند.'
                : 'Tenants view authorized personal utility consumption without exposure to owner confidential accounts or private agreements.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Verificare Suplimentară pentru Acțiuni Critice' : lang === 'fa' ? 'تأیید دومرحله‌ای برای عملیات حساس' : 'Step-Up Verification for Critical Actions'}
            </h3>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Modificarea conturilor bancare, închiderea lunară a balanței sau votul în adunarea generală cer confirmare sporită pentru prevenirea erorilor.'
                : lang === 'fa'
                ? 'تغییر شماره حساب یا شبا، بستن رسمی دوره مالی یا ثبت رأی در مجامع عمومی نیازمند تأیید مرحله‌ای با رمز یک‌بارمصرف است.'
                : 'High-impact financial closes, IBAN modifications, and governance votes require additional multi-factor confirmation steps.'}
            </p>
          </div>

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">
              {lang === 'ro' ? 'Pistă de Audit & Păstrare Conform Politicii' : lang === 'fa' ? 'ثبت ردپای حسابرسی طبق سیاست نگهداری' : 'Audit Trail & Policy-Based Retention'}
            </h3>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Fiecare factură aprobată, plată reconciliată sau modificare de index este înregistrată cu autor și dată, fiind păstrată conform politicii de retenție autorizate.'
                : lang === 'fa'
                ? 'تراکنش‌ها، تغییر ارقام کنتورها، مصوبات و پرداخت‌ها با شناسه عامل و زمان دقیق ثبت می‌شوند و نگهداری آن‌ها طبق سیاست معتبر سازمانی مدیریت می‌گردد.'
                : 'Approved transactions, meter revisions, and governance decisions record the executing actor and timestamp under authorized retention policies.'}
            </p>
          </div>

        </div>

        {/* Responsible Access Callout */}
        <div className="p-6 rounded-2xl bg-white border border-[#CBD5E1] text-xs text-[#52667A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-[#0E9F8E] shrink-0" />
            <span>
              {lang === 'ro'
                ? 'Drepturile asupra datelor și exporturile conforme sunt asigurate prin contract și politici clare de confidențialitate.'
                : lang === 'fa'
                ? 'مالکیت داده‌ها و دسترسی به اطلاعات بر مبنای حقوق قانونی و قراردادهای معتبر است و خروجی استاندارد از سوابق مجاز فراهم می‌باشد.'
                : 'Data ownership, privacy, and standard record exports are governed by clear contractual terms and regulatory compliance.'}
            </span>
          </div>

          <Link
            href={`/${lang}/trust`}
            className="text-xs font-bold text-[#0E9F8E] hover:underline shrink-0 flex items-center gap-1"
          >
            <span>{lang === 'ro' ? 'Detalii securitate & confidențialitate' : lang === 'fa' ? 'سیاست‌های امنیتی و محرمانگی' : 'Security & Trust specs'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

      </div>
    </section>
  );
};
