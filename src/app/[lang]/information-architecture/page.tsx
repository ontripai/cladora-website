import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { PRODUCT_METRICS } from '@/config/product-metrics';
import {
  Network,
  Layers,
  FileText,
  Scale,
  Droplets,
  CreditCard,
  FileCheck,
  ShieldCheck,
  Database,
  ArrowRight,
  Sparkles,
  Zap,
  Mail,
  Upload,
  FileSpreadsheet,
  Cpu
} from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/information-architecture', params.lang);
}

export default async function InformationArchitecturePage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = await props.params;
  const dict = getDictionary(params.lang);
  const lang = params.lang;
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  const intakeChannels = [
    { name: 'e-Factura XML (Simulare)', type: 'Format RO e-Factura XML UBL 2.1 (Simulare / Pre-integrare)', icon: Zap, color: 'text-[#1E40AF]' },
    { name: 'Dedicated Inbound Email', type: 'MIME Parser & PDF Attachment', icon: Mail, color: 'text-[#065F46]' },
    { name: 'PDF & Image Upload', type: 'Direct UI Multi-file Ingestion', icon: Upload, color: 'text-[#92400E]' },
    { name: 'Batch CSV Ingestion', type: 'Standardized Structured Import', icon: FileSpreadsheet, color: 'text-[#102A43]' },
    { name: 'REST API & EDI', type: 'Vendor Webhook Pipeline', icon: Cpu, color: 'text-[#0A6E62]' },
    { name: 'Automated OCR Service', type: 'Neural Text & Table Extraction', icon: FileText, color: 'text-[#102A43]' },
  ];

  const m25Relationships = [
    { title: 'Core Accounting', code: 'C01 / 605.xx / 611.xx', desc: 'Direct general ledger posting with statutory expense allocation accounts.', icon: Scale },
    { title: 'Metering & Sub-metering', code: 'C08 / Radio & Photo OCR', desc: 'Bi-directional index reconciliation and anomalous variance detection.', icon: Droplets },
    { title: 'Treasury & Bank Sync', code: 'C02 / Payment Orders', desc: 'Supplier IBAN verification and batch wire transfer dispatch.', icon: CreditCard },
    { title: 'Month-End Close', code: 'C03 / Quota Sheets', desc: 'CPI indivisible quota generation per Law 196/2018 regulations.', icon: FileCheck },
    { title: 'Audit Vault', code: 'C07 / Immutable Logs', desc: 'Full timestamped traceability of human approvals and OCR extraction tokens.', icon: ShieldCheck },
    { title: 'Vendor Registry', code: 'C09 / Master Contracts', desc: 'Active contract rate verification, fiscal ID check, and utility agreements.', icon: Database },
  ];

  return (
    <div className="pt-28 pb-24 space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-start">
      {/* Header Card */}
      <div className="card-proptech p-6 sm:p-8 bg-white border-[#E2E8F0] space-y-3 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EAF8F5] border border-[#B2E5DF] text-xs font-bold text-[#0A6E62]">
          <Network className="w-3.5 h-3.5 text-[#0A6E62]" />
          <span>System Architecture & Taxonomy</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
          {isRo ? 'Arhitectura Informațională CLADORA' : isFa ? 'معماری اطلاعات و ساختار ماژول‌ها' : 'CLADORA Information Architecture'}
        </h1>
        <p className="text-sm text-[#52667A] max-w-2xl mx-auto">
          {isRo
            ? 'Topologia structurală a modulelor, maparea fluxurilor financiare și ierarhia spațiilor de lucru.'
            : isFa
            ? 'ساختار سلسله‌مراتبی ماژول‌ها، نقشه‌های ارتباطی و گردش داده‌های مالی در سیستم کلادورا.'
            : 'Structural hierarchy, financial flow mapping, and workspace relationships across the platform.'}
        </p>
      </div>

      {/* Verified System Metrics Banner */}
      <div className="card-proptech p-5 bg-white border-[#E2E8F0] grid grid-cols-2 sm:grid-cols-5 gap-4 text-center font-mono">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">{dict.metrics.productionModules}</span>
          <strong className="text-2xl font-extrabold text-[#0A6E62]">{PRODUCT_METRICS.productionModules}</strong>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">{dict.metrics.totalBaseScreens}</span>
          <strong className="text-2xl font-extrabold text-[#1E40AF]">{PRODUCT_METRICS.totalBaseScreens}</strong>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">{dict.metrics.totalResponsiveBaseViews}</span>
          <strong className="text-2xl font-extrabold text-[#065F46]">{PRODUCT_METRICS.totalResponsiveBaseViews}</strong>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">{dict.metrics.prototypeJourneys}</span>
          <strong className="text-2xl font-extrabold text-[#92400E]">{PRODUCT_METRICS.prototypeJourneys}</strong>
        </div>
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-[#52667A] uppercase tracking-wider block">{dict.metrics.userTestingTasks}</span>
          <strong className="text-2xl font-extrabold text-[#102A43]">{PRODUCT_METRICS.userTestingTasks}</strong>
        </div>
      </div>

      {/* Highlighted M25 Placement in IA */}
      <div className="card-proptech p-6 sm:p-8 bg-white border-[#E2E8F0] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                Module M25 Added
              </span>
              <span className="text-xs text-[#52667A] font-mono">Taxonomy: Manager OS → Finance → M25</span>
            </div>
            <h2 className="text-xl font-display font-extrabold text-[#102A43] mt-1">
              {isRo ? 'Modulul M25: Facturi Utilități & Procesare Inteligentă' : isFa ? 'ماژول M25: قبوض انرژی و هوش پردازش' : 'Module M25: Utility Bills & Invoice Intelligence'}
            </h2>
          </div>

          <Link
            href={`/${lang}/ui/manager/utility-bills`}
            className="px-4 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm inline-flex items-center gap-2 transition-all self-start sm:self-auto"
          >
            <span>{isRo ? 'Deschide Workspace M25' : isFa ? 'مشاهده ماژول M25' : 'Open M25 Workspace'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 6 Intake Channels Row */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
            {isRo ? 'Cele 6 Canale de Ingestie a Facturilor:' : isFa ? '۶ درگاه دریافت و ورود اسناد:' : 'Six Document Intake Channels:'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {intakeChannels.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.name} className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
                    <Icon className={`w-5 h-5 ${c.color}`} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#102A43]">{c.name}</div>
                    <div className="text-[11px] text-[#52667A]">{c.type}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6 Core Inter-Module Relationships */}
        <div className="space-y-3 pt-4 border-t border-[#E2E8F0]">
          <h3 className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
            {isRo ? 'Relațiile Structurale ale Modulului M25:' : isFa ? 'ارتباطات ساختاری و تبادل داده ماژول M25:' : 'Six Core Inter-Module Relationships:'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {m25Relationships.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.title} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-white border border-[#E2E8F0] text-[#0A6E62]">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-white text-[#52667A] border border-[#D3DCE6]">
                      {r.code}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[#102A43]">{r.title}</h4>
                  <p className="text-[11px] text-[#52667A] leading-relaxed">{r.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
