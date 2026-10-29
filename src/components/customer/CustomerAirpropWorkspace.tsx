'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Language } from '@/types';
import { CustomerAirpropDiligence } from './CustomerAirpropDiligence';
import { CustomerAirpropValuation } from './CustomerAirpropValuation';
import { CustomerAirpropUnderwriting } from './CustomerAirpropUnderwriting';
import { CustomerAirpropB2Workspace } from './CustomerAirpropB2';
import { useCustomerContext } from './CustomerContextProvider';
import { createAirpropOpportunityV2Schema } from '@/lib/airprop/opportunity-contract-v2';
import { readAirpropOpportunityRecovery, writeAirpropOpportunityRecovery } from '@/lib/customer/airprop-opportunity-recovery';

/** Consume only this failed read response; never classify its body as authorization. */
async function consumeFailedRead(response: Response, signal: AbortSignal) {
 if(signal.aborted){void response.body?.cancel().catch(()=>{});throw new Error('AIRPROP_READ_UNAVAILABLE');}
 if(!response.body)throw new Error('AIRPROP_READ_UNAVAILABLE');
 const reader=response.body.getReader();
 let stop:()=>void=()=>{},complete=false,bytes=0;
 const interrupted=new Promise<never>((_,reject)=>{stop=()=>reject(new Error('AIRPROP_READ_UNAVAILABLE'));});
 const timer=setTimeout(stop,1500);
 signal.addEventListener('abort',stop,{once:true});
 try{
  while(true){
   const {done,value}=await Promise.race([reader.read(),interrupted]);
   if(done){complete=true;return;}
   bytes+=value.byteLength;
   if(bytes>16384)throw new Error('AIRPROP_READ_UNAVAILABLE');
  }
 }finally{
  clearTimeout(timer);signal.removeEventListener('abort',stop);
  // Do not await cancellation: a broken underlying stream may never settle it.
  if(!complete)void reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
}


const copy = {
 en: { title: 'Property opportunities · AIRPROP', choose: 'Choose a workspace', empty: 'No authorized workspace is available for opportunities in this context. Check your selected access profile.', context: 'Select a context (access profile) to continue.', error: 'Workspace details could not be loaded. Check your access and return to the opportunities page.', name: 'Opportunity name', city: 'City', price: 'Asking price', currency: 'Currency', create: 'Save opportunity draft', retry: 'Retry the same request', pending: 'The request result is not yet known. The draft may already be saved. Use “Retry the same request”; do not send a new request for the same opportunity.', invalid: 'Check the name, city and positive price (up to four decimal places).', denied: 'This action is unavailable with your current access.', mfa: 'Verify your identity to continue.', nameError: 'Enter a name of 1–160 characters without control characters.', cityError: 'Enter a city of 1–120 characters without control characters.', priceError: 'Enter a positive price using a decimal point and up to four decimal places.', success: 'Opportunity saved as a draft. This does not publish a listing, enter into a contract, transfer ownership, or confirm credit approval or payment. For analysis, select the opportunity in the list.', opportunities: 'Opportunities', none: 'No opportunities yet. You can save a draft for a property, including commercial or office space.', loading: 'Loading…', status: 'Status', refresh: 'Refresh', draft: 'Draft', qualified: 'Qualified', underwriting: 'Underwriting', approved: 'Approved in this workflow', rejected: 'Rejected', archived: 'Archived', unsavedTitle: 'Discard opportunity edits?', unsavedBody: 'This opportunity has unsaved edits. Discard them before switching workspaces?', keepEditing: 'Keep editing', discardEdits: 'Discard edits' },
 ro: { title: 'Oportunități imobiliare · AIRPROP', choose: 'Alege spațiul de lucru', empty: 'Nu ai acces la niciun spațiu de lucru pentru oportunități în acest context. Verifică profilul de acces selectat.', context: 'Alege un profil de acces (context) pentru a continua.', error: 'Datele spațiului de lucru nu au putut fi încărcate. Verifică accesul și revino la pagina oportunităților.', name: 'Numele oportunității', city: 'Oraș', price: 'Preț solicitat', currency: 'Monedă', create: 'Salvează schița oportunității', retry: 'Reîncearcă aceeași cerere', pending: 'Rezultatul cererii nu este încă cunoscut. Schița poate fi deja salvată. Folosește „Reîncearcă aceeași cerere”; nu trimite o cerere nouă pentru aceeași oportunitate.', invalid: 'Verifică numele, orașul și prețul pozitiv (maximum patru zecimale).', denied: 'Acțiunea nu este disponibilă cu accesul actual.', mfa: 'Confirmă-ți identitatea pentru a continua.', nameError: 'Introdu un nume de 1–160 de caractere, fără caractere de control.', cityError: 'Introdu un oraș de 1–120 de caractere, fără caractere de control.', priceError: 'Introdu un preț pozitiv cu punct zecimal și maximum patru zecimale.', success: 'Oportunitate salvată ca schiță. Aceasta nu publică un anunț, nu încheie un contract, nu transferă proprietatea și nu confirmă un credit sau o plată. Pentru analiză, selectează oportunitatea din listă.', opportunities: 'Oportunități', none: 'Nu există încă oportunități. Poți salva o schiță pentru o proprietate, inclusiv un spațiu comercial sau de birouri.', loading: 'Se încarcă…', status: 'Stare', refresh: 'Actualizează', draft: 'Schiță', qualified: 'Calificată', underwriting: 'Analiză', approved: 'Aprobată în acest flux', rejected: 'Respinsă', archived: 'Arhivată', unsavedTitle: 'Renunți la modificările oportunității?', unsavedBody: 'Această oportunitate are modificări nesalvate. Renunți la ele înainte de a schimba workspace-ul?', keepEditing: 'Continuă editarea', discardEdits: 'Renunță la modificări' },
 fa: { title: 'فرصت‌های ملکی · AIRPROP', choose: 'انتخاب فضای کاری', empty: 'در این زمینه، فضای کاری مجازی برای فرصت‌ها در دسترس شما نیست. نمایهٔ دسترسی انتخاب‌شده را بررسی کنید.', context: 'برای ادامه، یک زمینه (نمایهٔ دسترسی) انتخاب کنید.', error: 'اطلاعات فضای کاری دریافت نشد. دسترسی خود را بررسی کنید و به صفحهٔ فرصت‌ها برگردید.', name: 'نام فرصت', city: 'شهر', price: 'قیمت پیشنهادی', currency: 'ارز', create: 'ذخیرهٔ پیش‌نویس فرصت', retry: 'تلاش مجدد برای همین درخواست', pending: 'نتیجهٔ درخواست مشخص نیست. ممکن است پیش‌نویس ذخیره شده باشد. از «تلاش مجدد برای همین درخواست» استفاده کنید؛ برای همین فرصت درخواست جدیدی نفرستید.', invalid: 'نام، شهر و قیمت مثبت با حداکثر چهار رقم اعشار را بررسی کنید.', denied: 'این اقدام با دسترسی فعلی شما مجاز نیست.', mfa: 'برای ادامه، هویت خود را تأیید کنید.', nameError: 'نامی بین ۱ تا ۱۶۰ نویسه و بدون نویسهٔ کنترلی وارد کنید.', cityError: 'نام شهر را بین ۱ تا ۱۲۰ نویسه و بدون نویسهٔ کنترلی وارد کنید.', priceError: 'قیمت مثبت را با نقطهٔ اعشار و حداکثر چهار رقم اعشار وارد کنید.', success: 'فرصت ثبت شد و در حد پیش‌نویس است. این کار به معنی انتشار آگهی، انعقاد قرارداد، انتقال مالکیت، تأیید اعتبار یا پرداخت نیست. برای تحلیل، فرصت را از فهرست انتخاب کنید.', opportunities: 'فرصت‌ها', none: 'هنوز فرصتی ثبت نشده است. می‌توانید برای یک ملک، از جمله فضای تجاری یا اداری، پیش‌نویس ذخیره کنید.', loading: 'در حال دریافت…', status: 'وضعیت', refresh: 'تازه‌سازی', draft: 'پیش‌نویس', qualified: 'ارزیابی اولیه', underwriting: 'تحلیل', approved: 'تأییدشده در این فرایند', rejected: 'ردشده', archived: 'بایگانی‌شده', unsavedTitle: 'ویرایش‌های فرصت نادیده گرفته شود؟', unsavedBody: 'این فرصت ویرایش ذخیره‌نشده دارد. پیش از تغییر ورک‌اسپیس آن‌ها را نادیده می‌گیرید؟', keepEditing: 'ادامهٔ ویرایش', discardEdits: 'نادیده گرفتن ویرایش‌ها' },
};
const commandCopy = {
 en: { session: 'Your session is unavailable. Check your access before trying again. An unknown request result does not mean the request was rejected.', conflict: 'This saved request is blocked by a conflict. Its details are preserved; repeating it cannot resolve the conflict. Ask for help checking the conflict; do not send a new request for the same opportunity.', recovery: 'The saved request could not be read or stored safely. Sending is blocked; the record has not been discarded. Ask for help checking this request before continuing.', conflictNotSaved: 'This request is blocked by a conflict, but the block could not be saved. Do not retry after leaving or reloading; the block may be lost. Ask for help checking the conflict.', blocked: 'Request blocked' },
 ro: { session: 'Sesiunea nu este disponibilă. Verifică accesul înainte de a reîncerca. O cerere fără rezultat cunoscut nu este o cerere respinsă.', conflict: 'Cererea salvată este blocată de un conflict. Detaliile sunt păstrate; repetarea ei nu poate rezolva conflictul. Cere ajutor pentru verificarea conflictului; nu trimite o cerere nouă pentru aceeași oportunitate.', recovery: 'Cererea salvată nu a putut fi citită sau păstrată în siguranță. Trimiterea este blocată; înregistrarea nu a fost eliminată. Cere ajutor pentru verificarea cererii înainte de a continua.', conflictNotSaved: 'Cererea este blocată de un conflict, dar blocarea nu a putut fi salvată. Nu reîncerca după plecare sau reîncărcare; blocarea se poate pierde. Cere ajutor pentru verificarea conflictului.', blocked: 'Cerere blocată' },
 fa: { session: 'نشست شما در دسترس نیست. پیش از تلاش دوباره، دسترسی خود را بررسی کنید. نامشخص بودن نتیجه به معنی رد شدن درخواست نیست.', conflict: 'این درخواست ذخیره‌شده به دلیل تعارض مسدود است. جزئیات آن حفظ شده؛ تکرار درخواست تعارض را برطرف نمی‌کند. برای بررسی تعارض کمک بگیرید؛ برای همین فرصت درخواست جدیدی نفرستید.', recovery: 'خواندن یا ذخیرهٔ امن درخواست ممکن نشد. ارسال مسدود است؛ رکورد کنار گذاشته نشده است. پیش از ادامه برای بررسی همین درخواست کمک بگیرید.', conflictNotSaved: 'این درخواست به دلیل تعارض مسدود است، اما ذخیرهٔ وضعیت مسدود ناموفق بود. پس از خروج یا بارگذاری دوباره تلاش نکنید؛ ممکن است وضعیت مسدود از دست برود. برای بررسی تعارض کمک بگیرید.', blocked: 'درخواست مسدود است' },
};
type Target = { workspace_id: string; workspace_type: string; environment: string };
type Opportunity = { opportunity_id: string; name: string; city: string; currency: string; asking_price: string; status: string };
export function CustomerAirpropWorkspace({ lang }: { lang: Language }) {
 const { active } = useCustomerContext();
 return <section className="mx-auto max-w-5xl space-y-6 p-6" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
  <h1 className="text-2xl font-semibold">{copy[lang].title}</h1>
  {active ? <WorkspaceSelection key={active.context_id} contextId={active.context_id} lang={lang} /> : <p>{copy[lang].context}</p>}
 </section>;
}
function WorkspaceSelection({ contextId, lang }: { contextId: string; lang: Language }) {
 const t=copy[lang]; const [targets,setTargets]=useState<Target[]|null>(null),[workspace,setWorkspace]=useState(''),[error,setError]=useState(false);
 const [pendingWorkspace,setPendingWorkspace]=useState<string|undefined>();
 const [draftDirty,setDraftDirty]=useState(false);
 const draftGuard=useRef<(()=>void)|null>(null);
 const workspaceSelectRef=useRef<HTMLSelectElement>(null);
 const dialogRef=useRef<HTMLDivElement>(null);
 const keepEditingRef=useRef<HTMLButtonElement>(null);
 const dialogTitleId=useId(),dialogBodyId=useId();
 useEffect(()=>{
  if(pendingWorkspace===undefined||!dialogRef.current)return;
  const dialog=dialogRef.current;
  const selector=workspaceSelectRef.current;
  const outside=new Map<Element,string|null>();
  // Make every sibling outside the dialog inert, including the surrounding app.
  let branch:Element=dialog;
  while(branch.parentElement){
   for(const sibling of Array.from(branch.parentElement.children)){if(sibling!==branch){outside.set(sibling,sibling.getAttribute('inert'));sibling.setAttribute('inert','');}}
   if(branch.parentElement===document.body)break;
   branch=branch.parentElement;
  }
  const focusKeep=()=>keepEditingRef.current?.focus();
  const blockOutside=(event:Event)=>{if(event.target instanceof window.Node&&!dialog.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}};
  const containFocus=(event:FocusEvent)=>{if(event.target instanceof window.Node&&!dialog.contains(event.target))focusKeep();};
  const handleKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();setPendingWorkspace(undefined);}
   else if(event.key==='Tab'){
    event.preventDefault();event.stopImmediatePropagation();
    const buttons=Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));
    const index=buttons.findIndex(button=>button===document.activeElement);
    buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
   }
  };
  document.addEventListener('keydown',handleKey,true);
  document.addEventListener('focusin',containFocus,true);
  document.addEventListener('pointerdown',blockOutside,true);
  document.addEventListener('click',blockOutside,true);
  focusKeep();
  return()=>{
   document.removeEventListener('keydown',handleKey,true);
   document.removeEventListener('focusin',containFocus,true);
   document.removeEventListener('pointerdown',blockOutside,true);
   document.removeEventListener('click',blockOutside,true);
   outside.forEach((inert,element)=>{if(inert===null)element.removeAttribute('inert');else element.setAttribute('inert',inert);});
   if(selector?.isConnected)selector.focus();
  };
 },[pendingWorkspace]);
 const registerDraftGuard=useCallback((dirty:boolean,discard:()=>void)=>{
  if(dirty){draftGuard.current=discard;setDraftDirty(true);}
  else {if(!draftGuard.current||draftGuard.current===discard)draftGuard.current=null;setDraftDirty(false);}
  return()=>{if(draftGuard.current===discard)draftGuard.current=null;};
 },[]);
 function requestWorkspace(next:string){if(next===workspace)return;if(draftDirty&&draftGuard.current){setPendingWorkspace(next);return;}setWorkspace(next);}
 function discardAndSwitch(){if(pendingWorkspace===undefined)return;const next=pendingWorkspace;draftGuard.current?.();draftGuard.current=null;setDraftDirty(false);setPendingWorkspace(undefined);setWorkspace(next);}
 useEffect(()=>{const controller=new AbortController();fetch(`/api/customer/v1/workspace/targets?context_id=${encodeURIComponent(contextId)}`,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok){await consumeFailedRead(r,controller.signal);throw new Error();}const body=await r.json();if(!Array.isArray(body.workspaces))throw new Error();if(controller.signal.aborted)return;setTargets(body.workspaces);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[contextId]);
 if(error)return <p role="alert">{t.error}</p>;
 if(!targets)return <p role="status">{t.loading}</p>;
 if(!targets.length)return <p>{t.empty}</p>;
 return <div className="space-y-6"><label className="block">{t.choose}<select ref={workspaceSelectRef} className="ms-3 rounded border p-2" value={workspace} onChange={e=>requestWorkspace(e.target.value)}><option value="">—</option>{targets.map(x=><option key={x.workspace_id} value={x.workspace_id}>{x.workspace_id} · {x.environment}</option>)}</select></label>
  {pendingWorkspace!==undefined&&<div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={dialogTitleId} aria-describedby={dialogBodyId} className="space-y-3 rounded border border-amber-500 bg-amber-50 p-4 text-slate-950"><h2 id={dialogTitleId} className="font-semibold">{t.unsavedTitle}</h2><p id={dialogBodyId}>{t.unsavedBody}</p><div className="flex flex-wrap gap-3"><button ref={keepEditingRef} type="button" className="rounded border border-slate-500 px-3 py-2 font-medium" onClick={()=>setPendingWorkspace(undefined)}>{t.keepEditing}</button><button type="button" className="rounded bg-slate-900 px-3 py-2 font-medium text-white" onClick={discardAndSwitch}>{t.discardEdits}</button></div></div>}
  {workspace&&<><CustomerAirpropB2Workspace key={`b2:${contextId}:${workspace}`} lang={lang} contextId={contextId} workspaceId={workspace}/><OpportunityPanel key={workspace} contextId={contextId} workspaceId={workspace} lang={lang} registerDraftGuard={registerDraftGuard}/></>}</div>;
}
function OpportunityPanel({ contextId,workspaceId,lang,registerDraftGuard }: { contextId:string;workspaceId:string;lang:Language;registerDraftGuard:(dirty:boolean,discard:()=>void)=>()=>void }) {
 const { registerUnsavedGuard }=useCustomerContext();
 const t=copy[lang]; const [rows,setRows]=useState<Opportunity[]|null>(null),[loadError,setLoadError]=useState(false),[nonce,setNonce]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [name,setName]=useState(''),[city,setCity]=useState(''),[price,setPrice]=useState(''),[currency,setCurrency]=useState('EUR');
 const [selectedOpportunity,setSelectedOpportunity]=useState('');
 const [commandError,setCommandError]=useState<'session'|'conflict'|'recovery'|'conflictNotSaved'|null>(null);
 const conflictBlocked=useRef(false);
 const formId=useId();
 const [fieldErrors,setFieldErrors]=useState<Record<string,boolean>>({});
 const formRef=useRef<HTMLFormElement>(null);
 const dirty=name!==''||city!==''||price!=='';
 const discardDraft=useCallback(()=>{setName('');setCity('');setPrice('');setCurrency('EUR');setFieldErrors({});setMessage('');},[]);
 const selected=rows?.find(row=>row.opportunity_id===selectedOpportunity);
 const evaluate=lang==='fa'?'ارزیابی':lang==='ro'?'Analizează':'Evaluate';
 const pending=useRef<ReturnType<typeof createAirpropOpportunityV2Schema.parse>|null>(null);
 const alive=useRef(true);
 const storageKey=`cladora.airprop.pending.v2:${contextId}:${workspaceId}`;
 const [recovering,setRecovering]=useState(true);
 useEffect(()=>registerDraftGuard(dirty,discardDraft),[dirty,discardDraft,registerDraftGuard]);
 useEffect(()=>registerUnsavedGuard(`airprop-opportunity:${contextId}:${workspaceId}`,dirty,discardDraft),[contextId,dirty,discardDraft,registerUnsavedGuard,workspaceId]);
 useEffect(()=>{let cancelled=false;Promise.resolve().then(()=>{
  if(cancelled)return;
  // A failed persistence attempt must not be cleared by a locale rerender.
  if(conflictBlocked.current){setRecovering(false);return;}
  try{
   const saved=readAirpropOpportunityRecovery(sessionStorage.getItem(storageKey),{contextId,workspaceId});
   if(saved.state!=='empty'){
    if(saved.state==='blocked'){conflictBlocked.current=true;setCommandError(saved.command?'conflict':'recovery');}
    if(saved.command){pending.current=saved.command;const p=saved.command.payload;setName(p.name);setCity(p.city);setPrice(p.asking_price);setCurrency(p.currency);setUncertain(true);if(saved.state==='uncertain')setMessage(t.pending);}
   }
  }catch{conflictBlocked.current=true;setCommandError('recovery');}
  setRecovering(false);
 });return()=>{cancelled=true;};},[storageKey,contextId,workspaceId,t.pending,t.error]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const controller=new AbortController();fetch(`/api/customer/v2/airprop/opportunities?context_id=${encodeURIComponent(contextId)}&workspace_id=${encodeURIComponent(workspaceId)}`,{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok){await consumeFailedRead(r,controller.signal);throw new Error();}const body=await r.json();if(!Array.isArray(body.opportunities))throw new Error();if(controller.signal.aborted)return;setRows(body.opportunities);setLoadError(false);}).catch(()=>{if(!controller.signal.aborted)setLoadError(true);});return()=>controller.abort();},[contextId,workspaceId,nonce]);
 function saveRecovery(state:'uncertain'|'blocked'){
  if(!pending.current)throw new Error('AIRPROP_RECOVERY_MISSING');
  const saved=writeAirpropOpportunityRecovery(pending.current,state);
  sessionStorage.setItem(storageKey,saved);
  if(sessionStorage.getItem(storageKey)!==saved)throw new Error('AIRPROP_RECOVERY_NOT_SAVED');
 }
 async function submit(event:React.FormEvent){event.preventDefault();if(busy||recovering||conflictBlocked.current)return;
  // Recheck the record before minting a key or writing: another instance may have
  // saved a conflict while this form was mounted. Invalid/foreign records stay intact.
  try{
   const saved=readAirpropOpportunityRecovery(sessionStorage.getItem(storageKey),{contextId,workspaceId});
   if(saved.state==='blocked'){
    conflictBlocked.current=true;setCommandError(saved.command?'conflict':'recovery');return;
   }
   if(saved.state==='uncertain'&&(!pending.current||JSON.stringify(saved.command)!==JSON.stringify(pending.current))){
    conflictBlocked.current=true;setCommandError('recovery');return;
   }
  }catch{conflictBlocked.current=true;setCommandError('recovery');return;}
  if(!pending.current){const parsed=createAirpropOpportunityV2Schema.safeParse({version:2,context_id:contextId,workspace_id:workspaceId,idempotency_key:crypto.randomUUID(),payload:{name,city,asking_price:price,currency,country_code:'RO'}});if(!parsed.success){const errors=Object.fromEntries(parsed.error.issues.filter(issue=>issue.path[0]==='payload').map(issue=>[String(issue.path[1]),true]));setFieldErrors(errors);setMessage(t.invalid);const first=['name','city','asking_price','currency'].find(field=>errors[field]);if(first)(formRef.current?.elements.namedItem(first) as HTMLElement|null)?.focus();return;}setFieldErrors({});pending.current=parsed.data;}
  try{saveRecovery('uncertain');}catch{conflictBlocked.current=true;setCommandError('recovery');return;}
  setBusy(true);setMessage('');setCommandError(null);
  try{const r=await fetch('/api/customer/v2/airprop/opportunities',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(pending.current)});
   if(!alive.current)return;
   if(r.ok){const body=await r.json();if(!alive.current)return;if(body.version!==2||body.workspace_id!==workspaceId||!body.opportunity_id)throw new Error();sessionStorage.removeItem(storageKey);pending.current=null;setUncertain(false);setName('');setCity('');setPrice('');setMessage(t.success);setNonce(n=>n+1);}
   else if(r.status>=500){setUncertain(true);setMessage(t.pending);}
   else {
    const body=await r.json();if(!alive.current)return;
    if(r.status===409&&body.error?.code==='IDEMPOTENCY_CONFLICT'){
     // A definitive conflict cannot be repaired by replaying or replacing this intent.
     // Preserve its original body/key in memory and storage; never reconcile implicitly.
     conflictBlocked.current=true;setCommandError('conflict');
     try{saveRecovery('blocked');}catch{setCommandError('conflictNotSaved');}
     return;
    }
    if(!uncertain){sessionStorage.removeItem(storageKey);pending.current=null;setUncertain(false);}
    if(r.status===401)setCommandError('session');
    else setMessage(body.error?.code==='MFA_REQUIRED'?t.mfa:r.status===403?t.denied:t.invalid);
   }
  }catch{if(alive.current){setUncertain(true);setMessage(t.pending);}}finally{if(alive.current)setBusy(false);}
 }
 const blocked=commandError!==null&&commandError!=='session';
 return <div className="space-y-6"><form ref={formRef} noValidate onSubmit={submit} className="space-y-3 rounded border p-4"><fieldset disabled={busy||uncertain||recovering||blocked} className="grid gap-3 sm:grid-cols-2">
  <label>{t.name}<input required name="name" aria-invalid={fieldErrors.name||undefined} aria-describedby={fieldErrors.name?`${formId}-name`:undefined} maxLength={160} className="block w-full rounded border p-2" value={name} onChange={e=>{setName(e.target.value);setFieldErrors(errors=>({...errors,name:false}));}}/>{fieldErrors.name&&<span id={`${formId}-name`} className="block text-sm text-red-700">{t.nameError}</span>}</label>
  <label>{t.city}<input required name="city" aria-invalid={fieldErrors.city||undefined} aria-describedby={fieldErrors.city?`${formId}-city`:undefined} maxLength={120} className="block w-full rounded border p-2" value={city} onChange={e=>{setCity(e.target.value);setFieldErrors(errors=>({...errors,city:false}));}}/>{fieldErrors.city&&<span id={`${formId}-city`} className="block text-sm text-red-700">{t.cityError}</span>}</label>
  <label>{t.price}<input required name="asking_price" aria-invalid={fieldErrors.asking_price||undefined} aria-describedby={fieldErrors.asking_price?`${formId}-asking_price`:undefined} inputMode="decimal" dir="ltr" className="block w-full rounded border p-2" value={price} onChange={e=>{setPrice(e.target.value);setFieldErrors(errors=>({...errors,asking_price:false}));}}/>{fieldErrors.asking_price&&<span id={`${formId}-asking_price`} className="block text-sm text-red-700">{t.priceError}</span>}</label>
  <label>{t.currency}<select className="block w-full rounded border p-2" value={currency} onChange={e=>setCurrency(e.target.value)}><option>EUR</option><option>RON</option></select></label>
 </fieldset><button disabled={busy||recovering||blocked} className="rounded bg-slate-900 px-4 py-2 text-white">{blocked?commandCopy[lang].blocked:busy?t.loading:uncertain?t.retry:t.create}</button><p role="status" aria-live="polite">{commandError?commandCopy[lang][commandError]:message}</p></form>
 <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{t.opportunities}</h2><button type="button" className="rounded border border-slate-400 px-3 py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" onClick={()=>setNonce(n=>n+1)}>{t.refresh}</button></div>
 {loadError?<p role="alert">{t.error}</p>:!rows?<p>{t.loading}</p>:!rows.length?<p>{t.none}</p>:<div className="overflow-x-auto"><table className="w-full text-start"><thead><tr>{[t.name,t.city,t.price,t.status,evaluate].map(x=><th key={x} className="p-2 text-start">{x}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.opportunity_id}><td className="p-2">{row.name}</td><td className="p-2">{row.city}</td><td className="p-2" dir="ltr">{row.asking_price} {row.currency}</td><td className="p-2">{t[row.status as keyof typeof t]??row.status}</td><td className="p-2"><button type="button" className="rounded border border-slate-400 px-3 py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-pressed={selectedOpportunity===row.opportunity_id} aria-label={`${evaluate}: ${row.name}`} onClick={()=>setSelectedOpportunity(row.opportunity_id)}>{evaluate}</button></td></tr>)}</tbody></table></div>}
 {selected&&!loadError&&<CustomerAirpropValuation contextId={contextId} workspaceId={workspaceId} opportunityId={selected.opportunity_id} lang={lang}/>}
 {selected&&!loadError&&<CustomerAirpropUnderwriting contextId={contextId} workspaceId={workspaceId} opportunityId={selected.opportunity_id} opportunityName={selected.name} currency={selected.currency} lang={lang} onSaved={()=>setNonce(n=>n+1)}/>}
 {selected&&!loadError&&<CustomerAirpropDiligence contextId={contextId} workspaceId={workspaceId} opportunityId={selected.opportunity_id} opportunityName={selected.name} lang={lang} refreshToken={nonce}/>}
 </div>;
}
