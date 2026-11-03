'use client';
import {useCallback,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {z} from 'zod';
import {maintenanceUuidSchema} from '@/lib/customer/maintenance-schema';
import {localizedMaintenanceText} from '@/lib/customer/maintenance-defaults';
import type {Language} from '@/types';
import {DurableWorkOrderChecklistPanel} from './DurableWorkOrderChecklistPanel';
import {checklistCutoverMode,hasLegacyChecklistHold,beginLegacyChecklistAttempt,markLegacyChecklistUnknown,acknowledgeKnownLegacyReply,type LegacyChecklistAttempt} from '@/lib/customer/operations-checklist-cutover';

const checklistSchema=z.object({work_order_id:maintenanceUuidSchema,status:z.enum(['draft','scheduled','assigned','in_progress','blocked','completed','verified','cancelled']),items:z.array(z.object({id:maintenanceUuidSchema,label:z.string().min(1),required:z.boolean(),completed:z.boolean(),completed_at:z.iso.datetime({offset:true}).nullable(),notes:z.string().nullable()}).strict())}).strict().superRefine((v,c)=>{if(new Set(v.items.map(i=>i.id)).size!==v.items.length)c.addIssue({code:'custom',message:'duplicate_checklist_item'});for(const item of v.items)if(item.completed&&(item.completed_at===null||item.notes===null||item.notes.trim().length<10))c.addIssue({code:'custom',message:'unproven_checklist_completion'});});
type Data=z.infer<typeof checklistSchema>;
type Attempt={owner:LegacyChecklistAttempt;binding:string;item:string;notes:string;phase:'sending'|'unknown'|'denied'|'rejected'|'acknowledged'};
const copy={
 en:{title:'Checklist results',notes:'Result of this check',save:'Record check',done:'Recorded',required:'Required',loading:'Loading checklist…',error:'Checklist could not be verified. No completion is confirmed.',unknown:'Request outcome is unknown. Notes are retained in this open panel. Do not repeat the write; refreshing only observes current records.',denied:'Checklist access is unavailable. Check your account, permissions and MFA.',refresh:'Observe current checklist',observed:'Current checklist observed; this does not prove an earlier request.',limit:'Closing or reloading this panel does not recover an uncertain request.'},
 ro:{title:'Rezultatele listei',notes:'Rezultatul verificării',save:'Înregistrează verificarea',done:'Înregistrat',required:'Obligatoriu',loading:'Se încarcă lista…',error:'Lista nu a putut fi verificată. Finalizarea nu este confirmată.',unknown:'Rezultatul cererii este necunoscut. Notele rămân în acest panou deschis. Nu repeta înregistrarea; reîncărcarea doar arată datele curente.',denied:'Accesul la listă nu este disponibil. Verifică contul, permisiunile și MFA.',refresh:'Consultă lista curentă',observed:'Lista curentă a fost consultată; aceasta nu dovedește o cerere anterioară.',limit:'Închiderea sau reîncărcarea panoului nu recuperează o cerere incertă.'},
 fa:{title:'نتایج چک‌لیست',notes:'نتیجهٔ این بررسی',save:'ثبت بررسی',done:'ثبت‌شده',required:'الزامی',loading:'در حال دریافت چک‌لیست…',error:'چک‌لیست قابل بررسی نیست؛ انجام بررسی تأیید نشده است.',unknown:'نتیجهٔ درخواست نامعلوم است. یادداشت‌ها در همین پنل باز حفظ می‌شوند. ثبت را تکرار نکنید؛ بازخوانی فقط سوابق فعلی را نشان می‌دهد.',denied:'دسترسی چک‌لیست برقرار نیست. حساب، مجوز و ورود دومرحله‌ای را بررسی کنید.',refresh:'مشاهدهٔ چک‌لیست فعلی',observed:'چک‌لیست فعلی مشاهده شد؛ این مشاهده اثبات درخواست قبلی نیست.',limit:'بستن یا بارگذاری دوبارهٔ پنل، درخواست نامعلوم را بازیابی نمی‌کند.'},
};
type Props={contextId:string;workOrderId:string;lang:Language;onReady:(ready:boolean)=>void;ready?:boolean;scopeKey?:string};
export function WorkOrderChecklistPanel(props:Props){const mode=checklistCutoverMode();return mode==='hold'?<ChecklistCutoverHold {...props}/>:mode==='v2'?<DurableWorkOrderChecklistPanel {...props}/>:<LegacyWorkOrderChecklistPanel {...props}/>;}
function ChecklistCutoverHold({onReady,lang}:Props){useLayoutEffect(()=>{onReady(false);},[onReady]);return <p role="alert">{lang==='fa'?'اتصال نسخهٔ چک‌لیست کامل نیست؛ ثبت متوقف است.':lang==='ro'?'Conectarea versiunii listei este incompletă; înregistrarea este blocată.':'Checklist cutover is incomplete; recording is on hold.'}</p>;}
function LegacyWorkOrderChecklistPanel({contextId,workOrderId,lang,onReady,ready=true,scopeKey=''}:Props){
 const t=copy[lang],binding=`${scopeKey}:${contextId}:${workOrderId}`;
 const admitted=ready&&maintenanceUuidSchema.safeParse(contextId).success&&maintenanceUuidSchema.safeParse(workOrderId).success;
 const token=useMemo(()=>({binding,admitted,lang,onReady}),[binding,admitted,lang,onReady]);
 const committed=useRef<typeof token|null>(null),readOwner=useRef<symbol|null>(null),operation=useRef<symbol|null>(null),abort=useRef<AbortController|null>(null);
 const attemptRef=useRef<Attempt|null>(null),draftRef=useRef<{binding:string;notes:Record<string,string>}>({binding,notes:{}});
 const [attempt,setAttempt]=useState<Attempt|null>(null),[drafts,setDrafts]=useState<{binding:string;notes:Record<string,string>}>({binding,notes:{}}),[data,setData]=useState<{token:typeof token;value:Data}|null>(null),[reading,setReading]=useState(true),[notice,setNotice]=useState<''|'error'|'denied'|'observed'>(''),[legacyHeld,setLegacyHeld]=useState(false);
 const ownAttempt=attempt?.binding===binding?attempt:null;
 const blocked=!!ownAttempt&&['sending','unknown','denied'].includes(ownAttempt.phase);
 // finally can release operation before React commits the blocked render.
 const attemptBlocked=useCallback(()=>{const current=attemptRef.current;return current?.binding===binding&&['sending','unknown','denied'].includes(current.phase);},[binding]);
 const currentData=data?.token===token&&admitted?data.value:null;
 const url=`/api/customer/v1/work-orders/${encodeURIComponent(workOrderId)}/checklist?context_id=${encodeURIComponent(contextId)}`;
 const publish=useCallback((value:Data|null)=>{onReady(!!value&&!hasLegacyChecklistHold(window.localStorage)&&value.status==='in_progress'&&value.items.every(i=>!i.required||i.completed)&&!['sending','unknown','denied'].includes(attemptRef.current?.binding===binding?attemptRef.current.phase:''));},[onReady,binding]);
 const load=useCallback(async()=>{
  if(committed.current!==token||!admitted||operation.current)return;
  const owner=Symbol('checklist-read');readOwner.current=owner;const controller=new AbortController();abort.current?.abort();abort.current=controller;
  setData(null);setReading(true);setNotice('');publish(null);
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
  const current=()=>committed.current===token&&readOwner.current===owner&&!controller.signal.aborted;
  try{
   const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal});
   if(!current())return;signal.throwIfAborted();if(!response.ok){setNotice(response.status===401||response.status===403?'denied':'error');return;}
   const value=checklistSchema.parse(await response.json());if(!current())return;signal.throwIfAborted();
   if(value.work_order_id!==workOrderId||value.status!=='in_progress')throw Error('checklist_scope_or_state');
   setLegacyHeld(hasLegacyChecklistHold(window.localStorage));setData({token,value});setNotice('observed');publish(value);
  }catch{if(current()){setData(null);setNotice('error');publish(null);}}
  finally{if(current()){readOwner.current=null;setReading(false);}}
 },[token,admitted,url,workOrderId,publish]);
 useLayoutEffect(()=>{
  committed.current=token;operation.current=null;readOwner.current=null;
  const previous=attemptRef.current;if(previous?.binding===binding&&previous.phase==='sending')attemptRef.current={...previous,phase:'unknown'};
  if(draftRef.current.binding!==binding)draftRef.current={binding,notes:{}};
  publish(null);
  void Promise.resolve().then(()=>{if(committed.current===token){setAttempt(attemptRef.current);setDrafts(draftRef.current);setData(null);setReading(admitted);setNotice('');if(admitted)void load();}});
  return()=>{if(committed.current===token){if(attemptRef.current?.binding===binding&&attemptRef.current.phase==='sending'){try{markLegacyChecklistUnknown(window.localStorage,attemptRef.current.owner);}catch{/* A storage failure cannot authorize a retry. */}}committed.current=null;operation.current=null;readOwner.current=null;abort.current?.abort();onReady(false);}};
 },[token,binding,admitted,load,publish,onReady,contextId,workOrderId]);
 async function record(itemId:string){
  if(committed.current!==token||!admitted||operation.current||readOwner.current||blocked||attemptBlocked()||!currentData||currentData.status!=='in_progress')return;
  const item=currentData.items.find(i=>i.id===itemId);if(!item||item.completed)return;
  const notes=draftRef.current.binding===binding?(draftRef.current.notes[itemId]??'').trim():'';
  if(notes.length<10||notes.length>2000){setNotice('error');return;}
  let journalOwner:LegacyChecklistAttempt;
  try{journalOwner=beginLegacyChecklistAttempt(window.localStorage,contextId,workOrderId);}catch{setLegacyHeld(true);publish(null);return;}
  const owner=Symbol('checklist-write');operation.current=owner;publish(null);setNotice('');
  const snapshot:Attempt={owner:journalOwner,binding,item:itemId,notes,phase:'sending'};attemptRef.current=snapshot;setAttempt(snapshot);
  const controller=new AbortController();abort.current?.abort();abort.current=controller;
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
  const current=()=>committed.current===token&&operation.current===owner&&!controller.signal.aborted;
  const mark=(phase:Attempt['phase'])=>{if(phase!=='acknowledged'){try{markLegacyChecklistUnknown(window.localStorage,snapshot.owner);}catch{/* Keep the deny-only hold. */}}setLegacyHeld(hasLegacyChecklistHold(window.localStorage));window.dispatchEvent(new Event('cladora.operations.legacy-hold'));const next={...snapshot,phase};attemptRef.current=next;setAttempt(next);};
  try{
   const response=await fetch(url.split('?')[0],{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({context_id:contextId,item_id:itemId,notes})});
   if(!current())return;signal.throwIfAborted();
   if(!response.ok){mark(response.status===401||response.status===403?'denied':response.status===400||response.status===409?'rejected':'unknown');setData(null);setNotice(response.status===401||response.status===403?'denied':'error');return;}
   const result=checklistSchema.parse(await response.json());if(!current())return;signal.throwIfAborted();
   const resultItem=result.items.find(i=>i.id===itemId);
   if(result.work_order_id!==workOrderId||result.status!=='in_progress'||!resultItem?.completed||resultItem.notes!==notes||resultItem.completed_at===null)throw Error('checklist_result_binding');
   const read=await fetch(url,{cache:'no-store',credentials:'same-origin',signal});
   if(!current())return;signal.throwIfAborted();if(!read.ok){if(read.status===401||read.status===403)setNotice('denied');throw Error('checklist_readback');}
   const fresh=checklistSchema.parse(await read.json());if(!current())return;signal.throwIfAborted();const saved=fresh.items.find(i=>i.id===itemId);
   if(fresh.work_order_id!==workOrderId||fresh.status!=='in_progress'||!saved?.completed||saved.notes!==notes||saved.completed_at===null||saved.completed_at!==resultItem.completed_at)throw Error('checklist_readback_binding');
   acknowledgeKnownLegacyReply(window.localStorage,snapshot.owner);mark('acknowledged');setData({token,value:fresh});setNotice('observed');publish(fresh);
  }catch{if(current()){mark('unknown');setData(null);setNotice('error');publish(null);}}
  finally{if(current())operation.current=null;}
 }
 const update=(id:string,value:string)=>{if(operation.current||blocked||attemptBlocked()||committed.current!==token)return;const next={binding,notes:{...(draftRef.current.binding===binding?draftRef.current.notes:{}),[id]:value}};draftRef.current=next;setDrafts(next);};
 return <section className="space-y-3"><h3 className="font-bold">{t.title}</h3>
  {legacyHeld?<p role="alert">{lang==='fa'?'درخواست قدیمی بدون کلید در safe hold است؛ مشاهدهٔ فعلی یا رسید پسینی آن را تسویه نمی‌کند.':lang==='ro'?'Cererea veche fără cheie rămâne blocată; datele curente sau o recipisă ulterioară nu o reconciliază.':'The legacy keyless request remains on hold; current records or a later receipt cannot reconcile it.'}</p>:null}
  {ownAttempt?.phase==='unknown'?<p role="alert">{t.unknown}</p>:notice==='error'?<p role="alert">{t.error}</p>:notice==='denied'?<p role="alert">{t.denied}</p>:notice==='observed'?<p role="status">{t.observed}</p>:null}
  {!admitted||reading?<p>{t.loading}</p>:null}
  {currentData?.items.map(i=><article key={i.id} className="rounded-lg border bg-white p-3"><h4>{localizedMaintenanceText(i.label,lang)} {i.required?`· ${t.required}`:''}</h4>{i.completed?<p>{t.done} · {i.notes}</p>:<form className="mt-2 space-y-2" onSubmit={e=>{e.preventDefault();void record(i.id);}}><label className="block">{t.notes}<textarea name="notes" required minLength={10} maxLength={2000} value={drafts.binding===binding?(drafts.notes[i.id]??''):''} onChange={e=>update(i.id,e.target.value)} disabled={blocked||reading||legacyHeld} className="block w-full rounded-lg border p-2"/></label><button disabled={blocked||reading||legacyHeld} className="rounded-lg border px-3 py-2 font-bold">{t.save}</button></form>}</article>)}
  <button type="button" disabled={!admitted||reading||ownAttempt?.phase==='sending'} onClick={()=>void load()} className="rounded-lg border px-3 py-2">{t.refresh}</button><p className="text-xs">{t.limit}</p>
 </section>;
}
