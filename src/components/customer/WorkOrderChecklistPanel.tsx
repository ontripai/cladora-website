'use client';
import {useEffect,useRef,useState} from 'react';
import {localizedMaintenanceText} from '@/lib/customer/maintenance-defaults';
import type {Language} from '@/types';
type Item={id:string;label:string;required:boolean;completed:boolean;notes:string|null};
const copy={fa:{title:'نتایج چک‌لیست',notes:'نتیجهٔ این بررسی',save:'ثبت بررسی',done:'ثبت‌شده',required:'الزامی',loading:'در حال دریافت چک‌لیست…',error:'دریافت یا ثبت چک‌لیست انجام نشد؛ اطلاعات را بازخوانی کنید.'},en:{title:'Checklist results',notes:'Result of this check',save:'Record check',done:'Recorded',required:'Required',loading:'Loading checklist…',error:'Checklist request failed. Refresh the records.'},ro:{title:'Rezultatele listei',notes:'Rezultatul verificării',save:'Înregistrează verificarea',done:'Înregistrat',required:'Obligatoriu',loading:'Se încarcă lista…',error:'Cererea listei a eșuat. Reîncarcă datele.'}};
export function WorkOrderChecklistPanel({contextId,workOrderId,lang,onReady}:{contextId:string;workOrderId:string;lang:Language;onReady:(ready:boolean)=>void}){
 const t=copy[lang],[items,setItems]=useState<Item[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),pending=useRef(false);
 useEffect(()=>{
  const abort=new AbortController();controller.current=abort;
  async function load(){try{const r=await fetch(`/api/customer/v1/work-orders/${encodeURIComponent(workOrderId)}/checklist?context_id=${encodeURIComponent(contextId)}`,{cache:'no-store',credentials:'same-origin',signal:abort.signal});if(!r.ok)throw Error();const data=await r.json();if(abort.signal.aborted)return;setItems(data.items);onReady(data.items.every((i:Item)=>!i.required||i.completed))}catch{if(!abort.signal.aborted)setError(t.error)}}
  void load();return()=>abort.abort();
 },[contextId,workOrderId,onReady,t.error]);
 async function record(itemId:string,form:HTMLFormElement){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');const signal=controller.current?.signal;
  try{const r=await fetch(`/api/customer/v1/work-orders/${encodeURIComponent(workOrderId)}/checklist`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({context_id:contextId,item_id:itemId,notes:new FormData(form).get('notes')})});if(!r.ok)throw Error();const data=await r.json();if(signal?.aborted)return;setItems(data.items);onReady(data.items.every((i:Item)=>!i.required||i.completed))}catch{if(!signal?.aborted){setError(t.error);onReady(false)}}finally{pending.current=false;if(!signal?.aborted)setBusy(false)}
 }
 return <section className="space-y-3"><h3 className="font-bold">{t.title}</h3>{error?<p role="alert">{error}</p>:null}{!items&&!error?<p>{t.loading}</p>:items?.map(i=><article key={i.id} className="rounded-lg border bg-white p-3"><h4>{localizedMaintenanceText(i.label,lang)} {i.required?`· ${t.required}`:''}</h4>{i.completed?<p>{t.done} · {i.notes}</p>:<form className="mt-2 space-y-2" onSubmit={e=>{e.preventDefault();void record(i.id,e.currentTarget)}}><label className="block">{t.notes}<textarea name="notes" required minLength={10} maxLength={2000} disabled={busy} className="block w-full rounded-lg border p-2"/></label><button disabled={busy} className="rounded-lg border px-3 py-2 font-bold">{t.save}</button></form>}</article>)}</section>;
}
