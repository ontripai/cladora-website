'use client';

import { useEffect, useState } from 'react';
import { useCustomerContext } from './CustomerContextProvider';
import type { Language } from '@/types';

type Property = { id: string; name: string };
type Pending = { id: string; email: string; expires_at: string };
const copy = {
  fa: { title: 'دعوت مدیر ملک', hint: 'دسترسی مدیر فقط به ملک انتخاب‌شده محدود می‌شود. پذیرش دعوت به احراز هویت دومرحله‌ای نیاز دارد.', property: 'ملک', email: 'ایمیل مدیر', send: 'ارسال دعوت', pending: 'دعوت‌های در انتظار', revoke: 'لغو دعوت', choose: 'انتخاب ملک', done: 'دعوت ارسال شد.', replay: 'این دعوت از قبل در انتظار پذیرش است.', failed: 'دعوت انجام نشد. دسترسی یا ایمیل را بررسی کنید.', noProperties: 'ملکی برای دعوت در این زمینه در دسترس نیست.', expires: 'اعتبار دعوت ۷۲ ساعت است.' },
  en: { title: 'Invite a property manager', hint: 'The manager is limited to the selected property. Accepting requires two-factor authentication.', property: 'Property', email: 'Manager email', send: 'Send invitation', pending: 'Pending invitations', revoke: 'Revoke invitation', choose: 'Select a property', done: 'Invitation sent.', replay: 'This invitation is already pending.', failed: 'Invitation failed. Check access and the email address.', noProperties: 'No property is available for invitation in this context.', expires: 'The invitation expires in 72 hours.' },
  ro: { title: 'Invitați un administrator de proprietate', hint: 'Administratorul are acces numai la proprietatea selectată. Acceptarea necesită autentificare în doi pași.', property: 'Proprietate', email: 'Email administrator', send: 'Trimite invitația', pending: 'Invitații în așteptare', revoke: 'Revocă invitația', choose: 'Selectați proprietatea', done: 'Invitația a fost trimisă.', replay: 'Invitația este deja în așteptare.', failed: 'Invitația nu a reușit. Verificați accesul și adresa de email.', noProperties: 'Nu există o proprietate disponibilă pentru invitație în acest context.', expires: 'Invitația expiră în 72 de ore.' },
} as const;

export function PropertyManagerInvitationsPanel({ lang }: { lang: Language }) {
  const { active } = useCustomerContext();
  const t = copy[lang];
  const contextId = active?.context_id;
  const canInvite = Boolean(active && ['association_admin', 'property_manager'].includes(active.role_code));
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!contextId || !canInvite) return;
    let cancelled = false;
    void fetch(`/api/customer/v1/property-manager-invitations?context_id=${encodeURIComponent(contextId)}`, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<Property[]>; })
      .then(rows => { if (cancelled) return; setProperties(rows); setPropertyId(rows[0]?.id ?? ''); setStatus(''); })
      .catch(() => { if (cancelled) return; setProperties([]); setPropertyId(''); setPending([]); setStatus(t.failed); });
    return () => { cancelled = true; };
  }, [canInvite, contextId, t.failed]);

  useEffect(() => {
    if (!contextId || !propertyId) return;
    let cancelled = false;
    void fetch(`/api/customer/v1/property-manager-invitations?context_id=${encodeURIComponent(contextId)}&property_id=${encodeURIComponent(propertyId)}`, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<Pending[]>; })
      .then(rows => { if (!cancelled) setPending(rows); }).catch(() => { if (!cancelled) setPending([]); });
    return () => { cancelled = true; };
  }, [contextId, propertyId]);

  if (!active || !['association_admin', 'property_manager'].includes(active.role_code)) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active || !propertyId) return;
    setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/customer/v1/property-manager-invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_id: active.context_id, property_id: propertyId, email, lang }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { delivery: string };
      setEmail(''); setStatus(result.delivery === 'already_pending' ? t.replay : t.done);
      const refreshed = await fetch(`/api/customer/v1/property-manager-invitations?context_id=${encodeURIComponent(active.context_id)}&property_id=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
      if (refreshed.ok) setPending(await refreshed.json() as Pending[]);
    } catch { setStatus(t.failed); } finally { setBusy(false); }
  }
  async function revoke(invitationId: string) {
    if (!active) return; setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/customer/v1/property-manager-invitations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_id: active.context_id, invitation_id: invitationId }) });
      if (!response.ok) throw new Error();
      setPending(rows => rows.filter(row => row.id !== invitationId));
    } catch { setStatus(t.failed); } finally { setBusy(false); }
  }
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="rounded-2xl border border-[#D3DCE6] bg-white p-5">
    <h2 className="text-lg font-bold text-[#102A43]">{t.title}</h2><p className="mt-1 text-sm text-[#52667A]">{t.hint} {t.expires}</p>
    {status && <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">{status}</p>}
    {properties.length === 0 ? <p className="mt-4 text-sm text-[#52667A]">{t.noProperties}</p> : <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
      <label className="text-sm">{t.property}<select required value={propertyId} onChange={event => setPropertyId(event.target.value)} className="mt-1 block w-full rounded-lg border p-2">{properties.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="text-sm">{t.email}<input required type="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <button disabled={busy || !propertyId} className="rounded-lg bg-[#087A6E] px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? '…' : t.send}</button>
    </form>}
    {pending.length > 0 && <div className="mt-5 border-t pt-4"><h3 className="font-semibold">{t.pending}</h3><ul className="mt-2 space-y-2">{pending.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span>{row.email} · {new Date(row.expires_at).toLocaleString(lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-GB')}</span><button disabled={busy} type="button" onClick={() => void revoke(row.id)} className="rounded border px-3 py-1 text-red-700 disabled:opacity-50">{t.revoke}</button></li>)}</ul></div>}
  </section>;
}
