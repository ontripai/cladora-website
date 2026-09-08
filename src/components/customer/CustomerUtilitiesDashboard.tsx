'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Gauge,
  Layers,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { useCustomerContext } from './CustomerContextProvider';

type TabView =
  | 'meters'
  | 'readings'
  | 'ocr_queue'
  | 'consumption'
  | 'tariffs'
  | 'variance'
  | 'anomalies';

interface MeterItem {
  id: string;
  serial_number: string;
  service_type: string;
  scope: string;
  unit_id?: string | null;
  unit_code?: string | null;
  building_name?: string | null;
  property_name?: string | null;
  lifecycle_status: string;
  measurement_unit: string;
  multiplier: number;
  decimal_precision: number;
  initial_reading: number;
  latest_reading_value?: number | null;
  latest_reading_at?: string | null;
  calibration_expires_on?: string | null;
  replaces_meter_id?: string | null;
  replaced_by_meter_id?: string | null;
  replaced_at?: string | null;
}

interface ReadingItem {
  id: string;
  meter_id: string;
  meter_serial?: string;
  service_type?: string;
  reading_value: number;
  reading_at: string;
  method: string;
  status: string;
  review_status: string;
  is_ocr_candidate: boolean;
  ocr_extracted_value?: number | null;
  ocr_confidence?: number | null;
  rejection_reason?: string | null;
  correction_notes?: string | null;
  source_object_path?: string | null;
}

interface ConsumptionItem {
  id: string;
  meter_id: string;
  meter_serial?: string;
  service_type?: string;
  unit_code?: string | null;
  period_start: string;
  period_end: string;
  previous_reading_value: number;
  current_reading_value: number;
  multiplier_applied: number;
  raw_consumption: number;
  adjusted_consumption: number;
  status: string;
  approved_by?: string | null;
  approved_at?: string | null;
  invoice_id?: string | null;
  tariff_snapshot?: Record<string, unknown> | null;
  charged_total?: number | null;
}

interface TariffItem {
  id: string;
  utility_type?: string;
  service_type?: string;
  tariff_code?: string;
  name?: string;
  provider_name?: string | null;
  currency: string;
  effective_from?: string;
  valid_from?: string;
  effective_to?: string | null;
  valid_to?: string | null;
  unit_rate: number;
  fixed_charge: number;
  vat_rate?: number;
  tax_rate?: number;
  tier_structure?: Record<string, unknown> | null;
}

interface VarianceItem {
  main_meter_id: string;
  main_serial: string;
  service_type: string;
  period_start: string;
  period_end: string;
  main_consumption: number;
  sum_submeters: number;
  variance_amount: number;
  variance_pct: number;
  measurement_unit: string;
}

interface AnomalyItem {
  id: string;
  meter_id: string;
  meter_serial?: string;
  service_type?: string;
  unit_code?: string | null;
  anomaly_type: string;
  severity: string;
  status: string;
  detected_at: string;
  expected_value?: number | null;
  actual_value?: number | null;
  resolution_notes?: string | null;
}

interface SummaryData {
  total_meters: number;
  active_meters: number;
  pending_reviews: number;
  period_consumption: number;
  open_anomalies: number;
  main_meters_count?: number;
  submeters_count?: number;
}

const copy = {
  en: {
    badge: 'C08 · Utility slice & metering',
    title: 'Meters, Consumption & Utility Billing',
    sub: 'Certified meter registry, tamper-evident readings, human-governed OCR review, and balanced accounting integration.',
    tabs: {
      meters: 'Meters Registry',
      readings: 'Readings & Capture',
      ocr_queue: 'OCR Review Queue',
      consumption: 'Consumption & Billing',
      tariffs: 'Tariffs & Rates',
      variance: 'Main vs Submeter Variance',
      anomalies: 'Anomalies Queue',
    },
    metrics: {
      activeMeters: 'Active Meters',
      awaitingApproval: 'Awaiting Human Review',
      periodConsumption: 'Current Consumption',
      openAnomalies: 'Open Anomalies',
      totalMeters: 'Total Registered',
    },
    actions: {
      newMeter: 'Register Meter',
      replaceMeter: 'Replace Meter',
      decommission: 'Decommission',
      newReading: 'Record Reading',
      bulkImport: 'Import CSV',
      ocrCandidate: 'Submit OCR Candidate',
      calculateConsumption: 'Calculate Consumption',
      approve: 'Approve',
      reject: 'Reject',
      correct: 'Correct & Approve',
      billConsumption: 'Create & Issue Bill',
      newTariff: 'Add Tariff',
      refresh: 'Refresh',
      close: 'Close',
      details: 'Inspect Details',
      confirm: 'Confirm Action',
      cancel: 'Cancel',
    },
    labels: {
      serial: 'Serial Number',
      service: 'Utility Service',
      scope: 'Meter Scope',
      unit: 'Unit / Scope Reference',
      lifecycle: 'Lifecycle Status',
      measurementUnit: 'Unit of Measure',
      multiplier: 'Multiplier',
      precision: 'Precision',
      initialReading: 'Initial Reading',
      currentReading: 'Current Reading',
      readingDate: 'Reading Date',
      source: 'Capture Method',
      confidence: 'OCR Confidence',
      rejectionReason: 'Rejection Reason',
      correctionValue: 'Corrected Value',
      correctionNotes: 'Audit Correction Reason',
      periodStart: 'Period Start',
      periodEnd: 'Period End',
      rawConsumption: 'Raw Consumption',
      chargedTotal: 'Billed Total',
      unitRate: 'Unit Rate',
      fixedCharge: 'Fixed Charge',
      vatRate: 'VAT Rate (%)',
      mainConsumption: 'Main Meter Consumption',
      submetersConsumption: 'Sum of Submeters',
      variance: 'Discrepancy (Variance)',
      severity: 'Severity',
      status: 'Status',
      search: 'Search by serial, unit or provider...',
      all: 'All',
      from: 'From',
      to: 'To',
      invoiceId: 'Invoice Link',
      humanReviewBoundary: 'Human Approval Boundary Enforced',
      humanReviewNote: 'OCR candidate extractions never convert automatically into readings or bills without authorized human sign-off.',
      readOnlyNotice: 'Read-only mode. Mutation actions require authorized management role (association_admin / property_manager) with AAL2 authentication.',
      taxPolicyNotice: 'Tax rate must be explicitly set according to the Association accounting policy. No implicit default is assumed.',
      noTax: '0% (Exempt / Non-taxable)',
      taxRateRequired: 'Tax rate is required (0% - 100%)',
    },
    services: {
      water: 'Water',
      electricity: 'Electricity',
      gas: 'Natural Gas',
      heat: 'Heating & Thermal',
      sewer: 'Sewer',
      waste: 'Waste Management',
      internet: 'Internet',
      telephone: 'Telephone',
      other: 'Other Contracted',
    },
    states: {
      loading: 'Retrieving verified utility records from secure database...',
      empty: 'No utility records found in this authorized context.',
      error: 'Failed to load utility evidence. Please try again.',
      success: 'Operation completed successfully.',
    },
  },
  ro: {
    badge: 'C08 · Modul utilități și contorizare',
    title: 'Contoare, consum și facturarea utilităților',
    sub: 'Registru certificat de contoare, citiri validate, aprobare umană OCR și integrare contabilă securizată.',
    tabs: {
      meters: 'Registru contoare',
      readings: 'Citiri și înregistrare',
      ocr_queue: 'Coadă revizuire OCR',
      consumption: 'Consum și facturare',
      tariffs: 'Tarife și prețuri',
      variance: 'Diferență contor general vs secundare',
      anomalies: 'Coadă anomalii',
    },
    metrics: {
      activeMeters: 'Contoare active',
      awaitingApproval: 'În așteptare verificare umană',
      periodConsumption: 'Consum perioadă',
      openAnomalies: 'Anomalii deschise',
      totalMeters: 'Total contoare',
    },
    actions: {
      newMeter: 'Înregistrează contor',
      replaceMeter: 'Înlocuiește contor',
      decommission: 'Scoate din uz',
      newReading: 'Înregistrează citire',
      bulkImport: 'Import CSV',
      ocrCandidate: 'Trimite candidat OCR',
      calculateConsumption: 'Calculează consum',
      approve: 'Aprobă',
      reject: 'Respinge',
      correct: 'Corectează și aprobă',
      billConsumption: 'Emite factură din consum',
      newTariff: 'Adaugă tarif',
      refresh: 'Reîmprospătează',
      close: 'Închide',
      details: 'Inspectează detalii',
      confirm: 'Confirmă acțiunea',
      cancel: 'Anulează',
    },
    labels: {
      serial: 'Număr serie',
      service: 'Serviciu utilitate',
      scope: 'Tip contor',
      unit: 'Referință apartament / spațiu',
      lifecycle: 'Stare ciclu de viață',
      measurementUnit: 'Unitate de măsură',
      multiplier: 'Multiplicator',
      precision: 'Zecimale',
      initialReading: 'Index inițial',
      currentReading: 'Index curent',
      readingDate: 'Dată citire',
      source: 'Metodă înregistrare',
      confidence: 'Încredere OCR',
      rejectionReason: 'Motiv respingere',
      correctionValue: 'Valoare corectată',
      correctionNotes: 'Justificare audit corecție',
      periodStart: 'Început perioadă',
      periodEnd: 'Sfârșit perioadă',
      rawConsumption: 'Consum calculat',
      chargedTotal: 'Total facturat',
      unitRate: 'Preț unitar',
      fixedCharge: 'Abonament fix',
      vatRate: 'Cotă TVA (%)',
      mainConsumption: 'Consum contor general',
      submetersConsumption: 'Total contoare pasante',
      variance: 'Diferență (variație)',
      severity: 'Severitate',
      status: 'Stare',
      search: 'Caută după serie, apartament sau furnizor...',
      all: 'Toate',
      from: 'De la',
      to: 'Până la',
      invoiceId: 'Referință factură',
      humanReviewBoundary: 'Barieră de verificare umană activă',
      humanReviewNote: 'Rezultatele OCR nu se convertesc automat în citiri definitive sau facturi fără aprobarea unui operator uman autorizat.',
      readOnlyNotice: 'Mod doar citire. Acțiunile de modificare necesită rol de administrare autorizat cu autentificare AAL2.',
      taxPolicyNotice: 'Cota de taxă trebuie stabilită explicit conform politicii contabile a Asociației. Nicio cotă implicită nu este aplicată.',
      noTax: '0% (Scutit / Fără taxă)',
      taxRateRequired: 'Cota de taxă este obligatorie (0% - 100%)',
    },
    services: {
      water: 'Apă',
      electricity: 'Electricitate',
      gas: 'Gaze naturale',
      heat: 'Energie termică',
      sewer: 'Canalizare',
      waste: 'Salubritate',
      internet: 'Internet',
      telephone: 'Telefonie',
      other: 'Alte servicii',
    },
    states: {
      loading: 'Se încarcă datele autorizate de utilități din baza de date...',
      empty: 'Nu s-au găsit înregistrări în acest context.',
      error: 'Încărcarea datelor de utilități a eșuat. Reîncercați.',
      success: 'Operațiunea s-a executat cu succes.',
    },
  },
  fa: {
    badge: 'C08 · ماژول قبوض و کنتورها',
    title: 'کنتورها، مصرف و صورتحساب خدمات',
    sub: 'ثبت گواهی‌شده کنتور، قرائت‌های بدون دستکاری، بررسی انسانی کاندیدای خوانش تصویری و ثبت تراز در دفاتر حسابداری.',
    tabs: {
      meters: 'فهرست کنتورها',
      readings: 'قرائت‌ها و ثبت',
      ocr_queue: 'صف بررسی خوانش تصویری',
      consumption: 'مصرف و صدور قبض',
      tariffs: 'تعرفه‌ها و نرخ‌ها',
      variance: 'مغایرت کنتور اصلی و فرعی',
      anomalies: 'صف ناهنجاری‌ها',
    },
    metrics: {
      activeMeters: 'کنتورهای فعال',
      awaitingApproval: 'در انتظار بازبینی انسانی',
      periodConsumption: 'مصرف دوره جاری',
      openAnomalies: 'ناهنجاری‌های باز',
      totalMeters: 'کل کنتورها',
    },
    actions: {
      newMeter: 'ثبت کنتور جدید',
      replaceMeter: 'تعویض کنتور',
      decommission: 'خروج از مدار',
      newReading: 'ثبت قرائت جدید',
      bulkImport: 'بارگذاری گروهی فایل',
      ocrCandidate: 'ارسال کاندیدای تصویری',
      calculateConsumption: 'محاسبه مصرف',
      approve: 'تأیید نهایی',
      reject: 'رد قرائت',
      correct: 'تصحیح و تأیید',
      billConsumption: 'صدور قبض از مصرف',
      newTariff: 'تعریف تعرفه جدید',
      refresh: 'بازخوانی داده‌ها',
      close: 'بستن پنجره',
      details: 'مشاهده جزئیات کامل',
      confirm: 'تأیید اقدام',
      cancel: 'انصراف',
    },
    labels: {
      serial: 'شماره سریال',
      service: 'نوع خدمت',
      scope: 'محدوده کنتور',
      unit: 'واحد / مرجع استقرار',
      lifecycle: 'وضعیت چرخه حیات',
      measurementUnit: 'واحد اندازه‌گیری',
      multiplier: 'ضریب محاسبه',
      precision: 'تعداد ارقام اعشار',
      initialReading: 'قرائت اولیه',
      currentReading: 'قرائت جاری',
      readingDate: 'تاریخ قرائت',
      source: 'روش ثبت',
      confidence: 'درصد اطمینان خوانش',
      rejectionReason: 'دلیل رد',
      correctionValue: 'مقدار تصحیح‌شده',
      correctionNotes: 'شرح حسابرسی و اصلاح',
      periodStart: 'آغاز دوره',
      periodEnd: 'پایان دوره',
      rawConsumption: 'میزان مصرف محاسبه‌شده',
      chargedTotal: 'مبلغ کل صورتحساب',
      unitRate: 'نرخ هر واحد',
      fixedCharge: 'آبونمان ثابت',
      vatRate: 'نرخ مالیات ارزش افزوده (%)',
      mainConsumption: 'مصرف کنتور اصلی ساختمان',
      submetersConsumption: 'مجموع کنتورهای فرعی واحدها',
      variance: 'میزان مغایرت',
      severity: 'سطح اهمیت',
      status: 'وضعیت',
      search: 'جستجو بر اساس سریال، واحد یا تأمین‌کننده...',
      all: 'همه',
      from: 'از تاریخ',
      to: 'تا تاریخ',
      invoiceId: 'شناسه صورتحساب صادرشده',
      humanReviewBoundary: 'مرز تأیید انسانی فعال است',
      humanReviewNote: 'نتایج خوانش خودکار تصویری هرگز به صورت خودکار به قرائت قطعی یا صورتحساب تبدیل نمی‌شوند و حتماً نیازمند بررسی و امضای مجاز اپراتور هستند.',
      readOnlyNotice: 'دسترسی فقط خواندنی است. عملیات تغییر نیازمند نقش مدیر ساختمان با احراز هویت دو مرحله‌ای معتبر است.',
      taxPolicyNotice: 'نرخ مالیات باید طبق سیاست حسابداری انجمن صریحاً تعیین شود. هیچ نرخ پیش‌فرضی لحاظ نمی‌شود.',
      noTax: '۰٪ (معاف از مالیات / بدون مالیات)',
      taxRateRequired: 'تعیین نرخ مالیات الزامی است (۰٪ تا ۱۰۰٪)',
    },
    services: {
      water: 'آب',
      electricity: 'برق',
      gas: 'گاز طبیعی',
      heat: 'انرژی حرارتی و گرمایش',
      sewer: 'فاضلاب',
      waste: 'مدیریت پسماند',
      internet: 'اینترنت',
      telephone: 'تلفن',
      other: 'سایر خدمات قراردادی',
    },
    states: {
      loading: 'در حال دریافت اطلاعات معتبر کنتورها از پایگاه داده امن...',
      empty: 'هیچ رکوردی برای این محدوده یافت نشد.',
      error: 'خطا در دریافت اطلاعات. لطفاً مجدداً تلاش نمایید.',
      success: 'عملیات با موفقیت انجام شد.',
    },
  },
} as const;

export function CustomerUtilitiesDashboard({ lang }: { lang: string }) {
  const isFa = lang === 'fa';
  const isRo = lang === 'ro';
  const t = copy[isFa ? 'fa' : isRo ? 'ro' : 'en'];
  const { active } = useCustomerContext();

  const [tab, setTab] = useState<TabView>('meters');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterService, setFilterService] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Data states
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [meters, setMeters] = useState<MeterItem[]>([]);
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [consumptions, setConsumptions] = useState<ConsumptionItem[]>([]);
  const [tariffs, setTariffs] = useState<TariffItem[]>([]);
  const [variances, setVariances] = useState<VarianceItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states for modals
  const [formMeterSerial, setFormMeterSerial] = useState('');
  const [formMeterService, setFormMeterService] = useState('water');
  const [formMeterScope, setFormMeterScope] = useState('unit');
  const [formMeterUnitId, setFormMeterUnitId] = useState('');
  const [formMeterUnitMeasure, setFormMeterUnitMeasure] = useState('m3');
  const [formMeterMultiplier, setFormMeterMultiplier] = useState(1);
  const [formMeterPrecision, setFormMeterPrecision] = useState(3);
  const [formMeterInitialReading, setFormMeterInitialReading] = useState(0);

  // Reading form
  const [formReadingMeterId, setFormReadingMeterId] = useState('');
  const [formReadingValue, setFormReadingValue] = useState<number>(0);
  const [formReadingDate, setFormReadingDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );

  // CSV Import form
  const [formCsvText, setFormCsvText] = useState('');

  // OCR Candidate form
  const [formOcrMeterId, setFormOcrMeterId] = useState('');
  const [formOcrValue, setFormOcrValue] = useState<number>(0);
  const [formOcrConfidence, setFormOcrConfidence] = useState<number>(0.92);
  const [formOcrPath, setFormOcrPath] = useState<string>('meter-photo-sample.jpg');

  // Human Review form (Approve / Reject / Correct)
  const [reviewReading, setReviewReading] = useState<ReadingItem | null>(null);
  const [formReviewReason, setFormReviewReason] = useState('');
  const [formReviewCorrectValue, setFormReviewCorrectValue] = useState<number>(0);

  // Consumption calculation form
  const [formCalcMeterId, setFormCalcMeterId] = useState('');
  const [formCalcStart, setFormCalcStart] = useState('2026-09-01');
  const [formCalcEnd, setFormCalcEnd] = useState('2026-09-30');

  // Bill from consumption form
  const [billConsumptionTarget, setBillConsumptionTarget] = useState<ConsumptionItem | null>(null);
  const [formBillDueDate, setFormBillDueDate] = useState('2026-10-15');

  // Tariff form (No implicit defaults for rates/tax)
  const [formTariffService, setFormTariffService] = useState('water');
  const [formTariffRate, setFormTariffRate] = useState<string>('');
  const [formTariffFixed, setFormTariffFixed] = useState<string>('0');
  const [formTariffVat, setFormTariffVat] = useState<string>('');
  const [formTariffCode, setFormTariffCode] = useState<string>('');
  const [formTariffName, setFormTariffName] = useState<string>('');
  const [formTariffFrom, setFormTariffFrom] = useState('');

  // Role permissions
  const roleCode = (active?.role_code || '').toLowerCase();
  const isManagement =
    roleCode === 'association_admin' || roleCode === 'property_manager';
  const isReadOnly = !isManagement;

  // Load summary
  const loadSummary = useCallback(async () => {
    if (!active?.context_id) return;
    try {
      const res = await fetch(
        `/api/customer/v1/utilities/summary?context_id=${encodeURIComponent(
          active.context_id
        )}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary || null);
      }
    } catch {
      // ignore
    }
  }, [active]);

  // Load active tab data
  const loadTabData = useCallback(async () => {
    if (!active?.context_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const queryParams = new URLSearchParams({
      context_id: active.context_id,
      limit: String(limit),
      offset: String(offset),
    });
    if (search) queryParams.set('search', search);
    if (filterStatus) queryParams.set('status', filterStatus);
    if (filterService) queryParams.set('service_type', filterService);

    try {
      let endpoint = '';
      if (tab === 'meters') endpoint = `/api/customer/v1/utilities/meters?${queryParams}`;
      else if (tab === 'readings')
        endpoint = `/api/customer/v1/utilities/readings?${queryParams}`;
      else if (tab === 'ocr_queue')
        endpoint = `/api/customer/v1/utilities/readings?${queryParams}&review_status=pending_review`;
      else if (tab === 'consumption')
        endpoint = `/api/customer/v1/utilities/consumption?${queryParams}`;
      else if (tab === 'tariffs')
        endpoint = `/api/customer/v1/utilities/tariffs?${queryParams}`;
      else if (tab === 'variance')
        endpoint = `/api/customer/v1/utilities/variance?${queryParams}`;
      else if (tab === 'anomalies')
        endpoint = `/api/customer/v1/utilities/anomalies?${queryParams}`;

      // Authorized evidence views: 'meters','readings','periods','contracts','invoices','comparisons','anomalies'
      const res = await fetch(endpoint || `/api/customer/v1/utilities?${queryParams}`, {
        cache:'no-store',
        credentials:'same-origin',
      });
      if (!res.ok) throw new Error('FETCH_FAILED');
      const json = await res.json();

      if (tab === 'meters') {
        setMeters(json.meters || []);
        setTotalCount(json.total || (json.meters || []).length);
      } else if (tab === 'readings' || tab === 'ocr_queue') {
        setReadings(json.readings || []);
        setTotalCount(json.total || (json.readings || []).length);
      } else if (tab === 'consumption') {
        setConsumptions(json.consumptions || []);
        setTotalCount(json.total || (json.consumptions || []).length);
      } else if (tab === 'tariffs') {
        setTariffs(json.tariffs || []);
        setTotalCount(json.total || (json.tariffs || []).length);
      } else if (tab === 'variance') {
        setVariances(json.variances || []);
        setTotalCount(json.total || (json.variances || []).length);
      } else if (tab === 'anomalies') {
        setAnomalies(json.anomalies || []);
        setTotalCount(json.total || (json.anomalies || []).length);
      }
    } catch {
      setError(t.states.error);
    } finally {
      setLoading(false);
    }
  }, [
    active,
    tab,
    offset,
    search,
    filterStatus,
    filterService,
    t.states.error,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSummary();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSummary, nonce]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTabData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadTabData, nonce]);

  // Mutations
  const handleRegisterMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active?.context_id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/customer/v1/utilities/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          serial_number: formMeterSerial,
          service_type: formMeterService,
          scope: formMeterScope,
          unit_id: formMeterUnitId || null,
          measurement_unit: formMeterUnitMeasure,
          multiplier: Number(formMeterMultiplier),
          decimal_precision: Number(formMeterPrecision),
          initial_reading: Number(formMeterInitialReading),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'CREATION_FAILED');
      setActiveModal(null);
      setNotice(t.states.success);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCaptureReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active?.context_id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/customer/v1/utilities/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          meter_id: formReadingMeterId,
          reading_value: Number(formReadingValue),
          reading_at: new Date(formReadingDate).toISOString(),
          method: 'manual_entry',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'CAPTURE_FAILED');
      setActiveModal(null);
      setNotice(t.states.success);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active?.context_id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const lines = formCsvText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('serial'));
      const records = lines.map((l) => {
        const parts = l.split(',');
        return {
          meter_serial: parts[0]?.trim(),
          reading_value: Number(parts[1]?.trim() || 0),
          reading_at: parts[2]?.trim()
            ? new Date(parts[2].trim()).toISOString()
            : new Date().toISOString(),
        };
      });
      const res = await fetch('/api/customer/v1/utilities/readings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          readings: records,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'IMPORT_FAILED');
      setActiveModal(null);
      setNotice(`${t.states.success} (${data.result?.imported_count || records.length} records)`);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateOcrCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active?.context_id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/customer/v1/utilities/readings/ocr-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          meter_id: formOcrMeterId,
          extracted_value: Number(formOcrValue),
          confidence: Number(formOcrConfidence),
          source_object_path: formOcrPath,
          reading_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'OCR_CANDIDATE_FAILED');
      setActiveModal(null);
      setNotice(t.states.success);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewAction = async (action: 'approve' | 'reject' | 'correct') => {
    if (!active?.context_id || !reviewReading) return;
    setActionLoading(true);
    setActionError(null);
    try {
      let endpoint = '';
      const payload: Record<string, unknown> = { context_id: active.context_id };
      if (action === 'approve') {
        endpoint = `/api/customer/v1/utilities/readings/${reviewReading.id}/approve`;
      } else if (action === 'reject') {
        endpoint = `/api/customer/v1/utilities/readings/${reviewReading.id}/reject`;
        payload.rejection_reason = formReviewReason || 'Rejected by authorized human review';
      } else if (action === 'correct') {
        endpoint = `/api/customer/v1/utilities/readings/${reviewReading.id}/correct`;
        payload.corrected_value = Number(formReviewCorrectValue);
        payload.correction_notes = formReviewReason || 'Corrected via human audit boundary';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'ACTION_FAILED');
      setActiveModal(null);
      setReviewReading(null);
      setNotice(t.states.success);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCalculateConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active?.context_id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/customer/v1/utilities/consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          meter_id: formCalcMeterId,
          period_start: formCalcStart,
          period_end: formCalcEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'CALCULATION_FAILED');
      setActiveModal(null);
      setNotice(t.states.success);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBillConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active?.context_id || !billConsumptionTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(
        `/api/customer/v1/utilities/consumption/${billConsumptionTarget.id}/bill`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context_id: active.context_id,
            due_date: formBillDueDate,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'BILLING_FAILED');
      setActiveModal(null);
      setBillConsumptionTarget(null);
      setNotice(`${t.states.success} (Invoice #${data.result?.invoice_no || ''})`);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active?.context_id) return;

    if (formTariffVat.trim() === '') {
      setActionError(t.labels.taxRateRequired);
      return;
    }

    const vatNum = Number(formTariffVat);
    if (Number.isNaN(vatNum) || vatNum < 0 || vatNum > 100) {
      setActionError('tax_rate_out_of_range');
      return;
    }

    const unitRateNum = Number(formTariffRate);
    if (Number.isNaN(unitRateNum) || unitRateNum < 0) {
      setActionError('invalid_unit_rate');
      return;
    }

    const taxRateDecimal = vatNum / 100;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/customer/v1/utilities/tariffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          property_id: (active as unknown as { property_id?: string })?.property_id || undefined,
          service_type: formTariffService,
          tariff_code: formTariffCode.trim() || `${formTariffService.toUpperCase()}-RATE-${Date.now().toString().slice(-4)}`,
          name: formTariffName.trim() || `${formTariffService} Tariff`,
          unit_rate: unitRateNum,
          fixed_charge: Number(formTariffFixed) || 0,
          tax_rate: taxRateDecimal,
          valid_from: formTariffFrom || undefined,
          currency: 'RON',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'TARIFF_CREATION_FAILED');
      setActiveModal(null);
      setNotice(t.states.success);
      setNonce((n) => n + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  // Helper date formatter
  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat(isFa ? 'fa-IR' : isRo ? 'ro-RO' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  // Format currency
  const formatMoney = (amount: number | null | undefined) => {
    if (amount == null) return '—';
    return `${Number(amount).toFixed(2)} RON`;
  };

  return (
    <div className={`space-y-6 ${isFa ? 'font-vazirmatn' : ''}`} dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header section */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
              <Gauge className="h-4 w-4" />
              {t.badge}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{t.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{t.sub}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                isManagement
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {isManagement ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
              <span>
                {active?.role_name || active?.role_code?.toUpperCase() || 'ANONYMOUS'}
              </span>
              {isReadOnly && <span className="opacity-75">({t.labels.readOnlyNotice})</span>}
            </div>
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t.actions.refresh}
            </button>
          </div>
        </div>

        {/* Human boundary banner */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div>
            <span className="font-bold">{t.labels.humanReviewBoundary}: </span>
            {t.labels.humanReviewNote}
          </div>
        </div>

        {notice && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
            <span>{notice}</span>
            <button onClick={() => setNotice(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {/* Metrics Row */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{t.metrics.activeMeters}</span>
              <Gauge className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {summary.active_meters}{' '}
              <span className="text-xs font-normal text-slate-400">
                / {summary.total_meters} {t.metrics.totalMeters}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {t.metrics.awaitingApproval}
              </span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {summary.pending_reviews}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {t.metrics.periodConsumption}
              </span>
              <Zap className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {Number(summary.period_consumption || 0).toLocaleString()}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {t.metrics.openAnomalies}
              </span>
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-600">
              {summary.open_anomalies}
            </div>
          </div>
        </div>
      )}

      {/* Tabs bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              'meters',
              'readings',
              'ocr_queue',
              'consumption',
              'tariffs',
              'variance',
              'anomalies',
            ] as TabView[]
          ).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTab(item);
                setOffset(0);
                setSelectedRecord(null);
              }}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                tab === item
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.tabs[item]}
              {item === 'ocr_queue' && (summary?.pending_reviews ?? 0) > 0 && (
                <span className="ms-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-900">
                  {summary?.pending_reviews}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Action buttons (only if Management) */}
        {isManagement && (
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'meters' && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActiveModal('add_meter');
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                {t.actions.newMeter}
              </button>
            )}
            {tab === 'readings' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActiveModal('capture_reading');
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  {t.actions.newReading}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActiveModal('bulk_csv');
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  {t.actions.bulkImport}
                </button>
              </>
            )}
            {tab === 'ocr_queue' && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActiveModal('ocr_candidate');
                }}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700"
              >
                <Upload className="h-4 w-4" />
                {t.actions.ocrCandidate}
              </button>
            )}
            {tab === 'consumption' && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActiveModal('calc_consumption');
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                <Zap className="h-4 w-4" />
                {t.actions.calculateConsumption}
              </button>
            )}
            {tab === 'tariffs' && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActiveModal('add_tariff');
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                {t.actions.newTariff}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder={t.labels.search}
            className="w-full rounded-xl border border-slate-200 py-2 pe-3 ps-9 text-xs focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <select
          value={filterService}
          onChange={(e) => {
            setFilterService(e.target.value);
            setOffset(0);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
        >
          <option value="">
            {t.labels.all} · {t.labels.service}
          </option>
          {Object.entries(t.services).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setOffset(0);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
        >
          <option value="">
            {t.labels.all} · {t.labels.status}
          </option>
          <option value="active">Active / Validated</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="billed">Billed</option>
          <option value="rejected">Rejected</option>
          <option value="decommissioned">Decommissioned</option>
        </select>
      </div>

      {/* Table content area */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">{t.states.loading}</div>
        ) : error ? (
          <div className="p-12 text-center text-xs text-rose-500">{error}</div>
        ) : (
          <>
            {/* Tab 1: Meters */}
            {tab === 'meters' && (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                    <tr>
                      <th className="p-3 text-start font-semibold">{t.labels.serial}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.service}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.scope}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.unit}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.multiplier}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.currentReading}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.lifecycle}</th>
                      <th className="p-3 text-start font-semibold">{t.actions.details}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!meters.length ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          {t.states.empty}
                        </td>
                      </tr>
                    ) : (
                      meters.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {m.serial_number}
                          </td>
                          <td className="p-3 font-medium">
                            {t.services[m.service_type as keyof typeof t.services] ||
                              m.service_type}
                          </td>
                          <td className="p-3 text-slate-600">{m.scope}</td>
                          <td className="p-3 text-slate-600">{m.unit_code || '—'}</td>
                          <td className="p-3 font-mono">
                            {m.multiplier} ({m.measurement_unit})
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {m.latest_reading_value != null ? m.latest_reading_value : '—'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                m.lifecycle_status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : m.lifecycle_status === 'replaced'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {m.lifecycle_status}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(m as unknown as Record<string, unknown>)}
                              className="font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              {t.actions.details}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Readings & Tab 3: OCR Queue */}
            {(tab === 'readings' || tab === 'ocr_queue') && (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                    <tr>
                      <th className="p-3 text-start font-semibold">{t.labels.readingDate}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.serial}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.currentReading}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.source}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.status}</th>
                      {tab === 'ocr_queue' && (
                        <th className="p-3 text-start font-semibold">{t.labels.confidence}</th>
                      )}
                      <th className="p-3 text-start font-semibold">{t.actions.details}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!readings.length ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          {t.states.empty}
                        </td>
                      </tr>
                    ) : (
                      readings.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-600">{formatDate(r.reading_at)}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {r.meter_serial || r.meter_id?.slice(0, 8)}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {r.reading_value}
                          </td>
                          <td className="p-3 text-slate-600">{r.method}</td>
                          <td className="p-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                r.status === 'approved' || r.status === 'valid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {r.review_status || r.status}
                            </span>
                          </td>
                          {tab === 'ocr_queue' && (
                            <td className="p-3 font-mono font-bold text-sky-700">
                              {r.ocr_confidence ? `${Math.round(r.ocr_confidence * 100)}%` : '—'}
                            </td>
                          )}
                          <td className="p-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(r as unknown as Record<string, unknown>)}
                              className="font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              {t.actions.details}
                            </button>
                            {tab === 'ocr_queue' && isManagement && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewReading(r);
                                  setFormReviewCorrectValue(r.reading_value);
                                  setFormReviewReason('');
                                  setActiveModal('review_modal');
                                }}
                                className="rounded-md bg-amber-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-amber-600"
                              >
                                {t.actions.approve} / {t.actions.reject}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 4: Consumption */}
            {tab === 'consumption' && (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                    <tr>
                      <th className="p-3 text-start font-semibold">{t.labels.periodStart}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.periodEnd}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.serial}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.unit}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.rawConsumption}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.status}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.chargedTotal}</th>
                      <th className="p-3 text-start font-semibold">{t.actions.details}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!consumptions.length ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          {t.states.empty}
                        </td>
                      </tr>
                    ) : (
                      consumptions.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-600">{c.period_start}</td>
                          <td className="p-3 text-slate-600">{c.period_end}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {c.meter_serial || c.meter_id?.slice(0, 8)}
                          </td>
                          <td className="p-3 text-slate-600">{c.unit_code || '—'}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {c.adjusted_consumption || c.raw_consumption}
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                c.status === 'billed'
                                  ? 'bg-purple-100 text-purple-800'
                                  : c.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {formatMoney(c.charged_total)}
                          </td>
                          <td className="p-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(c as unknown as Record<string, unknown>)}
                              className="font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              {t.actions.details}
                            </button>
                            {isManagement && c.status !== 'billed' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBillConsumptionTarget(c);
                                  setActiveModal('bill_modal');
                                }}
                                className="rounded-md bg-purple-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-purple-700"
                              >
                                {t.actions.billConsumption}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 5: Tariffs */}
            {tab === 'tariffs' && (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                    <tr>
                      <th className="p-3 text-start font-semibold">{t.labels.service}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.unitRate}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.fixedCharge}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.vatRate}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.periodStart}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.periodEnd}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!tariffs.length ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          {t.states.empty}
                        </td>
                      </tr>
                    ) : (
                      tariffs.map((tf) => (
                        <tr key={tf.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900">
                            {t.services[(tf.service_type || tf.utility_type) as keyof typeof t.services] ||
                              tf.service_type ||
                              tf.utility_type}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-700">
                            {tf.unit_rate} {tf.currency}
                          </td>
                          <td className="p-3 font-mono">
                            {tf.fixed_charge} {tf.currency}
                          </td>
                          <td className="p-3 font-mono">
                            {tf.tax_rate != null
                              ? `${(Number(tf.tax_rate) * 100).toFixed(2).replace(/\.00$/, '')}%`
                              : tf.vat_rate != null
                              ? `${tf.vat_rate}%`
                              : '0%'}
                          </td>
                          <td className="p-3 text-slate-600">{tf.valid_from || tf.effective_from || '—'}</td>
                          <td className="p-3 text-slate-600">{tf.valid_to || tf.effective_to || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 6: Variance */}
            {tab === 'variance' && (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                    <tr>
                      <th className="p-3 text-start font-semibold">{t.labels.serial}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.service}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.mainConsumption}</th>
                      <th className="p-3 text-start font-semibold">
                        {t.labels.submetersConsumption}
                      </th>
                      <th className="p-3 text-start font-semibold">{t.labels.variance}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!variances.length ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          {t.states.empty}
                        </td>
                      </tr>
                    ) : (
                      variances.map((v, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {v.main_serial}
                          </td>
                          <td className="p-3 font-medium">
                            {t.services[v.service_type as keyof typeof t.services] ||
                              v.service_type}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {v.main_consumption} {v.measurement_unit}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-800">
                            {v.sum_submeters} {v.measurement_unit}
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-700">
                            {v.variance_amount} ({v.variance_pct}%)
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                Math.abs(v.variance_pct) > 10
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {Math.abs(v.variance_pct) > 10 ? 'High Variance' : 'Balanced'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 7: Anomalies */}
            {tab === 'anomalies' && (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                    <tr>
                      <th className="p-3 text-start font-semibold">{t.labels.readingDate}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.serial}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.unit}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.service}</th>
                      <th className="p-3 text-start font-semibold">Anomaly Type</th>
                      <th className="p-3 text-start font-semibold">{t.labels.severity}</th>
                      <th className="p-3 text-start font-semibold">{t.labels.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!anomalies.length ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          {t.states.empty}
                        </td>
                      </tr>
                    ) : (
                      anomalies.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-600">{formatDate(a.detected_at)}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {a.meter_serial || a.meter_id?.slice(0, 8)}
                          </td>
                          <td className="p-3 text-slate-600">{a.unit_code || '—'}</td>
                          <td className="p-3 font-medium">
                            {t.services[a.service_type as keyof typeof t.services] ||
                              a.service_type}
                          </td>
                          <td className="p-3 font-mono text-rose-700">{a.anomaly_type}</td>
                          <td className="p-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                a.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {a.severity}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">{a.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-500">
              <div>
                {offset + 1}–{Math.min(offset + limit, totalCount)} / {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  disabled={offset + limit >= totalCount}
                  onClick={() => setOffset(offset + limit)}
                  className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL 1: Details Inspector */}
      {selectedRecord && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.actions.details}</h3>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(selectedRecord)
                .filter(
                  ([k]) =>
                    ![
                      'source_object_path',
                      'serial_number_encrypted',
                      'raw_result',
                    ].includes(k)
                )
                .map(([key, val]) => (
                  <div key={key} className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-[11px] font-bold text-slate-500">{key}</dt>
                    <dd className="mt-1 break-words font-mono text-xs text-slate-900">
                      {val == null || val === ''
                        ? '—'
                        : typeof val === 'object'
                        ? JSON.stringify(val)
                        : String(val)}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Meter */}
      {activeModal === 'add_meter' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.actions.newMeter}</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleRegisterMeter} className="mt-4 space-y-4">
              {actionError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t.labels.serial}
                </label>
                <input
                  type="text"
                  required
                  value={formMeterSerial}
                  onChange={(e) => setFormMeterSerial(e.target.value)}
                  placeholder="e.g. WTR-BLD-01"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.service}
                  </label>
                  <select
                    value={formMeterService}
                    onChange={(e) => setFormMeterService(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  >
                    {Object.entries(t.services).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.scope}
                  </label>
                  <select
                    value={formMeterScope}
                    onChange={(e) => setFormMeterScope(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  >
                    <option value="unit">unit</option>
                    <option value="building">building</option>
                    <option value="common-area">common-area</option>
                    <option value="property">property</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.measurementUnit}
                  </label>
                  <input
                    type="text"
                    required
                    value={formMeterUnitMeasure}
                    onChange={(e) => setFormMeterUnitMeasure(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.multiplier}
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formMeterMultiplier}
                    onChange={(e) => setFormMeterMultiplier(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.initialReading}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={formMeterInitialReading}
                    onChange={(e) => setFormMeterInitialReading(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? '...' : t.actions.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Capture Reading */}
      {activeModal === 'capture_reading' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.actions.newReading}</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCaptureReading} className="mt-4 space-y-4">
              {actionError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Select Meter
                </label>
                <select
                  required
                  value={formReadingMeterId}
                  onChange={(e) => setFormReadingMeterId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">-- Choose meter --</option>
                  {meters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.serial_number} ({m.service_type} · {m.scope})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t.labels.currentReading}
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={formReadingValue}
                  onChange={(e) => setFormReadingValue(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t.labels.readingDate}
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formReadingDate}
                  onChange={(e) => setFormReadingDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? '...' : t.actions.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Bulk CSV Import */}
      {activeModal === 'bulk_csv' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.actions.bulkImport}</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleBulkCsvImport} className="mt-4 space-y-4">
              {actionError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
              <div className="text-xs text-slate-500">
                Format: <code className="font-mono text-emerald-700">meter_serial,reading_value,reading_at</code> (one record per line).
              </div>
              <textarea
                rows={6}
                required
                value={formCsvText}
                onChange={(e) => setFormCsvText(e.target.value)}
                placeholder="WTR-BLD-01,150.25,2026-09-08T10:00:00Z&#10;ELEC-U101,420.00,2026-09-08T10:00:00Z"
                className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs focus:outline-none"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? '...' : t.actions.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: OCR Candidate Upload */}
      {activeModal === 'ocr_candidate' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.actions.ocrCandidate}</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateOcrCandidate} className="mt-4 space-y-4">
              {actionError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
              <div className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">
                {t.labels.humanReviewNote}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Select Meter
                </label>
                <select
                  required
                  value={formOcrMeterId}
                  onChange={(e) => setFormOcrMeterId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">-- Choose meter --</option>
                  {meters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.serial_number} ({m.service_type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    OCR Extracted Value
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={formOcrValue}
                    onChange={(e) => setFormOcrValue(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.confidence} (0 - 1)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    required
                    value={formOcrConfidence}
                    onChange={(e) => setFormOcrConfidence(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Storage Photo Path / Evidence
                </label>
                <input
                  type="text"
                  required
                  value={formOcrPath}
                  onChange={(e) => setFormOcrPath(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                >
                  {actionLoading ? '...' : t.actions.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Human Review / OCR Boundary */}
      {activeModal === 'review_modal' && reviewReading && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {t.labels.humanReviewBoundary}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setReviewReading(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {actionError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  <span className="text-slate-500">{t.labels.serial}:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">
                    {reviewReading.meter_serial || reviewReading.meter_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">{t.labels.confidence}:</span>{' '}
                  <span className="font-mono font-bold text-sky-700">
                    {reviewReading.ocr_confidence
                      ? `${Math.round(reviewReading.ocr_confidence * 100)}%`
                      : '—'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Candidate Extracted Value:</span>{' '}
                  <span className="font-mono text-base font-extrabold text-slate-900">
                    {reviewReading.reading_value}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t.labels.correctionValue} (if modifying reading)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formReviewCorrectValue}
                  onChange={(e) => setFormReviewCorrectValue(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Audit Notes / {t.labels.rejectionReason}
                </label>
                <input
                  type="text"
                  value={formReviewReason}
                  onChange={(e) => setFormReviewReason(e.target.value)}
                  placeholder="e.g. Verified by meter inspector"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleReviewAction('reject')}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {t.actions.reject}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleReviewAction('correct')}
                  className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {t.actions.correct}
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleReviewAction('approve')}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t.actions.approve}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Calculate Consumption */}
      {activeModal === 'calc_consumption' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {t.actions.calculateConsumption}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCalculateConsumption} className="mt-4 space-y-4">
              {actionError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Select Meter
                </label>
                <select
                  required
                  value={formCalcMeterId}
                  onChange={(e) => setFormCalcMeterId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="">-- Choose meter --</option>
                  {meters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.serial_number} ({m.service_type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.periodStart}
                  </label>
                  <input
                    type="date"
                    required
                    value={formCalcStart}
                    onChange={(e) => setFormCalcStart(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.periodEnd}
                  </label>
                  <input
                    type="date"
                    required
                    value={formCalcEnd}
                    onChange={(e) => setFormCalcEnd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? '...' : t.actions.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: Bill from Consumption */}
      {activeModal === 'bill_modal' && billConsumptionTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {t.actions.billConsumption}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setBillConsumptionTarget(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleBillConsumption} className="mt-4 space-y-4">
              {actionError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
              <div className="rounded-xl bg-purple-50 p-4 text-xs text-purple-900 space-y-2">
                <div className="font-bold text-purple-950">
                  Billing Integration Flow via Existing Accounting Contract:
                </div>
                <div>
                  • Approved Consumption:{' '}
                  <span className="font-mono font-bold">
                    {billConsumptionTarget.adjusted_consumption ||
                      billConsumptionTarget.raw_consumption}
                  </span>
                </div>
                <div>
                  • Creates Draft Invoice → Issues Bill → Generates Balanced GL Journal (Dr 4111
                  Receivables / Cr 704 Income) → Verifies continuous AR parity.
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  required
                  value={formBillDueDate}
                  onChange={(e) => setFormBillDueDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setBillConsumptionTarget(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
                >
                  {actionLoading ? '...' : t.actions.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 9: Add Tariff */}
      {activeModal === 'add_tariff' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.actions.newTariff}</h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTariff} className="mt-4 space-y-4">
              {actionError && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                  {actionError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t.labels.service}
                </label>
                <select
                  value={formTariffService}
                  onChange={(e) => setFormTariffService(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  {Object.entries(t.services).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.unitRate} (RON)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formTariffRate}
                    onChange={(e) => setFormTariffRate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t.labels.fixedCharge}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formTariffFixed}
                    onChange={(e) => setFormTariffFixed(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      {t.labels.vatRate} *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormTariffVat('0')}
                      className="text-[10px] font-semibold text-emerald-600 hover:underline"
                    >
                      {t.labels.noTax}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    placeholder="e.g. 0, 9, 19"
                    value={formTariffVat}
                    onChange={(e) => setFormTariffVat(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    {t.labels.taxPolicyNotice}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {t.labels.periodStart}
                </label>
                <input
                  type="date"
                  value={formTariffFrom}
                  onChange={(e) => setFormTariffFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? '...' : t.actions.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
