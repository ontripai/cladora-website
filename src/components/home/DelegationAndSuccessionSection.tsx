import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import {
  ShieldCheck,
  Clock,
  RefreshCw,
  FileCheck2,
  ArrowRight,
  CheckCircle2,
  UserCheck,
  GitBranch,
  Lock
} from 'lucide-react';

interface DelegationAndSuccessionSectionProps {
  lang: Language;
}

export const DelegationAndSuccessionSection: React.FC<DelegationAndSuccessionSectionProps> = ({ lang }) => {
  return (
    <section className="py-20 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Claritate Juridică și Predare Fără Griji' : lang === 'fa' ? 'تعیین مهلت نقش‌ها و تحویل مسئولیت' : 'Clear Roles & Seamless Handover'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro'
              ? 'Drepturi stabilite pe perioade clare și predarea ușoară a gestiunii'
              : lang === 'fa'
              ? 'مدت زمان معین برای هر مسئولیت و تحویل بی‌دردسر امور'
              : 'Time-Bound Permissions & Stress-Free Management Handover'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Schimbarea administratorului, a președintelui de bloc sau a firmei de curățenie nu trebuie să creeze haos ori să șteargă actele din urmă. CLADORA asigură predarea clară a sarcinilor și păstrează intact istoricul deciziilor luate.'
              : lang === 'fa'
              ? 'تغییر مدیر ساختمان، بازرس یا شرکت نگهداری نباید باعث سردرگمی، مفقود شدن پرونده‌ها یا توقف کارهای جاری شود. کلادورا تحویل امور را شفاف می‌کند و سوابق تصمیمات قبلی را بدون دستکاری حفظ می‌نماید.'
              : 'A change of property manager, board president, or service contractor should never create chaos or lose past records. CLADORA keeps handovers organized and protects previous historical decisions.'}
          </p>
        </div>

        {/* 2 Core Columns: Delegation Rules vs Succession Handover */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

          {/* Column 1: Delegation & Scoped Authority */}
          <div className="card-proptech p-8 bg-[#F8FAFC] border-[#D3DCE6] space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                <GitBranch className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#102A43]">
                  {lang === 'ro' ? 'Acordarea Drepturilor & Durata Rolului' : lang === 'fa' ? 'تعیین دسترسی‌ها و مدت اعتبار نقش' : 'Granting Permissions & Role Duration'}
                </h3>
                <span className="text-xs text-[#627D98]">
                  {lang === 'ro' ? 'Fiecare persoană primește doar drepturile necesare pentru perioada cuvenită' : lang === 'fa' ? 'هر شخص فقط در حدود نیاز و برای مدت مشخص دسترسی دارد' : 'Permissions strictly match the role and time window'}
                </span>
              </div>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-[#334E68] leading-relaxed">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Drepturi acordate doar în limitele funcției:' : lang === 'fa' ? 'اعطای دسترسی صرفاً در حیطه وظایف:' : 'Permissions within role boundaries:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Un administrator poate da acces unui contabil sau unui meșter doar pentru atribuțiile stabilite și doar pe durata mandatului său activ.'
                      : lang === 'fa'
                      ? 'مدیر ساختمان می‌تواند به حسابدار یا تکنسین دسترسی بدهد، اما فقط در چارچوب وظایف محوله و در طول دوره مدیریت فعال خودش.'
                      : 'An administrator can grant access to an accountant or technician, but strictly within their own active mandate.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Drepturile delegate depind de rolul principal:' : lang === 'fa' ? 'وابستگی دسترسی‌های کمکی به نقش اصلی:' : 'Delegated rights depend on parent role:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Dacă mandatul administratorului încetează, accesul colaboratorilor desemnați de acesta se oprește automat, pentru a preveni accesul neautorizat.'
                      : lang === 'fa'
                      ? 'با پایان دوره خدمت مدیر، دسترسی همکاران معرفی‌شده توسط او نیز به‌طور خودکار متوقف می‌شود تا امنیت اطلاعات حفظ گردد.'
                      : 'When a manager’s term ends, access for helpers appointed by them ends automatically, keeping building data secure.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Accesul continuu este valabil doar pe baza rolului activ:' : lang === 'fa' ? 'استمرار دسترسی مشروط به ادامه مسئولیت است:' : 'Ongoing access requires an active basis:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Accesul continuu este condiționat de existența unui rol valid (de exemplu, calitatea de proprietar sau administrator în funcție) și se încheie odată cu modificarea sau retragerea autorizării.'
                      : lang === 'fa'
                      ? 'استمرار دسترسی مشروط به داشتن نقشی معتبر (مانند مالکیت واحد یا مدیریت مستقر) است و با پایان یا لغو آن مجوز، دسترسی خاتمه می‌یابد.'
                      : 'Ongoing access depends on an active authorized role (such as current ownership or active management) and concludes when that authorization changes or expires.'}
                  </span>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 2: Accountable Succession Handover */}
          <div className="card-proptech p-8 bg-[#F8FAFC] border-[#D3DCE6] space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#102A43]">
                  {lang === 'ro' ? 'Cum se face Predarea Către Noul Administrator' : lang === 'fa' ? 'نحوه تحویل امور به مدیر یا هیئت‌مدیره جدید' : 'How Handover to New Management Works'}
                </h3>
                <span className="text-xs text-[#627D98]">
                  {lang === 'ro' ? 'Continuitate în gestiune și evidența clară a deciziilor anterioare' : lang === 'fa' ? 'تداوم در مدیریت و شفافیت در ثبت سوابق و تصمیمات قبلی' : 'Management continuity and clear records of prior decisions'}
                </span>
              </div>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-[#334E68] leading-relaxed">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Data exactă de predare a gestiunii:' : lang === 'fa' ? 'تاریخ دقیق تحویل و شروع مسئولیت جدید:' : 'Exact effective handover date:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Predarea consemnează data stabilită, încheierea vechiului mandat și drepturile aprobate pentru noul administrator.'
                      : lang === 'fa'
                      ? 'در تحویل، تاریخ مقرر، پایان مسئولیت قبلی و دسترسی‌های مصوب مدیر جدید ثبت می‌شود.'
                      : 'The handover records the effective date, the end of the previous mandate, and approved access for the incoming manager.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Preluarea dosarelor și a sarcinilor în curs:' : lang === 'fa' ? 'تحویل پرونده‌ها و کارهای در دست اقدام:' : 'Access to files and ongoing tasks:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Noul administrator poate consulta documentele necesare și poate urmări sarcinile în curs, în limitele accesului aprobat.'
                      : lang === 'fa'
                      ? 'مدیر جدید می‌تواند در حدود دسترسی مصوب، مدارک لازم را بررسی و کارهای جاری را پیگیری کند.'
                      : 'The incoming manager can consult necessary records and follow ongoing tasks within their approved access.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Semnăturile din trecut rămân neschimbate:' : lang === 'fa' ? 'امضاها و تصمیمات قبلی تغییر نمی‌کنند:' : 'Historical signatures remain intact:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Listele de plată, evidențele și procesele-verbale întocmite în trecut păstrează asocierea cu persoanele care le-au înregistrat la acel moment. Noul administrator va semna actele emise din momentul preluării.'
                      : lang === 'fa'
                      ? 'اسناد مالی، صورت‌جلسات و سوابق ثبت‌شده در دوره‌های قبل، انتساب خود را به ثبت‌کنندگان وقت حفظ می‌کنند و مدیر جدید اسناد صادره پس از تحویل را امضا می‌نماید.'
                      : 'Past fee sheets, operational records, and minutes retain their recorded author attributions. The incoming manager signs records created from the handover date onward.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Predarea vizează doar funcția, nu și dreptul de proprietate:' : lang === 'fa' ? 'تحویل مربوط به سمت مدیریتی است، نه مالکیت شخصی:' : 'Handover affects the management role, not personal ownership:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Când un administrator își încheie mandatul, își pierde doar drepturile de administrare. Dacă deține un apartament în bloc, dreptul său de proprietar rămâne neatins.'
                      : lang === 'fa'
                      ? 'با پایان دوره مدیریت، فقط دسترسی به پنل مدیریت بسته می‌شود؛ اگر آن فرد در ساختمان آپارتمانی داشته باشد، حق مالکیت و دسترسی شخصی او کاملاً پابرجاست.'
                      : 'Ending a management term revokes only administrative privileges. If the former manager owns an apartment in the building, their rights as an owner remain untouched.'}
                  </span>
                </div>
              </li>
            </ul>
          </div>

        </div>

      </div>
    </section>
  );
};
