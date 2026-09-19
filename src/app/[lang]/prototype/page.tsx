'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { PRODUCT_METRICS } from '@/config/product-metrics';
import {
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Scale,
  ShieldCheck,
  Cpu,
  UserCheck,
  FileCheck,
  CreditCard,
  History,
  AlertTriangle,
  Play,
  RotateCcw,
  AlertOctagon,
  Wrench,
  Check,
  Loader2
} from 'lucide-react';

export default function PrototypePage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = use(props.params);
  const lang = params.lang;
  const dict = getDictionary(params.lang);
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  // Active journey state
  const [selectedJourneyIndex, setSelectedJourneyIndex] = useState<number>(3); // Default to Journey 4 (M25)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSimulatedError, setIsSimulatedError] = useState<boolean>(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<boolean>(false);
  const [isConfirmedByUser, setIsConfirmedByUser] = useState<boolean>(false);

  const journeys = [
    {
      id: 'J1',
      title: isRo ? 'Parcursul 1: Mentenanță Locatar → Dispecerat → Factură' : isFa ? 'مسیر ۱: درخواست تعمیرات ساکن → ارجاع فنی → ثبت هزینه' : 'Journey 1: Tenant Ticket → Work Order → Allocation',
      desc: isRo ? 'De la sesizarea avariei în aplicație până la înregistrarea costului pe proprietar.' : isFa ? 'از ثبت درخواست اولیه تا تسویه حساب با پیمانکار.' : 'From initial resident report to contractor payment allocation.',
      stepsCount: 5,
    },
    {
      id: 'J2',
      title: isRo ? 'Parcursul 2: Închidere de Lună în Masă → Balanță → Liste' : isFa ? 'مسیر ۲: بستن دوره ماهانه → تراز آزمایشی → لیست شارژ' : 'Journey 2: Batch Month-Close → Trial Balance → Quota Sheet',
      desc: isRo ? 'Calculul automat al cotelor de întreținere conform Legii 196/2018.' : isFa ? 'محاسبه سهم هر واحد بر اساس استانداردهای قانونی.' : 'Automated monthly maintenance quota computation.',
      stepsCount: 6,
    },
    {
      id: 'J3',
      title: isRo ? 'Parcursul 3: Citire Foto OCR Contor → Detecție Anomalii' : isFa ? 'مسیر ۳: قرائت تصویری کنتور → بررسی مصرف غیرعادی' : 'Journey 3: Photo OCR Metering → Anomaly Detection',
      desc: isRo ? 'Transmitere index prin poză, recunoaștere automată și avertizare pierderi.' : isFa ? 'استخراج رقم از عکس کنتور و هشدار هدررفت شبکه.' : 'Multi-method reading with automatic leakage anomaly flag.',
      stepsCount: 4,
    },
    {
      id: 'J4',
      title: isRo ? 'Parcursul 4: Ingestie Factură Utilități → OCR → Aprobare Umană → Înregistrare (M25)' : isFa ? 'مسیر ۴: دریافت قبض انرژی → استخراج هوشمند → تأیید انسانی → ثبت دفتر (M25)' : 'Journey 4: Utility Inbox → OCR → Human Approval → Ledger Post (M25)',
      desc: isRo ? 'Fluxul complet de procesare inteligentă a facturilor de utilități cu limită strictă de validare umană.' : isFa ? 'گردش‌کار کامل پردازش هوشمند قبوض انرژی با مرز مشخص تأیید نهایی انسانی.' : 'Complete utility invoice intelligence journey with mandatory authorized human confirmation.',
      stepsCount: 9,
      isNew: true,
    },
  ];

  // Exact 9 Sequential Steps for Journey 4
  const journey4Steps = [
    {
      num: '1',
      title: isRo ? '1. Inbox Utilități (Recepție Factură - Simulare)' : isFa ? '۱. صندوق ورودی قبوض (دریافت سند - شبیه‌سازی)' : '1. Utility Inbox (Invoice Received - Simulation)',
      badge: 'e-Factura XML (Simulare / Demo)',
      actor: 'e-Factura XML Parser (Simulare Demo)',
      role: 'Simulated Ingestion Gateway',
      desc: isRo ? 'Factură demonstrativă încărcată din fișier XML UBL 2.1 (Simulare / Date fictive / Fără conexiune SPV de producție).' : isFa ? 'صورت‌حساب برق نمونه از فایل ساختاریافته XML (شبیه‌سازی / بدون اتصال پروداکشن به سامانه).' : 'Demo invoice loaded from XML UBL 2.1 file (Simulation / Fictitious data - No production SPV connection).',
      evidence: '[Simulare Demo] XML Message ID: DEMO-SIM-eFactura-RO-2026-98129',
      auditId: 'AUD-J4-01-REC',
    },
    {
      num: '2',
      title: isRo ? '2. Detalii Factură & Scanare Sursă' : isFa ? '۲. جزییات سند و پیش‌نمایش تصویر' : '2. Bill Detail & Source Scan',
      badge: 'Document Inspection',
      actor: 'AI Ingestion Engine',
      role: 'Document Parser',
      desc: isRo ? 'Afișare alăturată document original și metadate furnizor (Enel Energie Muntenia).' : isFa ? 'نمایش فایل اصلی در کنار اطلاعات تأمین‌کننده.' : 'Side-by-side display of original scan and supplier credentials.',
      evidence: 'factura_enel_octombrie_2026_8849201.pdf (Hash SHA-256 verified)',
      auditId: 'AUD-J4-02-DET',
    },
    {
      num: '3',
      title: isRo ? '3. Date Extrase & Scor Încredere' : isFa ? '۳. استخراج داده‌ها و ضریب اطمینان' : '3. Extracted Data & Confidence',
      badge: '98% Confidence',
      actor: 'Neural OCR Parser',
      role: 'Data Extraction',
      desc: isRo ? 'Extragere 14 câmpuri: Total 3.420,50 RON, TVA 546,13 RON, Scadență 17.11.2026.' : isFa ? 'استخراج ۱۴ فیلد مالی با ضریب اطمینان ۹۸٪.' : 'Extracted 14 fields: Total 3,420.50 RON, VAT 19%, Due 17-Nov-2026.',
      evidence: 'Field scores: Total=98%, TaxId=100%, Date=99%',
      auditId: 'AUD-J4-03-EXT',
    },
    {
      num: '4',
      title: isRo ? '4. Reconciliere Contor & Tarif' : isFa ? '۴. تطبیق شاخص کنتور و نرخ تعرفه' : '4. Meter & Tariff Match',
      badge: 'Meter Matched',
      actor: 'Automated Rules Engine',
      role: 'Reconciliation Service',
      desc: isRo ? 'Contor RO-EL-773901 validat. Consum calculat: 3.060 kWh. Tarif contract 0,939 RON.' : isFa ? 'کنتور تطبیق داده شد. مصرف ۳۰۶۰ کیلووات‌ساعت.' : 'Meter RO-EL-773901 matched. Consumption 3,060 kWh verified.',
      evidence: 'Tariff Contract #CT-2024-991 matched with 0% variance.',
      auditId: 'AUD-J4-04-MAT',
    },
    {
      num: '5',
      title: isRo ? '5. Verificare & Excepții Reguli' : isFa ? '۵. اعتبارسنجی و بررسی مغایرت‌ها' : '5. Exception Review & Validation',
      badge: 'Validated Clean',
      actor: 'Deterministic Policy Checker',
      role: 'Compliance Engine',
      desc: isRo ? '0 excepții blocate. Alocare statutară 100% Cota-Parte Chiriași (Legea 196/2018).' : isFa ? 'بدون خطا. تسهیم ۱۰۰٪ بر اساس مصرف جاری.' : 'Zero blocking exceptions. Statutory split computed: 100% Operational.',
      evidence: 'Law 196/2018 Statutory Allocation Matrix verified.',
      auditId: 'AUD-J4-05-VAL',
    },
    {
      num: '6',
      title: isRo ? '6. Aprobare Umană Autorizată' : isFa ? '۶. بررسی و تأیید نهایی انسانی' : '6. Authorized Human Approval',
      badge: 'Human Sign-Off Required',
      actor: 'Elena Popescu',
      role: 'Authorized Property Manager',
      desc: isRo ? 'Operatorul uman verifică datele și semnează digital decizia de plată.' : isFa ? 'کاربر انسانی داده‌ها را بررسی و تأیید نهایی را صادر کرد.' : 'Authorized human inspects parameters and authorizes expense.',
      evidence: 'Human Approval Token #HA-2026-98124 issued.',
      auditId: 'AUD-J4-06-APP',
      requiresConfirmation: true,
    },
    {
      num: '7',
      title: isRo ? '7. Înregistrare în Registre & Control Analitic' : isFa ? '۷. ثبت در دفاتر و کنترل تحلیلی' : '7. Posted to Statutory Books & Analytical Ledger',
      badge: 'Ledger Posted',
      actor: 'General Ledger Service',
      role: 'Supplemental Analytical Ledger',
      desc: isRo ? 'Generat articol contabil în Jurnal pe contul 605.01 Cheltuieli Energie Electrică.' : isFa ? 'سند حسابداری در سرفصل هزینه‌های انرژی ثبت شد.' : 'Journal entry generated on Account 605.01 (Electricity expense).',
      evidence: 'Journal ID: JRN-2026-10-0891 • Allocation ID: ALC-UB-2026-10',
      auditId: 'AUD-J4-07-POS',
      journalId: 'JRN-2026-10-0891',
      allocationId: 'ALC-UB-2026-10',
    },
    {
      num: '8',
      title: isRo ? '8. Reconciliere Bancară & Plată' : isFa ? '۸. تطبیق بانکی و آماده‌سازی پرداخت' : '8. Payment Ready & Bank Sync',
      badge: 'Payment Scheduled',
      actor: 'Open Banking Connector',
      role: 'Treasury Settlement',
      desc: isRo ? 'Pregătit fișier ordin de plată (OP) cu IBAN-ul verificat al furnizorului.' : isFa ? 'دستور پرداخت بانکی با شماره شبای تأییدشده آماده شد.' : 'Payment order drafted with verified supplier IBAN.',
      evidence: 'Scheduled for Settlement on 15-Nov-2026 via BCR Open Banking.',
      auditId: 'AUD-J4-08-PAI',
    },
    {
      num: '9',
      title: isRo ? '9. Jurnal de Audit & Dovadă Finală' : isFa ? '۹. بایگانی نهایی و زنجیره ممیزی' : '9. Final Audit Trail & Proof',
      badge: 'Audit Complete',
      actor: 'Compliance Vault',
      role: 'Immutable Storage',
      desc: isRo ? 'Toate etapele, actorii, deciziile umane și timestamp-urile sunt securizate.' : isFa ? 'تمامی رویدادها، نقش‌ها و تصمیمات در زنجیره ممیزی ثبت شدند.' : 'Complete immutable record sealed with full cryptographic audit trail.',
      evidence: 'Root Audit Hash: 0x9185dd4759671ed69dca39f17080c84593912134-M25',
      auditId: 'AUD-J4-09-FIN',
      journalId: 'JRN-2026-10-0891',
      allocationId: 'ALC-UB-2026-10',
    },
  ];

  const handleNextStep = () => {
    const step = journey4Steps[currentStepIndex];
    if (step.requiresConfirmation && !isConfirmedByUser) {
      setIsConfirmationModalOpen(true);
      return;
    }

    if (currentStepIndex < journey4Steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setIsProcessing(false);
      setIsSimulatedError(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setIsProcessing(false);
      setIsSimulatedError(false);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    setIsProcessing(false);
    setIsSimulatedError(false);
    setIsConfirmedByUser(false);
  };

  const handleTriggerProcessing = () => {
    setIsProcessing(true);
    setIsSimulatedError(false);
  };

  const handleCompleteProcessing = () => {
    setIsProcessing(false);
    if (currentStepIndex < journey4Steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleTriggerError = () => {
    setIsSimulatedError(true);
    setIsProcessing(false);
  };

  const handleTriggerRecovery = () => {
    setIsSimulatedError(false);
    setIsProcessing(false);
  };

  const handleConfirmHumanAction = () => {
    setIsConfirmedByUser(true);
    setIsConfirmationModalOpen(false);
    setCurrentStepIndex(6); // advance to Posted step
  };

  const currentStep = journey4Steps[currentStepIndex];

  return (
    <div className="pt-28 pb-24 space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-start">
      {/* Header Card */}
      <div className="card-proptech p-6 sm:p-8 bg-white border-[#E2E8F0] space-y-3 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EAF8F5] border border-[#B2E5DF] text-xs font-bold text-[#0A6E62]">
          <Sparkles className="w-3.5 h-3.5 text-[#0A6E62]" />
          <span>Interactive Prototype Journeys</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
          {isRo ? 'Parcursuri Prototip Interactive' : isFa ? 'مسیرهای تعاملی پروتوتایپ' : 'Interactive Prototype Journeys'}
        </h1>
        <p className="text-sm text-[#52667A] max-w-2xl mx-auto">
          {isRo
            ? 'Simularea pas cu pas a fluxurilor cheie din sistemul CLADORA (Total: 4 Parcursuri).'
            : isFa
            ? 'شبیه‌سازی گام‌به‌گام گردش‌کارهای کلیدی پلتفرم کلادورا (مجموع: ۴ مسیر).'
            : 'Step-by-step interactive simulation of key platform journeys (Total: 4 Journeys).'}
        </p>
      </div>

      {/* Metrics Banner */}
      <div className="card-proptech p-4 bg-white border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#52667A]">
        <div>{dict.metrics.prototypeJourneys}: <strong className="text-[#0A6E62]">{PRODUCT_METRICS.prototypeJourneys}</strong></div>
        <div>{dict.metrics.userTestingTasks}: <strong className="text-[#1E40AF]">{PRODUCT_METRICS.userTestingTasks}</strong></div>
        <div>{dict.metrics.managerWorkspaces}: <strong className="text-[#065F46]">{PRODUCT_METRICS.managerWorkspaces}</strong></div>
      </div>

      {/* Journey Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {journeys.map((j, idx) => (
          <button
            key={j.id}
            type="button"
            onClick={() => {
              setSelectedJourneyIndex(idx);
              setCurrentStepIndex(0);
              setIsProcessing(false);
              setIsSimulatedError(false);
              setIsConfirmedByUser(false);
            }}
            className={`card-proptech p-5 text-start transition-all flex flex-col justify-between ${
              selectedJourneyIndex === idx
                ? 'bg-[#EAF8F5]/50 border-[#0A6E62] ring-2 ring-[#0A6E62] shadow-sm'
                : 'bg-white border-[#E2E8F0] hover:border-[#B2E5DF]'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F0F4F8] text-[#102A43] border border-[#D3DCE6]">
                  {j.id}
                </span>
                {j.isNew && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                    NEW M25
                  </span>
                )}
              </div>
              <h3 className="text-xs font-bold text-[#102A43] leading-snug">{j.title}</h3>
              <p className="text-[11px] text-[#52667A] leading-relaxed">{j.desc}</p>
            </div>

            <div className="mt-3 pt-3 border-t border-[#E2E8F0] text-[11px] text-[#52667A] font-mono">
              {j.stepsCount} {isRo ? 'etape interactive' : isFa ? 'مرحله تعاملی' : 'interactive steps'}
            </div>
          </button>
        ))}
      </div>

      {/* Active Interactive Simulator for Journey 4 */}
      {selectedJourneyIndex === 3 && (
        <div className="card-proptech p-6 sm:p-8 bg-white border-[#E2E8F0] space-y-8 animate-fadeIn text-start">

          {/* Header of Simulator */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-[#EAF8F5] text-[#0A6E62] font-mono text-xs font-bold border border-[#B2E5DF]">
                  Journey 4 / 4 • Step {currentStepIndex + 1} of {journey4Steps.length}
                </span>
                <span className="text-xs text-[#52667A] font-mono">{currentStep.auditId}</span>
              </div>
              <h2 className="text-2xl font-display font-extrabold text-[#102A43] mt-1">
                {currentStep.title}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {/* Observable Processing State Toggle */}
              {!isProcessing && !isSimulatedError && currentStepIndex < journey4Steps.length - 1 && (
                <button
                  type="button"
                  onClick={handleTriggerProcessing}
                  className="px-3 py-1.5 rounded-xl bg-[#EDF5FF] text-[#1E40AF] border border-[#BDD8FF] text-xs font-bold flex items-center gap-1.5 hover:bg-[#DCEBFF] transition-colors"
                  title="Enter Deterministic Processing State"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{isRo ? 'Stare Procesare' : isFa ? 'شبیه‌سازی پردازش' : 'Processing State'}</span>
                </button>
              )}

              {/* Deterministic Error Injection Button for prototype testing */}
              {!isSimulatedError && !isProcessing && currentStepIndex >= 2 && currentStepIndex <= 5 && (
                <button
                  type="button"
                  onClick={handleTriggerError}
                  className="px-3 py-1.5 rounded-xl bg-[#FFF7E6] text-[#92400E] border border-[#F5B942] text-xs font-bold flex items-center gap-1.5 hover:bg-[#FFF2D6] transition-colors"
                  title="Inject Deterministic Prototype Anomaly"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>{isRo ? 'Simulează Excepție / Eroare' : isFa ? 'شبیه‌سازی خطا / مغایرت' : 'Simulate Error'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="p-2 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#52667A] text-xs transition-colors border border-[#D3DCE6]"
                title="Restart Simulation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Step Indicator Bar (9 Steps) */}
          <div className="grid grid-cols-9 gap-1 sm:gap-2">
            {journey4Steps.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setCurrentStepIndex(idx);
                  setIsProcessing(false);
                  setIsSimulatedError(false);
                }}
                className={`py-2 px-1 rounded-xl text-center font-mono text-[11px] font-bold transition-all border ${
                  idx === currentStepIndex
                    ? 'bg-[#0A6E62] text-white border-[#0A6E62] shadow-sm scale-105'
                    : idx < currentStepIndex
                    ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]'
                    : 'bg-[#F0F4F8] text-[#52667A] border-[#D3DCE6] hover:text-[#102A43]'
                }`}
              >
                {s.num}
              </button>
            ))}
          </div>

          {/* Deterministic Processing State Surface */}
          {isProcessing ? (
            <div className="p-6 rounded-2xl bg-[#EDF5FF] border border-[#BDD8FF] space-y-4 animate-fadeIn">
              <div className="flex items-center gap-3 text-[#1E40AF]">
                <Loader2 className="w-6 h-6 text-[#1E40AF] animate-spin shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-[#102A43]">
                    {isRo ? 'Stare de Prelucrare Prototip: Extragere OCR & Reconciliere în Curs' : isFa ? 'وضعیت پردازش پروتوتایپ: استخراج متنی و تطبیق هوشمند' : 'Deterministic Prototype State: OCR Extraction & Reconciliation'}
                  </h3>
                  <p className="text-xs text-[#52667A] mt-0.5">
                    {isRo ? 'Simulare fără operațiuni reale de backend, înregistrare sau plată.' : isFa ? 'شبیه‌سازی فرآیند بدون ارسال درخواست به سرور یا ایجاد تراکنش مالی واقعی.' : 'Deterministic simulation without backend calls, ledger posting, or payment operations.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#BDD8FF] text-xs font-mono space-y-1 text-[#52667A]">
                <div>Process Token: <strong className="text-[#1E40AF]">PROC-DET-M25-9812</strong></div>
                <div>Status: <strong className="text-[#065F46]">Deterministic Extraction Complete (98% Score)</strong></div>
                <div>Next Gateway: <strong className="text-[#102A43]">Authorized Human Verification</strong></div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProcessing(false)}
                  className="px-4 py-2 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold border border-[#D3DCE6]"
                >
                  {isRo ? 'Înapoi la Pas' : isFa ? 'بازگشت' : 'Back to Step'}
                </button>
                <button
                  type="button"
                  onClick={handleCompleteProcessing}
                  className="px-5 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>{isRo ? 'Finalizează Procesarea & Continuă' : isFa ? 'تکمیل پردازش و ادامه مسیر' : 'Complete Processing & Continue'}</span>
                </button>
              </div>
            </div>
          ) : isSimulatedError ? (
            /* Deterministic Error Path & Recovery Surface */
            <div className="p-6 rounded-2xl bg-[#FFF7E6] border border-[#F5B942] space-y-4 animate-shake">
              <div className="flex items-center gap-2.5 text-[#92400E]">
                <AlertTriangle className="w-6 h-6 text-[#92400E] shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-[#102A43]">
                    {isRo ? 'Eroare Simulat: Nepotrivire Index Contor & Scor Scăzut OCR' : isFa ? 'خطای شبیه‌سازی‌شده: مغایرت شاخص کنتور و اطمینان پایین' : 'Deterministic Error: Meter Index Discrepancy & Low OCR Score'}
                  </h3>
                  <p className="text-xs text-[#52667A] mt-0.5">
                    {isRo ? 'Fluxul automat a fost oprit conform politicii de siguranță financiară.' : isFa ? 'گردش‌کار خودکار متوقف شده و نیاز به مداخله و اصلاح دستی دارد.' : 'Automated progression halted per financial safety policy.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#F5B942] text-xs font-mono space-y-1 text-[#52667A]">
                <div>Error Code: <strong className="text-[#991B1B]">ERR_METER_MISMATCH_05</strong></div>
                <div>Affected Field: <strong className="text-[#102A43]">startMeterReading (Extracted: 120500 vs DB: 124200)</strong></div>
                <div>Suggested Action: <strong className="text-[#0A6E62]">Manual Human Verification against Original Scan</strong></div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTriggerRecovery}
                  className="px-5 py-2.5 rounded-xl bg-[#92400E] hover:bg-[#78350F] text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all"
                >
                  <Wrench className="w-4 h-4" />
                  <span>{isRo ? 'Execută Acțiunea de Recuperare (Corectare Manuală)' : isFa ? 'اجرای اقدام اصلاحی (بازیابی و تصحیح دستی)' : 'Execute Recovery Action (Manual Correction)'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Standard Step Detail Card */
            <div className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
                    {isRo ? 'Actor & Rol Responsabil:' : isFa ? 'کاربر و نقش مجری:' : 'Responsible Actor & Role:'}
                  </span>
                  <div className="text-base font-bold text-[#102A43] mt-0.5 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#0A6E62]" />
                    <span>{currentStep.actor}</span>
                    <span className="text-xs font-normal text-[#52667A] font-mono">({currentStep.role})</span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EAF8F5] text-[#0A6E62] border border-[#B2E5DF] self-start md:self-auto">
                  {currentStep.badge}
                </span>
              </div>

              <p className="text-sm text-[#52667A] leading-relaxed">
                {currentStep.desc}
              </p>

              <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] font-mono text-xs space-y-1">
                <div className="text-[#52667A]">
                  <strong>{isRo ? 'Mărturie / Dovadă:' : isFa ? 'مستند اعتبارسنجی:' : 'Verification Evidence:'}</strong>
                </div>
                <div className="text-[#1E40AF]">{currentStep.evidence}</div>
                {currentStep.journalId && (
                  <div className="pt-2 text-[#065F46] border-t border-[#E2E8F0] flex flex-wrap gap-4 font-bold">
                    <span>Journal ID: <strong>{currentStep.journalId}</strong></span>
                    <span>Allocation ID: <strong>{currentStep.allocationId}</strong></span>
                    <span>Audit ID: <strong>{currentStep.auditId}</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Controls: Back, Next, Confirmation */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              className="px-4 py-2 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] disabled:opacity-40 disabled:cursor-not-allowed text-[#102A43] text-xs font-bold border border-[#D3DCE6] inline-flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isRo ? 'Pasul Anterior' : isFa ? 'مرحله قبل' : 'Previous Step'}</span>
            </button>

            <div className="text-xs text-[#52667A] font-mono">
              {currentStepIndex === journey4Steps.length - 1 ? (
                <span className="text-[#065F46] font-bold">✓ {isRo ? 'Parcurs Finalizat cu Succes' : isFa ? 'مسیر با موفقیت تکمیل شد' : 'Journey Completed'}</span>
              ) : (
                <span>{journey4Steps.length - currentStepIndex - 1} {isRo ? 'pași rămași' : isFa ? 'مرحله باقی‌مانده' : 'steps remaining'}</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              disabled={currentStepIndex === journey4Steps.length - 1 || isSimulatedError}
              className="px-5 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm inline-flex items-center gap-2 transition-all"
            >
              <span>{isRo ? 'Următorul Pas' : isFa ? 'مرحله بعد' : 'Next Step'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* Confirmation Modal for Step 6 (Human Sign-off Boundary) */}
      {isConfirmationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-proptech max-w-md w-full bg-white border-[#D3DCE6] p-6 space-y-5 rounded-2xl shadow-elevated text-start animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#0A6E62] text-white shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-display font-extrabold text-[#102A43]">
                  {isRo ? 'Aprobare Umană Obligatorie' : isFa ? 'تأیید نهایی کاربر انسانی' : 'Mandatory Human Approval'}
                </h3>
                <span className="text-xs text-[#52667A] font-mono">Step 6 Human Sign-Off Gate</span>
              </div>
            </div>

            <p className="text-xs text-[#52667A] leading-relaxed">
              {isRo
                ? 'Confirmați că ați verificat indexurile contorului, tariful contractului și defalcarea chiriaș/proprietar pentru factura Enel (3.420,50 RON)?'
                : isFa
                ? 'آیا صحت ارقام کنتور، تعرفه قرارداد و سهم مالک/مستأجر برای صورت‌حساب برق ۳۴۲۰٫۵۰ لئو را تأیید می‌نمایید؟'
                : 'Confirm verification of meter readings, contract tariff, and owner/tenant allocation split for Enel Invoice (3,420.50 RON)?'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setIsConfirmationModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold border border-[#D3DCE6]"
              >
                {isRo ? 'Anulează' : isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmHumanAction}
                className="px-5 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isRo ? 'Confirm & Aprobă Factura' : isFa ? 'تأیید و ثبت سند' : 'Confirm & Authorize'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-M25 Journeys Informational Box */}
      {selectedJourneyIndex !== 3 && (
        <div className="card-proptech p-8 bg-white border-[#E2E8F0] text-center space-y-4">
          <h3 className="text-xl font-display font-extrabold text-[#102A43]">{journeys[selectedJourneyIndex].title}</h3>
          <p className="text-sm text-[#52667A] max-w-xl mx-auto">{journeys[selectedJourneyIndex].desc}</p>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setSelectedJourneyIndex(3)}
              className="px-5 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm inline-flex items-center gap-2"
            >
              <span>{isRo ? 'Comută la Parcursul 4 (M25 Utility Bills)' : isFa ? 'تغییر به مسیر ۴ (M25 قبوض)' : 'Switch to Journey 4 (M25 Utility Bills)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
