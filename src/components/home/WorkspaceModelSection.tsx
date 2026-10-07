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
            {lang === 'ro' ? 'Arhitectura Conceptuală CLADORA' : lang === 'fa' ? 'مدل سه‌گانه مفهوم کلادورا' : 'Conceptual Foundation'}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Cum funcționează CLADORA: Proprietate, Workspace & Persoane' 
              : lang === 'fa' 
              ? 'تفاوت بنیادین ملک و دارایی، Workspace و اشخاص' 
              : 'How CLADORA Works: Property, Workspace & People'}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'Pentru a elimina confuzia și riscurile de securitate, CLADORA distinge cu claritate între obiectul fizic al serviciului, granița de colaborare a fiecărei organizații și persoanele care dețin drepturi valide.'
              : lang === 'fa'
              ? 'برای برقراری نظم حقوقی و جلوگیری از تداخل اطلاعات، سه مفهوم بنیادین در کلادورا کاملاً از یکدیگر تفکیک شده‌اند:'
              : 'To eliminate ambiguity and prevent unauthorized data sharing, CLADORA strictly distinguishes between the physical subject of service, the operational collaboration boundary, and individual authorized actors.'}
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
                {lang === 'ro' ? 'Pilonul 1 • Subiectul Serviciului' : lang === 'fa' ? 'مفهوم اول • موضوع خدمت' : 'Pillar 1 • The Subject'}
              </span>
              <h3 className="text-xl font-bold text-[#102A43]">
                {lang === 'ro' ? 'Proprietatea & Activul' : lang === 'fa' ? 'ملک، فضا و دارایی' : 'Property & Physical Assets'}
              </h3>
              <p className="text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Entitatea fizică ce traversează timpul: ansamblul, clădirea, unitatea individuală (apartament, birou, spațiu comercial, hală), spațiile comune, echipamentele tehnice (centrale, lifturi, pompe) și branșamentele.'
                  : lang === 'fa'
                  ? 'موضوع و بستر خدمات؛ شامل کل مجموعه، ساختمان، واحد (مسکونی، اداری، تجاری یا صنعتی)، فضاهای مشترک، تأسیسات و تجهیزات فنی (آسانسور، موتورخانه، پمپ‌ها) و کنتورها.'
                  : 'The enduring physical entity: estate, building, unit (residential, commercial, retail, industrial), common areas, utility meters, and physical assets (HVAC, elevators, pumps).'}
              </p>
            </div>
            <div className="pt-6 border-t border-[#E2E8F0] mt-6 text-xs text-[#334E68] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{lang === 'ro' ? 'Identitate unică și istoric continuu' : lang === 'fa' ? 'هویت تغییرناپذیر و سابقه ماندگار' : 'Persistent identity & lifetime history'}</span>
            </div>
          </div>

          {/* 2. Workspace */}
          <div className="card-proptech p-7 bg-[#F8FAFC] border-[#0E9F8E]/40 ring-1 ring-[#0E9F8E]/20 flex flex-col justify-between relative overflow-hidden group hover:border-[#0E9F8E] transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0E9F8E] text-white flex items-center justify-center font-bold text-lg">
                <Layers className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider block">
                {lang === 'ro' ? 'Pilonul 2 • Granița de Securitate' : lang === 'fa' ? 'مفهوم دوم • مرز اطلاعات و اختیار' : 'Pillar 2 • Collaboration Boundary'}
              </span>
              <h3 className="text-xl font-bold text-[#102A43]">
                {lang === 'ro' ? 'Workspace (Spațiul de Lucru)' : lang === 'fa' ? 'محیط کاری (Workspace)' : 'Workspace Boundary'}
              </h3>
              <p className="text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Mediul de colaborare al unei organizații sau al unui grup specific. Reprezintă granița strictă a informațiilor, deciziilor, documentelor și responsabilităților contractuale.'
                  : lang === 'fa'
                  ? 'محیط همکاری یک سازمان یا گروه و مرز دسترسی اطلاعات، تصمیمات و اختیارات آن. چندین Workspace می‌توانند با یک ملک در ارتباط باشند، اما اطلاعات داخلی آن‌ها هرگز با یکدیگر ترکیب نمی‌شود.'
                  : 'The operational boundary of an organization or mandate. It holds memberships, private documents, internal communications, and contracted service modules.'}
              </p>
            </div>
            <div className="pt-6 border-t border-[#E2E8F0] mt-6 text-xs text-[#334E68] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{lang === 'ro' ? 'Separare de context și confidențialitate între organizații' : lang === 'fa' ? 'تفکیک دسترسی و حفظ محرمانگی بین سازمان‌ها' : 'Context-aware privacy and workspace boundaries'}</span>
            </div>
          </div>

          {/* 3. Persons, Roles & Relationships */}
          <div className="card-proptech p-7 bg-[#F8FAFC] border-[#D3DCE6] flex flex-col justify-between relative overflow-hidden group hover:border-[#0E9F8E] transition-all">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold text-lg">
                <Users className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider block">
                {lang === 'ro' ? 'Pilonul 3 • Actorii Autorizați' : lang === 'fa' ? 'مفهوم سوم • اشخاص و حدود اختیار' : 'Pillar 3 • Authorized Actors'}
              </span>
              <h3 className="text-xl font-bold text-[#102A43]">
                {lang === 'ro' ? 'Persoane, Roluri & Relații' : lang === 'fa' ? 'اشخاص، نقش‌ها و روابط' : 'Persons, Roles & Scopes'}
              </h3>
              <p className="text-sm text-[#52667A] leading-relaxed">
                {lang === 'ro'
                  ? 'Oamenii care acționează în sistem: proprietari, chiriași, membri ai comitetului, administratori sau furnizori de servicii. Accesul lor este determinat de rol, domeniul de responsabilitate și termenul valabil al mandatului.'
                  : lang === 'fa'
                  ? 'افرادی که در یک محدوده مشخص و برای بازه زمانی معتبر، اختیار مشاهده یا اقدام دارند. یک شخص می‌تواند چند نقش داشته باشد و هم‌زمان در چند Workspace با اختیارات متفاوت عضو باشد.'
                  : 'Individual people: owners, occupants, board auditors, facility managers, and service technicians. Access is granted based on verified relationship, scope, and time-valid mandates.'}
              </p>
            </div>
            <div className="pt-6 border-t border-[#E2E8F0] mt-6 text-xs text-[#334E68] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              <span>{lang === 'ro' ? 'Multi-rol fără confuzie de conturi' : lang === 'fa' ? 'چندنقشی هم‌زمان با یک حساب' : 'Multi-role with clean context switching'}</span>
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
                  {lang === 'ro' ? 'Reguli practice ale modelului Workspace' : lang === 'fa' ? 'قواعد شفاف معماری Workspace در عمل' : 'Practical Rules of the Workspace Model'}
                </h4>
                <p className="text-xs text-[#9FB3C8]">
                  {lang === 'ro' ? 'Principiul confidențialității și al predării controlate' : lang === 'fa' ? 'حفظ محرمانگی، تفکیک دسترسی و تحویل مسئولیت' : 'Privacy, authorization, and responsible handover principles'}
                </p>
              </div>
            </div>

            <Link
              href={`/${lang}/platform`}
              className="text-xs font-bold text-[#14B8A6] hover:text-[#5EEAD4] flex items-center gap-1 self-start sm:self-auto"
            >
              <span>{lang === 'ro' ? 'Citește arhitectura completă' : lang === 'fa' ? 'مشاهده مستندات معماری پلتفرم' : 'Read full architecture'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs text-[#CBD5E1] leading-relaxed">
            <div className="space-y-1.5">
              <span className="font-bold text-white block text-sm">
                {lang === 'ro' ? '1. Utilizator cu roluri multiple' : lang === 'fa' ? '۱. کاربر با چند نقش هم‌زمان' : '1. Multi-role identities'}
              </span>
              <p>
                {lang === 'ro'
                  ? 'Aceeași persoană poate fi proprietar într-un imobil, chiriaș într-un alt complex și membru în comitetul altuia, comutând contextul instantaneu.'
                  : lang === 'fa'
                  ? 'یک شخص می‌تواند در یک ملک مالک باشد، در ساختمانی دیگر مستأجر و در پروژه‌ای دیگر مدیر، و به سادگی بین محیط‌ها جابه‌جا شود.'
                  : 'One user can be a unit owner in one building, tenant in another, and audit committee member elsewhere with instant context switching.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-white block text-sm">
                {lang === 'ro' ? '2. Proprietari cu mai multe unități' : lang === 'fa' ? '۲. مالکان دارای چند ملک' : '2. Multi-unit owners'}
              </span>
              <p>
                {lang === 'ro'
                  ? 'Un proprietar cu apartamente în mai multe clădiri își poate urmări patrimoniul centralizat, fără a expune datele altor locatari.'
                  : lang === 'fa'
                  ? 'مالک چندواحدی می‌تواند واحدهای خود را در مجتمع‌های مختلف پایش کند، بدون آنکه حریم خصوصی سایر ساکنان خدشه‌دار شود.'
                  : 'Owners with units across different buildings track rent and costs centrally without compromising other occupants’ privacy.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="font-bold text-white block text-sm">
                {lang === 'ro' ? '3. Asocierea nu înseamnă partajare' : lang === 'fa' ? '۳. ارتباط چند محیط دلیل اشتراک داده نیست' : '3. Association ≠ Data sharing'}
              </span>
              <p>
                {lang === 'ro'
                  ? 'Dacă un dezvoltator și o asociație sunt legate de același imobil, datele lor financiare interne rămân strict separate.'
                  : lang === 'fa'
                  ? 'اگر سازنده، شرکت مدیریت و انجمن مالکان همگی به یک ملک متصل باشند، اسناد محرمانه و حساب‌های داخلی هریک کاملاً مجزاست.'
                  : 'Multiple workspaces associated with the same building never share internal ledgers, confidential files, or messages.'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
