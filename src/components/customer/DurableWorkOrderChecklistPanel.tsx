'use client';
import {useCallback,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {workOrderChecklistReadV2Schema,operationsChecklistResultV2Schema,checklistNotesV2Schema} from '@/lib/customer/operations-command';
import {hasLegacyChecklistHold} from '@/lib/customer/operations-checklist-cutover';
import {localizedMaintenanceText} from '@/lib/customer/maintenance-defaults';
import {maintenanceUuidSchema} from '@/lib/customer/maintenance-schema';
import {useOperationsCommands} from './OperationsCommandGate';
import type {Language} from '@/types';
import type {z} from 'zod';
type Data=z.infer<typeof workOrderChecklistReadV2Schema>;
const copy={en:{rejected:'The command was rejected and acknowledged. No completion is confirmed. Observe the current checklist before a new attempt.',denied:'The command was rejected and acknowledged. Restore current access before observing or starting another command.',title:'Checklist results',save:'Record check',notes:'Result of this check',refresh:'Observe current checklist',unknown:'The command outcome is unknown. Reconcile the original server command; observation is not a receipt.',error:'Checklist unavailable. No completion is confirmed.',observed:'Current records only; not proof of an earlier request.'},ro:{rejected:'Comanda a fost respinsă și confirmată. Finalizarea nu este confirmată. Consultă lista curentă înainte de o nouă încercare.',denied:'Comanda a fost respinsă și confirmată. Restabilește accesul curent înainte de consultare sau de o nouă comandă.',title:'Rezultatele listei',save:'Înregistrează verificarea',notes:'Rezultatul verificării',refresh:'Consultă lista curentă',unknown:'Rezultatul comenzii este necunoscut. Reconciliază comanda originală pe server; observația nu este recipisă.',error:'Lista nu este disponibilă. Finalizarea nu este confirmată.',observed:'Doar date curente; nu dovada unei cereri anterioare.'},fa:{rejected:'فرمان رد و دریافت آن تأیید شد؛ تکمیل تأیید نشده است. پیش از تلاش تازه چک‌لیست فعلی را مشاهده کنید.',denied:'فرمان رد و دریافت آن تأیید شد؛ پیش از مشاهده یا فرمان تازه، دسترسی جاری را برقرار کنید.',title:'نتایج چک‌لیست',save:'ثبت بررسی',notes:'نتیجهٔ این بررسی',refresh:'مشاهدهٔ چک‌لیست فعلی',unknown:'نتیجهٔ فرمان نامعلوم است. همان فرمان اصلی سرور را بازیابی کنید؛ مشاهدهٔ فعلی رسید نیست.',error:'چک‌لیست در دسترس نیست؛ تکمیل تأیید نشده است.',observed:'فقط سوابق فعلی؛ نه اثبات درخواست قبلی.'}};
type Props={contextId:string;workOrderId:string;lang:Language;onReady:(value:boolean)=>void;ready?:boolean;scopeKey?:string};
export function DurableWorkOrderChecklistPanel(props:Props){return <DurableChecklistScope key={`${props.scopeKey??''}:${props.contextId}:${props.workOrderId}`} {...props}/>;}
function DurableChecklistScope({contextId,workOrderId,lang,onReady,ready=true,scopeKey=''}:Props){
 const operations=useOperationsCommands(),t=copy[lang];
 const admitted=ready&&operations.ready&&maintenanceUuidSchema.safeParse(contextId).success&&maintenanceUuidSchema.safeParse(workOrderId).success;
 // Closing global admission for OUR pending command is not an identity change.
 // Keep its owned promise alive, but never publish readiness while admission is
 // closed. Context/Workspace presentation scope changes still unmount this key.
 const token=useMemo(()=>({contextId,workOrderId,scopeKey}),[contextId,workOrderId,scopeKey]);
 const current=useRef<typeof token|null>(null),writer=useRef<symbol|null>(null),reader=useRef<symbol|null>(null),controller=useRef<AbortController|null>(null);
 const admission=useRef(false),readyCallback=useRef(onReady);
 const attempt=useRef<'idle'|'sending'|'unknown'|'rejected'>('idle'),draft=useRef<Record<string,string>>({});
 const [data,setData]=useState<{token:typeof token;value:Data}|null>(null),[notes,setNotes]=useState<Record<string,string>>({}),[notice,setNotice]=useState<''|'unknown'|'error'|'observed'|'rejected'|'denied'>(''),[busy,setBusy]=useState(false),[phase,setPhase]=useState<'idle'|'sending'|'unknown'|'rejected'>('idle');
 const value=data?.token===token&&admitted?data.value:null;
 const publish=useCallback((v:Data|null)=>readyCallback.current(!!v&&admission.current&&v.status==='in_progress'&&v.items.every(i=>!i.required||i.completed)&&attempt.current==='idle'&&!hasLegacyChecklistHold(window.localStorage)),[]);
 const load=useCallback(async()=>{
  if(current.current!==token||!admission.current||writer.current)return;
  const own=Symbol('checklist-v2-read');reader.current=own;const abort=new AbortController();controller.current?.abort();controller.current=abort;
  setData(null);publish(null);setBusy(true);
  const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]);
  const live=()=>current.current===token&&reader.current===own&&!abort.signal.aborted;
  try{
   const r=await fetch(`/api/customer/v1/work-orders/${encodeURIComponent(workOrderId)}/checklist?context_id=${encodeURIComponent(contextId)}`,{cache:'no-store',credentials:'same-origin',signal});
   if(!live())return;signal.throwIfAborted();if(!r.ok)throw Error('checklist_read_unavailable');
   const v=workOrderChecklistReadV2Schema.parse(await r.json());if(!live())return;signal.throwIfAborted();
   if(v.work_order_id!==workOrderId||v.status!=='in_progress')throw Error('checklist_read_binding');
   // A known rejected/ACKed attempt needs a fresh explicit observation. This
   // releases only its UI fence; GET never settles a genuinely UNKNOWN command.
   if(attempt.current==='rejected'){attempt.current='idle';setPhase('idle');}
   setData({token,value:v});setNotice(attempt.current==='unknown'?'unknown':'observed');publish(v);
  }catch{if(live()){setData(null);setNotice(attempt.current==='unknown'?'unknown':'error');publish(null);}}
  finally{if(live()){reader.current=null;setBusy(false);}}
 },[token,contextId,workOrderId,publish]);
 useLayoutEffect(()=>{
  current.current=token;
  return()=>{if(current.current===token){current.current=null;admission.current=false;reader.current=null;controller.current?.abort();if(attempt.current==='sending')attempt.current='unknown';readyCallback.current(false);}};
 },[token]);
 useLayoutEffect(()=>{
  admission.current=admitted;readyCallback.current=onReady;publish(null);
  if(!admitted){reader.current=null;controller.current?.abort();return;}
  void Promise.resolve().then(()=>{if(current.current===token&&!writer.current&&!reader.current&&attempt.current!=='rejected')void load();});
 },[token,admitted,onReady,load,publish]);
 async function record(itemId:string){
  if(current.current!==token||!admission.current||writer.current||reader.current||attempt.current!=='idle'||hasLegacyChecklistHold(window.localStorage)||!value?.items.some(i=>i.id===itemId&&!i.completed))return;
  const parsed=checklistNotesV2Schema.safeParse((draft.current[itemId]??'').trim());if(!parsed.success){setNotice('error');return;}
  const text=parsed.data,own=Symbol('checklist-v2-command');writer.current=own;attempt.current='sending';setPhase('sending');publish(null);setBusy(true);
  const live=()=>current.current===token&&writer.current===own;
  try{
   const result=operationsChecklistResultV2Schema.parse(await operations.send({version:2,action:'record_checklist',context_id:contextId,target_id:workOrderId,expected_status:'in_progress',input:{context_id:contextId,item_id:itemId,notes:text}}));
   if(!live())return;
   if(result.work_order_id!==workOrderId||result.item_id!==itemId||result.notes!==text)throw Error('checklist_command_binding');
   // send resolves only after canonical terminal receipt + exact ACK. GET below
   // observes current rows; it never clears UNKNOWN or attests the previous POST.
   attempt.current='idle';setPhase('idle');writer.current=null;setBusy(false);await load();
  }catch(error){if(live()){
   // Only Gate's canonical rejection signal follows a validated terminal
   // receipt AND exact ACK. Transport/ACK/result-binding errors remain UNKNOWN.
   const known=error instanceof Error&&(error as {canonicalRejection?:unknown}).canonicalRejection===true;
   if(known){attempt.current='rejected';setPhase('rejected');setNotice((error as {errorCode?:unknown}).errorCode==='42501'?'denied':'rejected');}
   else{attempt.current='unknown';setPhase('unknown');setNotice('unknown');}
   setData(null);publish(null);
  }}
  finally{if(live()){writer.current=null;setBusy(false);}}
 }
 return <section className="space-y-3"><h3 className="font-bold">{t.title}</h3>
 {notice?<p role={notice==='observed'?'status':'alert'}>{t[notice]}</p>:null}
 {value?.items.map(i=><article key={i.id} className="rounded-lg border p-3"><h4>{localizedMaintenanceText(i.label,lang)}</h4>{i.completed?<p>{i.notes}</p>:<form onSubmit={e=>{e.preventDefault();void record(i.id);}}><label>{t.notes}<textarea name="notes" value={notes[i.id]??''} maxLength={4000} disabled={busy||!admitted||phase!=='idle'} onChange={e=>{if(writer.current||attempt.current!=='idle'||current.current!==token)return;const next={...draft.current,[i.id]:e.target.value};draft.current=next;setNotes(next);}}/></label><button disabled={busy||!admitted||phase!=='idle'}>{t.save}</button></form>}</article>)}
 <button type="button" disabled={!admitted||busy} onClick={()=>void load()}>{t.refresh}</button>
 </section>;
}
