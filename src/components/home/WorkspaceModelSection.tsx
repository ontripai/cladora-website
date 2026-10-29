import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import {
  Building2,
  Layers,
  Users,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Key,
  Lock,
  RefreshCw,
  Building
} from 'lucide-react';

interface WorkspaceModelSectionProps {
  lang: Language;
}

export const WorkspaceModelSection: React.FC<WorkspaceModelSectionProps> = ({ lang }) => {
  return (
    <section className="py-20 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Structura pe Înțelesul Tuturor' : lang === 'fa' ? 'ساختار شفاف و ساده' : 'Simple & Clear Foundation'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro'
              ? 'Cum este organizată CLADORA: Clădirea, Spațiul de Lucru și Oamenii'
              : lang === 'fa'
              ? 'ساختار CLADORA در عمل: ساختمان، فضای کاری و نقش افراد'
              : 'How CLADORA Works: Buildings, Workspaces, and People'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Pentru ca administrarea să meargă fără confuzie, CLADORA separă clar trei lucruri: clădirea fizică, spațiul de lucru al fiecărei organizații și persoanele cu drepturi de acces.'
              : lang === 'fa'
              ? 'برای جلوگیری از هرگونه سردرگمی یا تداخل اطلاعات، کلادورا سه بخش را کاملاً مشخص نگه می‌دارد: ساختمان و فضاها، فضای کاری اختصاصی هر سازمان، و اشخاص با دسترسی‌های معین.'
              : 'To keep management straightforward and secure, CLADORA clearly separates three things: physical properties and spaces, each organization’s dedicated workspace, and individual users with defined access.'}
          </p>
        </div>

        {/* 3 Pillars Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-14">

          {/* 1. Property & Asset */}
          <div className="card-proptech p-7 bg-[#F8FAFC] border-[#D3DCE6] flex flex-col justify-between relative overflow-hidden group hover:border-[#0E9F8E] transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold text-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider block">
                {lang === 'ro' ? '1. Locul Fizic' : lang === 'fa' ? 'بخش ۱ • فضای فیزیکی' : 'Pillar 1 • The Physical Space'}
              </span>
              <h3 className="text-xl font-bold text-[#102A43]">
                {lang === 'ro' ? 'Clădirea, Spațiile și Echipamentele' : lang === 'fa' ? 'ساختمان، واحدها و تأسیسات' : 'Buildings, Units & Equipment'}
              </h3>
              <p className="text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Clădirea în sine, apartamentele, birourile, spațiile comune și echipamentele tehnice (centrale, lifturi, contoare). Toate datele tehnice și intervențiile rămân legate de imobil în timp.'
                  : lang === 'fa'
                  ? 'کل ساختمان، آپارتمان‌ها، فضاها، مشاعات و تجهیزات فنی (آسانسور، موتورخانه، کنتورها). سوابق فنی و تعمیرات در گذر زمان برای همان ملک محفوظ می‌ماند.'
                  : 'The physical property itself, units, commercial spaces, common areas, and technical equipment (lifts, boilers, meters). Technical logs and maintenance history remain tied to the property over time.'}
              </p>
            </div>
            <div className="pt-6 border-t border-[#E2E8F0] mt-6 text-xs text-[#334E68] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{lang === 'ro' ? 'Istoric continuu al clădirii' : lang === 'fa' ? 'سابقه پیوسته و ماندگار ملک' : 'Continuous building history'}</span>
            </div>
          </div>

          {/* 2. Workspace */}
          <div className="card-proptech p-7 bg-[#F8FAFC] border-[#0E9F8E]/40 ring-1 ring-[#0E9F8E]/20 flex flex-col justify-between relative overflow-hidden group hover:border-[#0E9F8E] transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0E9F8E] text-white flex items-center justify-center font-bold text-lg">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider block">
                {lang === 'ro' ? '2. Spațiul Privat de Lucru' : lang === 'fa' ? 'بخش ۲ • فضای کاری اختصاصی' : 'Pillar 2 • Private Workspace'}
              </span>
              <h3 className="text-xl font-bold text-[#102A43]">
                {lang === 'ro' ? 'Workspace (Spațiul de Lucru al Organizației)' : lang === 'fa' ? 'فضای کاری سازمان (Workspace)' : 'Workspace (Organization Workspace)'}
              </h3>
              <p className="text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Spațiul de lucru al unei asociații de proprietari, al unui dezvoltator sau al unei firme de administrare. Documentele interne, deciziile și evidențele financiare rămân protejate în cadrul fiecărui spațiu.'
                  : lang === 'fa'
                  ? 'فضای کاری ویژه برای انجمن مالکان، شرکت مدیریت یا سازنده. اسناد داخلی، تصمیمات و دفاتر حسابداری در مرز کاری همان مجموعه محافظت می‌شوند.'
                  : 'The dedicated operational workspace for a homeowners’ association, property manager, or developer. Internal records, decisions, and accounting remain protected within each workspace.'}
              </p>
            </div>
            <div className="pt-6 border-t border-[#E2E8F0] mt-6 text-xs text-[#334E68] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{lang === 'ro' ? 'Separare clară și confidențialitate între organizații' : lang === 'fa' ? 'تفکیک مشخص و حفظ حریم اطلاعات میان سازمان‌ها' : 'Clear separation and privacy between organizations'}</span>
            </div>
          </div>

          {/* 3. Persons, Roles & Relationships */}
          <div className="card-proptech p-7 bg-[#F8FAFC] border-[#D3DCE6] flex flex-col justify-between relative overflow-hidden group hover:border-[#0E9F8E] transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold text-lg">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider block">
                {lang === 'ro' ? '3. Oamenii și Drepturile Lor' : lang === 'fa' ? 'بخش ۳ • افراد و اختیارات' : 'Pillar 3 • People & Access'}
              </span>
              <h3 className="text-xl font-bold text-[#102A43]">
                {lang === 'ro' ? 'Persoane, Roluri și Permisiuni' : lang === 'fa' ? 'اشخاص، نقش‌ها و دسترسی‌ها' : 'People, Roles & Permissions'}
              </h3>
              <p className="text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Proprietari, chiriași, membri ai comitetului, administratori sau meșteri. Fiecare vede doar ce are dreptul să vadă, pe perioada în care este autorizat.'
                  : lang === 'fa'
                  ? 'مالکان، مستأجران، مدیران، اعضای هیئت‌مدیره و تکنسین‌ها. هر کس دقیقاً اطلاعات مربوط به خود و نقش معتبرش را مشاهده می‌کند.'
                  : 'Owners, tenants, board members, property managers, and technicians. Everyone sees only what they are authorized to see, for the duration of their role.'}
              </p>
            </div>
            <div className="pt-6 border-t border-[#E2E8F0] mt-6 text-xs text-[#334E68] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{lang === 'ro' ? 'Un singur cont, roluri clare fără confuzie' : lang === 'fa' ? 'یک حساب واحد با نقش‌های مشخص' : 'One account, clear roles without confusion'}</span>
            </div>
          </div>

        </div>

        {/* Practical Rules Callout */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-10 border border-[#173F5F] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#244A6F] pb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0E9F8E] flex items-center justify-center text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-lg font-bold">
                  {lang === 'ro' ? 'Trei reguli simple pentru siguranță și claritate' : lang === 'fa' ? 'سه قاعده ساده برای نظم و امنیت' : 'Three Simple Rules for Clarity & Security'}
                </h4>
                <p className="text-xs text-[#9FB3C8]">
                  {lang === 'ro' ? 'Cum păstrăm datele în siguranță și predarea responsabilităților simplă' : lang === 'fa' ? 'چگونگی حفظ امنیت داده‌ها و سهولت در تحویل مسئولیت' : 'Keeping data safe and role handovers organized'}
                </p>
              </div>
            </div>

            <Link
              href={`/${lang}/platform`}
              className="text-xs font-bold text-[#14B8A6] hover:text-[#5EEAD4] flex items-center gap-1 self-start sm:self-auto"
            >
              <span>{lang === 'ro' ? 'Află mai multe detalii' : lang === 'fa' ? 'اطلاعات بیشتر درباره معماری پلتفرم' : 'Learn more about the architecture'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs text-[#CBD5E1] leading-relaxed">
            <div className="space-y-1.5">
              <span className="font-bold text-white block text-sm">
                {lang === 'ro' ? '1. Un utilizator, mai multe roluri' : lang === 'fa' ? '۱. یک کاربر با چند نقش' : '1. One user, multiple roles'}
              </span>
              <p>
                {lang === 'ro'
                  ? 'Poți fi proprietar într-un bloc și chiriaș în altul. Treci de la un rol la altul dintr-un singur clic, fără să încurci conturile.'
                  : lang === 'fa'
                  ? 'می‌توانید در یک مجتمع مالک باشید و در ساختمانی دیگر مستأجر. با یک کلیک بین نقش‌ها جابه‌جا شوید، بدون نیاز به حساب‌های کاربری جداگانه.'
                  : 'You can be an owner in one building and a tenant in another. Switch between contexts with one click, without mixing up accounts.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-white block text-sm">
                {lang === 'ro' ? '2. Proprietari de locuințe sau spații multiple' : lang === 'fa' ? '۲. مدیریت املاک یا واحدهای متعدد' : '2. Managing multiple properties or units'}
              </span>
              <p>
                {lang === 'ro'
                  ? 'Dacă deții locuințe, birouri sau spații în clădiri diferite, le poți urmări într-un singur cont de utilizator, în timp ce datele fiecărui imobil rămân separate.'
                  : lang === 'fa'
                  ? 'اگر مالک آپارتمان‌ها، دفاتر یا فضاهایی در ساختمان‌های گوناگون هستید، می‌توانید همه را در یک حساب کاربری دنبال کنید؛ در حالی که داده‌های هر ملک تفکیک‌شده می‌ماند.'
                  : 'If you own apartments, offices, or commercial spaces across different buildings, you can track them in a single user account while keeping each property’s workspace separate.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-white block text-sm">
                {lang === 'ro' ? '3. Conectate la clădire, dar cu date separate' : lang === 'fa' ? '۳. ارتباط با ملک بدون تداخل اسناد' : '3. Connected to the building, private data'}
              </span>
              <p>
                {lang === 'ro'
                  ? 'Chiar dacă o asociație și o firmă de administrare colaborează pentru aceeași clădire, documentele lor interne și registrele de lucru nu se amestecă.'
                  : lang === 'fa'
                  ? 'حتی اگر انجمن مالکان و شرکت خدمات برای یک ساختمان همکاری کنند، اسناد حسابداری و پیام‌های داخلی هر کدام کاملاً تفکیک‌شده می‌ماند.'
                  : 'Even if an association and a management company work on the same building, their internal documents and operational ledgers remain strictly separated.'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
