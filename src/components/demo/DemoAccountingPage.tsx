'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  FileSpreadsheet, 
  RotateCcw, 
  Search, 
  Filter, 
  CheckCircle2, 
  Lock,
  Plus
} from 'lucide-react';
import { useDemoStore } from '@/data/demoStore';
import { Money } from '@/components/ui/Money';
import { formatNumber } from '@/config/currencies';
import { getStatusLabel, EntityStatus } from '@/config/statuses';

export default function AccountingPage(props: { params: Promise<{ lang: Language }>; demoMode?: boolean }) {
  const params = use(props.params);
  const { lang } = params;
  const appBase = `/${lang}/${props.demoMode ? 'demo/app' : 'app'}`;
  const { journalEntries } = useDemoStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = journalEntries.filter(entry => 
    entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.documentRef.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      <div className="card-proptech p-6 bg-white border-[#D3DCE6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
            {lang === 'ro'
              ? 'Nucleul C01 — Simulare Registre Statutare & Control Analitic Suplimentar'
              : lang === 'fa'
              ? 'هسته C01 — شبیه‌سازی دفاتر قانونی و کنترل تحلیلی تکمیلی'
              : 'Core C01 — Simulated Statutory Registers & Supplemental Analytical Ledger'}
          </div>
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold">
              {lang === 'ro' ? 'Mediu Demonstrativ • Date de Simulare' : lang === 'fa' ? 'محیط آزمایشی • داده‌های شبیه‌سازی' : 'Demo Simulation Environment • Fictitious Data'}
            </span>
          </div>
          <h1 className="text-2xl font-display font-extrabold text-[#102A43] mt-1">
            {lang === 'ro' ? 'Simulare Registre Statutare & Control Analitic' : lang === 'fa' ? 'شبیه‌سازی دفاتر قانونی و کنترل تحلیلی' : 'Simulated Registers & Supplemental Ledger'}
          </h1>
          <p className="text-xs text-[#52667A]">
            {lang === 'ro'
              ? 'Simulare registre în partidă simplă conform Legii 196/2018 · Control analitic suplimentar în partidă dublă'
              : lang === 'fa'
              ? 'شبیه‌سازی دفاتر قانونی یک‌طرفه بر اساس قانون ۱۹۶/۲۰۱۸ · کنترل‌های تحلیلی تکمیلی دوطرفه'
              : 'Simulated simple-entry records under Law 196/2018 · Supplemental analytical double-entry controls'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`${appBase}/accounting/allocations`}
            className="px-4 py-2.5 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold transition-all"
          >
            {lang === 'ro' ? 'Vezi Cote & Alocare CPI' : lang === 'fa' ? 'محاسبه سهام مشاع (CPI)' : 'View CPI Allocations'}
          </Link>
          <Link
            href={`${appBase}/accounting/month-close`}
            className="px-4 py-2.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shadow-sm transition-all"
          >
            {lang === 'ro' ? 'Închidere Lunară' : lang === 'fa' ? 'بستن دوره ماهانه' : 'Month-End Close'}
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-proptech p-4 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#7B8A9A] absolute left-3 rtl:left-auto rtl:right-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'ro' ? 'Caută după furnizor, referință sau cont...' : lang === 'fa' ? 'جست‌وجو بر اساس فاکتور، تأمین‌کننده یا سرفصل حساب...' : 'Search entries...'}
            className="w-full pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]"
          />
        </div>
        <div className="text-xs text-[#52667A] font-medium">
          {lang === 'ro' ? 'Afișare:' : lang === 'fa' ? 'نمایش:' : 'Displaying:'}{' '}
          <strong>{formatNumber(filteredEntries.length, lang)}</strong>{' '}
          {lang === 'ro' ? 'înregistrări contabile' : lang === 'fa' ? 'سند حسابداری' : 'journal entries'}
        </div>
      </div>

      {/* Journal Table */}
      <div className="card-proptech bg-white overflow-x-auto">
        <table className="w-full text-start text-xs border-collapse">
          <thead>
            <tr className="bg-[#F6F9FC] border-b border-[#E2E8F0] text-[#7B8A9A] font-bold uppercase text-[10px] tracking-wider">
              <th className="p-3.5 text-start">{lang === 'ro' ? 'ID & Dată' : lang === 'fa' ? 'شناسه و تاریخ' : 'ID & Date'}</th>
              <th className="p-3.5 text-start">{lang === 'ro' ? 'Referință Document' : lang === 'fa' ? 'شماره سند / فاکتور' : 'Document Ref'}</th>
              <th className="p-3.5 text-start">{lang === 'ro' ? 'Descriere Operațiune' : lang === 'fa' ? 'شرح آرتیکل حسابداری' : 'Description'}</th>
              <th className="p-3.5 text-start">{lang === 'ro' ? 'Cont Debit' : lang === 'fa' ? 'حساب بدهکار' : 'Debit Account'}</th>
              <th className="p-3.5 text-start">{lang === 'ro' ? 'Cont Credit' : lang === 'fa' ? 'حساب بستانکار' : 'Credit Account'}</th>
              <th className="p-3.5 text-end">{lang === 'ro' ? 'Sumă' : lang === 'fa' ? 'مبلغ' : 'Amount'}</th>
              <th className="p-3.5 text-center">{lang === 'ro' ? 'Status' : lang === 'fa' ? 'وضعیت' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F4F8]">
            {filteredEntries.map((entry) => {
              const statusKey: EntityStatus = entry.status === 'POSTED' ? 'completed' : 'pending';
              
              let desc = entry.description;
              let debit = entry.debitAccount;
              let credit = entry.creditAccount;

              if (lang === 'fa') {
                if (entry.id === 'JE-2026-1001') {
                  desc = 'ثبت فاکتور گاز طبیعی موتورخانه - شرکت انژی';
                  debit = '401.01 (بستانکاران / شرکت‌های خدماتی)';
                  credit = '605.02 (هزینه‌های گاز و گرمایش)';
                } else if (entry.id === 'JE-2026-1002') {
                  desc = 'ثبت فاکتور شرکت آب و فاضلاب منطقه ۵';
                  debit = '401.01 (بستانکاران / شرکت‌های خدماتی)';
                  credit = '605.01 (هزینه‌های آب مصرفی)';
                } else if (entry.id === 'JE-2026-1003') {
                  desc = 'وصول شارژ ماهانه از طریق واریز بانکی - واحدهای ۱۴، ۲۲، ۳۸';
                  debit = '5121.01 (حساب جاری بانکی انجمن)';
                  credit = '411.01 (مطالبات شارژ ماهانه مالکان)';
                } else if (entry.id === 'JE-2026-1004') {
                  desc = 'قرارداد سرویس و نگهداری ماهانه آسانسورها - بلوک A و B';
                  debit = '401.02 (پیمانکاران خدمات فنی)';
                  credit = '611.01 (هزینه‌های سرویس آسانسور - سهم مشاع)';
                }
              }

              return (
                <tr key={entry.id} className="hover:bg-[#F6F9FC]/60 transition-colors">
                  <td className="p-3.5 text-start">
                    <div className="font-bold text-[#102A43] font-mono ltr-isolate">{entry.id}</div>
                    <div className="text-[10px] text-[#7B8A9A] font-mono ltr-isolate">{entry.date}</div>
                  </td>
                  <td className="p-3.5 font-mono text-[#52667A] font-bold text-start ltr-isolate">{entry.documentRef}</td>
                  <td className="p-3.5 text-[#102A43] font-medium max-w-xs text-start">{desc}</td>
                  <td className="p-3.5 font-mono text-xs text-[#0A6E62] text-start ltr-isolate">{debit}</td>
                  <td className="p-3.5 font-mono text-xs text-[#173F5F] text-start ltr-isolate">{credit}</td>
                  <td className="p-3.5 text-end font-display font-extrabold text-[#102A43]">
                    <Money amount={entry.amount} currency={entry.currency || 'RON'} locale={lang} />
                  </td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      entry.status === 'POSTED' 
                        ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]' 
                        : 'bg-[#FFF7E6] text-[#B45309] border border-[#FDE68A]'
                    }`}>
                      {getStatusLabel(statusKey, lang)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}

