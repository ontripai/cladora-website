'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Coins,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { Language } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';
import type {
  FinancialReportResponse,
  ReportType,
} from '@/lib/customer/financial-reports-schema';

const copy = {
  ro: {
    title: 'Rapoarte financiare',
    sub: 'Balanță de verificare, profit și pierdere și bilanț contabil din date reale de registru',
    readonly: 'Numai citire',
    readOnlyBanner: 'Acces de supraveghere financiară: datele sunt prezentate în regim strict de consultare.',
    selectReport: 'Tip raport',
    trialBalance: 'Balanță de verificare',
    profitAndLoss: 'Profit și pierdere (P&L)',
    balanceSheet: 'Bilanț contabil',
    from: 'De la',
    to: 'Până la',
    currency: 'Monedă',
    generate: 'Actualizează raport',
    accountCode: 'Cod cont',
    accountName: 'Denumire cont',
    accountType: 'Tip cont',
    debit: 'Debit',
    credit: 'Credit',
    balance: 'Sold net',
    amount: 'Valoare',
    totalDebit: 'Total debit',
    totalCredit: 'Total credit',
    totalIncome: 'Total venituri',
    totalExpense: 'Total cheltuieli',
    netProfitLoss: 'Rezultat net (Profit / Pierdere)',
    totalAssets: 'Total active',
    totalLiabilities: 'Total datorii',
    equityBase: 'Capitaluri proprii',
    retainedEarnings: 'Rezultat reportat / curent',
    totalEquity: 'Total capitaluri',
    balanced: 'Echilibrat (Diferență 0)',
    unbalanced: 'Dezechilibrat',
    difference: 'Diferență',
    otherCurrenciesWarning: 'Atenție: există tranzacții înregistrate în alte monede în perioada selectată. Nu s-a efectuat nicio conversie forțată.',
    empty: 'Nu există date contabile pentru filtrele și moneda selectate.',
    error: 'Eroare la obținerea raportului financiar de la server.',
    accessDenied: 'Accesul la rapoartele financiare este restricționat pentru acest context.',
    loading: 'Se calculează raportul financiar...',
  },
  en: {
    title: 'Financial reports',
    sub: 'Trial balance, profit & loss, and balance sheet calculated from authoritative ledger entries',
    readonly: 'Read-only',
    readOnlyBanner: 'Financial oversight access: ledger reports are presented in strict consultation mode.',
    selectReport: 'Report type',
    trialBalance: 'Trial balance',
    profitAndLoss: 'Profit & loss (P&L)',
    balanceSheet: 'Balance sheet',
    from: 'From',
    to: 'To',
    currency: 'Currency',
    generate: 'Update report',
    accountCode: 'Account code',
    accountName: 'Account name',
    accountType: 'Account type',
    debit: 'Debit',
    credit: 'Credit',
    balance: 'Net balance',
    amount: 'Amount',
    totalDebit: 'Total debit',
    totalCredit: 'Total credit',
    totalIncome: 'Total income',
    totalExpense: 'Total expenses',
    netProfitLoss: 'Net profit / loss',
    totalAssets: 'Total assets',
    totalLiabilities: 'Total liabilities',
    equityBase: 'Equity base',
    retainedEarnings: 'Retained / current earnings',
    totalEquity: 'Total equity',
    balanced: 'Balanced (Difference 0)',
    unbalanced: 'Unbalanced',
    difference: 'Difference',
    otherCurrenciesWarning: 'Notice: Transactions in other currencies exist in this period. Cross-currency amounts are strictly segregated.',
    empty: 'No accounting records found for the selected period and currency.',
    error: 'Failed to retrieve financial report from server.',
    accessDenied: 'Access to financial reports is restricted for your role in this context.',
    loading: 'Calculating financial report...',
  },
  fa: {
    title: 'گزارش‌های مالی مدیریتی',
    sub: 'تراز آزمایشی، سود و زیان و ترازنامه مبتنی بر اسناد قطعی دفتر کل',
    readonly: 'فقط خواندنی',
    readOnlyBanner: 'دسترسی نظارتی: گزارش‌های مالی در وضعیت کاملاً مستقل و فقط خواندنی نمایش داده می‌شوند.',
    selectReport: 'نوع گزارش',
    trialBalance: 'تراز آزمایشی',
    profitAndLoss: 'صورت سود و زیان (P&L)',
    balanceSheet: 'ترازنامه',
    from: 'از تاریخ',
    to: 'تا تاریخ',
    currency: 'ارز مبنا',
    generate: 'به‌روزرسانی گزارش',
    accountCode: 'کد حساب',
    accountName: 'نام حساب',
    accountType: 'نوع حساب',
    debit: 'بدهکار',
    credit: 'بستانکار',
    balance: 'مانده خالص',
    amount: 'مبلغ',
    totalDebit: 'جمع بدهکار',
    totalCredit: 'جمع بستانکار',
    totalIncome: 'جمع درآمدها',
    totalExpense: 'جمع هزینه‌ها',
    netProfitLoss: 'سود / زیان خالص',
    totalAssets: 'جمع دارایی‌ها',
    totalLiabilities: 'جمع بدهی‌ها',
    equityBase: 'سرمایه اولیه و اندوخته',
    retainedEarnings: 'سود / زیان انباشته دوره',
    totalEquity: 'جمع کل حقوق صاحبان سهام',
    balanced: 'تراز متوازن (اختلاف صفر)',
    unbalanced: 'نامتوازن',
    difference: 'اختلاف تراز',
    otherCurrenciesWarning: 'هشدار: اسنادی با ارزهای دیگر در این بازه ثبت شده‌اند. جهت جلوگیری از جمع نادرست، ارزها تفکیک شده‌اند.',
    empty: 'هیچ رکوردی برای بازه زمانی و ارز انتخابی یافت نشد.',
    error: 'دریافت گزارش مالی از سرور با خطا مواجه شد.',
    accessDenied: 'دسترسی به گزارش‌های مالی برای این زمینه امکان‌پذیر نیست.',
    loading: 'در حال محاسبه گزارش مالی از دفتر کل...',
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

export function CustomerFinancialReports({ lang }: { lang: Language }) {
  const { active, dashboard } = useCustomerContext();
  const t = copy[lang];

  const [reportType, setReportType] = useState<ReportType>('trial_balance');
  const [currency, setCurrency] = useState<string>('RON');

  // Default dates: year-to-date
  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const y = today.getFullYear();
    return `${y}-01-01`;
  }, [today]);
  const defaultTo = useMemo(() => {
    return today.toISOString().slice(0, 10);
  }, [today]);

  const [from, setFrom] = useState<string>(defaultFrom);
  const [to, setTo] = useState<string>(defaultTo);
  const [data, setData] = useState<FinancialReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const isOversightRole =
    dashboard?.context?.role_code === 'president' ||
    dashboard?.context?.role_code === 'censor';

  const loadReport = useCallback(async () => {
    if (!active?.context_id) return;
    setLoading(true);
    setErrorStatus(null);

    const params = new URLSearchParams({
      context_id: active.context_id,
      report_type: reportType,
      from,
      to,
      currency,
    });

    try {
      const res = await fetch(`/api/customer/v1/financial-reports?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!res.ok) {
        setErrorStatus(res.status);
        setData(null);
        return;
      }

      const json = (await res.json()) as FinancialReportResponse;
      setData(json);
    } catch {
      setErrorStatus(500);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [active, reportType, from, to, currency]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReport();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadReport]);

  if (!active) {
    return (
      <div className="rounded-2xl border border-[#CBD5E1] bg-white p-8 text-center text-sm text-[#52667A]">
        {t.empty}
      </div>
    );
  }

  return (
    <section className="space-y-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#102A43]">
              {t.title}
            </h1>
            {isOversightRole && (
              <span className="rounded-full bg-[#EAF8F5] px-3 py-1 text-xs font-bold text-[#0A6E62]">
                {t.readonly}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#52667A]">{t.sub}</p>
        </div>

        <button
          type="button"
          onClick={() => void loadReport()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#102A43] shadow-sm transition hover:bg-[#F8FAFC] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t.generate}
        </button>
      </header>

      {/* Oversight Role Banner */}
      {isOversightRole && (
        <div
          role="note"
          className="flex items-center gap-3 rounded-2xl border border-[#99F6E4] bg-[#F0FDFA] p-4 text-xs font-medium text-[#0F766E]"
        >
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#0D9488]" />
          <span>{t.readOnlyBanner}</span>
        </div>
      )}

      {/* Controls & Filter Card */}
      <div className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Report Type */}
          <div>
            <label className="mb-1 block text-xs font-bold text-[#52667A]">
              {t.selectReport}
            </label>
            <select
              aria-label={t.selectReport}
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm font-medium text-[#102A43] focus:border-[#0E9F8E] focus:outline-none"
            >
              <option value="trial_balance">{t.trialBalance}</option>
              <option value="profit_and_loss">{t.profitAndLoss}</option>
              <option value="balance_sheet">{t.balanceSheet}</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-bold text-[#52667A]">
              <Calendar className="h-3.5 w-3.5" />
              {t.from}
            </label>
            <input
              type="date"
              aria-label={t.from}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm text-[#102A43] focus:border-[#0E9F8E] focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-bold text-[#52667A]">
              <Calendar className="h-3.5 w-3.5" />
              {t.to}
            </label>
            <input
              type="date"
              aria-label={t.to}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm text-[#102A43] focus:border-[#0E9F8E] focus:outline-none"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-bold text-[#52667A]">
              <Coins className="h-3.5 w-3.5" />
              {t.currency}
            </label>
            <select
              aria-label={t.currency}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm font-medium text-[#102A43] focus:border-[#0E9F8E] focus:outline-none"
            >
              <option value="RON">RON (Leu)</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Warnings Banner if Multi-Currency exists */}
      {data?.other_currencies_in_period && data.other_currencies_in_period.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <span>{t.otherCurrenciesWarning}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#CBD5E1] bg-white p-12 text-sm font-medium text-[#52667A]">
          <RefreshCw className="h-5 w-5 animate-spin text-[#0E9F8E]" />
          {t.loading}
        </div>
      )}

      {/* Error State */}
      {!loading && errorStatus && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"
        >
          <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
          <div>
            <p className="font-bold">
              {errorStatus === 403 ? t.accessDenied : t.error}
            </p>
            <p className="text-xs text-red-700">HTTP Status: {errorStatus}</p>
          </div>
        </div>
      )}

      {/* Report Content */}
      {!loading && !errorStatus && data && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {reportType === 'trial_balance' && (
              <>
                <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#52667A]">{t.totalDebit}</div>
                  <div className="mt-2 text-xl font-extrabold text-[#102A43]">
                    {formatMoney(data.totals.total_debit ?? 0, data.currency, lang)}
                  </div>
                </article>

                <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#52667A]">{t.totalCredit}</div>
                  <div className="mt-2 text-xl font-extrabold text-[#102A43]">
                    {formatMoney(data.totals.total_credit ?? 0, data.currency, lang)}
                  </div>
                </article>
              </>
            )}

            {reportType === 'profit_and_loss' && (
              <>
                <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#52667A]">{t.totalIncome}</div>
                  <div className="mt-2 text-xl font-extrabold text-[#0A6E62]">
                    {formatMoney(data.totals.total_income ?? 0, data.currency, lang)}
                  </div>
                </article>

                <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#52667A]">{t.totalExpense}</div>
                  <div className="mt-2 text-xl font-extrabold text-[#991B1B]">
                    {formatMoney(data.totals.total_expense ?? 0, data.currency, lang)}
                  </div>
                </article>

                <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#52667A]">{t.netProfitLoss}</div>
                  <div
                    className={`mt-2 text-xl font-extrabold ${
                      (data.totals.net_profit_loss ?? 0) >= 0
                        ? 'text-[#0A6E62]'
                        : 'text-[#991B1B]'
                    }`}
                  >
                    {formatMoney(data.totals.net_profit_loss ?? 0, data.currency, lang)}
                  </div>
                </article>
              </>
            )}

            {reportType === 'balance_sheet' && (
              <>
                <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#52667A]">{t.totalAssets}</div>
                  <div className="mt-2 text-xl font-extrabold text-[#102A43]">
                    {formatMoney(data.totals.total_assets ?? 0, data.currency, lang)}
                  </div>
                </article>

                <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#52667A]">{t.totalLiabilities}</div>
                  <div className="mt-2 text-xl font-extrabold text-[#102A43]">
                    {formatMoney(data.totals.total_liabilities ?? 0, data.currency, lang)}
                  </div>
                </article>

                <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
                  <div className="text-xs font-bold text-[#52667A]">{t.totalEquity}</div>
                  <div className="mt-2 text-xl font-extrabold text-[#102A43]">
                    {formatMoney(data.totals.total_equity ?? 0, data.currency, lang)}
                  </div>
                </article>
              </>
            )}

            {/* Balance Badge */}
            <article className="rounded-2xl border border-[#CBD5E1] bg-white p-5 shadow-sm">
              <div className="text-xs font-bold text-[#52667A]">{t.difference}</div>
              <div className="mt-2 flex items-center gap-2">
                {data.is_balanced ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {t.balanced}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-extrabold text-red-800">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    {t.unbalanced}: {formatMoney(data.difference, data.currency, lang)}
                  </span>
                )}
              </div>
            </article>
          </div>

          {/* Tabular Data */}
          <div className="overflow-x-auto rounded-2xl border border-[#CBD5E1] bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-bold text-[#52667A]">
                <tr>
                  <th className="p-3.5 text-start">{t.accountCode}</th>
                  <th className="p-3.5 text-start">{t.accountName}</th>
                  <th className="p-3.5 text-start">{t.accountType}</th>
                  {reportType === 'trial_balance' ? (
                    <>
                      <th className="p-3.5 text-end">{t.debit}</th>
                      <th className="p-3.5 text-end">{t.credit}</th>
                      <th className="p-3.5 text-end">{t.balance}</th>
                    </>
                  ) : (
                    <th className="p-3.5 text-end">{t.amount}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {data.rows.map((row) => (
                  <tr key={row.account_id} className="transition hover:bg-[#F8FAFC]">
                    <td className="p-3.5 font-mono text-xs font-bold text-[#0E9F8E]">
                      {row.account_code}
                    </td>
                    <td className="p-3.5 font-medium text-[#102A43]">
                      {row.account_name}
                    </td>
                    <td className="p-3.5 text-xs text-[#52667A]">
                      <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 font-medium">
                        {row.account_type}
                      </span>
                    </td>
                    {'net_balance' in row ? (
                      <>
                        <td className="p-3.5 text-end font-mono text-xs text-[#102A43]">
                          {formatMoney(row.debit, data.currency, lang)}
                        </td>
                        <td className="p-3.5 text-end font-mono text-xs text-[#102A43]">
                          {formatMoney(row.credit, data.currency, lang)}
                        </td>
                        <td className="p-3.5 text-end font-mono text-xs font-bold text-[#102A43]">
                          {formatMoney(row.net_balance, data.currency, lang)}
                        </td>
                      </>
                    ) : (
                      <td className="p-3.5 text-end font-mono text-xs font-bold text-[#102A43]">
                        {formatMoney(row.amount, data.currency, lang)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {data.rows.length === 0 && (
              <div className="p-12 text-center text-sm text-[#52667A]">
                <BarChart3 className="mx-auto mb-2 h-8 w-8 text-[#94A3B8]" />
                {t.empty}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
