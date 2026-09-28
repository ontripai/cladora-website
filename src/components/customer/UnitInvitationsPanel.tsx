'use client';

import { useEffect, useState } from 'react';
import type { Language } from '@/types';

type Unit = { id: string; building_name: string; unit_code: string };
type Party = { party_id: string; legal_name: string; role_code: 'owner' | 'tenant_resident' };
const copy = {
  ro: { title: 'Invitați proprietarul sau chiriașul', unit: 'Unitate', party: 'Persoană și rol', email: 'Email', send: 'Trimite invitația', empty: 'Înregistrați mai întâi proprietatea sau contractul de închiriere activ pentru această unitate.', done: 'Invitația a fost înregistrată. Dacă persoana are deja cont, poate deschide pagina de continuare a invitației după autentificare.', failed: 'Invitația nu a putut fi trimisă.', choose: 'Selectați' },
  en: { title: 'Invite owner or tenant', unit: 'Unit', party: 'Person and role', email: 'Email', send: 'Send invitation', empty: 'Record the active ownership or lease for this unit first.', done: 'Invitation recorded. If the recipient already has an account, they can open the invitation continuation page after signing in.', failed: 'The invitation could not be sent.', choose: 'Select' },
  fa: { title: 'دعوت مالک یا مستأجر', unit: 'واحد', party: 'شخص و نقش', email: 'ایمیل', send: 'ارسال دعوت', empty: 'ابتدا مالکیت یا قرارداد اجارهٔ فعال این واحد را ثبت کنید.', done: 'دعوت ثبت شد. اگر شخص از قبل حساب دارد، پس از ورود می‌تواند صفحهٔ ادامهٔ دعوت را باز کند.', failed: 'ارسال دعوت انجام نشد.', choose: 'انتخاب کنید' },
};

export function UnitInvitationsPanel({ lang, contextId, workspaceId }: { lang: Language; contextId: string; workspaceId: string }) {
  const t = copy[lang];
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/customer/v1/private-conversations/recipients?context_id=${encodeURIComponent(contextId)}`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<Unit[]>; })
      .then(items => { if (!cancelled) { setUnits(items); setUnitId(items[0]?.id ?? ''); } })
      .catch(() => { if (!cancelled) setStatus(t.failed); });
    return () => { cancelled = true; };
  }, [contextId, t.failed]);
  useEffect(() => {
    let cancelled = false;
    if (!unitId) return;
    void fetch(`/api/customer/v1/unit-invitations?context_id=${encodeURIComponent(contextId)}&workspace_id=${encodeURIComponent(workspaceId)}&unit_id=${encodeURIComponent(unitId)}`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<Party[]>; })
      .then(items => { if (!cancelled) { setParties(items); setPartyId(''); setLoaded(true); } })
      .catch(() => { if (!cancelled) setStatus(t.failed); });
    return () => { cancelled = true; };
  }, [contextId, workspaceId, unitId, t.failed]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = parties.find(p => p.party_id === partyId);
    if (!chosen) return;
    setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/customer/v1/unit-invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_id: contextId, workspace_id: workspaceId, unit_id: unitId, party_id: partyId, role: chosen.role_code, email, lang }),
      });
      if (!response.ok) throw new Error();
      setEmail(''); setStatus(t.done);
    } catch { setStatus(t.failed); } finally { setBusy(false); }
  }

  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="rounded border p-4">
    <h2 className="mb-3 font-semibold">{t.title}</h2>
    {status && <p role="status" className="mb-3 rounded bg-slate-100 p-2">{status}</p>}
    <form onSubmit={event => void submit(event)} className="grid gap-3 sm:grid-cols-2">
      <label>{t.unit}<select value={unitId} onChange={event => { setUnitId(event.target.value); setLoaded(false); }} className="block w-full rounded border p-2"><option value="">{t.choose}</option>{units.map(unit => <option value={unit.id} key={unit.id}>{unit.building_name} · {unit.unit_code}</option>)}</select></label>
      <label>{t.party}<select required value={partyId} onChange={event => setPartyId(event.target.value)} className="block w-full rounded border p-2"><option value="">{t.choose}</option>{parties.map(party => <option value={party.party_id} key={`${party.role_code}-${party.party_id}`}>{party.legal_name} · {party.role_code}</option>)}</select></label>
      {loaded && parties.length === 0 && <p role="status" className="sm:col-span-2 rounded bg-amber-50 p-2 text-amber-900">{t.empty}</p>}
      <label>{t.email}<input required type="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} className="block w-full rounded border p-2" /></label>
      <button disabled={busy || !unitId || !partyId} className="self-end rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{t.send}</button>
    </form>
  </section>;
}
