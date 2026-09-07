'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
  Plus,
  ArrowRightLeft,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Building,
  User,
  CreditCard,
  DollarSign,
  Receipt,
  Scale,
  Calendar,
  Layers,
  FileCheck
} from 'lucide-react';
import type { Language } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';

type View = 'payments' | 'reconciliation';

interface Payment {
  id: string;
  provider_ref: string | null;
  amount: number;
  currency: string;
  paid_at: string;
  status: string;
  method?: string;
  description?: string | null;
  allocated_amount: number;
  unallocated_amount: number;
  journal_id?: string | null;
  journal_no?: number | null;
  reversal_reason?: string | null;
  reversed_at?: string | null;
}

interface Allocation {
  id: string;
  receivable_id: string;
  invoice_id: string;
  invoice_no: number;
  amount: number;
  status: string;
  created_at: string;
  reversal_reason?: string | null;
}

interface JournalEntry {
  id: string;
  account_code: string;
  account_name?: string;
  side: string;
  amount: number;
  memo?: string;
}

interface Journal {
  id: string;
  journal_no: number;
  status: string;
  occurred_on: string;
  entries: JournalEntry[];
}

interface Match {
  id: string;
  booked_on: string;
  direction: string;
  transaction_amount: number;
  currency: string;
  matched_amount: number;
  confidence: number | null;
  status: string;
  provider_ref: string | null;
  invoice_no: number | null;
}

interface BankTransaction {
  id: string;
  booked_on: string;
  direction: string;
  amount: number;
  currency: string;
  counterparty_name?: string | null;
  remittance_text?: string | null;
  external_ref?: string | null;
  bank_name?: string | null;
  matched_amount: number;
}

interface Summary {
  currency: string;
  paid: number;
  reconciled: number;
  unallocated: number;
  unmatched_count: number;
  partial_count?: number;
  fully_allocated_count?: number;
  reversed_count?: number;
}

interface ReconciliationSummary {
  bank_account?: { id: string; bank_name: string; currency: string } | null;
  total_credits: number;
  total_debits: number;
  matched_amount: number;
  unmatched_amount: number;
  unmatched_transactions_count: number;
  reconciliation_difference: number;
  last_reconciliation_date?: string | null;
}

interface Payload {
  view: View;
  total: number;
  payments: Payment[];
  reconciliations: Match[];
  summary: Summary[];
  journal: Journal | null;
  allocations?: Allocation[];
  limit: number;
  offset: number;
  read_only: boolean;
}

const copy = {
  ro: {
    title: 'Plăți și reconciliere bancară',
    sub: 'Încasări controlate, alocare multiplă, reversări de compensare și reconciliere bancară',
    payments: 'Plăți',
    reconciliation: 'Reconciliere bancară',
    search: 'Caută referință, chitanță sau jurnal…',
    allStatuses: 'Toate stările',
    date: 'Data',
    reference: 'Referință',
    status: 'Stare',
    amount: 'Sumă',
    allocated: 'Alocat',
    unallocated: 'Nealocat',
    reconciled: 'Reconciliat',
    unmatched: 'Fără asociere',
    invoice: 'Factură',
    confidence: 'Încredere',
    journal: 'Jurnal contabil',
    empty: 'Nu există înregistrări pentru filtrele selectate.',
    error: 'Datele nu au putut fi încărcate în siguranță.',
    loading: 'Se încarcă datele financiare…',
    readonly: 'Numai citire',
    recordPayment: 'Înregistrează plată',
    allocatePayment: 'Alocă pe facturi',
    unallocate: 'Dezalocă',
    reversePayment: 'Inversează / Stornează',
    matchTx: 'Asociază tranzacție',
    unmatchTx: 'Dezasociază',
    finalizeReconciliation: 'Finalizează reconcilierea',
    difference: 'Diferență',
    method: 'Metodă plată',
    bankTransfer: 'Transfer bancar',
    card: 'Card',
    cash: 'Numerar (Casierie)',
    directDebit: 'Debit direct',
    other: 'Altul',
    propertyId: 'Proprietate',
    unitId: 'Unitate (opțional)',
    partyId: 'Plătitor (opțional)',
    description: 'Descriere',
    idempotencyKey: 'Cheie unică (Idempotency)',
    cancel: 'Anulează',
    save: 'Salvează',
    confirm: 'Confirmă',
    reason: 'Motiv',
    reverseWarning: 'Inversarea plății va genera automat o notă contabilă compensatorie (Debit Creanțe / Credit Bancă).',
    allocating: 'Se alocă…',
    recording: 'Se înregistrează…',
    reversing: 'Se inversează…',
    finalizing: 'Se finalizează…',
    reconcileSuccess: 'Reconciliere finalizată cu succes!',
    ledgerBalanced: 'Notă contabilă echilibrată (Debit = Credit)',
    closingBalance: 'Sold final extras',
    calculatedBalance: 'Sold calculat din registrul bancar',
    zeroDiffRequired: 'Diferența trebuie să fie 0 pentru finalizare.',
    partial: 'Parțial',
    fullyAllocated: 'Alocat integral',
    reversed: 'Inversat / Stornat',
    linkedInvoices: 'Facturi asociate',
    noLinkedBills: 'Nicio factură alocată acestei plăți.',
    billAmount: 'Sumă de alocat',
    receivableId: 'ID Creanță / Factură',
    periodStart: 'Data început',
    periodEnd: 'Data sfârșit'
  },
  en: {
    title: 'Payments & Bank Reconciliation',
    sub: 'Controlled collections, multi-bill allocation, compensating reversals and statement reconciliation',
    payments: 'Payments',
    reconciliation: 'Bank Reconciliation',
    search: 'Search reference, receipt or journal…',
    allStatuses: 'All statuses',
    date: 'Date',
    reference: 'Reference',
    status: 'Status',
    amount: 'Amount',
    allocated: 'Allocated',
    unallocated: 'Unallocated',
    reconciled: 'Reconciled',
    unmatched: 'Unmatched',
    invoice: 'Invoice',
    confidence: 'Confidence',
    journal: 'General Ledger Journal',
    empty: 'No records match the selected filters.',
    error: 'Financial data could not be securely loaded.',
    loading: 'Loading financial records…',
    readonly: 'Read-Only Mode',
    recordPayment: 'Record Payment',
    allocatePayment: 'Allocate to Bills',
    unallocate: 'Unallocate',
    reversePayment: 'Reverse / Refund',
    matchTx: 'Match Transaction',
    unmatchTx: 'Unmatch',
    finalizeReconciliation: 'Finalize Reconciliation',
    difference: 'Difference',
    method: 'Payment Method',
    bankTransfer: 'Bank Transfer',
    card: 'Card',
    cash: 'Cash',
    directDebit: 'Direct Debit',
    other: 'Other',
    propertyId: 'Property ID',
    unitId: 'Unit ID (optional)',
    partyId: 'Payer Party ID (optional)',
    description: 'Description',
    idempotencyKey: 'Idempotency Key',
    cancel: 'Cancel',
    save: 'Save',
    confirm: 'Confirm',
    reason: 'Reason',
    reverseWarning: 'Payment reversal will post a compensating double-entry journal (Dr. AR / Cr. Bank).',
    allocating: 'Allocating…',
    recording: 'Recording…',
    reversing: 'Reversing…',
    finalizing: 'Finalizing…',
    reconcileSuccess: 'Reconciliation finalized successfully!',
    ledgerBalanced: 'Balanced Double-Entry Journal (Debit = Credit)',
    closingBalance: 'Statement Closing Balance',
    calculatedBalance: 'Calculated Ledger Balance',
    zeroDiffRequired: 'Difference must be strictly 0 to finalize.',
    partial: 'Partial',
    fullyAllocated: 'Fully Allocated',
    reversed: 'Reversed / Refunded',
    linkedInvoices: 'Linked Invoices',
    noLinkedBills: 'No bills currently allocated to this payment.',
    billAmount: 'Allocation Amount',
    receivableId: 'Receivable / Invoice ID',
    periodStart: 'Period Start',
    periodEnd: 'Period End'
  },
  fa: {
    title: 'دریافت پرداخت و مغایرت‌گیری بانکی',
    sub: 'ثبت دریافت وجه، تخصیص چندگانه به صورتحساب، برگشت کنترل‌شده و تطبیق صورت‌حساب بانکی',
    payments: 'پرداخت‌ها',
    reconciliation: 'مغایرت‌گیری بانکی',
    search: 'جست‌وجوی مرجع، رسید یا دفتر حسابداری…',
    allStatuses: 'همه وضعیت‌ها',
    date: 'تاریخ',
    reference: 'شماره مرجع',
    status: 'وضعیت',
    amount: 'مبلغ',
    allocated: 'تخصیص‌یافته',
    unallocated: 'مانده تخصیص‌نیافته',
    reconciled: 'تطبیق‌یافته',
    unmatched: 'تطبیق‌نشده',
    invoice: 'صورتحساب',
    confidence: 'درصد اطمینان',
    journal: 'دفتر حسابداری',
    empty: 'رکوردی مطابق فیلترهای انتخاب‌شده یافت نشد.',
    error: 'داده‌های مالی به‌صورت امن بارگذاری نشدند.',
    loading: 'در حال دریافت اطلاعات مالی…',
    readonly: 'حالت فقط خواندنی',
    recordPayment: 'ثبت پرداخت جدید',
    allocatePayment: 'تخصیص به صورتحساب‌ها',
    unallocate: 'لغو تخصیص',
    reversePayment: 'ابطال / برگشت پرداخت',
    matchTx: 'تطبیق تراکنش بانکی',
    unmatchTx: 'لغو تطبیق',
    finalizeReconciliation: 'نهایی‌سازی مغایرت‌گیری',
    difference: 'اختلاف مغایرت',
    method: 'روش پرداخت',
    bankTransfer: 'انتقال بانکی',
    card: 'کارت',
    cash: 'نقدی (صندوق)',
    directDebit: 'برداشت مستقیم',
    other: 'سایر',
    propertyId: 'شناسه مجتمع / ملک',
    unitId: 'شناسه واحد (اختیاری)',
    partyId: 'شناسه پرداخت‌کننده (اختیاری)',
    description: 'توضیحات',
    idempotencyKey: 'کلید عدم تکرار (Idempotency)',
    cancel: 'انصراف',
    save: 'ذخیره',
    confirm: 'تأیید',
    reason: 'علت',
    reverseWarning: 'برگشت پرداخت منجر به ثبت سند حسابداری جبرانی بدهکار حساب‌های دریافتنی و بستانکار بانک خواهد شد.',
    allocating: 'در حال تخصیص…',
    recording: 'در حال ثبت…',
    reversing: 'در حال ابطال…',
    finalizing: 'در حال نهایی‌سازی…',
    reconcileSuccess: 'مغایرت‌گیری با موفقیت نهایی شد!',
    ledgerBalanced: 'سند حسابداری تراز شده (بدهکار = بستانکار)',
    closingBalance: 'مانده پایانی صورت‌حساب بانکی',
    calculatedBalance: 'مانده محاسباتی دفاتر',
    zeroDiffRequired: 'اختلاف برای نهایی‌سازی باید دقیقاً صفر باشد.',
    partial: 'تخصیص جزئی',
    fullyAllocated: 'تخصیص کامل',
    reversed: 'برگشت‌خورده / باطل‌شده',
    linkedInvoices: 'صورتحساب‌های مرتبط',
    noLinkedBills: 'هیچ صورتحسابی به این پرداخت تخصیص داده نشده است.',
    billAmount: 'مبلغ تخصیص',
    receivableId: 'شناسه مطالبه / صورتحساب',
    periodStart: 'تاریخ شروع دوره',
    periodEnd: 'تاریخ پایان دوره'
  }
};

const statuses = {
  payments: ['pending', 'settled', 'failed', 'refunded'],
  reconciliation: ['unmatched', 'suggested', 'confirmed', 'rejected']
};

const money = (n: number, c: string, l: Language) =>
  new Intl.NumberFormat(l === 'fa' ? 'fa-IR' : l === 'ro' ? 'ro-RO' : 'en-US', {
    style: 'currency',
    currency: c || 'RON',
    maximumFractionDigits: 2
  }).format(n);

export function CustomerPaymentsDashboard({
  lang,
  initialView = 'payments'
}: {
  lang: Language;
  initialView?: View;
}) {
  const { active } = useCustomerContext();
  const t = copy[lang];
  const isRTL = lang === 'fa';

  const [data, setData] = useState<Payload | null>(null);
  const [bankTxData, setBankTxData] = useState<BankTransaction[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary | null>(null);
  const [view, setView] = useState<View>(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Filters
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [nonce, setNonce] = useState(0);
  const limit = 25;

  // Selected payment detail modal
  const [selected, setSelected] = useState<Payment | null>(null);
  const [detailJournal, setDetailJournal] = useState<Journal | null>(null);
  const [detailAllocations, setDetailAllocations] = useState<Allocation[]>([]);

  // Action Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Form states
  const [recordForm, setRecordForm] = useState({
    amount: '',
    currency: 'RON',
    method: 'bank_transfer',
    property_id: '',
    unit_id: '',
    payer_party_id: '',
    provider_ref: '',
    description: '',
    idempotency_key: ''
  });

  const [allocateForm, setAllocateForm] = useState({
    receivable_id: '',
    amount: ''
  });

  const [reverseReason, setReverseReason] = useState('');

  const [finalizeForm, setFinalizeForm] = useState({
    bank_account_id: '',
    period_start: '',
    period_end: '',
    closing_balance: '',
    notes: ''
  });

  // Permission check
  const canManage = useMemo(() => {
    if (!data || data.read_only) return false;
    const role = (active?.role_code || '').toLowerCase();
    return role === 'association_admin' || role === 'property_manager';
  }, [data, active]);

  // Load primary data
  const load = useCallback(
    async (id?: string) => {
      if (!active) return;
      setLoading(true);
      setError(false);
      try {
        const p = new URLSearchParams({
          context_id: active.context_id,
          view,
          limit: String(limit),
          offset: String(offset)
        });
        if (query.trim()) p.set('query', query.trim());
        if (status) p.set('status', status);
        if (from) p.set('from', from);
        if (to) p.set('to', to);
        if (id) p.set('id', id);

        const response = await fetch('/api/customer/v1/payments?' + p, {
          cache:'no-store',
          credentials: 'same-origin'
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || 'payments');
        }

        const resData = (await response.json()) as Payload;
        setData(resData);

        // If in reconciliation view, load reconciliation summary
        if (view === 'reconciliation') {
          const recRes = await fetch(
            `/api/customer/v1/payments/reconciliation?context_id=${active.context_id}`,
            { cache: 'no-store', credentials: 'same-origin' }
          );
          if (recRes.ok) {
            setReconciliationSummary((await recRes.json()) as ReconciliationSummary);
          }

          const txRes = await fetch(
            `/api/customer/v1/payments/bank-transactions?context_id=${active.context_id}&limit=50`,
            { cache: 'no-store', credentials: 'same-origin' }
          );
          if (txRes.ok) {
            const txBody = await txRes.json();
            setBankTxData(txBody?.bank_transactions || []);
          }
        }
      } catch (err: unknown) {
        setError(true);
        setErrorMessage(err instanceof Error ? err.message : 'Error loading payments');
      } finally {
        setLoading(false);
      }
    },
    [active, from, offset, query, status, to, view]
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load, nonce]);

  // View Payment Details
  async function openDetail(payment: Payment) {
    setSelected(payment);
    try {
      const res = await fetch(
        `/api/customer/v1/payments/${payment.id}?context_id=${active?.context_id}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      if (res.ok) {
        const body = await res.json();
        setDetailJournal(body.journal || null);
        setDetailAllocations(body.allocations || []);
      }
    } catch {
      // fallback to list payload
    }
  }

  function closeDetail() {
    setSelected(null);
    setDetailJournal(null);
    setDetailAllocations([]);
  }

  // Handle Record Payment
  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setActionInProgress(true);
    setError(false);
    try {
      const res = await fetch('/api/customer/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          property_id: recordForm.property_id || (active as unknown as Record<string, string | undefined>).property_id || '',
          unit_id: recordForm.unit_id || (active as unknown as Record<string, string | undefined>).unit_id || null,
          payer_party_id: recordForm.payer_party_id || null,
          amount: parseFloat(recordForm.amount),
          currency: recordForm.currency || 'RON',
          method: recordForm.method,
          provider_ref: recordForm.provider_ref || null,
          description: recordForm.description || null,
          idempotency_key: recordForm.idempotency_key || null
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error?.message || 'Failed to record payment');
      }

      setShowRecordModal(false);
      setRecordForm({
        amount: '',
        currency: 'RON',
        method: 'bank_transfer',
        property_id: '',
        unit_id: '',
        payer_party_id: '',
        provider_ref: '',
        description: '',
        idempotency_key: ''
      });
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error recording payment');
    } finally {
      setActionInProgress(false);
    }
  }

  // Handle Allocate Payment
  async function handleAllocatePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !selected) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/customer/v1/payments/${selected.id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          allocations: [
            {
              receivable_id: allocateForm.receivable_id,
              amount: parseFloat(allocateForm.amount)
            }
          ]
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error?.message || 'Failed to allocate payment');
      }

      setShowAllocateModal(false);
      setAllocateForm({ receivable_id: '', amount: '' });
      await openDetail(selected);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error allocating payment');
    } finally {
      setActionInProgress(false);
    }
  }

  // Handle Unallocate Payment
  async function handleUnallocate(allocId: string) {
    if (!active || !confirm(t.confirm)) return;
    try {
      const res = await fetch(`/api/customer/v1/payments/${allocId}/unallocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          reason: 'Manual adjustment via dashboard'
        })
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error?.message || 'Failed to unallocate');
      }
      if (selected) await openDetail(selected);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error unallocating');
    }
  }

  // Handle Reverse Payment
  async function handleReversePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !selected) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/customer/v1/payments/${selected.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          reason: reverseReason.trim()
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error?.message || 'Failed to reverse payment');
      }

      setShowReverseModal(false);
      setReverseReason('');
      closeDetail();
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error reversing payment');
    } finally {
      setActionInProgress(false);
    }
  }

  // Handle Finalize Reconciliation
  async function handleFinalizeReconciliation(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setActionInProgress(true);
    try {
      const res = await fetch('/api/customer/v1/payments/reconciliation/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          bank_account_id: finalizeForm.bank_account_id,
          period_start: finalizeForm.period_start,
          period_end: finalizeForm.period_end,
          closing_balance: parseFloat(finalizeForm.closing_balance),
          notes: finalizeForm.notes || null
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error?.message || 'Failed to finalize reconciliation');
      }

      setShowFinalizeModal(false);
      alert(t.reconcileSuccess);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error finalizing reconciliation');
    } finally {
      setActionInProgress(false);
    }
  }

  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  const page = Math.floor(offset / limit) + 1;

  if (!active) {
    return <div className="rounded-2xl bg-white p-8 text-center text-[#52667A]">{t.empty}</div>;
  }

  return (
    <section className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">{t.title}</h1>
            {data?.read_only ? (
              <span className="rounded-full bg-[#EAF8F5] px-2.5 py-1 text-xs font-bold text-[#0A6E62]">
                {t.readonly}
              </span>
            ) : (
              <span className="rounded-full bg-[#E0F2FE] px-2.5 py-1 text-xs font-bold text-[#0369A1]">
                {active.role_name || active.role_code}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#52667A]">{t.sub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setShowRecordModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E9F8E] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#0B7F71] focus:ring-2 focus:ring-[#0E9F8E]"
              >
                <Plus className="h-4 w-4" />
                {t.recordPayment}
              </button>
              {view === 'reconciliation' && (
                <button
                  type="button"
                  onClick={() => {
                    setFinalizeForm({
                      bank_account_id: reconciliationSummary?.bank_account?.id || '',
                      period_start: from || '2026-09-01',
                      period_end: to || '2026-09-30',
                      closing_balance: String(reconciliationSummary?.matched_amount || 0),
                      notes: ''
                    });
                    setShowFinalizeModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E9F8E] bg-white px-4 py-2 text-sm font-bold text-[#0E9F8E] transition hover:bg-[#F0FDFA]"
                >
                  <FileCheck className="h-4 w-4" />
                  {t.finalizeReconciliation}
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            disabled={loading}
            aria-label="Refresh"
            className="rounded-xl border bg-white p-2 text-[#52667A] hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* View Switcher */}
      <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => {
            setView('payments');
            setOffset(0);
          }}
          aria-pressed={view === 'payments'}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
            view === 'payments' ? 'bg-[#0E9F8E] text-white' : 'text-[#52667A] hover:bg-slate-50'
          }`}
        >
          {t.payments}
        </button>
        <button
          type="button"
          onClick={() => {
            setView('reconciliation');
            setOffset(0);
          }}
          aria-pressed={view === 'reconciliation'}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
            view === 'reconciliation' ? 'bg-[#0E9F8E] text-white' : 'text-[#52667A] hover:bg-slate-50'
          }`}
        >
          {t.reconciliation}
        </button>
      </div>

      {/* KPI Cards */}
      {data?.summary && data.summary.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.summary.map((s) => (
            <article key={s.currency + '-paid'} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-medium text-[#52667A]">
                <span>{t.amount}</span>
                <span className="font-bold text-[#0E9F8E]">{s.currency}</span>
              </div>
              <div className="mt-2 text-xl font-black text-[#0F172A]">{money(s.paid, s.currency, lang)}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t.reconciled}: {money(s.reconciled, s.currency, lang)}</span>
              </div>
            </article>
          ))}

          {data.summary.map((s) => (
            <article key={s.currency + '-unallocated'} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-medium text-[#52667A]">
                <span>{t.unallocated}</span>
                <span className="font-bold text-amber-600">{s.currency}</span>
              </div>
              <div className="mt-2 text-xl font-black text-[#0F172A]">{money(s.unallocated, s.currency, lang)}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{t.unmatched}: {s.unmatched_count}</span>
              </div>
            </article>
          ))}

          {data.summary.map((s) => (
            <article key={s.currency + '-partial'} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-medium text-[#52667A]">
                <span>{t.partial} / {t.fullyAllocated}</span>
                <span className="font-bold text-blue-600">{s.currency}</span>
              </div>
              <div className="mt-2 text-xl font-black text-[#0F172A]">
                {s.partial_count || 0} / {s.fully_allocated_count || 0}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-[#52667A]">
                <Layers className="h-3.5 w-3.5" />
                <span>{t.reversed}: {s.reversed_count || 0}</span>
              </div>
            </article>
          ))}

          {view === 'reconciliation' && reconciliationSummary && (
            <article className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-medium text-[#52667A]">
                <span>{t.difference}</span>
                <span className={`font-bold ${reconciliationSummary.reconciliation_difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {reconciliationSummary.reconciliation_difference === 0 ? '0.00' : money(reconciliationSummary.reconciliation_difference, 'RON', lang)}
                </span>
              </div>
              <div className="mt-2 text-xl font-black text-[#0F172A]">
                {reconciliationSummary.unmatched_transactions_count} {t.unmatched}
              </div>
              <div className="mt-1 text-xs text-[#52667A]">
                {t.reconciled}: {money(reconciliationSummary.matched_amount, 'RON', lang)}
              </div>
            </article>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm lg:flex-row">
        <label className="relative flex-1">
          <Search className={`absolute ${isRTL ? 'end-3' : 'start-3'} top-2.5 h-4 w-4 text-[#7B8A9A]`} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
            placeholder={t.search}
            className={`w-full rounded-xl border py-2 text-sm focus:border-[#0E9F8E] focus:outline-none focus:ring-1 focus:ring-[#0E9F8E] ${
              isRTL ? 'pe-9 ps-3' : 'pe-3 ps-9'
            }`}
          />
        </label>

        <select
          aria-label={t.status}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
          className="rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
        >
          <option value="">{t.allStatuses}</option>
          {statuses[view].map((x) => (
            <option key={x} value={x}>
              {x.replaceAll('_', ' ')}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label={`${t.date} from`}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setOffset(0);
            }}
            className="rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
          />
          <span className="text-xs text-[#52667A]">-</span>
          <input
            type="date"
            aria-label={`${t.date} to`}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setOffset(0);
            }}
            className="rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
          />
        </div>
      </div>

      {/* Content Table */}
      {error ? (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" />
          <div>
            <div className="font-bold">{t.error}</div>
            <div className="text-xs text-red-600">{errorMessage}</div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#F6F9FC] text-xs font-semibold text-[#52667A]">
              <tr>
                <th className={`p-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>{t.date}</th>
                <th className={`p-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>{t.reference}</th>
                <th className={`p-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {view === 'payments' ? t.allocated : t.invoice}
                </th>
                <th className={`p-3.5 ${isRTL ? 'text-right' : 'text-left'}`}>{t.status}</th>
                <th className={`p-3.5 ${isRTL ? 'text-left' : 'text-right'}`}>{t.amount}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {view === 'payments'
                ? data?.payments.map((p) => (
                    <tr key={p.id} className="transition hover:bg-slate-50/70">
                      <td className="p-3.5 font-mono text-xs text-[#52667A]">{p.paid_at.slice(0, 10)}</td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => void openDetail(p)}
                          className="rounded font-mono font-bold text-[#0E9F8E] underline decoration-dotted hover:text-[#0A6E62] focus:ring-2 focus:ring-[#0E9F8E]"
                        >
                          {p.provider_ref || p.id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-[#0F172A]">
                          {money(p.allocated_amount, p.currency, lang)}
                        </div>
                        {p.unallocated_amount > 0 && (
                          <div className="text-[11px] font-medium text-amber-600">
                            {t.unallocated}: {money(p.unallocated_amount, p.currency, lang)}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                            p.status === 'settled'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.status === 'refunded'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className={`p-3.5 font-black text-[#0F172A] ${isRTL ? 'text-left' : 'text-right'}`}>
                        {money(p.amount, p.currency, lang)}
                      </td>
                    </tr>
                  ))
                : data?.reconciliations.map((m) => (
                    <tr key={m.id} className="transition hover:bg-slate-50/70">
                      <td className="p-3.5 font-mono text-xs text-[#52667A]">{m.booked_on}</td>
                      <td className="p-3.5 font-mono text-xs font-bold text-[#0F172A]">{m.provider_ref || '—'}</td>
                      <td className="p-3.5 text-xs font-semibold text-[#0F172A]">
                        {m.invoice_no ? `#${m.invoice_no}` : '—'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                            m.status === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.status === 'suggested'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className={`p-3.5 font-black text-[#0F172A] ${isRTL ? 'text-left' : 'text-right'}`}>
                        {money(m.matched_amount, m.currency, lang)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!loading && ((view === 'payments' ? data?.payments.length : data?.reconciliations.length) ?? 0) === 0 && (
            <div className="p-12 text-center text-sm text-[#52667A]">{t.empty}</div>
          )}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#52667A]">
          {data?.total ?? 0} {t.payments}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded-xl border bg-white p-2 text-[#52667A] disabled:opacity-40 hover:bg-slate-50"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-[#0F172A]">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setOffset(offset + limit)}
            className="rounded-xl border bg-white p-2 text-[#52667A] disabled:opacity-40 hover:bg-slate-50"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* Modal: Payment Details & Linked General Ledger Proof */}
      {/* ===================================================================== */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.title}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-lg font-black text-[#0F172A]">
                  {t.reference}: {selected.provider_ref || selected.id.slice(0, 10)}
                </h2>
                <span className="text-xs text-[#52667A]">{selected.paid_at.slice(0, 19).replace('T', ' ')}</span>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Close"
                className="rounded-xl p-2 text-[#52667A] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metrics */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3 rounded-2xl bg-slate-50 p-4">
              <div>
                <span className="text-xs text-[#52667A]">{t.amount}</span>
                <strong className="block text-base font-black text-[#0F172A]">
                  {money(selected.amount, selected.currency, lang)}
                </strong>
              </div>
              <div>
                <span className="text-xs text-[#52667A]">{t.allocated}</span>
                <strong className="block text-base font-black text-emerald-600">
                  {money(selected.allocated_amount, selected.currency, lang)}
                </strong>
              </div>
              <div>
                <span className="text-xs text-[#52667A]">{t.unallocated}</span>
                <strong className="block text-base font-black text-amber-600">
                  {money(selected.unallocated_amount, selected.currency, lang)}
                </strong>
              </div>
            </div>

            {/* Linked Allocations */}
            <div className="mt-5">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#0F172A]">
                <Receipt className="h-4 w-4 text-[#0E9F8E]" />
                {t.linkedInvoices}
              </h3>
              {detailAllocations && detailAllocations.length > 0 ? (
                <div className="mt-2 divide-y rounded-xl border text-xs">
                  {detailAllocations.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3">
                      <div>
                        <span className="font-bold text-[#0F172A]">#{a.invoice_no}</span>
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="text-[#52667A]">{a.created_at.slice(0, 10)}</span>
                        {a.status === 'reversed' && (
                          <span className="ms-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                            {t.reversed}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <strong className="font-mono text-sm">{money(a.amount, selected.currency, lang)}</strong>
                        {canManage && a.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => void handleUnallocate(a.id)}
                            className="text-xs text-rose-600 hover:underline"
                          >
                            {t.unallocate}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs text-[#52667A]">
                  {t.noLinkedBills}
                </div>
              )}
            </div>

            {/* Accounting Journal Proof */}
            {detailJournal && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
                    <Scale className="h-4 w-4 text-[#0E9F8E]" />
                    <span>{t.journal} #{detailJournal.journal_no}</span>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    {detailJournal.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  {detailJournal.entries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg bg-white p-2.5 text-xs shadow-sm">
                      <div>
                        <span className="font-bold text-[#0F172A]">{e.account_code}</span>
                        <span className="mx-2 text-slate-300">·</span>
                        <span className="font-medium text-[#52667A]">{e.side.toUpperCase()}</span>
                        {e.memo && <span className="ms-2 text-slate-400">({e.memo})</span>}
                      </div>
                      <strong className="font-mono font-bold text-[#0F172A]">
                        {money(e.amount, selected.currency, lang)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t.ledgerBalanced}</span>
                </div>
              </div>
            )}

            {/* Detail Actions */}
            {canManage && selected.status !== 'refunded' && (
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-4">
                {selected.unallocated_amount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAllocateForm({
                        receivable_id: '',
                        amount: String(selected.unallocated_amount)
                      });
                      setShowAllocateModal(true);
                    }}
                    className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0B7F71]"
                  >
                    {t.allocatePayment}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowReverseModal(true)}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  {t.reversePayment}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal: Record Payment */}
      {/* ===================================================================== */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleRecordPayment}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-black text-[#0F172A]">{t.recordPayment}</h2>
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="rounded-xl p-2 text-[#52667A] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#0F172A]">{t.amount} *</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={recordForm.amount}
                    onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                    className="w-full rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
                    placeholder="0.00"
                  />
                  <input
                    type="text"
                    maxLength={3}
                    value={recordForm.currency}
                    onChange={(e) => setRecordForm({ ...recordForm, currency: e.target.value.toUpperCase() })}
                    className="w-24 rounded-xl border px-3 py-2 text-center text-sm font-bold uppercase focus:border-[#0E9F8E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A]">{t.method} *</label>
                <select
                  value={recordForm.method}
                  onChange={(e) => setRecordForm({ ...recordForm, method: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
                >
                  <option value="bank_transfer">{t.bankTransfer}</option>
                  <option value="card">{t.card}</option>
                  <option value="cash">{t.cash}</option>
                  <option value="direct_debit">{t.directDebit}</option>
                  <option value="other">{t.other}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A]">{t.reference}</label>
                <input
                  type="text"
                  value={recordForm.provider_ref}
                  onChange={(e) => setRecordForm({ ...recordForm, provider_ref: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
                  placeholder="e.g. TX-1002934 / Chitanță #54"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A]">{t.description}</label>
                <input
                  type="text"
                  value={recordForm.description}
                  onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
                  placeholder="e.g. Maintenance fee collection"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="rounded-xl border px-4 py-2 text-xs font-bold text-[#52667A] hover:bg-slate-50"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={actionInProgress}
                className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0B7F71] disabled:opacity-50"
              >
                {actionInProgress ? t.recording : t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal: Allocate Payment to Bill */}
      {/* ===================================================================== */}
      {showAllocateModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAllocatePayment}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-black text-[#0F172A]">{t.allocatePayment}</h2>
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="rounded-xl p-2 text-[#52667A] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                {t.unallocated}: <strong>{money(selected.unallocated_amount, selected.currency, lang)}</strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A]">{t.receivableId} *</label>
                <input
                  type="text"
                  required
                  value={allocateForm.receivable_id}
                  onChange={(e) => setAllocateForm({ ...allocateForm, receivable_id: e.target.value.trim() })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-xs focus:border-[#0E9F8E] focus:outline-none"
                  placeholder="UUID of receivable or invoice"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A]">{t.billAmount} *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selected.unallocated_amount}
                  required
                  value={allocateForm.amount}
                  onChange={(e) => setAllocateForm({ ...allocateForm, amount: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="rounded-xl border px-4 py-2 text-xs font-bold text-[#52667A] hover:bg-slate-50"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={actionInProgress}
                className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0B7F71] disabled:opacity-50"
              >
                {actionInProgress ? t.allocating : t.confirm}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal: Reverse Payment */}
      {/* ===================================================================== */}
      {showReverseModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleReversePayment}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-black text-rose-700">{t.reversePayment}</h2>
              <button
                type="button"
                onClick={() => setShowReverseModal(false)}
                className="rounded-xl p-2 text-[#52667A] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {t.reverseWarning}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A]">{t.reason} *</label>
                <textarea
                  required
                  rows={3}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-3 text-sm focus:border-rose-500 focus:outline-none"
                  placeholder="e.g. Returned check / Incorrect payment entry"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowReverseModal(false)}
                className="rounded-xl border px-4 py-2 text-xs font-bold text-[#52667A] hover:bg-slate-50"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={actionInProgress || !reverseReason.trim()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {actionInProgress ? t.reversing : t.confirm}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* Modal: Finalize Bank Reconciliation */}
      {/* ===================================================================== */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleFinalizeReconciliation}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-black text-[#0F172A]">{t.finalizeReconciliation}</h2>
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="rounded-xl p-2 text-[#52667A] hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#0F172A]">{t.closingBalance} *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={finalizeForm.closing_balance}
                  onChange={(e) => setFinalizeForm({ ...finalizeForm, closing_balance: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:border-[#0E9F8E] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A]">{t.periodStart} *</label>
                  <input
                    type="date"
                    required
                    value={finalizeForm.period_start}
                    onChange={(e) => setFinalizeForm({ ...finalizeForm, period_start: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F172A]">{t.periodEnd} *</label>
                  <input
                    type="date"
                    required
                    value={finalizeForm.period_end}
                    onChange={(e) => setFinalizeForm({ ...finalizeForm, period_end: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-[#52667A]">
                <div className="flex justify-between">
                  <span>{t.difference}:</span>
                  <strong
                    className={
                      reconciliationSummary?.reconciliation_difference === 0 ? 'text-emerald-600' : 'text-rose-600'
                    }
                  >
                    {reconciliationSummary?.reconciliation_difference === 0 ? '0.00 RON' : t.zeroDiffRequired}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="rounded-xl border px-4 py-2 text-xs font-bold text-[#52667A] hover:bg-slate-50"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={actionInProgress}
                className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0B7F71] disabled:opacity-50"
              >
                {actionInProgress ? t.finalizing : t.finalizeReconciliation}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
