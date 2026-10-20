'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { amenityCapacityReadV1Schema, type AmenityCapacityReadV1 } from '@/lib/customer/amenity-capacity-v1';

const copy = {
  ro: { title: 'Rezervări facilități', subtitle: 'Rezervă o facilitate comună verificată, fără a expune rezervările altor persoane.', choose: 'Facilitate', start: 'Început', end: 'Sfârșit', capacity: 'Capacitate', hold: 'Păstrează temporar', confirm: 'Confirmă', release: 'Eliberează', held: 'Păstrată', confirmed: 'Confirmată', released: 'Eliberată', expired: 'Expirată', loading: 'Se încarcă facilitățile…', empty: 'Nu există facilități configurate în acest spațiu de lucru.', denied: 'Modulul sau permisiunea de rezervare nu este activă.', failed: 'Operațiunea nu a reușit; datele și cheia de reluare au fost păstrate.', success: 'Rezervarea a fost actualizată.', noContext: 'Alege mai întâi un context activ.' },
  en: { title: 'Amenity reservations', subtitle: 'Reserve a verified shared facility without exposing anyone else’s reservation.', choose: 'Amenity', start: 'Start', end: 'End', capacity: 'Capacity', hold: 'Place hold', confirm: 'Confirm', release: 'Release', held: 'Held', confirmed: 'Confirmed', released: 'Released', expired: 'Expired', loading: 'Loading amenities…', empty: 'No amenities are configured in this workspace.', denied: 'The booking module or permission is not active.', failed: 'The action failed; your input and retry identity were preserved.', success: 'The reservation was updated.', noContext: 'Choose an active context first.' },
  fa: { title: 'رزرو مشاعات', subtitle: 'یک فضای مشترک تأییدشده را بدون نمایش رزرو اشخاص دیگر رزرو کنید.', choose: 'فضای مشترک', start: 'شروع', end: 'پایان', capacity: 'ظرفیت', hold: 'نگه‌داشت موقت', confirm: 'تأیید', release: 'آزادسازی', held: 'موقت', confirmed: 'تأییدشده', released: 'آزادشده', expired: 'منقضی', loading: 'در حال دریافت فضاها…', empty: 'فضای مشترکی در این Workspace پیکربندی نشده است.', denied: 'ماژول یا مجوز رزرو فعال نیست.', failed: 'عملیات ناموفق بود؛ ورودی و شناسهٔ retry حفظ شد.', success: 'رزرو به‌روزرسانی شد.', noContext: 'ابتدا یک زمینهٔ فعال انتخاب کنید.' },
} as const;

const identity = () => ({ request_id: crypto.randomUUID(), idempotency_key: `c13-${crypto.randomUUID()}` });
const source = (id: string) => ({ consumer_domain: 'community' as const, consumer_entity_type: 'amenity_reservation', consumer_entity_id: id, consumer_version: 1 });

export function CustomerAmenityReservations({ lang }: { lang: Language }) {
  const { active, dashboard, loading } = useCustomerContext();
  if (loading && (!active || !dashboard)) return <Notice lang={lang} text={copy[lang].loading} />;
  if (!active || !dashboard) return <Notice lang={lang} text={copy[lang].noContext} />;
  return <AmenityWorkspace key={`${active.context_id}:${dashboard.workspace_id}`} lang={lang} contextId={active.context_id} workspaceId={dashboard.workspace_id} />;
}

function AmenityWorkspace({ lang, contextId, workspaceId }: { lang: Language; contextId: string; workspaceId: string }) {
  const fetch = useDashboardFetch(); const t = copy[lang];
  const [data, setData] = useState<AmenityCapacityReadV1 | null>(null);
  const [policyId, setPolicyId] = useState(''); const [start, setStart] = useState('');
  const [end, setEnd] = useState(''); const [capacity, setCapacity] = useState(1);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const pending = useRef<Record<string, unknown> | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/customer/v1/amenities/reservations?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, { cache: 'no-store', credentials: 'same-origin', signal });
    if (!response.ok) throw new Error(response.status === 403 ? 'denied' : 'failed');
    const parsed = amenityCapacityReadV1Schema.parse(await response.json());
    if (parsed.workspace_id !== workspaceId) throw new Error('failed');
    setData(parsed); setPolicyId((current) => parsed.policies.some((item) => item.policy_id === current) ? current : parsed.policies[0]?.policy_id ?? '');
  }, [contextId, workspaceId, fetch]);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => void load(controller.signal).catch((reason) => setError(reason instanceof Error && reason.message === 'denied' ? t.denied : t.failed))); return () => controller.abort(); }, [load, t.denied, t.failed]);
  const policy = data?.policies.find((item) => item.policy_id === policyId);
  const label = useCallback((labels: { ro: string; en: string; fa: string }) => labels[lang], [lang]);
  const send = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/customer/v1/amenities/reservations', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('failed');
      pending.current = null; setMessage(t.success); await load();
    } catch { setError(t.failed); throw new Error('failed'); } finally { setBusy(false); }
  }, [fetch, load, t.failed, t.success]);
  const requestHold = useCallback(async () => {
    if (!policy) return;
    if (!pending.current) { const reservationId = crypto.randomUUID(); pending.current = {
      contract_version: 'shared-capacity-allocation-receipt.v1', ...identity(), context_id: contextId, workspace_id: workspaceId,
      source: source(reservationId), policy_id: policy.policy_id, expected_policy_version: policy.policy_version,
      requested_at: new Date().toISOString(), action: 'request_hold', window: { requested_start: start, requested_end: end, requested_capacity: capacity, resources: [{ contract_version: 'canonical-resource-reference.v1', context_id: contextId, workspace_id: workspaceId, resource_type: 'unit', resource_id: policy.resource.resource_id, resource_version: policy.resource.resource_version, permission_code: 'core.units.identity.read', purpose: 'core.unit_identity.history' }] },
    }; }
    await send(pending.current);
  }, [policy, contextId, workspaceId, start, end, capacity, send]);
  const act = useCallback(async (action: 'confirm_hold' | 'release', hold: NonNullable<AmenityCapacityReadV1['my_holds'][number]>) => {
    const selected = data?.policies.find((item) => item.policy_id === hold.policy_id); if (!selected) return;
    await send({ contract_version: 'shared-capacity-allocation-receipt.v1', ...identity(), context_id: contextId, workspace_id: workspaceId, source: source(hold.source_entity_id), policy_id: hold.policy_id, expected_policy_version: selected.policy_version, requested_at: new Date().toISOString(), action, hold_id: hold.hold_id, expected_hold_version: hold.hold_version, ...(action === 'release' ? { reason_code: 'customer_release' } : {}) });
  }, [data?.policies, contextId, workspaceId, send]);
  const activeHolds = useMemo(() => data?.my_holds ?? [], [data]);
  if (!data) return <Notice lang={lang} text={error || t.loading} />;
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5">
    <header className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold text-[#102A43]">{t.title}</h1><p className="mt-2 text-sm text-[#52667A]">{t.subtitle}</p></header>
    {!data.policies.length ? <Notice lang={lang} text={t.empty} /> : <form className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void requestHold().catch(() => {}); }}>
      <label className="space-y-1 text-sm"><span>{t.choose}</span><select value={policyId} onChange={(event) => { setPolicyId(event.target.value); pending.current = null; }} className="w-full rounded-lg border p-2">{data.policies.map((item) => <option key={item.policy_id} value={item.policy_id}>{label(item.labels)}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.capacity}</span><input type="number" min={1} max={policy?.total_capacity} value={capacity} onChange={(event) => { setCapacity(Number(event.target.value)); pending.current = null; }} className="w-full rounded-lg border p-2" /></label>
      <label className="space-y-1 text-sm"><span>{t.start} · {policy?.timezone}</span><input required type="text" placeholder="2026-10-20T18:00:00+03:00" value={start} onChange={(event) => { setStart(event.target.value); pending.current = null; }} className="w-full rounded-lg border p-2" /></label>
      <label className="space-y-1 text-sm"><span>{t.end} · {policy?.timezone}</span><input required type="text" placeholder="2026-10-20T19:00:00+03:00" value={end} onChange={(event) => { setEnd(event.target.value); pending.current = null; }} className="w-full rounded-lg border p-2" /></label>
      <button disabled={busy || !policy} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:w-fit">{t.hold}</button>
    </form>}
    <p role="status" className="text-sm text-teal-800">{message}</p>{error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <div className="space-y-3">{activeHolds.map((hold) => <article key={hold.hold_id} className="rounded-xl border bg-white p-4"><p className="font-semibold">{t[hold.state]}</p><p className="text-sm text-[#52667A]">{new Date(hold.effective_start).toLocaleString()} – {new Date(hold.effective_end).toLocaleString()} · {hold.allocated_capacity}</p><div className="mt-3 flex gap-2">{hold.state === 'held' ? <button disabled={busy} type="button" onClick={() => void act('confirm_hold', hold).catch(() => {})} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white">{t.confirm}</button> : null}{['held','confirmed'].includes(hold.state) ? <button disabled={busy} type="button" onClick={() => void act('release', hold).catch(() => {})} className="rounded-lg border px-3 py-2 text-sm font-semibold">{t.release}</button> : null}</div></article>)}</div>
  </section>;
}

function Notice({ lang, text }: { lang: Language; text: string }) { return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} role="status" className="rounded-2xl border bg-white p-8 text-center text-sm text-[#52667A]">{text}</div>; }
