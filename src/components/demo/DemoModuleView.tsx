'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type {
  DemoWorkspaceDescriptor,
  DemoItem,
  DemoReportsResult,
  DemoFinanceMonth,
  DemoMaintenanceReportItem,
  DemoActivityItem
} from '@/lib/demo/demo-types';
import { fetchDemoItems, fetchDemoReports } from '@/lib/demo/demo-client';
import {
  Building2,
  Users,
  Wrench,
  Layers,
  Gauge,
  Megaphone,
  FolderArchive,
  Calendar,
  Briefcase,
  Vote,
  FileSpreadsheet,
  BarChart3,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Lock,
  ArrowRight,
  CreditCard,
  UserCheck,
  Coins,
  BookOpen,
  PartyPopper
} from 'lucide-react';

interface DemoModuleViewProps {
  workspace: DemoWorkspaceDescriptor;
  moduleKey: string;
  lang: Language;
}

export const DemoModuleView: React.FC<DemoModuleViewProps> = ({
  workspace,
  moduleKey,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'records' | 'preview_form'>('records');

  // CE-specific subview tab: 'announcements' | 'bookings' | 'guides' | 'events'
  const [ceSubView, setCeSubView] = useState<'announcements' | 'bookings' | 'guides' | 'events'>('announcements');

  // Query state
  const configured = isSupabaseConfigured();
  const [items, setItems] = useState<DemoItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [reportsData, setReportsData] = useState<DemoReportsResult | null>(null);
  const [loading, setLoading] = useState<boolean>(configured);
  const [error, setError] = useState<string | null>(null);

  // Pagination & filter state
  const [limit, setLimit] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Transient Form Inputs (In-memory only, no localStorage, zero backend mutation)
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  const handleFieldChange = (key: string, value: string) => {
    setFormFields((prev) => ({ ...prev, [key]: value }));
  };

  // Stale request invalidation ref
  const moduleReqIdRef = useRef(0);

  // Determine view mode
  const isCeModule = moduleKey === 'community-experience' || moduleKey === 'community_experience';
  const isReportDriven = moduleKey === 'finance' || moduleKey === 'reports' || moduleKey === 'activity';
  const isLockedModule = moduleKey === 'payments' || moduleKey === 'role_administration';
  const isSettingsModule = moduleKey === 'settings';

  // Reset pagination & search during render when module or workspace changes (official React pattern)
  const [prevModuleKey, setPrevModuleKey] = useState(moduleKey);
  const [prevWorkspaceId, setPrevWorkspaceId] = useState(workspace.id);
  if (prevModuleKey !== moduleKey || prevWorkspaceId !== workspace.id) {
    setPrevModuleKey(moduleKey);
    setPrevWorkspaceId(workspace.id);
    setPage(1);
    setSearchTerm('');
    setFormFields({});
    setActiveTab('records');
    setItems([]);
    setTotal(0);
    setReportsData(null);
    setError(null);
    setLoading(!isLockedModule && moduleKey !== 'settings' && configured);
  }

  useEffect(() => {
    if (!configured || isLockedModule || isSettingsModule) {
      return;
    }

    let isMounted = true;
    const reqId = ++moduleReqIdRef.current;
    const client = createClient();
    const offset = (page - 1) * limit;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        if (isReportDriven) {
          const rep = await fetchDemoReports(client, workspace.id);
          if (isMounted && reqId === moduleReqIdRef.current) {
            setReportsData(rep);
            setTotal(0);
            setItems([]);
          }
        } else if (isCeModule) {
          // CE loads specific modules per subview instead of module: null (which dumped all 75 items)
          if (ceSubView === 'announcements') {
            const res = await fetchDemoItems(client, workspace.id, {
              module: 'communications',
              limit,
              offset,
            });
            if (isMounted && reqId === moduleReqIdRef.current) {
              setItems(res.items || []);
              setTotal(res.total || 0);
            }
          } else if (ceSubView === 'bookings') {
            const res = await fetchDemoItems(client, workspace.id, {
              module: 'bookings',
              limit,
              offset,
            });
            if (isMounted && reqId === moduleReqIdRef.current) {
              setItems(res.items || []);
              setTotal(res.total || 0);
            }
          } else {
            // Space Guides & Community Events are unseeded in public demo
            if (isMounted && reqId === moduleReqIdRef.current) {
              setItems([]);
              setTotal(0);
            }
          }
        } else {
          // Standard modules
          const res = await fetchDemoItems(client, workspace.id, {
            module: moduleKey,
            limit,
            offset,
          });
          if (isMounted && reqId === moduleReqIdRef.current) {
            setItems(res.items || []);
            setTotal(res.total || 0);
          }
        }
      } catch (err: any) {
        if (isMounted && reqId === moduleReqIdRef.current) {
          setError(err.message || 'Error loading module data');
        }
      } finally {
        if (isMounted && reqId === moduleReqIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [configured, workspace.id, moduleKey, isCeModule, ceSubView, isReportDriven, isLockedModule, isSettingsModule, page, limit]);

  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.title?.toLowerCase().includes(term) ||
      item.kind?.toLowerCase().includes(term) ||
      item.status?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Module Metadata Definitions
  const moduleMeta: Record<string, { title: { ro: string; fa: string; en: string }; desc: { ro: string; fa: string; en: string } }> = {
    properties: {
      title: { ro: 'Proprietăți, Clădiri & Unități', fa: 'ساختمان‌ها، بلوک‌ها و واحدها', en: 'Properties, Buildings & Units' },
      desc: { ro: 'Evidența spațiilor și a structurii clădirii cu date de probă.', fa: 'شناسنامه ساختمان، مشخصات بلوک‌ها و واحدهای نمونه.', en: 'Registry of physical building structures and sample units.' },
    },
    residents: {
      title: { ro: 'Rezidenți & Ocupanți', fa: 'ساکنان و بهره‌برداران', en: 'Residents & Occupants' },
      desc: { ro: 'Dosarele locatarilor și asocierile cu unitățile rezidențiale.', fa: 'پرونده ساکنان و انتساب آنان به واحدهای ساختمانی.', en: 'Resident directory and occupancy tracking.' },
    },
    maintenance: {
      title: { ro: 'Mentenanță, Tichete & Revizii', fa: 'تعمیرات، تیکت‌ها و دستورکارها', en: 'Maintenance & Work Orders' },
      desc: { ro: 'Tichete de sesizare defecțiuni și comenzi de lucru pentru tehnicieni.', fa: 'ثبت خرابی‌ها، پیگیری تیکت‌ها و ارجاع دستورکار به تکنسین‌ها.', en: 'Incident reporting, work orders, and technical dispatches.' },
    },
    assets: {
      title: { ro: 'Active Tehnice & Echipamente', fa: 'تجهیزات فنی و دارایی‌های مشترک', en: 'Assets & Equipment Logs' },
      desc: { ro: 'Lifturi, centrale termice, hidrofoare și planuri preventive.', fa: 'آسانسورها، پمپ‌ها، موتورخانه‌ها و برنامه‌های نگهداری دوره‌ای.', en: 'Technical equipment registry and recurring maintenance logs.' },
    },
    utilities: {
      title: { ro: 'Contoare & Consumuri', fa: 'کنتورها و مصارف مشترک', en: 'Meters & Utilities' },
      desc: { ro: 'Înregistrarea indexurilor la apă, energie și căldură.', fa: 'ثبت شاخص‌های مصرف آب، برق و گاز مشاعات.', en: 'Sub-meter indexing and consumption recording.' },
    },
    communications: {
      title: { ro: 'Comunicări & Anunțuri', fa: 'اطلاعیه‌ها و پیام‌های رسمی', en: 'Communications & Notices' },
      desc: { ro: 'Anunțuri oficiale transmise locatarilor din clădire.', fa: 'تابلوی اعلانات رسمی و ارسال پیام‌های مستقیم به ساکنان.', en: 'Broadcast announcements and structured community notices.' },
    },
    documents: {
      title: { ro: 'Seif Documente & Contracte', fa: 'بایگانی اسناد و قراردادها', en: 'Document Vault' },
      desc: { ro: 'Metadate documente tehnice, contracte de mentenanță și procese verbale.', fa: 'بایگانی امن قراردادها، مجوزها و صورت‌جلسات ساختمان.', en: 'Secure document vault metadata and records.' },
    },
    bookings: {
      title: { ro: 'Rezervări Facilități & Spații', fa: 'رزرو امکانات و فضاهای مشترک', en: 'Facility & Amenity Bookings' },
      desc: { ro: 'Programarea utilizării sălilor comune, teraselor sau facilităților.', fa: 'سامانه نوبت‌دهی و رزرو مشاعات، سالن‌ها و پارکینگ مهمان.', en: 'Shared amenity calendar and reservation management.' },
    },
    services: {
      title: { ro: 'Catalog Servicii & Furnizori', fa: 'کاتالوگ خدمات و سفارش کار', en: 'Service Catalog & Providers' },
      desc: { ro: 'Cereri de ofertă, servicii externalizate și recepția lucrărilor.', fa: 'درخواست خدمات، انتخاب پیمانکار و پذیرش رسمی کارها.', en: 'Service catalog requests, vendor bidding, and sign-offs.' },
    },
    'community-experience': {
      title: { ro: 'Comunitate & Experiență (CE)', fa: 'جامعه و تجربه (CE)', en: 'Community & Experience (CE)' },
      desc: { ro: 'Ghiduri de utilizare a spațiului, facilități și viață comunitară.', fa: 'راهنمای کاربری فضاها، امکانات رفاهی و ارتباط مستقیم با ساکنان.', en: 'Living experience, contextual space guides, and amenities.' },
    },
    community_experience: {
      title: { ro: 'Comunitate & Experiență (CE)', fa: 'جامعه و تجربه (CE)', en: 'Community & Experience (CE)' },
      desc: { ro: 'Ghiduri de utilizare a spațiului, facilități și viață comunitară.', fa: 'راهنمای کاربری فضاها، امکانات رفاهی و ارتباط مستقیم با ساکنان.', en: 'Living experience, contextual space guides, and amenities.' },
    },
    governance: {
      title: { ro: 'Guvernanță, Ședințe & Vot', fa: 'مجامع عمومی، صورت‌جلسات و آرا', en: 'Governance & Meetings' },
      desc: { ro: 'Organizarea adunărilor generale și istoricul hotărârilor adoptate.', fa: 'برگزاری مجامع، ثبت تصمیمات قانونی و نظرسنجی رسمی.', en: 'General meeting assemblies and formal resolution logs.' },
    },
    finance: {
      title: { ro: 'Financiar, Cote & Registre (SQL)', fa: 'مدیریت مالی، شارژ و دفاتر کل (SQL)', en: 'Finance & Ledger (SQL)' },
      desc: { ro: 'Date financiare extrase din tabelele de probă SQL ale workspace-ului.', fa: 'دفاتر مالی و ارقام تفکیکی شارژ بر اساس جداول SQL نمونه.', en: 'Sample ledger and statement data directly derived from SQL.' },
    },
    reports: {
      title: { ro: 'Rapoarte Consolidate & Indicatori', fa: 'گزارش‌های تجمیعی و آماری', en: 'Consolidated Reports & Metrics' },
      desc: { ro: 'Indicatori de performanță și distribuția pe kind-uri SQL.', fa: 'شاخص‌های کلیدی عملکرد و تفکیک موجودی بر اساس نوع رکورد SQL.', en: 'Performance metrics and item distribution by SQL kind.' },
    },
    activity: {
      title: { ro: 'Jurnal de Audit & Activitate', fa: 'گزارش وقایع و تاریخچه رویدادها', en: 'Activity & Audit Log' },
      desc: { ro: 'Cronologia acțiunilor și evenimentelor înregistrate în workspace.', fa: 'ثبت رویدادها و تاریخچه تغییرات در ورک‌اسپیس نمونه.', en: 'Chronological workspace audit and event history.' },
    },
    payments: {
      title: { ro: 'Plăți & Tranzacții Securizate', fa: 'پرداخت‌ها و تراکنش‌های بانکی', en: 'Payments & Secured Transactions' },
      desc: { ro: 'Procesare plăți online, mandate de debit direct și reconciliere bancară.', fa: 'پردازش برخط شارژ، تسویه مستقیم و اتصال به سامانه بانکی.', en: 'Online payment gateways, direct debit mandates, and banking reconciliation.' },
    },
    role_administration: {
      title: { ro: 'Administrare Roluri & Permisiuni', fa: 'مدیریت نقش‌ها و مجوزهای دسترسی', en: 'Role & Permission Administration' },
      desc: { ro: 'Delegarea drepturilor de acces conform statutului asociației.', fa: 'تخصیص اختیارات و تعیین سطوح دسترسی کاربران و مدیران.', en: 'Role governance, access control lists, and statutory delegation.' },
    },
    settings: {
      title: { ro: 'Setări Workspace Demo', fa: 'مشخصات و تنظیمات ورک‌اسپیس دمو', en: 'Demo Workspace Settings' },
      desc: { ro: 'Informații despre profilul demonstrativ și parametrii de mediu.', fa: 'اطلاعات پروفایل کاربری و وضعیت محیط دمو.', en: 'Demo environment profile and configuration.' },
    },
  };

  const currentMeta = moduleMeta[moduleKey] || {
    title: { ro: 'Modul Demo', fa: 'ماژول دمو', en: 'Demo Module' },
    desc: { ro: 'Explorare date și formulare demonstrative.', fa: 'مشاهده داده‌ها و فرم‌های نمونه.', en: 'Inspect sample records and forms.' },
  };

  // 1. LOCKED MODULE VIEW (Payments & Role Administration)
  if (isLockedModule) {
    const isPayment = moduleKey === 'payments';
    const Icon = isPayment ? CreditCard : UserCheck;

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-500" />
                <span>{lang === 'ro' ? 'Acces Blocat în Previzualizare' : lang === 'fa' ? 'قفل در حالت پیش‌نمایش' : 'Locked in Demo Preview'}</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#102A43]">
              {currentMeta.title[lang]}
            </h1>
            <p className="text-xs text-[#52667A]">
              {currentMeta.desc[lang]}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#CBD5E1] p-8 sm:p-12 shadow-card text-center space-y-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto border border-slate-200">
            <Icon className="w-8 h-8" />
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold text-[#102A43]">
              {isPayment
                ? (lang === 'ro' ? 'Modulul de Plăți este blocat în mediul demonstrativ' : lang === 'fa' ? 'ماژول پرداخت‌ها در محیط پیش‌نمایش قفل است' : 'Payments Module is Locked in Preview')
                : (lang === 'ro' ? 'Administrarea Rolurilor este blocată în mediul demonstrativ' : lang === 'fa' ? 'مدیریت نقش‌ها در محیط پیش‌نمایش قفل است' : 'Role Administration is Locked in Preview')}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed max-w-lg mx-auto">
              {isPayment
                ? (lang === 'ro'
                  ? 'Procesarea plăților financiare reale necesită verificarea identității entității juridice, conexiune bancară securizată, conformitate PCI-DSS și mandate de debitare directă.'
                  : lang === 'fa'
                  ? 'پردازش واقعی تراکنش‌های مالی نیازمند احراز هویت حقوقی، اتصال امن به درگاه‌های شاپرک/بانکی و رعایت استانداردهای مالی است.'
                  : 'Live financial processing requires verified corporate identity, certified banking gateway credentials, PCI-DSS compliance, and verified mandates.')
                : (lang === 'ro'
                  ? 'Modificarea structurii de permisiuni și drepturi de acces este rezervată exclusiv administratorilor desemnați prin statutul asociației de proprietari în mediul de producție.'
                  : lang === 'fa'
                  ? 'تغییر و انتساب نقش‌ها در نسخه تجاری، منحصراً در حیطه اختیارات مدیران دارای مجوز قانونی و مصوبات ثبتی معتبر است.'
                  : 'Role assignment and permission modification are restricted to legally appointed property managers with statutory board authorization.')}
            </p>
          </div>

          <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] text-xs text-[#627D98] text-start space-y-1">
            <span className="font-bold text-[#102A43] block">
              {lang === 'ro' ? 'Condiții de activare în producție:' : lang === 'fa' ? 'شرایط فعال‌سازی در محیط عملیاتی:' : 'Production Activation Requirements:'}
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              {isPayment ? (
                <>
                  <li>{lang === 'ro' ? 'Contract de procesare plăți cu procesator autorizat' : lang === 'fa' ? 'قرارداد رسمی با ارائه‌دهنده خدمات پرداخت' : 'Merchant processing agreement with authorized payment provider'}</li>
                  <li>{lang === 'ro' ? 'Cont bancar dedicat deschis pe numele asociației' : lang === 'fa' ? 'حساب بانکی حقوقی فعال به نام مجتمع/ساختمان' : 'Dedicated legal bank account in property association name'}</li>
                </>
              ) : (
                <>
                  <li>{lang === 'ro' ? 'Decizie a adunării generale sau mandat de administrare' : lang === 'fa' ? 'صورت‌جلسه مجمع عمومی و معرفی رسمی مدیر' : 'General Assembly appointment resolution or management mandate'}</li>
                  <li>{lang === 'ro' ? 'Audit de conformitate privind protecția datelor' : lang === 'fa' ? 'تأییدیه سیاست‌های حفاظت از داده‌ها و محرمانگی' : 'Data protection compliance audit and administrator validation'}</li>
                </>
              )}
            </ul>
          </div>

          <div className="pt-2">
            <Link
              href={`/${lang}/contact`}
              className="inline-flex items-center gap-2 px-6 py-3 text-xs font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              <span>{lang === 'ro' ? 'Solicită Integrarea în Producție' : lang === 'fa' ? 'درخواست راه‌اندازی نسخه تجاری' : 'Request Production Onboarding'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 1.5. SETTINGS MODULE VIEW (Never calls demo_list_items_v1 RPC with invalid 'settings' module)
  if (isSettingsModule) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-[#CBD5E1] p-6 sm:p-8 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E9F8E] bg-[#EAF8F5] px-2.5 py-0.5 rounded-full border border-[#B2E5DF]">
                {lang === 'ro' ? 'Configurație Demo' : lang === 'fa' ? 'پیکربندی دمو' : 'Demo Configuration'}
              </span>
              <span className="text-xs text-[#627D98]">
                ID: {workspace.id.slice(0, 8)}...
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#102A43]">
              {currentMeta.title[lang]}
            </h1>
            <p className="text-xs text-[#52667A] mt-1">
              {currentMeta.desc[lang]}
            </p>
          </div>
        </div>

        {/* Settings Detail Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Workspace Attributes */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-card space-y-4">
            <h2 className="text-sm font-bold text-[#102A43] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0E9F8E]" />
              <span>{lang === 'ro' ? 'Parametrii Spațiului de Lucru' : lang === 'fa' ? 'مشخصات محیط کاری' : 'Workspace Parameters'}</span>
            </h2>
            <div className="divide-y divide-[#F0F4F8] text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">{lang === 'ro' ? 'Nume Workspace' : lang === 'fa' ? 'نام ورک‌اسپیس' : 'Workspace Name'}</span>
                <span className="font-bold text-[#102A43]">{workspace.name}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">ID Workspace</span>
                <span className="font-mono text-[11px] text-[#52667A]">{workspace.id}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">{lang === 'ro' ? 'Limbă & Regiune' : lang === 'fa' ? 'زبان و منطقه' : 'Locale'}</span>
                <span className="font-bold uppercase text-[#102A43]">{workspace.locale}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">{lang === 'ro' ? 'Versiune Date Demo' : lang === 'fa' ? 'نسخه داده‌های دمو' : 'Seed Version'}</span>
                <span className="font-mono text-[#0E9F8E] font-bold">v{workspace.seed_version}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">{lang === 'ro' ? 'Rol Utilizator' : lang === 'fa' ? 'نقش کاربری' : 'Assigned Role'}</span>
                <span className="font-semibold text-[#102A43]">{workspace.role}</span>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-card space-y-4">
            <h2 className="text-sm font-bold text-[#102A43] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0E9F8E]" />
              <span>{lang === 'ro' ? 'Profil Administrator Demo' : lang === 'fa' ? 'پروفایل مدیر دمو' : 'Demo Administrator Profile'}</span>
            </h2>
            <div className="divide-y divide-[#F0F4F8] text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">{lang === 'ro' ? 'Nume complet' : lang === 'fa' ? 'نام و نام خانوادگی' : 'Full Name'}</span>
                <span className="font-bold text-[#102A43]">{workspace.profile.first_name} {workspace.profile.last_name}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">{lang === 'ro' ? 'Email de acces' : lang === 'fa' ? 'ایمیل ثبت‌شده' : 'Access Email'}</span>
                <span className="font-semibold text-[#102A43]">{workspace.profile.email}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">{lang === 'ro' ? 'Telefon contact' : lang === 'fa' ? 'شماره تماس' : 'Phone'}</span>
                <span className="font-mono text-[#52667A]">{workspace.profile.mobile_contact || '—'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#627D98]">{lang === 'ro' ? 'Mod Previzualizare' : lang === 'fa' ? 'وضعیت پیش‌نمایش' : 'Preview Mode'}</span>
                <span className="font-bold text-[#0E9F8E] uppercase">{workspace.demo_mode}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#CBD5E1] text-xs text-[#52667A] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0E9F8E] shrink-0" />
          <span>
            {lang === 'ro'
              ? 'Modulul de Setări afișează sumarul spațiului tău demonstrativ. Schimbarea parametrilor sistemului este disponibilă în versiunea operațională de producție.'
              : lang === 'fa'
              ? 'این بخش مشخصات محیط دموی اختصاصی شما را نمایش می‌دهد. تغییر تنظیمات پایهٔ سیستم در نسخه تجاری فعال است.'
              : 'The settings view presents your demo environment configuration. Core parameter mutation is reserved for production workspaces.'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Module Title & Tab Header */}
      <div className="bg-white rounded-3xl border border-[#CBD5E1] p-6 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E9F8E] bg-[#EAF8F5] px-2.5 py-0.5 rounded-full border border-[#B2E5DF]">
              {moduleKey.toUpperCase()}
            </span>
            <span className="text-xs text-[#627D98]">
              {isReportDriven
                ? (lang === 'ro' ? 'Date agregate din baza de date SQL' : lang === 'fa' ? 'داده‌های استخراج‌شده از SQL' : 'SQL aggregated data')
                : (
                  <>
                    {total} {lang === 'ro' ? 'înregistrări în eșantion' : lang === 'fa' ? 'رکورد در پایگاه نمونه' : 'persisted records'}
                  </>
                )}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#102A43]">
            {currentMeta.title[lang]}
          </h1>
          <p className="text-xs text-[#52667A] mt-1">
            {currentMeta.desc[lang]}
          </p>
        </div>

        {/* Tab Switcher: Records vs Form Preview (Hidden for reports-only modules) */}
        {!isReportDriven && (
          <div className="flex items-center bg-[#F0F4F8] p-1 rounded-xl border border-[#CBD5E1] self-start sm:self-center">
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'records'
                  ? 'bg-white text-[#102A43] shadow-xs'
                  : 'text-[#627D98] hover:text-[#102A43]'
              }`}
            >
              {lang === 'ro' ? 'Date de Probă' : lang === 'fa' ? 'فهرست داده‌های نمونه' : 'Sample Records'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview_form')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'preview_form'
                  ? 'bg-white text-[#0E9F8E] shadow-xs'
                  : 'text-[#627D98] hover:text-[#102A43]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'ro' ? 'Formular Previzualizare' : lang === 'fa' ? 'پیش‌نمایش فرم اولیه' : 'Preview Form'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. COMMUNITY & EXPERIENCE (CE) SUBVIEW NAVIGATION */}
      {isCeModule && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-3 shadow-2xs flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-[#627D98] px-2">
            {lang === 'ro' ? 'Secțiuni CE:' : lang === 'fa' ? 'بخش‌های CE:' : 'CE Sections:'}
          </span>
          <button
            type="button"
            onClick={() => setCeSubView('announcements')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              ceSubView === 'announcements'
                ? 'bg-[#EAF8F5] text-[#0E9F8E] border border-[#B2E5DF]'
                : 'text-[#52667A] hover:bg-[#F0F4F8]'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>{lang === 'ro' ? 'Anunțuri Oficiale' : lang === 'fa' ? 'تابلوی اعلانات' : 'Announcements'}</span>
          </button>
          <button
            type="button"
            onClick={() => setCeSubView('bookings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              ceSubView === 'bookings'
                ? 'bg-[#EAF8F5] text-[#0E9F8E] border border-[#B2E5DF]'
                : 'text-[#52667A] hover:bg-[#F0F4F8]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{lang === 'ro' ? 'Facilități & Rezervări' : lang === 'fa' ? 'رزرو مشاعات' : 'Amenity Bookings'}</span>
          </button>
          <button
            type="button"
            onClick={() => setCeSubView('guides')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              ceSubView === 'guides'
                ? 'bg-[#EAF8F5] text-[#0E9F8E] border border-[#B2E5DF]'
                : 'text-[#52667A] hover:bg-[#F0F4F8]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{lang === 'ro' ? 'Ghiduri Spațiu (0)' : lang === 'fa' ? 'راهنماهای فضا (۰)' : 'Space Guides (0)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setCeSubView('events')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              ceSubView === 'events'
                ? 'bg-[#EAF8F5] text-[#0E9F8E] border border-[#B2E5DF]'
                : 'text-[#52667A] hover:bg-[#F0F4F8]'
            }`}
          >
            <PartyPopper className="w-3.5 h-3.5" />
            <span>{lang === 'ro' ? 'Evenimente Comunitare (0)' : lang === 'fa' ? 'رویدادهای همسایگی (۰)' : 'Community Events (0)'}</span>
          </button>
        </div>
      )}

      {/* 3. REPORT-DRIVEN MODULE: FINANCE */}
      {moduleKey === 'finance' && reportsData && (
        <div className="space-y-6">
          {(!reportsData.finance ||
            typeof reportsData.finance.invoiced !== 'number' ||
            !Number.isFinite(reportsData.finance.invoiced) ||
            typeof reportsData.finance.paid !== 'number' ||
            !Number.isFinite(reportsData.finance.paid) ||
            typeof reportsData.finance.outstanding !== 'number' ||
            !Number.isFinite(reportsData.finance.outstanding)) ? (
            <div className="p-8 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <h2 className="text-base font-bold text-[#102A43]">
                {lang === 'ro'
                  ? 'Date Financiare Incomplete în Răspunsul Serverului'
                  : lang === 'fa'
                  ? 'پاسخ مالی دریافتی از سرور ناقص است'
                  : 'Incomplete Financial Data from Server'}
              </h2>
              <p className="text-xs text-[#52667A] max-w-md mx-auto leading-relaxed">
                {lang === 'ro'
                  ? 'Răspunsul primit nu conține indicatorii financiari agregați ceruți. Pentru a preveni dezinformarea, nu sunt afișate valori artificiale de zero.'
                  : lang === 'fa'
                  ? 'داده‌های دریافت‌شده فاقد فیلدهای مالی معتبر است. به منظور جلوگیری از خطای محاسباتی، گزارش صفر نمایش داده نمی‌شود.'
                  : 'The financial response is missing required aggregated values. Zero values are suppressed to avoid misleading reports.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-1">
                  <span className="text-xs font-semibold text-[#627D98] block">
                    {lang === 'ro' ? 'Total Facturat (6 luni)' : lang === 'fa' ? 'کل شارژ صادره (۶ ماه)' : 'Total Invoiced (6 Mo)'}
                  </span>
                  <div className="text-2xl font-bold text-[#102A43] font-mono">
                    {reportsData.finance.invoiced.toLocaleString()} {reportsData.finance.currency}
                  </div>
                  <span className="text-[11px] text-[#627D98] block">
                    {reportsData.finance.invoice_count} {lang === 'ro' ? 'facturi emise' : lang === 'fa' ? 'صورت‌حساب صادرشده' : 'invoices issued'}
                  </span>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-1">
                  <span className="text-xs font-semibold text-[#627D98] block">
                    {lang === 'ro' ? 'Încasat / Plătit' : lang === 'fa' ? 'مجموع واریز شده' : 'Collected / Paid'}
                  </span>
                  <div className="text-2xl font-bold text-emerald-600 font-mono">
                    {reportsData.finance.paid.toLocaleString()} {reportsData.finance.currency}
                  </div>
                  <span className="text-[11px] text-emerald-700 block">
                    {reportsData.finance.invoiced > 0
                      ? Math.round((reportsData.finance.paid / reportsData.finance.invoiced) * 100)
                      : 0}% {lang === 'ro' ? 'rată colectare' : lang === 'fa' ? 'نرخ وصول' : 'collection rate'}
                  </span>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-1">
                  <span className="text-xs font-semibold text-[#627D98] block">
                    {lang === 'ro' ? 'Sold Rămas / Restanțe' : lang === 'fa' ? 'مانده معوقه' : 'Outstanding Balance'}
                  </span>
                  <div className="text-2xl font-bold text-amber-600 font-mono">
                    {reportsData.finance.outstanding.toLocaleString()} {reportsData.finance.currency}
                  </div>
                  <span className="text-[11px] text-amber-700 block">
                    {lang === 'ro' ? 'Restanțe curente' : lang === 'fa' ? 'معوقات جاری واحدها' : 'Current outstanding'}
                  </span>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-1">
                  <span className="text-xs font-semibold text-[#627D98] block">
                    {lang === 'ro' ? 'Monedă Referință' : lang === 'fa' ? 'ارز محاسباتی' : 'Ledger Currency'}
                  </span>
                  <div className="text-2xl font-bold text-[#0E9F8E] font-mono">
                    {reportsData.finance.currency}
                  </div>
                  <span className="text-[11px] text-[#627D98] block">
                    {lang === 'ro' ? 'Configurat per workspace' : lang === 'fa' ? 'تنظیم‌شده در ورک‌اسپیس' : 'Workspace base currency'}
                  </span>
                </div>
              </div>

              {/* Monthly Breakdown Table */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card overflow-hidden">
                <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#102A43]">
                    {lang === 'ro' ? 'Defalcare Lunară Registru Financiar' : lang === 'fa' ? 'تفکیک ماهانه دفاتر مالی' : 'Monthly Financial Ledger Breakdown'}
                  </h2>
                  <span className="text-[11px] text-[#627D98]">
                    {lang === 'ro' ? 'Sursă: demo.finance_samples' : lang === 'fa' ? 'منبع: demo.finance_samples' : 'Source: demo.finance_samples'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#627D98] font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Perioadă / Lună' : lang === 'fa' ? 'دوره / ماه' : 'Period'}</th>
                        <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Facturat' : lang === 'fa' ? 'شارژ صادره' : 'Invoiced'}</th>
                        <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Încasat' : lang === 'fa' ? 'وصول‌شده' : 'Paid'}</th>
                        <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Restanță' : lang === 'fa' ? 'مانده' : 'Outstanding'}</th>
                        <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Rată Încasare' : lang === 'fa' ? 'درصد تسویه' : 'Collection Rate'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F4F8]">
                      {Array.isArray(reportsData.finance.monthly) && reportsData.finance.monthly.map((row: DemoFinanceMonth, idx: number) => {
                        const rowRate = row.invoiced > 0 ? Math.round((row.paid / row.invoiced) * 100) : 0;
                        const rowOutstanding = row.outstanding ?? (row.invoiced - row.paid);
                        return (
                          <tr key={row.period || row.month || idx} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="py-3 px-4 font-bold text-[#102A43] font-mono">{row.period || row.month || '—'}</td>
                            <td className="py-3 px-4 font-mono">{row.invoiced.toLocaleString()} {reportsData.finance.currency}</td>
                            <td className="py-3 px-4 font-mono text-emerald-600 font-semibold">{row.paid.toLocaleString()} {reportsData.finance.currency}</td>
                            <td className="py-3 px-4 font-mono text-amber-600 font-semibold">{rowOutstanding.toLocaleString()} {reportsData.finance.currency}</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {rowRate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. REPORT-DRIVEN MODULE: REPORTS */}
      {moduleKey === 'reports' && reportsData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-[#627D98] block">
                {lang === 'ro' ? 'Sursă Raport' : lang === 'fa' ? 'منبع استخراج' : 'Report Provenance'}
              </span>
              <div className="text-xl font-bold text-[#102A43] font-mono">
                {reportsData.source}
              </div>
              <span className="text-[11px] text-[#627D98] block">
                RPC: demo_get_reports_v1
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-[#627D98] block">
                {lang === 'ro' ? 'Date Native de Business' : lang === 'fa' ? 'داده‌های بومی تجاری' : 'Native Business Data'}
              </span>
              <div className="text-xl font-bold text-[#0E9F8E]">
                {reportsData.native_business_data ? 'Active' : 'Seeded Demo'}
              </div>
              <span className="text-[11px] text-[#627D98] block">
                {lang === 'ro' ? 'Structură SQL garantată' : lang === 'fa' ? 'منطبق با مدل SQL' : 'Strict SQL contract model'}
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-2xs space-y-1">
              <span className="text-xs font-semibold text-[#627D98] block">
                {lang === 'ro' ? 'Generat La' : lang === 'fa' ? 'زمان پردازش' : 'Generated At'}
              </span>
              <div className="text-sm font-bold text-[#102A43] font-mono truncate">
                {reportsData.generated_at ? new Date(reportsData.generated_at).toLocaleString() : '—'}
              </div>
              <span className="text-[11px] text-[#627D98] block">
                Workspace: {workspace.id.slice(0, 8)}...
              </span>
            </div>
          </div>

          {/* Counts Table */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card overflow-hidden">
            <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#102A43]">
                {lang === 'ro' ? 'Distribuția Înregistrărilor pe Kind-uri SQL' : lang === 'fa' ? 'تفکیک اقلام نمونه بر اساس نوع رکورد SQL' : 'Item Distribution by SQL Kind'}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#627D98] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Cheie Kind (SQL)' : lang === 'fa' ? 'نوع رکورد (SQL)' : 'SQL Kind Key'}</th>
                    <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Număr Înregistrări' : lang === 'fa' ? 'تعداد' : 'Count'}</th>
                    <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Stare' : lang === 'fa' ? 'وضعیت' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F4F8]">
                  {Object.entries(reportsData.counts || {}).map(([kind, count]) => (
                    <tr key={kind} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#102A43]">{kind}</td>
                      <td className="py-3 px-4 font-mono text-[#0E9F8E] font-bold">{count}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {count > 0 ? (lang === 'ro' ? 'Eșantion activ' : lang === 'fa' ? 'دارای داده' : 'Active Sample') : (lang === 'ro' ? 'Zero real' : lang === 'fa' ? 'صفر واقعی' : 'Real Zero')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Status Breakdown */}
          {Array.isArray(reportsData.maintenance) && reportsData.maintenance.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card overflow-hidden">
              <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <h2 className="text-sm font-bold text-[#102A43]">
                  {lang === 'ro' ? 'Stare Tichete & Intervenții Tehnice' : lang === 'fa' ? 'وضعیت تیکت‌ها و دستورکارهای نگهداری' : 'Maintenance Tickets & Work Orders by Status'}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#627D98] font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Tip' : lang === 'fa' ? 'نوع' : 'Kind'}</th>
                      <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Stare' : lang === 'fa' ? 'وضعیت' : 'Status'}</th>
                      <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Total' : lang === 'fa' ? 'تعداد' : 'Count'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F4F8]">
                    {reportsData.maintenance.map((m: DemoMaintenanceReportItem, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#102A43]">{m.kind}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            m.status === 'resolved' || m.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. REPORT-DRIVEN MODULE: ACTIVITY */}
      {moduleKey === 'activity' && reportsData && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card overflow-hidden">
          <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#102A43]">
              {lang === 'ro' ? 'Jurnal Cronologic de Evenimente (demo.activity)' : lang === 'fa' ? 'گزارش وقایع زمانی ورک‌اسپیس (demo.activity)' : 'Chronological Audit Log (demo.activity)'}
            </h2>
            <span className="text-[11px] text-[#627D98]">
              {reportsData.activity?.length || 0} {lang === 'ro' ? 'evenimente' : lang === 'fa' ? 'رویداد' : 'events'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#627D98] font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 text-start">ID</th>
                  <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Acțiune' : lang === 'fa' ? 'رویداد' : 'Action'}</th>
                  <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Referință Element' : lang === 'fa' ? 'شناسه مورد' : 'Item Ref'}</th>
                  <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Data / Ora' : lang === 'fa' ? 'تاریخ و ساعت' : 'Timestamp'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F8]">
                {Array.isArray(reportsData.activity) && reportsData.activity.map((act: DemoActivityItem) => (
                  <tr key={act.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4 font-mono text-[#627D98]">#{act.id}</td>
                    <td className="py-3 px-4 font-bold text-[#102A43]">{act.action}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#52667A]">
                      {act.item_id ? act.item_id.slice(0, 16) + '...' : 'System Event'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#627D98]">
                      {act.created_at ? new Date(act.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. STANDARD MODULES & CE: TAB 1 (RECORDS VIEW) */}
      {!isReportDriven && activeTab === 'records' && (
        <div className="space-y-4">

          {/* CE Honest Empty States for unseeded sections */}
          {isCeModule && (ceSubView === 'guides' || ceSubView === 'events') ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-[#CBD5E1] shadow-card space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto border border-slate-200">
                {ceSubView === 'guides' ? <BookOpen className="w-7 h-7" /> : <PartyPopper className="w-7 h-7" />}
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-[#102A43]">
                  {ceSubView === 'guides'
                    ? (lang === 'ro' ? 'Ghidurile de spațiu nu sunt încărcate în acest eșantion' : lang === 'fa' ? 'راهنماهای فضا در این پیش‌نمایش بارگذاری نشده‌اند' : 'Space guides are not loaded in this demo preview')
                    : (lang === 'ro' ? 'Nu există evenimente comunitare programate în acest eșantion' : lang === 'fa' ? 'هیچ رویدادی برای این پیش‌نمایش برنامه‌ریزی نشده است' : 'No community events scheduled in this demo environment')}
                </h3>
                <p className="text-xs text-[#52667A] leading-relaxed">
                  {ceSubView === 'guides'
                    ? (lang === 'ro'
                      ? 'Ghidurile de spațiu documentează regulamentele și instrucțiunile de utilizare specifice proprietății. Acest spațiu demonstrativ nu include ghiduri preîncărcate.'
                      : lang === 'fa'
                      ? 'راهنماهای فضا برای مستندسازی مقررات و دستورالعمل‌های بهره‌برداری از مشاعات ساختمان به کار می‌روند. در این پیش‌نمایش، راهنمای پیش‌فرضی بارگذاری نشده است.'
                      : 'Space guides document property-specific rules and operational instructions. This demo workspace does not include preloaded guides.')
                    : (lang === 'ro'
                      ? 'Secțiunea de evenimente reflectă activitățile și inițiativele organizate la nivelul comunității. În prezent, nu sunt înregistrate evenimente în acest spațiu demonstrativ.'
                      : lang === 'fa'
                      ? 'بخش رویدادها فعالیت‌ها و برنامه‌های جامعهٔ ساکنان را نمایش می‌دهد. در حال حاضر هیچ رویدادی در این محیط نمونه ثبت نشده است.'
                      : 'The community events section reflects activities and initiatives organized for residents. Currently, no events are recorded in this demo workspace.')}
                </p>
              </div>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#627D98] bg-[#F0F4F8] px-3 py-1.5 rounded-xl border border-[#CBD5E1]">
                  <Info className="w-4 h-4 text-[#0E9F8E]" />
                  <span>{lang === 'ro' ? 'Eșantion demonstrativ: 0 înregistrări' : lang === 'fa' ? 'محیط نمونه: بدون دادهٔ ذخیره‌شده' : 'Demo sample: 0 records present'}</span>
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Controls Bar: Search & Page Size */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="relative w-full sm:w-72">
                  <Search className={`w-4 h-4 text-[#627D98] absolute top-2.5 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={lang === 'ro' ? 'Filtrează înregistrările...' : lang === 'fa' ? 'جستجو در موارد...' : 'Filter sample items...'}
                    className={`w-full py-1.5 text-xs border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                  />
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-1.5 text-xs text-[#52667A]">
                    <span>{lang === 'ro' ? 'Afișează:' : lang === 'fa' ? 'تعداد نمایش:' : 'Page size:'}</span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="p-1 border border-[#CBD5E1] rounded-lg text-xs bg-white text-[#102A43] outline-none"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={75}>{lang === 'ro' ? 'Toate' : lang === 'fa' ? 'همه' : 'All'}</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-[#627D98]">
                    <span>
                      {lang === 'ro'
                        ? `Pagina ${page} din ${totalPages}`
                        : lang === 'fa'
                        ? `صفحه ${page} از ${totalPages}`
                        : `Page ${page} of ${totalPages}`}
                    </span>

                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-[#CBD5E1] disabled:opacity-30 hover:bg-[#F0F4F8]"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-[#CBD5E1] disabled:opacity-30 hover:bg-[#F0F4F8]"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Table / List */}
              {loading ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-[#E2E8F0]">
                  <Loader2 className="w-6 h-6 text-[#0E9F8E] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-[#627D98]">{lang === 'ro' ? 'Se încarcă înregistrările...' : lang === 'fa' ? 'در حال بارگذاری اقلام...' : 'Loading sample records...'}</p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {error}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#E2E8F0] text-xs text-[#627D98]">
                  {lang === 'ro' ? 'Nu s-au găsit înregistrări conform filtrului.' : lang === 'fa' ? 'موردی با این فیلتر یافت نشد.' : 'No records match your filter.'}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-start">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#627D98] font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Titlu / Descriere' : lang === 'fa' ? 'عنوان و شرح' : 'Title / Description'}</th>
                          <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Modul Sursă' : lang === 'fa' ? 'ماژول منبع' : 'Source Module'}</th>
                          <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Tip' : lang === 'fa' ? 'نوع' : 'Kind'}</th>
                          <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Stare' : lang === 'fa' ? 'وضعیت' : 'Status'}</th>
                          <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Data Creării' : lang === 'fa' ? 'تاریخ ثبت' : 'Created At'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F4F8]">
                        {filteredItems.map((item) => (
                          <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-bold text-[#102A43] block">
                                {item.title}
                              </span>
                              {item.data && Object.keys(item.data).length > 0 && (
                                <span className="text-[10px] text-[#627D98] truncate max-w-xs block">
                                  {JSON.stringify(item.data).replace(/[{}"']/g, ' ').slice(0, 60)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[11px] font-mono text-[#52667A] bg-[#F0F4F8] px-2 py-0.5 rounded">
                                {item.module}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[11px] text-[#334E68] font-medium">
                                {item.kind}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                item.status === 'active' || item.status === 'resolved' || item.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'pending' || item.status === 'in_progress'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#627D98] font-mono text-[11px]">
                              {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Pagination Info */}
                  <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] text-xs text-[#627D98] flex flex-col sm:flex-row items-center justify-between gap-2">
                    <span>
                      {lang === 'ro'
                        ? `Se afișează ${filteredItems.length} din ${total} înregistrări eșantion`
                        : lang === 'fa'
                        ? `نمایش ${filteredItems.length} از مجموع ${total} رکورد نمونه`
                        : `Showing ${filteredItems.length} of ${total} sample records`}
                    </span>
                    <span className="text-[11px] text-[#9FB3C8]">
                      {lang === 'ro' ? 'Toate datele sunt persistente în baza demonstrativă' : lang === 'fa' ? 'داده‌ها در پایگاه نمونه ذخیره شده‌اند' : 'Records persisted in sample database'}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 7. INITIAL PREVIEW FORMS (Purely transient, disabled mutation buttons) */}
      {!isReportDriven && activeTab === 'preview_form' && (
        <div className="bg-white rounded-3xl border border-[#CBD5E1] shadow-card overflow-hidden animate-in fade-in duration-200">

          {/* Form Banner */}
          <div className="p-6 bg-[#F8FAFC] border-b border-[#CBD5E1] space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0E9F8E]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
                {lang === 'ro' ? 'Formular Demonstrativ' : lang === 'fa' ? 'پیش‌نمایش فرم اولیه' : 'Demo Preview Form'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#102A43]">
              {lang === 'ro'
                ? `Formular inițial: ${currentMeta.title.ro}`
                : lang === 'fa'
                ? `فرم پیش‌نمایش: ${currentMeta.title.fa}`
                : `Initial Form: ${currentMeta.title.en}`}
            </h2>
            <div className="p-3 bg-[#EAF8F5] border border-[#B2E5DF] rounded-xl text-xs text-[#0F5147] flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-[#0E9F8E]" />
              <span className="font-semibold">
                {lang === 'ro'
                  ? 'Mediu demonstrativ exclusiv pentru previzualizare: formularele sunt complet interactive în memorie, însă acțiunile de salvare pe server sunt securizate și dezactivate.'
                  : lang === 'fa'
                  ? 'پیش‌نمایش دمو: فرم‌ها صرفاً موقت هستند؛ دکمه‌های ثبت و ویرایش بدون تغییر در سرور غیرفعال باقی می‌مانند.'
                  : 'Preview-only demo environment: forms are interactive in local memory, but backend write actions are strictly disabled.'}
              </span>
            </div>
          </div>

          {/* Interactive Preview Fields (transient local state only) */}
          <form onSubmit={(e) => e.preventDefault()} className="p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="form-title" className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Titlu / Denumire Înregistrare' : lang === 'fa' ? 'عنوان یا نام قلم' : 'Record Title'}
                </label>
                <input
                  id="form-title"
                  type="text"
                  value={formFields.title || ''}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder={lang === 'ro' ? 'ex. Revizie tehnică centrală termică' : lang === 'fa' ? 'مثال: سرویس دوره‌ای آسانسور بلوک A' : 'e.g. Lift quarterly inspection'}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none"
                />
              </div>

              <div>
                <label htmlFor="form-priority" className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Prioritate / Categorie' : lang === 'fa' ? 'اولویت یا دسته‌بندی' : 'Priority / Category'}
                </label>
                <select
                  id="form-priority"
                  value={formFields.priority || 'standard'}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl bg-white text-[#102A43] outline-none"
                >
                  <option value="standard">{lang === 'ro' ? 'Standard / Rutină' : lang === 'fa' ? 'عادی / روتین' : 'Standard / Routine'}</option>
                  <option value="urgent">{lang === 'ro' ? 'Urgent / Avarie' : lang === 'fa' ? 'فوری / نیازمند اقدام' : 'Urgent / High'}</option>
                  <option value="scheduled">{lang === 'ro' ? 'Programat preventiv' : lang === 'fa' ? 'برنامه‌ریزی دوره‌ای' : 'Scheduled'}</option>
                </select>
              </div>

              <div>
                <label htmlFor="form-unit" className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Spațiu / Unitate asociată' : lang === 'fa' ? 'فضا یا واحد مرتبط' : 'Associated Unit / Space'}
                </label>
                <input
                  id="form-unit"
                  type="text"
                  value={formFields.unit || ''}
                  onChange={(e) => handleFieldChange('unit', e.target.value)}
                  placeholder={lang === 'ro' ? 'ex. Apartament 14 sau Spațiu Comun' : lang === 'fa' ? 'مثال: واحد ۱۴ یا مشاعات لابی' : 'e.g. Unit 14 or Common Area'}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none"
                />
              </div>

              <div>
                <label htmlFor="form-assignee" className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Responsabil / Contractor' : lang === 'fa' ? 'مسئول پیگیری یا پیمانکار' : 'Assigned Vendor / Staff'}
                </label>
                <input
                  id="form-assignee"
                  type="text"
                  value={formFields.assignee || ''}
                  onChange={(e) => handleFieldChange('assignee', e.target.value)}
                  placeholder={lang === 'ro' ? 'ex. SC Tehnic Lift SRL' : lang === 'fa' ? 'مثال: شرکت فنی آسانسور پارس' : 'e.g. Elevator Tech Services'}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="form-notes" className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Instrucțiuni & Detalii de Execuție' : lang === 'fa' ? 'دستورالعمل و توضیحات اجرایی' : 'Instructions & Details'}
                </label>
                <textarea
                  id="form-notes"
                  rows={3}
                  value={formFields.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  placeholder={lang === 'ro' ? 'Note demonstrative... (nu vor fi salvate pe server)' : lang === 'fa' ? 'یادداشت‌های تستی... (این اطلاعات موقت بوده و در سرور ذخیره نمی‌شود)' : 'Sample notes... (will not be saved to backend)'}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] focus:ring-1 focus:ring-[#0E9F8E] outline-none"
                />
              </div>
            </div>

            {/* Action Buttons: Strictly disabled per contract */}
            <div className="pt-4 border-t border-[#F0F4F8] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[#9FB3C8] italic text-center sm:text-start">
                {lang === 'ro'
                  ? 'Butoanele de salvare sunt securizate și dezactivate în modul de previzualizare.'
                  : lang === 'fa'
                  ? 'دکمه‌های ذخیره و ارسال در نسخه دمو غیرفعال هستند.'
                  : 'Save and continue actions are disabled in preview mode.'}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={true}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-[#9FB3C8] bg-[#F0F4F8] rounded-xl cursor-not-allowed opacity-60"
                  title="Disabled in demo preview"
                >
                  {lang === 'ro' ? 'Anulează' : lang === 'fa' ? 'انصراف' : 'Cancel'}
                </button>

                <button
                  type="button"
                  disabled={true}
                  className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold text-white bg-[#0E9F8E]/50 rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5 shadow-none"
                  title="Demo preview; save and continue available in full version"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'ro'
                      ? 'Salvează & Continuă (Dezactivat)'
                      : lang === 'fa'
                      ? 'ذخیره و ادامه (غیرفعال در دمو)'
                      : 'Save & Continue (Disabled)'}
                  </span>
                </button>
              </div>
            </div>
          </form>

        </div>
      )}

    </div>
  );
};
