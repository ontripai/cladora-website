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
            {lang === 'ro' ? 'Guvernanță & Continuitate Juridică' : lang === 'fa' ? 'مدیریت نقش‌ها، مدت اعتبار و جانشینی' : 'Governance & Accountable Succession'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Roluri cu termen limitat și predare transparentă a responsabilităților' 
              : lang === 'fa' 
              ? 'اختیار زمان‌دار، عدم ابهام در مسئولیت و تحویل بی‌نقص کارها' 
              : 'Time-Bound Delegation & Accountable Handover'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Schimbarea unui administrator, a unui președinte sau a unei firme de mentenanță nu trebuie să blocheze activitatea sau să șteargă dovezile din trecut. CLADORA gestionează ciclurile de delegare și succesiune cu rigoare juridică și operațională.'
              : lang === 'fa'
              ? 'تغییر مدیر، بازرس یا پیمانکار نگهداری نباید سوابق را مخدوش کند یا کارهای جاری را معطل بگذارد. کلادورا مدل تفویض اختیار و تحویل مسئولیت را با بالاترین دقت حقوقی و حسابرسی اجرا می‌کند.'
              : 'Leadership or vendor turnover must never compromise past audit evidence or stall operations. CLADORA implements disciplined delegation trees and effective-dated succession.'}
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
                  {lang === 'ro' ? 'Arborele de Delegare & Durata Mandatului' : lang === 'fa' ? 'تفویض اختیار و مدت زمان اعتبار نقش' : 'Delegation Tree & Mandate Duration'}
                </h3>
                <span className="text-xs text-[#627D98]">
                  {lang === 'ro' ? 'Niciun rol subordonat nu depășește autoritatea părintelui' : lang === 'fa' ? 'اختیار زیرمجموعه هرگز از اختیار والد فراتر نمی‌رود' : 'Child authority never exceeds parent scope'}
                </span>
              </div>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-[#334E68] leading-relaxed">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Delegare strict în limitele autorității efective:' : lang === 'fa' ? 'اعطای نقش صرفاً در حدود اختیارات مؤثر:' : 'Bounded delegation:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Un administrator poate atribui roluri subordonate, stabili termene de valabilitate sau revoca accesul doar în perimetrul propriului mandat valid.'
                      : lang === 'fa'
                      ? 'مدیر فقط در محدودهٔ اختیار مؤثر خود می‌تواند به افراد نقش بدهد، برای آن‌ها مدت اعتبار تعیین کند، تمدید نماید یا دسترسی را بازپس بگیرد.'
                      : 'Administrators may assign local roles, define validity windows, or revoke access only within their own active mandate.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Dependența de mandatul părinte:' : lang === 'fa' ? 'وابستگی اختیارات فرزند به والد:' : 'Cascade revocation:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Autoritatea delegată nu poate depăși ca termen sau ca permisiuni autoritatea celui care a acordat-o. Expirarea mandatului superior suspendă automat accesul subordonat.'
                      : lang === 'fa'
                      ? 'اختیار فرزند از مجوز، محدوده و مدت اعتبار والد فراتر نمی‌رود؛ پایان یا لغو اختیار والد بلافاصله بر اختیارات وابسته اثر می‌گذارد.'
                      : 'Child authority cannot outlive or exceed parent permissions. Revocation of a parent mandate immediately cascades to dependent assignments.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Acces fără termen doar pe baze active:' : lang === 'fa' ? 'دسترسی بدون تاریخ پایان مشروط به اعتبار مبانی:' : 'Open-ended access conditioned on active bases:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Accesul fără dată de expirare fixă este permis doar pe durata validității tuturor temeiurilor necesare (inclusiv autoritatea părinte și mandatul din Workspace) și rămâne revocabil sau caduc la încetarea acestora.'
                      : lang === 'fa'
                      ? 'دسترسی بدون تاریخ پایان تنها تا زمان استمرار اعتبار کلیه مبانی لازم (از جمله اختیار والد و مبنای دسترسی Workspace) مجاز است و در صورت تغییر یا ابطال مبنا، همچنان قابل لغو یا بی‌اثرشدن خواهد بود.'
                      : 'Access without a set expiration date is permissible only while all prerequisite grounds (including parent authority and active Workspace entitlement) remain valid, and remains strictly revocable or voidable if any basis lapses.'}
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
                  {lang === 'ro' ? 'Protocolul de Predare & Succesiune' : lang === 'fa' ? 'پروتکل تحویل مسئولیت و جانشینی' : 'Succession Handover Protocol'}
                </h3>
                <span className="text-xs text-[#627D98]">
                  {lang === 'ro' ? 'Continuitate operațională cu semnături istorice protejate' : lang === 'fa' ? 'حفظ کامل سوابق پیشین و شروع رسمی فعالیت جانشین' : 'Protected historical actions & clean transition'}
                </span>
              </div>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-[#334E68] leading-relaxed">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Dată de efect și încheiere ordonată:' : lang === 'fa' ? 'تعیین تاریخ مؤثر و ثبت سابقه جانشینی:' : 'Effective-dated cutover:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Predarea responsabilității include încetarea formală a mandatului anterior și activarea succesorului la o dată de efect precisă, auditată în sistem.'
                      : lang === 'fa'
                      ? 'تحویل مسئولیت شامل پایان یافتن اختیار قبلی و شروع اختیار جانشین با درج زمان مؤثر و ثبت سابقهٔ قابل پیگیری در سامانه است.'
                      : 'Succession records the exact effective timestamp ending prior authority and starting the successor mandate without historical gaps.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Preluarea sarcinilor și accesul la arhive autorizate:' : lang === 'fa' ? 'دسترسی جانشین به سوابق و پیگیری کارهای باز:' : 'Successor record access:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Succesorul primește acces doar la dosarele autorizate necesare continuării activității și preia tichetele și sarcinile deschise.'
                      : lang === 'fa'
                      ? 'جانشین منحصراً به سوابق مجاز دسترسی پیدا می‌کند و می‌تواند پیگیری کارهای باز و تعهدات معوق را بدون وقفه ادامه دهد.'
                      : 'The successor gains access strictly to permitted historical files and open tasks required to carry forward operations smoothly.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Semnăturile trecute nu se rescriu:' : lang === 'fa' ? 'تفکیک قطعی امضاهای گذشته از اقدامات جدید:' : 'Historical attribution preserved:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Deciziile, aprobările de plată și listele afișate anterior rămân asociate persoanelor care le-au semnat la momentul respectiv. Acțiunile noi se înregistrează pe numele noului titular.'
                      : lang === 'fa'
                      ? 'اقدامات، تأییدیه‌ها و امضاهای گذشته دقیقاً به نام اشخاص قبلی محفوظ می‌مانند؛ اقدامات و اسناد جدید به نام شخص جدید ثبت و امضا می‌شوند.'
                      : 'Past approvals, journal posts, and notices remain permanently signed by the historical actor. New transactions are attributed to the successor.'}
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#102A43] block">
                    {lang === 'ro' ? 'Delimitarea răspunderii de identitate și alte roluri:' : lang === 'fa' ? 'تفکیک پایان مسئولیت از مالکیت و دسترسی‌های مستقل:' : 'Scope limited to handed-over responsibility:'}
                  </strong>
                  <span>
                    {lang === 'ro'
                      ? 'Predarea responsabilității nu este identică cu transferul proprietății imobilului sau identitatea persoanei. Încetarea accesului vizează strict mandatul predat; alte drepturi independente și valide ale persoanei (cum ar fi calitatea de proprietar) rămân neschimbate.'
                      : lang === 'fa'
                      ? 'تحویل مسئولیت با انتقال مالکیت ملک یا تغییر هویت شخص یکسان نیست. پایان دسترسی صرفاً بر مسئولیت واگذارشده تمرکز دارد و حقوق مستقل دیگر فرد (مانند مالکیت یک واحد) را مخدوش نمی‌کند.'
                      : 'Handover of responsibility is not synonymous with property title transfer or personal identity change. Revocation targets only the transferred mandate, leaving independent valid roles intact.'}
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
