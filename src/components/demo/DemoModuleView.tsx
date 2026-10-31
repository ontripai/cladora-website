'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type { DemoWorkspaceDescriptor, DemoItem, DemoListItemsResult } from '@/lib/demo/demo-types';
import { fetchDemoItems } from '@/lib/demo/demo-client';
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
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  Plus, 
  ShieldCheck, 
  ArrowLeft, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info
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

  // Query state
  const configured = isSupabaseConfigured();
  const [items, setItems] = useState<DemoItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(configured);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [limit, setLimit] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Transient Form Inputs (In-memory only, no localStorage, no backend writes)
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  const handleFieldChange = (key: string, value: string) => {
    setFormFields((prev) => ({ ...prev, [key]: value }));
  };

  // Map route slug to backend module name if needed
  const normalizedModule = moduleKey === 'community-experience' ? null : moduleKey;

  useEffect(() => {
    if (!configured) return;
    let isMounted = true;
    const client = createClient();
    const offset = (page - 1) * limit;

    queueMicrotask(async () => {
      if (!isMounted) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchDemoItems(client, workspace.id, {
          module: normalizedModule,
          limit,
          offset,
        });
        if (isMounted) {
          setItems(res.items || []);
          setTotal(res.total || 0);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error loading demo items');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [configured, workspace.id, normalizedModule, page, limit]);

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

  // Module Headings & Descriptions
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
      title: { ro: 'Comunitate & Experiență (CE)', fa: 'جامعه و تجربه سکونت (CE)', en: 'Community & Experience (CE)' },
      desc: { ro: 'Ghiduri de utilizare a spațiului, facilități și viață comunitară.', fa: 'راهنمای کاربری فضاها، امکانات رفاهی و ارتباط مستقیم با ساکنان.', en: 'Living experience, contextual space guides, and amenities.' },
    },
    governance: {
      title: { ro: 'Guvernanță, Ședințe & Vot', fa: 'مجامع عمومی، صورت‌جلسات و آرا', en: 'Governance & Meetings' },
      desc: { ro: 'Organizarea adunărilor generale și istoricul hotărârilor adoptate.', fa: 'برگزاری مجامع، ثبت تصمیمات قانونی و نظرسنجی رسمی.', en: 'General meeting assemblies and formal resolution logs.' },
    },
    finance: {
      title: { ro: 'Financiar, Cote & Registre', fa: 'مدیریت مالی، شارژ و دفاتر کل', en: 'Finance & Ledger' },
      desc: { ro: 'Calculul cotelor de întreținere și evidența plăților de probă.', fa: 'محاسبه سهم شارژ، تطبیق تراکنش‌ها و تراز مالی شبیه‌سازی‌شده.', en: 'Fee allocations, transparent statements, and sample ledger.' },
    },
    reports: {
      title: { ro: 'Rapoarte Consolidate', fa: 'گزارش‌های تجمیعی و آماری', en: 'Consolidated Reports' },
      desc: { ro: 'Indicatori de performanță și rapoarte operaționale simulate.', fa: 'شاخص‌های کلیدی عملکرد و گزارش‌های آماری جامع.', en: 'Operational metrics and sample reporting.' },
    },
    activity: {
      title: { ro: 'Jurnal de Audit & Activitate', fa: 'گزارش وقایع و تاریخچه رویدادها', en: 'Activity & Audit Log' },
      desc: { ro: 'Istoricul acțiunilor și cronologia operațiunilor din workspace.', fa: 'تاریخچهٔ رویدادها و فعالیت‌های ثبت‌شده در ورک‌اسپیس.', en: 'Chronological workspace audit and event history.' },
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
              {total} {lang === 'ro' ? 'înregistrări în eșantion' : lang === 'fa' ? 'رکورد در پایگاه نمونه' : 'persisted records'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#102A43]">
            {currentMeta.title[lang]}
          </h1>
          <p className="text-xs text-[#52667A] mt-1">
            {currentMeta.desc[lang]}
          </p>
        </div>

        {/* Tab Switcher: Records vs Form Preview */}
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
      </div>

      {/* TAB 1: Records View */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          
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
                  <option value={75}>{lang === 'ro' ? 'Toate (75)' : lang === 'fa' ? 'همه (۷۵)' : 'All (75)'}</option>
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
                      <th className="py-3 px-4 text-start">{lang === 'ro' ? 'Modul' : lang === 'fa' ? 'ماژول' : 'Module'}</th>
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
                  {lang === 'ro' ? 'Toate cele 75 de date sunt accesibile prin paginare' : lang === 'fa' ? 'تمام ۷۵ آیتم از طریق ورق‌زدن صفحات قابل مشاهده است' : 'All 75 records fully accessible via pagination'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Initial Form Preview (Read-Only Preview) */}
      {activeTab === 'preview_form' && (
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
                  ? 'پیش‌نمایش دمو؛ ذخیره و ادامه در نسخه کامل / Previzualizare demo; salvarea și continuarea sunt disponibile în versiunea completă.'
                  : lang === 'fa'
                  ? 'پیش‌نمایش دمو؛ ذخیره و ادامه در نسخه کامل.'
                  : 'Demo preview; save and continue available in full version.'}
              </span>
            </div>
          </div>

          {/* Interactive Preview Fields (transient local state) */}
          <div className="p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Titlu / Denumire Înregistrare' : lang === 'fa' ? 'عنوان یا نام قلم' : 'Record Title'}
                </label>
                <input
                  type="text"
                  value={formFields.title || ''}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder={lang === 'ro' ? 'ex. Revizie tehnică centrală termică' : lang === 'fa' ? 'مثال: سرویس دوره‌ای آسانسور بلوک A' : 'e.g. Lift quarterly inspection'}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Prioritate / Categorie' : lang === 'fa' ? 'اولویت یا دسته‌بندی' : 'Priority / Category'}
                </label>
                <select
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
                <label className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Spațiu / Unitate asociată' : lang === 'fa' ? 'فضا یا واحد مرتبط' : 'Associated Unit / Space'}
                </label>
                <input
                  type="text"
                  value={formFields.unit || ''}
                  onChange={(e) => handleFieldChange('unit', e.target.value)}
                  placeholder={lang === 'ro' ? 'ex. Apartament 14 sau Spațiu Comun' : lang === 'fa' ? 'مثال: واحد ۱۴ یا مشاعات لابی' : 'e.g. Unit 14 or Common Area'}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Responsabil / Contractor' : lang === 'fa' ? 'مسئول پیگیری یا پیمانکار' : 'Assigned Vendor / Staff'}
                </label>
                <input
                  type="text"
                  value={formFields.assignee || ''}
                  onChange={(e) => handleFieldChange('assignee', e.target.value)}
                  placeholder={lang === 'ro' ? 'ex. SC Tehnic Lift SRL' : lang === 'fa' ? 'مثال: شرکت فنی آسانسور پارس' : 'e.g. Elevator Tech Services'}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#102A43] block mb-1">
                  {lang === 'ro' ? 'Instrucțiuni & Detalii de Execuție' : lang === 'fa' ? 'دستورالعمل و توضیحات اجرایی' : 'Instructions & Details'}
                </label>
                <textarea
                  rows={3}
                  value={formFields.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  placeholder={lang === 'ro' ? 'Note demonstrative... (nu vor fi salvate pe server)' : lang === 'fa' ? 'یادداشت‌های تستی... (این اطلاعات موقت بوده و در سرور ذخیره نمی‌شود)' : 'Sample notes... (will not be saved to backend)'}
                  className="w-full p-2.5 text-xs sm:text-sm border border-[#CBD5E1] rounded-xl focus:border-[#0E9F8E] outline-none"
                />
              </div>
            </div>

            {/* Action Buttons: Disabled strictly per contract */}
            <div className="pt-4 border-t border-[#F0F4F8] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-[#9FB3C8] italic text-center sm:text-start">
                {lang === 'ro'
                  ? 'Butonul de salvare este dezactivat în modul demo.'
                  : lang === 'fa'
                  ? 'دکمه‌های ذخیره و ارسال در نسخه دمو غیرفعال هستند.'
                  : 'Save and continue actions are disabled in preview mode.'}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={true}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-[#9FB3C8] bg-[#F0F4F8] rounded-xl cursor-not-allowed opacity-60"
                  title="Disabled in demo"
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

          </div>

        </div>
      )}

    </div>
  );
};
