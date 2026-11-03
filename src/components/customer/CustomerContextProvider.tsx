'use client';
import {useDashboardFetch,useDashboardPreview} from '@/components/dashboard-lab/DashboardTransport';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardRpcResponse } from '@/lib/customer/dashboard-schema';

export type CustomerContext = {
  context_id: string;
  membership_id: string;
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
  pendingContextId: string | null;
  registerUnsavedGuard: (key: string, dirty: boolean, discard: () => void) => () => void;
  confirmContextChange: () => void;
  cancelContextChange: () => void;
  refresh: () => void;
};

const Context = createContext<State | null>(null);
const STORAGE_KEY = 'cladora.customer-context.v1';

export function CustomerContextProvider({ children }: { children: React.ReactNode }) {
  const fetch=useDashboardFetch();
  const preview=useDashboardPreview();
  const [contexts, setContexts] = useState<CustomerContext[]>([]);
  const [activeId, setActiveId] = useState('');
  const [dashboard, setDashboard] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [pendingContextId, setPendingContextId] = useState<string | null>(null);
  const unsavedGuards = useRef(new Map<string, () => void>());
  const activeIdRef = useRef(activeId);
  const contextsSeq = useRef(0);
  const dashboardSeq = useRef(0);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const registerUnsavedGuard = useCallback((key: string, dirty: boolean, discard: () => void) => {
    if (dirty) unsavedGuards.current.set(key, discard);
    else unsavedGuards.current.delete(key);
    return () => {
      if (unsavedGuards.current.get(key) === discard) unsavedGuards.current.delete(key);
    };
  }, []);
  const select = useCallback((id: string) => {
    if (id === activeId) return;
    if (unsavedGuards.current.size) {
      setPendingContextId(id);
    } else {
      setActiveId(id);
      activeIdRef.current = id;
      setDashboard(null);
      if (!preview) sessionStorage.setItem(STORAGE_KEY, id);
    }
  }, [activeId, preview]);
  const cancelContextChange = useCallback(() => setPendingContextId(null), []);
  const confirmContextChange = useCallback(() => {
    if (pendingContextId === null) return;
    const nextId = pendingContextId;
    Array.from(unsavedGuards.current.values()).forEach((discard) => discard());
    unsavedGuards.current.clear();
    setActiveId(nextId);
    activeIdRef.current = nextId;
    setDashboard(null);
    setPendingContextId(null);
    if (!preview) sessionStorage.setItem(STORAGE_KEY, nextId);
  }, [pendingContextId, preview]);

  useEffect(() => {
    let cancelled = false;
    const seq = ++contextsSeq.current;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/customer/v1/contexts', { cache: 'no-store' });
        if (seq !== contextsSeq.current || cancelled) return;
        if (response.status === 401) {
          setError('session_expired');
          setContexts([]);
          setActiveId('');
          activeIdRef.current = '';
          setDashboard(null);
          setPendingContextId(null);
          unsavedGuards.current.clear();
          if (!preview) sessionStorage.removeItem(STORAGE_KEY);
          return;
        }
        if (!response.ok) throw new Error('contexts');
        const body = (await response.json()) as { contexts: CustomerContext[] };
        if (seq !== contextsSeq.current || cancelled) return;
        const availableContexts = body.contexts || [];
        setContexts(availableContexts);

        if (availableContexts.length === 0) {
          setActiveId('');
          activeIdRef.current = '';
          setDashboard(null);
          setPendingContextId(null);
          unsavedGuards.current.clear();
          setError('no_context');
          if (!preview) sessionStorage.removeItem(STORAGE_KEY);
          return;
        }

        const currentActiveId = activeIdRef.current;
        if (currentActiveId) {
          const isStillValid = availableContexts.some((c) => c.context_id === currentActiveId);
          if (isStillValid) {
            // Valid current selection is preserved across refresh; unsaved guards protected
            setPendingContextId((pending) =>
              pending && availableContexts.some((c) => c.context_id === pending) ? pending : null
            );
            if (!preview) sessionStorage.setItem(STORAGE_KEY, currentActiveId);
            return;
          } else {
            // Context revoked or deleted on the server; immediately close access and data
            setActiveId('');
            activeIdRef.current = '';
            setDashboard(null);
            setPendingContextId(null);
            unsavedGuards.current.clear();
            setError('forbidden');
            if (!preview) sessionStorage.removeItem(STORAGE_KEY);
            return;
          }
        }

        // Initial load selection
        const requested = preview ? null : new URLSearchParams(window.location.search).get('context');
        const stored = preview ? null : sessionStorage.getItem(STORAGE_KEY);
        const initialId =
          availableContexts.some((c) => c.context_id === requested)
            ? requested ?? ''
            : availableContexts.some((c) => c.context_id === stored)
            ? stored ?? ''
            : availableContexts[0]?.context_id ?? '';

        setActiveId(initialId);
        activeIdRef.current = initialId;
        if (initialId && !preview) {
          sessionStorage.setItem(STORAGE_KEY, initialId);
        }
      } catch {
        if (seq === contextsSeq.current && !cancelled) setError('context');
      } finally {
        if (seq === contextsSeq.current && !cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetch, preview, nonce]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const seq = ++dashboardSeq.current;
    const targetContextId = activeId;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (!preview) sessionStorage.setItem(STORAGE_KEY, targetContextId);
        const response = await fetch(
          `/api/customer/v1/dashboard?context_id=${encodeURIComponent(targetContextId)}`,
          { cache: 'no-store' }
        );
        if (seq !== dashboardSeq.current || cancelled || activeIdRef.current !== targetContextId) {
          return;
        }
        if (response.status === 401) {
          setDashboard(null);
          setError('session_expired');
          return;
        }
        if (response.status === 403) {
          setDashboard(null);
          setError('forbidden');
          return;
        }
        if (!response.ok) throw new Error('dashboard');
        const body = (await response.json()) as CustomerDashboardData;
        if (seq !== dashboardSeq.current || cancelled || activeIdRef.current !== targetContextId) {
          return;
        }
        if (body && body.contextId === targetContextId) {
          setDashboard(body);
        }
      } catch {
        if (seq === dashboardSeq.current && !cancelled && activeIdRef.current === targetContextId) {
          setDashboard(null);
          setError('dashboard');
        }
      } finally {
        if (seq === dashboardSeq.current && !cancelled && activeIdRef.current === targetContextId) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, nonce, fetch, preview]);

  const value = useMemo<State>(
    () => ({
      contexts,
      active: contexts.find((c) => c.context_id === activeId) ?? null,
      dashboard: dashboard?.contextId === activeId ? dashboard : null,
      loading,
      error,
      select,
      pendingContextId,
      registerUnsavedGuard,
      confirmContextChange,
      cancelContextChange,
      refresh,
    }),
    [contexts, activeId, dashboard, loading, error, select, pendingContextId, registerUnsavedGuard, confirmContextChange, cancelContextChange, refresh]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCustomerContext() {
  const value = useContext(Context);
  if (!value) throw new Error('CustomerContextProvider missing');
  return value;
}
