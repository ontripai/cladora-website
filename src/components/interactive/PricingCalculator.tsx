'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { Check, ShieldCheck, ArrowRight, Layers, Globe, Cpu, SlidersHorizontal, CheckCircle2 } from 'lucide-react';

interface PricingCalculatorProps {
  lang: Language;
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({ lang }) => {
  const dict = getDictionary(lang);
  const p = dict.pricing;

  const [selectedContext, setSelectedContext] = useState<string>('community');
  const [selectedDomains, setSelectedDomains] = useState<string[]>(['fin01', 'ce', 'ops']);
  const [selectedCountryPack, setSelectedCountryPack] = useState<string>('ro');
  const [selectedImplementation, setSelectedImplementation] = useState<string>('shadow');

  const toggleDomain = (id: string) => {
    if (id === 'fin01') return; // Core ledger is statutory locked
    setSelectedDomains((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const currentContextObj = p.contexts.find((c) => c.id === selectedContext) || p.contexts[0];
  const currentCountryPackObj = p.countryPacks.find((cp) => cp.id === selectedCountryPack) || p.countryPacks[0];
  const currentImplementationObj = p.implementationModels.find((im) => im.id === selectedImplementation) || p.implementationModels[0];

  return (
    <div className="space-y-12">
      {/* Top Header Card */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43]">
          {p.estimatorTitle}
        </h2>
        <p className="text-sm text-[#52667A]">
          {p.estimatorSubtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Scope Configurator Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* 1. Operational Context */}
          <div className="p-6 rounded-2xl bg-white border border-[#D3DCE6] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#0E9F8E]" />
              <h3 className="text-base font-bold text-[#102A43]">
                {p.contextLabel}
              </h3>
            </div>
            <p className="text-xs text-[#52667A]">{p.contextHelp}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {p.contexts.map((ctx) => {
                const isSelected = selectedContext === ctx.id;
                return (
                  <button
                    key={ctx.id}
                    type="button"
                    onClick={() => setSelectedContext(ctx.id)}
                    className={`text-start p-4 rounded-xl border transition-all text-xs space-y-1 ${
                      isSelected
                        ? 'border-[#087A6E] bg-[#F0FDF4] shadow-sm ring-1 ring-[#087A6E]'
                        : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="font-bold text-[#102A43] flex items-center justify-between">
                      <span>{ctx.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#087A6E] shrink-0" />}
                    </div>
                    <p className="text-[11px] text-[#52667A] leading-relaxed">
                      {ctx.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Capability Domains */}
          <div className="p-6 rounded-2xl bg-white border border-[#D3DCE6] shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#0E9F8E]" />
              <h3 className="text-base font-bold text-[#102A43]">
                {p.domainsLabel}
              </h3>
            </div>
            <p className="text-xs text-[#52667A]">{p.domainsHelp}</p>
            <div className="space-y-2.5">
              {p.domains.map((dom) => {
                const isChecked = selectedDomains.includes(dom.id);
                const isLocked = dom.id === 'fin01';
                return (
                  <div
                    key={dom.id}
                    onClick={() => toggleDomain(dom.id)}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all text-xs ${
                      isChecked
                        ? 'border-[#B2E5DF] bg-[#F6FDFD]'
                        : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`dom-${dom.id}`}
                      checked={isChecked}
                      disabled={isLocked}
                      onChange={() => {}}
                      className="mt-0.5 w-4 h-4 rounded text-[#087A6E] focus:ring-0 cursor-pointer accent-[#087A6E]"
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor={`dom-${dom.id}`} className="font-bold text-[#102A43] cursor-pointer">
                          {dom.name}
                        </label>
                        {isLocked && (
                          <span className="text-[10px] font-bold text-[#087A6E] bg-[#E6F6F4] px-2 py-0.5 rounded">
                            {lang === 'ro' ? 'Nucleu Statutar Obligatoriu' : lang === 'fa' ? 'الزامی / پایه قانونی' : 'Statutory Core'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#52667A]">
                        {dom.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Country Pack & 4. Implementation Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Country Pack */}
            <div className="p-6 rounded-2xl bg-white border border-[#D3DCE6] shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#0E9F8E]" />
                <h3 className="text-sm font-bold text-[#102A43]">
                  {p.countryPackLabel}
                </h3>
              </div>
              <div className="space-y-2">
                {p.countryPacks.map((cp) => {
                  const isSelected = selectedCountryPack === cp.id;
                  return (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => setSelectedCountryPack(cp.id)}
                      className={`w-full text-start p-3 rounded-xl border transition-all text-xs space-y-1 ${
                        isSelected
                          ? 'border-[#087A6E] bg-[#F0FDF4] ring-1 ring-[#087A6E]'
                          : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="font-bold text-[#102A43] flex items-center justify-between">
                        <span>{cp.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#087A6E]" />}
                      </div>
                      <p className="text-[11px] text-[#52667A]">{cp.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Implementation Model */}
            <div className="p-6 rounded-2xl bg-white border border-[#D3DCE6] shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-[#0E9F8E]" />
                <h3 className="text-sm font-bold text-[#102A43]">
                  {p.implementationLabel}
                </h3>
              </div>
              <div className="space-y-2">
                {p.implementationModels.map((im) => {
                  const isSelected = selectedImplementation === im.id;
                  return (
                    <button
                      key={im.id}
                      type="button"
                      onClick={() => setSelectedImplementation(im.id)}
                      className={`w-full text-start p-3 rounded-xl border transition-all text-xs space-y-1 ${
                        isSelected
                          ? 'border-[#087A6E] bg-[#F0FDF4] ring-1 ring-[#087A6E]'
                          : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div className="font-bold text-[#102A43] flex items-center justify-between">
                        <span>{im.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#087A6E]" />}
                      </div>
                      <p className="text-[11px] text-[#52667A]">{im.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Dynamic Scope Summary Profile (5 cols sticky) */}
        <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-6">
          <div className="p-8 rounded-3xl bg-white border-2 border-[#087A6E] shadow-xl space-y-6">
            
            <div className="space-y-2 border-b border-[#F0F4F8] pb-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F6F4] text-[11px] font-bold text-[#087A6E] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{p.commercialModelBadge}</span>
              </div>
              <h3 className="text-xl font-display font-extrabold text-[#102A43]">
                {p.summaryTitle}
              </h3>
            </div>

            {/* Scope Summary Details */}
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1">
                <span className="text-[10px] font-bold text-[#52667A] uppercase tracking-wider block">
                  {lang === 'ro' ? 'Tipologie Operațională:' : lang === 'fa' ? 'نوع دارایی انتخاب‌شده:' : 'Operational Context:'}
                </span>
                <span className="font-bold text-[#102A43] text-sm block">
                  {currentContextObj.name}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <span className="text-[10px] font-bold text-[#52667A] uppercase tracking-wider block">
                  {lang === 'ro' ? 'Domenii Active:' : lang === 'fa' ? 'دامنه‌های فعال:' : 'Active Domains:'} ({selectedDomains.length})
                </span>
                <div className="space-y-1">
                  {selectedDomains.map((dId) => {
                    const dom = p.domains.find((d) => d.id === dId);
                    if (!dom) return null;
                    return (
                      <div key={dId} className="flex items-center gap-1.5 text-xs text-[#102A43] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#087A6E] shrink-0" />
                        <span>{dom.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1">
                  <span className="text-[10px] font-bold text-[#52667A] uppercase tracking-wider block">
                    {lang === 'ro' ? 'Reglementare:' : lang === 'fa' ? 'انطباق قانونی:' : 'Compliance:'}
                  </span>
                  <span className="font-bold text-[#102A43] text-xs block">
                    {currentCountryPackObj.name}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1">
                  <span className="text-[10px] font-bold text-[#52667A] uppercase tracking-wider block">
                    {lang === 'ro' ? 'Tranziție:' : lang === 'fa' ? 'مدل استقرار:' : 'Rollout:'}
                  </span>
                  <span className="font-bold text-[#102A43] text-xs block truncate">
                    {currentImplementationObj.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Commercial Framing Note */}
            <p className="text-xs text-[#52667A] leading-relaxed border-t border-[#F0F4F8] pt-4">
              {p.commercialModelText}
            </p>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <Link
                href={`/${lang}/contact`}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs font-bold text-white bg-[#087A6E] hover:bg-[#066056] shadow-sm transition-all"
              >
                <span>{p.ctaProposal}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>

              <Link
                href={`/${lang}/contact`}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-[#102A43] bg-[#F0F4F8] hover:bg-[#E2E8F0] transition-colors"
              >
                <span>{p.ctaContact}</span>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
