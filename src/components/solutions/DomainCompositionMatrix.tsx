import React from 'react';
import { Language } from '@/types';
import { AlertCircle, Layers } from 'lucide-react';

interface DomainCompositionMatrixProps {
  lang: Language;
}

type RelevanceTier = 'PRIMARY' | 'SECONDARY' | 'CONTEXTUAL' | 'NOT_CENTRAL';

interface DomainRow {
  key: string;
  code: string;
  name: { ro: string; en: string; fa: string };
  canonicalDuty: { ro: string; en: string; fa: string };
  values: {
    developers: RelevanceTier;
    owners: RelevanceTier;
    associations: RelevanceTier;
    managers: RelevanceTier;
    residents: RelevanceTier;
    providers: RelevanceTier;
  };
}

export const DomainCompositionMatrix: React.FC<DomainCompositionMatrixProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'MATRICEA DE COMPOZIȚIE A DOMENIILOR',
      title: 'Relevanța Arhitecturală a Domeniilor pe Contexte de Actori',
      subtitle: 'Cum se conectează furnizorii canonici și domeniile specializate ale platformei la fiecare categorie de utilizatori autorizați.',
      disclaimerTitle: 'NOTĂ METODOLOGICĂ IMPORTANTĂ',
      disclaimer: 'Această matrice reflectă exclusiv RELEVANȚA ARHITECTURALĂ a domeniilor de capabilități pentru fiecare rol. Ea NU reprezintă disponibilitate de runtime în producție, nivel de maturitate, licențiere comercială sau statut de livrare curentă. Paginile de soluții descriu compoziția arhitecturală a platformei, nu produse software independente.',
      columns: {
        domain: 'Domeniu Canonic',
        developers: 'Dezvoltatori',
        owners: 'Proprietari',
        associations: 'Asociații',
        managers: 'Companii Administrare',
        residents: 'Rezidenți / Ocupanți',
        providers: 'Furnizori Servicii',
      },
      legend: {
        primary: 'Relevanță Primară',
        secondary: 'Relevanță Secundară',
        contextual: 'Contextual',
        notCentral: 'Neesențial Direct',
      },
    },
    en: {
      badge: 'DOMAIN COMPOSITION MATRIX',
      title: 'Architectural Domain Relevance Across Participant Contexts',
      subtitle: 'How canonical platform providers and specialized operational domains compose for each authorized actor category.',
      disclaimerTitle: 'CRITICAL METHODOLOGICAL DISCLAIMER',
      disclaimer: 'This matrix reflects ARCHITECTURAL RELEVANCE ONLY for each participant context. It does NOT indicate production runtime availability, release maturity, commercial licensing, or current deployment status. Solution pages describe platform architectural composition, not standalone software products.',
      columns: {
        domain: 'Canonical Domain',
        developers: 'Developers',
        owners: 'Property Owners',
        associations: 'Associations',
        managers: 'Property Managers',
        residents: 'Residents / Occupants',
        providers: 'Service Providers',
      },
      legend: {
        primary: 'Primary Relevance',
        secondary: 'Secondary Relevance',
        contextual: 'Contextual',
        notCentral: 'Not Directly Central',
      },
    },
    fa: {
      badge: 'ماتریس معماری ترکیب دامنه‌ها',
      title: 'ارتباط معماری دامنه‌های پلتفرم با بسترهای گوناگون مخاطبان',
      subtitle: 'نحوه اتصال متولیان مرجع داده‌ها و دامنه‌های تخصصی سیستم با هر یک از دسته‌های مشارکت‌کنندگان مجاز.',
      disclaimerTitle: 'توضیح متدولوژیک ضروری و سلب ادعای عملیاتی',
      disclaimer: 'این ماتریس صرفاً نشان‌دهندهٔ «ارتباط معماری و ساختاری» دامنه‌ها برای هر بستر مخاطب است. این جدول به معنای در دسترس بودن هم‌اکنون در محیط عملیاتی، سطح بلوغ نرم‌افزاری، بسته‌های تجاری یا وضعیت انتشار نیست. صفحات راهکارها ترکیب معماری سیستم را شرح می‌دهند، نه محصولات نرم‌افزاری مستقل.',
      columns: {
        domain: 'متولی مرجع دامنه',
        developers: 'سازندگان',
        owners: 'مالکان املاک',
        associations: 'انجمن‌های مالکان',
        managers: 'شرکت‌های مدیریت',
        residents: 'ساکنان / بهره‌برداران',
        providers: 'پیمانکاران و خدمات',
      },
      legend: {
        primary: 'ارتباط مستقیم و اصلی',
        secondary: 'ارتباط ثانویه و تکمیلی',
        contextual: 'وابسته به موقعیت و نیاز',
        notCentral: 'خارج از تعامل مستقیم',
      },
    },
  }[lang];

  const rows: DomainRow[] = [
    {
      key: 'core',
      code: 'CORE',
      name: { ro: 'Identitate & Autoritate', en: 'Identity & Authority', fa: 'هویت پایدار و اختیارات' },
      canonicalDuty: { 
        ro: 'Identitate imobil, delimitare workspace, relații contractuale și autoritate scopată', 
        en: 'Asset identity, workspace boundaries, contractual relationships, and scoped authority', 
        fa: 'هویت پایدار دارایی، مرزهای ورک‌اسپیس، روابط قراردادی و اختیارات تفویض‌شده' 
      },
      values: {
        developers: 'PRIMARY',
        owners: 'PRIMARY',
        associations: 'PRIMARY',
        managers: 'PRIMARY',
        residents: 'PRIMARY',
        providers: 'PRIMARY',
      },
    },
    {
      key: 'documents',
      code: 'DOCUMENTS',
      name: { ro: 'Documente & Proveniență', en: 'Documents & Provenance', fa: 'اسناد و سوابق اثبات‌پذیر' },
      canonicalDuty: { 
        ro: 'Versiuni canonice de documente, probe de conformitate și trasabilitatea provenienței', 
        en: 'Canonical document versions, evidentiary records, and traceable provenance', 
        fa: 'نسخه‌های مرجع اسناد، مدارک اثبات‌پذیر و ردپای اصالت تاریخی' 
      },
      values: {
        developers: 'PRIMARY',
        owners: 'PRIMARY',
        associations: 'PRIMARY',
        managers: 'PRIMARY',
        residents: 'SECONDARY',
        providers: 'PRIMARY',
      },
    },
    {
      key: 'fin01',
      code: 'FIN01',
      name: { ro: 'Adevăr Financiar', en: 'Financial Truth', fa: 'صحت مالی و حسابداری' },
      canonicalDuty: { 
        ro: 'Adevăr financiar, semantica jurnalelor, postărilor contabile și a soldurilor', 
        en: 'Financial truth, ledger semantics, postings, and balance calculations', 
        fa: 'صحت داده‌های مالی، ساختار دفاتر کل، ثبت‌های حسابداری و مانده‌حساب‌ها' 
      },
      values: {
        developers: 'SECONDARY',
        owners: 'PRIMARY',
        associations: 'PRIMARY',
        managers: 'PRIMARY',
        residents: 'PRIMARY',
        providers: 'SECONDARY',
      },
    },
    {
      key: 'airprop',
      code: 'AIRPROP',
      name: { ro: 'Ciclul Comercial & Pre-Vânzare', en: 'Commercial Lifecycle & Pre-Sale', fa: 'چرخه تجاری و پیش‌فروش' },
      canonicalDuty: { 
        ro: 'Semantica ciclului comercial, oportunități de tranzacționare și administrare contracte', 
        en: 'Commercial lifecycle semantics, transaction opportunities, and lease governance', 
        fa: 'مفاهیم چرخه تجاری، فرصت‌های معامله و مدیریت اسناد اجاره' 
      },
      values: {
        developers: 'PRIMARY',
        owners: 'SECONDARY',
        associations: 'NOT_CENTRAL',
        managers: 'CONTEXTUAL',
        residents: 'CONTEXTUAL',
        providers: 'NOT_CENTRAL',
      },
    },
    {
      key: 'service',
      code: 'SERVICE',
      name: { ro: 'Cereri & Comenzi de Servicii', en: 'Service Orders & Quotations', fa: 'درخواست‌ها و سفارش‌های خدمت' },
      canonicalDuty: { 
        ro: 'Semantica cererilor de servicii, intenție operațională și coordonarea comenzilor', 
        en: 'Service intent, request semantics, and service order coordination', 
        fa: 'ثبت نیاز، مفاهیم درخواست خدمت و هماهنگی سفارش‌های کاری' 
      },
      values: {
        developers: 'SECONDARY',
        owners: 'SECONDARY',
        associations: 'PRIMARY',
        managers: 'PRIMARY',
        residents: 'PRIMARY',
        providers: 'PRIMARY',
      },
    },
    {
      key: 'operations',
      code: 'OPERATIONS',
      name: { ro: 'Execuție Operațiuni Tehnice', en: 'Work-Order Execution', fa: 'عملیات اجرایی و نگهداری فنی' },
      canonicalDuty: { 
        ro: 'Execuția comenzilor de lucru și contextul intervențiilor tehnice operaționale', 
        en: 'Work-order execution and operational maintenance context', 
        fa: 'اجرای دستورکارهای فنی و بستر عملیات نگهداری دارایی' 
      },
      values: {
        developers: 'SECONDARY',
        owners: 'SECONDARY',
        associations: 'PRIMARY',
        managers: 'PRIMARY',
        residents: 'SECONDARY',
        providers: 'PRIMARY',
      },
    },
    {
      key: 'communications',
      code: 'COMMUNICATIONS',
      name: { ro: 'Comunicări & Transmitere', en: 'Communications & Delivery', fa: 'اطلاع‌رسانی و ارسال پیام' },
      canonicalDuty: { 
        ro: 'Adevărul livrării mesajelor și evidența trasabilă a comunicărilor', 
        en: 'Communication and delivery truth with auditable dispatch records', 
        fa: 'صحت ارسال پیام‌ها و ثبت مستند ابلاغیه‌های ارتباطی' 
      },
      values: {
        developers: 'CONTEXTUAL',
        owners: 'SECONDARY',
        associations: 'PRIMARY',
        managers: 'PRIMARY',
        residents: 'PRIMARY',
        providers: 'SECONDARY',
      },
    },
    {
      key: 'bk01',
      code: 'BK01',
      name: { ro: 'Rezervări & Capacitate', en: 'Bookings & Capacity', fa: 'رزرواسیون و ظرفیت فضاها' },
      canonicalDuty: { 
        ro: 'Adevărul privind rezervările, capacitatea și disponibilitatea resurselor', 
        en: 'Booking, capacity, and availability truth', 
        fa: 'صحت داده‌های رزرواسیون، ظرفیت و دسترسی‌پذیری منابع' 
      },
      values: {
        developers: 'NOT_CENTRAL',
        owners: 'CONTEXTUAL',
        associations: 'SECONDARY',
        managers: 'SECONDARY',
        residents: 'PRIMARY',
        providers: 'NOT_CENTRAL',
      },
    },
    {
      key: 'ce',
      code: 'C&E',
      name: { ro: 'Comunitate & Experiență', en: 'Community & Experience', fa: 'جامعه و تجربه کاربری' },
      canonicalDuty: { 
        ro: 'Compoziția experienței locative și contextul spațial de proximitate', 
        en: 'Experience composition and localized place context', 
        fa: 'ترکیب تجربه کاربری و بستر فضایی پیرامونی' 
      },
      values: {
        developers: 'SECONDARY',
        owners: 'CONTEXTUAL',
        associations: 'SECONDARY',
        managers: 'SECONDARY',
        residents: 'PRIMARY',
        providers: 'CONTEXTUAL',
      },
    },
    {
      key: 'intelligence',
      code: 'AI',
      name: { ro: 'Inteligență Subordonată', en: 'Governed Intelligence', fa: 'هوش حاکمیت‌پذیر و کمکی' },
      canonicalDuty: { 
        ro: 'Orchestrare asistivă subordonată, ghidată de politici și supusă aprobării umane', 
        en: 'Subordinate context-aware orchestration subject to policy controls and human approval', 
        fa: 'ارکستراسیون کمکی و مقید به خط‌مشی‌ها تحت نظارت و تایید نهایی انسان' 
      },
      values: {
        developers: 'SECONDARY',
        owners: 'SECONDARY',
        associations: 'SECONDARY',
        managers: 'SECONDARY',
        residents: 'SECONDARY',
        providers: 'SECONDARY',
      },
    },
  ];

  const getBadgeStyle = (tier: RelevanceTier) => {
    switch (tier) {
      case 'PRIMARY':
        return 'bg-[#EAF8F5] text-[#0A6E62] border border-[#B2E5DF] font-bold';
      case 'SECONDARY':
        return 'bg-[#F0F4F8] text-[#243B53] border border-[#D3DCE6] font-semibold';
      case 'CONTEXTUAL':
        return 'bg-amber-50 text-amber-800 border border-amber-200 font-medium';
      case 'NOT_CENTRAL':
        return 'bg-slate-50 text-slate-400 border border-slate-200';
    }
  };

  const getBadgeLabel = (tier: RelevanceTier) => {
    switch (tier) {
      case 'PRIMARY':
        return content.legend.primary;
      case 'SECONDARY':
        return content.legend.secondary;
      case 'CONTEXTUAL':
        return content.legend.contextual;
      case 'NOT_CENTRAL':
        return content.legend.notCentral;
    }
  };

  return (
    <section className="py-20 bg-[#F6F9FC] border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Header */}
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62] border border-[#B2E5DF]">
            <Layers className="w-3.5 h-3.5 text-[#0E9F8E]" />
            <span>{content.badge}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
            {content.title}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-white p-4 rounded-xl border border-[#E2E8F0]">
          <span className="font-bold text-[#102A43]">{lang === 'ro' ? 'Legendă:' : lang === 'fa' ? 'راهنمای علائم:' : 'Legend:'}</span>
          <span className={`px-2.5 py-1 rounded-md text-[11px] ${getBadgeStyle('PRIMARY')}`}>{content.legend.primary}</span>
          <span className={`px-2.5 py-1 rounded-md text-[11px] ${getBadgeStyle('SECONDARY')}`}>{content.legend.secondary}</span>
          <span className={`px-2.5 py-1 rounded-md text-[11px] ${getBadgeStyle('CONTEXTUAL')}`}>{content.legend.contextual}</span>
          <span className={`px-2.5 py-1 rounded-md text-[11px] ${getBadgeStyle('NOT_CENTRAL')}`}>{content.legend.notCentral}</span>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-[#CBD5E1] bg-white shadow-sm">
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#102A43] text-white">
                <th className="p-4 font-bold border-b border-[#243B53] text-start w-[240px]">
                  {content.columns.domain}
                </th>
                <th className="p-4 font-bold border-b border-[#243B53] text-center">
                  {content.columns.developers}
                </th>
                <th className="p-4 font-bold border-b border-[#243B53] text-center">
                  {content.columns.owners}
                </th>
                <th className="p-4 font-bold border-b border-[#243B53] text-center">
                  {content.columns.associations}
                </th>
                <th className="p-4 font-bold border-b border-[#243B53] text-center">
                  {content.columns.managers}
                </th>
                <th className="p-4 font-bold border-b border-[#243B53] text-center">
                  {content.columns.residents}
                </th>
                <th className="p-4 font-bold border-b border-[#243B53] text-center">
                  {content.columns.providers}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="p-4 text-start bg-slate-50/50">
                    <div className="font-bold text-[#102A43] flex items-center gap-1.5">
                      <span className="font-mono text-xs text-[#0E9F8E] font-extrabold dir-ltr">{row.code}</span>
                      <span>—</span>
                      <span>{row.name[lang]}</span>
                    </div>
                    <div className="text-[11px] text-[#627D98] mt-1 leading-snug">
                      {row.canonicalDuty[lang]}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap ${getBadgeStyle(row.values.developers)}`}>
                      {getBadgeLabel(row.values.developers)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap ${getBadgeStyle(row.values.owners)}`}>
                      {getBadgeLabel(row.values.owners)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap ${getBadgeStyle(row.values.associations)}`}>
                      {getBadgeLabel(row.values.associations)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap ${getBadgeStyle(row.values.managers)}`}>
                      {getBadgeLabel(row.values.managers)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap ${getBadgeStyle(row.values.residents)}`}>
                      {getBadgeLabel(row.values.residents)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap ${getBadgeStyle(row.values.providers)}`}>
                      {getBadgeLabel(row.values.providers)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mandatory Methodological Disclaimer */}
        <div className="rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] p-6 space-y-2 text-[#92400E]">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
            <AlertCircle className="w-4 h-4 text-[#B45309]" />
            <span>{content.disclaimerTitle}</span>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed">
            {content.disclaimer}
          </p>
        </div>

      </div>
    </section>
  );
};
