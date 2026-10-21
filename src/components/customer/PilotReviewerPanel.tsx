'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { buildingSetupApprovalSchema, buildingSetupIdSchema, buildingSetupReceiptSchema, reviewerSetupStateSchema } from '@/lib/customer/building-setup-schema';
import { readSetupRecord, SetupReadError } from '@/lib/customer/building-workspace-onboarding';
import type { Language } from '@/types';

type State=z.infer<typeof reviewerSetupStateSchema>;
const approvalAttemptSchema=z.object({run_id:buildingSetupIdSchema,command:buildingSetupApprovalSchema}).strict();
type ApprovalAttempt=z.infer<typeof approvalAttemptSchema>;
const copy={
 fa:{title:'تأیید مستقل راه‌اندازی ساختمان',empty:'دعوت فعال برای این حساب پیدا نشد.',mfa:'ابتدا ورود دومرحله‌ای را تکمیل کنید.',name:'نام نمایشی',activate:'فعال‌سازی دسترسی موقت',approve:'تأیید پرونده',error:'عملیات انجام نشد؛ وضعیت حساب و MFA را بررسی کنید.',done:'وضعیت به‌روزرسانی شد.',none:'پروندهٔ ارسالی برای بررسی وجود ندارد.'},
 ro:{title:'Aprobarea independentă a clădirii',empty:'Nu există invitație activă pentru acest cont.',mfa:'Finalizează mai întâi autentificarea în doi pași.',name:'Nume afișat',activate:'Activează accesul temporar',approve:'Aprobă dosarul',error:'Operațiunea a eșuat; verifică sesiunea și MFA.',done:'Starea a fost actualizată.',none:'Nu există dosare trimise.'},
 en:{title:'Independent building setup review',empty:'No active invitation for this account.',mfa:'Complete two-factor verification first.',name:'Display name',activate:'Activate temporary access',approve:'Approve setup',error:'Operation failed; check your session and MFA.',done:'Status updated.',none:'No submitted setup to review.'},
};
const recoveryCopy={
 en:{retry:'Check and retry the same approval',refresh:'Refresh review access',denied:'Review access is no longer available. Sign in with an authorized account.',unknown:'Result unknown. The saved approval is retained; check current access before retrying.',invalid:'Saved approval cannot be verified. No approval was sent.'},
 ro:{retry:'Verifică și reîncearcă aceeași aprobare',refresh:'Actualizează accesul la verificare',denied:'Accesul la verificare nu mai este disponibil. Autentifică-te cu un cont autorizat.',unknown:'Rezultat necunoscut. Aprobarea salvată este păstrată; verifică accesul curent înainte de reîncercare.',invalid:'Aprobarea salvată nu poate fi verificată. Nu s-a trimis nicio aprobare.'},
 fa:{retry:'بررسی و تکرار همان تأیید',refresh:'بررسی دسترسی بازبینی',denied:'دسترسی بازبینی دیگر برقرار نیست. با حساب مجاز وارد شوید.',unknown:'نتیجه نامشخص است. همان تلاش تأیید حفظ شده؛ پیش از تکرار، دسترسی فعلی را بررسی کنید.',invalid:'تلاش تأیید ذخیره‌شده قابل بررسی نیست. تأییدی ارسال نشد.'},
};
function storageKey(state:State){return `cladora.setup-approval.v2:${state.context_id}:${state.workspace_id}`;}
function scopeOf(state:State){return `${state.status}:${state.context_id}:${state.workspace_id}`;}
function savedAttempt(state:State){
 const raw=sessionStorage.getItem(storageKey(state));
 if(!raw)return null;
 const attempt=approvalAttemptSchema.parse(JSON.parse(raw));
 if(attempt.command.context_id!==state.context_id||attempt.command.workspace_id!==state.workspace_id
  ||!attempt.command.command_key.startsWith(`setup-${attempt.run_id}-r${attempt.command.expected_revision}-`))throw Error('foreign_approval');
 return attempt;
}
export function PilotReviewerPanel({lang}:{lang:Language}){
 const t=copy[lang],r=recoveryCopy[lang];
 const lock=useRef(false),lifetime=useRef(0),request=useRef(0),scope=useRef('');
 const [pending,setPending]=useState<ApprovalAttempt|null>(null),[state,setState]=useState<State|null>(null);
 const [name,setName]=useState(''),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[message,setMessage]=useState(''),[invalid,setInvalid]=useState(false);
 // A newer access read invalidates every older read and in-flight approval continuation.
 const clearAccess=useCallback(()=>{request.current++;scope.current='';setState({});setPending(null);setName('');setInvalid(false);},[]);
 const refresh=useCallback(async()=>{
  const generation=lifetime.current,sequence=++request.current;
  const current=()=>lifetime.current===generation&&request.current===sequence;
  setReading(true);
  try{
   const response=await fetch('/api/customer/v1/pilot-reviewer',{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!current())return null;
   if(response.status===401||response.status===403){clearAccess();setMessage(r.denied);setReading(false);return null;}
   if(!response.ok)throw Error('review_read_unknown');
   const next=reviewerSetupStateSchema.parse((await response.json()).reviewer);
   if(!current())return null;
   if(!next.status){clearAccess();setMessage(r.denied);setReading(false);return null;}
   scope.current=scopeOf(next);setState(next);
   // Stored metadata never grants access: load it only AFTER the authorized reader.
   try{setPending(next.status==='active'?savedAttempt(next):null);setInvalid(false);}
   catch{setPending(null);setInvalid(true);setMessage(r.invalid);return null;}
   return next;
  }catch{if(current()){clearAccess();setMessage(r.unknown);setReading(false);}return null;}
  finally{if(current())setReading(false);}
 },[clearAccess,r.denied,r.invalid,r.unknown]);
 const invalidateLifetime=useCallback(()=>{lifetime.current++;request.current++;scope.current='';},[]);
 useEffect(()=>{
  invalidateLifetime();const generation=lifetime.current;
  void Promise.resolve().then(()=>{if(lifetime.current===generation)void refresh();});
  const onFocus=()=>{void refresh();};
  window.addEventListener('focus',onFocus);
  return()=>{invalidateLifetime();window.removeEventListener('focus',onFocus);};
 },[refresh,invalidateLifetime]);
 async function act(path:string,payload:object){
  if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
  const generation=lifetime.current,sequence=request.current;
  try{
   const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   if(lifetime.current!==generation||request.current!==sequence)return;
   if(response.status===401||response.status===403){clearAccess();setMessage(r.denied);return;}
   setMessage(response.ok?t.done:t.error);await refresh();
  }catch{if(lifetime.current===generation&&request.current===sequence)setMessage(r.unknown);}
  finally{lock.current=false;if(lifetime.current===generation)setBusy(false);}
 }
 async function approve(run?:NonNullable<State['runs']>[number]){
  if(lock.current||reading||invalid||state?.status!=='active'||!state.context_id||!state.workspace_id)return;
  lock.current=true;setBusy(true);setMessage('');
  const generation=lifetime.current,originalScope=scopeOf(state);
  let sequence=request.current;
  const current=()=>lifetime.current===generation&&request.current===sequence&&scope.current===originalScope;
  try{
   // Re-establish CURRENT authority, including after remount and before every retry.
   sequence=request.current+1;const authorized=await refresh();
   if(!authorized||!current()||scopeOf(authorized)!==originalScope)return;
   const restored=savedAttempt(authorized);
   const snapshot=run&&authorized.runs?.find(item=>item.id===run.id);
   if(!restored&&(!snapshot||snapshot.revision!==run?.revision||snapshot.submitted_payload_hash!==run?.submitted_payload_hash))throw Error('stale_snapshot');
   const attempt=restored??approvalAttemptSchema.parse({run_id:snapshot?.id,command:{context_id:authorized.context_id,workspace_id:authorized.workspace_id,expected_revision:snapshot?.revision,expected_payload_hash:snapshot?.submitted_payload_hash,command_key:`setup-${snapshot?.id}-r${snapshot?.revision}-${crypto.randomUUID()}`}});
   const key=storageKey(authorized);
   // Retain the immutable attempt even when the FIRST read has an unknown result.
   sessionStorage.setItem(key,JSON.stringify(attempt));setPending(attempt);
   const exact=(record:Awaited<ReturnType<typeof readSetupRecord>>)=>{
    const receipt=record.last_command_receipt;
    return record.status==='approved'&&record.revision===attempt.command.expected_revision+1
     &&record.payload_hash===attempt.command.expected_payload_hash&&receipt?.version===2&&receipt.status==='approved'
     &&record.submitted_revision===attempt.command.expected_revision
     &&record.submitted_payload_hash===attempt.command.expected_payload_hash
     &&record.last_command_key===attempt.command.command_key&&receipt?.command_key===attempt.command.command_key
     &&receipt.operation==='approve'&&receipt.expected_revision===attempt.command.expected_revision
     &&receipt.run_id===attempt.run_id&&receipt.workspace_id===attempt.command.workspace_id&&receipt.revision===record.revision;
   };
   const record=await readSetupRecord(attempt.command.context_id,attempt.command.workspace_id,attempt.run_id);
   if(!current())return;
   if(!exact(record)){
    if(record.status!=='submitted'||record.revision!==attempt.command.expected_revision||record.submitted_revision!==attempt.command.expected_revision||record.submitted_payload_hash!==attempt.command.expected_payload_hash||record.payload_hash!==attempt.command.expected_payload_hash)throw Error('stale_snapshot');
    const response=await fetch(`/api/customer/v1/onboarding/building-setup/${attempt.run_id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.command),signal:AbortSignal.timeout(20000)});
    if(!current())return;
    if(response.status===401||response.status===403){clearAccess();setMessage(r.denied);return;}
    if(!response.ok)throw Error('unknown');
    const receipt=buildingSetupReceiptSchema.parse(await response.json());
    if(!current())return;
    if(receipt.run_id!==attempt.run_id||receipt.workspace_id!==attempt.command.workspace_id||receipt.command_key!==attempt.command.command_key||receipt.operation!=='approve'||receipt.expected_revision!==attempt.command.expected_revision)throw Error('unknown');
   }
   const verified=await readSetupRecord(attempt.command.context_id,attempt.command.workspace_id,attempt.run_id);
   if(!current())return;
   if(!exact(verified))throw Error('unresolved');
   // Do not erase an attempt replaced by a different session/tab.
   if(sessionStorage.getItem(key)!==JSON.stringify(attempt))throw Error('attempt_changed');
   sessionStorage.removeItem(key);setPending(null);setMessage(t.done);await refresh();
  }catch(error){
   if(current()){
    if(error instanceof SetupReadError&&(error.status===401||error.status===403)){clearAccess();setMessage(r.denied);}
    else setMessage(r.unknown);
   }
  }finally{lock.current=false;if(lifetime.current===generation)setBusy(false);}
 }
 const canRecover=state?.status==='active'&&!!state.context_id&&!!state.workspace_id&&!invalid;
 return <section className="card-proptech space-y-4 bg-white p-6" dir={lang==='fa'?'rtl':'ltr'}><h1 className="text-xl font-bold">{t.title}</h1>
 <button type="button" className="rounded border p-2" disabled={reading} onClick={()=>{void refresh();}}>{r.refresh}</button>
 {state===null?<p>…</p>:!state.status?<p>{t.empty}</p>:<><p>{state.expires_at}</p>
 {state.status==='prepared'?<><p>{t.mfa} <Link className="underline" href={`/${lang}/mfa/setup?next=pilot-reviewer`}>MFA</Link> · <Link className="underline" href={`/${lang}/mfa?next=pilot-reviewer`}>TOTP</Link></p><label className="block">{t.name}<input className="block w-full rounded border p-2" value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||reading||name.trim().length<2} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50" onClick={()=>act('/api/customer/v1/pilot-reviewer',{workspace_id:state.workspace_id,display_name:name,locale:lang})}>{t.activate}</button></>
 :<div>{state.runs?.length?state.runs.map(run=><div key={run.id} className="flex flex-wrap items-center justify-between gap-4 border-b p-3"><span className="min-w-0 break-all">{run.building} · {run.id}</span><button disabled={busy||reading||invalid||!!pending||!state.context_id} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50" onClick={()=>approve(run)}>{t.approve}</button></div>):<p>{t.none}</p>}</div>}</>}
 {pending&&canRecover&&<button type="button" disabled={busy||reading} className="rounded border p-2" onClick={()=>approve()}>{r.retry}</button>}
 {message&&<p role="status" aria-live="polite">{message}</p>}</section>;
}
