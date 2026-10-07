'use client';

import React, { useState } from 'react';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { 
  Cpu, 
  Search
} from 'lucide-react';

interface SeventeenCoresExplorerProps {
  lang: Language;
}

export const SeventeenCoresExplorer: React.FC<SeventeenCoresExplorerProps> = ({ lang }) => {
  const dict = getDictionary(lang);
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const cores = dict.seventeenCores.cores;

  const filteredCores = cores.filter((core) => {
    const matchesPriority = selectedPriority === 'ALL' || core.priority === selectedPriority;
    const matchesSearch = 
      core.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      core.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      core.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      core.domain.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  return (
    <section className="py-24 relative bg-[#070B12] border-t border-white/10 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-brand-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full glass-panel border border-brand-500/20 text-xs font-semibold text-brand-300">
            <Cpu className="w-3.5 h-3.5" />
            <span>{dict.seventeenCores.badge}</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight">
            {dict.seventeenCores.title}
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            {dict.seventeenCores.description}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="mt-12 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Priority Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-xl glass-panel border border-white/10 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setSelectedPriority('ALL')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                selectedPriority === 'ALL'
                  ? 'bg-white/20 text-white shadow'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              {lang === 'ro' ? 'Toate (17)' : lang === 'fa' ? 'همه (۱۷ هسته)' : 'All Cores (17)'}
            </button>
            <button
              onClick={() => setSelectedPriority('P1')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                selectedPriority === 'P1'
                  ? 'bg-brand-500 text-white shadow-glow-cyan'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              {lang === 'ro' ? `P1: Nucleu MVP (${cores.filter(c=>c.priority==='P1').length})` : lang === 'fa' ? `فاز ۱: هسته MVP (${cores.filter(c=>c.priority==='P1').length})` : `P1: Core MVP (${cores.filter(c=>c.priority==='P1').length})`}
            </button>
            <button
              onClick={() => setSelectedPriority('P2')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                selectedPriority === 'P2'
                  ? 'bg-emerald-500 text-white shadow-glow-emerald'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              {lang === 'ro' ? 'P2: Operațiuni & Betă (7)' : lang === 'fa' ? 'فاز ۲: عملیات و بتا (۷)' : 'P2: Ops & Beta (7)'}
            </button>
            <button
              onClick={() => setSelectedPriority('P3')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                selectedPriority === 'P3'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              {lang === 'ro' ? `P3: AI & Valoare (${cores.filter(c=>c.priority==='P3').length})` : lang === 'fa' ? `فاز ۳: هوش مصنوعی و ارزش (${cores.filter(c=>c.priority==='P3').length})` : `P3: AI & Value (${cores.filter(c=>c.priority==='P3').length})`}
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-72">
            <label htmlFor="coreSearchInput" className="sr-only">
              {lang === 'ro' ? 'Caută nucleu' : lang === 'fa' ? 'جستجوی ماژول' : 'Search core'}
            </label>
            <Search className="w-4 h-4 text-slate-300 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="coreSearchInput"
              name="coreSearchInput"
              type="text"
              aria-label={lang === 'ro' ? 'Caută nucleu sau domeniu' : lang === 'fa' ? 'جستجوی نام یا کد هسته' : 'Search core or domain'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={lang === 'ro' ? 'Caută nucleu sau domeniu...' : lang === 'fa' ? 'جستجوی نام، کد یا کارکرد هسته...' : 'Search core or domain...'}
              className="w-full ps-9 pe-4 py-2 text-xs bg-surface-100/90 border border-white/15 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-brand-400 transition-colors"
            />
          </div>

        </div>

        {/* Cores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCores.map((core) => {
            const isP1 = core.priority === 'P1';
            const isP2 = core.priority === 'P2';

            return (
              <div
                key={core.code}
                className="p-5 rounded-2xl glass-panel glass-panel-hover border border-white/15 flex flex-col justify-between space-y-4 group relative overflow-hidden"
              >
                {/* Top Row: Code + Priority badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-white/15 text-white border border-white/10 ltr-isolate">
                      {core.code}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      {core.domain}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isP1
                        ? 'bg-brand-500/25 text-brand-200 border-brand-400'
                        : isP2
                        ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400'
                        : 'bg-violet-500/25 text-violet-200 border-violet-400'
                    }`}
                  >
                    {core.priority}
                  </span>
                </div>

                {/* Core Name & Desc */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-display font-bold text-white group-hover:text-brand-300 transition-colors">
                    {core.name}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {core.desc}
                  </p>
                </div>

                {/* Bottom Highlight Tag */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">
                    {lang === 'ro' ? 'Standard:' : lang === 'fa' ? 'استاندارد:' : 'Standard:'}
                  </span>
                  <span className="font-semibold text-white text-[11px] bg-surface-200/80 px-2 py-0.5 rounded border border-white/5">
                    {core.highlight}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
