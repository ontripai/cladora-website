'use client';
import {useCallback,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {z} from 'zod';
import {maintenanceUuidSchema,completeWorkOrderSchema,verifyWorkOrderSchema,issueWorkOrderSchema} from '@/lib/customer/maintenance-schema';
import {WorkOrderChecklistPanel} from './WorkOrderChecklistPanel';
import {useOperationsCommands} from './OperationsCommandGate';
import {intentFromWire} from '@/lib/customer/operations-command';
import type {Language} from '@/types';

type Action='issue'|'start'|'complete'|'verify';
export const maintenanceViews=['assets','components','plans','work_orders','tasks','vendors','sla','costs','history'] as const;
const statusSchema=z.enum(['draft','scheduled','assigned','in_progress','blocked','completed','verified','cancelled']);
const amountRecord=z.record(z.string().regex(/^[A-Z]{3}$/),z.number().finite());
const rowSchema=z.object({id:maintenanceUuidSchema}).passthrough();
const workOrderSchema=rowSchema.extend({status:statusSchema,title:z.string().min(1),work_order_no:z.number().int().positive(),vendor_name:z.string().nullable(),started_at:z.iso.datetime({offset:true}).nullable(),completed_at:z.iso.datetime({offset:true}).nullable(),verified_at:z.iso.datetime({offset:true}).nullable(),completion_summary:z.string().nullable(),cost_totals:amountRecord}).passthrough();
export type WorkOrderObservation=z.infer<typeof workOrderSchema>;
const payloadSchema=z.object({context:z.object({id:maintenanceUuidSchema}).passthrough(),view:z.enum(maintenanceViews),total:z.number().int().nonnegative(),rows:z.array(rowSchema),detail:rowSchema.nullable(),summary:z.object({assets:z.number().int().nonnegative(),open_work_orders:z.number().int().nonnegative(),overdue:z.number().int().nonnegative(),cost_total:amountRecord}),read_only:z.literal(true),generated_at:z.iso.datetime({offset:true}),limit:z.number().int().positive().max(100),offset:z.number().int().nonnegative()}).passthrough();
export type MaintenanceRead=z.infer<typeof payloadSchema>;
export function parseMaintenanceRead(input:unknown,context:string,view:typeof maintenanceViews[number]){
 const value=payloadSchema.parse(input);
 if(value.context.id!==context||value.view!==view||new Set(value.rows.map(r=>r.id)).size!==value.rows.length||value.rows.length>value.limit||value.total<value.rows.length)throw Error('maintenance_scope_or_page');
 if(view==='work_orders')value.rows=value.rows.map(r=>workOrderSchema.parse(r));
 for(const row of value.rows)for(const name of ['occurred_at','incurred_on','measured_at','created_at','next_due_at','installed_on','assigned_at'])if(row[name]!=null&&(typeof row[name]!=='string'||!Number.isFinite(Date.parse(row[name] as string))))throw Error('maintenance_date');
 return value;
}
export async function readWorkOrderObservation(context:string,id:string,signal:AbortSignal){
 const params=new URLSearchParams({context_id:context,view:'work_orders',id,limit:'1',offset:'0'});
 const response=await fetch(`/api/customer/v1/maintenance?${params}`,{cache:'no-store',credentials:'same-origin',signal});
 if(!response.ok)throw Object.assign(Error('work_order_read_failed'),{status:response.status});
 const value=parseMaintenanceRead(await response.json(),context,'work_orders');
 if(value.limit!==1||value.offset!==0||value.total!==1||value.rows.length!==1||value.rows[0].id!==id||!value.detail)throw Error('work_order_not_observed');
 const row=workOrderSchema.parse(value.rows[0]),detail=workOrderSchema.parse(value.detail);
 if(detail.id!==id||detail.status!==row.status||detail.title!==row.title||detail.started_at!==row.started_at||detail.completed_at!==row.completed_at||detail.verified_at!==row.verified_at||detail.completion_summary!==row.completion_summary)throw Error('work_order_detail_mismatch');
 return row;
}
const nextAction:Partial<Record<z.infer<typeof statusSchema>,Action>>={draft:'issue',scheduled:'issue',assigned:'start',blocked:'start',in_progress:'complete',completed:'verify'};
const nextStatus:Record<Action,string>={issue:'assigned',start:'in_progress',complete:'completed',verify:'verified'};
const responseSchemas={issue:z.object({id:maintenanceUuidSchema,status:z.literal('assigned'),vendor_id:maintenanceUuidSchema}).strict(),start:z.object({id:maintenanceUuidSchema,status:z.literal('in_progress'),started_at:z.iso.datetime({offset:true})}).strict(),complete:z.object({id:maintenanceUuidSchema,status:z.literal('completed'),completed_at:z.iso.datetime({offset:true})}).strict(),verify:z.object({id:maintenanceUuidSchema,status:z.literal('verified'),verified_at:z.iso.datetime({offset:true})}).strict()};
const copy={
 en:{title:'Work order execution',status:'Status',issue:'Issue to recorded contractor',start:'Start work',complete:'Record completion',verify:'Verify completion',notes:'Completion or verification notes',cost:'Actual cost',saved:'Response accepted and current work order reloaded.',error:'Current records or the action response could not be verified. No success is confirmed.',uncertain:'Request outcome is unknown. Your input is retained in this open panel. Do not repeat the write or continue to the next step.',forbidden:'Access is unavailable. Check your account, permissions and MFA.',conflict:'Work order state changed. Observe current records.',observe:'Observe current work order',loading:'Checking current work order…',observed:'Current state observed. This is not proof of an earlier request.',snapshot:'Unconfirmed request input',limit:'Server command receipts are checked after reload. Current-state reads alone cannot resolve an uncertain command.',note:'Issuing uses the recorded contractor. Completion and verification do not create an invoice, payment or financial close.',draft:'Draft',scheduled:'Scheduled',assigned:'Assigned',in_progress:'In progress',blocked:'On hold',completed:'Completed',verified:'Verified',cancelled:'Cancelled'},
 ro:{title:'Executarea ordinului',status:'Stare',issue:'Emite către furnizorul înregistrat',start:'Începe lucrul',complete:'Înregistrează finalizarea',verify:'Verifică finalizarea',notes:'Note de finalizare sau verificare',cost:'Cost real',saved:'Răspuns acceptat și ordin curent reîncărcat.',error:'Datele curente sau răspunsul nu au putut fi verificate. Nicio reușită nu este confirmată.',uncertain:'Rezultatul cererii este necunoscut. Datele introduse rămân în acest panou deschis. Nu repeta înregistrarea și nu continua la pasul următor.',forbidden:'Accesul nu este disponibil. Verifică contul, permisiunile și MFA.',conflict:'Starea ordinului s-a schimbat. Consultă datele curente.',observe:'Consultă ordinul curent',loading:'Se verifică ordinul curent…',observed:'Starea curentă a fost consultată. Aceasta nu dovedește o cerere anterioară.',snapshot:'Datele cererii neconfirmate',limit:'Recipisele comenzilor sunt verificate pe server după reîncărcare. Starea curentă singură nu rezolvă o comandă incertă.',note:'Emiterea folosește furnizorul înregistrat. Finalizarea și verificarea nu creează factură, plată sau închidere financiară.',draft:'Ciornă',scheduled:'Programat',assigned:'Atribuit',in_progress:'În lucru',blocked:'Suspendat',completed:'Finalizat',verified:'Verificat',cancelled:'Anulat'},
 fa:{title:'اجرای دستورکار',status:'وضعیت',issue:'صدور به پیمانکار ثبت‌شده',start:'شروع کار',complete:'ثبت نتیجهٔ کار',verify:'تأیید نتیجه',notes:'شرح نتیجه یا یادداشت',cost:'هزینهٔ واقعی',saved:'پاسخ معتبر بود و دستورکار فعلی بازخوانی شد.',error:'سوابق فعلی یا پاسخ درخواست قابل بررسی نیست؛ موفقیتی تأیید نشده است.',uncertain:'نتیجهٔ درخواست نامعلوم است. ورودی شما در همین پنل باز حفظ می‌شود. ثبت را تکرار نکنید و به مرحلهٔ بعد نروید.',forbidden:'دسترسی برقرار نیست. حساب، مجوز و ورود دومرحله‌ای را بررسی کنید.',conflict:'وضعیت دستورکار تغییر کرده است؛ سوابق فعلی را مشاهده کنید.',observe:'مشاهدهٔ دستورکار فعلی',loading:'در حال بررسی دستورکار فعلی…',observed:'وضعیت فعلی مشاهده شد؛ این مشاهده اثبات درخواست قبلی نیست.',snapshot:'ورودی درخواست تأییدنشده',limit:'پس از بازخوانی، رسید فرمان از سرور بررسی می‌شود؛ مشاهدهٔ وضعیت جاری به‌تنهایی نتیجهٔ فرمان نامعلوم را ثابت نمی‌کند.',note:'صدور از پیمانکار ثبت‌شده استفاده می‌کند. ثبت و تأیید نتیجه، فاکتور، پرداخت یا بستن حساب نیست.',draft:'پیش‌نویس',scheduled:'برنامه‌ریزی‌شده',assigned:'واگذارشده',in_progress:'در حال انجام',blocked:'متوقف',completed:'انجام‌شده',verified:'تأییدشده',cancelled:'لغوشده'},
} as const;
const progressCopy={
 en:{pending:'Sending the command and checking its canonical result…',readback:'Canonical reply received; checking the current work order…',unconfirmed:'Current work order status is not confirmed.',last:'Last observed status'},
 ro:{pending:'Se trimite comanda și se verifică rezultatul canonic…',readback:'Răspuns canonic primit; se verifică ordinul curent…',unconfirmed:'Starea curentă a ordinului nu este confirmată.',last:'Ultima stare observată'},
 fa:{pending:'در حال ارسال فرمان و بررسی نتیجهٔ canonical…',readback:'پاسخ canonical دریافت شد؛ دستورکار جاری در حال بررسی است…',unconfirmed:'وضعیت جاری دستورکار تأیید نشده است.',last:'آخرین وضعیت مشاهده‌شده'},
};
type Attempt={binding:string;action:Action;body:string;phase:'sending'|'unknown'|'denied'|'rejected'|'acknowledged'};
export function WorkOrderLifecyclePanel({contextId,workOrderId,status,lang,onChanged,onUnavailable,ready=true,scopeKey=''}:{contextId:string;workOrderId:string;status:string;lang:Language;onChanged:(status:string)=>void;onUnavailable?:()=>void;ready?:boolean;scopeKey?:string}){
 const t=copy[lang],binding=`${scopeKey}:${contextId}:${workOrderId}`;
 const operations=useOperationsCommands();
 const admitted=ready&&operations.ready&&maintenanceUuidSchema.safeParse(contextId).success&&maintenanceUuidSchema.safeParse(workOrderId).success;
 const token=useMemo(()=>({binding,status,lang,admitted,onChanged,onUnavailable}),[binding,status,lang,admitted,onChanged,onUnavailable]);
 const committed=useRef<typeof token|null>(null),operation=useRef<symbol|null>(null),readOwner=useRef<symbol|null>(null),controller=useRef<AbortController|null>(null),attemptRef=useRef<Attempt|null>(null);
 const [attempt,setAttempt]=useState<Attempt|null>(null),[observation,setObservation]=useState<{token:typeof token;row:WorkOrderObservation}|null>(null),[reading,setReading]=useState(true),[notice,setNotice]=useState<''|'error'|'forbidden'|'conflict'|'saved'|'observed'>('');
 const [fields,setFields]=useState({binding,notes:'',cost:''}),fieldsRef=useRef(fields);
 const checklistRef=useRef<{token:typeof token;ready:boolean}|null>(null),[checklist,setChecklist]=useState<{token:typeof token;ready:boolean}|null>(null);
 const [checklistPresence,setChecklistPresence]=useState<{binding:string;keep:boolean}|null>(null);
 const ownAttempt=attempt?.binding===binding?attempt:null,blocked=!!ownAttempt&&['sending','unknown','denied'].includes(ownAttempt.phase);
 // React may still expose the prior render after mark/finally have settled.
 // Admission must read the current binding's phase, not only rendered state.
 const attemptBlocked=useCallback(()=>{const current=attemptRef.current;return current?.binding===binding&&['sending','unknown','denied'].includes(current.phase);},[binding]);
 const row=observation?.token===token&&admitted?observation.row:null,action=row?nextAction[row.status]:undefined;
 const checklistReady=checklist?.token===token&&checklist.ready;
 const onReady=useCallback((value:boolean)=>{if(committed.current===token){const item={token,ready:value&&!attemptBlocked()};checklistRef.current=item;setChecklist(item);}},[token,attemptBlocked]);
 const observe=useCallback(async()=>{
  if(committed.current!==token||!admitted||operation.current)return;
  const owner=Symbol('work-order-read');readOwner.current=owner;const abort=new AbortController();controller.current?.abort();controller.current=abort;
  setReading(true);setObservation(null);checklistRef.current=null;setChecklist(null);setNotice('');
  const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]);
  const current=()=>committed.current===token&&readOwner.current===owner&&!abort.signal.aborted;
  try{const value=await readWorkOrderObservation(contextId,workOrderId,signal);if(!current())return;signal.throwIfAborted();setChecklistPresence({binding,keep:value.status==='in_progress'});setObservation({token,row:value});setNotice('observed');}
  catch(error){if(current()){setObservation(null);setNotice(error&&typeof error==='object'&&'status'in error&&(error.status===401||error.status===403)?'forbidden':'error');onUnavailable?.();}}
  finally{if(current()){readOwner.current=null;setReading(false);}}
 },[token,admitted,contextId,workOrderId,binding,onUnavailable]);
 useLayoutEffect(()=>{
  committed.current=token;operation.current=null;readOwner.current=null;checklistRef.current=null;
  if(attemptRef.current?.binding===binding&&attemptRef.current.phase==='sending')attemptRef.current={...attemptRef.current,phase:'unknown'};
  const sameBinding=fieldsRef.current.binding===binding;
  if(!sameBinding)fieldsRef.current={binding,notes:'',cost:''};
  void Promise.resolve().then(()=>{if(committed.current===token){setChecklist(null);setAttempt(attemptRef.current);setFields(fieldsRef.current);setObservation(null);setReading(admitted);setNotice(previous=>sameBinding&&!admitted&&['forbidden','conflict','error'].includes(previous)?previous:'');if(admitted)void observe();}});
  return()=>{if(committed.current===token){committed.current=null;operation.current=null;readOwner.current=null;checklistRef.current=null;controller.current?.abort();}};
 },[token,binding,admitted,observe]);
 async function submit(){
  if(committed.current!==token||!admitted||operation.current||readOwner.current||blocked||attemptBlocked()||!row||!action)return;
  if(action==='complete'&&!(checklistRef.current?.token===token&&checklistRef.current.ready))return;
  let body:Record<string,unknown>={context_id:contextId};
  try{if(action==='complete'){const f=fieldsRef.current;body=completeWorkOrderSchema.parse({...body,completion_notes:f.notes,...(f.cost!==''?{actual_cost:Number(f.cost)}:{})});}else if(action==='verify')body=verifyWorkOrderSchema.parse({...body,verification_notes:fieldsRef.current.notes});else body=issueWorkOrderSchema.parse(body);}
  catch{setNotice('error');return;}
  let intent;
  try{intent=intentFromWire(JSON.stringify({version:1,context_id:contextId,action,target_id:workOrderId,expected_status:row.status,input:body}));}
  catch{setNotice('error');return;}
  const owner=Symbol('work-order-write');operation.current=owner;
  const snapshot:Attempt={binding,action,body:JSON.stringify(body),phase:'sending'};attemptRef.current=snapshot;setAttempt(snapshot);setNotice('');checklistRef.current=null;setChecklist(null);
  const abort=new AbortController();controller.current?.abort();controller.current=abort;
  const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]);
  const current=()=>committed.current===token&&operation.current===owner&&!abort.signal.aborted;
  const mark=(phase:Attempt['phase'])=>{const next={...snapshot,phase};attemptRef.current=next;setAttempt(next);};
  try{
   const result=responseSchemas[action].parse(await operations.send(intent));
   if(!current())return;signal.throwIfAborted();if(result.id!==workOrderId)throw Error('work_order_response_identity');
   mark('acknowledged'); // Canonical C03 receipt verified; a later GET is a separate observation.
   const fresh=await readWorkOrderObservation(contextId,workOrderId,signal);if(!current())return;signal.throwIfAborted();
   if(fresh.status!==nextStatus[action])throw Error('work_order_readback_state');
   if(action==='complete'&&fresh.completion_summary!==body.completion_notes)throw Error('work_order_readback_notes');
   const event=action==='start'?'started_at':action==='complete'?'completed_at':action==='verify'?'verified_at':null;
   const receiptEvent='started_at'in result?result.started_at:'completed_at'in result?result.completed_at:'verified_at'in result?result.verified_at:null;
   if(event&&fresh[event]!==receiptEvent)throw Error('work_order_readback_event');
   mark('acknowledged');setChecklistPresence({binding,keep:fresh.status==='in_progress'});setObservation({token,row:fresh});setNotice('saved');const cleared={binding,notes:'',cost:''};fieldsRef.current=cleared;setFields(cleared);
   onChanged(fresh.status);
  }catch(error){if(current()){mark(attemptRef.current?.phase==='acknowledged'?'acknowledged':error&&typeof error==='object'&&'canonicalRejection'in error&&error.canonicalRejection===true?'rejected':'unknown');setObservation(null);setNotice(error&&typeof error==='object'&&'canonicalRejection'in error&&error.canonicalRejection===true&&'errorCode'in error?(error.errorCode==='42501'?'forbidden':error.errorCode==='40001'?'conflict':'error'):'error');onUnavailable?.();}}
  finally{if(current())operation.current=null;}
 }
 const edit=(key:'notes'|'cost',value:string)=>{if(operation.current||blocked||attemptBlocked()||committed.current!==token)return;const next={...(fieldsRef.current.binding===binding?fieldsRef.current:{binding,notes:'',cost:''}),[key]:value};fieldsRef.current=next;setFields(next);};
 return <section className="mb-4 space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm"><h2 className="font-bold">{t.title}</h2>{row?<div className="space-y-1 text-sm"><p className="font-semibold">#{row.work_order_no} · {row.title}</p><p>{row.vendor_name}</p>{row.completion_summary?<p>{row.completion_summary}</p>:null}<dl className="grid gap-1 text-xs">{([[lang==='fa'?'شروع کار':lang==='ro'?'Început':'Started',row.started_at],[lang==='fa'?'ثبت تکمیل':lang==='ro'?'Finalizare':'Completed',row.completed_at],[lang==='fa'?'تأیید':lang==='ro'?'Verificare':'Verified',row.verified_at]] as const).map(([label,value])=>value?<div key={label}><dt className="inline font-semibold">{label}: </dt><dd className="inline"><time dateTime={value}>{new Intl.DateTimeFormat(lang==='fa'?'fa-IR':lang==='ro'?'ro-RO':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}</time></dd></div>:null)}</dl><a className="text-teal-800 underline" href={`/${lang}/app/maintenance?context=${encodeURIComponent(contextId)}&work_order=${encodeURIComponent(workOrderId)}`}>{lang==='fa'?'بازکردن دوبارهٔ سابقه':lang==='ro'?'Redeschide înregistrarea':'Reopen this record'}</a></div>:null}
  <p>{blocked||ownAttempt?.phase==='acknowledged'&&notice===''?progressCopy[lang].last:t.status}: {row?t[row.status]:reading&&admitted?t.loading:progressCopy[lang].unconfirmed}</p><p className="text-xs text-slate-600">{t.note}</p>
  {ownAttempt?.phase==='sending'?<p role="status">{progressCopy[lang].pending}</p>:ownAttempt?.phase==='acknowledged'&&notice===''?<p role="status">{progressCopy[lang].readback}</p>:ownAttempt?.phase==='unknown'?<p role="status">{t.uncertain}</p>:notice?<p role="status">{t[notice]}</p>:null}
  {checklistPresence?.binding===binding&&checklistPresence.keep?<div hidden={!row||row.status!=='in_progress'}><WorkOrderChecklistPanel contextId={contextId} workOrderId={workOrderId} lang={lang} onReady={onReady} ready={!!row&&row.status==='in_progress'&&admitted&&!reading&&!blocked} scopeKey={scopeKey}/></div>:null}
  {row&&!action&&ownAttempt?.phase==='unknown'&&fields.binding===binding&&(fields.notes!==''||fields.cost!=='')?<fieldset className="space-y-2"><legend>{t.snapshot}</legend><label>{t.notes}<textarea readOnly value={fields.notes}/></label>{fields.cost!==''?<label>{t.cost}<input readOnly value={fields.cost}/></label>:null}</fieldset>:null}
  {row&&action?<form className="space-y-3" onSubmit={e=>{e.preventDefault();void submit();}}>
   {action==='complete'||action==='verify'?<label className="block">{t.notes}<textarea name="notes" required maxLength={2000} value={fields.binding===binding?fields.notes:''} onChange={e=>edit('notes',e.target.value)} disabled={blocked||reading} className="mt-1 block w-full rounded-lg border bg-white p-2"/></label>:null}
   {action==='complete'?<label className="block">{t.cost}<input name="cost" type="number" min="0" step="0.0001" value={fields.binding===binding?fields.cost:''} onChange={e=>edit('cost',e.target.value)} disabled={blocked||reading} className="mt-1 block w-full rounded-lg border bg-white p-2"/></label>:null}
   <button type="submit" disabled={blocked||reading||(action==='complete'&&!checklistReady)} className="rounded-lg bg-teal-700 px-4 py-2 font-bold text-white disabled:opacity-50">{t[action]}</button>
  </form>:null}
  <button type="button" disabled={!admitted||reading||ownAttempt?.phase==='sending'} onClick={()=>void observe()} className="rounded-lg border px-3 py-2">{t.observe}</button><p className="text-xs">{t.limit}</p>
 </section>;
}
