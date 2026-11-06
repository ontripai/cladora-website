'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import {
  SERVICE_REQUEST_CUSTODY_ENDPOINT, serviceRequestCustodyOwnerSchema,
  readServiceRequestCustody, captureServiceRequestCustody,
  assertServiceRequestCustodyBytes, releaseServiceRequestCustody,
  type ServiceRequestCustodyRecord, type ServiceRequestCustodyScope,
} from './service-request-custody';

type State = { status: 'loading' | 'ready' | 'blocked'; owner: string | null; record: ServiceRequestCustodyRecord | null };
export type ServiceRequestCustody = State & {
  capture(scope: ServiceRequestCustodyScope, wire: string): Promise<ServiceRequestCustodyRecord>;
  beforeDispatch(record: ServiceRequestCustodyRecord): Promise<void>;
  release(record: ServiceRequestCustodyRecord): Promise<void>;
};

export function useServiceRequestCustody(fetch: DashboardFetch): ServiceRequestCustody {
  const [state, setState] = useState<State>({ status: 'loading', owner: null, record: null });
  const current = useRef(state);
  const live = useRef(false);
  const generation = useRef(0);
  const update = useCallback((value: State) => { current.current = value; if (live.current) setState(value); }, []);
  const block = useCallback((): never => {
    update({ status: 'blocked', owner: null, record: null });
    throw new Error('SERVICE_CUSTODY_UNAVAILABLE');
  }, [update]);
  const identify = useCallback(async (expected: string, signal?: AbortSignal) => {
    const epoch = generation.current;
    try {
      const response = await fetch(SERVICE_REQUEST_CUSTODY_ENDPOINT, {
        cache: 'no-store', credentials: 'same-origin', signal,
      });
      if (!live.current || signal?.aborted || epoch !== generation.current) throw new Error('SERVICE_CUSTODY_STALE');
      if (!response.ok) return block();
      const value = serviceRequestCustodyOwnerSchema.parse(await response.json());
      if (!live.current || signal?.aborted || epoch !== generation.current) throw new Error('SERVICE_CUSTODY_STALE');
      if (value.owner !== expected) return block();
      return value.owner;
    } catch (error) {
      if (!live.current || signal?.aborted || epoch !== generation.current) throw error;
      return block();
    }
  }, [fetch, block]);
  useEffect(() => {
    live.current = true;
    const epoch = ++generation.current;
    const controller = new AbortController();
    let loaded = false;
    void (async () => {
      try {
        const response = await fetch(SERVICE_REQUEST_CUSTODY_ENDPOINT, {
          cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
        });
        if (!response.ok) throw new Error('SERVICE_CUSTODY_UNAVAILABLE');
        const value = serviceRequestCustodyOwnerSchema.parse(await response.json());
        const saved = await readServiceRequestCustody(window.sessionStorage, value.owner);
        if (!live.current || controller.signal.aborted || epoch !== generation.current) return;
        loaded = true;
        if (saved.state === 'blocked') { update({ status: 'blocked', owner: null, record: null }); return; }
        update({ status: 'ready', owner: value.owner, record: saved.record });
      } catch {
        if (live.current && !controller.signal.aborted && epoch === generation.current) update({ status: 'blocked', owner: null, record: null });
      }
    })();
    const verify = () => {
      const expected = current.current.owner;
      if (loaded && expected && document.visibilityState !== 'hidden') {
        // A focus check cannot publish older data or clear an unresolved command.
        void identify(expected, controller.signal).catch(() => undefined);
      }
    };
    window.addEventListener('focus', verify);
    document.addEventListener('visibilitychange', verify);
    return () => {
      live.current = false; generation.current = epoch + 1; controller.abort();
      window.removeEventListener('focus', verify);
      document.removeEventListener('visibilitychange', verify);
    };
  }, [fetch, identify, update]);

  return {
    ...state,
    async capture(scope, wire) {
      const owner = current.current.owner;
      const epoch = generation.current;
      if (!owner || current.current.status !== 'ready') return block();
      await identify(owner);
      try {
        const record = await captureServiceRequestCustody(window.sessionStorage, owner, scope, wire);
        if (!live.current || epoch !== generation.current) throw new Error('SERVICE_CUSTODY_STALE');
        if (current.current.owner !== owner) return block();
        update({ status: 'ready', owner, record });
        return record;
      } catch (error) {
        if (!live.current || epoch !== generation.current) throw error;
        return block();
      }
    },
    async beforeDispatch(record) {
      const epoch = generation.current;
      if (current.current.status !== 'ready' || current.current.owner !== record.owner) return block();
      await identify(record.owner);
      if (!live.current || epoch !== generation.current) throw new Error('SERVICE_CUSTODY_STALE');
      try { assertServiceRequestCustodyBytes(window.sessionStorage, record); }
      catch { return block(); }
    },
    async release(record) {
      const epoch = generation.current;
      if (current.current.status !== 'ready' || current.current.owner !== record.owner) return block();
      await identify(record.owner);
      if (!live.current || epoch !== generation.current) throw new Error('SERVICE_CUSTODY_STALE');
      try {
        releaseServiceRequestCustody(window.sessionStorage, record);
        update({ status: 'ready', owner: record.owner, record: null });
      } catch { return block(); }
    },
  };
}
