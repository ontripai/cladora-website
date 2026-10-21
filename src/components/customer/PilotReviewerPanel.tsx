'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { buildingSetupApprovalSchema, buildingSetupIdSchema, buildingSetupReceiptSchema, reviewerSetupStateSchema } from '@/lib/customer/building-setup-schema';
import { readSetupRecord } from '@/lib/customer/building-workspace-onboarding';
import type { Language } from '@/types';

type State=z.infer<typeof reviewerSetupStateSchema>;
const approvalAttemptSchema=z.object({run_id:buildingSetupIdSchema,command:buildingSetupApprovalSchema}).strict();
type ApprovalAttempt=z.infer<typeof approvalAttemptSchema>;
const copy={
 fa:{title:'تأیید مستقل راه‌اندازی ساختمان',empty:'دعوت فعال برای این حساب پیدا نشد.',mfa:'ابتدا ورود دومرحله‌ای را تکمیل کنید.',name:'نام نمایشی',activate:'فعال‌سازی دسترسی موقت',approve:'تأیید پرونده',error:'عملیات انجام نشد؛ وضعیت حساب و MFA را بررسی کنید.',done:'وضعیت به‌روزرسانی شد.',none:'پروندهٔ ارسالی برای بررسی وجود ندارد.'},
 ro:{title:'Aprobarea independentă a clădirii',empty:'Nu există invitație activă pentru acest cont.',mfa:'Finalizează mai întâi autentificarea în doi pași.',name:'Nume afișat',activate:'Activează accesul temporar',approve:'Aprobă dosarul',error:'Operațiunea a eșuat; verifică sesiunea și MFA.',done:'Starea a fost actualizată.',none:'Nu există dosare trimise.'},
 en:{title:'Independent building setup review',empty:'No active invitation for this account.',mfa:'Complete two-factor verification first.',name:'Display name',activate:'Activate temporary access',approve:'Approve setup',error:'Operation failed; check your session and MFA.',done:'Status updated.',none:'No submitted setup to review.'},
};
export function PilotReviewerPanel({lang}:{lang:Language}){
 const t=copy[lang];const lock=useRef(false),alive=useRef(false);const [pending,setPending]=useState<ApprovalAttempt|null>(null);const [state,setState]=useState<State|null>(null);const [name,setName]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function refresh(){const response=await fetch('/api/customer/v1/pilot-reviewer',{cache:'no-store'});const body=await response.json();if(!response.ok)throw Error('review_read_denied');const next=reviewerSetupStateSchema.parse(body.reviewer);if(alive.current)setState(next);}
 useEffect(()=>{alive.current=true;const controller=new AbortController();fetch('/api/customer/v1/pilot-reviewer',{cache:'no-store',signal:controller.signal})
  .then(response=>response.json().then(body=>response.ok?reviewerSetupStateSchema.parse(body.reviewer):{})).then(reviewer=>{if(!controller.signal.aborted){setState(reviewer);if(reviewer.context_id&&reviewer.workspace_id){const raw=sessionStorage.getItem(`cladora.setup-approval.v2:${reviewer.context_id}:${reviewer.workspace_id}`);if(raw){const saved=approvalAttemptSchema.parse(JSON.parse(raw));if(saved.command.context_id!==reviewer.context_id||saved.command.workspace_id!==reviewer.workspace_id)throw Error('foreign_approval');setPending(saved);}}}})
  .catch(()=>{if(!controller.signal.aborted)setState({})});return ()=>{alive.current=false;controller.abort();};},[]);
 async function act(path:string,payload:object){setBusy(true);setMessage('');try{const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});setMessage(response.ok?t.done:t.error);await refresh();}catch{setMessage(t.error)}finally{setBusy(false)}}
 async function approve(run?:NonNullable<State['runs']>[number]){
  if(lock.current||!state?.context_id||!state.workspace_id)return;
  lock.current=true;setBusy(true);setMessage('');
  const key=`cladora.setup-approval.v2:${state.context_id}:${state.workspace_id}`;
  try{
   const attempt=pending??approvalAttemptSchema.parse({run_id:run?.id,command:{context_id:state.context_id,workspace_id:state.workspace_id,expected_revision:run?.revision,expected_payload_hash:run?.submitted_payload_hash,command_key:`setup-${run?.id}-r${run?.revision}-${crypto.randomUUID()}`}});
   if(attempt.command.context_id!==state.context_id||attempt.command.workspace_id!==state.workspace_id)throw Error('foreign_approval');
   const current=await readSetupRecord(attempt.command.context_id,attempt.command.workspace_id,attempt.run_id);
   if(!alive.current)return;
   const exact=()=>current.last_command_key===attempt.command.command_key&&current.last_command_receipt?.operation==='approve'&&current.last_command_receipt?.expected_revision===attempt.command.expected_revision;
   if(!exact()){
    if(current.status!=='submitted'||current.revision!==attempt.command.expected_revision||current.submitted_payload_hash!==attempt.command.expected_payload_hash)throw Error('stale_snapshot');
    sessionStorage.setItem(key,JSON.stringify(attempt));setPending(attempt);
    const response=await fetch(`/api/customer/v1/onboarding/building-setup/${attempt.run_id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.command),signal:AbortSignal.timeout(20000)});
    const receipt=buildingSetupReceiptSchema.parse(await response.json());if(!response.ok||receipt.run_id!==attempt.run_id||receipt.workspace_id!==attempt.command.workspace_id||receipt.command_key!==attempt.command.command_key)throw Error('unknown');
   }
   if(!alive.current)return;
   const verified=await readSetupRecord(attempt.command.context_id,attempt.command.workspace_id,attempt.run_id);
   if(verified.last_command_key!==attempt.command.command_key||verified.last_command_receipt?.operation!=='approve')throw Error('unresolved');
   if(!alive.current)return;
   sessionStorage.removeItem(key);setPending(null);setMessage(t.done);await refresh();
  }catch{if(alive.current)setMessage(t.error);}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="card-proptech space-y-4 bg-white p-6" dir={lang==='fa'?'rtl':'ltr'}><h1 className="text-xl font-bold">{t.title}</h1>
 {state===null?<p>…</p>:!state.status?<p>{t.empty}</p>:<><p>{state.expires_at}</p>
 {state.status==='prepared'?<><p>{t.mfa} <Link className="underline" href={`/${lang}/mfa/setup?next=pilot-reviewer`}>MFA</Link> · <Link className="underline" href={`/${lang}/mfa?next=pilot-reviewer`}>TOTP</Link></p><label className="block">{t.name}<input className="block w-full rounded border p-2" value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||name.trim().length<2} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50" onClick={()=>act('/api/customer/v1/pilot-reviewer',{workspace_id:state.workspace_id,display_name:name,locale:lang})}>{t.activate}</button></>
 :<div>{state.runs?.length?state.runs.map(run=><div key={run.id} className="flex items-center justify-between gap-4 border-b p-3"><span>{run.building} · {run.id}</span><button disabled={busy||!!pending||!state.context_id} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50" onClick={()=>approve(run)}>{t.approve}</button></div>):<p>{t.none}</p>}</div>}</>}
 {pending&&<button type="button" disabled={busy} className="rounded border p-2" onClick={()=>approve()}>{lang==='fa'?'بررسی و تکرار همان تأیید':lang==='ro'?'Verifică și reîncearcă aceeași aprobare':'Check and retry the same approval'}</button>}
 {message&&<p role="status">{message}</p>}</section>;
}
