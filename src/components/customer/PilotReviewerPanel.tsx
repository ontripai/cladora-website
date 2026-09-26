'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Language } from '@/types';

type State={status?:string;workspace_id?:string;context_id?:string;expires_at?:string;runs?:Array<{id:string;status:string;building:string}>};
const copy={
 fa:{title:'تأیید مستقل راه‌اندازی ساختمان',empty:'دعوت فعال برای این حساب پیدا نشد.',mfa:'ابتدا ورود دومرحله‌ای را تکمیل کنید.',name:'نام نمایشی',activate:'فعال‌سازی دسترسی موقت',approve:'تأیید پرونده',error:'عملیات انجام نشد؛ وضعیت حساب و MFA را بررسی کنید.',done:'وضعیت به‌روزرسانی شد.',none:'پروندهٔ ارسالی برای بررسی وجود ندارد.'},
 ro:{title:'Aprobarea independentă a clădirii',empty:'Nu există invitație activă pentru acest cont.',mfa:'Finalizează mai întâi autentificarea în doi pași.',name:'Nume afișat',activate:'Activează accesul temporar',approve:'Aprobă dosarul',error:'Operațiunea a eșuat; verifică sesiunea și MFA.',done:'Starea a fost actualizată.',none:'Nu există dosare trimise.'},
 en:{title:'Independent building setup review',empty:'No active invitation for this account.',mfa:'Complete two-factor verification first.',name:'Display name',activate:'Activate temporary access',approve:'Approve setup',error:'Operation failed; check your session and MFA.',done:'Status updated.',none:'No submitted setup to review.'},
};
export function PilotReviewerPanel({lang}:{lang:Language}){
 const t=copy[lang];const [state,setState]=useState<State|null>(null);const [name,setName]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function refresh(){const response=await fetch('/api/customer/v1/pilot-reviewer',{cache:'no-store'});const body=await response.json();setState(response.ok?body.reviewer:{});}
 useEffect(()=>{const controller=new AbortController();fetch('/api/customer/v1/pilot-reviewer',{cache:'no-store',signal:controller.signal})
  .then(response=>response.json().then(body=>response.ok?body.reviewer:{})).then(reviewer=>{if(!controller.signal.aborted)setState(reviewer)})
  .catch(()=>{if(!controller.signal.aborted)setState({})});return ()=>controller.abort();},[]);
 async function act(path:string,payload:object){setBusy(true);setMessage('');try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});setMessage(response.ok?t.done:t.error);await refresh();}catch{setMessage(t.error)}finally{setBusy(false)}}
 return <section className="card-proptech space-y-4 bg-white p-6" dir={lang==='fa'?'rtl':'ltr'}><h1 className="text-xl font-bold">{t.title}</h1>
 {state===null?<p>…</p>:!state.status?<p>{t.empty}</p>:<><p>{state.expires_at}</p>
 {state.status==='prepared'?<><p>{t.mfa} <Link className="underline" href={`/${lang}/mfa/setup?next=pilot-reviewer`}>MFA</Link> · <Link className="underline" href={`/${lang}/mfa?next=pilot-reviewer`}>TOTP</Link></p><label className="block">{t.name}<input className="block w-full rounded border p-2" value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||name.trim().length<2} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50" onClick={()=>act('/api/customer/v1/pilot-reviewer',{workspace_id:state.workspace_id,display_name:name,locale:lang})}>{t.activate}</button></>
 :<div>{state.runs?.length?state.runs.map(run=><div key={run.id} className="flex items-center justify-between gap-4 border-b p-3"><span>{run.building} · {run.id}</span><button disabled={busy||!state.context_id} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50" onClick={()=>act(`/api/customer/v1/onboarding/building-setup/${run.id}/approve`,{context_id:state.context_id})}>{t.approve}</button></div>):<p>{t.none}</p>}</div>}</>}
 {message&&<p role="status">{message}</p>}</section>;
}
