'use client';
import {useEffect,useLayoutEffect,useState,useRef} from 'react';
import type {Language} from '@/types';
import {useOperationsCommands} from './OperationsCommandGate';
import {operationsIntentSchema,intentFromWire} from '@/lib/customer/operations-command';
import {localizedMaintenanceText, maintenanceTemplateFor, suggestedMaintenancePlans} from '@/lib/customer/maintenance-defaults';
type Plan={id:string;revision:number;name:string;asset_id:string;asset_name:string;vendor_id:string;vendor_name:string;calendar_anchor:string;calendar_unit:string;calendar_every:number;calendar_enabled:boolean;next_due_on:string;checklist_template:string[];history:{due_on:string;work_order_id:string;work_order_no:number;status:string}[]};
type Data={plans:Plan[];assets:{id:string;name:string;asset_code:string;category_code:string}[];vendors:{id:string;name:string}[]};
const statusLabels:Record<Language,Record<string,string>>={en:{draft:'Draft',scheduled:'Scheduled',assigned:'Assigned',in_progress:'In progress',blocked:'Blocked',completed:'Completed',verified:'Verified',cancelled:'Cancelled'},ro:{draft:'Proiect',scheduled:'Programat',assigned:'Alocat',in_progress:'În lucru',blocked:'Blocat',completed:'Finalizat',verified:'Verificat',cancelled:'Anulat'},fa:{draft:'پیش‌نویس',scheduled:'زمان‌بندی‌شده',assigned:'واگذارشده',in_progress:'در حال اجرا',blocked:'متوقف',completed:'انجام‌شده',verified:'تأییدشده',cancelled:'لغوشده'}};
const copy={
 en:{title:'Recurring preventive maintenance',note:'Select equipment to see programs for its category. Newly registered equipment appears after refresh. Set a contractor and calendar before saving; issuing due drafts is manual.',preset:'Suggested program',custom:'Custom program',presetNote:'Suggestions depend on the equipment category; use a custom plan if none match. Intervals are editable and are not statutory inspection frequencies.',name:'Plan name',asset:'Equipment',vendor:'Approved contractor',anchor:'First due date',unit:'Period',every:'Every',days:'Days',weeks:'Weeks',months:'Months',years:'Years',checklist:'Required checklist (one item per line)',enabled:'Enabled',save:'Save plan',edit:'Edit',cancel:'Cancel edit',generate:'Issue due draft',history:'Issued occurrences',due:'Next due',empty:'No recurring plans visible.',loading:'Loading plans…',error:'Could not complete the operation. Check permissions, module activation and MFA, then refresh.',conflict:'This plan changed. Refresh before editing again.',refresh:'Refresh',noAssets:'To configure a plan, activate maintenance and use a role allowed to manage work orders for an active asset.',limits:'Displays up to 200 plans and 500 equipment / contractor choices. Calendar and equipment are fixed after creation; disable the old plan and create another to change them.',success:'Saved.',disabled:'Disabled; history retained'},
 ro:{title:'Mentenanță preventivă periodică',note:'Selectează echipamentul pentru programele recomandate categoriei sale. Echipamentele noi apar după reîncărcare. Alege furnizorul și calendarul înainte de salvare; emiterea proiectelor scadente este manuală.',preset:'Program recomandat',custom:'Program personalizat',presetNote:'Recomandările depind de categoria echipamentului; folosește un program personalizat dacă nu există. Intervalele nu reprezintă obligații legale.',name:'Numele planului',asset:'Echipament',vendor:'Furnizor aprobat',anchor:'Prima scadență',unit:'Perioadă',every:'La fiecare',days:'Zile',weeks:'Săptămâni',months:'Luni',years:'Ani',checklist:'Listă obligatorie (un element pe rând)',enabled:'Activ',save:'Salvează planul',edit:'Editează',cancel:'Anulează editarea',generate:'Emite proiectul scadent',history:'Scadențe emise',due:'Următoarea scadență',empty:'Nu există planuri periodice vizibile.',loading:'Se încarcă planurile…',error:'Operația nu a reușit. Verifică permisiunile, activarea modulului și MFA, apoi reîncarcă.',conflict:'Planul s-a modificat. Reîncarcă înainte de editare.',refresh:'Reîncarcă',noAssets:'Activează mentenanța și folosește un rol cu drept de administrare a ordinelor pentru un activ disponibil.',limits:'Sunt afișate maximum 200 de planuri și 500 de echipamente / furnizori. Calendarul și echipamentul sunt fixe după creare; dezactivează planul vechi și creează altul pentru a le modifica.',success:'Salvat.',disabled:'Dezactivat; istoricul este păstrat'},
 fa:{title:'برنامهٔ ثابت تعمیر و نگهداری',note:'تجهیز را انتخاب کنید تا برنامه‌های مربوط به دستهٔ آن پیشنهاد شود. تجهیز تازه‌ثبت‌شده پس از بازخوانی ظاهر می‌شود. پیش از ذخیره، پیمانکار و دوره را مشخص کنید؛ صدور پیش‌نویس سررسید دستی است.',preset:'برنامهٔ پیشنهادی',custom:'برنامهٔ سفارشی',presetNote:'پیشنهادها بر پایهٔ دستهٔ تجهیز هستند؛ اگر پیشنهادی نبود برنامهٔ سفارشی بسازید. دوره‌ها قابل تغییرند و الزام قانونی محسوب نمی‌شوند.',name:'نام برنامه',asset:'تجهیز',vendor:'پیمانکار تأییدشده',anchor:'اولین سررسید',unit:'دوره',every:'هر',days:'روز',weeks:'هفته',months:'ماه',years:'سال',checklist:'چک‌لیست الزامی؛ هر مورد در یک خط',enabled:'فعال',save:'ذخیره برنامه',edit:'ویرایش',cancel:'انصراف از ویرایش',generate:'صدور پیش‌نویس سررسید',history:'نوبت‌های صادرشده',due:'سررسید بعدی',empty:'برنامهٔ دوره‌ای قابل مشاهده‌ای وجود ندارد.',loading:'در حال دریافت برنامه‌ها…',error:'عملیات انجام نشد. مجوز نقش، فعال‌سازی ماژول و تأیید دومرحله‌ای را بررسی و صفحه را بازخوانی کنید.',conflict:'برنامه تغییر کرده است؛ پیش از ویرایش دوباره بازخوانی کنید.',refresh:'بازخوانی',noAssets:'برای تعریف برنامه، ماژول نگهداری را فعال کنید و از نقش دارای مجوز مدیریت دستورکار برای تجهیز فعال استفاده کنید.',limits:'حداکثر ۲۰۰ برنامه و ۵۰۰ تجهیز یا پیمانکار نمایش داده می‌شود. تجهیز و دوره پس از ثبت ثابت می‌مانند؛ برای تغییر آن‌ها برنامه قبلی را غیرفعال و برنامه جدید ایجاد کنید.',success:'ذخیره شد.',disabled:'غیرفعال؛ سوابق محفوظ است'},
};
// One in-memory attempt survives Context remounts, never a queue or durable ledger.
// Closing/reloading loses this evidence. The server remains the authority.
type Save = Readonly<{action:'save';context_id:string;id:string;revision:number;name:string;asset_id:string;vendor_id:string;anchor:string;unit:string;every:number;enabled:boolean;checklist:readonly string[]}>;
type Generate = Readonly<{action:'generate';context_id:string;plan_id:string;due_on:string}>;
type Receipt = {id:string;revision?:number;replayed?:boolean;work_order_no?:number};
type Attempt = {body:Save|Generate;wire:string;receipt:Receipt|null;inFlight:boolean;rejected:boolean;failure:'unknown'|'denied'|'conflict'|'rejected'};
type AttemptBox = {get:()=>Attempt|null;set:(attempt:Attempt|null)=>void};
function createAttemptBox():AttemptBox {
 let pending:Attempt|null=null;
 return Object.freeze({get:()=>pending,set:(attempt:Attempt|null)=>{pending=attempt}});
}
const recovery = {
 en:{input:'Check the scoped equipment/contractor, name, dates, period and checklist (up to 50 items, 200 characters each).',pending:'Checking the submitted command…',unknown:'Outcome unknown. No new command was sent. A missing record in this limited list does not prove failure.',denied:'Access denied. Previous private results are hidden. Restore current access and check again.',conflict:'Revision or result conflict. Review the current record before another command.',rejected:'The request was rejected. Review current data before editing again.',check:'Check current result',retry:'Retry this exact occurrence',observed:'Matching current state observed; this is not a receipt proving this request committed.',accept:'Continue with observed record',discard:'Review rejected request',confirmed:'Reply validated and current result observed.',foreign:'A command in another Context still needs checking. Return to that Context before submitting.',memory:'Unsaved form edits stay only in this open panel. After reload, the shared command gate checks the saved command against the server receipt before another command. A current plan alone is not that receipt.',invalid:'The response could not be validated. Previous results are hidden; check again.',order:'Work Order',draft:'Draft only; no dispatch, completion or verification is implied.'},
 ro:{input:'Verifică echipamentul/furnizorul disponibil, numele, datele, perioada și lista (maximum 50 de elemente, 200 de caractere fiecare).',pending:'Se verifică cererea trimisă…',unknown:'Rezultat necunoscut. Nu s-a trimis o comandă nouă. Absența din lista limitată nu dovedește eșecul.',denied:'Acces refuzat. Rezultatele private anterioare sunt ascunse. Restabilește accesul și verifică din nou.',conflict:'Conflict de revizie sau rezultat. Verifică înregistrarea actuală înaintea altei comenzi.',rejected:'Cererea a fost respinsă. Verifică datele actuale înainte de editare.',check:'Verifică rezultatul actual',retry:'Reîncearcă exact această scadență',observed:'Starea actuală corespunde; nu este o dovadă că această cerere a fost înregistrată.',accept:'Continuă cu înregistrarea observată',discard:'Verifică cererea respinsă',confirmed:'Răspuns validat și rezultat actual observat.',foreign:'O comandă din alt Context necesită verificare. Revino în acel Context înainte de trimitere.',memory:'Modificările nesalvate rămân doar în acest panou. După reîncărcare, controlul comun verifică comanda salvată față de recipisa serverului înaintea altei comenzi. Planul curent singur nu este acea recipisă.',invalid:'Răspunsul nu a putut fi validat. Rezultatele anterioare sunt ascunse; verifică din nou.',order:'Ordin de lucru',draft:'Doar proiect; nu implică alocare, finalizare sau verificare.'},
 fa:{input:'تجهیز و پیمانکار مجاز، نام، تاریخ، دوره و چک‌لیست را بررسی کنید؛ حداکثر ۵۰ مورد و هر مورد ۲۰۰ نویسه.',pending:'در حال بررسی فرمان ارسال‌شده…',unknown:'نتیجه نامعلوم است. فرمان تازه‌ای ارسال نشد. نبودن رکورد در این فهرست محدود، شکست را ثابت نمی‌کند.',denied:'دسترسی رد شد. نتایج خصوصی قبلی پنهان شده‌اند. پس از بازیابی دسترسی دوباره بررسی کنید.',conflict:'نسخه یا نتیجه تعارض دارد. پیش از فرمان دیگر، رکورد جاری را بررسی کنید.',rejected:'درخواست رد شد. پیش از ویرایش دوباره دادهٔ جاری را بررسی کنید.',check:'بررسی نتیجهٔ جاری',retry:'تلاش دوباره برای همین نوبت دقیق',observed:'وضعیت جاریِ منطبق مشاهده شد؛ این رسیدِ اثبات ثبت همین درخواست نیست.',accept:'ادامه با رکورد مشاهده‌شده',discard:'بررسی درخواست ردشده',confirmed:'پاسخ معتبر و نتیجهٔ جاری مشاهده شد.',foreign:'یک فرمان در زمینهٔ دیگری نیازمند بررسی است. پیش از ارسال به همان زمینه بازگردید.',memory:'ویرایش‌های ذخیره‌نشده فقط در این پنل می‌مانند. پس از بازخوانی، کنترل مشترک پیش از فرمان دیگر، فرمان ذخیره‌شده را با رسید سرور بررسی می‌کند. برنامهٔ فعلی به‌تنهایی آن رسید نیست.',invalid:'پاسخ قابل اعتبارسنجی نبود. نتایج قبلی پنهان‌اند؛ دوباره بررسی کنید.',order:'دستورکار',draft:'فقط پیش‌نویس است؛ به معنی اعزام، انجام یا تأیید نیست.'},
};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&!v.includes('\0');
const integer=(v:unknown,min:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const unique=(ids:string[])=>new Set(ids).size===ids.length;
function readData(value:unknown):Data {
 if(!record(value)||!Array.isArray(value.plans)||value.plans.length>200||!Array.isArray(value.assets)||value.assets.length>500||!Array.isArray(value.vendors)||value.vendors.length>500)throw Error('invalid_readback');
 const plans=value.plans,assets=value.assets,vendors=value.vendors;
 if(!plans.every(p=>record(p)&&uuid(p.id)&&integer(p.revision,1)&&text(p.name)&&uuid(p.asset_id)&&text(p.asset_name)&&uuid(p.vendor_id)&&text(p.vendor_name)&&date(p.calendar_anchor)&&typeof p.calendar_unit==='string'&&['days','weeks','months','years'].includes(p.calendar_unit)&&integer(p.calendar_every,1)&&p.calendar_every<=120&&typeof p.calendar_enabled==='boolean'&&date(p.next_due_on)&&Array.isArray(p.checklist_template)&&p.checklist_template.every(text)&&Array.isArray(p.history)&&p.history.every(h=>record(h)&&date(h.due_on)&&uuid(h.work_order_id)&&integer(h.work_order_no,1)&&typeof h.status==='string'&&Object.hasOwn(statusLabels.en,h.status))&&unique(p.history.map(h=>h.due_on))))throw Error('invalid_plan');
 if(!assets.every(a=>record(a)&&uuid(a.id)&&text(a.name)&&text(a.asset_code)&&text(a.category_code))||!vendors.every(v=>record(v)&&uuid(v.id)&&text(v.name)))throw Error('invalid_choices');
 if(!unique(plans.map(p=>p.id))||!unique(assets.map(a=>a.id))||!unique(vendors.map(v=>v.id))||!unique(plans.flatMap(p=>p.history.map((h:Plan['history'][number])=>h.work_order_id))))throw Error('duplicate_identity');
 return value as Data;
}
function readReceipt(value:unknown,body:Save|Generate):Receipt {
 if(!record(value)||!uuid(value.id))throw Error('invalid_receipt');
 if(body.action==='save'){
  if(Object.keys(value).sort().join(',')!=='id,revision'||value.id!==body.id||value.revision!==body.revision+1)throw Error('invalid_save_receipt');
  return {id:value.id,revision:body.revision+1};
 }
 // Fresh generation returns create_work_order's fields; replay returns id/replayed.
 const keys=Object.keys(value).sort().join(',');
 if(value.replayed===false){
  if(keys!=='id,replayed,status,work_order_no'||!integer(value.work_order_no,1)||value.status!=='draft')throw Error('invalid_generation_receipt');
  return {id:value.id,replayed:false,work_order_no:value.work_order_no};
 }
 if(value.replayed!==true||keys!=='id,replayed')throw Error('invalid_generation_receipt');
 return {id:value.id,replayed:true};
}
function matching(data:Data,attempt:Attempt):boolean {
 const b=attempt.body;
 if(b.action==='save'){
  const p=data.plans.find(p=>p.id===b.id);
  return !!p&&p.revision===b.revision+1&&p.asset_id===b.asset_id&&p.vendor_id===b.vendor_id&&p.name===b.name&&p.calendar_anchor===b.anchor&&p.calendar_unit===b.unit&&p.calendar_every===b.every&&p.calendar_enabled===b.enabled&&JSON.stringify(p.checklist_template)===JSON.stringify(b.checklist);
 }
 const h=data.plans.find(p=>p.id===b.plan_id)?.history.find(h=>h.due_on===b.due_on);
 return !!h&&(!attempt.receipt||(h.work_order_id===attempt.receipt.id&&(attempt.receipt.work_order_no===undefined||h.work_order_no===attempt.receipt.work_order_no)));
}
// Same request constraints as the pinned route; no new business/permission oracle.
function validCommand(b:Save|Generate,data:Data,today:string):boolean {
 if(!uuid(b.context_id))return false;
 if(b.action==='generate')return uuid(b.plan_id)&&date(b.due_on)&&data.plans.some(p=>p.id===b.plan_id&&p.calendar_enabled&&p.next_due_on===b.due_on&&b.due_on<=today);
 if(!uuid(b.id)||!integer(b.revision,0)||!text(b.name)||b.name.trim().length<1||b.name.length>200||!data.assets.some(a=>a.id===b.asset_id)||!data.vendors.some(v=>v.id===b.vendor_id)||!date(b.anchor)||!['days','weeks','months','years'].includes(b.unit)||!integer(b.every,1)||b.every>120||b.checklist.length>50||!b.checklist.every(s=>text(s)&&s.trim().length>0&&s.length<=200))return false;
 const template=maintenanceTemplateFor(b.name);
 return template?JSON.stringify(b.checklist)===JSON.stringify(template.steps.map(s=>s.code)):!b.name.startsWith('CLADORA_PM_')&&!b.checklist.some(s=>s.startsWith('CLADORA_PM_'));
}
export function PreventiveMaintenancePanel({lang,contextId,ready=true,scopeKey='',onOpenWorkOrder}:{lang:Language;contextId:string;ready?:boolean;scopeKey?:string;onOpenWorkOrder?:(id:string)=>void}){
 const [box]=useState<AttemptBox>(createAttemptBox);
 return <Plans key={`${contextId}:${scopeKey}`} lang={lang} contextId={contextId} box={box} ready={ready} onOpenWorkOrder={onOpenWorkOrder}/>;
}
function Plans({lang,contextId,box,ready,onOpenWorkOrder}:{lang:Language;contextId:string;box:AttemptBox;ready:boolean;onOpenWorkOrder?:((id:string)=>void)}){
 const operations=useOperationsCommands();
 const live=useRef(false),readOwner=useRef(0),readAbort=useRef<AbortController|null>(null),dispatchLock=useRef(false),reading=useRef(true),draftId=useRef<string|null>(null);
 const t=copy[lang],r=recovery[lang];
 const[data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[editing,setEditing]=useState<Plan|null>(null),[selectedCode,setSelectedCode]=useState(''),[selectedAsset,setSelectedAsset]=useState(''),[pending,setPending]=useState<Attempt|null>(()=>box.get()),[observed,setObserved]=useState(false),[resultPlan,setResultPlan]=useState<string|null>(null),[formEpoch,setFormEpoch]=useState(0);
 const template=maintenanceTemplateFor(selectedCode);
 const suggestions=suggestedMaintenancePlans(data?.assets.find(a=>a.id===(editing?.asset_id??selectedAsset))?.category_code??'');
 const displayedSuggestions=template&&editing&&!suggestions.includes(template)?[...suggestions,template]:suggestions;
 const admitted=ready&&operations.ready;
 const foreign=!!pending&&pending.body.context_id!==contextId;
 const locked=busy||!!pending;
 useLayoutEffect(()=>{live.current=admitted;const counter=readOwner;const request=readAbort;return()=>{live.current=false;counter.current++;request.current?.abort()}},[admitted]);
 function clearEditor(){draftId.current=null;setEditing(null);setSelectedCode('');setSelectedAsset('');setFormEpoch(n=>n+1)}
 async function load(){
  if(!live.current)return;
  reading.current=true;
  const owner=++readOwner.current;
  readAbort.current?.abort();const abort=new AbortController();readAbort.current=abort;
  const active=()=>live.current&&owner===readOwner.current&&!abort.signal.aborted;
  setBusy(true);setData(null);setObserved(false);setResultPlan(null);setMessage('');
  try{
   const response=await fetch(`/api/customer/v1/maintenance-plans?context_id=${encodeURIComponent(contextId)}`,{cache:'no-store',signal:abort.signal});
   if(!active())return;
   if(!response.ok){setMessage(response.status===401||response.status===403?r.denied:r.invalid);return}
   const raw:unknown=await response.json();if(!active())return;
   const next=readData(raw),attempt=box.get();
   setData(next);setPending(attempt);
   if(attempt){
    if(attempt.body.context_id!==contextId){setMessage(r.foreign);return}
    // A read racing an outstanding POST is never its final reconciliation.
    if(attempt.inFlight){setMessage(r.pending);return}
    const match=matching(next,attempt);
    if(match&&!attempt.rejected)setResultPlan(attempt.body.action==='save'?attempt.body.id:attempt.body.plan_id);
    if(attempt.receipt&&match&&!attempt.rejected){box.set(null);setPending(null);clearEditor();setMessage(r.confirmed)}
    else{
     // Bounded absence is UNKNOWN; an observed incompatible record is conflict.
     const b=attempt.body;
     const incompatible=b.action==='save'?next.plans.some(p=>p.id===b.id):!!next.plans.find(p=>p.id===b.plan_id)?.history.some(h=>h.due_on===b.due_on&&!!attempt.receipt&&(h.work_order_id!==attempt.receipt.id||(attempt.receipt.work_order_no!==undefined&&h.work_order_no!==attempt.receipt.work_order_no)));
     setObserved(match&&!attempt.rejected);
     setMessage(attempt.rejected?r[attempt.failure]:match?r.observed:incompatible?r.conflict:r[attempt.failure]);
    }
   }
  }catch{if(active())setMessage(r.invalid)}finally{if(active()){reading.current=false;setBusy(false)}}
 }
 // The keyed child owns all state/async admissions for one committed Context.
 // Copy changes do not dispatch or reopen a submitted command.
 useEffect(()=>{let cancelled=false;queueMicrotask(()=>{if(!cancelled)void load()});return()=>{cancelled=true;readOwner.current++;readAbort.current?.abort()}},[contextId,admitted]); // eslint-disable-line react-hooks/exhaustive-deps
 async function dispatch(attempt:Attempt){
  if(!live.current||reading.current||dispatchLock.current||attempt.inFlight||attempt.body.context_id!==contextId||box.get()!==attempt)return;
  const running:Attempt={...attempt,inFlight:true,receipt:null,rejected:false,failure:'unknown'};
  let result:Attempt={...running,inFlight:false};
  box.set(running);dispatchLock.current=true;
  // Invalidate every older GET before the very first POST/await.
  readOwner.current++;readAbort.current?.abort();setBusy(true);setData(null);setObserved(false);setPending(running);setMessage(r.pending);
  let mayRead=false;
  try{
   const input=JSON.parse(running.wire);
   const payload=await operations.send(operationsIntentSchema.parse({version:1,context_id:contextId,action:input.action,target_id:input.action==='save'?input.id:input.plan_id,expected_status:null,input}));
   if(!live.current||box.get()!==running)return;
   result={...result,receipt:readReceipt(payload,running.body)};mayRead=true;
  }catch(error){const rejected=!!error&&typeof error==='object'&&'canonicalRejection'in error&&error.canonicalRejection===true;result={...result,rejected,failure:rejected?'rejected':'unknown'};mayRead=true}finally{
   dispatchLock.current=false;
   if(box.get()===running){
    box.set(result);
    if(live.current){setPending(result);setMessage(r[result.failure]);setBusy(false);if(mayRead)void load()}
   }
  }
 }
 function submit(body:Save|Generate){
  if(!live.current||reading.current||dispatchLock.current||box.get()||busy||!data)return;
  // Deep snapshot: no FormData, live plan, checkbox, locale or array is retained.
  if(!validCommand(body,data,today)){setMessage(r.input);return}
  const wire=JSON.stringify(body);
  if(new TextEncoder().encode(wire).byteLength>20*1024){setMessage(r.input);return}
  try{intentFromWire(JSON.stringify({version:1,context_id:contextId,action:body.action,target_id:body.action==='save'?body.id:body.plan_id,expected_status:null,input:body}));}
  catch{setMessage(r.input);return;}
  const snapshot=JSON.parse(wire) as Save|Generate;
  if(snapshot.action==='save')Object.freeze(snapshot.checklist);
  Object.freeze(snapshot);
  const attempt:Attempt={body:snapshot,wire,receipt:null,inFlight:false,rejected:false,failure:'unknown'};
  box.set(attempt);void dispatch(attempt);
 }
 function resume(){
  const attempt=box.get();
  if(!live.current||reading.current||busy||!data||!attempt||attempt.inFlight||attempt.body.context_id!==contextId||(!attempt.receipt&&!attempt.rejected))return;
  // Explicit acknowledgement is not a POST, receipt or new UUID.
  const id=attempt.body.action==='save'?attempt.body.id:attempt.body.plan_id;
  const current=data.plans.find(p=>p.id===id);
  box.set(null);setPending(null);setObserved(false);clearEditor();setMessage('');
  if(current){setEditing(current);setSelectedAsset(current.asset_id);setSelectedCode(maintenanceTemplateFor(current.name)?.code??'')}
 }
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!ready)return <section role="status">{t.loading}</section>;
 if(!admitted)return <section dir={lang==='fa'?'rtl':'ltr'} className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">{t.title}</h2><p role="status">{lang==='fa'?'دسترسی زمینه و نتیجهٔ فرمان ذخیره‌شده باید بررسی شوند؛ اطلاعات قبلی برنامه نمایش داده نمی‌شود.':lang==='ro'?'Accesul contextului și rezultatul comenzii salvate trebuie verificate; datele anterioare ale planului sunt ascunse.':'Context access and the saved command result need checking; previous plan details are hidden.'}</p></section>;
 return <section className="space-y-4 rounded-2xl border bg-white p-5" dir={lang==='fa'?'rtl':'ltr'}><h2 className="text-xl font-bold">{t.title}</h2><p>{t.note}</p><p className="text-xs text-slate-500">{t.limits}</p><p className="text-xs text-slate-500">{r.memory}</p><button type="button" disabled={busy} onClick={()=>{clearEditor();void load()}} className="rounded border px-3 py-2">{pending?r.check:t.refresh}</button>{message&&<p role="status">{message}</p>}
 {pending&&!foreign&&<div className="space-x-2">{data&&!busy&&(!!pending.receipt||pending.rejected)&&<button type="button" onClick={resume}>{observed?r.accept:r.discard}</button>}</div>}
 {!data?<p>{busy?t.loading:null}</p>:<>
 {data.assets.length>0?<form key={editing?.id??`new-${formEpoch}-${selectedAsset}-${selectedCode}`} onSubmit={e=>{e.preventDefault();if(locked||box.get()||dispatchLock.current)return;const f=new FormData(e.currentTarget);submit({action:'save',context_id:contextId,id:editing?.id??(draftId.current??=crypto.randomUUID()),revision:editing?.revision??0,name:template?.code??String(f.get('name')??'').trim(),asset_id:editing?.asset_id??selectedAsset,vendor_id:String(f.get('vendor')??''),anchor:editing?.calendar_anchor??String(f.get('anchor')??''),unit:editing?.calendar_unit??String(f.get('unit')??''),every:editing?.calendar_every??Number(f.get('every')),enabled:f.get('enabled')==='on',checklist:template?template.steps.map(step=>step.code):String(f.get('checklist')??'').split('\n').map(s=>s.trim()).filter(Boolean)})}} className="grid gap-3 md:grid-cols-2"><fieldset disabled={locked} className="contents">
 <label>{t.preset}<select value={selectedCode} disabled={!!editing||!selectedAsset} onChange={e=>setSelectedCode(e.target.value)} className="block w-full rounded border p-2"><option value="">{t.custom}</option>{displayedSuggestions.map(p=><option key={p.code} value={p.code}>{p.title[lang]}</option>)}</select><span className="block text-xs text-slate-500">{t.presetNote}</span></label>
 <label>{t.name}{template?<input required readOnly value={template.title[lang]} className="block w-full rounded border bg-slate-50 p-2"/>:<input name="name" required maxLength={200} defaultValue={editing?.name} className="block w-full rounded border p-2"/>}</label>
 <label>{t.asset}<select required disabled={!!editing} value={editing?.asset_id??selectedAsset} onChange={e=>{setSelectedAsset(e.target.value);const matches=suggestedMaintenancePlans(data.assets.find(a=>a.id===e.target.value)?.category_code??'');setSelectedCode(matches.length===1?matches[0].code:'')}} className="block w-full rounded border p-2"><option value="">—</option>{data.assets.map(a=><option key={a.id} value={a.id}>{a.name} · {a.asset_code}</option>)}</select></label>
 <label>{t.vendor}<select name="vendor" required defaultValue={editing?.vendor_id??''} className="block w-full rounded border p-2"><option value="">—</option>{data.vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
 <label>{t.anchor}<input name="anchor" type="date" required disabled={!!editing} defaultValue={editing?.calendar_anchor} className="block w-full rounded border p-2"/></label>
 <label>{t.every}<input name="every" type="number" required min={1} max={120} disabled={!!editing} defaultValue={editing?.calendar_every??template?.suggestedEvery??1} className="block w-full rounded border p-2"/></label>
 <label>{t.unit}<select name="unit" disabled={!!editing} defaultValue={editing?.calendar_unit??template?.suggestedUnit??'months'} className="block w-full rounded border p-2">{(['days','weeks','months','years'] as const).map(u=><option key={u} value={u}>{t[u]}</option>)}</select></label>
 <label className="md:col-span-2">{t.checklist}<textarea name="checklist" readOnly={!!template} value={template?template.steps.map(s=>s.label[lang]).join('\n'):undefined} defaultValue={template?undefined:editing?.checklist_template.join('\n')} className="block w-full rounded border bg-white p-2 read-only:bg-slate-50"/></label>
 <label><input name="enabled" type="checkbox" defaultChecked={editing?.calendar_enabled??true}/> {t.enabled}</label><div><button disabled={locked} className="rounded bg-teal-700 px-4 py-2 text-white">{t.save}</button>{editing&&<button type="button" disabled={locked} onClick={()=>{if(!locked)clearEditor()}} className="ms-3 rounded border px-3 py-2">{t.cancel}</button>}</div></fieldset></form>:<p>{t.noAssets}</p>}
 {!data.plans.length&&<p>{t.empty}</p>}{data.plans.map(p=><article key={p.id} className="space-y-2 rounded border p-3"><h3 className="font-bold">{localizedMaintenanceText(p.name,lang)}</h3><p>{p.asset_name} · {p.vendor_name}</p><p>{p.calendar_enabled?`${t.due}: ${p.next_due_on}`:t.disabled}</p>{data.assets.some(a=>a.id===p.asset_id)&&<div className="flex flex-wrap gap-2"><button type="button" disabled={locked} onClick={()=>{if(locked||box.get())return;draftId.current=null;setSelectedCode(maintenanceTemplateFor(p.name)?.code??'');setSelectedAsset(p.asset_id);setEditing(p)}} className="rounded-lg border border-teal-600 bg-white px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50">{t.edit}</button><button type="button" disabled={locked||!p.calendar_enabled||p.next_due_on>today} onClick={()=>{if(!p.calendar_enabled||p.next_due_on>today)return;submit({action:'generate',context_id:contextId,plan_id:p.id,due_on:p.next_due_on})}} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{t.generate}</button></div>}<details open={resultPlan===p.id}><summary className="cursor-pointer font-medium text-teal-800">{t.history} ({p.history.length})</summary>{p.history.map(h=><p key={h.due_on}>{h.due_on} · {r.order} #{h.work_order_no} · {statusLabels[lang][h.status]??h.status}{onOpenWorkOrder?<button type="button" disabled={locked} onClick={()=>{if(live.current&&!reading.current&&!dispatchLock.current&&!box.get())onOpenWorkOrder(h.work_order_id)}} className="ms-2 rounded border px-3 py-2 font-semibold text-teal-800 disabled:opacity-50">{lang==='fa'?'باز کردن دستورکار':lang==='ro'?'Deschide ordinul':'Open work order'}</button>:null}</p>)}</details>{p.history.some(h=>h.status==='draft')&&<p className="text-xs text-slate-500">{r.draft}</p>}</article>)}
 </>}</section>;
}
