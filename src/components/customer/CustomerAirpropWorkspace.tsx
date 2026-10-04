'use client';
import { useEffect, useRef, useState } from 'react';
import type { Language } from '@/types';
import { CustomerAirpropUnderwriting } from './CustomerAirpropUnderwriting';
import { useCustomerContext } from './CustomerContextProvider';
import { createAirpropOpportunityV2Schema } from '@/lib/airprop/opportunity-contract-v2';

const copy = {
 en: { title: 'AIRPROP workspace', choose: 'Select workspace', empty: 'No authorized workspace is available in this context.', context: 'Select a context to continue.', error: 'Unable to load this workspace.', name: 'Opportunity name', city: 'City', price: 'Asking price', currency: 'Currency', create: 'Create opportunity', retry: 'Retry the same request', pending: 'The result is uncertain. Retry this request before creating another opportunity.', invalid: 'Check the name, city and positive price (up to four decimal places).', denied: 'This action is unavailable with your current access.', mfa: 'Complete multi-factor authentication to continue.', success: 'Opportunity saved.', opportunities: 'Opportunities', none: 'No opportunities yet.', loading: 'Loading…', status: 'Status', refresh: 'Refresh', draft: 'Draft', qualified: 'Qualified', underwriting: 'Underwriting', approved: 'Approved', rejected: 'Rejected', archived: 'Archived' },
 ro: { title: 'Workspace AIRPROP', choose: 'Selectează workspace-ul', empty: 'Nu există un workspace autorizat în acest context.', context: 'Selectează un context pentru a continua.', error: 'Workspace-ul nu poate fi încărcat.', name: 'Numele oportunității', city: 'Oraș', price: 'Preț solicitat', currency: 'Monedă', create: 'Creează oportunitatea', retry: 'Reîncearcă aceeași cerere', pending: 'Rezultatul este incert. Reîncearcă această cerere înainte de a crea altă oportunitate.', invalid: 'Verifică numele, orașul și prețul pozitiv (maximum patru zecimale).', denied: 'Acțiunea nu este disponibilă cu accesul actual.', mfa: 'Finalizează autentificarea multifactor pentru a continua.', success: 'Oportunitate salvată.', opportunities: 'Oportunități', none: 'Nu există încă oportunități.', loading: 'Se încarcă…', status: 'Stare', refresh: 'Actualizează', draft: 'Ciornă', qualified: 'Calificată', underwriting: 'Analiză', approved: 'Aprobată', rejected: 'Respinsă', archived: 'Arhivată' },
 fa: { title: 'ورک‌اسپیس AIRPROP', choose: 'انتخاب ورک‌اسپیس', empty: 'در این زمینه، ورک‌اسپیس مجازی برای شما در دسترس نیست.', context: 'برای ادامه یک زمینهٔ دسترسی انتخاب کنید.', error: 'اطلاعات ورک‌اسپیس دریافت نشد.', name: 'نام فرصت', city: 'شهر', price: 'قیمت پیشنهادی', currency: 'ارز', create: 'ثبت فرصت', retry: 'تلاش مجدد برای همین درخواست', pending: 'نتیجهٔ درخواست مشخص نیست. پیش از ثبت فرصت دیگر، همین درخواست را دوباره ارسال کنید.', invalid: 'نام، شهر و قیمت مثبت با حداکثر چهار رقم اعشار را بررسی کنید.', denied: 'این اقدام با دسترسی فعلی شما مجاز نیست.', mfa: 'برای ادامه احراز هویت چندمرحله‌ای را تکمیل کنید.', success: 'فرصت ثبت شد.', opportunities: 'فرصت‌ها', none: 'هنوز فرصتی ثبت نشده است.', loading: 'در حال دریافت…', status: 'وضعیت', refresh: 'تازه‌سازی', draft: 'پیش‌نویس', qualified: 'ارزیابی اولیه', underwriting: 'تحلیل', approved: 'تأییدشده', rejected: 'ردشده', archived: 'بایگانی‌شده' },
};
type Target = { workspace_id: string; workspace_type: string; environment: string };
type Opportunity = { opportunity_id: string; name: string; city: string; currency: string; asking_price: string; status: string };
export function CustomerAirpropWorkspace({ lang }: { lang: Language }) {
 const { active } = useCustomerContext();
 return <section className="mx-auto max-w-5xl space-y-6 p-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
  <h1 className="text-2xl font-semibold">{copy[lang].title}</h1>
  {active ? <WorkspaceSelection key={active.context_id} contextId={active.context_id} lang={lang} /> : <p>{copy[lang].context}</p>}
 </section>;
}
function WorkspaceSelection({ contextId, lang }: { contextId: string; lang: Language }) {
 const t=copy[lang]; const [targets,setTargets]=useState<Target[]|null>(null),[workspace,setWorkspace]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch(`/api/customer/v1/workspace/targets?context_id=${encodeURIComponent(contextId)}`,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();const body=await r.json();if(!Array.isArray(body.workspaces))throw new Error();if(controller.signal.aborted)return;setTargets(body.workspaces);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[contextId]);
 if(error)return <p role="alert">{t.error}</p>;
 if(!targets)return <p role="status">{t.loading}</p>;
 if(!targets.length)return <p>{t.empty}</p>;
 return <div className="space-y-6"><label className="block">{t.choose}<select className="ms-3 rounded border p-2" value={workspace} onChange={e=>setWorkspace(e.target.value)}><option value="">—</option>{targets.map(x=><option key={x.workspace_id} value={x.workspace_id}>{x.workspace_id} · {x.environment}</option>)}</select></label>
  {workspace&&<OpportunityPanel key={workspace} contextId={contextId} workspaceId={workspace} lang={lang}/>}</div>;
}
function OpportunityPanel({ contextId,workspaceId,lang }: { contextId:string;workspaceId:string;lang:Language }) {
 const t=copy[lang]; const [rows,setRows]=useState<Opportunity[]|null>(null),[loadError,setLoadError]=useState(false),[nonce,setNonce]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [name,setName]=useState(''),[city,setCity]=useState(''),[price,setPrice]=useState(''),[currency,setCurrency]=useState('EUR');
 const [selectedOpportunity,setSelectedOpportunity]=useState('');
 const selected=rows?.find(row=>row.opportunity_id===selectedOpportunity);
 const evaluate=lang==='fa'?'ارزیابی':lang==='ro'?'Analizează':'Evaluate';
 const pending=useRef<ReturnType<typeof createAirpropOpportunityV2Schema.parse>|null>(null);
 const alive=useRef(true);
 const storageKey=`cladora.airprop.pending.v2:${contextId}:${workspaceId}`;
 const [recovering,setRecovering]=useState(true);
 useEffect(()=>{let cancelled=false;Promise.resolve().then(()=>{if(cancelled)return;try{const saved=sessionStorage.getItem(storageKey);if(saved){const parsed=createAirpropOpportunityV2Schema.safeParse(JSON.parse(saved));if(parsed.success&&parsed.data.context_id===contextId&&parsed.data.workspace_id===workspaceId){pending.current=parsed.data;const p=parsed.data.payload;setName(p.name);setCity(p.city);setPrice(p.asking_price);setCurrency(p.currency);setUncertain(true);setMessage(t.pending);}else sessionStorage.removeItem(storageKey);}}catch{setMessage(t.error);}setRecovering(false);});return()=>{cancelled=true;};},[storageKey,contextId,workspaceId,t.pending,t.error]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const controller=new AbortController();fetch(`/api/customer/v2/airprop/opportunities?context_id=${encodeURIComponent(contextId)}&workspace_id=${encodeURIComponent(workspaceId)}`,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error();const body=await r.json();if(!Array.isArray(body.opportunities))throw new Error();if(controller.signal.aborted)return;setRows(body.opportunities);setLoadError(false);}).catch(()=>{if(!controller.signal.aborted)setLoadError(true);});return()=>controller.abort();},[contextId,workspaceId,nonce]);
 async function submit(event:React.FormEvent){event.preventDefault();if(busy)return;
  if(!pending.current){const parsed=createAirpropOpportunityV2Schema.safeParse({version:2,context_id:contextId,workspace_id:workspaceId,idempotency_key:crypto.randomUUID(),payload:{name,city,asking_price:price,currency,country_code:'RO'}});if(!parsed.success){setMessage(t.invalid);return;}pending.current=parsed.data;}
  try{sessionStorage.setItem(storageKey,JSON.stringify(pending.current));}catch{setMessage(t.error);return;}
  setBusy(true);setMessage('');
  try{const r=await fetch('/api/customer/v2/airprop/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(pending.current)});
   if(!alive.current)return;
   if(r.ok){const body=await r.json();if(body.version!==2||body.workspace_id!==workspaceId||!body.opportunity_id)throw new Error();sessionStorage.removeItem(storageKey);pending.current=null;setUncertain(false);setName('');setCity('');setPrice('');setMessage(t.success);setNonce(n=>n+1);}
   else if(r.status>=500){setUncertain(true);setMessage(t.pending);}
   else {const body=await r.json();if(!uncertain){sessionStorage.removeItem(storageKey);pending.current=null;setUncertain(false);}setMessage(body.error?.code==='MFA_REQUIRED'?t.mfa:r.status===403?t.denied:t.invalid);}
  }catch{if(alive.current){setUncertain(true);setMessage(t.pending);}}finally{if(alive.current)setBusy(false);}
 }
 return <div className="space-y-6"><form onSubmit={submit} className="space-y-3 rounded border p-4"><fieldset disabled={busy||uncertain||recovering} className="grid gap-3 sm:grid-cols-2">
  <label>{t.name}<input required maxLength={160} className="block w-full rounded border p-2" value={name} onChange={e=>setName(e.target.value)}/></label>
  <label>{t.city}<input required maxLength={120} className="block w-full rounded border p-2" value={city} onChange={e=>setCity(e.target.value)}/></label>
  <label>{t.price}<input required inputMode="decimal" dir="ltr" className="block w-full rounded border p-2" value={price} onChange={e=>setPrice(e.target.value)}/></label>
  <label>{t.currency}<select className="block w-full rounded border p-2" value={currency} onChange={e=>setCurrency(e.target.value)}><option>EUR</option><option>RON</option></select></label>
 </fieldset><button disabled={busy||recovering} className="rounded bg-slate-900 px-4 py-2 text-white">{busy?t.loading:uncertain?t.retry:t.create}</button><p role="status" aria-live="polite">{message}</p></form>
 <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{t.opportunities}</h2><button onClick={()=>setNonce(n=>n+1)}>{t.refresh}</button></div>
 {loadError?<p role="alert">{t.error}</p>:!rows?<p>{t.loading}</p>:!rows.length?<p>{t.none}</p>:<div className="overflow-x-auto"><table className="w-full text-start"><thead><tr>{[t.name,t.city,t.price,t.status,evaluate].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.opportunity_id}><td className="p-2">{row.name}</td><td className="p-2">{row.city}</td><td className="p-2" dir="ltr">{row.asking_price} {row.currency}</td><td className="p-2">{t[row.status as keyof typeof t]??row.status}</td><td className="p-2"><button type="button" aria-pressed={selectedOpportunity===row.opportunity_id} aria-label={`${evaluate}: ${row.name}`} onClick={()=>setSelectedOpportunity(row.opportunity_id)}>{evaluate}</button></td></tr>)}</tbody></table></div>}
 {selected&&!loadError&&<CustomerAirpropUnderwriting contextId={contextId} workspaceId={workspaceId} opportunityId={selected.opportunity_id} opportunityName={selected.name} currency={selected.currency} lang={lang} onSaved={()=>setNonce(n=>n+1)}/>}
 </div>;
}
