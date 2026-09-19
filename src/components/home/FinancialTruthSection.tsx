'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  FileSpreadsheet, 
  Scale, 
  RotateCcw, 
  FileCheck2, 
  Receipt,
  Info
} from 'lucide-react';
import { MOCK_CHARGE_BREAKDOWN } from '@/data/mockData';
import { Money } from '@/components/ui/Money';
import { formatPercent } from '@/config/currencies';
import { formatExpenseCategory, formatAllocationMethod } from '@/config/formatters';

import { getDictionary } from '@/dictionaries';

interface FinancialTruthSectionProps {
  lang: Language;
}

export const FinancialTruthSection: React.FC<FinancialTruthSectionProps> = ({ lang }) => {
  const [selectedLine, setSelectedLine] = useState<string>(MOCK_CHARGE_BREAKDOWN[0].id);
  const dict = getDictionary(lang);

  const currentItem = MOCK_CHARGE_BREAKDOWN.find(item => item.id === selectedLine) || MOCK_CHARGE_BREAKDOWN[0];

  return (
    <section className="py-24 bg-white border-b border-[#E2E8F0] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-[#0A6E62] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
            {dict.financialTruth.badge}
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
            {dict.financialTruth.title}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A]">
            {dict.financialTruth.description}
          </p>
        </div>

        {/* 4 Pillars of Financial Truth */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
          
          <div className="card-proptech p-5 space-y-2 border-l-4 border-l-[#102A43]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#102A43]">
              <FileSpreadsheet className="w-4 h-4 text-[#0E9F8E]" />
              <span>{lang === 'ro' ? 'Control Analitic Suplimentar' : lang === 'fa' ? 'کنترل تحلیلی تکمیلی دوطرفه' : 'Supplemental Analytical GL'}</span>
            </div>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Control analitic în partidă dublă (Debit = Credit) ca instrument suplimentar de verificare, fără a înlocui registrele statutare în partidă simplă.'
                : lang === 'fa'
                ? 'دفتر کل تحلیلی تکمیلی (برابری بدهکار و بستانکار) جهت کنترل دقیق تراز، بدون جایگزینی دفاتر قانونی یک‌طرفه.'
                : 'Supplemental analytical double-entry controls (Debit = Credit) providing extra rigor without replacing statutory simple-entry registers.'}
            </p>
          </div>

          <div className="card-proptech p-5 space-y-2 border-l-4 border-l-[#0E9F8E]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#102A43]">
              <Scale className="w-4 h-4 text-[#0E9F8E]" />
              <span>{lang === 'ro' ? 'Alocare Legea 196/2018' : lang === 'fa' ? 'محاسبات منطبق با قوانین' : 'Statutory Allocations'}</span>
            </div>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Calcul CPI automat, contoare individuale, număr de persoane, suprafață sau sume fixe.'
                : lang === 'fa'
                ? 'تسهیم سهم مشاع، مصرف کنتورها، نفرات، متراژ و ارقام ثابت بدون خطای انسانی.'
                : 'Automated CPI share ratio, individual submetering, headcount, square meters, or flat fees.'}
            </p>
          </div>

          <div className="card-proptech p-5 space-y-2 border-l-4 border-l-[#F2C94C]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#102A43]">
              <RotateCcw className="w-4 h-4 text-[#0E9F8E]" />
              <span>{lang === 'ro' ? 'Stornări Auditate' : lang === 'fa' ? 'اسناد اصلاحی قابل‌ردیابی' : 'Traceable Reversals'}</span>
            </div>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Fără suprascrieri secrete în baza de date. Orice ajustare devine o linie nouă de stornare.'
                : lang === 'fa'
                ? 'بدون ویرایش یا حذف پنهانی در پایگاه داده. هرگونه تعدیل در قالب سند اصلاحی ثبت می‌شود.'
                : 'No silent overrides. Every correction produces an explicit reversing journal entry.'}
            </p>
          </div>

          <div className="card-proptech p-5 space-y-2 border-l-4 border-l-[#27AE60]">
            <div className="flex items-center gap-2 text-sm font-bold text-[#102A43]">
              <FileCheck2 className="w-4 h-4 text-[#0E9F8E]" />
              <span>{lang === 'ro' ? 'Închidere Securizată de Lună' : lang === 'fa' ? 'بستن قطعی و امن دوره مالی' : 'Sealed Month-Close'}</span>
            </div>
            <p className="text-xs text-[#52667A] leading-relaxed">
              {lang === 'ro'
                ? 'Blocare perioadă cu semnătură de integritate. Cenzorul și comitetul semnează digital balanța finală.'
                : lang === 'fa'
                ? 'قفل سوابق پس از تراز نهایی. بازرس مالی و هیئت‌مدیره دوره را با امضای دیجیتال تأیید می‌کنند.'
                : 'Period lock with cryptographic hash. Auditors and board members sign off on the sealed balance.'}
            </p>
          </div>

        </div>

        {/* Interactive Charge Breakdown Drill-down */}
        <div className="mt-14 card-proptech p-6 sm:p-8 bg-[#F6F9FC] border-[#D3DCE6]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
            <div>
              <span className="text-xs font-bold text-[#0A6E62] uppercase tracking-wider">
                {lang === 'ro' ? 'Simulare Interactivă Notă de Plată' : lang === 'fa' ? 'شبیه‌ساز تعاملی فیش شارژ ماهانه' : 'Interactive Charge Drill-Down Demo'}
              </span>
              <h3 className="text-xl font-bold text-[#102A43] mt-1">
                {lang === 'ro' 
                  ? 'Cum se descompune o linie de întreținere (Ap. 14 — 78 mp)' 
                  : lang === 'fa'
                  ? 'کالبدشکافی ردیف‌های شارژ ماهانه (واحد ۱۴ — ۷۸ متر مربع)'
                  : 'Deconstruction of a Monthly Statement Line (Apt. 14 — 78 sqm)'}
              </h3>
            </div>
            <div className="text-xs text-[#52667A]">
              {lang === 'ro' ? 'Apasă pe o linie pentru a vedea sursa din spate:' : lang === 'fa' ? 'روی هر ردیف کلیک کنید تا سند منبع را ببینید:' : 'Click a line to drill down into source calculation:'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
            
            {/* Lines List */}
            <div className="lg:col-span-6 space-y-2">
              {MOCK_CHARGE_BREAKDOWN.map((line) => {
                const category = formatExpenseCategory(line.id, line.expenseCategory, lang);
                const method = formatAllocationMethod(line.allocationMethod, lang);

                return (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => setSelectedLine(line.id)}
                    className={`w-full text-start p-4 rounded-xl transition-all border flex items-center justify-between ${
                      selectedLine === line.id
                        ? 'bg-white border-[#0E9F8E] shadow-card ring-1 ring-[#0E9F8E]'
                        : 'bg-white/60 hover:bg-white border-[#E2E8F0]'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold text-[#102A43]">{category}</div>
                      <div className="text-xs text-[#52667A] mt-0.5 font-mono">
                        <span className="ltr-isolate">{line.supplierInvoiceRef}</span> · {lang === 'ro' ? 'Metodă:' : lang === 'fa' ? 'روش:' : 'Method:'} {method}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-sm font-display font-extrabold text-[#102A43]">
                        <Money amount={line.calculatedAmount} currency="RON" locale={lang} />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAF8F5] text-[#0A6E62]">
                        {line.operationalPayer === 'TENANT' 
                          ? (lang === 'ro' ? 'Chiriaș / Consum' : lang === 'fa' ? 'مستأجر / مصرف' : 'Tenant / Use') 
                          : (lang === 'ro' ? 'Proprietar' : lang === 'fa' ? 'مالک واحد' : 'Owner')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Drill-down Detail Panel */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-2xl border border-[#D3DCE6] p-6 space-y-5 shadow-card">
                
                <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#0E9F8E]" />
                    <span className="text-sm font-bold text-[#102A43]">
                      {lang === 'ro' ? 'Fișă Justificativă de Calcul' : lang === 'fa' ? 'برگه اثبات محاسباتی سند' : 'Statutory Allocation Proof'}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-[#52667A]">ID: <span className="ltr-isolate">{currentItem.id}</span></span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between p-3 rounded-lg bg-[#F6F9FC]">
                    <span className="text-[#52667A]">
                      {lang === 'ro' ? 'Factură Furnizor Sursă:' : lang === 'fa' ? 'فاکتور مرجع تأمین‌کننده:' : 'Source Supplier Invoice:'}
                    </span>
                    <span className="font-bold text-[#102A43] font-mono ltr-isolate">{currentItem.supplierInvoiceRef}</span>
                  </div>

                  <div className="flex justify-between p-3 rounded-lg bg-[#F6F9FC]">
                    <span className="text-[#52667A]">
                      {lang === 'ro' ? 'Total Factură Asociație:' : lang === 'fa' ? 'مجموع فاکتور کل ساختمان:' : 'Total Association Invoice:'}
                    </span>
                    <span className="font-bold text-[#102A43]">
                      <Money amount={currentItem.totalInvoiceAmount} currency="RON" locale={lang} />
                    </span>
                  </div>

                  <div className="flex justify-between p-3 rounded-lg bg-[#F6F9FC]">
                    <span className="text-[#52667A]">
                      {lang === 'ro' ? 'Cota Parte / Bază de Calcul Ap. 14:' : lang === 'fa' ? 'سهم مشاع واحد ۱۴:' : 'Share Ratio for Unit 14:'}
                    </span>
                    <span className="font-bold text-[#0A6E62]">
                      {formatPercent(currentItem.unitSharePercent, lang, 2)}
                    </span>
                  </div>

                  <div className="flex justify-between p-3 rounded-lg bg-[#EAF8F5] border border-[#B2E5DF]">
                    <span className="font-bold text-[#0A6E62]">
                      {lang === 'ro' ? 'Sumă Datorată de Apartament:' : lang === 'fa' ? 'مبلغ سهم محاسبه‌شده واحد:' : 'Calculated Share Due:'}
                    </span>
                    <span className="font-extrabold text-[#0A6E62] text-sm">
                      <Money amount={currentItem.calculatedAmount} currency="RON" locale={lang} />
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FFF7E6] border border-[#FDE68A] flex items-start gap-2.5 text-xs text-[#92400E]">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                  <span>
                    {lang === 'ro'
                      ? 'Conform Legea 196/2018: Debitorul legal în fața asociației rămâne proprietarul, dar CLADORA separă automat costul operațional pentru decontarea cu chiriașul.'
                      : lang === 'fa'
                      ? 'یادداشت قانونی: مدیون رسمی در برابر انجمن مالکان همواره مالک واحد است؛ کلادورا سهم مصارف روزمره را جهت تسویه آسان با مستأجر به‌طور خودکار تفکیک می‌کند.'
                      : 'Statutory Note: The legal debtor to the association is the unit owner; CLADORA isolates operational charges for tenant settlement.'}
                  </span>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
