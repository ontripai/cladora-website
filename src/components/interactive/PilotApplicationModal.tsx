'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { Sparkles, CheckCircle2, Send, ShieldCheck, X, AlertCircle, Loader2 } from 'lucide-react';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { trackEvent, getUnitsBucket } from '@/lib/analytics/events';
import { PILOT_WORKSPACE_TYPES, pilotWorkspaceTypes, type PilotWorkspaceType } from '@/lib/pilot/workspace-types';

interface PilotApplicationModalProps {
  lang: Language;
  isOpen?: boolean;
  onClose?: () => void;
}

const BUILDING_TYPE_OPTIONS: Record<Language, Array<{ value: string; label: string }>> = {
  ro: [
    { value: 'A1', label: 'A1 — Bloc Standard Urban (40-120 apt)' },
    { value: 'A2', label: 'A2 — Complex Rezidențial Nou (120+ apt)' },
    { value: 'A3', label: 'A3 — Imobil Istoric / Interbelic' },
    { value: 'A4', label: 'A4 — Ansamblu Mixt Rezidențial-Comercial' },
    { value: 'A5', label: 'A5 — Ansamblu de Vile / Comunitate Închisă' },
    { value: 'A6', label: 'A6 — Bloc P+4 Reabilitat Termic' },
    { value: 'A7', label: 'A7 — Turn Rezidențial (10+ etaje)' },
  ],
  en: [
    { value: 'A1', label: 'A1 — Standard Urban Block (40-120 apts)' },
    { value: 'A2', label: 'A2 — New Residential Complex (120+ apts)' },
    { value: 'A3', label: 'A3 — Historic / Interwar Building' },
    { value: 'A4', label: 'A4 — Mixed Residential-Commercial Complex' },
    { value: 'A5', label: 'A5 — Gated Villa Community' },
    { value: 'A6', label: 'A6 — Thermally Retrofitted P+4 Block' },
    { value: 'A7', label: 'A7 — High-Rise Residential Tower (10+ floors)' },
  ],
  fa: [
    { value: 'A1', label: 'A1 — بلوک شهری استاندارد (۴۰ تا ۱۲۰ واحد)' },
    { value: 'A2', label: 'A2 — مجتمع مسکونی نوساز (بیش از ۱۲۰ واحد)' },
    { value: 'A3', label: 'A3 — ساختمان کلاسیک / تاریخی' },
    { value: 'A4', label: 'A4 — مجتمع ترکیبی مسکونی-تجاری' },
    { value: 'A5', label: 'A5 — شهرک ویلایی / مجتمع محصور' },
    { value: 'A6', label: 'A6 — ساختمان ۴ طبقه بازسازی حرارتی‌شده' },
    { value: 'A7', label: 'A7 — برج مسکونی (۱۰ طبقه به بالا)' },
  ],
};

export const PilotApplicationModal: React.FC<PilotApplicationModalProps> = ({
  lang,
  isOpen = true,
  onClose,
}) => {
  const dict = getDictionary(lang);
  const fields = dict.pilot.fields;
  const formTitle = dict.pilot.formTitle;
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined;

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'admin',
    applicantType: 'association',
    workspaceType: 'residential' as PilotWorkspaceType,
    workspaceSubtype: 'block',
    workspaceCount: '1',
    workspaceDescription: '',
    relatedBuildings: '',
    buildingType: 'A1',
    unitsCount: '',
    currentSoftware: '',
    city: lang === 'ro' ? 'București' : lang === 'fa' ? 'بخارست' : 'Bucharest',
    county: lang === 'ro' ? 'Sector 1' : lang === 'fa' ? 'منطقه ۱' : 'Sector 1',
    message: '',
  });

  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Accessibility: Focus trap & Escape key listener
  useEffect(() => {
    if (!isOpen || !onClose) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStart = () => {
    trackEvent('pilot_form_started', { locale: lang, sourcePage: '/pilot', formType: 'pilot' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;

    if (!consentPrivacy) {
      setErrorMessage(
        lang === 'ro'
          ? 'Consimțământul privind Politica de confidențialitate este obligatoriu.'
          : lang === 'fa'
          ? 'تأیید سیاست حفظ حریم خصوصی برای ارسال درخواست الزامی است.'
          : 'Privacy Policy consent is mandatory.'
      );
      setStatus('error');
      statusRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const units = parseInt(formData.unitsCount, 10);
    if (isNaN(units) || units < 1 || units > 10000) {
      setErrorMessage(
        lang === 'ro'
          ? 'Numărul de unități trebuie să fie un număr întreg între 1 și 10.000.'
          : lang === 'fa'
          ? 'تعداد واحدها باید یک عدد صحیح بین ۱ تا ۱۰,۰۰۰ باشد.'
          : 'Units count must be an integer between 1 and 10,000.'
      );
      setStatus('error');
      statusRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/public/pilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          applicantType: formData.applicantType,
          workspaceType: formData.workspaceType,
          workspaceSubtype: formData.workspaceSubtype,
          workspaceCount: Number(formData.workspaceCount),
          workspaceDescription: formData.workspaceDescription || undefined,
          relatedBuildings: formData.workspaceType === 'shared' || formData.applicantType === 'multi_unit_owner' ? formData.relatedBuildings : undefined,
          buildingType: formData.workspaceType === 'residential' && formData.applicantType !== 'multi_unit_owner' ? formData.buildingType : null,
          unitsCount: units,
          currentSoftware: formData.currentSoftware,
          city: formData.city,
          county: formData.county,
          message: formData.message || undefined,
          locale: lang,
          sourcePage: `/${lang}/pilot`,
          consentPrivacy: true,
          honeypot: honeypot || undefined,
          turnstileToken: turnstileToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErrorMessage(
          data.message ||
            (lang === 'ro'
              ? 'A apărut o problemă la înregistrarea cererii. Te rugăm să reîncerci.'
              : lang === 'fa'
              ? 'خطایی در ثبت درخواست رخ داد. لطفاً مجدداً تلاش نمایید.'
              : 'A temporary error occurred while processing your request. Please try again.')
        );
        setStatus('error');
        trackEvent('pilot_form_failed', {
          locale: lang,
          sourcePage: '/pilot',
          formType: 'pilot',
          errorCategory: res.status === 429 ? 'rate_limit' : 'validation',
        });
        statusRef.current?.focus();
        return;
      }

      setReferenceId(data.referenceId);
      setStatus('success');
      trackEvent('pilot_form_submitted', {
        locale: lang,
        sourcePage: '/pilot',
        formType: 'pilot',
        selectedRole: formData.role,
        unitsBucket: getUnitsBucket(units),
      });
      statusRef.current?.focus();
    } catch {
      setErrorMessage(
        lang === 'ro'
          ? 'Eroare de conexiune. Te rugăm să verifici rețeaua și să reîncerci.'
          : lang === 'fa'
          ? 'خطای ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی و دوباره تلاش کنید.'
          : 'Network error. Please check your connection and try again.'
      );
      setStatus('error');
      trackEvent('pilot_form_failed', {
        locale: lang,
        sourcePage: '/pilot',
        formType: 'pilot',
        errorCategory: 'network',
      });
      statusRef.current?.focus();
    }
  };

  const handleReset = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      role: 'admin',
      applicantType: 'association',
      workspaceType: 'residential',
      workspaceSubtype: 'block',
      workspaceCount: '1',
      workspaceDescription: '',
      relatedBuildings: '',
      buildingType: 'A1',
      unitsCount: '',
      currentSoftware: '',
      city: '',
      county: '',
      message: '',
    });
    setConsentPrivacy(false);
    setHoneypot('');
    setTurnstileToken(null);
    setReferenceId(null);
    setErrorMessage(null);
    setStatus('idle');
  };

  const content = (
    <div
      ref={modalRef}
      role={onClose ? 'dialog' : undefined}
      aria-modal={onClose ? 'true' : undefined}
      aria-labelledby="pilotModalTitle"
      className="p-6 sm:p-8 rounded-3xl bg-white border border-[#D3DCE6] shadow-elevated relative max-h-[90vh] overflow-y-auto"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === 'ro' ? 'Închide fereastra' : lang === 'fa' ? 'بستن پنجره' : 'Close modal'}
          className="absolute top-4 end-4 p-2 rounded-xl text-[#52667A] hover:bg-[#F0F4F8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#087A6E]"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div ref={statusRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {status === 'success' ? (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 id="pilotModalTitle" className="text-2xl font-display font-bold text-[#102A43]">
              {lang === 'ro'
                ? 'Cererea a fost înregistrată cu succes!'
                : lang === 'fa'
                ? 'درخواست شما با موفقیت ثبت گردید!'
                : 'Application Successfully Received!'}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] max-w-md mx-auto leading-relaxed">
              {fields.successMsg}
            </p>

            {referenceId && (
              <div className="inline-flex flex-col items-center gap-1 p-3 rounded-xl bg-[#F0F4F8] border border-[#D3DCE6]">
                <span className="text-[11px] font-medium text-[#52667A]">
                  {lang === 'ro' ? 'Număr de Înregistrare Pilot' : lang === 'fa' ? 'شناسه رهگیری دوره آزمایشی' : 'Pilot Reference ID'}
                </span>
                <span className="font-mono text-sm font-extrabold text-[#102A43] tracking-wider ltr-isolate">
                  {referenceId}
                </span>
              </div>
            )}

            <div className="pt-4 flex items-center justify-center gap-4">
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#087A6E] text-white text-xs font-bold hover:bg-[#066056] transition-colors"
                >
                  {lang === 'ro' ? 'Închide' : lang === 'fa' ? 'بستن' : 'Close'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-bold text-[#087A6E] hover:underline"
                >
                  {lang === 'ro' ? 'Trimite o altă cerere' : lang === 'fa' ? 'ثبت درخواست جدید' : 'Submit another request'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#0A6E62] uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-[#0A6E62]" />
                <span>{lang === 'ro' ? 'Cohortă Pilot 2026' : lang === 'fa' ? 'دوره پایلوت ۲۰۲۶' : 'Pilot Cohort 2026'}</span>
              </div>
              <h2 id="pilotModalTitle" className="text-xl sm:text-2xl font-display font-extrabold text-[#102A43]">
                {formTitle}
              </h2>
            </div>

            {status === 'error' && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs space-y-1"
              >
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
                  <span>{lang === 'ro' ? 'Verifică formularul' : lang === 'fa' ? 'خطا در ثبت اطلاعات' : 'Validation Error'}</span>
                </div>
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Honeypot field */}
            <div style={{ display: 'none', position: 'absolute', left: '-9999px' }} aria-hidden="true">
              <label htmlFor="company_website">Website</label>
              <input
                type="text"
                id="company_website"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="modalFullName" className="block text-xs font-bold text-[#102A43] mb-1">
                  {fields.fullName} <span className="text-[#E5484D]">*</span>
                </label>
                <input
                  type="text"
                  id="modalFullName"
                  name="fullName"
                  autoComplete="name"
                  required
                  disabled={status === 'submitting'}
                  placeholder={lang === 'ro' ? 'Ex. Ing. Mihai Popescu' : lang === 'fa' ? 'مثال: مهندس احسان کریمی' : 'e.g. John Doe'}
                  value={formData.fullName}
                  onFocus={handleStart}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
                />
              </div>

              <div>
                <label htmlFor="modalEmail" className="block text-xs font-bold text-[#102A43] mb-1">
                  {fields.email} <span className="text-[#E5484D]">*</span>
                </label>
                <input
                  type="email"
                  id="modalEmail"
                  name="email"
                  autoComplete="email"
                  required
                  disabled={status === 'submitting'}
                  placeholder="contact@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="modalPhone" className="block text-xs font-bold text-[#102A43] mb-1">
                  {fields.phone} <span className="text-[#E5484D]">*</span>
                </label>
                <input
                  type="tel"
                  id="modalPhone"
                  name="phone"
                  autoComplete="tel"
                  required
                  disabled={status === 'submitting'}
                  placeholder={lang === 'ro' ? '07xxxxxxxx' : lang === 'fa' ? '۰۹۱۲xxxxxxx' : '+40 700 000 000'}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
                />
              </div>

              <div>
                <label htmlFor="modalRole" className="block text-xs font-bold text-[#102A43] mb-1">
                  {fields.role}
                </label>
                <select
                  id="modalRole"
                  name="role"
                  disabled={status === 'submitting'}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
                >
                  {formData.applicantType !== 'multi_unit_owner' && <option value="admin">{fields.roles.admin}</option>}
                  {formData.applicantType === 'association' && <option value="president">{fields.roles.president}</option>}
                  {formData.applicantType !== 'multi_unit_owner' && <option value="cenzor">{fields.roles.cenzor}</option>}
                  <option value="owner">{fields.roles.owner}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs font-bold text-[#102A43]">
                {lang === 'ro' ? 'Tipul solicitantului' : lang === 'fa' ? 'نوع متقاضی' : 'Applicant type'}
                <select required value={formData.applicantType} onChange={(e) => setFormData({ ...formData, applicantType: e.target.value, role: e.target.value === 'association' ? formData.role : e.target.value === 'multi_unit_owner' ? 'owner' : 'admin', workspaceCount: e.target.value === 'multi_unit_owner' ? '1' : formData.workspaceCount, relatedBuildings: '' })} disabled={status === 'submitting'} className="mt-1 w-full rounded-xl border border-[#D3DCE6] px-3.5 py-2.5">
                  {(['association', 'management_company', 'owner', 'multi_unit_owner', 'company', 'other'] as const).map((key, i) => <option key={key} value={key}>{({ ro: ['Asociație de proprietari', 'Firmă de administrare', 'Proprietar / investitor', 'Proprietar cu mai multe unități', 'Companie / organizație', 'Alt solicitant'], en: ['Owners association', 'Management company', 'Owner / investor', 'Multi-unit owner', 'Company / organization', 'Other applicant'], fa: ['انجمن مالکان', 'شرکت مدیریت', 'مالک / سرمایه‌گذار', 'مالک چندواحدی', 'شرکت / سازمان', 'سایر متقاضیان'] })[lang][i]}</option>)}
                </select>
              </label>
              {formData.applicantType !== 'multi_unit_owner' && <label className="block text-xs font-bold text-[#102A43]">
                {lang === 'ro' ? 'Număr de spații de lucru solicitate' : lang === 'fa' ? 'تعداد ورک‌اسپیس‌های درخواستی' : 'Requested workspaces'}
                <input type="number" required min={1} max={1000} value={formData.workspaceCount} onChange={(e) => setFormData({ ...formData, workspaceCount: e.target.value })} disabled={status === 'submitting'} className="mt-1 w-full rounded-xl border border-[#D3DCE6] px-3.5 py-2.5" />
              </label>}
              <label className="block text-xs font-bold text-[#102A43]">
                {formData.applicantType === 'multi_unit_owner' ? lang === 'ro' ? 'Tipul predominant al unităților' : lang === 'fa' ? 'نوع غالب واحدها' : 'Predominant unit type' : lang === 'ro' ? 'Tipul spațiului principal' : lang === 'fa' ? 'نوع ورک‌اسپیس اصلی' : 'Primary workspace type'}
                <select required value={formData.workspaceType} onChange={(e) => {
                  const type = e.target.value as PilotWorkspaceType;
                  setFormData({ ...formData, workspaceType: type, workspaceSubtype: type === 'other' ? '' : Object.keys(PILOT_WORKSPACE_TYPES[type].subtypes)[0], buildingType: 'A1', unitsCount: '' });
                }} disabled={status === 'submitting'} className="mt-1 w-full rounded-xl border border-[#D3DCE6] px-3.5 py-2.5">
                  {pilotWorkspaceTypes.map(type => <option key={type} value={type}>{PILOT_WORKSPACE_TYPES[type][lang]}</option>)}
                </select>
              </label>
              {formData.workspaceType !== 'other' && <label className="block text-xs font-bold text-[#102A43]">
                {lang === 'ro' ? 'Subtipul spațiului principal' : lang === 'fa' ? 'زیرنوع ورک‌اسپیس اصلی' : 'Primary workspace subtype'}
                <select required value={formData.workspaceSubtype} onChange={(e) => setFormData({ ...formData, workspaceSubtype: e.target.value })} disabled={status === 'submitting'} className="mt-1 w-full rounded-xl border border-[#D3DCE6] px-3.5 py-2.5">
                  {Object.entries(PILOT_WORKSPACE_TYPES[formData.workspaceType].subtypes).map(([key, label]) => <option key={key} value={key}>{label[lang]}</option>)}
                </select>
              </label>}
              {(formData.workspaceType === 'other' || formData.workspaceSubtype === 'other') && <label className="block text-xs font-bold text-[#102A43]">
                {lang === 'ro' ? 'Descrieți tipul spațiului' : lang === 'fa' ? 'نوع ورک‌اسپیس را توضیح دهید' : 'Describe the workspace type'}
                <input required maxLength={500} value={formData.workspaceDescription} onChange={(e) => setFormData({ ...formData, workspaceDescription: e.target.value })} disabled={status === 'submitting'} className="mt-1 w-full rounded-xl border border-[#D3DCE6] px-3.5 py-2.5" />
              </label>}
              {(formData.workspaceType === 'shared' || formData.applicantType === 'multi_unit_owner') && <label className="block text-xs font-bold text-[#102A43]">
                {formData.applicantType === 'multi_unit_owner' ? lang === 'ro' ? 'Clădirile în care dețineți unități (opțional)' : lang === 'fa' ? 'ساختمان‌هایی که در آن‌ها واحد دارید (اختیاری)' : 'Buildings containing your units (optional)' : lang === 'ro' ? 'Clădirile care folosesc acest spațiu' : lang === 'fa' ? 'ساختمان‌های استفاده‌کننده از فضای مشترک' : 'Buildings sharing this space'}
                <input required={formData.workspaceType === 'shared'} maxLength={1000} value={formData.relatedBuildings} onChange={(e) => setFormData({ ...formData, relatedBuildings: e.target.value })} disabled={status === 'submitting'} className="mt-1 w-full rounded-xl border border-[#D3DCE6] px-3.5 py-2.5" />
              </label>}
              {formData.workspaceType === 'residential' && formData.applicantType !== 'multi_unit_owner' && <label className="block text-xs font-bold text-[#102A43]">
                {fields.buildingType}
                <select value={formData.buildingType} onChange={(e) => setFormData({ ...formData, buildingType: e.target.value })} disabled={status === 'submitting'} className="mt-1 w-full rounded-xl border border-[#D3DCE6] px-3.5 py-2.5">
                  {BUILDING_TYPE_OPTIONS[lang].map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>}

              <div>
                <label htmlFor="modalUnitsCount" className="block text-xs font-bold text-[#102A43] mb-1">
                  {formData.applicantType === 'multi_unit_owner' ? lang === 'ro' ? 'Numărul unităților pe care le dețineți' : lang === 'fa' ? 'تعداد واحدهایی که مالک آن هستید' : 'Number of units you own' : formData.workspaceType === 'residential' ? fields.unitsCount : lang === 'ro' ? 'Număr estimat de unități sau spații' : lang === 'fa' ? 'تعداد تقریبی واحدها یا فضاها' : 'Estimated units or spaces'} <span className="text-[#E5484D]">*</span>
                </label>
                <input
                  type="number"
                  id="modalUnitsCount"
                  name="unitsCount"
                  required
                  min={1}
                  max={10000}
                  disabled={status === 'submitting'}
                  value={formData.unitsCount}
                  onChange={(e) => setFormData({ ...formData, unitsCount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="modalCity" className="block text-xs font-bold text-[#102A43] mb-1">
                  {lang === 'ro' ? 'Oraș / Localitate' : lang === 'fa' ? 'شهر / منطقه' : 'City / Municipality'}
                </label>
                <input
                  type="text"
                  id="modalCity"
                  name="city"
                  disabled={status === 'submitting'}
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder={lang === 'ro' ? 'București' : lang === 'fa' ? 'بخارست' : 'Bucharest'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
                />
              </div>

              <div>
                <label htmlFor="modalCounty" className="block text-xs font-bold text-[#102A43] mb-1">
                  {lang === 'ro' ? 'Sector / Județ' : lang === 'fa' ? 'ناحیه / استان' : 'District / County'}
                </label>
                <input
                  type="text"
                  id="modalCounty"
                  name="county"
                  disabled={status === 'submitting'}
                  value={formData.county}
                  onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                  placeholder={lang === 'ro' ? 'Sector 1 / Ilfov' : lang === 'fa' ? 'منطقه ۱ / ایلفوف' : 'Sector 1 / Ilfov'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="modalCurrentSoftware" className="block text-xs font-bold text-[#102A43] mb-1">
                {fields.currentSoftware}
              </label>
              <input
                type="text"
                id="modalCurrentSoftware"
                name="currentSoftware"
                disabled={status === 'submitting'}
                value={formData.currentSoftware}
                onChange={(e) => setFormData({ ...formData, currentSoftware: e.target.value })}
                placeholder="Xisoft, BlocManager, Aviziero, Excel..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="modalMessage" className="block text-xs font-bold text-[#102A43] mb-1">
                {Number(formData.workspaceCount) > 1 ? lang === 'ro' ? 'Descrieți celelalte spații solicitate' : lang === 'fa' ? 'ورک‌اسپیس‌های دیگر درخواستی را شرح دهید' : 'Describe the other requested workspaces' : lang === 'ro' ? 'Alte detalii (opțional)' : lang === 'fa' ? 'توضیحات تکمیلی (اختیاری)' : 'Additional details (optional)'}
              </label>
              <textarea
                id="modalMessage"
                name="message"
                rows={2}
                required={Number(formData.workspaceCount) > 1}
                disabled={status === 'submitting'}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder={lang === 'ro' ? 'Mențiuni despre situația financiară sau audit...' : lang === 'fa' ? 'توضیحات در خصوص وضعیت مالی یا فنی...' : 'Notes regarding current financial audits or meters...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D3DCE6] text-xs text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#0E9F8E] disabled:bg-slate-50"
              />
            </div>

            {/* Mandatory Privacy Consent Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-[#334E68] text-xs leading-relaxed">
                <input
                  type="checkbox"
                  required
                  checked={consentPrivacy}
                  disabled={status === 'submitting'}
                  onChange={(e) => setConsentPrivacy(e.target.checked)}
                  className="mt-0.5 rounded border-[#CBD5E1] text-[#087A6E] focus:ring-[#087A6E] w-4 h-4 shrink-0"
                />
                <span>
                  {lang === 'ro'
                    ? 'Am citit și sunt de acord cu Politica de confidențialitate privind prelucrarea datelor transmise prin acest formular.'
                    : lang === 'fa'
                    ? 'سیاست حفظ حریم خصوصی را مطالعه نموده و با پردازش اطلاعات ارسالی از طریق این فرم موافقت می‌نمایم.'
                    : 'I have read and agree to the Privacy Policy regarding the processing of personal data submitted via this form.'}{' '}
                  <Link
                    href={`/${lang}/privacy`}
                    target="_blank"
                    className="text-[#087A6E] underline hover:text-[#066056] font-semibold"
                  >
                    {lang === 'ro' ? 'Politica de confidențialitate' : lang === 'fa' ? 'سیاست حفظ حریم خصوصی' : 'Privacy Policy'}
                  </Link>
                </span>
              </label>
            </div>

            {/* Cloudflare Turnstile */}
            {captchaSiteKey && (
              <div className="pt-2">
                <TurnstileWidget
                  siteKey={captchaSiteKey}
                  lang={lang}
                  onToken={(token) => setTurnstileToken(token)}
                />
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-center gap-3 text-xs text-[#52667A]">
              <ShieldCheck className="w-4 h-4 text-[#0A6E62] shrink-0" />
              <span>
                {lang === 'ro'
                  ? 'Datele transmise sunt protejate și utilizate exclusiv pentru configurarea instanței pilot.'
                  : lang === 'fa'
                  ? 'اطلاعات ارسالی کاملاً محفوظ بوده و صرفاً جهت هماهنگی و راه‌اندازی نسخه پایلوت استفاده می‌شود.'
                  : 'Data is protected under GDPR and strictly used for onboarding your pilot instance.'}
              </span>
            </div>

            <button
              type="submit"
              disabled={status === 'submitting' || !consentPrivacy}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-xs font-extrabold bg-[#087A6E] hover:bg-[#066056] disabled:bg-[#94A3B8] disabled:cursor-not-allowed text-white shadow-sm transition-all"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'ro' ? 'Se înregistrează...' : lang === 'fa' ? 'در حال ثبت...' : 'Submitting...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{fields.submit}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
