'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Language} from '@/types';
type Vendor={id:string;name:string;status:string;service_categories:string[]};
const copy={
 fa:{title:'ثبت و تأیید پیمانکار',note:'پیمانکار در سطح انجمن ثبت می‌شود؛ تأیید تجاری، حساب ورود یا دسترسی پرتال ایجاد نمی‌کند. فقط پس از بررسی صلاحیت، دلیل تأیید را ثبت کنید.',scope:'برای ثبت پیمانکار، زمینهٔ انجمن را انتخاب کنید.',name:'نام شرکت پیمانکار',category:'خدمت',register:'ثبت نامزد',reason:'دلیل تأیید',approve:'تأیید پیمانکار',refresh:'بازخوانی پیمانکاران',loading:'در حال دریافت پیمانکاران…',empty:'پیمانکاری ثبت نشده است.',error:'عملیات انجام نشد؛ مجوز تدارکات، زمینهٔ انجمن و ورود دومرحله‌ای را بررسی کنید.',success:'عملیات ذخیره شد.',candidate:'نامزد',approved:'تأییدشده',close:'بستن',ventilation:'تهویه',pump:'پمپ',elevator:'آسانسور',fire_safety:'ایمنی آتش‌نشانی',other:'سایر'},
 en:{title:'Register and approve contractors',note:'Contractors belong to the association. Commercial approval creates no login or portal access. Record an approval reason only after checking suitability.',scope:'Select the association context to register contractors.',name:'Contractor company name',category:'Service',register:'Register candidate',reason:'Approval reason',approve:'Approve contractor',refresh:'Refresh contractors',loading:'Loading contractors…',empty:'No contractors registered.',error:'Operation failed. Check procurement permissions, association context and MFA.',success:'Saved.',candidate:'Candidate',approved:'Approved',close:'Close',ventilation:'Ventilation',pump:'Pump',elevator:'Elevator',fire_safety:'Fire safety',other:'Other'},
 ro:{title:'Înregistrare și aprobare furnizori',note:'Furnizorii aparțin asociației. Aprobarea comercială nu creează cont sau acces în portal. Introduceți motivul aprobării după verificarea eligibilității.',scope:'Selectați contextul asociației pentru înregistrare.',name:'Denumirea companiei furnizor',category:'Serviciu',register:'Înregistrează candidat',reason:'Motivul aprobării',approve:'Aprobă furnizor',refresh:'Reîncarcă furnizorii',loading:'Se încarcă furnizorii…',empty:'Nu există furnizori înregistrați.',error:'Operațiunea a eșuat. Verificați permisiunile, contextul asociației și MFA.',success:'Salvat.',candidate:'Candidat',approved:'Aprobat',close:'Închide',ventilation:'Ventilație',pump:'Pompă',elevator:'Ascensor',fire_safety:'Siguranță la incendiu',other:'Altele'},
};
const categories=['ventilation','pump','elevator','fire_safety','other'] as const;
const button='rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50';
const input='w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900 disabled:opacity-50';
export default function ContractorRegistrationPanel(props:{contextId:string;scope:string;lang:Language;onChanged:()=>Promise<void>}){
 return props.scope==='tenant'?<Panel key={props.contextId} {...props}/>:<p className="text-sm text-slate-600">{copy[props.lang].scope}</p>;
}
function Panel({contextId,lang,onChanged}:{contextId:string;lang:Language;onChanged:()=>Promise<void>}){
 const t=copy[lang];const [open,setOpen]=useState(false);const [rows,setRows]=useState<Vendor[]>([]);const [canApprove,setCanApprove]=useState(false);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(false);const [message,setMessage]=useState('');
 const controller=useRef<AbortController|null>(null);const registrationId=useRef<string|null>(null);
 useEffect(()=>{controller.current=new AbortController();return()=>controller.current?.abort()},[]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  try{const r=await fetch(`/api/customer/v1/procurement/contractors?context_id=${encodeURIComponent(contextId)}`,{cache:'no-store',signal});if(!r.ok)throw Error();const data=await r.json();if(signal?.aborted)return;setRows(data.vendors);setCanApprove(data.can_approve)}catch{if(!signal?.aborted)setMessage(t.error)}finally{if(!signal?.aborted)setLoading(false)}
 },[contextId,t.error]);
 async function mutate(payload:Record<string,unknown>,form:HTMLFormElement){
  if(busy)return;setBusy(true);setMessage('');const signal=controller.current?.signal;
  try{const r=await fetch('/api/customer/v1/procurement/contractors',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context_id:contextId,...payload}),signal});if(!r.ok)throw Error();if(signal?.aborted)return;if(payload.action==='register')registrationId.current=null;form.reset();setMessage(t.success);await load(signal);if(!signal?.aborted)await onChanged()}catch{if(!signal?.aborted)setMessage(t.error)}finally{if(!signal?.aborted)setBusy(false)}
 }
 return <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
  <button type="button" className={button} disabled={busy} aria-expanded={open} onClick={()=>{setMessage('');if(!open){setLoading(true);void load(controller.current?.signal)}setOpen(!open)}}>{open?t.close:t.title}</button>
  {open&&<div className="mt-4 space-y-4"><h2 className="text-lg font-bold">{t.title}</h2><p>{t.note}</p>{message&&<p role="status">{message}</p>}
   <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;const d=new FormData(f);registrationId.current??=crypto.randomUUID();void mutate({action:'register',id:registrationId.current,name:d.get('name'),category:d.get('category')},f)}}>
    <label>{t.name}<input className={input} name="name" required maxLength={200} disabled={busy}/></label>
    <label>{t.category}<select className={input} name="category" disabled={busy}>{categories.map(c=><option key={c} value={c}>{t[c]}</option>)}</select></label>
    <button className={button} disabled={busy||loading}>{t.register}</button>
   </form>
   <button type="button" className="rounded-lg border px-3 py-2" disabled={busy||loading} onClick={()=>{setLoading(true);void load(controller.current?.signal)}}>{t.refresh}</button>
   {loading?<p>{t.loading}</p>:!rows.length?<p>{t.empty}</p>:rows.map(v=><article key={v.id} className="space-y-2 rounded-lg border p-3"><h3 className="font-bold">{v.name}</h3><p>{v.status==='candidate'?t.candidate:v.status==='approved'?t.approved:v.status} · {v.service_categories.map(c=>categories.includes(c as typeof categories[number])?t[c as typeof categories[number]]:c).join(', ')}</p>
    {v.status==='candidate'&&canApprove&&<form className="flex flex-col gap-2" onSubmit={e=>{e.preventDefault();const f=e.currentTarget;void mutate({action:'approve',vendor_id:v.id,reason:new FormData(f).get('reason')},f)}}><label>{t.reason}<textarea className={input} name="reason" required minLength={10} maxLength={500} disabled={busy}/></label><button className={button} disabled={busy}>{t.approve}</button></form>}
   </article>)}
  </div>}
 </section>;
}
