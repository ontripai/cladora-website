'use client';
import {useCallback,useLayoutEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {OperationsCommandGate,useOperationsCommands} from './OperationsCommandGate';
import {AlertTriangle,ChevronLeft,ChevronRight,RefreshCw,Search,ShieldCheck,Wrench,X} from 'lucide-react';
import {WorkOrderLifecyclePanel,parseMaintenanceRead,type MaintenanceRead} from './WorkOrderLifecyclePanel';
import {PreventiveMaintenancePanel} from './PreventiveMaintenancePanel';
import {localizedMaintenanceText} from '@/lib/customer/maintenance-defaults';
import type {Language} from '@/types';
import {useCustomerContext} from './CustomerContextProvider';
type View='assets'|'components'|'plans'|'work_orders'|'tasks'|'vendors'|'sla'|'costs'|'history';
type Result={owner:object;payload:MaintenanceRead|null;error:boolean};
type Selection={id:string;view:View;binding:string;opening:number};
const copy={en:{title:'Assets, Maintenance & Work Orders',sub:'Review assets, planned maintenance, work orders and costs for the selected context.',assets:'Assets',components:'Components',plans:'Plans',work_orders:'Work orders',tasks:'Tasks',vendors:'Vendors',sla:'SLA',costs:'Costs',history:'Lifecycle',search:'Search maintenance records',all:'All',status:'Status',priority:'Priority',from:'From',to:'To',refresh:'Refresh',loading:'Loading maintenance records…',empty:'No records match this view and its filters.',error:'Maintenance data could not be loaded.',readonly:'Maintenance records',details:'Details',close:'Close',open:'Open work orders',overdue:'Overdue',total:'Recorded cost',date:'Date / schedule',subject:'Asset / work order',source:'Location / vendor',value:'Value'},ro:{title:'Active, mentenanță și ordine de lucru',sub:'Consultă activele, mentenanța planificată, ordinele de lucru și costurile pentru contextul selectat.',assets:'Active',components:'Componente',plans:'Planuri',work_orders:'Ordine de lucru',tasks:'Sarcini',vendors:'Furnizori',sla:'SLA',costs:'Costuri',history:'Istoric',search:'Caută înregistrări de mentenanță',all:'Toate',status:'Stare',priority:'Prioritate',from:'De la',to:'Până la',refresh:'Reîncarcă',loading:'Se încarcă înregistrările de mentenanță…',empty:'Nicio înregistrare nu corespunde acestei vizualizări și filtrelor ei.',error:'Datele de mentenanță nu au putut fi încărcate.',readonly:'Înregistrări de mentenanță',details:'Detalii',close:'Închide',open:'Ordine deschise',overdue:'Întârziate',total:'Cost înregistrat',date:'Dată / programare',subject:'Activ / ordin',source:'Locație / furnizor',value:'Valoare'},fa:{title:'دارایی‌ها، نگهداری و دستورکارها',sub:'دارایی‌ها، نگهداری برنامه‌ریزی‌شده، دستورکارها و هزینه‌های زمینهٔ انتخاب‌شده را ببینید.',assets:'دارایی‌ها',components:'اجزا',plans:'برنامه‌ها',work_orders:'دستورکارها',tasks:'وظایف',vendors:'فروشندگان',sla:'SLA',costs:'هزینه‌ها',history:'چرخه عمر',search:'جستجوی سوابق نگهداری',all:'همه',status:'وضعیت',priority:'اولویت',from:'از',to:'تا',refresh:'بازخوانی',loading:'در حال دریافت سوابق نگهداری…',empty:'هیچ سابقه‌ای با این نما و فیلترها مطابقت ندارد.',error:'دریافت اطلاعات نگهداری ناموفق بود.',readonly:'سوابق نگهداری',details:'جزئیات',close:'بستن',open:'دستورکار باز',overdue:'عقب‌افتاده',total:'هزینه ثبت‌شده',date:'تاریخ / برنامه',subject:'دارایی / دستورکار',source:'محل / فروشنده',value:'مقدار'}} as const;
const txt=(v:unknown)=>v==null||v===''?'—':typeof v==='object'?JSON.stringify(v):String(v);const fmtDate=(v:unknown,l:string)=>v?new Intl.DateTimeFormat(l==='fa'?'fa-IR':l==='ro'?'ro-RO':'en-US').format(new Date(String(v))):'—';
function currencyTotals(value:unknown,lang:Language){
 if(!value||typeof value!=='object'||Array.isArray(value))return '—';
 const entries=Object.entries(value).filter(([currency,amount])=>/^[A-Z]{3}$/.test(currency)&&Number.isFinite(Number(amount)));
 if(!entries.length)return '—';
 const locale=lang==='fa'?'fa-IR':lang==='ro'?'ro-RO':'en-US';
 return entries.map(([currency,amount])=>`${new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(Number(amount))} ${currency}`).join(' · ');
}
function MaintenanceDashboard({lang,initialView,initialWorkOrderId}:{lang:string;initialView:View;initialWorkOrderId?:string}){
 const operations=useOperationsCommands();
 const locale:Language=lang==='fa'?'fa':lang==='ro'?'ro':'en',t=copy[locale];
 const {active,dashboard,loading:contextLoading,error:contextError}=useCustomerContext();
 const [plansMounted,setPlansMounted]=useState(initialView==='plans'),initialSelection=useRef('');
 const [view,setView]=useState<View>(initialView),[result,setResult]=useState<Result|null>(null),[offset,setOffset]=useState(0),[draft,setDraft]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState(''),[priority,setPriority]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[selected,setSelected]=useState<Selection|null>(null),[nonce,setNonce]=useState(0);
 const contextId=active?.context_id??'',binding=`${active?.membership_id??''}:${contextId}:${active?.role_code??''}:${active?.scope_type??''}`,ready=operations.ready&&!!active&&!contextLoading&&!contextError&&dashboard?.contextId===contextId;
 const params=new URLSearchParams({context_id:contextId,view,limit:'20',offset:String(offset)});if(query)params.set('query',query);if(status)params.set('status',status);if(priority)params.set('priority',priority);if(from)params.set('from',from);if(to)params.set('to',to);
 const search=params.toString(),requestKey=`${search}:${nonce}`;
 const token=useMemo(()=>({binding,ready,requestKey,locale}),[binding,ready,requestKey,locale]);
 const committed=useRef<typeof token|null>(null),selection=useRef<Selection|null>(null),opening=useRef(0);
 const current=result?.owner===token&&ready?result:null,data=current?.payload??null,loading=ready&&!current,error=contextError||current?.error?t.error:'';
 useLayoutEffect(()=>{selection.current=selected;return()=>{if(selection.current===selected)selection.current=null;};},[selected]);
 useLayoutEffect(()=>{
  committed.current=token;if(!ready)return()=>{if(committed.current===token)committed.current=null;};
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
   const owns=()=>committed.current===token&&!controller.signal.aborted;
   try{const response=await fetch(`/api/customer/v1/maintenance?${search}`,{cache:'no-store',credentials:'same-origin',signal});if(!owns())return;signal.throwIfAborted();if(!response.ok)throw Error('maintenance_read');const payload=parseMaintenanceRead(await response.json(),contextId,view);if(!owns())return;signal.throwIfAborted();if(payload.limit!==20||payload.offset!==offset)throw Error('maintenance_page');setResult({owner:token,payload,error:false});}
   catch{if(owns())setResult({owner:token,payload:null,error:true});}
  },200);
  return()=>{if(committed.current===token)committed.current=null;clearTimeout(timer);controller.abort();};
 },[token,ready,search,contextId,view,offset]);
 const close=useCallback(()=>{selection.current=null;setSelected(null);},[]);
 const onChanged=useCallback(()=>{if(selected&&selection.current===selected&&committed.current?.ready&&committed.current.binding===selected.binding)setNonce(n=>n+1);},[selected]);
 const onUnavailable=useCallback(()=>{const owner=committed.current;if(selected&&selection.current===selected&&owner?.ready&&owner.binding===selected.binding)setResult({owner,payload:null,error:true});},[selected]);
 const selectedRow=selected?.binding===binding&&selected.view===view?data?.rows.find(row=>row.id===selected.id)??null:null;
 const openWorkOrder=useCallback((id:string)=>{
  if(!committed.current?.ready||committed.current.binding!==binding)return;
  selection.current=null;setView('work_orders');setOffset(0);setStatus('');
  setSelected({id,view:'work_orders',binding,opening:++opening.current});
 },[binding]);
 useLayoutEffect(()=>{
  if(!initialWorkOrderId||!contextId)return;
  const wanted=`${binding}:${initialWorkOrderId}`;
  if(initialSelection.current===wanted)return;
  initialSelection.current=wanted;selection.current=null;setView('work_orders');
  setSelected({id:initialWorkOrderId,view:'work_orders',binding,opening:++opening.current});
 },[binding,contextId,initialWorkOrderId]);
 const tabs=(['assets','components','plans','work_orders','tasks','vendors','sla','costs','history'] as View[]);
 function change(v:View){if(v==='plans')setPlansMounted(true);setView(v);setOffset(0);setStatus('');close();}
 const unconfirmed=locale==='fa'?'پیش از نمایش نتیجه، دسترسی زمینهٔ جاری و رسید فرمان در حال بررسی است؛ هنوز نتیجهٔ جاری تأیید نشده است.':locale==='ro'?'Verifică accesul contextului curent și recipisa comenzii înainte de afișare; rezultatul curent nu este încă confirmat.':'Current Context access and the command receipt must be checked before displaying results; no current result is confirmed.';
 const absent=locale==='fa'?'دستورکار در این مشاهدهٔ فعلی دیده نشد؛ نبودن در صفحه، انجام‌نشدن درخواست را ثابت نمی‌کند.':locale==='ro'?'Ordinul nu apare în această vizualizare curentă; absența din pagină nu dovedește că cererea nu a fost efectuată.':'The work order is not in this current observation; absence from this page does not prove a request did not commit.';
return <div className="space-y-5"><header className="rounded-2xl border bg-white p-6"><div className="flex flex-wrap justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E9F8E]"><Wrench className="h-4 w-4"/>{locale==='fa'?'نگهداری':locale==='ro'?'Mentenanță':'Maintenance'}</div><h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1><p className="mt-1 text-sm text-[#52667A]">{t.sub}</p></div><div className="h-fit rounded-xl border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-2 text-xs font-bold text-[#0A6E62]"><ShieldCheck className="me-2 inline h-4 w-4"/>{t.readonly}</div></div></header>
<div className="flex flex-wrap gap-2">{tabs.map(v=><button type="button" key={v} onClick={()=>change(v)} className={`rounded-xl px-3 py-2 text-xs font-bold ${view===v?'bg-[#0E9F8E] text-white':'border bg-white text-[#334E68]'}`}>{t[v]}</button>)}</div>
<nav aria-label={locale==='fa'?'مسیر عملیات ساختمان':locale==='ro'?'Fluxul operațiunilor':'Building operations journey'} className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4 text-sm font-semibold text-teal-800">
<Link href={`/${locale}/app/assets`}>{locale==='fa'?'۱. ساختمان و تجهیزات':locale==='ro'?'1. Clădire și echipamente':'1. Building and equipment'}</Link>
<Link href={`/${locale}/app/vendors`}>{locale==='fa'?'۲. پیمانکاران':locale==='ro'?'2. Furnizori':'2. Contractors'}</Link>
<button type="button" onClick={()=>change('plans')}>{locale==='fa'?'۳. برنامه نگهداری':locale==='ro'?'3. Plan de mentenanță':'3. Maintenance plan'}</button>
<button type="button" onClick={()=>change('work_orders')}>{locale==='fa'?'۴. اجرا و سوابق دستورکار':locale==='ro'?'4. Execuție și istoric':'4. Work order execution and history'}</button>
<Link href={`/${locale}/app/maintenance?view=history`}>{locale==='fa'?'۵. تاریخچهٔ عملیات':locale==='ro'?'5. Istoricul operațiunilor':'5. Operations history'}</Link>
<Link href={`/${locale}/mfa`}>{locale==='fa'?'ورود دومرحله‌ای':locale==='ro'?'Autentificare în doi pași':'Multi-factor authentication'}</Link>
</nav>
{plansMounted&&active?<div hidden={view!=='plans'}><PreventiveMaintenancePanel lang={locale} contextId={active.context_id} ready={ready&&view==='plans'} scopeKey={binding} onOpenWorkOrder={openWorkOrder}/></div>:null}
<form onSubmit={e=>{e.preventDefault();setOffset(0);setQuery(draft.trim())}} className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-6"><label className="relative md:col-span-2"><Search className="absolute start-3 top-2.5 h-4 w-4 text-[#7B8A9A]"/><span className="sr-only">{t.search}</span><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder={t.search} className="w-full rounded-xl border py-2 pe-3 ps-9 text-sm"/></label><input aria-label={t.status} value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}} placeholder={`${t.all} · ${t.status}`} className="rounded-xl border px-3 py-2 text-sm"/><select aria-label={t.priority} value={priority} onChange={e=>{setPriority(e.target.value);setOffset(0)}} className="rounded-xl border px-3 py-2 text-sm"><option value="">{t.all} · {t.priority}</option>{['low','normal','high','urgent','emergency'].map(x=><option key={x}>{x}</option>)}</select><input type="date" aria-label={t.from} value={from} onChange={e=>{setFrom(e.target.value);setOffset(0)}} className="rounded-xl border px-3 py-2 text-sm"/><div className="flex gap-2"><input type="date" aria-label={t.to} value={to} onChange={e=>{setTo(e.target.value);setOffset(0)}} className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"/><button type="button" aria-label={t.refresh} onClick={()=>setNonce(n=>n+1)} className="rounded-xl border p-2"><RefreshCw className="h-4 w-4"/></button></div></form>
{data&&active?<p className="text-xs text-[#52667A]">{locale==='fa'?'گزارش برای':locale==='ro'?'Raport pentru':'Report for'}: {active.context_label}{data.generated_at?` · ${locale==='fa'?'به‌روزرسانی':locale==='ro'?'Actualizat':'Updated'}: ${new Intl.DateTimeFormat(locale==='fa'?'fa-IR':locale==='ro'?'ro-RO':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(data.generated_at))}`:''}</p>:null}
{data?.summary?<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label={t.assets} value={data.summary.assets}/><Metric label={t.open} value={data.summary.open_work_orders}/><Metric label={t.overdue} value={data.summary.overdue} alert/><Metric label={t.total} value={currencyTotals(data.summary.cost_total,locale)}/></div>:null}
{loading?<Box value={t.loading}/>:error?<Box value={error}/>:!ready?<Box value={unconfirmed}/>:!data?.rows.length?<Box value={t.empty}/>:<><div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-start text-xs"><thead className="bg-[#F6F9FC] text-[#52667A]"><tr><th className="p-3 text-start">{t.date}</th><th className="p-3 text-start">{t.subject}</th><th className="p-3 text-start">{t.source}</th><th className="p-3 text-start">{t.value}</th><th className="p-3 text-start">{t.status}</th><th className="p-3 text-start">{t.details}</th></tr></thead><tbody className="divide-y">{data.rows.map(r=><tr key={String(r.id)}><Cells row={r} view={view} lang={locale}/><td className="p-3"><button type="button" onClick={()=>{selection.current=null;setSelected({id:String(r.id),view,binding,opening:++opening.current});}} className="font-bold text-[#087A6E]">{t.details}</button></td></tr>)}</tbody></table></div><div className="flex justify-between text-xs text-[#52667A]"><span>{offset+1}–{Math.min(offset+20,data.total)} / {data.total}</span><div className="flex gap-2"><button type="button" aria-label={locale==='fa'?'صفحهٔ قبل':locale==='ro'?'Pagina anterioară':'Previous page'} disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-20))} className="rounded-xl border bg-white p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4 rtl:rotate-180"/></button><button type="button" aria-label={locale==='fa'?'صفحهٔ بعد':locale==='ro'?'Pagina următoare':'Next page'} disabled={offset+20>=data.total} onClick={()=>setOffset(offset+20)} className="rounded-xl border bg-white p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4 rtl:rotate-180"/></button></div></div></>}{selected&&active&&selected.binding===binding&&selected.view===view?<Detail key={`${binding}:${selected.id}:${selected.opening}`} contextId={contextId} scopeKey={binding} workOrderId={selected.id} ready={ready&&!!current&&!current.error} workOrder={view==='work_orders'} onChanged={onChanged} onUnavailable={onUnavailable} row={selectedRow} close={close} label={t.close} lang={locale} missing={loading?t.loading:absent}/>:null}</div>}
function Metric({label,value,alert}:{label:string;value:unknown;alert?:boolean}){return <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold text-[#52667A]">{alert?<AlertTriangle className="me-1 inline h-4 w-4 text-[#E5484D]"/>:null}{label}</div><div className="mt-2 text-xl font-extrabold text-[#102A43]">{txt(value)}</div></div>}
function Box({value}:{value:string}){return <div className="rounded-2xl border bg-white p-10 text-center text-sm text-[#52667A]">{value}</div>}
function Cells({row:r,view,lang}:{row:Record<string,unknown>;view:View;lang:Language}){const when=r.occurred_at??r.incurred_on??r.measured_at??r.created_at??r.next_due_at??r.installed_on??r.assigned_at;const subject=view==='work_orders'?(r.title??r.asset_name):view==='tasks'?(r.label??r.work_order_title):r.asset_name??r.work_order_title??r.name??r.component_name??r.vendor_name??r.event_type;const source=r.unit_code??r.building_name??r.property_name??r.vendor_name??r.parent_name??r.asset_code;const value=view==='costs'?`${txt(r.amount)} ${txt(r.currency)}`:view==='sla'?`${txt(r.actual_value)} / ${txt(r.target_value)} ${txt(r.unit_code)}`:view==='vendors'?r.rating:view==='components'?r.quantity:r.cost_totals??r.condition??r.default_priority??r.priority;return <><td className="p-3">{fmtDate(when,lang)}</td><td className="p-3 font-bold">{typeof subject==='string'?localizedMaintenanceText(subject,lang):txt(subject)}</td><td className="p-3">{txt(source)}</td><td className="p-3 font-mono">{value===r.cost_totals?currencyTotals(value,lang):txt(value)}</td><td className="p-3">{txt(r.status??r.work_order_status??r.met??r.overdue)}</td></>}
function Detail({row,close,label,lang,contextId,scopeKey,workOrderId,ready,workOrder,onChanged,onUnavailable,missing}:{contextId:string;scopeKey:string;workOrderId:string;ready:boolean;workOrder:boolean;onChanged:(status:string)=>void;onUnavailable:()=>void;row:Record<string,unknown>|null;close:()=>void;label:string;lang:Language;missing:string}){
 const operations=useOperationsCommands();
 const dialog=useRef<HTMLDivElement|null>(null),returnToRecovery=useRef(false);
 const recoveryCopy=lang==='fa'?{help:'برای بررسی رسید همان فرمان، ابتدا این پنجره را ببندید. سپس «بازیابی رسید» را انتخاب کنید؛ فرمان دوباره ارسال نمی‌شود.',close:'بستن جزئیات و رفتن به بازیابی رسید'}:lang==='ro'?{help:'Închide această fereastră, apoi alege „Verifică recipisa” pentru aceeași comandă. Comanda nu va fi retrimisă.',close:'Închide detaliile și mergi la verificarea recipisei'}:{help:'Close this window, then choose “Reconcile command” to check the same command receipt. The command will not be resent.',close:'Close details and go to command recovery'};
 useLayoutEffect(()=>{
  const opener=document.activeElement instanceof window.HTMLElement?document.activeElement:null;
  // The gate's existing recovery section stays outside this keyboard modal.
  // Closing is explicit; focusing its first control performs no command or GET.
  const recoveryScope=dialog.current?.closest('[data-operations-recovery-scope]');
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>{
   if(returnToRecovery.current){
    const recovery=recoveryScope?.querySelector<HTMLButtonElement>('section[aria-live="polite"] button:not(:disabled)');
    if(recovery?.isConnected){recovery.focus();return;}
   }
   if(opener?.isConnected)opener.focus();
  };
 },[]);
 return <div ref={dialog} onKeyDown={event=>{
  if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key!=='Tab')return;
  const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')??[]).filter(node=>!node.closest('[hidden]'));
  const first=nodes[0],last=nodes[nodes.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }} role="dialog" aria-label={lang==='fa'?'جزئیات عملیات':lang==='ro'?'Detalii operațiuni':'Operations details'} aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"><div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6"><div className="flex justify-end"><button type="button" onClick={close} aria-label={label}><X/></button></div>{workOrder&&!operations.ready?<section aria-live="polite" className="my-3 rounded-xl border bg-amber-50 p-4 text-sm"><p>{recoveryCopy.help}</p><button type="button" className="mt-2 rounded-lg border bg-white px-3 py-2 font-semibold" onClick={()=>{returnToRecovery.current=true;close();}}>{recoveryCopy.close}</button></section>:null}{workOrder?<WorkOrderLifecyclePanel contextId={contextId} workOrderId={workOrderId} status={String(row?.status??'')} lang={lang} onChanged={onChanged} onUnavailable={onUnavailable} ready={ready} scopeKey={scopeKey}/>:null}{!row?<p role="status">{workOrder?'':missing}</p>:<dl className="grid gap-3 sm:grid-cols-2">{Object.entries(row).filter(([k])=>!['serial_number_encrypted','object_path','contract_ref_encrypted','tax_ref_encrypted','email_encrypted','phone_encrypted','snapshot_json','before_snapshot','after_snapshot'].includes(k)).map(([k,v])=><div key={k} className="rounded-xl bg-[#F6F9FC] p-3"><dt className="text-xs font-bold text-[#52667A]">{k}</dt><dd className="mt-1 break-words text-xs text-[#102A43]">{Array.isArray(v)?v.map(item=>typeof item==='string'?localizedMaintenanceText(item,lang):txt(item)).join(', '):typeof v==='string'?localizedMaintenanceText(v,lang):txt(v)}</dd></div>)}</dl>}</div></div>}

export function CustomerMaintenanceDashboard(props:{lang:string;initialView:View;initialWorkOrderId?:string}){
 const {active}=useCustomerContext();
 const binding=`${active?.membership_id??''}:${active?.context_id??''}:${active?.role_code??''}:${active?.scope_type??''}`;
 return <div data-operations-recovery-scope><OperationsCommandGate key={binding} contextId={active?.context_id??''} lang={props.lang}><MaintenanceDashboard {...props}/></OperationsCommandGate></div>;
}
