'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Language } from '@/types';

const STORAGE_KEY = 'cladora.customer-context.v1';

const copy = {
  ro: {
    label: 'Ieșire',
    title: 'Deconectare securizată',
    loading: 'Se deconectează...',
    error: 'Deconectarea a eșuat. Încercați din nou.',
  },
  en: {
    label: 'Exit',
    title: 'Secure sign out',
    loading: 'Signing out...',
    error: 'Sign out failed. Please try again.',
  },
  fa: {
    label: 'خروج',
    title: 'خروج امن',
    loading: 'در حال خروج...',
    error: 'خروج ناموفق بود. لطفاً دوباره تلاش کنید.',
  },
} as const;

export interface SignOutButtonProps {
  lang: Language;
  variant?: 'customer' | 'platform' | 'custom';
  showLabel?: boolean;
  className?: string;
}

export function SignOutButton({
  lang,
  variant = 'customer',
  showLabel,
  className,
}: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = copy[lang] ?? copy.ro;

  async function handleSignOut() {
    setLoading(true);
    setError(null);

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(STORAGE_KEY);
      }

      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

      if (signOutError) {
        setError(t.error);
        setLoading(false);
        return;
      }

      router.replace(`/${lang}/login`);
      router.refresh();
    } catch {
      setError(t.error);
      setLoading(false);
    }
  }

  const shouldShowLabel = showLabel ?? (variant === 'platform');

  const defaultClasses =
    variant === 'platform'
      ? 'flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition disabled:opacity-50 cursor-pointer'
      : 'rounded-xl border border-[#E2E8F0] p-2 text-[#102A43] hover:bg-[#F6F9FC] hover:text-[#B42318] transition disabled:opacity-50 cursor-pointer';

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        title={t.title}
        aria-label={loading ? t.loading : t.label}
        aria-busy={loading}
        className={className || defaultClasses}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : (
          <LogOut className={variant === 'platform' ? 'w-3.5 h-3.5' : 'h-4 w-4'} />
        )}
        {shouldShowLabel && (
          <span className="hidden sm:inline">
            {loading ? t.loading : t.label}
          </span>
        )}
      </button>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="absolute end-0 top-full mt-1.5 z-50 whitespace-nowrap rounded-lg bg-[#FFF5F5] border border-[#FED7D7] px-2.5 py-1 text-[11px] font-semibold text-[#C53030] shadow-md"
        >
          {error}
        </div>
      )}
    </div>
  );
}
