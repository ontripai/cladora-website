"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import { buildingSetupIdSchema, buildingSetupPayloadSchema, buildingSetupReadSchema, buildingSetupReceiptSchema, createBuildingSetupSchema } from "@/lib/customer/building-setup-schema";
import { readSetupRecord, readSetupAttempt, reconcileSetupAttempt, sameSetupPayload, setupSessionSchema, setupStorageKey, type SetupAttempt, type SetupSession, type SetupRecord, type SetupPayload, type SetupAction } from "@/lib/customer/building-workspace-onboarding";
import {useCustomerContext} from "./CustomerContextProvider";
type Lang="ro"|"en"|"fa";type Unit={code:string;floor:string;area:string};type Stage="edit"|"draft"|"rehearsed"|"submitted"|"approved"|"provisioned"|"cancelled";
const copy={
 ro:{title:"Configurare controlată a clădirii",body:"Definiți structura și simulați soldurile de deschidere înainte de orice scriere.",association:"Asociație",building:"Clădire",code:"Cod",floors:"Etaje",period:"Perioadă contabilă",units:"Unități",add:"Adaugă unitate",area:"Suprafață m²",debit:"Solduri debit",credit:"Solduri credit",preview:"Previzualizare",actions:["Creează proiect","Rulează simularea","Trimite spre aprobare","Aprobă independent","Creează structura"],save:"Salvează unitățile",saved:"Unități salvate",difference:"Diferență",context:"Selectați mai întâi un context de lucru.",notice:"Acceptanța folosește numai date sintetice. Aprobarea necesită un alt utilizator AAL2.",ok:"Operațiunea a fost înregistrată.",error:"Operațiunea a fost respinsă",remove:"Elimină"},
 en:{title:"Controlled building setup",body:"Define the structure and rehearse opening balances before any write.",association:"Association",building:"Building",code:"Code",floors:"Floors",period:"Accounting period",units:"Units",add:"Add unit",area:"Area m²",debit:"Opening debits",credit:"Opening credits",preview:"Preview",actions:["Create draft","Run rehearsal","Submit for approval","Approve independently","Provision structure"],save:"Save units",saved:"Saved units",difference:"Difference",context:"Select a working context first.",notice:"Use synthetic data only. Approval requires another AAL2 user.",ok:"The operation was recorded.",error:"The operation was rejected",remove:"Remove"},
 fa:{title:"راه‌اندازی کنترل‌شده ساختمان",body:"ساختار را تعریف و مانده افتتاحیه را پیش از هرگونه نوشتن آزمایش کنید.",association:"انجمن",building:"ساختمان",code:"کد",floors:"طبقات",period:"دوره حسابداری",units:"واحدها",add:"افزودن واحد",area:"مساحت مترمربع",debit:"مانده بدهکار",credit:"مانده بستانکار",preview:"پیش‌نمایش",actions:["ایجاد پیش‌نویس","اجرای آزمایشی","ارسال برای تأیید","تأیید مستقل","ایجاد ساختار"],save:"ذخیرهٔ واحدها",saved:"واحد ثبت‌شده",difference:"اختلاف",context:"ابتدا یک زمینه کاری انتخاب کنید.",notice:"فقط از داده مصنوعی استفاده کنید. تأیید به کاربر AAL2 دیگری نیاز دارد.",ok:"عملیات ثبت شد.",error:"عملیات رد شد",remove:"حذف"}};
const recoveryCopy = {
 en: { refresh: 'Refresh saved status', retry: 'Check status and retry saved attempt', unknown: 'The result is unknown. Your exact attempt is retained. Check saved status before continuing.', createUnknown: 'Draft creation has an unknown result. The saved attempt is locked to prevent duplicates. Reconciliation by attempt key requires the coordinator; do not create another draft.', blocked: 'Saved state could not be verified. Reload or ask the coordinator; no new write was sent.', invalid: 'Check dates, unit codes, areas and opening balances.', conflict: 'Saved data or status changed. Review the refreshed record before continuing.', reviewer: 'Open independent review', waiting: 'A different authorized reviewer must approve this setup using their own AAL2 account. Return here and refresh saved status afterwards.', resume: 'Saved setup ID', load: 'Load saved setup', loading: 'Checking saved status…' },
 ro: { refresh: 'Actualizează starea salvată', retry: 'Verifică starea și reîncearcă operațiunea salvată', unknown: 'Rezultatul este necunoscut. Operațiunea exactă este păstrată. Verifică starea salvată înainte de a continua.', createUnknown: 'Crearea proiectului are rezultat necunoscut. Operațiunea este blocată pentru a preveni duplicatele. Reconcilierea după cheia operațiunii necesită coordonatorul; nu crea alt proiect.', blocked: 'Starea salvată nu a putut fi verificată. Reîncarcă sau contactează coordonatorul; nu s-a trimis o scriere nouă.', invalid: 'Verifică datele, codurile unităților, suprafețele și soldurile inițiale.', conflict: 'Datele sau starea s-au schimbat. Verifică înregistrarea actualizată înainte de a continua.', reviewer: 'Deschide aprobarea independentă', waiting: 'Un alt evaluator autorizat trebuie să aprobe proiectul din propriul cont AAL2. Revino aici și actualizează starea salvată.', resume: 'ID proiect salvat', load: 'Încarcă proiectul salvat', loading: 'Se verifică starea salvată…' },
 fa: { refresh: 'دریافت وضعیت ثبت‌شده', retry: 'بررسی وضعیت و تکرار همان تلاش', unknown: 'نتیجه نامشخص است. همان تلاش حفظ شده است؛ پیش از ادامه وضعیت ثبت‌شده را بررسی کنید.', createUnknown: 'نتیجه ایجاد پیش‌نویس نامشخص است. برای جلوگیری از ثبت تکراری، تلاش ذخیره‌شده قفل است. تطبیق شناسه تلاش به هماهنگ‌کننده نیاز دارد؛ پیش‌نویس دیگری ایجاد نکنید.', blocked: 'وضعیت ذخیره‌شده تأیید نشد. صفحه را دوباره بارگذاری کنید یا با هماهنگ‌کننده تماس بگیرید؛ درخواست نوشتن جدیدی ارسال نشد.', invalid: 'تاریخ‌ها، کد واحدها، متراژ و مانده افتتاحیه را بررسی کنید.', conflict: 'اطلاعات یا وضعیت ثبت‌شده تغییر کرده است؛ پیش از ادامه، اطلاعات تازه را بررسی کنید.', reviewer: 'ورود به تأیید مستقل', waiting: 'تأیید باید توسط فرد مجاز دیگری با حساب AAL2 خودش انجام شود. سپس به این صفحه برگردید و وضعیت ثبت‌شده را دریافت کنید.', resume: 'شناسه راه‌اندازی ذخیره‌شده', load: 'بارگذاری راه‌اندازی', loading: 'در حال بررسی وضعیت ثبت‌شده…' },
};
export function CustomerBuildingSetupWizard({lang}:{lang:Lang}) {
 const {active,dashboard}=useCustomerContext();
 if(!active||!dashboard?.workspace_id)return <p role="status">{copy[lang].context}</p>;
 return <BuildingSetup key={`${active.membership_id}:${active.context_id}:${dashboard.workspace_id}`} lang={lang} workspaceId={dashboard.workspace_id}/>;
}
function BuildingSetup({lang,workspaceId}:{lang:Lang;workspaceId:string}) {
 const t=copy[lang],r=recoveryCopy[lang],{active,registerUnsavedGuard}=useCustomerContext();
 const [association,setAssociation]=useState("CLADORA Synthetic Association"),[building,setBuilding]=useState("Synthetic Building A"),[code,setCode]=useState("BLD-A"),[floors,setFloors]=useState("4"),[start,setStart]=useState("2026-01-01"),[end,setEnd]=useState("2026-12-31"),[units,setUnits]=useState<Unit[]>([{code:"A-01",floor:"0",area:"62"}]),[debit,setDebit]=useState("0"),[credit,setCredit]=useState("0"),[runId,setRunId]=useState(""),[stage,setStage]=useState<Stage>("edit"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [legacy,setLegacy]=useState(false);
 const [savedUnits,setSavedUnits]=useState<Unit[]|null>(null),[pending,setPending]=useState<SetupAttempt|null>(null),[checking,setChecking]=useState(true),[blocked,setBlocked]=useState(false),[resumeId,setResumeId]=useState('');
 const alive=useRef(false),lock=useRef(false),recordRef=useRef<SetupRecord|null>(null),sessionRef=useRef<SetupSession|null>(null);
 const contextId=active?.context_id??'',membershipId=active?.membership_id??'';
 const storageKey=setupStorageKey(contextId,membershipId,workspaceId);
 const difference=useMemo(()=>Number(debit||0)-Number(credit||0),[debit,credit]),field="min-w-0 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 disabled:bg-slate-50";
 const dirtyUnits=stage==="draft"&&JSON.stringify(units)!==JSON.stringify(savedUnits);
 const dirtyForm=stage==="edit"&&(association!=="CLADORA Synthetic Association"||building!=="Synthetic Building A"||code!=="BLD-A"||floors!=="4"||start!=="2026-01-01"||end!=="2026-12-31"||JSON.stringify(units)!==JSON.stringify([{code:"A-01",floor:"0",area:"62"}])||debit!=="0"||credit!=="0");
 const discardUnsaved=useCallback(()=>{if(stage==="draft"){setUnits(savedUnits?.map(unit=>({...unit}))??[]);return}setAssociation("CLADORA Synthetic Association");setBuilding("Synthetic Building A");setCode("BLD-A");setFloors("4");setStart("2026-01-01");setEnd("2026-12-31");setUnits([{code:"A-01",floor:"0",area:"62"}]);setDebit("0");setCredit("0")},[stage,savedUnits]);
 useEffect(()=>registerUnsavedGuard(`building-setup:${membershipId}:${contextId}`,dirtyUnits||dirtyForm||!!pending,discardUnsaved),[registerUnsavedGuard,membershipId,contextId,dirtyUnits,dirtyForm,pending,discardUnsaved]);
 const applyPayload=useCallback((payload:SetupPayload, effective?:SetupPayload['units']|null)=>{
  const recorded=(effective??payload.units).map(u=>({code:u.code,floor:u.floor===null?'':String(u.floor),area:u.area_m2===null?'':String(u.area_m2)}));
  setUnits(recorded);setAssociation(payload.association.name);setBuilding(payload.building.name);setCode(payload.building.code);setFloors(String(payload.building.floors));setStart(payload.period_start);setEnd(payload.period_end);
  setDebit(String(payload.opening_balances.filter(v=>v.side==='debit').reduce((sum,v)=>sum+v.amount,0)));setCredit(String(payload.opening_balances.filter(v=>v.side==='credit').reduce((sum,v)=>sum+v.amount,0)));
  return recorded;
 },[]);
 const applyRecord=useCallback((record:SetupRecord, attemptedUnits?:SetupPayload['units'])=>{
  setLegacy(record.creation_request_hash===null);recordRef.current=record;setRunId(record.run_id);setStage(record.status);setSavedUnits(applyPayload(record.payload,record.effective_units));
  if(attemptedUnits)setUnits(attemptedUnits.map(u=>({code:u.code,floor:u.floor===null?'':String(u.floor),area:u.area_m2===null?'':String(u.area_m2)})));
 },[applyPayload]);
 const persist=useCallback((session:SetupSession)=>{
  const valid=setupSessionSchema.parse(session);
  window.sessionStorage.setItem(storageKey,JSON.stringify(valid));
  sessionRef.current=valid;
  if(alive.current)setPending(valid.pending);
 },[storageKey]);
 useEffect(()=>{
  alive.current=true;let cancelled=false;
  (async()=>{
   try {
    const raw=window.sessionStorage.getItem(storageKey);
    if(!raw&&window.sessionStorage.getItem(`cladora.building-setup.attempt.v1:${membershipId}:${contextId}`))throw Error('legacy_session_review_required');
    const session=raw?setupSessionSchema.parse(JSON.parse(raw)):{version:2 as const,context_id:contextId,membership_id:membershipId,workspace_id:workspaceId,run_id:null,pending:null};
    if(session.context_id!==contextId||session.membership_id!==membershipId||session.workspace_id!==workspaceId)throw Error('foreign_session');
    sessionRef.current=session;
    if(cancelled)return;
    setPending(session.pending);
    if(session.run_id)setRunId(session.run_id);
    if(session.pending?.action==='create')applyPayload(session.pending.command.payload);
    const urlId=new URLSearchParams(window.location.search).get('run_id');
    if(session.pending?.action==='create'&&!session.run_id){
     await readSetupAttempt(contextId,workspaceId,session.pending.command.idempotency_key);
     if(!cancelled)setMessage(r.unknown);return;
    }
    const legacy=window.sessionStorage.getItem(`building-setup:${contextId}`);
    const restored=session.run_id??urlId??legacy;
    if(!restored)return;
    buildingSetupIdSchema.parse(restored);
    const record=await readSetupRecord(contextId,workspaceId,restored);
    if(cancelled)return;
    const resolution=session.pending?reconcileSetupAttempt(session.pending,record):'done';
    if(resolution==='conflict')throw Error('conflict');
    persist({...session,run_id:record.run_id,pending:resolution==='done'?null:session.pending});
    applyRecord(record,resolution==='retry'&&session.pending?.action==='save'?session.pending.units:undefined);
    if(resolution==='retry')setMessage(r.unknown);
   }catch{if(!cancelled){setBlocked(true);setMessage(r.blocked);}}
   finally{if(!cancelled)setChecking(false);}
  })();
  return()=>{cancelled=true;alive.current=false;};
 },[contextId,membershipId,workspaceId,storageKey,applyPayload,applyRecord,persist,r]);
 const wireUnits=()=>units.map(u=>({code:u.code,floor:u.floor===""?null:Number(u.floor),area_m2:u.area===""?null:Number(u.area)}));
 const updateUnit=(i:number,key:keyof Unit,value:string)=>setUnits(list=>list.map((u,n)=>n===i?{...u,[key]:value}:u));
 async function refresh(id=runId) {
  if(lock.current||!contextId||!sessionRef.current)return;
  if(sessionRef.current.pending?.action==='create'&&!sessionRef.current.run_id){setMessage(r.unknown);return;}
  lock.current=true;setBusy(true);setMessage('');
  try {
   buildingSetupIdSchema.parse(id);
   const record=await readSetupRecord(contextId,workspaceId,id);
   if(!alive.current)return;
   const session=sessionRef.current;
   if(session.run_id&&session.run_id!==id)throw Error('conflict');
   const result=session.pending?reconcileSetupAttempt(session.pending,record):'done';
   if(result==='conflict'){applyRecord(record);throw Error('conflict');}
   persist({...session,run_id:id,pending:result==='done'?null:session.pending});
   applyRecord(record,result==='retry'&&session.pending?.action==='save'?session.pending.units:undefined);setBlocked(false);setMessage(result==='retry'?r.unknown:t.ok);
  }catch{if(alive.current){setBlocked(true);setMessage(r.blocked);}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function call(action?:SetupAction) {
  if(lock.current||checking||blocked||legacy||!sessionRef.current)return;
  if(!contextId){setMessage(t.context);return;}
  lock.current=true;setBusy(true);setMessage('');
  try {
   let session=sessionRef.current,attempt=session.pending;
   if(attempt?.action==='create'){
    await readSetupAttempt(contextId,workspaceId,attempt.command.idempotency_key);
    if(!alive.current)return;
   }else if(attempt){
    const record=await readSetupRecord(contextId,workspaceId,session.run_id!);
    if(!alive.current)return;
    if(record.creation_request_hash===null){applyRecord(record);return;}
    const result=reconcileSetupAttempt(attempt,record);
    if(result==='conflict'){applyRecord(record);setMessage(r.conflict);return;}
    if(result==='done'){persist({...session,pending:null});applyRecord(record);setMessage(t.ok);return;}
   }else if(action){
    const before=recordRef.current;
    if(!before||!session.run_id)return;
    const record=await readSetupRecord(contextId,workspaceId,session.run_id);
    if(!alive.current)return;
    if(record.creation_request_hash===null){applyRecord(record);return;}
    if(record.status!==before.status||!sameSetupPayload(record.payload,before.payload)){
     applyRecord(record);if(action==='save')setUnits(units);setMessage(r.conflict);return;
    }
    const expected={save:'draft',rehearse:'draft',submit:'rehearsed',provision:'approved'}[action];
    if(record.status!==expected){applyRecord(record);setMessage(r.conflict);return;}
    if(action==='rehearse'&&dirtyUnits){setMessage(t.save);return;}
    attempt={action,run_id:record.run_id,context_id:contextId,workspace_id:workspaceId,command_key:`setup-${record.run_id}-r${record.revision}-${crypto.randomUUID()}`,before:record,...(action==='save'?{units:wireUnits()}: {})};
   }else{
    if(session.run_id)return;
    if(!Number.isFinite(Number(debit))||!Number.isFinite(Number(credit))||Number(debit)<0||Number(credit)<0||difference!==0)throw Error('invalid_balances');
    const command=createBuildingSetupSchema.parse({context_id:contextId,workspace_id:workspaceId,idempotency_key:`setup-${crypto.randomUUID()}`,payload:{association:{name:association},building:{name:building,code,floors:Number(floors)},currency:'RON',period_start:start,period_end:end,units:wireUnits(),opening_balances:[...(Number(debit)>0?[{account_code:'OPEN-DEBIT',side:'debit',amount:Number(debit)}]:[]),...(Number(credit)>0?[{account_code:'OPEN-CREDIT',side:'credit',amount:Number(credit)}]:[])]}});
    attempt={action:'create',command};
   }
   // Persist BEFORE dispatch; storage failure sends zero writes. Never replace an uncertain attempt.
   persist({...session,pending:attempt});
   attempt=sessionRef.current!.pending!;
   const path=attempt.action==='create'?'':`/${attempt.run_id}${attempt.action==='save'?'':`/${attempt.action}`}`;
   const body=attempt.action==='create'?attempt.command:{context_id:attempt.context_id,workspace_id:attempt.workspace_id,expected_revision:attempt.before.revision,command_key:attempt.command_key,...(attempt.action==='save'?{units:attempt.units}:{})};
   const response=await fetch(`/api/customer/v1/onboarding/building-setup${path}`,{method:attempt.action==='save'?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20_000)});
   const result=await response.json();
   if(!alive.current)return;
   if(!response.ok)throw Error('unknown');
   const receipt=buildingSetupReceiptSchema.parse(result);
   if(receipt.workspace_id!==workspaceId)throw Error('foreign_receipt');
   const id=receipt.run_id;
   if(attempt.action==='create'){if(!receipt.creation_request_hash)throw Error('missing_creation_binding');attempt={...attempt,receipt_hash:receipt.creation_request_hash};}
   if(attempt.action!=='create'&&id!==attempt.run_id)throw Error('mismatch');
   session={...session,run_id:id,pending:attempt};persist(session);setRunId(id);
   const record=await readSetupRecord(contextId,workspaceId,id);
   if(!alive.current)return;
   if(reconcileSetupAttempt(attempt,record)!=='done')throw Error('unknown');
   persist({...session,pending:null});applyRecord(record);setMessage(t.ok);
  }catch{
   if(alive.current)setMessage(sessionRef.current?.pending?r.unknown:r.invalid);
  }finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const frozen=busy||checking||blocked||legacy||!!pending;
 const actionDefs:[Stage,SetupAction|undefined][]=[["edit",undefined],["draft","rehearse"],["rehearsed","submit"]];
 return <section dir={lang==="fa"?"rtl":"ltr"} className="mx-auto max-w-5xl space-y-6 rounded-2xl border bg-white p-6 shadow-sm"><header><h1 className="mt-2 text-2xl font-bold">{t.title}</h1><p className="mt-2 text-slate-600">{t.body}</p></header><p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">{t.notice}</p>
 <fieldset disabled={frozen||stage!=="edit"} className="grid gap-4 md:grid-cols-2">{[[t.association,association,setAssociation],[t.building,building,setBuilding],[t.code,code,setCode],[t.floors,floors,setFloors]].map(([label,value,setter])=><label key={label as string} className="grid gap-1 text-sm">{label as string}<input className={field} type={label===t.floors?"number":"text"} value={value as string} onChange={e=>(setter as (v:string)=>void)(e.target.value)}/></label>)}</fieldset>
 <fieldset disabled={frozen||stage!=="edit"} className="grid gap-4 rounded-xl border p-4 md:grid-cols-2"><legend className="px-2 font-semibold">{t.period}</legend><input aria-label="period start" className={field} type="date" value={start} onChange={e=>setStart(e.target.value)}/><input aria-label="period end" className={field} type="date" value={end} onChange={e=>setEnd(e.target.value)}/></fieldset>
 <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">{t.units}{savedUnits?` · ${t.saved}: ${savedUnits.length}`:""}</h2><button type="button" disabled={frozen||(stage!=="edit"&&stage!=="draft")} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={()=>setUnits(u=>[...u,{code:`A-${String(u.length+1).padStart(2,"0")}`,floor:"",area:""}])}>{t.add}</button></div>{units.map((unit,i)=><div key={i} className="grid gap-2 sm:grid-cols-4"><input aria-label={`${t.code} ${i+1}`} disabled={frozen||(stage!=="edit"&&stage!=="draft")} className={field} value={unit.code} onChange={e=>updateUnit(i,"code",e.target.value)}/><input aria-label={`${t.floors} ${i+1}`} disabled={frozen||(stage!=="edit"&&stage!=="draft")} className={field} type="number" value={unit.floor} onChange={e=>updateUnit(i,"floor",e.target.value)}/><input aria-label={`${t.area} ${i+1}`} disabled={frozen||(stage!=="edit"&&stage!=="draft")} className={field} type="number" min="0" step="0.01" value={unit.area} onChange={e=>updateUnit(i,"area",e.target.value)}/><button type="button" disabled={frozen||units.length===1||(stage!=="edit"&&stage!=="draft")} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={()=>setUnits(u=>u.filter((_,n)=>n!==i))}>{t.remove}</button></div>)}</div>
 <fieldset disabled={frozen||stage!=="edit"} className="grid gap-4 rounded-xl border p-4 md:grid-cols-2"><legend className="px-2 font-semibold">{t.preview}</legend><label className="grid gap-1 text-sm">{t.debit}<input className={field} type="number" min="0" step="0.01" value={debit} onChange={e=>setDebit(e.target.value)}/></label><label className="grid gap-1 text-sm">{t.credit}<input className={field} type="number" min="0" step="0.01" value={credit} onChange={e=>setCredit(e.target.value)}/></label><p className={`md:col-span-2 rounded-lg p-3 text-sm font-semibold ${difference===0?"bg-teal-50 text-teal-800":"bg-red-50 text-red-700"}`}>{t.difference}: {difference.toFixed(2)} RON · {units.length} {t.units}</p></fieldset>
 {dirtyUnits&&<p className="text-sm font-semibold text-amber-800">{t.save}</p>}<div className="flex flex-wrap gap-2">{actionDefs.map(([required,action],i)=><button key={required} disabled={frozen||!active||stage!==required||(required==="edit"&&(!Number.isFinite(difference)||difference!==0))||(required==="draft"&&dirtyUnits)} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>call(action)}>{t.actions[i]}</button>)}{stage==="draft"&&<button disabled={frozen||!dirtyUnits} className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 disabled:opacity-40" onClick={()=>call("save")}>{t.save}</button>}<button disabled={frozen||!runId||stage!=="approved"} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>call("provision")}>{t.actions[4]}</button></div>{stage==="submitted"&&<div className="space-y-2 rounded-lg border p-3"><p>{r.waiting}</p><Link className="inline-block rounded border px-3 py-2 underline" href={`/${lang}/pilot-reviewer`}>{r.reviewer}</Link></div>}
 {pending&&<div role="alert" className="break-words rounded-lg border border-amber-300 p-3"><p>{r.unknown}</p>{pending.action==='create'&&<code className="block break-all text-xs">{pending.command.idempotency_key}</code>}{<button type="button" disabled={busy||checking||blocked} className="mt-2 rounded-lg border p-2" onClick={()=>call()}>{r.retry}</button>}</div>}
 {runId&&<button type="button" disabled={busy||checking||(dirtyUnits&&!pending)} className="rounded-lg border p-2" onClick={()=>refresh()}>{r.refresh}</button>}
 {!runId&&!pending&&<form className="flex flex-wrap items-end gap-2" onSubmit={event=>{event.preventDefault();void refresh(resumeId);}}><label className="grid min-w-0 flex-1 gap-1">{r.resume}<input className={field} value={resumeId} onChange={event=>setResumeId(event.target.value)} disabled={busy||checking}/></label><button className="rounded-lg border p-2" disabled={busy||checking||!buildingSetupIdSchema.safeParse(resumeId).success}>{r.load}</button></form>}
 {legacy&&<p role="alert">{lang==='fa'?'این رکورد قدیمی فاقد مبنای تأیید نسخه‌دار است و به بازبینی رسمی نیاز دارد.':lang==='ro'?'Înregistrarea veche nu are proveniența versiunii aprobate și necesită o revizuire autorizată.':'This legacy record has no bound approval provenance and requires authorized review.'}</p>}
 {checking&&<p role="status">{r.loading}</p>}
 <p aria-live="polite" className="break-words text-sm text-slate-700">{stage.toUpperCase()}{runId?` · ${runId}`:""}{message?` · ${message}`:""}</p></section>}
