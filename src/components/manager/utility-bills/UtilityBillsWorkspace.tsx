'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Upload,
  Mail,
  FileSpreadsheet,
  Cpu,
  Zap,
  Droplets,
  Flame,
  Trash2,
  Wrench,
  Filter,
  X,
  Calendar,
  Building2,
  UserCheck,
  Scale,
  History,
  Check,
  FileCheck,
  AlertOctagon,
  RotateCcw,
  SlidersHorizontal,
  FileImage,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { UtilityBill, UtilityWorkflowState, BillType, WorkflowEvent } from '@/types/utilityBills';
import { MOCK_UTILITY_BILLS } from '@/data/mockUtilityBills';
import { PRODUCT_METRICS } from '@/config/product-metrics';

interface UtilityBillsWorkspaceProps {
  lang: Language;
}

export function UtilityBillsWorkspace({ lang }: UtilityBillsWorkspaceProps) {
  const dict = getDictionary(lang);
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  // Workspace Dataset State
  const [bills, setBills] = useState<UtilityBill[]>(MOCK_UTILITY_BILLS);
  const [selectedBillId, setSelectedBillId] = useState<string | null>('UB-2026-001');

  // Complete 7 Filter Dimensions
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [selectedDueDateFilter, setSelectedDueDateFilter] = useState<string>('ALL');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [filterExceptionsOnly, setFilterExceptionsOnly] = useState<boolean>(false);

  // UI Surfaces & Tab State
  const [detailActiveTab, setDetailActiveTab] = useState<'EXTRACTED' | 'DOCUMENT'>('EXTRACTED');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [confirmActionType, setConfirmActionType] = useState<'APPROVE' | 'POST'>('APPROVE');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Available Buildings & Suppliers dynamically extracted from dataset
  const availableBuildings = useMemo(() => {
    const set = new Set<string>();
    bills.forEach(b => { if (b.buildingName) set.add(b.buildingName); });
    return Array.from(set);
  }, [bills]);

  // Constrain Units dynamically based on selected building
  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    bills.forEach(b => {
      if (selectedBuilding === 'ALL' || b.buildingName === selectedBuilding) {
        if (b.unitNumber) set.add(b.unitNumber);
      }
    });
    return Array.from(set);
  }, [bills, selectedBuilding]);

  const availableSuppliers = useMemo(() => {
    const set = new Set<string>();
    bills.forEach(b => { if (b.supplierName) set.add(b.supplierName); });
    return Array.from(set);
  }, [bills]);

  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    bills.forEach(b => { if (b.billingPeriod) set.add(b.billingPeriod); });
    return Array.from(set);
  }, [bills]);

  // Formatters for locale consistency
  const formatUnitName = (unit?: string) => {
    if (!unit) return isFa ? 'همه واحدها' : isRo ? 'Toate unitățile' : 'All Units';
    if (isFa) {
      return unit
        .replace(/Scara A \+ Scara B/g, 'ورودی ۱ و ۲')
        .replace(/Scara A/g, 'ورودی ۱')
        .replace(/Scara B/g, 'ورودی ۲')
        .replace(/Total 48 Apartamente/g, 'کل ۴۸ واحد')
        .replace(/Apartamente/g, 'واحدها')
        .replace(/Common Areas & Lift/g, 'مشاعات و آسانسور')
        .replace(/Common Areas/g, 'مشاعات')
        .replace(/Centrală Termică Bloc/g, 'موتورخانه مرکزی')
        .replace(/Branșament Principal/g, 'انشعاب اصلی');
    }
    return unit;
  };

  const formatAccountName = (account?: string) => {
    if (!account) return '';
    if (isFa) {
      return account
        .replace(/Cheltuieli cu energia electrică spații comune/g, 'هزینه‌های برق روشنایی و آسانسور مشاعات')
        .replace(/Cheltuieli cu apa potabilă și canalizarea/g, 'هزینه‌های آب آشامیدنی و شبکه فاضلاب شهری')
        .replace(/Cheltuieli cu gazele naturale centrală bloc/g, 'هزینه‌های گاز طبیعی موتورخانه و گرمایش مرکزی')
        .replace(/Cheltuieli cu serviciile de salubrizare/g, 'هزینه‌های مدیریت پسماند و خدمات شهری')
        .replace(/Cheltuieli mentenanță ascensoare/g, 'هزینه‌های سرویس و نگهداری دوره‌ای آسانسورها');
    }
    return account;
  };

  const formatAllocationRuleName = (rule?: string) => {
    if (!rule) return '';
    if (isFa) {
      return rule
        .replace(/Cota-Parte Indiviză Comună \(Legea 196\/2018\)/g, 'تسهیم بر اساس قدرالسهم مشاعات (قانون ۱۹۶)')
        .replace(/Consum Individual Index Contoare/g, 'تسهیم بر اساس مصرف کنتورهای فرعی واحدها')
        .replace(/Suprafață Utilă Încălzită \(mp\)/g, 'تسهیم بر اساس متراژ مفید گرمایشی (مترمربع)')
        .replace(/Număr Persoane Rezidente/g, 'تسهیم بر اساس تعداد نفرات ساکن در واحد')
        .replace(/Număr Apartamente Deservite \(Cota Fixă\)/g, 'تسهیم ثابت مساوی بر اساس تعداد واحدها');
    }
    return rule;
  };

  const formatPeriodLabel = (period: string) => {
    if (isFa) {
      if (period === 'OCT-2026') return 'اکتبر ۲۰۲۶';
      if (period === 'SEP-2026') return 'سپتامبر ۲۰۲۶';
    }
    return period;
  };

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSelectedType('ALL');
    setSelectedBuilding('ALL');
    setSelectedUnit('ALL');
    setSelectedSupplier('ALL');
    setSelectedPeriod('ALL');
    setSelectedDueDateFilter('ALL');
    setSelectedState('ALL');
    setFilterExceptionsOnly(false);
  };

  // Active filter count for badge indicator
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedType !== 'ALL') count++;
    if (selectedBuilding !== 'ALL') count++;
    if (selectedUnit !== 'ALL') count++;
    if (selectedSupplier !== 'ALL') count++;
    if (selectedPeriod !== 'ALL') count++;
    if (selectedDueDateFilter !== 'ALL') count++;
    if (selectedState !== 'ALL') count++;
    if (filterExceptionsOnly) count++;
    return count;
  }, [selectedType, selectedBuilding, selectedUnit, selectedSupplier, selectedPeriod, selectedDueDateFilter, selectedState, filterExceptionsOnly]);

  // Filtered Bills Array
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (selectedType !== 'ALL' && b.billType !== selectedType) return false;
      if (selectedBuilding !== 'ALL' && b.buildingName !== selectedBuilding) return false;
      if (selectedUnit !== 'ALL' && b.unitNumber !== selectedUnit) return false;
      if (selectedSupplier !== 'ALL' && b.supplierName !== selectedSupplier) return false;
      if (selectedPeriod !== 'ALL' && b.billingPeriod !== selectedPeriod) return false;
      if (selectedState !== 'ALL' && b.workflowState !== selectedState) return false;
      if (filterExceptionsOnly && (!b.exceptions || b.exceptions.length === 0)) return false;

      if (selectedDueDateFilter === 'URGENT') {
        const due = new Date(b.dueDate).getTime();
        const now = new Date('2026-11-04').getTime();
        const diffDays = (due - now) / (1000 * 60 * 60 * 24);
        if (diffDays > 7 || diffDays < 0) return false;
      } else if (selectedDueDateFilter === 'OVERDUE') {
        const due = new Date(b.dueDate).getTime();
        const now = new Date('2026-11-04').getTime();
        if (due >= now) return false;
      }

      return true;
    });
  }, [bills, selectedType, selectedBuilding, selectedUnit, selectedSupplier, selectedPeriod, selectedState, filterExceptionsOnly, selectedDueDateFilter]);

  // Selected Active Bill Object
  const activeBill = useMemo(() => {
    return bills.find(b => b.id === selectedBillId) || filteredBills[0] || bills[0];
  }, [bills, selectedBillId, filteredBills]);

  // Status Badge Formatting & Severity (Strict >= 4.5:1 WCAG AA compliant)
  const getStatusBadge = (state: UtilityWorkflowState) => {
    switch (state) {
      case 'RECEIVED':
        return {
          label: isRo ? '1. Recepționat' : isFa ? '۱. دریافت شد' : '1. Received',
          classes: 'bg-[#F0F4F8] text-[#52667A] border-[#D3DCE6]',
          icon: <Clock className="w-3.5 h-3.5 text-[#52667A]" />,
        };
      case 'EXTRACTED':
        return {
          label: isRo ? '2. Extras OCR' : isFa ? '۲. استخراج OCR' : '2. Extracted',
          classes: 'bg-[#EDF5FF] text-[#1E40AF] border-[#BDD8FF]',
          icon: <Zap className="w-3.5 h-3.5 text-[#1E40AF]" />,
        };
      case 'MATCHED':
        return {
          label: isRo ? '3. Reconciliat Contor' : isFa ? '۳. تطبیق کنتور' : '3. Matched',
          classes: 'bg-[#FFF7E6] text-[#92400E] border-[#FCE3AA]',
          icon: <Scale className="w-3.5 h-3.5 text-[#92400E]" />,
        };
      case 'VALIDATED':
        return {
          label: isRo ? '4. Validat de Sistem' : isFa ? '۴. اعتبارسنجی شد' : '4. Validated',
          classes: 'bg-[#EAF8F5] text-[#0A6E62] border-[#B2E5DF]',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-[#0A6E62]" />,
        };
      case 'APPROVED':
        return {
          label: isRo ? '5. Aprobare Umană' : isFa ? '۵. تأیید انسانی' : '5. Approved',
          classes: 'bg-[#F0F4F8] text-[#102A43] border-[#102A43]/40 font-bold',
          icon: <UserCheck className="w-3.5 h-3.5 text-[#102A43]" />,
        };
      case 'POSTED':
        return {
          label: isRo ? '6. Înregistrat în Jurnal' : isFa ? '۶. ثبت در دفتر' : '6. Posted',
          classes: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
          icon: <FileCheck className="w-3.5 h-3.5 text-[#065F46]" />,
        };
      case 'PAID':
        return {
          label: isRo ? '7. Plătit & Reconciliat' : isFa ? '۷. پرداخت شد' : '7. Paid',
          classes: 'bg-[#ECFDF5] text-[#065F46] border-[#10B981]/40',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#065F46]" />,
        };
      default:
        return {
          label: state,
          classes: 'bg-[#F0F4F8] text-[#52667A] border-[#D3DCE6]',
          icon: <Clock className="w-3.5 h-3.5" />,
        };
    }
  };

  // Bill Type Icon & Color Mapping
  const getBillTypeIcon = (type: BillType) => {
    switch (type) {
      case 'ELECTRICITY':
        return <Zap className="w-4 h-4 text-[#92400E]" />;
      case 'WATER':
        return <Droplets className="w-4 h-4 text-[#1E40AF]" />;
      case 'GAS':
        return <Flame className="w-4 h-4 text-[#991B1B]" />;
      case 'WASTE':
        return <Trash2 className="w-4 h-4 text-[#065F46]" />;
      case 'MAINTENANCE_CONTRACT':
        return <Wrench className="w-4 h-4 text-[#102A43]" />;
      default:
        return <FileText className="w-4 h-4 text-[#52667A]" />;
    }
  };

  // Format currency display (RON)
  const formatRON = (amount: number) => {
    if (isFa) {
      const formatted = new Intl.NumberFormat('fa-IR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
      return `${formatted} لئو`;
    }
    return `${new Intl.NumberFormat('ro-RO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)} RON`;
  };

  // Format Percentage
  const formatPercent = (val: number) => {
    if (isFa) {
      return `${new Intl.NumberFormat('fa-IR').format(val)}٪`;
    }
    return `${val}%`;
  };

  // KPI Metrics Calculation
  const kpiMetrics = useMemo(() => {
    const totalCount = bills.length;
    const pendingReviewCount = bills.filter(b => b.workflowState === 'EXTRACTED' || b.workflowState === 'MATCHED' || b.workflowState === 'VALIDATED').length;
    const exceptionsCount = bills.filter(b => b.exceptions && b.exceptions.length > 0).length;
    const readyForPaymentAmount = bills
      .filter(b => b.workflowState === 'APPROVED' || b.workflowState === 'POSTED')
      .reduce((sum, b) => sum + b.totalAmount, 0);

    return {
      totalCount,
      pendingReviewCount,
      exceptionsCount,
      readyForPaymentAmount,
    };
  }, [bills]);

  // Handle Human Approval Gate Execution
  const handleExecuteApproval = () => {
    if (!activeBill) return;
    setBills(prev =>
      prev.map(b => {
        if (b.id === activeBill.id) {
          const newEvent: WorkflowEvent = {
            state: 'APPROVED',
            actor: 'Elena Popescu',
            actorRole: 'Property Manager (Authorized Sign-Off)',
            timestamp: new Date().toISOString(),
            evidence: 'Human Approval Token #HA-2026-98124 issued.',
            auditId: `AUD-${Date.now()}`,
            comment: 'Authorized property manager inspected meter index, tariff, and tenant allocation split.',
          };
          return {
            ...b,
            workflowState: 'APPROVED',
            exceptions: b.exceptions?.filter(e => e.severity !== 'HIGH'),
            workflowHistory: [...(b.workflowHistory || []), newEvent],
          };
        }
        return b;
      })
    );
    setIsConfirmModalOpen(false);
    setActionSuccessMessage(
      isRo
        ? `Factura ${activeBill.invoiceNumber} a fost aprobată cu succes de operatorul uman autorizat.`
        : isFa
        ? `صورت‌حساب ${activeBill.invoiceNumber} با موفقیت توسط کاربر مجاز انسانی تأیید گردید.`
        : `Invoice ${activeBill.invoiceNumber} successfully approved by authorized human sign-off.`
    );
  };

  // Handle Post to General Ledger
  const handleExecutePost = () => {
    if (!activeBill) return;
    setBills(prev =>
      prev.map(b => {
        if (b.id === activeBill.id) {
          const newEvent: WorkflowEvent = {
            state: 'POSTED',
            actor: 'Elena Popescu',
            actorRole: 'Property Manager (Authorized Sign-Off)',
            timestamp: new Date().toISOString(),
            evidence: `Supplemental double-entry posting generated on account ${b.accountingCode}`,
            auditId: `AUD-${Date.now()}`,
          };
          return {
            ...b,
            workflowState: 'POSTED',
            journalId: `JRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            workflowHistory: [...(b.workflowHistory || []), newEvent],
          };
        }
        return b;
      })
    );
    setIsConfirmModalOpen(false);
    setActionSuccessMessage(
      isRo
        ? `Factura ${activeBill.invoiceNumber} a fost înregistrată în registrele statutare și jurnalul analitic suplimentar.`
        : isFa
        ? `صورت‌حساب ${activeBill.invoiceNumber} در دفاتر قانونی و دفتر کل تحلیلی تکمیلی ثبت شد.`
        : `Invoice ${activeBill.invoiceNumber} posted to statutory books and supplemental analytical ledger.`
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn text-start">
      {/* 1. Header & AI Safety Boundary Banner */}
      <div className="card-proptech p-5 bg-[#EAF8F5] border-[#B2E5DF] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-[#0A6E62] text-white shadow-sm shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#0A6E62] border border-[#B2E5DF]">
                {dict.utilityBills.workspaceTag}
              </span>
              <span className="text-xs text-[#52667A] font-mono">
                {PRODUCT_METRICS.managerWorkspaces} {dict.utilityBills.workspacesLabel} • {PRODUCT_METRICS.totalBaseScreens} {dict.utilityBills.screensLabel} • {PRODUCT_METRICS.totalResponsiveBaseViews} {dict.utilityBills.viewsLabel}
              </span>
            </div>
            <p className="text-sm font-bold text-[#0A6E62] mt-1">
              {isRo
                ? 'AI sugerează; un operator uman autorizat verifică și confirmă.'
                : isFa
                ? 'هوش مصنوعی پیشنهاد می‌دهد؛ کاربر انسانی مجاز بررسی و تأیید نهایی را انجام می‌دهد.'
                : 'AI suggests; an authorized human reviews and confirms.'}
            </p>
          </div>
        </div>

        {/* Conceptual Intake Channels */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#52667A] mr-1">{isRo ? 'Canale Recepție:' : isFa ? 'درگاه‌های دریافت:' : 'Intake:'}</span>
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-xl bg-white hover:bg-[#F0F4F8] text-[#102A43] font-semibold border border-[#D3DCE6] inline-flex items-center gap-1.5 shadow-sm transition-all"
            title="e-Factura XML (Simulare / Demo)"
          >
            <Zap className="w-3.5 h-3.5 text-[#1E40AF]" />
            <span>e-Factura (Simulare)</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-xl bg-white hover:bg-[#F0F4F8] text-[#102A43] font-semibold border border-[#D3DCE6] inline-flex items-center gap-1.5 shadow-sm transition-all"
            title="Dedicated Inbound Email"
          >
            <Mail className="w-3.5 h-3.5 text-[#065F46]" />
            <span>Email</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-xl bg-white hover:bg-[#F0F4F8] text-[#102A43] font-semibold border border-[#D3DCE6] inline-flex items-center gap-1.5 shadow-sm transition-all"
            title="PDF / Image OCR Upload"
          >
            <Upload className="w-3.5 h-3.5 text-[#92400E]" />
            <span>PDF/OCR</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-xl bg-white hover:bg-[#F0F4F8] text-[#102A43] font-semibold border border-[#D3DCE6] inline-flex items-center gap-1.5 shadow-sm transition-all"
            title="CSV Batch Import"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#102A43]" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-xl bg-white hover:bg-[#F0F4F8] text-[#102A43] font-semibold border border-[#D3DCE6] inline-flex items-center gap-1.5 shadow-sm transition-all"
            title="REST API EDI"
          >
            <Cpu className="w-3.5 h-3.5 text-[#0A6E62]" />
            <span>API</span>
          </button>
        </div>
      </div>

      {/* Success Alert if Action Performed */}
      {actionSuccessMessage && (
        <div className="card-proptech p-4 bg-[#ECFDF5] border-[#A7F3D0] flex items-center justify-between gap-3 text-[#065F46] text-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#065F46] shrink-0" />
            <span className="font-semibold">{actionSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMessage(null)}
            className="p-1 text-[#065F46] hover:text-[#047857]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. 4 Operational KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pending Review */}
        <div className="card-proptech p-5 bg-white border-[#E2E8F0] space-y-2 hover:border-[#B2E5DF] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
              {isRo ? 'În Așteptare Revizuire' : isFa ? 'در انتظار بررسی' : 'Pending Review'}
            </span>
            <span className="p-2 rounded-xl bg-[#EDF5FF] text-[#1E40AF]">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-display font-extrabold text-[#102A43] tabular-nums">
            {kpiMetrics.pendingReviewCount} {isRo ? 'facturi' : isFa ? 'صورت‌حساب' : 'invoices'}
          </div>
          <p className="text-xs text-[#52667A]">
            {isRo ? 'Necesită validare reguli sau semnare umană' : isFa ? 'نیازمند بررسی قواعد یا تأیید انسانی' : 'Awaiting automated rules or human approval'}
          </p>
        </div>

        {/* KPI 2: Active Policy Exceptions */}
        <div className="card-proptech p-5 bg-white border-[#E2E8F0] space-y-2 hover:border-[#FCE3AA] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#92400E] uppercase tracking-wider">
              {isRo ? 'Excepții Active' : isFa ? 'مغایرت‌های فعال' : 'Active Exceptions'}
            </span>
            <span className="p-2 rounded-xl bg-[#FFF7E6] text-[#92400E]">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-display font-extrabold text-[#102A43] tabular-nums">
            {kpiMetrics.exceptionsCount} {isRo ? 'anomalii' : isFa ? 'مغایرت' : 'anomalies'}
          </div>
          <p className="text-xs text-[#52667A]">
            {isRo ? 'Nepotriviri de index, depășire tarif sau OCR scăzut' : isFa ? 'مغایرت کنتور، اختلاف تعرفه یا اطمینان پایین' : 'Meter mismatches, tariff variance, or low OCR'}
          </p>
        </div>

        {/* KPI 3: Ready for Payment / Posted */}
        <div className="card-proptech p-5 bg-white border-[#E2E8F0] space-y-2 hover:border-[#B2E5DF] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#0A6E62] uppercase tracking-wider">
              {isRo ? 'Gata de Plată / Înregistrat' : isFa ? 'آماده پرداخت / ثبت‌شده' : 'Ready for Payment'}
            </span>
            <span className="p-2 rounded-xl bg-[#EAF8F5] text-[#0A6E62]">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-display font-extrabold text-[#102A43] tabular-nums">
            {formatRON(kpiMetrics.readyForPaymentAmount)}
          </div>
          <p className="text-xs text-[#52667A]">
            {isRo ? 'Semnate de manager și trimise spre trezorerie' : isFa ? 'تأییدشده توسط مدیر و آماده تسویه بانکی' : 'Approved by manager and ready for bank settlement'}
          </p>
        </div>

        {/* KPI 4: Total Queue Count */}
        <div className="card-proptech p-5 bg-white border-[#E2E8F0] space-y-2 hover:border-[#B2E5DF] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
              {isRo ? 'Volum Total Coadă' : isFa ? 'کل اسناد دوره' : 'Total Queue'}
            </span>
            <span className="p-2 rounded-xl bg-[#F0F4F8] text-[#102A43]">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-display font-extrabold text-[#102A43] tabular-nums">
            {kpiMetrics.totalCount} {isRo ? 'înregistrări' : isFa ? 'سند' : 'records'}
          </div>
          <p className="text-xs text-[#52667A]">
            {isRo ? 'Toate cele 7 stări de procesare reprezentate' : isFa ? 'شامل تمامی ۷ وضعیت گردش‌کار' : 'All 7 workflow states covered deterministically'}
          </p>
        </div>
      </div>

      {/* 3. Filter Surface across 7 Dimensions */}
      <div className="card-proptech p-5 bg-white border-[#E2E8F0] space-y-4">
        {/* Filter Controls Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#0A6E62]" />
            <span className="text-xs font-bold text-[#102A43] uppercase tracking-wider">
              {isRo ? 'Filtre Avansate Facturi (7 Dimensiuni):' : isFa ? 'فیلترهای پیشرفته اسناد (۷ بعد):' : 'Advanced Bill Filters (7 Dimensions):'}
            </span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF8F5] text-[#0A6E62] border border-[#B2E5DF]">
                {activeFiltersCount} {isRo ? 'active' : isFa ? 'فعال' : 'active'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Exceptions Only Toggle Button */}
            <button
              type="button"
              onClick={() => setFilterExceptionsOnly(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                filterExceptionsOnly
                  ? 'bg-[#FFF7E6] text-[#92400E] border border-[#F5B942]'
                  : 'bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#52667A] border border-[#D3DCE6]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{isRo ? 'Doar Excepții' : isFa ? 'فقط مغایرت‌ها' : 'Exceptions Only'}</span>
            </button>

            {/* Clear / Reset Filters */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold border border-[#D3DCE6] flex items-center gap-1 transition-all"
                title="Reset all filters to default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isRo ? 'Resetează' : isFa ? 'پاک‌کردن فیلترها' : 'Clear Filters'}</span>
              </button>
            )}

            {/* Mobile Bottom Sheet Trigger Button (Visible on Small Screens) */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="md:hidden px-3 py-1.5 rounded-xl bg-[#0A6E62] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isRo ? 'Filtre Mobile' : isFa ? 'فیلترهای پیشرفته' : 'Filter Drawer'}</span>
            </button>
          </div>
        </div>

        {/* 7 Filter Dropdowns Grid (Desktop / Tablet) */}
        <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-xs">
          {/* Dim 1: Bill Type */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
              {isRo ? '1. Tip Utilitate' : isFa ? '۱. نوع انشعاب' : '1. Bill Type'}
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-white border border-[#D3DCE6] rounded-xl px-2.5 py-1.5 text-xs text-[#102A43] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A6E62]"
            >
              <option value="ALL">{isRo ? 'Toate tipurile' : isFa ? 'همه انشعابات' : 'All Types'}</option>
              <option value="ELECTRICITY">{isRo ? 'Electricitate' : isFa ? 'برق' : 'Electricity'}</option>
              <option value="WATER">{isRo ? 'Apă & Canal' : isFa ? 'آب و فاضلاب' : 'Water & Sewage'}</option>
              <option value="GAS">{isRo ? 'Gaze Naturale' : isFa ? 'گاز طبیعی' : 'Natural Gas'}</option>
              <option value="WASTE">{isRo ? 'Salubrizare' : isFa ? 'مدیریت پسماند' : 'Waste'}</option>
              <option value="MAINTENANCE_CONTRACT">{isRo ? 'Mentenanță & Ascensor' : isFa ? 'قرارداد نگهداری و آسانسور' : 'Maintenance'}</option>
            </select>
          </div>

          {/* Dim 2: Building */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
              {isRo ? '2. Clădire / Imobil' : isFa ? '۲. ساختمان' : '2. Building'}
            </label>
            <select
              value={selectedBuilding}
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setSelectedUnit('ALL'); // Reset unit constraint
              }}
              className="w-full bg-white border border-[#D3DCE6] rounded-xl px-2.5 py-1.5 text-xs text-[#102A43] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A6E62]"
            >
              <option value="ALL">{isRo ? 'Toate clădirile' : isFa ? 'همه ساختمان‌ها' : 'All Buildings'}</option>
              {availableBuildings.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Dim 3: Unit (Dynamically Constrained by Building) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
              {isRo ? '3. Spațiu / Unitate' : isFa ? '۳. واحد / مشاعات' : '3. Unit'}
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full bg-white border border-[#D3DCE6] rounded-xl px-2.5 py-1.5 text-xs text-[#102A43] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A6E62]"
            >
              <option value="ALL">{isRo ? 'Toate unitățile' : isFa ? 'همه واحدها' : 'All Units'}</option>
              {availableUnits.map(u => (
                <option key={u} value={u}>{formatUnitName(u)}</option>
              ))}
            </select>
          </div>

          {/* Dim 4: Supplier */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
              {isRo ? '4. Furnizor Utilități' : isFa ? '۴. تأمین‌کننده' : '4. Supplier'}
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full bg-white border border-[#D3DCE6] rounded-xl px-2.5 py-1.5 text-xs text-[#102A43] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A6E62]"
            >
              <option value="ALL">{isRo ? 'Toți furnizorii' : isFa ? 'همه شرکت‌ها' : 'All Suppliers'}</option>
              {availableSuppliers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Dim 5: Billing Period */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
              {isRo ? '5. Perioadă Facturare' : isFa ? '۵. دوره صورت‌حساب' : '5. Period'}
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full bg-white border border-[#D3DCE6] rounded-xl px-2.5 py-1.5 text-xs text-[#102A43] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A6E62]"
            >
              <option value="ALL">{isRo ? 'Toate perioadele' : isFa ? 'همه دوره‌ها' : 'All Periods'}</option>
              {availablePeriods.map(p => (
                <option key={p} value={p}>{formatPeriodLabel(p)}</option>
              ))}
            </select>
          </div>

          {/* Dim 6: Due Date Range */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
              {isRo ? '6. Scadență Plată' : isFa ? '۶. مهلت پرداخت' : '6. Due Date'}
            </label>
            <select
              value={selectedDueDateFilter}
              onChange={(e) => setSelectedDueDateFilter(e.target.value)}
              className="w-full bg-white border border-[#D3DCE6] rounded-xl px-2.5 py-1.5 text-xs text-[#102A43] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A6E62]"
            >
              <option value="ALL">{isRo ? 'Oricând' : isFa ? 'همه زمان‌ها' : 'All Due Dates'}</option>
              <option value="URGENT">{isRo ? 'Urgent (< 7 zile)' : isFa ? 'فوری (کمتر از ۷ روز)' : 'Urgent (< 7 days)'}</option>
              <option value="OVERDUE">{isRo ? 'Depășit / Restant' : isFa ? 'سررسید گذشته' : 'Overdue'}</option>
            </select>
          </div>

          {/* Dim 7: Workflow State */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
              {isRo ? '7. Stare Workflow' : isFa ? '۷. وضعیت گردش‌کار' : '7. State'}
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full bg-white border border-[#D3DCE6] rounded-xl px-2.5 py-1.5 text-xs text-[#102A43] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A6E62]"
            >
              <option value="ALL">{isRo ? 'Toate stările (1-7)' : isFa ? 'همه وضعیت‌ها (۱-۷)' : 'All States (1-7)'}</option>
              <option value="RECEIVED">{isRo ? '1. Recepționat' : isFa ? '۱. دریافت شد' : '1. Received'}</option>
              <option value="EXTRACTED">{isRo ? '2. Extras OCR' : isFa ? '۲. استخراج OCR' : '2. Extracted'}</option>
              <option value="MATCHED">{isRo ? '3. Reconciliat Contor' : isFa ? '۳. تطبیق کنتور' : '3. Matched'}</option>
              <option value="VALIDATED">{isRo ? '4. Validat' : isFa ? '۴. اعتبارسنجی شد' : '4. Validated'}</option>
              <option value="APPROVED">{isRo ? '5. Aprobare Umană' : isFa ? '۵. تأیید انسانی' : '5. Approved'}</option>
              <option value="POSTED">{isRo ? '6. Înregistrat în Jurnal' : isFa ? '۶. ثبت دفتر' : '6. Posted'}</option>
              <option value="PAID">{isRo ? '7. Plătit' : isFa ? '۷. پرداخت شد' : '7. Paid'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Main Two-Column Layout: Queue on Left, Full Detail Surface on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Invoice Queue (Desktop Table & Mobile Card List) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#102A43] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0A6E62]" />
              <span>{isRo ? 'Coadă Facturi Utilități' : isFa ? 'صف پردازش قبوض' : 'Utility Invoice Queue'}</span>
              <span className="text-xs text-[#52667A] font-mono">({filteredBills.length})</span>
            </h2>
            <span className="text-[11px] text-[#52667A] font-mono">
              {isRo ? 'Selectează pentru detalii' : isFa ? 'جهت مشاهده انتخاب کنید' : 'Click to inspect'}
            </span>
          </div>

          {/* Desktop / Tablet Table View (Hidden on Mobile) */}
          <div className="hidden md:block card-proptech bg-white border-[#E2E8F0] overflow-hidden">
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead className="bg-[#F6F9FC] border-b border-[#E2E8F0] text-[#52667A] font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-start">{isRo ? 'Factură & Furnizor' : isFa ? 'صورت‌حساب و شرکت' : 'Invoice & Supplier'}</th>
                    <th className="p-3 text-start">{isRo ? 'Clădire / Unitate' : isFa ? 'ساختمان / واحد' : 'Building / Unit'}</th>
                    <th className="p-3 text-end">{isRo ? 'Total (RON)' : isFa ? 'مبلغ (لئو)' : 'Total (RON)'}</th>
                    <th className="p-3 text-center">{isRo ? 'Stare' : isFa ? 'وضعیت' : 'State'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredBills.map((b) => {
                    const isSelected = activeBill?.id === b.id;
                    const badge = getStatusBadge(b.workflowState);
                    const hasExceptions = b.exceptions && b.exceptions.length > 0;

                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBillId(b.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#EAF8F5]/60 border-l-4 border-l-[#0A6E62] rtl:border-l-0 rtl:border-r-4 rtl:border-r-[#0A6E62]'
                            : 'hover:bg-[#F6F9FC]'
                        }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-[#F0F4F8]">
                              {getBillTypeIcon(b.billType)}
                            </span>
                            <div>
                              <div className="font-bold text-[#102A43]">{b.invoiceNumber}</div>
                              <div className="text-[11px] text-[#52667A]">{b.supplierName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-[#52667A]">
                          <div className="font-medium text-[#102A43]">{b.buildingName}</div>
                          <div className="text-[11px] text-[#52667A]">{formatUnitName(b.unitNumber)}</div>
                        </td>
                        <td className="p-3 text-end font-mono font-bold text-[#102A43] tabular-nums">
                          {formatRON(b.totalAmount)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.classes}`}>
                              {badge.icon}
                              <span>{badge.label}</span>
                            </span>
                            {hasExceptions && (
                              <span className="text-[10px] text-[#92400E] font-bold inline-flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{b.exceptions!.length} {isRo ? 'anomalii' : isFa ? 'مغایرت' : 'issues'}</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View (Visible only on Small Screens) */}
          <div className="md:hidden space-y-3">
            {filteredBills.map((b) => {
              const isSelected = activeBill?.id === b.id;
              const badge = getStatusBadge(b.workflowState);
              const hasExceptions = b.exceptions && b.exceptions.length > 0;

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBillId(b.id)}
                  className={`card-proptech p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#EAF8F5]/60 border-[#0A6E62] ring-2 ring-[#0A6E62]'
                      : 'bg-white border-[#E2E8F0] hover:border-[#B2E5DF]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-[#F0F4F8]">
                        {getBillTypeIcon(b.billType)}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-[#102A43]">{b.invoiceNumber}</div>
                        <div className="text-xs text-[#52667A]">{b.supplierName}</div>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.classes}`}>
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs font-mono">
                    <div className="text-[#52667A]">
                      <span>{b.buildingName}</span> • <span className="text-[#52667A]">{formatUnitName(b.unitNumber)}</span>
                    </div>
                    <div className="font-bold text-[#102A43] text-sm tabular-nums">
                      {formatRON(b.totalAmount)}
                    </div>
                  </div>

                  {hasExceptions && (
                    <div className="mt-2 text-[11px] text-[#92400E] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{b.exceptions!.length} {isRo ? 'anomalii detectate' : isFa ? 'مغایرت شناسایی‌شده' : 'exceptions flagged'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Complete Detail Surface & Verification Actions */}
        <div className="lg:col-span-7 space-y-6">
          {activeBill ? (
            <div className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-6">

              {/* Detail Header with Supplier & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
                      {activeBill.buildingName} • {formatUnitName(activeBill.unitNumber)}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(activeBill.workflowState).classes}`}>
                      {getStatusBadge(activeBill.workflowState).icon}
                      <span>{getStatusBadge(activeBill.workflowState).label}</span>
                    </span>
                  </div>
                  <h3 className="text-2xl font-display font-extrabold text-[#102A43]">
                    {activeBill.supplierName} ({activeBill.invoiceNumber})
                  </h3>
                  <div className="text-xs text-[#52667A] font-mono flex flex-wrap gap-4">
                    <span>{isRo ? 'Emis:' : isFa ? 'تاریخ صدور:' : 'Issued:'} <strong className="text-[#102A43]">{activeBill.issueDate}</strong></span>
                    <span>{isRo ? 'Scadență:' : isFa ? 'مهلت پرداخت:' : 'Due:'} <strong className="text-[#0A6E62]">{activeBill.dueDate}</strong></span>
                    <span>{isRo ? 'Perioadă:' : isFa ? 'دوره:' : 'Period:'} <strong className="text-[#102A43]">{formatPeriodLabel(activeBill.billingPeriod)}</strong></span>
                  </div>
                </div>

                {/* Primary Human Confirmation & Action Buttons (Strict Contrast >= 4.5:1) */}
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {activeBill.workflowState !== 'APPROVED' && activeBill.workflowState !== 'POSTED' && activeBill.workflowState !== 'PAID' && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmActionType('APPROVE');
                        setIsConfirmModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{isRo ? 'Aprobare Umană Autorizată' : isFa ? 'بررسی و تأیید نهایی انسانی' : 'Human Review & Approve'}</span>
                    </button>
                  )}

                  {activeBill.workflowState === 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmActionType('POST');
                        setIsConfirmModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>{isRo ? 'Înregistrează în Jurnal' : isFa ? 'ثبت در دفتر کل دوبل' : 'Post to Ledger'}</span>
                    </button>
                  )}

                  {activeBill.journalId && (
                    <div className="px-3 py-1.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-mono font-bold">
                      Journal: {activeBill.journalId}
                    </div>
                  )}
                </div>
              </div>

              {/* Source Document vs Extracted Data Tabs */}
              <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2">
                <button
                  type="button"
                  onClick={() => setDetailActiveTab('EXTRACTED')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    detailActiveTab === 'EXTRACTED'
                      ? 'bg-[#0A6E62] text-white shadow-sm'
                      : 'bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#52667A]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isRo ? 'Date Extrase & Reconciliere' : isFa ? 'داده‌های استخراج‌شده و تطبیق' : 'Extracted Data & Reconciliation'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailActiveTab('DOCUMENT')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    detailActiveTab === 'DOCUMENT'
                      ? 'bg-[#0A6E62] text-white shadow-sm'
                      : 'bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#52667A]'
                  }`}
                >
                  <FileImage className="w-3.5 h-3.5" />
                  <span>{isRo ? 'Document Sursă (PDF/Scan)' : isFa ? 'سند اصلی (PDF / اسکن)' : 'Source Document (PDF/Scan)'}</span>
                </button>
              </div>

              {/* Tab 1: Extracted Structured Data, Meters, & Allocation Rules */}
              {detailActiveTab === 'EXTRACTED' && (
                <div className="space-y-6">
                  {/* Financial Overview Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1">
                      <span className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
                        {isRo ? 'Sumă Totală de Plată' : isFa ? 'مبلغ کل پرداختی' : 'Total Amount Due'}
                      </span>
                      <div className="text-xl font-display font-extrabold text-[#102A43] font-mono tabular-nums">
                        {formatRON(activeBill.totalAmount)}
                      </div>
                      <div className="text-[11px] text-[#52667A]">
                        {isRo ? 'Bază Impozabilă:' : isFa ? 'پایه مالیاتی:' : 'Base Amount:'} {formatRON(activeBill.netAmount)}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1">
                      <span className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
                        {isRo ? 'Valoare TVA (19%)' : isFa ? 'مالیات بر ارزش افزوده' : 'VAT / Tax Amount'}
                      </span>
                      <div className="text-xl font-display font-extrabold text-[#102A43] font-mono tabular-nums">
                        {formatRON(activeBill.vatAmount)}
                      </div>
                      <div className="text-[11px] text-[#52667A]">
                        {isRo ? 'CUI Furnizor:' : isFa ? 'شناسه ملی:' : 'Fiscal ID:'} {activeBill.supplierTaxId}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1">
                      <span className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">
                        {isRo ? 'Scor Încredere OCR' : isFa ? 'ضریب اطمینان OCR' : 'OCR Confidence'}
                      </span>
                      <div className="text-xl font-display font-extrabold text-[#065F46] font-mono tabular-nums">
                        {formatPercent(activeBill.extractionConfidence)}
                      </div>
                      <div className="text-[11px] text-[#52667A]">
                        {isRo ? 'Canal:' : isFa ? 'درگاه:' : 'Channel:'} {activeBill.intakeSource}
                      </div>
                    </div>
                  </div>

                  {/* Meter Matching & Consumption Section */}
                  {activeBill.meterSerialNumber && (
                    <div className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-[#0A6E62]" />
                          <span className="text-xs font-bold text-[#102A43] uppercase tracking-wider">
                            {isRo ? 'Reconciliere Contor & Consum Fizic' : isFa ? 'تطبیق شاخص کنتور و مصرف شبکه' : 'Meter & Consumption Reconciliation'}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white text-[#102A43] border border-[#D3DCE6]">
                          {activeBill.meterSerialNumber}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                          <span className="text-[#52667A] block text-[10px]">{isRo ? 'Index Vechi' : isFa ? 'شاخص قبل' : 'Start Reading'}</span>
                          <strong className="text-[#102A43] text-sm tabular-nums">{activeBill.startMeterReading}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                          <span className="text-[#52667A] block text-[10px]">{isRo ? 'Index Nou' : isFa ? 'شاخص فعلی' : 'End Reading'}</span>
                          <strong className="text-[#102A43] text-sm tabular-nums">{activeBill.endMeterReading}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                          <span className="text-[#52667A] block text-[10px]">{isRo ? 'Consum Calculat' : isFa ? 'مصرف کل' : 'Consumption'}</span>
                          <strong className="text-[#0A6E62] text-sm tabular-nums">{activeBill.calculatedConsumption} {activeBill.consumptionUnit || 'kWh'}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                          <span className="text-[#52667A] block text-[10px]">{isRo ? 'Tarif Contract' : isFa ? 'نرخ تعرفه' : 'Unit Rate'}</span>
                          <strong className="text-[#102A43] text-sm tabular-nums">{activeBill.activeTariffRate} RON/{activeBill.consumptionUnit || 'kWh'}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Allocation & Accounting Rule Section */}
                  <div className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#0A6E62]" />
                      <span className="text-xs font-bold text-[#102A43] uppercase tracking-wider">
                        {isRo ? 'Regulă de Alocare Statutară & Cont Contabil' : isFa ? 'قاعده تسهیم قانونی و سرفصل حسابداری' : 'Statutory Allocation Rule & Accounting Code'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                        <span className="text-[#52667A]">{isRo ? 'Cont Contabil (Control Analitic):' : isFa ? 'سرفصل حسابداری (کنترل تحلیلی):' : 'Accounting Code (Supplemental GL):'}</span>
                        <span className="font-mono font-bold text-[#102A43]">{activeBill.accountingCode} — {formatAccountName(activeBill.accountingAccountName)}</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                        <span className="text-[#52667A]">{isRo ? 'Regulă Defalcare Legea 196/2018:' : isFa ? 'روش تسهیم قانونی (قانون ۱۹۶):' : 'Statutory Rule:'}</span>
                        <span className="font-semibold text-[#102A43]">{formatAllocationRuleName(activeBill.ownerTenantSplit?.allocationRuleName)}</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#E2E8F0]">
                        <span className="text-[#52667A]">{isRo ? 'Responsabilitate Proprietar / Chiriaș:' : isFa ? 'سهم مالک / مستأجر:' : 'Owner / Tenant Responsibility:'}</span>
                        <span className="font-mono font-bold text-[#065F46]">
                          {formatPercent(activeBill.ownerTenantSplit?.ownerPercent || 0)} {isRo ? 'Proprietar' : isFa ? 'مالک' : 'Owner'} / {formatPercent(activeBill.ownerTenantSplit?.tenantPercent || 100)} {isRo ? 'Chiriaș' : isFa ? 'مستأجر' : 'Tenant'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Policy Exceptions Inspector */}
                  {activeBill.exceptions && activeBill.exceptions.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#92400E]" />
                        <span className="text-xs font-bold text-[#92400E] uppercase tracking-wider">
                          {isRo ? 'Excepții & Anomalii de Politică Financiară' : isFa ? 'مغایرت‌ها و هشدارهای سیاست مالی' : 'Policy Exceptions & Variance'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {activeBill.exceptions.map((ex) => (
                          <div
                            key={ex.id}
                            className={`p-4 rounded-xl border text-xs space-y-2 ${
                              ex.severity === 'HIGH'
                                ? 'bg-[#FFF0EB] border-[#FF7A59] text-[#102A43]'
                                : 'bg-[#FFF7E6] border-[#F5B942] text-[#102A43]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5">
                                <AlertOctagon className={`w-4 h-4 ${ex.severity === 'HIGH' ? 'text-[#991B1B]' : 'text-[#92400E]'}`} />
                                <span>{ex.label}</span>
                              </span>
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white text-[#102A43] border border-[#D3DCE6]">
                                {ex.code} • {ex.severity}
                              </span>
                            </div>

                            <p className="text-xs text-[#52667A]">{ex.explanation}</p>

                            <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                              <span className="text-[#52667A]">
                                <strong>Evidence:</strong> {ex.evidence}
                              </span>
                              <span className="text-[#0A6E62] font-semibold">
                                <strong>Action:</strong> {ex.recommendedAction}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audit Trail Timeline */}
                  {activeBill.workflowHistory && activeBill.workflowHistory.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-[#0A6E62]" />
                        <span className="text-xs font-bold text-[#102A43] uppercase tracking-wider">
                          {isRo ? 'Jurnal de Audit & Etape de Semnare' : isFa ? 'زنجیره رویدادها و ممیزی سیستم' : 'Audit Trail & Signature History'}
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3">
                        {activeBill.workflowHistory.map((log: WorkflowEvent) => (
                          <div key={log.auditId} className="text-xs border-b border-[#E2E8F0] last:border-b-0 pb-2.5 last:pb-0 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#102A43]">{log.state}</span>
                              <span className="font-mono text-[10px] text-[#52667A]">{log.timestamp}</span>
                            </div>
                            <div className="text-[#52667A]">
                              <strong>{log.actor}</strong> <span className="text-[#52667A]">({log.actorRole})</span>
                            </div>
                            <p className="text-[#52667A] text-[11px]">{log.evidence}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Original Source Document / PDF Inspection Surface */}
              {detailActiveTab === 'DOCUMENT' && (
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-4 text-center">
                    <div className="p-4 rounded-full bg-white text-[#0A6E62] border border-[#E2E8F0] w-16 h-16 mx-auto flex items-center justify-center shadow-sm">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[#102A43]">
                        {activeBill.originalDocumentName || 'factura_originala_scanata.pdf'}
                      </h4>
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                          Simulare / Demo • Date fictive • No production SPV connection
                        </span>
                      </div>
                      <p className="text-xs text-[#52667A] mt-2">
                        {isRo
                          ? 'Document demonstrativ (Simulare XML / Date fictive / Fără conexiune SPV de producție).'
                          : isFa
                          ? 'سند نمونه ساختاریافته (شبیه‌سازی XML / داده‌های آزمایشی / بدون اتصال پروداکشن به سامانه).'
                          : 'Demo document (XML Simulation / Fictitious data / No production SPV connection).'}
                      </p>
                    </div>

                    <div className="max-w-md mx-auto p-4 rounded-xl bg-white border border-[#E2E8F0] text-xs font-mono text-start space-y-1">
                      <div>File Name: <strong className="text-[#102A43]">{activeBill.originalDocumentName || 'factura_enel_octombrie_2026.pdf'}</strong></div>
                      <div>Document Hash (SHA-256): <strong className="text-[#0A6E62]">0x9185dd4759671ed69dca39f17080c84593912134</strong></div>
                      <div>Ingestion Channel: <strong className="text-[#1E40AF]">{activeBill.intakeSource} (Simulation)</strong></div>
                      <div>SPV Message ID (Simulare): <strong className="text-[#065F46]">DEMO-SIM-SPV-RO-2026-991823</strong></div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="card-proptech p-12 bg-white border-[#E2E8F0] text-center space-y-3">
              <FileText className="w-12 h-12 text-[#52667A] mx-auto" />
              <p className="text-sm font-semibold text-[#52667A]">
                {isRo ? 'Selectați o factură din coadă pentru a vizualiza detaliile.' : isFa ? 'جهت مشاهده جزییات، یک صورت‌حساب را انتخاب کنید.' : 'Select an invoice from the queue to view details.'}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* 5. Mobile Filter Bottom Sheet Modal */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="card-proptech w-full max-w-lg bg-white border-t border-[#D3DCE6] rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-fadeIn shadow-elevated">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-[#0A6E62]" />
                <h3 className="text-base font-display font-extrabold text-[#102A43]">
                  {isRo ? 'Filtre Avansate Facturi (7 Dimensiuni)' : isFa ? 'فیلترهای پیشرفته (۷ بعد)' : 'Advanced Bill Filters'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1.5 rounded-full bg-[#F0F4F8] text-[#52667A] hover:text-[#102A43]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Dim 1 */}
              <div>
                <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block mb-1">
                  {isRo ? '1. Tip Utilitate' : isFa ? '۱. نوع انشعاب' : '1. Bill Type'}
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-white border border-[#D3DCE6] rounded-xl px-3 py-2 text-xs text-[#102A43] font-medium"
                >
                  <option value="ALL">{isRo ? 'Toate tipurile' : isFa ? 'همه انشعابات' : 'All Types'}</option>
                  <option value="ELECTRICITY">{isRo ? 'Electricitate' : isFa ? 'برق' : 'Electricity'}</option>
                  <option value="WATER">{isRo ? 'Apă & Canal' : isFa ? 'آب و فاضلاب' : 'Water & Sewage'}</option>
                  <option value="GAS">{isRo ? 'Gaze Naturale' : isFa ? 'گاز طبیعی' : 'Natural Gas'}</option>
                  <option value="WASTE">{isRo ? 'Salubrizare' : isFa ? 'مدیریت پسماند' : 'Waste'}</option>
                  <option value="MAINTENANCE_CONTRACT">{isRo ? 'Mentenanță' : isFa ? 'قرارداد نگهداری' : 'Maintenance'}</option>
                </select>
              </div>

              {/* Dim 2 */}
              <div>
                <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block mb-1">
                  {isRo ? '2. Clădire' : isFa ? '۲. ساختمان' : '2. Building'}
                </label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => {
                    setSelectedBuilding(e.target.value);
                    setSelectedUnit('ALL');
                  }}
                  className="w-full bg-white border border-[#D3DCE6] rounded-xl px-3 py-2 text-xs text-[#102A43] font-medium"
                >
                  <option value="ALL">{isRo ? 'Toate clădirile' : isFa ? 'همه ساختمان‌ها' : 'All Buildings'}</option>
                  {availableBuildings.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Dim 3 */}
              <div>
                <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block mb-1">
                  {isRo ? '3. Unitate / Spațiu' : isFa ? '۳. واحد / مشاعات' : '3. Unit'}
                </label>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="w-full bg-white border border-[#D3DCE6] rounded-xl px-3 py-2 text-xs text-[#102A43] font-medium"
                >
                  <option value="ALL">{isRo ? 'Toate unitățile' : isFa ? 'همه واحدها' : 'All Units'}</option>
                  {availableUnits.map(u => (
                    <option key={u} value={u}>{formatUnitName(u)}</option>
                  ))}
                </select>
              </div>

              {/* Dim 4 */}
              <div>
                <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block mb-1">
                  {isRo ? '4. Furnizor' : isFa ? '۴. شرکت تأمین‌کننده' : '4. Supplier'}
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-white border border-[#D3DCE6] rounded-xl px-3 py-2 text-xs text-[#102A43] font-medium"
                >
                  <option value="ALL">{isRo ? 'Toți furnizorii' : isFa ? 'همه شرکت‌ها' : 'All Suppliers'}</option>
                  {availableSuppliers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Dim 5 */}
              <div>
                <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block mb-1">
                  {isRo ? '5. Perioadă' : isFa ? '۵. دوره' : '5. Period'}
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full bg-white border border-[#D3DCE6] rounded-xl px-3 py-2 text-xs text-[#102A43] font-medium"
                >
                  <option value="ALL">{isRo ? 'Toate perioadele' : isFa ? 'همه دوره‌ها' : 'All Periods'}</option>
                  {availablePeriods.map(p => (
                    <option key={p} value={p}>{formatPeriodLabel(p)}</option>
                  ))}
                </select>
              </div>

              {/* Dim 6 */}
              <div>
                <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block mb-1">
                  {isRo ? '6. Scadență' : isFa ? '۶. مهلت پرداخت' : '6. Due Date'}
                </label>
                <select
                  value={selectedDueDateFilter}
                  onChange={(e) => setSelectedDueDateFilter(e.target.value)}
                  className="w-full bg-white border border-[#D3DCE6] rounded-xl px-3 py-2 text-xs text-[#102A43] font-medium"
                >
                  <option value="ALL">{isRo ? 'Oricând' : isFa ? 'همه زمان‌ها' : 'All Due Dates'}</option>
                  <option value="URGENT">{isRo ? 'Urgent (< 7 zile)' : isFa ? 'فوری (کمتر از ۷ روز)' : 'Urgent (< 7 days)'}</option>
                  <option value="OVERDUE">{isRo ? 'Depășit' : isFa ? 'سررسید گذشته' : 'Overdue'}</option>
                </select>
              </div>

              {/* Dim 7 */}
              <div>
                <label className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block mb-1">
                  {isRo ? '7. Stare' : isFa ? '۷. وضعیت گردش‌کار' : '7. State'}
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full bg-white border border-[#D3DCE6] rounded-xl px-3 py-2 text-xs text-[#102A43] font-medium"
                >
                  <option value="ALL">{isRo ? 'Toate stările (1-7)' : isFa ? 'همه وضعیت‌ها (۱-۷)' : 'All States (1-7)'}</option>
                  <option value="RECEIVED">{isRo ? '1. Recepționat' : isFa ? '۱. دریافت شد' : '1. Received'}</option>
                  <option value="EXTRACTED">{isRo ? '2. Extras OCR' : isFa ? '۲. استخراج OCR' : '2. Extracted'}</option>
                  <option value="MATCHED">{isRo ? '3. Reconciliat' : isFa ? '۳. تطبیق کنتور' : '3. Matched'}</option>
                  <option value="VALIDATED">{isRo ? '4. Validat' : isFa ? '۴. اعتبارسنجی شد' : '4. Validated'}</option>
                  <option value="APPROVED">{isRo ? '5. Aprobare Umană' : isFa ? '۵. تأیید انسانی' : '5. Approved'}</option>
                  <option value="POSTED">{isRo ? '6. Înregistrat' : isFa ? '۶. ثبت دفتر' : '6. Posted'}</option>
                  <option value="PAID">{isRo ? '7. Plătit' : isFa ? '۷. پرداخت شد' : '7. Paid'}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold"
              >
                {isRo ? 'Resetează' : isFa ? 'پاک‌کردن' : 'Reset'}
              </button>
              <button
                type="button"
                onClick={() => setIsMobileFilterOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm"
              >
                {isRo ? 'Aplică Filtrele' : isFa ? 'اعمال فیلترها' : 'Apply Filters'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Human Confirmation Modal Surface (Mandatory 11 Fields & Strict AI Boundary) */}
      {isConfirmModalOpen && activeBill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-proptech max-w-2xl w-full bg-white border-[#D3DCE6] p-6 space-y-5 rounded-2xl shadow-elevated animate-fadeIn text-start">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#0A6E62] text-white shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-extrabold text-[#102A43]">
                    {confirmActionType === 'APPROVE'
                      ? isRo ? 'Aprobare Umană Autorizată Factură Utilități' : isFa ? 'تأیید نهایی کاربر مجاز انسانی' : 'Authorized Human Sign-Off & Expense Approval'
                      : isRo ? 'Confirmare Înregistrare în Registre & Control Analitic' : isFa ? 'تأیید ثبت در دفاتر قانونی و کنترل تحلیلی' : 'Confirm Statutory Posting & Supplemental Ledger'}
                  </h3>
                  <span className="text-xs text-[#52667A] font-mono">Gate 5 Human Responsibility Sign-Off</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="p-1.5 rounded-full bg-[#F0F4F8] text-[#52667A] hover:text-[#102A43]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Boundary Alert Banner */}
            <div className="p-3.5 rounded-xl bg-[#EAF8F5] border border-[#B2E5DF] flex items-start gap-2.5 text-xs text-[#0A6E62]">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#0A6E62]" />
              <p>
                <strong>AI Boundary Notice:</strong>{' '}
                {isRo
                  ? 'AI sugerează; un operator uman autorizat verifică și confirmă. Postările financiare devin efective legal exclusiv după semnătura umană directă.'
                  : isFa
                  ? 'هوش مصنوعی صرفاً نقش پیشنهاددهنده دارد؛ ثبت‌های مالی و تعهدات قانونی تنها پس از تأیید مستقیم کاربر مجاز انسانی نافذ خواهند بود.'
                  : 'AI solely provides suggestions; accounting and financial postings become legally effective only with your authorized human confirmation. AI cannot independently approve, post, or pay.'}
              </p>
            </div>

            {/* Complete 11 Confirmation Parameters Grid */}
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Actor */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#52667A] font-semibold">1. Actor:</span>
                  <strong className="text-[#102A43]">Elena Popescu</strong>
                </div>

                {/* 2. Role */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#52667A] font-semibold">2. Role:</span>
                  <strong className="text-[#102A43]">Property Manager (Authorized Sign-Off)</strong>
                </div>

                {/* 3. Building / Unit Context */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#52667A] font-semibold">3. Context:</span>
                  <strong className="text-[#102A43]">{activeBill.buildingName} • {formatUnitName(activeBill.unitNumber)}</strong>
                </div>

                {/* 4. Supplier */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#52667A] font-semibold">4. Supplier:</span>
                  <strong className="text-[#102A43]">{activeBill.supplierName} ({activeBill.invoiceNumber})</strong>
                </div>

                {/* 5. Amount & Currency */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#52667A] font-semibold">5. Total Amount:</span>
                  <strong className="text-[#0A6E62] font-mono text-sm tabular-nums">{formatRON(activeBill.totalAmount)}</strong>
                </div>

                {/* 6. Accounting Code */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#52667A] font-semibold">6. Account Code:</span>
                  <strong className="text-[#102A43] font-mono">{activeBill.accountingCode} — {formatAccountName(activeBill.accountingAccountName)}</strong>
                </div>

                {/* 7. Allocation Rule */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0] sm:col-span-2">
                  <span className="text-[#52667A] font-semibold">7. Allocation Rule:</span>
                  <strong className="text-[#102A43]">{formatAllocationRuleName(activeBill.ownerTenantSplit?.allocationRuleName)}</strong>
                </div>

                {/* 8. Owner / Tenant Responsibility Split */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0] sm:col-span-2">
                  <span className="text-[#52667A] font-semibold">8. Responsibility Split:</span>
                  <strong className="text-[#065F46] font-mono">
                    {formatPercent(activeBill.ownerTenantSplit?.ownerPercent || 0)} {isRo ? 'Proprietar (0,00 RON)' : isFa ? 'مالک (۰٫۰۰ لئو)' : 'Owner (0.00 RON)'} / {formatPercent(activeBill.ownerTenantSplit?.tenantPercent || 100)} {isRo ? 'Chiriaș (3.420,50 RON)' : isFa ? 'مستأجر (۳۴۲۰٫۵۰ لئو)' : 'Tenant (3,420.50 RON)'}
                  </strong>
                </div>

                {/* 9. Evidence & Source Scan */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#52667A] font-semibold">9. Evidence:</span>
                  <strong className="text-[#1E40AF] font-mono">{activeBill.originalDocumentName || 'factura_enel_octombrie_2026_8849201.pdf'}</strong>
                </div>

                {/* 10. Timestamp */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="text-[#52667A] font-semibold">10. Timestamp:</span>
                  <strong className="text-[#102A43] font-mono">2026-11-04 14:30:00</strong>
                </div>

                {/* 11. Audit ID */}
                <div className="flex justify-between p-2 rounded-lg bg-white border border-[#E2E8F0] sm:col-span-2">
                  <span className="text-[#52667A] font-semibold">11. Audit Token:</span>
                  <strong className="text-[#0A6E62] font-mono">AUD-HA-884921</strong>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold border border-[#D3DCE6] transition-all"
              >
                {isRo ? 'Anulează / Înapoi' : isFa ? 'انصراف / بازگشت' : 'Cancel / Back'}
              </button>

              <button
                type="button"
                onClick={confirmActionType === 'APPROVE' ? handleExecuteApproval : handleExecutePost}
                className="px-5 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {confirmActionType === 'APPROVE'
                    ? isRo ? 'Confirm & Aprobă Factura' : isFa ? 'تأیید و صدور مجوز' : 'Confirm & Authorize Sign-Off'
                    : isRo ? 'Confirm & Înregistrează în Jurnal' : isFa ? 'تأیید و ثبت در دفتر کل' : 'Confirm & Post to Ledger'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
