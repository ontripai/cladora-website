import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building2, 
  Layers, 
  Database, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2,
  Users,
  GitBranch,
  RefreshCw,
  Lock,
  FileCheck2,
  Server,
  KeyRound
} from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/platform', params.lang);
}

export default async function PlatformPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-[#52667A] font-medium">
          <Link href={`/${lang}`} className="hover:text-[#102A43]">
            {lang === 'ro' ? 'Acasă' : lang === 'fa' ? 'صفحه اصلی' : 'Home'}
          </Link>
          <span>/</span>
          <span className="text-[#102A43] font-bold">
            {lang === 'ro' ? 'Platformă & Workspace' : lang === 'fa' ? 'پلتفرم و معماری Workspace' : 'Platform & Workspace'}
          </span>
        </div>

        {/* Hero Section */}
        <div className="max-w-4xl space-y-4">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3.5 py-1 rounded-full border border-[#B2E5DF]">
            {lang === 'ro' ? 'Arhitectura de Sistem CLADORA' : lang === 'fa' ? 'معماری جامع سیستم CLADORA' : 'CLADORA System Architecture'}
          </span>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {lang === 'ro' 
              ? 'Modelul Universal Workspace & Identitatea Persistentă a Proprietății' 
              : lang === 'fa' 
              ? 'مدل جامع Workspace و هویت پایدار ملک و دارایی' 
              : 'Universal Workspace Model & Persistent Property Identity'}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {lang === 'ro'
              ? 'CLADORA este concepută ca un sistem de operare universal pentru administrarea, operarea, contabilitatea și guvernanța oricărei proprietăți gestionate. Nucleul comun susține identitatea unică și evidența de neșters, în timp ce spațiile de lucru asigură izolarea organizațională absolută.'
              : lang === 'fa'
              ? 'CLADORA محیط یکپارچهٔ همکاری، مدیریت و خدمات برای ملک، ساختمان، واحد، فضا و دارایی است. این ساختار بر تمایز قاطع میان «ملک و دارایی»، «Workspace به عنوان مرز داده و اختیار» و «اشخاص و نقش‌های زمان‌دار» بنا شده است.'
              : 'CLADORA is the unified operating platform for property operations, living services, and asset governance. Built upon persistent physical identity, multi-tenant workspace boundaries, and scoped delegable authority.'}
          </p>
        </div>

        {/* The 3 Core Pillars in Detail */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Pillar 1: Property Identity */}
          <div className="card-proptech p-8 bg-white border-[#D3DCE6] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#102A43]">
              {lang === 'ro' ? '1. Proprietatea & Activul Fizic' : lang === 'fa' ? '۱. ملک و دارایی (موضوع خدمت)' : '1. Property & Physical Assets'}
            </h3>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Ansamblu, clădire, unitate individuală (apartament, birou, spațiu comercial, hală), spațiu comun, contor sau echipament tehnic (lift, pompă, centrală). Rămâne neschimbat în timp, indiferent de rotația locatarilor sau schimbarea firmei de administrare.'
                : lang === 'fa'
                ? 'مجموعه، ساختمان، واحد (مسکونی، اداری، تجاری یا صنعتی)، فضاهای مشترک، انشعابات و تجهیزات فنی. تغییر مالک، مستأجر یا مدیر ساختمان هرگز هویت ملک و سوابق ثبت‌شده آن را پاک نمی‌کند.'
                : 'The persistent physical reality: site, building, space, units, utility meters, and assets. Endures through occupant turnover and management mandate changes.'}
            </p>
            <ul className="space-y-1.5 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>{lang === 'ro' ? 'Topologie ierarhică clară' : lang === 'fa' ? 'ساختار سلسله‌مراتبی فضاها و واحدها' : 'Hierarchical spatial topology'}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>{lang === 'ro' ? 'Jurnal de service atașat activului' : lang === 'fa' ? 'شناسنامه و سوابق متصل به دارایی' : 'Service history tied to asset ID'}</span>
              </li>
            </ul>
          </div>

          {/* Pillar 2: Workspace Boundary */}
          <div className="card-proptech p-8 bg-white border-[#0E9F8E]/30 ring-1 ring-[#0E9F8E]/20 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0E9F8E] text-white flex items-center justify-center font-bold">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#102A43]">
              {lang === 'ro' ? '2. Workspace (Granița Operațională)' : lang === 'fa' ? '۲. محیط کاری (مرز داده و اختیار)' : '2. Workspace Boundary'}
            </h3>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Contextul activ de colaborare al unei organizații (dezvoltator, asociație de locatari, proprietar cu portofoliu sau firmă de facility). Izolează strict documentele interne, contabilitatea, mesajele și drepturile contractuale.'
                : lang === 'fa'
                ? 'محیط همکاری یک سازمان یا گروه کاری. مرز نفوذناپذیر داده‌ها، اعضا، اسناد و تصمیمات داخلی است. چندین Workspace می‌توانند با یک ملک در ارتباط باشند، اما داده‌های داخلی هریک کاملاً محرمانه باقی می‌ماند.'
                : 'The operational boundary of an organization. Guarantees multi-tenant isolation for memberships, documents, internal ledgers, and approvals.'}
            </p>
            <ul className="space-y-1.5 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>{lang === 'ro' ? 'Izolare multi-tenant completă' : lang === 'fa' ? 'تفکیک قطعی داده‌های چندمستأجری' : 'Strict multi-tenant boundary'}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>{lang === 'ro' ? 'Fără scurgeri de date între chiriaș și proprietar' : lang === 'fa' ? 'عدم درز اطلاعات بین سازمان‌ها' : 'Zero cross-tenant data bleed'}</span>
              </li>
            </ul>
          </div>

          {/* Pillar 3: Roles & People */}
          <div className="card-proptech p-8 bg-white border-[#D3DCE6] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF8F5] text-[#0E9F8E] flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#102A43]">
              {lang === 'ro' ? '3. Persoane, Roluri & Mandate' : lang === 'fa' ? '۳. اشخاص، نقش‌ها و بازه اختیار' : '3. Persons, Roles & Scopes'}
            </h3>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Utilizatorii umani acționează în baza unui rol cu perimetru exact și termen de valabilitate. O persoană poate fi proprietar într-o clădire, chiriaș în alta și cenzor financiar într-a treia, comutând contextul fără confuzie.'
                : lang === 'fa'
                ? 'افرادی که در یک محدوده و بازه معتبر، اختیار مشاهده یا اقدام دارند. دسترسی بر پایه نوع نقش، رابطه معتبر حقوقی و مدت اعتبار تعیین می‌شود و کاربر چندنقشی بدون نیاز به چند حساب فعالیت می‌کند.'
                : 'Actors who hold time-bound, scoped authority. Multi-role identities seamlessly switch context without logging out or mixing permissions.'}
            </p>
            <ul className="space-y-1.5 text-xs text-[#334E68] pt-2 border-t border-[#F0F4F8]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>{lang === 'ro' ? 'Identitate multi-rol unificată' : lang === 'fa' ? 'حساب کاربری واحد با چند نقش' : 'Multi-role context switching'}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>{lang === 'ro' ? 'Autoritate condiționată de mandat valid' : lang === 'fa' ? 'اختیار منوط به رابطه معتبر حقوقی' : 'Mandate-based authorization checks'}</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Core Shared Capabilities Grid */}
        <div className="p-8 sm:p-12 bg-white rounded-3xl border border-[#E2E8F0] space-y-8">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {lang === 'ro' ? 'Capabilități Fundamentale' : lang === 'fa' ? 'قابلیت‌های بنیادین هسته مشترک' : 'Shared Core Engines'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#102A43]">
              {lang === 'ro' ? 'Motoarele comune care susțin toate serviciile' : lang === 'fa' ? 'هسته مشترک CLADORA برای تمام خدمات' : 'The Universal Engines Powering All Services'}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A]">
              {lang === 'ro'
                ? 'Fiecare domeniu (AIRPROP, SERVICE, Operațiuni) se bazează pe aceeași infrastructură de adevăr financiar, securitate și documente.'
                : lang === 'fa'
                ? 'تمامی خدمات بر پایه زیرساخت یکپارچه حقیقت مالی، ثبت اسناد، حسابرسی تغییرناپذیر و مدیریت هویت بنا شده‌اند.'
                : 'AIRPROP, SERVICE, and Operations plug into one verified source of truth for identity, accounting, documents, and audit trails.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-[#334E68]">
            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <Database className="w-5 h-5 text-[#0E9F8E]" />
              <strong className="text-[#102A43] block text-sm">
                {lang === 'ro' ? 'Identitate Imobil & Unități' : lang === 'fa' ? 'هویت ملک و واحدها' : 'Property Registry'}
              </strong>
              <p className="text-[#52667A]">
                {lang === 'ro' ? 'Registru unic pentru clădiri, spații, cote indivize și active tehnice.' : lang === 'fa' ? 'شناسنامه پایدار مجموعه، فضاها، سهم مشاعات و تجهیزات.' : 'Canonical registry of estates, units, shares, and shared equipment.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <FileCheck2 className="w-5 h-5 text-[#0E9F8E]" />
              <strong className="text-[#102A43] block text-sm">
                {lang === 'ro' ? 'Seif Documente & Versiuni' : lang === 'fa' ? 'بایگانی اسناد و نسخه‌ها' : 'Document Vault'}
              </strong>
              <p className="text-[#52667A]">
                {lang === 'ro' ? 'Stocare securizată, atestare scanări, versiuni protejate și reținere legală.' : lang === 'fa' ? 'بایگانی امن مدارک، حفظ تاریخچه نسخه‌ها و مستندات قانونی.' : 'Secure storage, tamper-evident scan attestations, and document retention.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <ShieldCheck className="w-5 h-5 text-[#0E9F8E]" />
              <strong className="text-[#102A43] block text-sm">
                {lang === 'ro' ? 'Adevăr Financiar & Dublă Înregistrare' : lang === 'fa' ? 'حسابداری و دفاتر مالی' : 'Financial Truth Engine'}
              </strong>
              <p className="text-[#52667A]">
                {lang === 'ro' ? 'Registre statutare, contabilitate analitică cu dublă înregistrare și reconciliere bancară zero-diferențe.' : lang === 'fa' ? 'دفاتر قانونی، کنترل تحلیلی دوطرفه و تطبیق بانکی بدون کوچک‌ترین مغایرت.' : 'Statutory records, supplemental double-entry ledger, and zero-variance bank matching.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <Server className="w-5 h-5 text-[#0E9F8E]" />
              <strong className="text-[#102A43] block text-sm">
                {lang === 'ro' ? 'Pistă de Audit Imutabilă' : lang === 'fa' ? 'ثبت ردپای حسابرسی' : 'Immutable Audit Trail'}
              </strong>
              <p className="text-[#52667A]">
                {lang === 'ro' ? 'Jurnal de securitate criptografic, neschimbabil, cu trasabilitate completă a fiecărei acțiuni.' : lang === 'fa' ? 'ثبت دائمی و غیرقابل‌دستکاری تمامی تراکنش‌ها، مصوبات و تغییرات.' : 'Cryptographic audit evidence ensuring every ledger post and action is reproducible.'}
              </p>
            </div>
          </div>
        </div>

        {/* Delegation and Handover Section */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 space-y-8">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-[#14B8A6] uppercase tracking-wider">
              {lang === 'ro' ? 'Reguli de Guvernanță' : lang === 'fa' ? 'قواعد مدت اختیار و تحویل مسئولیت' : 'Governance & Authority Lifecycle'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold">
              {lang === 'ro' ? 'Durata mandatului, delegarea și predarea către succesor' : lang === 'fa' ? 'تفویض اختیار، سقف اعتبار و انتقال مسئولیت به جانشین' : 'Mandate Duration, Delegation Trees & Succession Handover'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-[#CBD5E1] leading-relaxed">
            <div className="space-y-2 p-5 rounded-2xl bg-[#173F5F] border border-[#244A6F]">
              <strong className="text-white block text-sm">
                {lang === 'ro' ? '1. Limita Autorității Părinte' : lang === 'fa' ? '۱. سقف اختیار و مدت اعتبار' : '1. Bounded Delegation'}
              </strong>
              <p>
                {lang === 'ro'
                  ? 'Administratorul delegă permisiuni exclusiv în limitele propriului mandat valid. Autoritatea subordonată nu poate depăși termenul sau sfera părintelui.'
                  : lang === 'fa'
                  ? 'اختیار داده‌شده به زیرمجموعه هرگز از مجوز، محدوده و مدت اعتبار والد فراتر نمی‌رود. پایان یا لغو اختیار والد بلافاصله بر نقش وابسته اثر می‌گذارد.'
                  : 'Delegated authority cannot outlive or exceed parent permissions. Revocation of parent mandate immediately cascades.'}
              </p>
            </div>

            <div className="space-y-2 p-5 rounded-2xl bg-[#173F5F] border border-[#244A6F]">
              <strong className="text-white block text-sm">
                {lang === 'ro' ? '2. Predare cu Dată de Efect' : lang === 'fa' ? '۲. تحویل مسئولیت با تاریخ مؤثر' : '2. Effective-Dated Handover'}
              </strong>
              <p>
                {lang === 'ro'
                  ? 'Predarea responsabilității include încheierea oficială a mandatului anterior și activarea succesorului cu dată certă, preluând sarcinile deschise.'
                  : lang === 'fa'
                  ? 'تحویل مسئولیت شامل پایان اختیار قبلی و شروع اختیار جانشین با ثبت زمان مؤثر است؛ کارهای باز تعیین تکلیف شده و تسلیم جانشین می‌شوند.'
                  : 'Succession marks the exact timestamp ending previous authority and starting the successor mandate to continue open obligations.'}
              </p>
            </div>

            <div className="space-y-2 p-5 rounded-2xl bg-[#173F5F] border border-[#244A6F]">
              <strong className="text-white block text-sm">
                {lang === 'ro' ? '3. Semnăturile Istorice Rămân Intacte' : lang === 'fa' ? '۳. حفظ امضاهای گذشته' : '3. Historical Attribution'}
              </strong>
              <p>
                {lang === 'ro'
                  ? 'Actele, aprobările și plățile din trecut rămân atribuite celor care le-au semnat; succesorul răspunde strict pentru deciziile luate din momentul preluării.'
                  : lang === 'fa'
                  ? 'امضاها و اقدامات پیشین به نام افراد قبلی محفوظ می‌مانند و مسئولیت اقدامات جدید از زمان تحویل، به نام جانشین ثبت می‌گردد.'
                  : 'Past journal posts and approvals remain attributed to the original human signers. New actions are logged under the successor.'}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1C3D5A] flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-[#9FB3C8]">
              {lang === 'ro' ? 'Informațiile tehnice interne nu sunt expuse în interfața publică.' : lang === 'fa' ? 'منطق مجوزها از قرارداد مشترک هسته پیروی می‌کند و برای کاربر کاملاً ساده و امن است.' : 'Security and access policies operate reliably behind a clean experience.'}
            </span>
            <Link
              href={`/${lang}/contact`}
              className="px-6 py-2.5 text-xs font-bold text-[#102A43] bg-[#14B8A6] hover:bg-[#2DD4BF] rounded-xl transition-colors shadow-sm"
            >
              {lang === 'ro' ? 'Solicită Integrarea Platformei' : lang === 'fa' ? 'درخواست شروع همکاری' : 'Start Platform Inquiry'}
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
