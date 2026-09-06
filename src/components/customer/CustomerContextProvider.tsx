'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DashboardRpcResponse } from '@/lib/customer/dashboard-schema';

export type CustomerContext = {
  context_id: string;
  tenant_name: string;
  role_code: string;
  role_name: string;
  scope_type: string;
  context_label: string;
};

export type CustomerDashboardData = DashboardRpcResponse;

type State = {
  contexts: CustomerContext[];
  active: CustomerContext | null;
  dashboard: CustomerDashboardData | null;
  loading: boolean;
  error: string | null;
  select: (id: string) => void;
  refresh: () => void;
};

const Context = createContext<State | null>(null);
const STORAGE_KEY = 'cladora.customer-context.v1';

export function CustomerContextProvider({ children }: { children: React.ReactNode }) {
  const [contexts, setContexts] = useState<CustomerContext[]>([]);
  const [activeId, setActiveId] = useState('');
  const [dashboard, setDashboard] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/customer/v1/contexts', { cache: 'no-store' });
        if (!response.ok) throw new Error('contexts');
        const body = (await response.json()) as { contexts: CustomerContext[] };
        if (cancelled) return;
        setContexts(body.contexts);
        const stored = sessionStorage.getItem(STORAGE_KEY);
        setActiveId(
          body.contexts.some((c) => c.context_id === stored)
            ? stored ?? ''
            : body.contexts[0]?.context_id ?? ''
        );
      } catch {
        if (!cancelled) setError('context');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        sessionStorage.setItem(STORAGE_KEY, activeId);
        const response = await fetch(
          `/api/customer/v1/dashboard?context_id=${encodeURIComponent(activeId)}`,
          { cache: 'no-store' }
        );
        if (!response.ok) throw new Error('dashboard');
        const body = (await response.json()) as CustomerDashboardData;
        if (!cancelled) setDashboard(body);
      } catch {
        if (!cancelled) {
          setDashboard(null);
          setError('dashboard');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, nonce]);

  const value = useMemo<State>(
    () => ({
      contexts,
      active: contexts.find((c) => c.context_id === activeId) ?? null,
      dashboard,
      loading,
      error,
      select: setActiveId,
      refresh,
    }),
    [contexts, activeId, dashboard, loading, error, refresh]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCustomerContext() {
  const value = useContext(Context);
  if (!value) throw new Error('CustomerContextProvider missing');
  return value;
}
