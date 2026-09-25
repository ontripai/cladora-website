'use client';

import { useCallback, useEffect, useState } from 'react';

type Item = { id: string; customer_workspace_id: string; platform_user_id: string; responsibility: string; status: string; valid_until: string | null; assignment_reason: string; revoke_reason: string | null };
type Choice = { id: string; display_name?: string; employee_ref?: string; tenant_legal_name?: string; commercial_owner?: string };
const duties = ['commercial_owner','sales_collaborator','contract_reviewer','finance_reviewer','onboarding_trainer','technical_contact'] as const;

export function CustomerStaffResponsibilitiesPanel({ lang }: { lang: string }) {
  const fa = lang === 'fa', ro = lang === 'ro';
  const label = (en: string, romanian: string, persian: string) => fa ? persian : ro ? romanian : en;
  const [rows, setRows] = useState<Item[]>([]);
  const [users, setUsers] = useState<Choice[]>([]);
  const [workspaces, setWorkspaces] = useState<Choice[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const load = useCallback(async () => {
    const response = await fetch(`/api/platform/v1/staff-responsibilities?limit=50&offset=${offset}`, { cache: 'no-store' });
    if (!response.ok) { setError('LOAD_FAILED'); return; }
    const data = await response.json();
    setRows(data.responsibilities ?? []);
    setTotal(data.pagination?.total ?? 0);
    setCanManage(data.canManage === true);
    if (data.canManage) {
      const [u, w] = await Promise.all([
        fetch('/api/platform/v1/users?limit=50', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/platform/v1/workspaces?limit=50', { cache: 'no-store' }).then(r => r.json()),
      ]);
      setUsers(u.users ?? []); setWorkspaces(w.workspaces ?? []);
    }
  }, [offset]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the protected server read model after mount
  useEffect(() => { void load(); }, [load]);

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/platform/v1/staff-responsibilities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error?.code ?? 'SAVE_FAILED'); }
      await load(); setForm(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'SAVE_FAILED'); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await mutate({ action: data.get('action'), workspace_id: data.get('workspace_id'),
      platform_user_id: data.get('platform_user_id'), responsibility: data.get('responsibility'),
      valid_until: data.get('valid_until') ? new Date(String(data.get('valid_until'))).toISOString() : null,
      reason: data.get('reason') });
  }
  return <section dir={fa ? 'rtl' : 'ltr'} className="space-y-4 rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-5 text-sm text-white">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">{label('Customer responsibility','Responsabilitate client','مسئولیت کارکنان برای مشتری')}</h2>
        <p className="text-xs text-slate-400">{label('Duties do not grant access to private customer records.','Sarcinile nu oferă acces la datele private ale clientului.','مسئولیت‌ها به‌تنهایی دسترسی به اطلاعات خصوصی مشتری نمی‌دهند.')}</p></div>
      {canManage && <button type="button" onClick={() => setForm(v => !v)} className="rounded bg-emerald-500 px-3 py-2 font-bold text-[#081320]">{label('Assign or transfer','Alocă sau transferă','تخصیص یا انتقال')}</button>}
    </div>
    {form && <form onSubmit={submit} className="grid gap-3 rounded-lg border border-[#1E3A5A] p-4 md:grid-cols-2">
      <label>{label('Action','Acțiune','اقدام')}<select name="action" className="mt-1 w-full rounded bg-[#081320] p-2"><option value="assign">{label('Assign','Alocă','تخصیص')}</option><option value="transfer">{label('Transfer owner','Transferă responsabilul','انتقال مسئول مستقیم')}</option></select></label>
      <label>{label('Duty (for assignment)','Responsabilitate','مسئولیت')}<select name="responsibility" className="mt-1 w-full rounded bg-[#081320] p-2">{duties.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
      <label>{label('Workspace ID','ID spațiu de lucru','شناسه محیط کاری')}<input required name="workspace_id" list="staff-workspaces" placeholder={label('Select or paste UUID','Selectați sau inserați UUID','انتخاب یا درج شناسه')} className="mt-1 w-full rounded bg-[#081320] p-2" /><datalist id="staff-workspaces">{workspaces.map(w => <option key={w.id} value={w.id} label={w.tenant_legal_name ?? w.commercial_owner ?? w.id} />)}</datalist></label>
      <label>{label('Employee ID','ID angajat','شناسه کارمند')}<input required name="platform_user_id" list="staff-users" placeholder={label('Select or paste UUID','Selectați sau inserați UUID','انتخاب یا درج شناسه')} className="mt-1 w-full rounded bg-[#081320] p-2" /><datalist id="staff-users">{users.map(u => <option key={u.id} value={u.id} label={`${u.display_name} · ${u.employee_ref}`} />)}</datalist></label>
      <label>{label('Expires (optional; not for owner)','Expiră (opțional; nu pentru responsabil)','پایان اعتبار (اختیاری؛ نه برای مسئول مستقیم)')}<input name="valid_until" type="datetime-local" className="mt-1 w-full rounded bg-[#081320] p-2" /></label>
      <label>{label('Audit reason','Motiv audit','دلیل قابل حسابرسی')}<textarea required minLength={8} maxLength={500} name="reason" className="mt-1 w-full rounded bg-[#081320] p-2" /></label>
      <button disabled={busy} className="rounded bg-emerald-500 px-3 py-2 font-bold text-[#081320] disabled:opacity-50">{label('Save','Salvează','ثبت')}</button>
    </form>}
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full text-start"><thead><tr className="border-b border-[#1E3A5A] text-slate-400"><th className="p-2 text-start">Workspace</th><th className="p-2 text-start">Employee</th><th className="p-2 text-start">Duty</th><th className="p-2 text-start">Status</th><th className="p-2 text-start">{label('Action','Acțiune','اقدام')}</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-[#1E3A5A]"><td className="p-2">{workspaces.find(w => w.id === row.customer_workspace_id)?.tenant_legal_name ?? row.customer_workspace_id}</td><td className="p-2">{users.find(u => u.id === row.platform_user_id)?.display_name ?? row.platform_user_id}</td><td className="p-2">{row.responsibility}</td><td className="p-2">{row.status}{row.valid_until ? ` · ${new Date(row.valid_until).toLocaleDateString(lang)}` : ''}</td><td className="p-2">{canManage && row.status === 'active' && <button disabled={busy} type="button" className="text-rose-300 underline" onClick={() => { const reason = window.prompt(label('Reason for revocation (8+ characters)','Motivul revocării (8+ caractere)','دلیل لغو (حداقل ۸ نویسه)')); if (reason) void mutate({ action: 'revoke', assignment_id: row.id, reason }); }}>{label('Revoke','Revocă','لغو')}</button>}</td></tr>)}</tbody></table></div>
    <div className="flex items-center justify-between text-xs text-slate-400"><span>{total ? `${offset + 1}–${Math.min(offset + 50, total)} / ${total}` : '0'}</span><div className="flex gap-2"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))} className="rounded border border-[#1E3A5A] px-3 py-1 disabled:opacity-40">{label('Previous','Anterior','قبلی')}</button><button type="button" disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)} className="rounded border border-[#1E3A5A] px-3 py-1 disabled:opacity-40">{label('Next','Următor','بعدی')}</button></div></div>
    {!rows.length && <p className="text-slate-400">{label('No responsibilities assigned.','Nicio responsabilitate alocată.','هنوز مسئولیتی ثبت نشده است.')}</p>}
  </section>;
}
