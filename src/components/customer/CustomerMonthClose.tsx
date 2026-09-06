'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Language } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';
import type {
  ClosePeriodResponse,
  CloseReadinessResponse,
} from '@/lib/customer/financial-reports-schema';

type PeriodSummary = {
  id: string;
  starts_on: string;
  ends_on: string;
  status: 'open' | 'closed';
  closed_at: string | null;
};

const copy = {
  ro: {
    title: 'Închidere de lună',
    sub: 'Verificarea pregătirii contabile și blocarea ireversibilă a perioadei',
    periodsList: 'Perioade contabile',
    noPeriods: 'Nu există perioade contabile înregistrate pentru acest context.',
    readinessTitle: 'Pregătire pentru închidere',
    selectPeriodPrompt: 'Selectați o perioadă contabilă din listă pentru a evalua starea de închidere.',
    statusOpen: 'Deschisă',
    statusClosed: 'Închisă & Imutabilă',
    draftJournals: 'Jurnale draft (nefinalizate)',
    unbalancedJournals: 'Jurnale dezechilibrate',
    postedJournals: 'Jurnale postate',
    totalDebit: 'Total debit',
    totalCredit: 'Total credit',
    difference: 'Diferență',
    currencies: 'Monede detectate',
    warnings: 'Avertismente',
    blockingReasons: 'Motive de blocare',
    canCloseReady: 'Perioada este pregătită pentru închidere',
    cannotCloseNotice: 'Perioada nu poate fi închisă în această stare',
    closeButton: 'Închide perioada contabilă',
    closeModalTitle: 'Confirmare închidere perioadă contabilă',
    closeModalWarning: 'Atenție: Această operațiune este definitivă și ireversibilă. Registrul pentru această perioadă va fi blocat împotriva oricăror modificări ulterioare, iar un instantaneu imutabil va fi arhivat.',
    confirmClose: 'Confirmă și închide perioada',
    cancel: 'Renunță',
    closing: 'Se procesează închiderea...',
    snapshotTitle: 'Instantaneu oficial de închidere (Imutabil)',
    closedAt: 'Închisă la',
    closedBy: 'Actor autorizat',
    readonlyRoleNotice: 'Rol cu atribuții de supraveghere / audit: acțiunea de închidere este rezervată administratorului și managerului de proprietate.',
    errorGeneric: 'Eroare la procesarea cererii.',
    errorConflict: 'Perioada a fost deja închisă de un alt utilizator.',
    errorForbidden: 'Nu aveți permisiunea de a închide această perioadă contabilă.',
    errorBlocked: 'Închiderea a fost respinsă de server: există jurnale draft sau dezechilibrate.',
    successClosed: 'Perioada contabilă a fost închisă cu succes!',
    refresh: 'Actualizează',
    noJournals: 'Nu există înregistrări contabile în această perioadă.',
    reasonLabel: 'Motiv / Notă închidere (opțional)',
    reasonPlaceholder: 'ex: Închidere contabilă ordinară de sfârșit de lună',
  },
  en: {
    title: 'Month close',
    sub: 'Accounting period close readiness evaluation and authoritative freeze',
    periodsList: 'Accounting periods',
    noPeriods: 'No accounting periods registered for this active context.',
    readinessTitle: 'Close readiness assessment',
    selectPeriodPrompt: 'Select an accounting period from the list to assess close readiness.',
    statusOpen: 'Open',
    statusClosed: 'Closed & Immutable',
    draftJournals: 'Draft journals',
    unbalancedJournals: 'Unbalanced journals',
    postedJournals: 'Posted journals',
    totalDebit: 'Total debit',
    totalCredit: 'Total credit',
    difference: 'Difference',
    currencies: 'Currencies detected',
    warnings: 'Warnings',
    blockingReasons: 'Blocking reasons',
    canCloseReady: 'Period is balanced and ready for close',
    cannotCloseNotice: 'Period cannot be closed in this state',
    closeButton: 'Close accounting period',
    closeModalTitle: 'Confirm accounting period close',
    closeModalWarning: 'Warning: This operation is permanent and authoritative. The ledger for this period will be sealed against updates and an immutable snapshot will be archived.',
    confirmClose: 'Confirm and seal period',
    cancel: 'Cancel',
    closing: 'Sealing period...',
    snapshotTitle: 'Official close snapshot (Immutable)',
    closedAt: 'Closed at',
    closedBy: 'Authoritative actor',
    readonlyRoleNotice: 'Financial oversight / audit persona: period close mutations are strictly restricted to Association Administrator and Property Manager.',
    errorGeneric: 'An error occurred while processing the request.',
    errorConflict: 'This accounting period has already been closed.',
    errorForbidden: 'You do not have permission to close this accounting period.',
    errorBlocked: 'Period close rejected: open draft or unbalanced journals exist.',
    successClosed: 'Accounting period closed and sealed successfully!',
    refresh: 'Refresh',
    noJournals: 'No ledger entries recorded in this period.',
    reasonLabel: 'Close reason / Note (optional)',
    reasonPlaceholder: 'e.g. Regular monthly financial close',
  },
  fa: {
    title: 'بستن دوره حسابداری ماهانه',
    sub: 'سنجش آمادگی بستن دوره و قفل قطعی و غیرقابل‌تغییر اسناد دفتر کل',
    periodsList: 'دوره‌های حسابداری',
    noPeriods: 'هیچ دوره حسابداری برای این زمینه فعال یافت نشد.',
    readinessTitle: 'ارزیابی آمادگی جهت بستن حساب‌ها',
    selectPeriodPrompt: 'جهت ارزیابی تراز و آمادگی بستن، یک دوره را از فهرست انتخاب کنید.',
    statusOpen: 'باز',
    statusClosed: 'بسته‌شده و غیرقابل‌تغییر',
    draftJournals: 'اسناد پیش‌نویس (تاییدنشده)',
    unbalancedJournals: 'اسناد نامتوازن',
    postedJournals: 'اسناد قطعی ثبت‌شده',
    totalDebit: 'جمع بدهکار',
    totalCredit: 'جمع بستانکار',
    difference: 'اختلاف تراز',
    currencies: 'تفکیک ارزهای دوره',
    warnings: 'هشدارهای مالی',
    blockingReasons: 'موانع بستن دوره',
    canCloseReady: 'دوره کاملاً متوازن و آماده بستن است',
    cannotCloseNotice: 'بستن دوره در وضعیت فعلی امکان‌پذیر نیست',
    closeButton: 'بستن و قفل دوره حسابداری',
    closeModalTitle: 'تأیید بستن نهایی دوره مالی',
    closeModalWarning: 'هشدار امنیتی: این عملیات قطعی، غیرقابل بازگشت و نهایی است. پس از بستن، امکان هیچ‌گونه ویرایش در اسناد این دوره وجود نخواهد داشت و اسنپ‌شات غیرقابل‌تغییر ثبت خواهد شد.',
    confirmClose: 'تأیید نهایی و قفل دوره',
    cancel: 'انصراف',
    closing: 'در حال ثبت و بستن دوره...',
    snapshotTitle: 'اسنپ‌شات قطعی دوره بسته شده (غیرقابل‌تغییر)',
    closedAt: 'تاریخ و ساعت بستن',
    closedBy: 'شناسه کاربر مجری',
    readonlyRoleNotice: 'نقش نظارتی: عملیات بستن دوره منحصراً در اختیار مدیر انجمن و مدیر مجتمع می‌باشد و برای نقش‌های نظارتی غیرفعال است.',
    errorGeneric: 'خطا در پردازش درخواست.',
    errorConflict: 'این دوره مالی قبلاً بسته شده است.',
    errorForbidden: 'شما مجوز لازم برای بستن دوره حسابداری را ندارید.',
    errorBlocked: 'بستن دوره ناموفق بود: اسناد پیش‌نویس یا نامتوازن وجود دارند.',
    successClosed: 'دوره حسابداری با موفقیت بسته و اسنپ‌شات غیرقابل‌تغییر ذخیره شد!',
    refresh: 'به‌روزرسانی',
    noJournals: 'هیچ سندی در این دوره ثبت نشده است.',
    reasonLabel: 'علت / یادداشت بستن دوره (اختیاری)',
    reasonPlaceholder: 'مثال: بستن عادی پایان دوره مالی',
  },
};

function formatMoney(amount: number, currency: string, lang: Language): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const locale = lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function CustomerMonthClose({ lang }: { lang: Language }) {
  const { active, dashboard } = useCustomerContext();
  const t = copy[lang];

  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<CloseReadinessResponse | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const roleCode = dashboard?.context?.role_code;
  // ONLY association_admin and property_manager have mutate rights
  const canMutateRole = roleCode === 'association_admin' || roleCode === 'property_manager';

  // 1. Fetch periods list from accounting ledger endpoint
  const loadPeriods = useCallback(async () => {
    if (!active?.context_id) return;
    setLoadingPeriods(true);
    try {
      const res = await fetch(`/api/customer/v1/accounting?context_id=${active.context_id}&limit=1`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        const pList: PeriodSummary[] = data.periods ?? [];
        setPeriods(pList);
        if (pList.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(pList[0].id);
        }
      }
    } catch {
      // Ignored: periods array will remain empty
    } finally {
      setLoadingPeriods(false);
    }
  }, [active, selectedPeriodId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPeriods();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPeriods]);

  // 2. Fetch readiness for selected period
  const loadReadiness = useCallback(async (periodId: string) => {
    if (!active?.context_id || !periodId) return;
    setLoadingReadiness(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/customer/v1/accounting/periods/${periodId}/close-readiness?context_id=${active.context_id}`,
        { headers: { 'Cache-Control': 'no-cache' } }
      );
      if (!res.ok) {
        if (res.status === 403) setErrorMessage(t.errorForbidden);
        else setErrorMessage(t.errorGeneric);
        setReadiness(null);
        return;
      }
      const json = (await res.json()) as CloseReadinessResponse;
      setReadiness(json);
    } catch {
      setErrorMessage(t.errorGeneric);
      setReadiness(null);
    } finally {
      setLoadingReadiness(false);
    }
  }, [active, t.errorForbidden, t.errorGeneric]);

  useEffect(() => {
    if (selectedPeriodId) {
      const timer = setTimeout(() => {
        void loadReadiness(selectedPeriodId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedPeriodId, loadReadiness]);

  // 3. Execute close mutation
  async function handleClosePeriod() {
    if (!active?.context_id || !selectedPeriodId || !canMutateRole) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const trimmedReason = closeReason.trim();
      const res = await fetch(
        `/api/customer/v1/accounting/periods/${selectedPeriodId}/close`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context_id: active.context_id,
            reason: trimmedReason.length > 0 ? trimmedReason : undefined,
          }),
        }
      );

      if (res.ok) {
        const result = (await res.json()) as ClosePeriodResponse;
        setSuccessMessage(t.successClosed);
        setModalOpen(false);
        setCloseReason('');
        // Refresh period readiness and period list
        await loadReadiness(selectedPeriodId);
        await loadPeriods();
      } else {
        setModalOpen(false);
        if (res.status === 409) setErrorMessage(t.errorConflict);
        else if (res.status === 403) setErrorMessage(t.errorForbidden);
        else if (res.status === 400) setErrorMessage(t.errorBlocked);
        else setErrorMessage(t.errorGeneric);
      }
    } catch {
      setModalOpen(false);
      setErrorMessage(t.errorGeneric);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId]
  );

  return (
    <section className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#102A43]">
              {t.title}
            </h1>
            {!canMutateRole && (
              <span className="rounded-full bg-[#EAF8F5] px-3 py-1 text-xs font-bold text-[#0A6E62]">
                {copy[lang].statusClosed}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#52667A]">{t.sub}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadPeriods();
            if (selectedPeriodId) void loadReadiness(selectedPeriodId);
          }}
          disabled={loadingPeriods || loadingReadiness}
          className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#102A43] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loadingPeriods || loadingReadiness ? 'animate-spin' : ''
            }`}
          />
          {t.refresh}
        </button>
      </header>

      {/* Read-only oversight banner for President and Censor */}
      {!canMutateRole && (
        <div
          role="note"
          className="flex items-center gap-3 rounded-2xl border border-[#99F6E4] bg-[#F0FDFA] p-4 text-xs font-medium text-[#0F766E]"
        >
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#0D9488]" />
          <span>{t.readonlyRoleNotice}</span>
        </div>
      )}

      {/* Feedback alerts */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Grid: Left Period Selector, Right Readiness Assessment */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Accounting Periods List */}
        <div className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-[#102A43]">
            {t.periodsList}
          </h2>

          {loadingPeriods && (
            <div className="p-8 text-center text-xs text-[#52667A]">
              <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin text-[#0E9F8E]" />
              {t.refresh}...
            </div>
          )}

          {!loadingPeriods && periods.length === 0 && (
            <p className="text-xs text-[#52667A]">{t.noPeriods}</p>
          )}

          <div className="space-y-2">
            {periods.map((p) => {
              const isSelected = p.id === selectedPeriodId;
              const isClosed = p.status === 'closed';

              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setSelectedPeriodId(p.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-start transition ${
                    isSelected
                      ? 'border-[#0E9F8E] bg-[#EAF8F5] text-[#0A6E62]'
                      : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43] hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-mono text-xs font-bold">
                      {p.starts_on} — {p.ends_on}
                    </div>
                    {isClosed && p.closed_at && (
                      <div className="mt-1 text-[10px] text-[#52667A]">
                        {t.closedAt}: {p.closed_at.slice(0, 10)}
                      </div>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                      isClosed
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isClosed ? <Lock className="h-3 w-3" /> : null}
                    {isClosed ? t.statusClosed : t.statusOpen}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Readiness Assessment & Snapshot */}
        <div className="space-y-6 lg:col-span-2">
          {!selectedPeriodId && (
            <div className="rounded-2xl border border-[#CBD5E1] bg-white p-12 text-center text-sm text-[#52667A]">
              {t.selectPeriodPrompt}
            </div>
          )}

          {loadingReadiness && (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#CBD5E1] bg-white p-12 text-sm text-[#52667A]">
              <RefreshCw className="h-5 w-5 animate-spin text-[#0E9F8E]" />
              <span>{t.readinessTitle}...</span>
            </div>
          )}

          {!loadingReadiness && readiness && (
            <div className="space-y-6">
              {/* Readiness Card */}
              <div className="rounded-2xl border border-[#CBD5E1] bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#102A43]">
                      {t.readinessTitle}
                    </h2>
                    <p className="font-mono text-xs text-[#52667A]">
                      {readiness.period.starts_on} — {readiness.period.ends_on}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      readiness.can_close
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {readiness.can_close ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    {readiness.can_close
                      ? t.canCloseReady
                      : t.cannotCloseNotice}
                  </span>
                </div>

                {/* KPI Metrics */}
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <div className="text-xs text-[#52667A]">{t.draftJournals}</div>
                    <div
                      className={`mt-1 text-lg font-bold ${
                        readiness.draft_journals_count > 0
                          ? 'text-red-600'
                          : 'text-[#102A43]'
                      }`}
                    >
                      {readiness.draft_journals_count}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <div className="text-xs text-[#52667A]">
                      {t.unbalancedJournals}
                    </div>
                    <div
                      className={`mt-1 text-lg font-bold ${
                        readiness.unbalanced_journals_count > 0
                          ? 'text-red-600'
                          : 'text-[#102A43]'
                      }`}
                    >
                      {readiness.unbalanced_journals_count}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                    <div className="text-xs text-[#52667A]">{t.postedJournals}</div>
                    <div className="mt-1 text-lg font-bold text-[#102A43]">
                      {readiness.posted_journals_count}
                    </div>
                  </div>
                </div>

                {/* Multi-Currency Ledger Summaries */}
                <div className="mt-4 space-y-3">
                  <h3 className="text-xs font-bold text-[#102A43]">{t.currencies}</h3>
                  {readiness.currency_summaries && readiness.currency_summaries.length > 0 ? (
                    <div className="space-y-2">
                      {readiness.currency_summaries.map((cs) => (
                        <div
                          key={cs.currency}
                          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs"
                        >
                          <div className="mb-2 flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                            <span className="rounded-md bg-[#0E9F8E]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0A6E62]">
                              {cs.currency}
                            </span>
                            <span
                              className={`font-mono text-[11px] font-bold ${
                                cs.difference === 0 ? 'text-[#0A6E62]' : 'text-red-600'
                              }`}
                            >
                              {cs.difference === 0 ? '✓' : `Δ ${formatMoney(cs.difference, cs.currency, lang)}`}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <span className="text-[#52667A]">{t.totalDebit}:</span>{' '}
                              <strong className="font-mono text-[#102A43]">
                                {formatMoney(cs.total_debit, cs.currency, lang)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#52667A]">{t.totalCredit}:</span>{' '}
                              <strong className="font-mono text-[#102A43]">
                                {formatMoney(cs.total_credit, cs.currency, lang)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[#52667A]">{t.difference}:</span>{' '}
                              <strong
                                className={`font-mono ${
                                  cs.difference === 0 ? 'text-[#0A6E62]' : 'text-red-600'
                                }`}
                              >
                                {formatMoney(cs.difference, cs.currency, lang)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#52667A]">
                      {t.noJournals}
                    </div>
                  )}
                </div>

                {/* Warnings / Blocking Reasons */}
                {readiness.blocking_reasons.length > 0 && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    <div className="font-bold">{t.blockingReasons}:</div>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {readiness.blocking_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mutation Control: ONLY rendered for association_admin & property_manager */}
                {canMutateRole && readiness.status === 'open' && (
                  <div className="mt-6 flex justify-end border-t border-[#E2E8F0] pt-4">
                    <button
                      type="button"
                      disabled={!readiness.can_close || isSubmitting}
                      onClick={() => setModalOpen(true)}
                      className="flex items-center gap-2 rounded-xl bg-[#0E9F8E] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0A6E62] disabled:opacity-50"
                    >
                      <Lock className="h-4 w-4" />
                      {t.closeButton}
                    </button>
                  </div>
                )}
              </div>

              {/* Immutable Snapshot View if Period is Closed */}
              {readiness.status === 'closed' && readiness.period.snapshot_json && (
                <div className="rounded-2xl border border-[#CBD5E1] bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3 text-sm font-bold text-[#102A43]">
                    <Lock className="h-4 w-4 text-[#0E9F8E]" />
                    <span>{t.snapshotTitle}</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="text-[#52667A]">
                      {t.closedAt}:{' '}
                      <span className="font-mono text-[#102A43]">
                        {readiness.period.closed_at}
                      </span>
                    </div>
                    {readiness.period.closed_by && (
                      <div className="text-[#52667A]">
                        {t.closedBy}:{' '}
                        <span className="font-mono text-[#102A43]">
                          {readiness.period.closed_by}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 max-h-60 overflow-auto rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 font-mono text-[11px] text-[#102A43]">
                    <pre>
                      {JSON.stringify(readiness.period.snapshot_json, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalOpen && canMutateRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-base font-bold text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <h2>{t.closeModalTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-[#52667A] hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#52667A]">
              {t.closeModalWarning}
            </p>

            {selectedPeriod && (
              <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs font-bold text-[#102A43]">
                {selectedPeriod.starts_on} — {selectedPeriod.ends_on}
              </div>
            )}

            <div className="mt-4">
              <label
                htmlFor="close-period-reason"
                className="block text-xs font-semibold text-[#102A43]"
              >
                {t.reasonLabel}
              </label>
              <input
                id="close-period-reason"
                type="text"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder={t.reasonPlaceholder}
                maxLength={500}
                className="mt-1 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs text-[#102A43] placeholder-[#94A3B8] focus:border-[#0E9F8E] focus:outline-none"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#52667A] hover:bg-slate-50"
              >
                {t.cancel}
              </button>

              <button
                type="button"
                onClick={() => void handleClosePeriod()}
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {isSubmitting ? t.closing : t.confirmClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
