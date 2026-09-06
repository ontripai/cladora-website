'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import type { Language } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';

export interface CustomerAuditEvent {
  id: number;
  action: string;
  actor_role: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  occurred_at: string;
}

interface CustomerAuditResponse {
  events: CustomerAuditEvent[];
  total: number;
  limit: number;
  offset: number;
  error?: {
    code: string;
    message?: string;
  };
}

const copy = {
  ro: {
    title: 'Jurnal de Audit & Securitate',
    badge: 'Jurnal Oficial Conformitate',
    subtitle:
      'Trasabilitate completă a tuturor operațiunilor administrative, financiare și operaționale din cadrul asociației.',
    searchPlaceholder: 'Căutați după acțiune, rol, tip entitate sau motiv...',
    searchButton: 'Căutare',
    refreshButton: 'Reîmprospătare',
    timestamp: 'Data & Ora',
    actorRole: 'Rol Utilizator',
    action: 'Acțiune Înregistrată',
    entity: 'Entitate',
    reason: 'Motiv / Justificare',
    noEvents: 'Nu a fost găsit niciun eveniment de audit.',
    noContext: 'Selectați un context activ din antet pentru a vizualiza jurnalul de audit.',
    loading: 'Se încarcă jurnalul de audit...',
    errorGeneric: 'Nu s-a putut încărca jurnalul de audit. Reîncercați.',
    errorForbidden: 'Acces interzis: rolul sau contextul dumneavoastră nu are permisiunea audit.events.read.',
    page: 'Pagina',
    of: 'din',
    totalEvents: 'evenimente înregistrate',
    prev: 'Anterior',
    next: 'Următor',
  },
  en: {
    title: 'Audit & Security Trail',
    badge: 'Compliance Audit Trail',
    subtitle:
      'Complete end-to-end traceability of administrative, financial, and operational actions performed in this association.',
    searchPlaceholder: 'Search by action, role, entity type, or reason...',
    searchButton: 'Search',
    refreshButton: 'Refresh',
    timestamp: 'Timestamp',
    actorRole: 'Actor Role',
    action: 'Action',
    entity: 'Entity',
    reason: 'Reason / Justification',
    noEvents: 'No audit events found.',
    noContext: 'Please select an active context in the header to view the audit log.',
    loading: 'Loading audit trail...',
    errorGeneric: 'Failed to retrieve audit events. Please try again.',
    errorForbidden: 'Access Denied: your current role or context lacks the audit.events.read permission.',
    page: 'Page',
    of: 'of',
    totalEvents: 'total events',
    prev: 'Previous',
    next: 'Next',
  },
  fa: {
    title: 'گزارش و ردپای بازرسی امنیتی',
    badge: 'سامانه نظارت و انطباق قانونی',
    subtitle:
      'قابلیت رهگیری و ثبت کامل کلیه اقدامات مدیریتی، مالی و عملیاتی ثبت‌شده در مجتمع.',
    searchPlaceholder: 'جستجو بر اساس اقدام، نقش عامل، موجودیت یا شرح...',
    searchButton: 'جستجو',
    refreshButton: 'تازه‌سازی',
    timestamp: 'زمان ثبت',
    actorRole: 'نقش عامل',
    action: 'اقدام انجام‌شده',
    entity: 'موجودیت',
    reason: 'شرح / توجیه',
    noEvents: 'هیچ رخداد بازرسی ثبت‌شده‌ای یافت نشد.',
    noContext: 'لطفاً برای مشاهده لاگ بازرسی، یک مجتمع را از بالای صفحه انتخاب کنید.',
    loading: 'در حال بارگذاری لاگ بازرسی...',
    errorGeneric: 'دریافت گزارش بازرسی ناموفق بود. لطفاً دوباره تلاش کنید.',
    errorForbidden: 'عدم دسترسی: نقش یا زمینه فعلی شما فاقد مجوز audit.events.read است.',
    page: 'صفحه',
    of: 'از',
    totalEvents: 'رخداد ثبت‌شده',
    prev: 'قبلی',
    next: 'بعدی',
  },
} as const;

function formatEventTimestamp(isoDate: string, lang: Language): string {
  try {
    const d = new Date(isoDate);
    const locale = lang === 'ro' ? 'ro-RO' : lang === 'fa' ? 'fa-IR' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoDate;
  }
}

export function CustomerAuditDashboard({ lang }: { lang: Language }) {
  const t = copy[lang] ?? copy.ro;
  const isRtl = lang === 'fa';
  const state = useCustomerContext();

  const [events, setEvents] = useState<CustomerAuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const contextId = state.active?.context_id;

  const fetchAuditEvents = useCallback(async () => {
    if (!contextId) {
      setEvents([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const offset = (page - 1) * limit;
    const url = new URL('/api/customer/v1/audit', window.location.origin);
    url.searchParams.set('context_id', contextId);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    if (query.trim()) {
      url.searchParams.set('query', query.trim());
    }

    try {
      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) {
        if (res.status === 403) {
          setError(t.errorForbidden);
        } else {
          setError(t.errorGeneric);
        }
        setEvents([]);
        setTotal(0);
        return;
      }

      const body = (await res.json()) as CustomerAuditResponse;
      setEvents(body.events || []);
      setTotal(body.total || 0);
    } catch {
      setError(t.errorGeneric);
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [contextId, page, query, limit, t.errorForbidden, t.errorGeneric]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAuditEvents();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchAuditEvents]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(searchInput);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card-proptech p-6 bg-white border-[#D3DCE6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>{t.badge}</span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-[#102A43] mt-1">
            {t.title}
          </h1>
          <p className="text-xs text-[#52667A] mt-1">
            {t.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => void fetchAuditEvents()}
            disabled={loading || !contextId}
            aria-label={t.refreshButton}
            title={t.refreshButton}
            className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-bold text-[#102A43] hover:bg-[#F8FAFC] transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-[#0E9F8E] ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t.refreshButton}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="card-proptech p-4 bg-white border-[#D3DCE6] flex flex-col sm:flex-row items-center gap-3"
      >
        <div className="relative flex-1 w-full">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7B8A9A]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] ps-10 pe-4 py-2.5 text-xs text-[#102A43] placeholder-[#7B8A9A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]/20"
          />
        </div>
        <button
          type="submit"
          className="w-full sm:w-auto rounded-xl bg-[#102A43] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#243B53] transition"
        >
          {t.searchButton}
        </button>
      </form>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl bg-[#FFF5F5] border border-[#FED7D7] p-4 text-xs font-semibold text-[#C53030] flex items-center gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="card-proptech bg-white overflow-hidden shadow-sm border border-[#D3DCE6]">
        {loading ? (
          <div className="flex min-h-[250px] items-center justify-center p-8">
            <div className="flex flex-col items-center gap-2 text-xs font-semibold text-[#52667A]">
              <Loader2 className="h-6 w-6 animate-spin text-[#0E9F8E]" />
              <span>{t.loading}</span>
            </div>
          </div>
        ) : !contextId ? (
          <div className="p-8 text-center text-xs text-[#52667A]">
            {t.noContext}
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#52667A]">
            {t.noEvents}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-[#F6F9FC] border-b border-[#E2E8F0] text-[#7B8A9A] font-bold uppercase text-[10px]">
                  <th className="p-3.5 text-start whitespace-nowrap">{t.timestamp}</th>
                  <th className="p-3.5 text-start whitespace-nowrap">{t.actorRole}</th>
                  <th className="p-3.5 text-start whitespace-nowrap">{t.action}</th>
                  <th className="p-3.5 text-start whitespace-nowrap">{t.entity}</th>
                  <th className="p-3.5 text-start min-w-[200px]">{t.reason}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F8]">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="p-3.5 font-mono text-[#52667A] whitespace-nowrap text-start ltr-isolate">
                      {formatEventTimestamp(evt.occurred_at, lang)}
                    </td>
                    <td className="p-3.5 text-start whitespace-nowrap">
                      <span className="inline-block rounded-md bg-[#EDF2F7] px-2 py-0.5 text-[11px] font-bold text-[#2D3748]">
                        {evt.actor_role}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-[#102A43] text-start whitespace-nowrap">
                      {evt.action}
                    </td>
                    <td className="p-3.5 text-[#52667A] text-start whitespace-nowrap font-mono text-[11px]">
                      {evt.entity_type}
                      {evt.entity_id ? (
                        <span className="ms-1.5 text-[#7B8A9A]">({evt.entity_id.slice(0, 8)}…)</span>
                      ) : null}
                    </td>
                    <td className="p-3.5 text-[#52667A] text-start text-[11px] leading-relaxed">
                      {evt.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!loading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-xs text-[#52667A]">
            <div>
              <span>{t.page} </span>
              <strong className="text-[#102A43]">{page}</strong>
              <span> {t.of} </span>
              <strong className="text-[#102A43]">{totalPages}</strong>
              <span className="ms-2 text-[#7B8A9A]">
                ({total} {t.totalEvents})
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-bold text-[#102A43] hover:bg-[#F1F5F9] transition disabled:opacity-40"
              >
                {isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                <span>{t.prev}</span>
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-bold text-[#102A43] hover:bg-[#F1F5F9] transition disabled:opacity-40"
              >
                <span>{t.next}</span>
                {isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
