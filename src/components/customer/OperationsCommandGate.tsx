'use client';
import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createOperationsCommandClient,operationsHttpTransport,browserOperationsExclusive,type OperationsRecoveryState} from '@/lib/customer/operations-command-client';
import {type OperationsIntent,type OperationsReceipt} from '@/lib/customer/operations-command';
import {hasLegacyChecklistHold} from '@/lib/customer/operations-checklist-cutover';
type OperationsReceiptSummary={action:OperationsReceipt['action'];outcome:OperationsReceipt['outcome'];recorded_at:string};
type OperationsCommands={ready:boolean;receipt:OperationsReceiptSummary|null;send:(intent:OperationsIntent)=>Promise<unknown>};
const Context=createContext<OperationsCommands|null>(null);
export function useOperationsCommands(){const value=useContext(Context);if(!value)throw Error('operations_gate_required');return value;}
function OperationsCommandScope({contextId,lang,children}:{contextId:string;lang:string;children:ReactNode}){
 const [state,setState]=useState<OperationsRecoveryState>({ready:false,busy:false,unresolved:false,failed:false,receipt:null,recoveryContext:null}),[epoch,setEpoch]=useState(0),[legacyHeld,setLegacyHeld]=useState(false);
 const live=useRef(false),client=useRef<ReturnType<typeof createOperationsCommandClient>|null>(null);
 useLayoutEffect(()=>{live.current=true;return()=>{live.current=false;client.current=null;};},[]);
 useEffect(()=>{
  if(!contextId)return;
  let own=true;
  const c=createOperationsCommandClient(contextId,window.localStorage,operationsHttpTransport,browserOperationsExclusive,s=>{if(live.current&&own){setLegacyHeld(hasLegacyChecklistHold(window.localStorage));setState(s);}});client.current=c;
  void c.reconcile().catch(()=>{});
  const other=()=>{if(own){setLegacyHeld(hasLegacyChecklistHold(window.localStorage));if(!c.getState().busy)void c.reconcile().catch(()=>{});}};
  window.addEventListener('storage',other);
  window.addEventListener('cladora.operations.legacy-hold',other);
  return()=>{own=false;if(client.current===c)client.current=null;window.removeEventListener('storage',other);window.removeEventListener('cladora.operations.legacy-hold',other);};
 },[contextId]);
 async function recover(retry:boolean){try{const c=client.current;if(!c||hasLegacyChecklistHold(window.localStorage))return;if(retry)await c.retryExact();else await c.reconcile();if(live.current&&c.getState().ready)setEpoch(n=>n+1);}catch{/* Keep the gate closed; no current-state GET clears it. */}}
 const fa=lang==='fa',ro=lang==='ro';
 const actions=fa?{save:'ذخیرهٔ برنامه',generate:'ایجاد دستورکار',issue:'واگذاری دستورکار',start:'شروع کار',complete:'ثبت تکمیل',verify:'تأیید تکمیل',record_checklist:'ثبت بررسی چک‌لیست'}:ro?{save:'Salvarea planului',generate:'Generarea ordinului',issue:'Atribuirea ordinului',start:'Începerea lucrării',complete:'Înregistrarea finalizării',verify:'Verificarea finalizării',record_checklist:'Înregistrarea verificării'}:{save:'Save plan',generate:'Generate work order',issue:'Assign work order',start:'Start work',complete:'Record completion',verify:'Verify completion',record_checklist:'Record checklist check'};
 // Existing lookup/ACK validation is the only receipt source. A historical receipt
 // is neither the current resource state nor a capability to perform another action.
 const receipt=state.ready&&!state.busy&&!state.failed&&!legacyHeld&&state.receipt?.context_id===contextId?state.receipt:null;
 // Explicit primitive projection: no spread, nested receipt or identity/evidence reference.
 const summary:OperationsReceiptSummary|null=receipt?{action:receipt.action,outcome:receipt.outcome,recorded_at:receipt.recorded_at}:null;
 const value:OperationsCommands={ready:state.ready&&!legacyHeld,receipt:summary,send:async(intent:OperationsIntent)=>{
  const c=client.current;if(!c||!live.current||!state.ready||hasLegacyChecklistHold(window.localStorage)||intent.context_id!==contextId)throw Error('operations_not_admitted');
  const receipt=await c.execute(intent);
  if(!live.current||client.current!==c)throw Error('operations_binding_changed');
  if(receipt.outcome!=='committed')throw Object.assign(Error('operations_command_rejected'),{canonicalRejection:true,errorCode:receipt.error_code});
  return receipt.result;
 }};
 return <Context.Provider value={value}><div className="space-y-3">
 {legacyHeld?<p role="alert">{fa?'درخواست قدیمی چک‌لیست بدون کلید، نتیجهٔ نامعلوم دارد. فرمان‌های وابسته متوقف‌اند؛ مشاهدهٔ فعلی یا رسید جدید این درخواست را تسویه نمی‌کند.':ro?'O cerere veche fără cheie are rezultat necunoscut. Comenzile dependente rămân blocate; datele curente sau o recipisă nouă nu o reconciliază.':'A legacy keyless checklist request has an unknown outcome. Dependent commands remain on hold; current records or a new receipt cannot reconcile it.'}</p>:null}
 {(!state.ready||state.failed)?<section aria-live="polite" className="rounded-xl border bg-amber-50 p-4 text-sm"><p>{fa?'پیش از فرمان تازه، نتیجهٔ فرمان قبلی باید از رسید سرور بررسی شود. مشاهدهٔ وضعیت جاری کافی نیست.':ro?'Înaintea unei comenzi noi, verifică recipisa comenzii precedente pe server. Starea curentă nu este o recipisă.':'Reconcile the previous server command receipt before another command. Current state is not a receipt.'}</p><button type="button" disabled={state.busy} onClick={()=>void recover(false)}>{fa?'بازیابی رسید':ro?'Verifică recipisa':'Reconcile command'}</button>{state.unresolved&&(!state.recoveryContext||state.recoveryContext===contextId)?<button type="button" disabled={state.busy} onClick={()=>void recover(true)} className="ms-3">{fa?'تلاش صریح با همان کلید و ورودی':ro?'Reîncearcă exact aceeași comandă':'Retry exact stored command'}</button>:null}{state.recoveryContext&&state.recoveryContext!==contextId?<a href={`/${lang}/app/maintenance?context=${encodeURIComponent(state.recoveryContext)}`} className="ms-3 underline">{fa?'بازگشت به Context اصلی فرمان':ro?'Revino la contextul original al comenzii':'Return to the original command Context'}</a>:null}</section>:null}
 {receipt?<section aria-live="polite" aria-label={fa?'سابقهٔ رسید فرمان':ro?'Istoricul recipisei comenzii':'Command receipt history'} className="rounded-xl border bg-slate-50 p-4 text-sm">
  <p>{fa?'رسید ثبت‌شدهٔ سرور':ro?'Recipisă înregistrată de server':'Recorded server receipt'}: {actions[receipt.action]} · {receipt.outcome==='committed'?(fa?'ثبت‌شده':ro?'Înregistrată':'Committed'):(fa?'ردشده':ro?'Respinsă':'Rejected')} · <time dateTime={receipt.recorded_at}>{receipt.recorded_at}</time></p>
  <p>{fa?'این رسید، نتیجهٔ تاریخی همین فرمان است؛ وضعیت فعلی عملیات یا اختیار فعلی شما را تأیید نمی‌کند.':ro?'Această recipisă arată rezultatul istoric al comenzii; nu confirmă starea curentă a operațiunilor sau drepturile tale curente.':'This receipt records the historical command outcome; it does not confirm the current operational state or your current authority.'}</p>
 </section>:null}
 <div key={epoch}>{children}</div></div></Context.Provider>;
}

// Context changes invalidate the previous scope during commit, including callers
// that do not supply a key. The dashboard's existing membership/role/scope key stays intact.
export function OperationsCommandGate(props:{contextId:string;lang:string;children:ReactNode}){
 return <OperationsCommandScope key={props.contextId} {...props}/>;
}
