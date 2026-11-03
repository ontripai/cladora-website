'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { workspaceCostBenchmarkV1Schema, type WorkspaceCostBenchmarkV1 } from '@/lib/customer/workspace-cost-benchmark-v1';

const copy = {
  ro: { title:'Comparație costuri', sub:'Cheltuielile înregistrate sunt comparate cu perioada anterioară de aceeași durată.', from:'De la', to:'Până la', currency:'Monedă', refresh:'Compară', current:'Perioada curentă', previous:'Perioada anterioară', change:'Schimbare', categories:'Categorii de cheltuieli', empty:'Nu există cheltuieli înregistrate în aceste perioade.', withheld:'Comparația regională nu este afișată fără un set de date aprobat.', failed:'Comparația nu a putut fi încărcată.', loading:'Se calculează…' },
  en: { title:'Cost comparison', sub:'Recorded expenses are compared with the immediately preceding period of equal length.', from:'From', to:'To', currency:'Currency', refresh:'Compare', current:'Current period', previous:'Previous period', change:'Change', categories:'Expense categories', empty:'No recorded expenses exist in these periods.', withheld:'Regional comparison is withheld until an approved dataset exists.', failed:'The comparison could not be loaded.', loading:'Calculating…' },
  fa: { title:'مقایسهٔ هزینه', sub:'هزینه‌های ثبت‌شده با بازهٔ قبلی هم‌اندازه مقایسه می‌شوند.', from:'از', to:'تا', currency:'ارز', refresh:'مقایسه', current:'بازهٔ جاری', previous:'بازهٔ قبلی', change:'تغییر', categories:'گروه‌های هزینه', empty:'در این بازه‌ها هزینهٔ ثبت‌شده‌ای وجود ندارد.', withheld:'مقایسهٔ منطقه‌ای تا وجود dataset تأییدشده نمایش داده نمی‌شود.', failed:'دریافت مقایسه ناموفق بود.', loading:'در حال محاسبه…' },
} as const;

const isoDate=(date:Date)=>date.toISOString().slice(0,10);
const money=(value:number,currency:string,lang:Language)=>new Intl.NumberFormat(lang==='fa'?'fa-IR':lang==='ro'?'ro-RO':'en-GB',{style:'currency',currency,maximumFractionDigits:2}).format(value);

export function CustomerCostBenchmark({lang}:{lang:Language}){
 const {active,dashboard}=useCustomerContext(); const fetch=useDashboardFetch(); const t=copy[lang];
 const contextId=active?.context_id;const workspaceId=dashboard?.workspace_id;
 const defaults=useMemo(()=>{const end=new Date();const start=new Date(end);start.setUTCDate(start.getUTCDate()-29);return{start:isoDate(start),end:isoDate(end)};},[]);
 const [start,setStart]=useState(defaults.start);const [end,setEnd]=useState(defaults.end);const [currency,setCurrency]=useState('RON');
 const [data,setData]=useState<WorkspaceCostBenchmarkV1|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async(signal?:AbortSignal)=>{if(!contextId||!workspaceId)return;setLoading(true);setError('');
  try{const response=await fetch(`/api/customer/v1/cost-benchmark?${new URLSearchParams({context_id:contextId,workspace_id:workspaceId,period_start:start,period_end:end,currency})}`,{cache:'no-store',credentials:'same-origin',signal});
   if(!response.ok)throw new Error('failed');const parsed=workspaceCostBenchmarkV1Schema.parse(await response.json());if(parsed.workspace_id!==workspaceId)throw new Error('failed');setData(parsed);
  }catch(reason){if(!(reason instanceof DOMException&&reason.name==='AbortError')){setData(null);setError(t.failed);}}finally{if(!signal?.aborted)setLoading(false);}
 },[contextId,workspaceId,start,end,currency,fetch,t.failed]);
 useEffect(()=>{const controller=new AbortController();queueMicrotask(()=>void load(controller.signal));return()=>controller.abort();},[load]);
 if(!active||!dashboard)return null;
 return <section dir={lang==='fa'?'rtl':'ltr'} className="space-y-4 rounded-2xl border bg-white p-5">
  <header><h2 className="text-xl font-bold text-[#102A43]">{t.title}</h2><p className="mt-1 text-sm text-[#52667A]">{t.sub}</p></header>
  <div className="grid gap-3 sm:grid-cols-4"><label className="text-sm"><span>{t.from}</span><input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-sm"><span>{t.to}</span><input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-sm"><span>{t.currency}</span><select value={currency} onChange={(e)=>setCurrency(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option>RON</option><option>EUR</option><option>USD</option></select></label><button type="button" disabled={loading} onClick={()=>void load()} className="self-end rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{loading?t.loading:t.refresh}</button></div>
  {error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>:null}
  {data?<><div className="grid gap-3 sm:grid-cols-3"><Metric label={t.current} value={money(data.current_period.expense_total,data.currency,lang)}/><Metric label={t.previous} value={money(data.previous_period.expense_total,data.currency,lang)}/><Metric label={t.change} value={`${money(data.delta_amount,data.currency,lang)}${data.delta_percent===null?'':` · ${data.delta_percent.toFixed(2)}%`}`}/></div><p role="note" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t.withheld}</p><div><h3 className="font-semibold">{t.categories}</h3>{data.categories.length?<div className="mt-2 overflow-x-auto"><table className="w-full text-sm"><tbody>{data.categories.map((item)=><tr key={item.account_code} className="border-t"><th className="p-2 text-start">{item.account_code} · {item.account_name}</th><td className="p-2 text-end">{money(item.current_amount,data.currency,lang)}</td><td className="p-2 text-end">{money(item.delta_amount,data.currency,lang)}</td></tr>)}</tbody></table></div>:<p className="mt-2 text-sm text-[#52667A]">{t.empty}</p>}</div></>:null}
 </section>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-[#52667A]">{label}</p><p className="mt-1 text-lg font-bold text-[#102A43]">{value}</p></div>;}
