'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { PRODUCT_METRICS } from '@/config/product-metrics';
import {
  CheckSquare,
  Clock,
  Target,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Sparkles,
  Zap,
  RotateCcw
} from 'lucide-react';

export default function UserTestingPage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = use(props.params);
  const lang = params.lang;
  const dict = getDictionary(params.lang);
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  const [activeTaskId, setActiveTaskId] = useState<string>('UT-04');
  const [taskCompleted, setTaskCompleted] = useState<boolean>(false);
  const [selectedException, setSelectedException] = useState<string | null>(null);

  const tasks = [
    {
      id: 'UT-01',
      role: isRo ? 'Administrator Asociație' : isFa ? 'مدیر ساختمان' : 'Association Admin',
      title: isRo ? 'Sarcina 1: Închidere de Lună & Transmitere Liste de Plată' : isFa ? 'وظیفه ۱: بستن دوره ماهانه و صدور لیست شارژ' : 'Task 1: Month-Close & Quota Statement Generation',
      targetSuccess: '90%',
      targetTime: '180s',
      errorTolerance: '0 Critical',
    },
    {
      id: 'UT-02',
      role: isRo ? 'Proprietar Rezident' : isFa ? 'مالک مقیم' : 'Resident Owner',
      title: isRo ? 'Sarcina 2: Citire Foto OCR Contor Apă & Plată Cotă' : isFa ? 'وظیفه ۲: ثبت عکس کنتور آب و پرداخت شارژ' : 'Task 2: Photo OCR Meter Submission & Quota Payment',
      targetSuccess: '95%',
      targetTime: '120s',
      errorTolerance: '0 Critical',
    },
    {
      id: 'UT-03',
      role: isRo ? 'Chiriaș' : isFa ? 'مستأجر' : 'Tenant',
      title: isRo ? 'Sarcina 3: Verificare Defalcare Cheltuieli & Notificare Mentenanță' : isFa ? 'وظیفه ۳: بررسی تفکیک هزینه‌ها و ثبت تیکت فنی' : 'Task 3: Cost Separation Inspection & Maintenance Ticket',
      targetSuccess: '92%',
      targetTime: '90s',
      errorTolerance: '0 Critical',
    },
    {
      id: 'UT-04',
      role: isRo ? 'Manager de Proprietate (M25)' : isFa ? 'مدیر املاک و انشعابات (M25)' : 'Property Manager (M25)',
      title: isRo ? 'Sarcina 4: Verificare Factură Utilități, Detecție Nepotriviri & Aprobare (M25)' : isFa ? 'وظیفه ۴: بررسی قبض انرژی، شناسایی مغایرت کنتور و تأیید نهایی (M25)' : 'Task 4: Utility Bill Inspection, Discrepancy Detection & Posting (M25)',
      targetSuccess: '≥ 85%',
      targetTime: '≤ 240s',
      errorTolerance: '0 Critical',
      isNew: true,
    },
  ];

  return (
    <div className="pt-28 pb-24 space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-start">
      {/* Header Card */}
      <div className="card-proptech p-6 sm:p-8 bg-white border-[#E2E8F0] space-y-3 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EAF8F5] border border-[#B2E5DF] text-xs font-bold text-[#0A6E62]">
          <CheckSquare className="w-3.5 h-3.5 text-[#0A6E62]" />
          <span>UX Research & Validation Tasks</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[#102A43] tracking-tight">
          {isRo ? 'Sarcini de Testare cu Utilizatorii' : isFa ? 'سناریوهای آزمون و اعتبارسنجی کاربر' : 'User Testing & UX Validation'}
        </h1>
        <p className="text-sm text-[#52667A] max-w-2xl mx-auto">
          {isRo
            ? 'Protocoale structurate de testare calitativă și cantitativă pentru validarea fluxurilor operaționale (Total: 4 Sarcini).'
            : isFa
            ? 'پروتکل‌های ساختاریافته ارزیابی تجربه کاربری جهت اعتبارسنجی گردش‌کارهای کلیدی (مجموع: ۴ وظیفه).'
            : 'Structured usability testing protocols and live simulation sandboxes across personas (Total: 4 Tasks).'}
        </p>
      </div>

      {/* Metrics Banner */}
      <div className="card-proptech p-4 bg-white border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#52667A]">
        <div>{dict.metrics.userTestingTasks}: <strong className="text-[#0A6E62]">{PRODUCT_METRICS.userTestingTasks}</strong></div>
        <div>{dict.metrics.prototypeJourneys}: <strong className="text-[#1E40AF]">{PRODUCT_METRICS.prototypeJourneys}</strong></div>
        <div>{dict.metrics.managerWorkspaces}: <strong className="text-[#065F46]">{PRODUCT_METRICS.managerWorkspaces}</strong></div>
      </div>

      {/* Task Selector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTaskId(t.id);
              setTaskCompleted(false);
              setSelectedException(null);
            }}
            className={`card-proptech p-5 text-start transition-all flex flex-col justify-between ${
              activeTaskId === t.id
                ? 'bg-[#EAF8F5]/50 border-[#0A6E62] ring-2 ring-[#0A6E62] shadow-sm'
                : 'bg-white border-[#E2E8F0] hover:border-[#B2E5DF]'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F0F4F8] text-[#102A43] border border-[#D3DCE6]">
                  {t.id}
                </span>
                {t.isNew && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                    NEW M25
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-[#0A6E62] block">{t.role}</span>
              <h3 className="text-xs font-bold text-[#102A43] leading-snug">{t.title}</h3>
            </div>

            <div className="mt-4 pt-3 border-t border-[#E2E8F0] grid grid-cols-2 gap-2 text-[11px] font-mono text-[#52667A]">
              <div>Target: <strong className="text-[#102A43]">{t.targetSuccess}</strong></div>
              <div>Time: <strong className="text-[#102A43]">{t.targetTime}</strong></div>
            </div>
          </button>
        ))}
      </div>

      {/* Task 4 Active Sandbox View */}
      {activeTaskId === 'UT-04' && (
        <div className="card-proptech p-6 sm:p-8 bg-white border-[#E2E8F0] space-y-8 animate-fadeIn text-start">

          {/* Sandbox Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-0.5 rounded-full bg-[#EAF8F5] text-[#0A6E62] font-mono text-xs font-bold border border-[#B2E5DF]">
                  Task 4 Sandbox • Property Manager Persona
                </span>
              </div>
              <h2 className="text-2xl font-display font-extrabold text-[#102A43] mt-1">
                {isRo
                  ? 'Protocol Testare: Inspecție & Reconciliere Factură Utilități'
                  : isFa
                  ? 'پروتکل آزمون: بررسی و تطبیق صورت‌حساب انرژی'
                  : 'Testing Protocol: Utility Bill Inspection & Reconciliation'}
              </h2>
            </div>

            <Link
              href={`/${lang}/ui/manager/utility-bills`}
              className="px-4 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm inline-flex items-center gap-2 transition-all self-start sm:self-auto"
            >
              <span>{isRo ? 'Deschide Workspace-ul M25' : isFa ? 'ورود به محیط کاری M25' : 'Open M25 Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Scenario & Objective Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
              <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider block">
                {isRo ? '1. Scenariul de Test' : isFa ? '۱. سناریوی آزمون' : '1. Scenario'}
              </span>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {isRo
                  ? 'A sosit factura Enel (3.420,50 RON) pentru Aviației Tower. Sistemul a extras automat consumul de 3.060 kWh, dar există o nepotrivire la indexul de pornire.'
                  : isFa
                  ? 'قبض برق ۳۴۲۰٫۵۰ لئو دریافت شده است. سیستم مصرف ۳۰۶۰ کیلووات را استخراج کرده اما در شاخص اولیه مغایرت وجود دارد.'
                  : 'Enel invoice arrived for Aviației Tower. OCR extracted 3,060 kWh consumption with a meter discrepancy.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
              <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider block">
                {isRo ? '2. Obiectivul Utilizatorului' : isFa ? '۲. هدف کاربر' : '2. Objective'}
              </span>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {isRo
                  ? 'Identificați cauza excepției, inspectați scanarea PDF originală, semnați decizia umană de aprobare și înregistrați în contabilitate.'
                  : isFa
                  ? 'شناسایی علت مغایرت، مشاهده اسکن اصلی، صدور تأیید نهایی انسانی و ثبت سند حسابداری.'
                  : 'Identify exception cause, inspect PDF scan, execute authorized human sign-off, and post to ledger.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
              <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider block">
                {isRo ? '3. Criteriu de Succes' : isFa ? '۳. معیار موفقیت' : '3. Success Metric'}
              </span>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {isRo
                  ? 'Zero erori critice financiare; timpul de decizie sub 240s; confirmarea obligatorie a tuturor celor 11 parametri.'
                  : isFa
                  ? 'عدم وجود خطای بحرانی؛ زمان بررسی زیر ۲۴۰ ثانیه؛ تأیید تمامی ۱۱ مؤلفه قانونی.'
                  : 'Zero critical accounting defects; task duration ≤ 240s; mandatory human sign-off verified.'}
              </p>
            </div>
          </div>

          {/* Interactive Sandbox Steps */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#102A43] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0A6E62]" />
              <span>{isRo ? 'Simulare Interactivă Pas-cu-Pas (Sandbox)' : isFa ? 'شبیه‌سازی تعاملی گام‌به‌گام' : 'Step-by-Step Interactive Sandbox'}</span>
            </h3>

            <div className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <span className="text-xs font-bold text-[#0A6E62] font-mono">STEP 1 / 3: EXCEPTION DISCOVERY</span>
                  <div className="text-sm font-bold text-[#102A43]">
                    {isRo ? 'Inspectați excepția detectată de sistem:' : isFa ? 'مغایرت شناسایی‌شده توسط سیستم را بررسی کنید:' : 'Inspect system-detected anomaly:'}
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFF7E6] text-[#92400E] border border-[#F5B942]">
                  EXC-UB-05 • Meter Index Discrepancy
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedException('CORRECT')}
                  className={`p-4 rounded-xl border text-start transition-all space-y-1 ${
                    selectedException === 'CORRECT'
                      ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46] ring-2 ring-[#10B981]'
                      : 'bg-white border-[#E2E8F0] text-[#52667A] hover:border-[#B2E5DF]'
                  }`}
                >
                  <div className="font-bold text-[#102A43]">
                    Option A: {isRo ? 'Corectează Indexul din Scanarea Originală' : isFa ? 'اصلاح شاخص از روی اسکن اصلی' : 'Correct Index from Original Scan'}
                  </div>
                  <div className="text-[11px] text-[#52667A]">
                    {isRo ? 'Verifică fișierul demonstrativ al furnizorului și actualizează indexul de pornire la 124.200 kWh.' : isFa ? 'شاخص اولیه با رقم اسکن تطبیق و اصلاح شد.' : 'Matches verified meter series from simulated supplier invoice scan.'}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedException('REJECT')}
                  className={`p-4 rounded-xl border text-start transition-all space-y-1 ${
                    selectedException === 'REJECT'
                      ? 'bg-[#FFF0EB] border-[#FF7A59] text-[#991B1B] ring-2 ring-[#FF7A59]'
                      : 'bg-white border-[#E2E8F0] text-[#52667A] hover:border-[#B2E5DF]'
                  }`}
                >
                  <div className="font-bold text-[#102A43]">
                    Option B: {isRo ? 'Respinge Factura & Solicită Stornare Furnizor' : isFa ? 'رد صورت‌حساب و درخواست صدور فاکتور اصلاحی' : 'Reject Bill & Request Supplier Credit Note'}
                  </div>
                  <div className="text-[11px] text-[#52667A]">
                    {isRo ? 'Marchează factura ca disputată și trimite notificare automată către Enel.' : isFa ? 'صورت‌حساب در وضعیت مغایرت معلق و گزارش به تأمین‌کننده ارسال شد.' : 'Flags discrepancy to supplier billing department.'}
                  </div>
                </button>
              </div>

              {selectedException && !taskCompleted && (
                <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-xs text-[#52667A]">
                    {isRo ? 'Decizie selectată. Puteți finaliza sarcina de testare.' : isFa ? 'تصمیم ثبت شد. آماده تکمیل ارزیابی.' : 'Decision recorded. Ready to seal task verification.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTaskCompleted(true)}
                    className="px-5 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isRo ? 'Finalizează Sarcina 4 & Emite Token' : isFa ? 'تکمیل وظیفه ۴ و ثبت نتیجه' : 'Complete Task 4 & Issue Token'}</span>
                  </button>
                </div>
              )}

              {taskCompleted && (
                <div className="p-5 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 text-[#065F46]">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-bold text-sm">
                      {isRo ? 'Sarcina 4 Finalizată cu Succes — 100% Criterii de Aprobare Îndeplinite' : isFa ? 'وظیفه ۴ با موفقیت تکمیل شد — ۱۰۰٪ معیارهای اعتبارسنجی احراز گردید' : 'Task 4 Completed Successfully — 100% Acceptance Criteria Met'}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[#52667A] space-y-1">
                    <div>Validation Token: <strong className="text-[#0A6E62]">UT-TASK-04-VAL-88492</strong></div>
                    <div>Recorded Time: <strong className="text-[#102A43]">42.5s (Target ≤ 240s)</strong></div>
                    <div>Critical Defects: <strong className="text-[#065F46]">0 Critical</strong></div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Non-M25 Tasks Informational Box */}
      {activeTaskId !== 'UT-04' && (
        <div className="card-proptech p-8 bg-white border-[#E2E8F0] text-center space-y-4">
          <h3 className="text-xl font-display font-extrabold text-[#102A43]">{tasks.find(t => t.id === activeTaskId)?.title}</h3>
          <p className="text-sm text-[#52667A] max-w-xl mx-auto">
            {isRo ? 'Protocol standard de cercetare UX disponibil pentru testare.' : isFa ? 'پروتکل استاندارد ارزیابی کاربر در دسترس است.' : 'Standard UX research testing sandbox ready for evaluation.'}
          </p>
          <div className="pt-4">
            <button
              type="button"
              onClick={() => setActiveTaskId('UT-04')}
              className="px-5 py-2.5 rounded-xl bg-[#0A6E62] hover:bg-[#08544B] text-white text-xs font-bold shadow-sm inline-flex items-center gap-2"
            >
              <span>{isRo ? 'Comută la Sarcina 4 (M25 Utility Bills)' : isFa ? 'تغییر به وظیفه ۴ (M25 قبوض)' : 'Switch to Task 4 (M25 Utility Bills)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
