'use client';

import {useEffect,useRef,useState} from 'react';
import {WorkOrderChecklistPanel} from './WorkOrderChecklistPanel';
import type {Language} from '@/types';

type Action='issue'|'start'|'complete'|'verify';
const copy={
 fa:{title:'اجرای دستورکار',status:'وضعیت',issue:'صدور به پیمانکار ثبت‌شده',start:'شروع کار',complete:'ثبت نتیجهٔ کار',verify:'تأیید نتیجه',notes:'شرح نتیجه یا یادداشت',cost:'هزینهٔ واقعی',saved:'ذخیره شد.',error:'عملیات انجام نشد. اطلاعات را بازخوانی و مجوز و ورود دومرحله‌ای را بررسی کنید.',uncertain:'وضعیت درخواست مشخص نیست. پیش از اقدام دوباره، صفحه را بازخوانی کنید.',forbidden:'این عملیات به مجوز معتبر و ورود دومرحله‌ای نیاز دارد.',conflict:'وضعیت دستورکار تغییر کرده است؛ اطلاعات را بازخوانی کنید.',note:'صدور از پیمانکار ذخیره‌شده استفاده می‌کند. ثبت نتیجه به معنی ثبت فاکتور یا پرداخت نیست.',draft:'پیش‌نویس',scheduled:'برنامه‌ریزی‌شده',assigned:'واگذارشده',in_progress:'در حال انجام',blocked:'متوقف',completed:'انجام‌شده',verified:'تأییدشده'},
 en:{title:'Work order execution',status:'Status',issue:'Issue to recorded contractor',start:'Start work',complete:'Record completion',verify:'Verify completion',notes:'Completion or verification notes',cost:'Actual cost',saved:'Saved.',error:'Action failed. Refresh and check permissions and MFA.',uncertain:'Request outcome is unknown. Refresh before trying again.',forbidden:'This action requires valid permission and MFA.',conflict:'Work order state changed. Refresh the records.',note:'Issuing uses the recorded contractor. Completion does not create an invoice or payment.',draft:'Draft',scheduled:'Scheduled',assigned:'Assigned',in_progress:'In progress',blocked:'On hold',completed:'Completed',verified:'Verified'},
 ro:{title:'Executarea ordinului',status:'Stare',issue:'Emite către furnizorul înregistrat',start:'Începe lucrul',complete:'Înregistrează finalizarea',verify:'Verifică finalizarea',notes:'Note de finalizare sau verificare',cost:'Cost real',saved:'Salvat.',error:'Operațiunea a eșuat. Reîncarcă și verifică permisiunile și MFA.',uncertain:'Rezultatul cererii este necunoscut. Reîncarcă înainte de a reîncerca.',forbidden:'Operațiunea necesită permisiune validă și MFA.',conflict:'Starea ordinului s-a schimbat. Reîncarcă datele.',note:'Emiterea folosește furnizorul înregistrat. Finalizarea nu creează factură sau plată.',draft:'Ciornă',scheduled:'Programat',assigned:'Atribuit',in_progress:'În lucru',blocked:'Suspendat',completed:'Finalizat',verified:'Verificat'},
} as const;
const nextAction:Record<string,Action|undefined>={draft:'issue',scheduled:'issue',assigned:'start',blocked:'start',in_progress:'complete',completed:'verify'};
const nextStatus:Record<Action,string>={issue:'assigned',start:'in_progress',complete:'completed',verify:'verified'};

export function WorkOrderLifecyclePanel({contextId,workOrderId,status,lang,onChanged}:{contextId:string;workOrderId:string;status:string;lang:Language;onChanged:(status:string)=>void}){
 const t=copy[lang];const action=nextAction[status];
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false),[checklistReady,setChecklistReady]=useState(false);
 const controller=useRef<AbortController|null>(null),pending=useRef(false);
 useEffect(()=>{controller.current=new AbortController();return()=>controller.current?.abort()},[]);
 async function submit(form:HTMLFormElement){
  if(!action||pending.current||uncertain||(action==='complete'&&!checklistReady))return;
  pending.current=true;setBusy(true);setMessage('');const signal=controller.current?.signal;
  const fields=new FormData(form);const body:Record<string,unknown>={context_id:contextId};
  if(action==='complete'){body.completion_notes=String(fields.get('notes')??'').trim();const cost=String(fields.get('cost')??'');if(cost!=='')body.actual_cost=Number(cost)}
  if(action==='verify')body.verification_notes=String(fields.get('notes')??'').trim();
  try{
   const response=await fetch(`/api/customer/v1/work-orders/${encodeURIComponent(workOrderId)}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(body),signal});
   if(signal?.aborted)return;
   if(!response.ok){setMessage(response.status===403?t.forbidden:response.status===409?t.conflict:t.error);if(response.status>=500)setUncertain(true);return}
   const result:unknown=await response.json();if(signal?.aborted)return;
   if(!result||typeof result!=='object'||!('id' in result)||result.id!==workOrderId||!('status' in result)||result.status!==nextStatus[action])throw Error('Unexpected response');
   form.reset();setMessage(t.saved);onChanged(result.status as string);
  }catch{if(!signal?.aborted){setUncertain(true);setMessage(t.uncertain)}}
  finally{pending.current=false;if(!signal?.aborted)setBusy(false)}
 }
 return <section className="mb-4 space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm">
  <h2 className="font-bold">{t.title}</h2><p>{t.status}: {status in t?t[status as keyof typeof t]:status}</p><p className="text-xs text-slate-600">{t.note}</p>
  {message?<p role="status">{message}</p>:null}
  {status==='in_progress'?<WorkOrderChecklistPanel contextId={contextId} workOrderId={workOrderId} lang={lang} onReady={setChecklistReady}/>:null}
  {action?<form className="space-y-3" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget)}}>
   {action==='complete'||action==='verify'?<label className="block">{t.notes}<textarea name="notes" required maxLength={2000} disabled={busy||uncertain} className="mt-1 block w-full rounded-lg border bg-white p-2"/></label>:null}
   {action==='complete'?<label className="block">{t.cost}<input name="cost" type="number" min="0" step="0.0001" disabled={busy||uncertain} className="mt-1 block w-full rounded-lg border bg-white p-2"/></label>:null}
   <button type="submit" disabled={busy||uncertain||(action==='complete'&&!checklistReady)} className="rounded-lg bg-teal-700 px-4 py-2 font-bold text-white disabled:opacity-50">{t[action]}</button>
  </form>:null}
 </section>;
}
