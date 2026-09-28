'use client';

import { useEffect, useState } from 'react';
import type { Language } from '@/types';

type Unit = { id: string; building_name: string; unit_code: string };
type Party = { party_id: string; legal_name: string; role_code: 'owner' | 'tenant_resident' };
const copy = {
  ro: { title: 'Invitați proprietarul sau chiriașul', unit: 'Unitate', party: 'Persoană și rol', email: 'Email', send: 'Trimite invitația', empty: 'Înregistrați relația verificată înainte de invitație.', done: 'Invitația a fost înregistrată. Persoanele cu cont existent o pot accepta după autentificare.', failed: 'Operațiunea nu a putut fi finalizată.', choose: 'Selectați', register: 'Înregistrați relația', owner: 'Proprietar', tenant: 'Chiriaș', name: 'Nume legal', evidence: 'Referință document / justificare verificată', recorded: 'Relația a fost înregistrată. Verificați persoana și trimiteți invitația.', existing: 'O relație activă există deja; verificați registrul înainte de modificare.' },
  en: { title: 'Invite owner or tenant', unit: 'Unit', party: 'Person and role', email: 'Email', send: 'Send invitation', empty: 'Register the verified relationship before inviting.', done: 'Invitation recorded. Existing account holders can accept it after signing in.', failed: 'The operation could not be completed.', choose: 'Select', register: 'Register relationship', owner: 'Owner', tenant: 'Tenant', name: 'Legal name', evidence: 'Verified document reference / justification', recorded: 'Relationship recorded. Check the person and send the invitation.', existing: 'An active relationship already exists; review the registry before changing it.' },
  fa: { title: 'دعوت مالک یا مستأجر', unit: 'واحد', party: 'شخص و نقش', email: 'ایمیل', send: 'ارسال دعوت', empty: 'ابتدا رابطهٔ تأییدشده را ثبت کنید.', done: 'دعوت ثبت شد. دارندهٔ حساب موجود پس از ورود می‌تواند آن را بپذیرد.', failed: 'عملیات انجام نشد.', choose: 'انتخاب کنید', register: 'ثبت رابطه', owner: 'مالک', tenant: 'مستأجر', name: 'نام قانونی', evidence: 'شمارهٔ سند بررسی‌شده یا دلیل ثبت رابطه', recorded: 'رابطه ثبت شد. شخص را بررسی و دعوت را ارسال کنید.', existing: 'رابطهٔ فعال دیگری وجود دارد؛ پیش از تغییر، سوابق واحد را بررسی کنید.' },
};

export function UnitInvitationsPanel({ lang, contextId }: { lang: Language; contextId: string }) {
  const t = copy[lang];
  const [units, setUnits] = useState<Unit[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [role, setRole] = useState<'owner' | 'tenant_resident'>('owner');
  const [name, setName] = useState('');
  const [evidence, setEvidence] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/customer/v1/unit-invitations?context_id=${encodeURIComponent(contextId)}`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<{workspace_id: string; units: Unit[]}>; })
      .then(result => { if (!cancelled) { setWorkspaceId(result.workspace_id); setUnits(result.units); setUnitId(result.units[0]?.id ?? ''); } })
      .catch(() => { if (!cancelled) setStatus(t.failed); });
    return () => { cancelled = true; };
  }, [contextId, t.failed]);
  useEffect(() => {
    let cancelled = false;
    if (!unitId || !workspaceId) return;
    void fetch(`/api/customer/v1/unit-invitations?context_id=${encodeURIComponent(contextId)}&workspace_id=${encodeURIComponent(workspaceId)}&unit_id=${encodeURIComponent(unitId)}`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<Party[]>; })
      .then(items => { if (!cancelled) { setParties(items); setPartyId(current => items.some(item => item.party_id === current) ? current : ''); setLoaded(true); } })
      .catch(() => { if (!cancelled) setStatus(t.failed); });
    return () => { cancelled = true; };
  }, [contextId, workspaceId, unitId, revision, t.failed]);

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unitId || !workspaceId) return;
    setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/customer/v1/unit-invitations/relationships', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_id: contextId, workspace_id: workspaceId, unit_id: unitId, role, name, evidence }),
      });
      if (response.status === 409) { setStatus(t.existing); return; }
      if (!response.ok) throw new Error();
      const result = await response.json() as { party_id: string };
      setPartyId(result.party_id); setName(''); setEvidence(''); setStatus(t.recorded);
      setRevision(value => value + 1);
    } catch { setStatus(t.failed); } finally { setBusy(false); }
  }

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
      <button disabled={busy || !unitId || !workspaceId || !partyId} className="self-end rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{t.send}</button>
    </form>
    <form onSubmit={event => void register(event)} className="mt-6 grid gap-3 border-t pt-4 sm:grid-cols-2">
      <h3 className="sm:col-span-2 font-semibold">{t.register}</h3>
      <label>{t.party}<select value={role} onChange={event => setRole(event.target.value as typeof role)} className="block w-full rounded border p-2"><option value="owner">{t.owner}</option><option value="tenant_resident">{t.tenant}</option></select></label>
      <label>{t.name}<input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="block w-full rounded border p-2" /></label>
      <label className="sm:col-span-2">{t.evidence}<textarea required minLength={15} maxLength={500} value={evidence} onChange={event => setEvidence(event.target.value)} className="block w-full rounded border p-2" /></label>
      <button disabled={busy || !unitId || !workspaceId} className="self-end rounded border border-blue-700 px-4 py-2 text-blue-800 disabled:opacity-50">{t.register}</button>
    </form>
  </section>;
}
