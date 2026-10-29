"use client";
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {CustomerOnboardingTemplates} from "./CustomerOnboardingTemplates";
import {CustomerBuildingSetupProgress} from "./CustomerBuildingSetupProgress";
import { buildingSetupIdSchema, buildingSetupPayloadSchema, buildingSetupReadSchema, buildingSetupReceiptSchema, createBuildingSetupSchema } from "@/lib/customer/building-setup-schema";
import { SetupReadError, recoverSetupCommand, readSetupRecord, readSetupAttempt, reconcileSetupAttempt, sameSetupPayload, setupSessionSchema, setupStorageKey, type SetupAttempt, type SetupSession, type SetupRecord, type SetupPayload, type SetupAction } from "@/lib/customer/building-workspace-onboarding";
import {useCustomerContext} from "./CustomerContextProvider";
type Lang="ro"|"en"|"fa";type Unit={code:string;floor:string;area:string};type Stage="edit"|"draft"|"rehearsed"|"submitted"|"approved"|"provisioned"|"cancelled";
const copy={
 ro:{title:"Configurare controlată a clădirii",body:"Completează datele clădirii și salvează un proiect. Verifică soldurile inițiale, cere aprobarea, apoi înregistrează structura aprobată.",association:"Asociație",building:"Clădire",code:"Cod",floors:"Etaje",period:"Perioadă contabilă",units:"Unități",add:"Adaugă unitate",area:"Suprafață m²",debit:"Solduri debit",credit:"Solduri credit",preview:"Previzualizare",actions:["Creează proiect","Rulează simularea","Trimite spre aprobare","Aprobă independent","Creează structura"],save:"Salvează unitățile",saved:"Unități salvate",difference:"Diferență",context:"Selectați mai întâi un context de lucru.",notice:"Folosește doar date de test. Aprobarea trebuie făcută de alt utilizator autorizat, cu verificare în doi pași (AAL2).",ok:"Starea salvată a fost verificată.",error:"Operațiunea a fost respinsă",remove:"Elimină"},
 en:{title:"Controlled building setup",body:"Enter the building details and save a draft. Check opening balances, request approval, then record the approved structure.",association:"Association",building:"Building",code:"Code",floors:"Floors",period:"Accounting period",units:"Units",add:"Add unit",area:"Area m²",debit:"Opening debits",credit:"Opening credits",preview:"Preview",actions:["Create draft","Run rehearsal","Submit for approval","Approve independently","Provision structure"],save:"Save units",saved:"Saved units",difference:"Difference",context:"Select a working context first.",notice:"Use test data only. Approval requires another authorized user with two-step verification (AAL2).",ok:"Saved status checked.",error:"The operation was rejected",remove:"Remove"},
 fa:{title:"راه‌اندازی کنترل‌شده ساختمان",body:"اطلاعات ساختمان را وارد و پیش‌نویس را ذخیره کنید. سپس مانده‌های شروع دوره را بررسی کنید، تأیید بگیرید و ساختار تأییدشده را ثبت کنید.",association:"انجمن",building:"ساختمان",code:"کد",floors:"طبقات",period:"دوره حسابداری",units:"واحدها",add:"افزودن واحد",area:"مساحت مترمربع",debit:"مانده بدهکار",credit:"مانده بستانکار",preview:"پیش‌نمایش",actions:["ایجاد پیش‌نویس","اجرای آزمایشی","ارسال برای تأیید","تأیید مستقل","ایجاد ساختار"],save:"ذخیرهٔ واحدها",saved:"واحد ثبت‌شده",difference:"اختلاف",context:"ابتدا یک زمینه کاری انتخاب کنید.",notice:"فقط از دادهٔ آزمایشی استفاده کنید. تأیید باید توسط فرد مجاز دیگری با ورود دومرحله‌ای (AAL2) انجام شود.",ok:"وضعیت ذخیره‌شده بررسی شد.",error:"عملیات رد شد",remove:"حذف"}};
const recoveryCopy = {
 en: { check: 'Check saved access and status', denied: 'You no longer have access to this setup. Requests saved in this tab have not been deleted. Check access before continuing.', refresh: 'Refresh saved status', retry: 'Check status and retry saved attempt', unknown: 'The request result is still unknown. Your original request remains saved in this tab. Check its status before sending the same request again.', createUnknown: 'Draft creation has an unknown result. The saved attempt is locked to prevent duplicates. Reconciliation by attempt key requires the coordinator; do not create another draft.', blocked: 'Saved status could not be confirmed. Check access and status again, keeping the original request.', invalid: 'Check dates, unit codes, areas and opening balances.', conflict: 'The saved request no longer matches the current data or status. Check the current status before continuing.', reviewer: 'Open independent review', waiting: 'Wait for another authorized reviewer to approve using their own account with two-step verification (AAL2). Then return here and refresh the status.', resume: 'Saved setup ID', load: 'Load saved setup', loading: 'Checking saved status…' },
 ro: { check: 'Verifică accesul și starea salvate', denied: 'Nu mai ai acces la această configurare. Cererile salvate în această filă nu au fost șterse. Verifică accesul înainte să continui.', refresh: 'Actualizează starea salvată', retry: 'Verifică starea și reîncearcă operațiunea salvată', unknown: 'Rezultatul cererii nu este încă clar. Cererea inițială rămâne salvată în această filă. Verifică starea înainte să retrimiți aceeași cerere.', createUnknown: 'Crearea proiectului are rezultat necunoscut. Operațiunea este blocată pentru a preveni duplicatele. Reconcilierea după cheia operațiunii necesită coordonatorul; nu crea alt proiect.', blocked: 'Starea salvată nu poate fi confirmată. Verifică din nou accesul și starea, păstrând cererea inițială.', invalid: 'Verifică datele, codurile unităților, suprafețele și soldurile inițiale.', conflict: 'Datele sau starea diferă de cererea salvată. Verifică starea actuală înainte să continui.', reviewer: 'Deschide aprobarea independentă', waiting: 'Așteaptă aprobarea altei persoane autorizate, din propriul cont cu verificare în doi pași (AAL2). Apoi revino aici și actualizează starea.', resume: 'ID proiect salvat', load: 'Încarcă proiectul salvat', loading: 'Se verifică starea salvată…' },
 fa: { check: 'بررسی دسترسی و وضعیت ذخیره‌شده', denied: 'دیگر به این راه‌اندازی دسترسی ندارید. درخواست‌های ذخیره‌شده در این زبانه پاک نشده‌اند. پیش از ادامه، دسترسی را بررسی کنید.', refresh: 'دریافت وضعیت ثبت‌شده', retry: 'بررسی وضعیت و تکرار همان تلاش', unknown: 'نتیجهٔ درخواست هنوز مشخص نیست. درخواست اولیه در همین زبانه ذخیره مانده است. پیش از ارسال دوبارهٔ همان درخواست، وضعیت آن را بررسی کنید.', createUnknown: 'نتیجه ایجاد پیش‌نویس نامشخص است. برای جلوگیری از ثبت تکراری، تلاش ذخیره‌شده قفل است. تطبیق شناسه تلاش به هماهنگ‌کننده نیاز دارد؛ پیش‌نویس دیگری ایجاد نکنید.', blocked: 'وضعیت ذخیره‌شده هنوز قابل تأیید نیست. همان درخواست اولیه را نگه دارید و دسترسی و وضعیت را دوباره بررسی کنید.', invalid: 'تاریخ‌ها، کد واحدها، متراژ و مانده افتتاحیه را بررسی کنید.', conflict: 'اطلاعات یا وضعیت فعلی با درخواست ذخیره‌شده یکسان نیست. پیش از ادامه، وضعیت فعلی را بررسی کنید.', reviewer: 'ورود به تأیید مستقل', waiting: 'منتظر تأیید فرد مجاز دیگری از حساب خودش با ورود دومرحله‌ای (AAL2) بمانید. سپس به این صفحه برگردید و وضعیت را تازه کنید.', resume: 'شناسه راه‌اندازی ذخیره‌شده', load: 'بارگذاری راه‌اندازی', loading: 'در حال بررسی وضعیت ثبت‌شده…' },
};
function hasSetupConfirmation(record:SetupRecord,workspaceId:string) {
 const creationProof=record?buildingSetupReceiptSchema.safeParse(record.creation_receipt):null;
 const creationConfirmed=!!(record&&creationProof?.success&&record.creation_request_hash
  &&creationProof.data.run_id===record.run_id&&creationProof.data.workspace_id===workspaceId
  &&creationProof.data.revision===1&&creationProof.data.status==='draft'
  &&creationProof.data.creation_request_hash===record.creation_request_hash);
 const commandProof=record?buildingSetupReceiptSchema.safeParse(record.last_command_receipt):null;
 const commandConfirmed=!!(record&&commandProof?.success&&record.revision>1
  &&commandProof.data.run_id===record.run_id&&commandProof.data.workspace_id===workspaceId
  &&commandProof.data.status===record.status&&commandProof.data.revision===record.revision
  &&commandProof.data.payload_hash===record.payload_hash&&commandProof.data.command_key===record.last_command_key
  &&typeof record.last_command_key==='string'&&record.last_command_key.startsWith(`setup-${record.run_id}-r${record.revision-1}-`)
  &&commandProof.data.expected_revision===record.revision-1
  &&commandProof.data.operation===({draft:'update',rehearsed:'rehearse',submitted:'submit',approved:'approve',provisioned:'provision',cancelled:'cancel'}[record.status]));
 const savedReceiptConfirmed=!!(record&&creationConfirmed&&(record.revision===1?record.status==='draft':commandConfirmed));
 const propertyConfirmed=!!(savedReceiptConfirmed&&record&&record.status==='provisioned'&&commandProof?.success
  &&buildingSetupIdSchema.safeParse(record.property_id).success
  &&record.effective_units!==null&&record.effective_units!==undefined
  &&commandProof.data.property_id===record.property_id);
 return savedReceiptConfirmed&&(record.status!=='provisioned'||propertyConfirmed);
}
export function CustomerBuildingSetupWizard({lang}:{lang:Lang}) {
 const {active,dashboard}=useCustomerContext();
 const [retainedScope,setRetainedScope]=useState<{context:string;membership:string;workspace:string}|null>(null);
 const current=active&&dashboard?.workspace_id?{context:active.context_id,membership:active.membership_id,workspace:dashboard.workspace_id}:null;
 if(current&&(retainedScope?.context!==current.context||retainedScope.membership!==current.membership||retainedScope.workspace!==current.workspace))setRetainedScope(current);
 // Retain only this mounted scope's local edits while its dashboard is absent.
 // Cached identity is never readiness or permission to read/write.
 const scope=current??(active&&retainedScope?.context===active.context_id&&retainedScope.membership===active.membership_id?retainedScope:null);
 if(!scope)return <p role="status">{copy[lang].context}</p>;
 return <BuildingSetup key={`${scope.membership}:${scope.context}:${scope.workspace}`} lang={lang} workspaceId={scope.workspace} targetAvailable={!!current}/>;
}
function BuildingSetup({lang,workspaceId,targetAvailable}:{lang:Lang;workspaceId:string;targetAvailable:boolean}) {
 const t=copy[lang],r=recoveryCopy[lang],{active,registerUnsavedGuard,loading:contextLoading,error:contextError}=useCustomerContext();
 const [association,setAssociation]=useState("CLADORA Synthetic Association"),[building,setBuilding]=useState("Synthetic Building A"),[code,setCode]=useState("BLD-A"),[floors,setFloors]=useState("4"),[start,setStart]=useState("2026-01-01"),[end,setEnd]=useState("2026-12-31"),[units,setUnits]=useState<Unit[]>([{code:"A-01",floor:"0",area:"62"}]),[debit,setDebit]=useState("0"),[credit,setCredit]=useState("0"),[runId,setRunId]=useState(""),[stage,setStage]=useState<Stage>("edit"),[busy,setBusy]=useState(false),[notice,setNotice]=useState<''|'unknown'|'blocked'|'invalid'|'conflict'|'ok'|'save'|'context'>('');
 const ready=targetAvailable&&!contextLoading&&!contextError;
 const [readiness,setReadiness]=useState({ready,version:0});
 if(readiness.ready!==ready)setReadiness({ready,version:readiness.version+1});
 const scopeVersion=readiness.version;
 const [verifiedVersion,setVerifiedVersion]=useState<number|null>(null);
 const [retainedKind,setRetainedKind]=useState<'form'|'units'|null>(null);
 const [confirmedRecord,setConfirmedRecord]=useState<SetupRecord|null>(null);
 const [legacy,setLegacy]=useState(false),[accessLost,setAccessLost]=useState(false),[createMayRetry,setCreateMayRetry]=useState(false);
 const [savedUnits,setSavedUnits]=useState<Unit[]|null>(null),[pending,setPending]=useState<SetupAttempt|null>(null),[checking,setChecking]=useState(true),[blocked,setBlocked]=useState(false),[resumeId,setResumeId]=useState('');
 const alive=useRef(false),lifetime=useRef(0),epoch=useRef(0),operation=useRef<symbol|null>(null),readOwner=useRef<symbol|null>(null),recordRef=useRef<SetupRecord|null>(null),sessionRef=useRef<SetupSession|null>(null),lastRun=useRef<string|null>(null);
 const contextId=active?.context_id??'',membershipId=active?.membership_id??'';
 const storageKey=setupStorageKey(contextId,membershipId,workspaceId);
 const committed=useRef<{ready:boolean;version:number;context:string;membership:string;workspace:string}|null>(null);
 const admitCommit=useCallback(()=>{
  const commit=committed.current;
  return commit?.ready&&commit.version===scopeVersion&&commit.context===contextId&&commit.membership===membershipId&&commit.workspace===workspaceId?commit:null;
 },[scopeVersion,contextId,membershipId,workspaceId]);
 const difference=useMemo(()=>Number(debit||0)-Number(credit||0),[debit,credit]),field="min-w-0 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 disabled:bg-slate-50";
 const dirtyUnits=stage==="draft"&&JSON.stringify(units)!==JSON.stringify(savedUnits);
 const dirtyForm=stage==="edit"&&(association!=="CLADORA Synthetic Association"||building!=="Synthetic Building A"||code!=="BLD-A"||floors!=="4"||start!=="2026-01-01"||end!=="2026-12-31"||JSON.stringify(units)!==JSON.stringify([{code:"A-01",floor:"0",area:"62"}])||debit!=="0"||credit!=="0");
 const applyPayload=useCallback((payload:SetupPayload, effective?:SetupPayload['units']|null)=>{
  const recorded=(effective??payload.units).map(u=>({code:u.code,floor:u.floor===null?'':String(u.floor),area:u.area_m2===null?'':String(u.area_m2)}));
  setUnits(recorded);setAssociation(payload.association.name);setBuilding(payload.building.name);setCode(payload.building.code);setFloors(String(payload.building.floors));setStart(payload.period_start);setEnd(payload.period_end);
  setDebit(String(payload.opening_balances.filter(v=>v.side==='debit').reduce((sum,v)=>sum+v.amount,0)));setCredit(String(payload.opening_balances.filter(v=>v.side==='credit').reduce((sum,v)=>sum+v.amount,0)));
  return recorded;
 },[]);
 const localDraft=useRef<{kind:'form'|'units';association:string;building:string;code:string;floors:string;start:string;end:string;units:Unit[];debit:string;credit:string}|null>(null);
 useEffect(()=>{
  if(dirtyForm||dirtyUnits)localDraft.current={kind:dirtyForm?'form':'units',association,building,code,floors,start,end,units:units.map(u=>({...u})),debit,credit};
  else if(!retainedKind)localDraft.current=null;
 },[dirtyForm,dirtyUnits,retainedKind,association,building,code,floors,start,end,units,debit,credit]);
 const discardUnsaved=useCallback(()=>{
  localDraft.current=null;setRetainedKind(null);
  if(recordRef.current){setSavedUnits(applyPayload(recordRef.current.payload,recordRef.current.effective_units));return;}
  setAssociation("CLADORA Synthetic Association");setBuilding("Synthetic Building A");setCode("BLD-A");setFloors("4");setStart("2026-01-01");setEnd("2026-12-31");setUnits([{code:"A-01",floor:"0",area:"62"}]);setDebit("0");setCredit("0");
 },[applyPayload]);
 useEffect(()=>registerUnsavedGuard(`building-setup:${membershipId}:${contextId}`,dirtyUnits||dirtyForm||!!retainedKind||!!pending,discardUnsaved),[registerUnsavedGuard,membershipId,contextId,dirtyUnits,dirtyForm,retainedKind,pending,discardUnsaved]);
 const requireConfirmation=useCallback((record:SetupRecord)=>{
  if(record.creation_request_hash===null)setLegacy(true);
  if(!hasSetupConfirmation(record,workspaceId))throw Error('setup_confirmation_invalid');
 },[workspaceId]);
 const applyRecord=useCallback((record:SetupRecord, attemptedUnits?:SetupPayload['units'], completed=false)=>{
  requireConfirmation(record);
  let local=localDraft.current;
  if(completed&&local){
   const matchesUnits=JSON.stringify(local.units)===JSON.stringify(record.payload.units.map(u=>({code:u.code,floor:u.floor===null?'':String(u.floor),area:u.area_m2===null?'':String(u.area_m2)})));
   const matchesForm=local.association===record.payload.association.name&&local.building===record.payload.building.name&&local.code===record.payload.building.code&&local.floors===String(record.payload.building.floors)&&local.start===record.payload.period_start&&local.end===record.payload.period_end&&Number(local.debit)===record.payload.opening_balances.filter(b=>b.side==='debit').reduce((n,b)=>n+b.amount,0)&&Number(local.credit)===record.payload.opening_balances.filter(b=>b.side==='credit').reduce((n,b)=>n+b.amount,0);
   if(matchesUnits&&(local.kind==='units'||matchesForm)){localDraft.current=null;local=null;}
  }
  setRetainedKind(local?.kind??null);
  setConfirmedRecord(record);setVerifiedVersion(scopeVersion);setLegacy(false);recordRef.current=record;lastRun.current=record.run_id;setRunId(record.run_id);setStage(record.status);setSavedUnits(applyPayload(record.payload,record.effective_units));
  if(local){
   if(local.kind==='form'){setAssociation(local.association);setBuilding(local.building);setCode(local.code);setFloors(local.floors);setStart(local.start);setEnd(local.end);setDebit(local.debit);setCredit(local.credit);}
   setUnits(local.units.map(u=>({...u})));
  }
  if(attemptedUnits)setUnits(attemptedUnits.map(u=>({code:u.code,floor:u.floor===null?'':String(u.floor),area:u.area_m2===null?'':String(u.area_m2)})));
 },[applyPayload,requireConfirmation,scopeVersion]);
 const persist=useCallback((session:SetupSession)=>{
  const valid=setupSessionSchema.parse(session);
  window.sessionStorage.setItem(storageKey,JSON.stringify(valid));
  sessionRef.current=valid;
  if(alive.current)setPending(valid.pending);
 },[storageKey]);
 const invalidateConfirmation=useCallback(()=>{
  setConfirmedRecord(null);setVerifiedVersion(null);recordRef.current=null;setBlocked(true);setCreateMayRetry(false);
 },[]);
 const clearDisplay=useCallback(()=>{
  epoch.current++;invalidateConfirmation();sessionRef.current=null;setAccessLost(true);setNotice('');
  // Local edits and pending evidence remain in memory/storage, hidden until a
  // fresh authorized read. Never turn saved fields into a new local draft.
 },[invalidateConfirmation]);
 const checkStatus=useCallback(async(id?:string)=>{
  const commit=admitCommit();if(!commit)return;
  const generation=lifetime.current,sequence=++epoch.current,owner=Symbol('read');readOwner.current=owner;setConfirmedRecord(null);setVerifiedVersion(null);setChecking(true);
  let originalBytes:string|null|undefined;
  const current=()=>committed.current===commit&&commit.ready&&alive.current&&lifetime.current===generation&&epoch.current===sequence&&readOwner.current===owner&&(originalBytes===undefined||window.sessionStorage.getItem(storageKey)===originalBytes);
  try{
   const raw=window.sessionStorage.getItem(storageKey);originalBytes=raw;
   if(!raw&&window.sessionStorage.getItem(`cladora.building-setup.attempt.v1:${membershipId}:${contextId}`))throw Error('legacy_session_review_required');
   let session:SetupSession=raw?setupSessionSchema.parse(JSON.parse(raw)):{version:2,context_id:contextId,membership_id:membershipId,workspace_id:workspaceId,run_id:null,pending:null};
   if(session.context_id!==contextId||session.membership_id!==membershipId||session.workspace_id!==workspaceId)throw Error('foreign_session');
   const hadPending=!!session.pending;
   let record:SetupRecord|null=null;
   if(session.pending?.action==='create'){
    const attempt=session.pending;
    record=await readSetupAttempt(contextId,workspaceId,attempt.command.idempotency_key);
    if(!current())return;
    if(record){
     requireConfirmation(record);
     // The authorized SAME-key reader returns the immutable server creation receipt.
     // Verify its target/hash, never infer completion from equal mutable payload/status.
     const proof=buildingSetupReceiptSchema.parse(record.creation_receipt);
     if(proof.run_id!==record.run_id||proof.workspace_id!==workspaceId||proof.revision!==1||proof.status!=='draft'
      ||!proof.creation_request_hash||proof.creation_request_hash!==record.creation_request_hash
      ||(attempt.receipt_hash&&attempt.receipt_hash!==proof.creation_request_hash))throw Error('creation_binding_mismatch');
     session={...session,run_id:record.run_id,pending:null};
    }else{
     sessionRef.current=session;setPending(attempt);applyPayload(attempt.command.payload);setRunId('');setStage('edit');recordRef.current=null;
     setCreateMayRetry(true);setBlocked(false);setAccessLost(false);setVerifiedVersion(scopeVersion);setNotice('unknown');return;
    }
   }else{
    const restored=id??session.run_id??new URLSearchParams(window.location.search).get('run_id')??window.sessionStorage.getItem(`building-setup:${contextId}`)??lastRun.current;
    if(!restored){sessionRef.current=session;setPending(session.pending);setBlocked(false);setAccessLost(false);setVerifiedVersion(scopeVersion);return;}
    buildingSetupIdSchema.parse(restored);
    if(session.run_id&&session.run_id!==restored)throw Error('conflict');
    record=await readSetupRecord(contextId,workspaceId,restored);
    if(!current())return;
    requireConfirmation(record);
    let resolution:'done'|'retry'|'conflict'='done';
    if(session.pending){const recovered=await recoverSetupCommand(session.pending,record,membershipId,current);if(!current())return;record=recovered.record;requireConfirmation(record);resolution=recovered.resolution;}
    if(resolution==='conflict')throw Error('conflict');
    session={...session,run_id:record.run_id,pending:resolution==='done'?null:session.pending};
   }
   if(!current())return;
   requireConfirmation(record);
   const completed=hadPending&&!session.pending;
   if(session.pending){sessionRef.current=session;setPending(session.pending);}else persist(session);applyRecord(record,session.pending?.action==='save'?session.pending.units:undefined,completed);
   setCreateMayRetry(false);setBlocked(false);setAccessLost(false);setNotice(session.pending?'unknown':'ok');
  }catch(error){
   if(current()){
    if(error instanceof SetupReadError&&(error.status===401||error.status===403))clearDisplay();
    else{invalidateConfirmation();setNotice('blocked');}
   }
  }finally{if(committed.current===commit&&commit.ready&&alive.current&&lifetime.current===generation&&readOwner.current===owner){readOwner.current=null;setChecking(false);}}
 },[contextId,membershipId,workspaceId,storageKey,applyPayload,applyRecord,persist,clearDisplay,invalidateConfirmation,requireConfirmation,scopeVersion,admitCommit]);
 const endLifetime=useCallback(()=>{alive.current=false;lifetime.current++;epoch.current++;readOwner.current=null;operation.current=null;recordRef.current=null;},[]);
 // Only a completed commit grants ownership. Layout cleanup fences old
 // continuations before parent layout/microtasks, not at passive-effect time.
 useLayoutEffect(()=>{
  const commit={ready,version:scopeVersion,context:contextId,membership:membershipId,workspace:workspaceId};
  committed.current=commit;alive.current=true;lifetime.current++;const generation=lifetime.current;
  void Promise.resolve().then(()=>{
   if(committed.current===commit&&alive.current&&lifetime.current===generation){
    setBusy(false);if(ready){if(!readOwner.current)void checkStatus();}else invalidateConfirmation();
   }
  });
  return()=>{if(committed.current===commit){committed.current=null;endLifetime();}};
 },[checkStatus,endLifetime,ready,invalidateConfirmation,scopeVersion,contextId,membershipId,workspaceId]);
 const wireUnits=()=>units.map(u=>({code:u.code,floor:u.floor===""?null:Number(u.floor),area_m2:u.area===""?null:Number(u.area)}));
 const updateUnit=(i:number,key:keyof Unit,value:string)=>setUnits(list=>list.map((u,n)=>n===i?{...u,[key]:value}:u));
 async function refresh(id=runId){await checkStatus(id);}
 async function call(action?:SetupAction) {
  const commit=admitCommit();if(!commit)return;
  if(operation.current||readOwner.current||checking||blocked||accessLost||legacy||!ready||verifiedVersion!==scopeVersion||!sessionRef.current||(retainedKind==='form'&&!!runId)||(retainedKind==='units'&&stage!=='draft'))return;
  if(!contextId){setNotice('context');return;}
  const owner=Symbol('write');operation.current=owner;setConfirmedRecord(null);setBusy(true);setNotice('');
  const generation=lifetime.current,sequence=++epoch.current;
  let originalBytes=window.sessionStorage.getItem(storageKey);
  const current=()=>committed.current===commit&&commit.ready&&alive.current&&lifetime.current===generation&&epoch.current===sequence&&operation.current===owner&&window.sessionStorage.getItem(storageKey)===originalBytes;
  try {
   let session=sessionRef.current,attempt=session.pending;
   if(attempt?.action==='create'){
    const found=await readSetupAttempt(contextId,workspaceId,attempt.command.idempotency_key);
    if(!current())return;
    if(found){await checkStatus();return;}
    if(!createMayRetry){setNotice('unknown');return;}
   }else if(attempt){
    let record=await readSetupRecord(contextId,workspaceId,session.run_id!);
    if(!current())return;
    requireConfirmation(record);
    const recovered=await recoverSetupCommand(attempt,record,membershipId,current);if(!current())return;record=recovered.record;requireConfirmation(record);const result=recovered.resolution;
    if(result==='conflict'){applyRecord(record);setNotice('conflict');return;}
    if(result==='done'){persist({...session,pending:null});applyRecord(record,undefined,true);setNotice('ok');return;}
   }else if(action){
    const before=recordRef.current;
    if(!before||!session.run_id)return;
    const record=await readSetupRecord(contextId,workspaceId,session.run_id);
    if(!current())return;
    requireConfirmation(record);
    if(record.status!==before.status||!sameSetupPayload(record.payload,before.payload)){
     applyRecord(record);if(action==='save')setUnits(units);setNotice('conflict');return;
    }
    const expected={save:'draft',rehearse:'draft',submit:'rehearsed',provision:'approved'}[action];
    if(record.status!==expected){applyRecord(record);setNotice('conflict');return;}
    if(action==='rehearse'&&dirtyUnits){setNotice('save');return;}
    attempt={action,run_id:record.run_id,context_id:contextId,workspace_id:workspaceId,command_key:`setup-${record.run_id}-r${record.revision}-${crypto.randomUUID()}`,before:record,...(action==='save'?{units:wireUnits()}: {})};
   }else{
    if(session.run_id)return;
    if(!Number.isFinite(Number(debit))||!Number.isFinite(Number(credit))||Number(debit)<0||Number(credit)<0||difference!==0)throw Error('invalid_balances');
    const command=createBuildingSetupSchema.parse({context_id:contextId,workspace_id:workspaceId,idempotency_key:`setup-${crypto.randomUUID()}`,payload:{association:{name:association},building:{name:building,code,floors:Number(floors)},currency:'RON',period_start:start,period_end:end,units:wireUnits(),opening_balances:[...(Number(debit)>0?[{account_code:'OPEN-DEBIT',side:'debit',amount:Number(debit)}]:[]),...(Number(credit)>0?[{account_code:'OPEN-CREDIT',side:'credit',amount:Number(credit)}]:[])]}});
    attempt={action:'create',command};
   }
   // Persist BEFORE dispatch; storage failure sends zero writes. Never replace an uncertain attempt.
   if(sessionRef.current?.pending!==attempt)persist({...session,pending:attempt});originalBytes=window.sessionStorage.getItem(storageKey);
   attempt=sessionRef.current!.pending!;
   const path=attempt.action==='create'?'':`/${attempt.run_id}${attempt.action==='save'?'':`/${attempt.action}`}`;
   const body=attempt.action==='create'?attempt.command:{context_id:attempt.context_id,workspace_id:attempt.workspace_id,expected_revision:attempt.before.revision,command_key:attempt.command_key,...(attempt.action==='save'?{units:attempt.units}:{})};
   const response=await fetch(`/api/customer/v1/onboarding/building-setup${path}`,{method:attempt.action==='save'?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20_000)});
   if(!current())return;
   if(response.status===401||response.status===403){clearDisplay();return;}
   const result=await response.json();
   if(!current())return;
   if(!response.ok)throw Error('unknown');
   const receipt=buildingSetupReceiptSchema.parse(result);
   if(receipt.workspace_id!==workspaceId)throw Error('foreign_receipt');
   const id=receipt.run_id;
   if(attempt.action==='create'){if(!receipt.creation_request_hash)throw Error('missing_creation_binding');attempt={...attempt,receipt_hash:receipt.creation_request_hash};}
   if(attempt.action!=='create'&&id!==attempt.run_id)throw Error('mismatch');
   session={...session,run_id:id,pending:attempt};if(attempt.action==='create')persist(session);originalBytes=window.sessionStorage.getItem(storageKey);setRunId(id);
   let record=await readSetupRecord(contextId,workspaceId,id);
   if(!current())return;
   if(attempt.action==='create'){if(reconcileSetupAttempt(attempt,record)!=='done')throw Error('unknown');}
   else{requireConfirmation(record);const recovered=await recoverSetupCommand(attempt,record,membershipId,current);if(!current())return;record=recovered.record;if(recovered.resolution!=='done')throw Error('unknown');}
   requireConfirmation(record);
   persist({...session,pending:null});applyRecord(record,undefined,true);setNotice('ok');
  }catch(error){
   if(current()){if(error instanceof SetupReadError&&(error.status===401||error.status===403))clearDisplay();else if(error instanceof Error&&error.message==='setup_confirmation_invalid'){invalidateConfirmation();setNotice('blocked');}else setNotice(sessionRef.current?.pending?'unknown':error instanceof Error&&(error.name==='ZodError'||error.message==='invalid_balances')?'invalid':'unknown');}
  }finally{if(committed.current===commit&&commit.ready&&alive.current&&lifetime.current===generation&&operation.current===owner){operation.current=null;setBusy(false);}}
 }
 const scopeCurrent=ready&&verifiedVersion===scopeVersion;
 const frozen=busy||checking||blocked||accessLost||legacy||!!pending||!scopeCurrent||(retainedKind==='form'&&!!runId)||(retainedKind==='units'&&stage!=='draft');
 const statusConfirmed=scopeCurrent&&!!confirmedRecord&&!busy&&!checking&&!pending&&!blocked&&!accessLost&&notice!=='unknown'&&notice!=='conflict';
 const message=notice==='ok'?(statusConfirmed?t.ok:''):notice==='save'?t.save:notice==='context'?t.context:notice?r[notice]:'';
 // A current read supplies the displayed receipt. Never turn pending storage,
 // a POST response alone, or a later command's receipt into completion evidence.
 const propertyConfirmed=!!(confirmedRecord&&confirmedRecord.status==='provisioned'&&hasSetupConfirmation(confirmedRecord,workspaceId));
 const progressCondition=busy||checking||contextLoading?'checking':contextError||blocked||legacy||notice==='conflict'||!scopeCurrent?'blocked':pending||notice==='unknown'?'unknown':runId&&!confirmedRecord?'blocked':null;
 const progressRecord=!progressCondition&&confirmedRecord?{status:confirmedRecord.status,revision:confirmedRecord.revision,reference:confirmedRecord.run_id,building:confirmedRecord.payload.building.name,units:(confirmedRecord.effective_units??confirmedRecord.payload.units).length}:null;
 if(accessLost)return <section dir={lang==='fa'?'rtl':'ltr'}><h1>{t.title}</h1><p role="status">{r.denied}</p><button type="button" disabled={checking} onClick={()=>{void checkStatus();}}>{r.check}</button></section>;
 if(!scopeCurrent||blocked||legacy)return <section dir={lang==='fa'?'rtl':'ltr'} className="min-w-0 space-y-3"><h1>{t.title}</h1><CustomerBuildingSetupProgress lang={lang} saved={null} dirty={dirtyUnits||dirtyForm||!!retainedKind} condition={!ready||checking?'checking':'blocked'} canContinue={false}/>{legacy&&<p role="alert">{lang==='fa'?'این اطلاعات قدیمی باید توسط فرد مجاز بررسی شود.':lang==='ro'?'Aceste date mai vechi trebuie verificate de o persoană autorizată.':'These older details need review by an authorized person.'}</p>}{ready&&!checking&&<p role="alert">{r.blocked}</p>}<div>{t.actions.filter((_,index)=>index!==3).map(label=><button type="button" key={label} disabled>{label}</button>)}</div><button type="button" disabled={!ready||checking} onClick={()=>{void checkStatus();}}>{r.check}</button></section>;
 const actionDefs:[Stage,SetupAction|undefined][]=[["edit",undefined],["draft","rehearse"],["rehearsed","submit"]];
 return <section dir={lang==="fa"?"rtl":"ltr"} className="mx-auto max-w-5xl space-y-6 rounded-2xl border bg-white p-6 shadow-sm"><header><h1 className="mt-2 text-2xl font-bold">{t.title}</h1><p className="mt-2 text-slate-600">{t.body}</p></header><p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">{t.notice}</p>
 <CustomerBuildingSetupProgress lang={lang} saved={progressRecord} dirty={dirtyUnits||dirtyForm||!!retainedKind} condition={progressCondition} canContinue={propertyConfirmed&&!frozen&&!progressCondition}/>
 <CustomerOnboardingTemplates lang={lang}/>
 <fieldset disabled={frozen||stage!=="edit"} className="grid gap-4 md:grid-cols-2">{[[t.association,association,setAssociation],[t.building,building,setBuilding],[t.code,code,setCode],[t.floors,floors,setFloors]].map(([label,value,setter])=><label key={label as string} className="grid gap-1 text-sm">{label as string}<input className={field} type={label===t.floors?"number":"text"} value={value as string} onChange={e=>(setter as (v:string)=>void)(e.target.value)}/></label>)}</fieldset>
 <fieldset disabled={frozen||stage!=="edit"} className="grid gap-4 rounded-xl border p-4 md:grid-cols-2"><legend className="px-2 font-semibold">{t.period}</legend><input aria-label="period start" className={field} type="date" value={start} onChange={e=>setStart(e.target.value)}/><input aria-label="period end" className={field} type="date" value={end} onChange={e=>setEnd(e.target.value)}/></fieldset>
 <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">{t.units}{savedUnits?` · ${t.saved}: ${savedUnits.length}`:""}</h2><button type="button" disabled={frozen||(stage!=="edit"&&stage!=="draft")} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={()=>setUnits(u=>[...u,{code:`A-${String(u.length+1).padStart(2,"0")}`,floor:"",area:""}])}>{t.add}</button></div>{units.map((unit,i)=><div key={i} className="grid gap-2 sm:grid-cols-4"><input aria-label={`${t.code} ${i+1}`} disabled={frozen||(stage!=="edit"&&stage!=="draft")} className={field} value={unit.code} onChange={e=>updateUnit(i,"code",e.target.value)}/><input aria-label={`${t.floors} ${i+1}`} disabled={frozen||(stage!=="edit"&&stage!=="draft")} className={field} type="number" value={unit.floor} onChange={e=>updateUnit(i,"floor",e.target.value)}/><input aria-label={`${t.area} ${i+1}`} disabled={frozen||(stage!=="edit"&&stage!=="draft")} className={field} type="number" min="0" step="0.01" value={unit.area} onChange={e=>updateUnit(i,"area",e.target.value)}/><button type="button" disabled={frozen||units.length===1||(stage!=="edit"&&stage!=="draft")} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" onClick={()=>setUnits(u=>u.filter((_,n)=>n!==i))}>{t.remove}</button></div>)}</div>
 <fieldset disabled={frozen||stage!=="edit"} className="grid gap-4 rounded-xl border p-4 md:grid-cols-2"><legend className="px-2 font-semibold">{t.preview}</legend><label className="grid gap-1 text-sm">{t.debit}<input className={field} type="number" min="0" step="0.01" value={debit} onChange={e=>setDebit(e.target.value)}/></label><label className="grid gap-1 text-sm">{t.credit}<input className={field} type="number" min="0" step="0.01" value={credit} onChange={e=>setCredit(e.target.value)}/></label><p className={`md:col-span-2 rounded-lg p-3 text-sm font-semibold ${difference===0?"bg-teal-50 text-teal-800":"bg-red-50 text-red-700"}`}>{t.difference}: {difference.toFixed(2)} RON · {units.length} {t.units}</p></fieldset>
 {dirtyUnits&&<p className="text-sm font-semibold text-amber-800">{t.save}</p>}<div className="flex flex-wrap gap-2">{actionDefs.map(([required,action],i)=><button key={required} disabled={frozen||!active||stage!==required||(required==="edit"&&(!Number.isFinite(difference)||difference!==0))||(required==="draft"&&dirtyUnits)} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>call(action)}>{t.actions[i]}</button>)}{stage==="draft"&&<button disabled={frozen||!dirtyUnits} className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 disabled:opacity-40" onClick={()=>call("save")}>{t.save}</button>}<button disabled={frozen||!runId||stage!=="approved"} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>call("provision")}>{t.actions[4]}</button></div>{stage==="submitted"&&<div className="space-y-2 rounded-lg border p-3"><p>{r.waiting}</p><Link className="inline-block rounded border px-3 py-2 underline" href={`/${lang}/pilot-reviewer`}>{r.reviewer}</Link></div>}
 {pending&&<div role="alert" className="break-words rounded-lg border border-amber-300 p-3"><p>{r.unknown}</p>{pending.action==='create'&&<code className="block break-all text-xs">{pending.command.idempotency_key}</code>}{<button type="button" disabled={busy||checking||blocked||(pending.action==='create'&&!createMayRetry)} className="mt-2 rounded-lg border p-2" onClick={()=>call()}>{r.retry}</button>}</div>}
 <button type="button" disabled={checking||(dirtyUnits&&!pending)} className="rounded-lg border p-2" onClick={()=>{void checkStatus();}}>{r.check}</button>
 {runId&&<button type="button" disabled={busy||checking||(dirtyUnits&&!pending)} className="rounded-lg border p-2" onClick={()=>refresh()}>{r.refresh}</button>}
 {!runId&&!pending&&<form className="flex flex-wrap items-end gap-2" onSubmit={event=>{event.preventDefault();void refresh(resumeId);}}><label className="grid min-w-0 flex-1 gap-1">{r.resume}<input className={field} value={resumeId} onChange={event=>setResumeId(event.target.value)} disabled={busy||checking}/></label><button className="rounded-lg border p-2" disabled={busy||checking||!buildingSetupIdSchema.safeParse(resumeId).success}>{r.load}</button></form>}
 {legacy&&<p role="alert">{lang==='fa'?'تأیید این نسخهٔ قدیمی قابل بررسی نیست. از فرد مجاز بخواهید آن را بررسی کند.':lang==='ro'?'Aprobarea versiunii acestor date mai vechi nu poate fi verificată. Cere verificarea unei persoane autorizate.':'Approval of this older version cannot be verified. Ask an authorized person to review it.'}</p>}
 {checking&&<p role="status">{r.loading}</p>}
 <p aria-live="polite" className="break-words text-sm text-slate-700">{statusConfirmed?`${stage.toUpperCase()} · ${runId}`:stage==='edit'&&!runId?'EDIT':''}{message?` · ${message}`:""}</p></section>}
