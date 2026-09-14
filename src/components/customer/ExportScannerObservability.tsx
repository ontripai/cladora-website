'use client';
import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,RefreshCw,ShieldCheck} from 'lucide-react';
import type {Language} from '@/types';
import {useCustomerContext} from './CustomerContextProvider';

type Summary={total:number;pending:number;leased:number;retry:number;completed:number;dead_letter:number;stalled:number;retry_warning:number};
type Job={id:string;state:string;provider:string;attempt_count:number;max_attempts:number;next_attempt_at:string;last_error_code:string|null;updated_at:string;stalled:boolean;retry_warning:boolean};
type Data={summary:Summary;jobs:Job[];generated_at:string};
const C={
 ro:{title:'Starea scanării exporturilor',sub:'Monitorizare AAL2, limitată la context, fără nume de fișiere sau secrete.',refresh:'Actualizează',empty:'Nu există lucrări de scanare.',error:'Starea cozii nu a putut fi încărcată.',noContext:'Selectați un context activ.',pending:'În așteptare',leased:'În lucru',retry:'Reîncercare',done:'Finalizate',dead:'Dead-letter',stalled:'Blocate',attempts:'Încercări',healthy:'Coada funcționează normal',attention:'Coada necesită atenție'},
 en:{title:'Export scanner health',sub:'AAL2-protected, context-scoped monitoring with filenames and secrets redacted.',refresh:'Refresh',empty:'No scan jobs are present.',error:'Queue health could not be loaded.',noContext:'Select an active context.',pending:'Pending',leased:'In progress',retry:'Retry',done:'Completed',dead:'Dead-letter',stalled:'Stalled',attempts:'Attempts',healthy:'Queue is healthy',attention:'Queue needs attention'},
 fa:{title:'سلامت اسکنر خروجی‌ها',sub:'پایش محدود به زمینه و محافظت‌شده با AAL2؛ نام فایل‌ها و اطلاعات محرمانه حذف شده‌اند.',refresh:'تازه‌سازی',empty:'هیچ وظیفه اسکنی وجود ندارد.',error:'دریافت وضعیت صف ناموفق بود.',noContext:'یک زمینه فعال انتخاب کنید.',pending:'در انتظار',leased:'در حال اجرا',retry:'تلاش مجدد',done:'تکمیل‌شده',dead:'صف شکست نهایی',stalled:'متوقف‌شده',attempts:'تلاش‌ها',healthy:'صف سالم است',attention:'صف نیازمند رسیدگی است'}
} as const;

export function ExportScannerObservability({lang}:{lang:Language}){
 const {active}=useCustomerContext();const contextId=active?.context_id;const t=C[lang];const [data,setData]=useState<Data|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState(false);
 const load=useCallback(async()=>{if(!contextId){setData(null);return}setLoading(true);setError(false);try{const r=await fetch(`/api/customer/v1/export-scanner/observability?context_id=${encodeURIComponent(contextId)}&limit=25`,{cache:'no-store',headers:{Pragma:'no-cache'}});if(!r.ok)throw new Error('load');setData(await r.json() as Data)}catch{setData(null);setError(true)}finally{setLoading(false)}},[contextId]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load]);
 if(!active)return <section className="card-proptech bg-white p-6"><p>{t.noContext}</p></section>;
 const alert=Boolean(data&&(data.summary.dead_letter||data.summary.stalled||data.summary.retry_warning));
 const metrics=data?[['pending',t.pending,data.summary.pending],['leased',t.leased,data.summary.leased],['retry',t.retry,data.summary.retry],['completed',t.done,data.summary.completed],['dead',t.dead,data.summary.dead_letter],['stalled',t.stalled,data.summary.stalled]]:[];
 return <section className="card-proptech space-y-5 bg-white p-6" aria-labelledby="scanner-health-title">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="scanner-health-title" className="text-xl font-extrabold text-[#102A43]">{t.title}</h2><p className="mt-1 text-xs text-[#52667A]">{t.sub}</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>{t.refresh}</button></div>
  {error?<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{t.error}</p>:null}
  {data?<><div role="status" className={`flex items-center gap-2 rounded-xl p-3 text-sm font-bold ${alert?'bg-amber-50 text-amber-900':'bg-emerald-50 text-emerald-800'}`}>{alert?<AlertTriangle className="h-5 w-5"/>:<ShieldCheck className="h-5 w-5"/>}{alert?t.attention:t.healthy}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{metrics.map(([key,label,value])=><div key={String(key)} className="rounded-xl border p-3"><div className="text-xs text-[#52667A]">{label}</div><div className="mt-1 text-xl font-extrabold">{value}</div></div>)}</div>{data.jobs.length?<div className="overflow-x-auto"><table className="w-full text-start text-xs"><thead><tr className="border-b"><th className="p-2 text-start">ID</th><th className="p-2 text-start">Status</th><th className="p-2 text-start">{t.attempts}</th><th className="p-2 text-start">Code</th></tr></thead><tbody>{data.jobs.map(j=><tr key={j.id} className="border-b"><td className="p-2 font-mono">{j.id.slice(0,8)}</td><td className="p-2">{j.state}</td><td className="p-2">{j.attempt_count}/{j.max_attempts}</td><td className="p-2 font-mono">{j.last_error_code??'—'}</td></tr>)}</tbody></table></div>:<p className="text-sm text-[#52667A]">{t.empty}</p>}</>:null}
 </section>;
}
