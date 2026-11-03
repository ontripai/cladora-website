'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Language, Locale, localeConfig, SUPPORTED_LOCALES, isSupportedLocale } from '@/types';
import { ChevronDown, Check } from 'lucide-react';

interface LanguageSwitcherProps {
  currentLang: Language;
  variant?: 'header' | 'footer' | 'app' | 'mobile-drawer';
  className?: string;
}

// Accessible SVG Flags
export const FlagRO = ({ className = "w-5 h-3.5" }: { className?: string }) => (
  <svg className={`${className} rounded-[2px] shadow-sm shrink-0`} viewBox="0 0 3 2" aria-hidden="true">
    <rect width="1" height="2" fill="#002B7F" />
    <rect width="1" height="2" x="1" fill="#FCD116" />
    <rect width="1" height="2" x="2" fill="#CE1126" />
  </svg>
);

export const FlagGB = ({ className = "w-5 h-3.5" }: { className?: string }) => (
  <svg className={`${className} rounded-[2px] shadow-sm shrink-0`} viewBox="0 0 60 30" aria-hidden="true">
    <clipPath id="s">
      <path d="M0,0 v30 h60 v-30 z"/>
    </clipPath>
    <clipPath id="t">
      <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
    </clipPath>
    <g clipPath="url(#s)">
      <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
    </g>
  </svg>
);

export const FlagIR = ({ className = "w-5 h-3.5" }: { className?: string }) => (
  <svg className={`${className} rounded-[2px] shadow-sm shrink-0`} viewBox="0 0 7 4" aria-hidden="true">
    <rect width="7" height="1.33" fill="#239F40" />
    <rect width="7" height="1.34" y="1.33" fill="#FFFFFF" />
    <rect width="7" height="1.33" y="2.67" fill="#DA0000" />
    {/* Center Emblem Icon Outline */}
    <circle cx="3.5" cy="2" r="0.45" fill="#DA0000" />
    <circle cx="3.5" cy="2" r="0.3" fill="#FFFFFF" />
    <circle cx="3.5" cy="2" r="0.2" fill="#DA0000" />
  </svg>
);

const FLAG_COMPONENTS: Record<string, React.FC<{ className?: string }>> = {
  ro: FlagRO,
  gb: FlagGB,
  ir: FlagIR,
};

export const LANGUAGES = SUPPORTED_LOCALES.map((code) => {
  const cfg = localeConfig[code];
  return {
    code: cfg.code as Language,
    label: cfg.englishName,
    nativeName: cfg.nativeName,
    dir: cfg.direction,
    flag: FLAG_COMPONENTS[cfg.flag] || FlagRO,
  };
});

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  currentLang,
  variant = 'header',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerBtnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Helper to compute localized equivalent path
  const getLocalizedPath = (targetLang: Language) => {
    if (!pathname) return `/${targetLang}`;
    // Replace leading /[lang] segment with targetLang
    const segments = pathname.split('/');
    if (segments.length > 1 && isSupportedLocale(segments[1])) {
      segments[1] = targetLang;
      return segments.join('/') || `/${targetLang}`;
    }
    return `/${targetLang}${pathname}`;
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape & preserve focus ownership before unmount (PUBLIC-BR-01-LANGUAGE, PUBLIC-BR-04)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const activeEl = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
        const targetEl = (typeof HTMLElement !== 'undefined' && event.target instanceof HTMLElement ? event.target : null) as HTMLElement | null;
        const isFocusOrTargetInside = Boolean(
          dropdownRef.current && (
            (activeEl && dropdownRef.current.contains(activeEl)) ||
            (targetEl && dropdownRef.current.contains(targetEl))
          )
        );

        if (isFocusOrTargetInside) {
          // Tag event and refocus trigger button before unmount destroys activeElement
          (event as any).__cladoraLangFocusPreserved = true;
          (event as any).__cladoraLangTrigger = triggerBtnRef.current;
          triggerBtnRef.current?.focus();
        }

        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Direct element listener for bubbling keydown events to ensure synchronous focus preservation
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    const handleLocalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        (event as any).__cladoraLangFocusPreserved = true;
        (event as any).__cladoraLangTrigger = triggerBtnRef.current;
        triggerBtnRef.current?.focus();
        setIsOpen(false);
      }
    };
    el.addEventListener('keydown', handleLocalKeyDown);
    return () => el.removeEventListener('keydown', handleLocalKeyDown);
  }, [isOpen]);

  const activeLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
  const ActiveFlag = activeLangObj.flag;

  const getAriaLabel = () => {
    if (currentLang === 'ro') return 'Schimbă limba';
    if (currentLang === 'fa') return 'تغییر زبان';
    return 'Change language';
  };

  // Mobile Drawer Inline Variant
  if (variant === 'mobile-drawer') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="text-xs font-bold text-[#7B8A9A] uppercase tracking-wider px-1">
          {currentLang === 'ro' ? 'Limbă / Language' : currentLang === 'fa' ? 'زبان / Language' : 'Language / Limbă'}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map((item) => {
            const Flag = item.flag;
            const isSelected = item.code === currentLang;
            return (
              <Link
                key={item.code}
                href={getLocalizedPath(item.code)}
                aria-label={`${getAriaLabel()}: ${item.nativeName}`}
                className={`min-h-[44px] px-3 py-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[#102A43] text-white border-[#102A43] shadow-sm'
                    : 'bg-[#F6F9FC] text-[#52667A] border-[#E2E8F0] hover:bg-white hover:text-[#102A43]'
                }`}
              >
                <Flag className="w-4 h-3" />
                <span>{item.nativeName}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // Footer Inline Variant
  if (variant === 'footer') {
    return (
      <div className={`flex items-center gap-2 flex-wrap ${className}`}>
        <span className="text-xs text-[#9FB3C8] font-medium me-1">
          {currentLang === 'ro' ? 'Limbă:' : currentLang === 'fa' ? 'زبان:' : 'Language:'}
        </span>
        {LANGUAGES.map((item) => {
          const Flag = item.flag;
          const isSelected = item.code === currentLang;
          return (
            <Link
              key={item.code}
              href={getLocalizedPath(item.code)}
              aria-label={`${getAriaLabel()}: ${item.nativeName}`}
              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                isSelected
                  ? 'bg-white text-[#102A43] border-white shadow-sm'
                  : 'bg-transparent text-[#9FB3C8] border-[#243B53] hover:bg-white hover:text-[#102A43]'
              }`}
            >
              <Flag className="w-4 h-3" />
              <span>{item.nativeName}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  // Dropdown Variant (Default for Desktop Header and App Shell Topbar)
  return (
    <div
      className={`relative inline-block text-start ${className}`}
      ref={dropdownRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          (event.nativeEvent as any).__cladoraLangFocusPreserved = true;
          (event.nativeEvent as any).__cladoraLangTrigger = triggerBtnRef.current;
          triggerBtnRef.current?.focus();
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={triggerBtnRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${getAriaLabel()}: ${activeLangObj.nativeName}`}
        className="min-h-[40px] px-3 py-2 rounded-xl border border-[#D3DCE6] bg-white text-[#102A43] hover:bg-[#F6F9FC] text-xs font-bold flex items-center gap-2 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]"
      >
        <ActiveFlag className="w-4 h-3" />
        <span className="font-semibold">{activeLangObj.nativeName}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#7B8A9A] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute end-0 mt-1.5 w-44 rounded-2xl bg-white border border-[#D3DCE6] shadow-elevated p-1.5 z-50 animate-in fade-in duration-150"
        >
          <div className="text-[10px] font-bold text-[#7B8A9A] uppercase tracking-wider px-3 py-1.5 border-b border-[#F0F4F8]">
            {getAriaLabel()}
          </div>
          <div className="space-y-1 mt-1">
            {LANGUAGES.map((item) => {
              const Flag = item.flag;
              const isSelected = item.code === currentLang;
              return (
                <Link
                  key={item.code}
                  href={getLocalizedPath(item.code)}
                  onClick={() => setIsOpen(false)}
                  role="menuitem"
                  className={`w-full p-2.5 rounded-xl text-xs flex items-center justify-between transition-colors min-h-[44px] ${
                    isSelected
                      ? 'bg-[#EAF8F5] text-[#0A6E62] font-bold border border-[#B2E5DF]'
                      : 'text-[#52667A] hover:bg-[#F6F9FC] hover:text-[#102A43] font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Flag className="w-4 h-3" />
                    <span>{item.nativeName}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#0E9F8E]" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
