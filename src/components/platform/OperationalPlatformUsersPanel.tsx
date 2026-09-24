'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, UserRound } from 'lucide-react';

type User = { id: string; employee_ref: string; display_name: string; status: string; roles: string[]; role_assignments: { id: string; role: string }[]; created_at: string; updated_at: string };
type Payload = { users: User[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } };

export function OperationalPlatformUsersPanel({ lang }: { lang: string }) {
  const fa = lang === 'fa'; const ro = lang === 'ro';
  const t = (en: string, romanian: string, persian: string) => fa ? persian : ro ? romanian : en;
  const [q, setQ] = useState(''); const [query, setQuery] = useState(''); const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0); const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [selected, setSelected] = useState<User | null>(null);
  const loadError = fa ? 'بارگذاری کاربران ممکن نشد.' : ro ? 'Utilizatorii nu au putut fi încărcați.' : 'Users could not be loaded.';
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ limit: '20', offset: String(offset) }); if (query) p.set('q', query); if (status) p.set('status', status);
      const response = await fetch(`/api/platform/v1/users?${p}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status)); setPayload(await response.json());
    } catch { setError(loadError); }
    finally { setLoading(false); }
  }, [offset, query, status, loadError]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- request state is synchronized with query controls
  useEffect(() => { void load(); }, [load]);

  return <div className="space-y-4" dir={fa ? 'rtl' : 'ltr'}>
    <form className="grid gap-3 rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-4 md:grid-cols-[1fr_220px_auto]" onSubmit={(e) => { e.preventDefault(); setOffset(0); setQuery(q.trim()); }}>
      <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"/><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Name or employee reference', 'Nume sau referință angajat', 'نام یا شناسه کارمندی')} className="w-full rounded-lg border border-[#1E3A5A] bg-[#081320] py-2 pl-9 pr-3 text-sm text-white"/></label>
      <select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className="rounded-lg border border-[#1E3A5A] bg-[#081320] px-3 py-2 text-sm text-white"><option value="">{t('All statuses','Toate stările','همه وضعیت‌ها')}</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="archived">Archived</option></select>
      <button className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-bold text-[#081320]">{t('Search','Caută','جست‌وجو')}</button>
    </form>
    {loading ? <State text={t('Loading authorized users…','Se încarcă utilizatorii autorizați…','در حال بارگذاری کاربران مجاز…')}/> : error ? <State text={error} retry={load}/> : !payload?.users.length ? <State text={t('No authorized users match these filters.','Niciun utilizator autorizat nu corespunde filtrelor.','هیچ کاربر مجازی با این فیلترها یافت نشد.')}/> : <>
      <div className="overflow-x-auto rounded-xl border border-[#1E3A5A] bg-[#0F2236]"><table className="w-full text-left text-xs"><thead className="bg-[#081320] text-slate-400"><tr><th className="p-4">{t('Operator','Operator','کاربر')}</th><th className="p-4">{t('Status','Stare','وضعیت')}</th><th className="p-4">{t('Active roles','Roluri active','نقش‌های فعال')}</th><th className="p-4">{t('Created','Creat','ایجاد')}</th><th className="p-4">{t('Details','Detalii','جزئیات')}</th></tr></thead><tbody className="divide-y divide-[#1E3A5A]">{payload.users.map((u) => <tr key={u.id} className="text-slate-300"><td className="p-4"><b className="block text-white">{u.display_name}</b><span className="font-mono text-[10px]">{u.employee_ref}</span></td><td className="p-4 uppercase text-emerald-300">{u.status}</td><td className="p-4"><div className="flex flex-wrap gap-1">{u.roles.length ? u.roles.map(r => <span key={r} className="rounded border border-[#1D4A73] bg-[#14324F] px-2 py-1 font-mono text-[10px] text-emerald-300">{r}</span>) : '—'}</div></td><td className="p-4">{new Date(u.created_at).toLocaleDateString(lang)}</td><td className="p-4"><button onClick={() => setSelected(u)} className="rounded border border-[#1D4A73] px-3 py-1 text-emerald-300">{t('View','Vezi','مشاهده')}</button></td></tr>)}</tbody></table></div>
      <Pager offset={offset} total={payload.pagination.total} hasMore={payload.pagination.hasMore} setOffset={setOffset} lang={lang}/>
    </>}
    {selected && <div className="rounded-xl border border-emerald-500/30 bg-[#0F2236] p-5 text-sm text-slate-300"><div className="flex justify-between"><h2 className="font-bold text-white"><UserRound className="mr-2 inline h-4 w-4"/>{selected.display_name}</h2><button onClick={() => setSelected(null)}>×</button></div><dl className="mt-4 grid gap-3 md:grid-cols-2"><div><dt className="text-slate-500">ID</dt><dd className="font-mono">{selected.id}</dd></div><div><dt className="text-slate-500">{t('Employee reference','Referință angajat','شناسه کارمندی')}</dt><dd>{selected.employee_ref}</dd></div><div><dt className="text-slate-500">{t('Updated','Actualizat','آخرین به‌روزرسانی')}</dt><dd>{new Date(selected.updated_at).toLocaleString(lang)}</dd></div><div><dt className="text-slate-500">{t('Roles','Roluri','نقش‌ها')}</dt><dd>{selected.roles.join(', ') || '—'}</dd></div></dl>{selected.role_assignments?.length > 0 && <ul className="mt-4 space-y-2 text-xs">{selected.role_assignments.map(a => <li key={a.id}>{a.role} · <span className="font-mono">{a.id}</span></li>)}</ul>}</div>}
  </div>;
}

function State({ text, retry }: { text: string; retry?: () => void }) { return <div className="rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-10 text-center text-sm text-slate-300">{text}{retry && <button onClick={retry} className="ml-3 text-emerald-300">Retry</button>}</div>; }
function Pager({ offset,total,hasMore,setOffset,lang }:{offset:number;total:number;hasMore:boolean;setOffset:(n:number)=>void;lang:string}) { return <div className="flex items-center justify-between text-xs text-slate-400"><span>{offset + 1}–{Math.min(offset + 20,total)} / {total}</span><div className="flex gap-2"><button disabled={!offset} onClick={() => setOffset(Math.max(0,offset-20))} className="rounded border border-[#1E3A5A] px-3 py-2 disabled:opacity-40">{lang==='fa'?'قبلی':'Previous'}</button><button disabled={!hasMore} onClick={() => setOffset(offset+20)} className="rounded border border-[#1E3A5A] px-3 py-2 disabled:opacity-40">{lang==='fa'?'بعدی':'Next'}</button></div></div>; }
