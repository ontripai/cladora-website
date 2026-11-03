'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { createCe012GuideHttpCommandsV1 } from '@/lib/community/experience-guide-functional-client';
import { CustomerExperienceGuide } from './CustomerExperienceGuide';
import { classifyGuideResponse, guideReadResponseSchema, toExperienceGuideView, type GuideLoadFailure, type GuideReadItem } from '@/lib/community/experience-guide-client';

type GuideRelay={owner:()=>object|null;fetch:typeof globalThis.fetch;denied:()=>void};
function createGuideScopeCache(){
 let relay:GuideRelay={owner:()=>null,fetch:globalThis.fetch,denied:()=>{}};
 return {sessions:new Map<string,{version:number;commands:ReturnType<typeof createCe012GuideHttpCommandsV1>}>(),
  owner:()=>relay.owner(),fetch:(...args:Parameters<typeof globalThis.fetch>)=>relay.fetch(...args),denied:()=>relay.denied(),
  attach(next:GuideRelay){relay=next;return()=>{if(relay===next)relay={owner:()=>null,fetch:globalThis.fetch,denied:()=>{}};};}};
}
type GuideScopeCache=ReturnType<typeof createGuideScopeCache>;

const copy = {
  ro: { title: 'Ghiduri pentru experiență', subtitle: 'Consultă ghidurile publicate pentru spațiul tău de lucru și publicul curent.', choose: 'Alege ghidul', loading: 'Se încarcă ghidurile…', empty: 'Nu există ghiduri eligibile în acest spațiu de lucru.', noContext: 'Alege mai întâi un context activ.', session: 'Sesiunea necesită verificare. Autentifică-te din nou.', denied: 'Modulul de ghiduri sau permisiunea necesară nu este activă în acest spațiu de lucru.', notReady: 'Conexiunea operațională pentru ghiduri nu este încă activată.', retry: 'Ghidurile nu au putut fi încărcate.', again: 'Încearcă din nou', viewOnly: 'Editarea referințelor rămâne indisponibilă până când selectorul securizat de documente este activ.' },
  en: { title: 'Experience guides', subtitle: 'Read guides published for your workspace and current audience.', choose: 'Choose a guide', loading: 'Loading guides…', empty: 'No eligible guides are available in this workspace.', noContext: 'Choose an active context first.', session: 'Your session needs verification. Sign in again.', denied: 'The guides module or required permission is not active in this workspace.', notReady: 'The operational guides connection has not been activated yet.', retry: 'Guides could not be loaded.', again: 'Try again', viewOnly: 'Reference editing remains unavailable until the secure document selector is active.' },
  fa: { title: 'راهنماهای تجربه', subtitle: 'راهنماهای منتشرشده برای فضای کاری و مخاطب فعلی را ببینید.', choose: 'انتخاب راهنما', loading: 'در حال دریافت راهنماها…', empty: 'در این فضای کاری راهنمای واجد شرایطی وجود ندارد.', noContext: 'ابتدا یک زمینهٔ فعال انتخاب کنید.', session: 'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.', denied: 'ماژول راهنما یا مجوز لازم در این فضای کاری فعال نیست.', notReady: 'اتصال عملیاتی راهنماها هنوز فعال نشده است.', retry: 'دریافت راهنماها ناموفق بود.', again: 'تلاش دوباره', viewOnly: 'ویرایش ارجاع‌ها تا فعال‌شدن انتخاب‌گر امن اسناد در دسترس نیست.' },
} as const;

export function CustomerExperienceGuidePage({ lang }: { lang: Language }) {
  const { active, dashboard, loading } = useCustomerContext(); const t = copy[lang];
  const token=useMemo(()=>({active,dashboard,loading,lang}),[active,dashboard,loading,lang]);
  const owner=useRef<object|null>(null);
  const [scopes]=useState(()=>new Map<string,GuideScopeCache>());
  useLayoutEffect(()=>{owner.current=loading?null:token;return()=>{owner.current=null;};},[token,loading]);
  const current=useCallback(()=>owner.current===token?token:null,[token]);
  if (loading || !active || !dashboard || active.context_id!==dashboard.contextId) return <Notice lang={lang} text={loading?t.loading:t.noContext} />;
  const binding=`${active.context_id}:${active.membership_id}:${dashboard.workspace_id}`;
  let cache=scopes.get(binding);if(!cache){cache=createGuideScopeCache();scopes.set(binding,cache);}
  return <GuideWorkspace key={binding} cache={cache} lang={lang}
    contextId={active.context_id} workspaceId={dashboard.workspace_id} owner={current} generation={token} />;
}
function GuideWorkspace({lang,contextId,workspaceId,owner,cache,generation}:{lang:Language;contextId:string;workspaceId:string;owner:()=>object|null;cache:GuideScopeCache;generation:object}){
 const fetch=useDashboardFetch(),t=copy[lang];
 const [guides,setGuides]=useState<GuideReadItem[]|null>(null),[selectedId,setSelectedId]=useState('');
 const [editingReady,setEditingReady]=useState(false);
 const [readOwner,setReadOwner]=useState<object|null>(null);
 const [failure,setFailure]=useState<GuideLoadFailure|null>(null),[attempt,setAttempt]=useState(0);
 const sessions=cache.sessions;
 useLayoutEffect(()=>{const detach=cache.attach({owner,fetch,denied:()=>{setGuides(null);setFailure('denied');}});return()=>{detach();sessions.forEach(s=>s.commands.invalidate());};},[owner,fetch,cache,sessions]);
 useEffect(()=>{const abort=new AbortController(),epoch=owner();
  const valid=()=>!abort.signal.aborted&&epoch!==null&&owner()===epoch;
  void (async()=>{try{
   const response=await fetch(`/api/customer/v1/experience/guides?${new URLSearchParams({context_id:contextId,workspace_id:workspaceId})}`,{cache:'no-store',credentials:'same-origin',signal:abort.signal});
   if(!response.ok)throw Error(classifyGuideResponse(response.status));
   const body=await response.json();
   const connected=response.headers.get('X-Cladora-Guide-Read')==='functional-v1';
   if(connected&&body?.contract!=='ce012-functional-guide.v1')throw Error('retry');
   const parsed=guideReadResponseSchema.parse(connected?body.projection:body);
   if(parsed.guides.some(g=>g.workspace_id!==workspaceId))throw Error('retry');
   if(valid()){setEditingReady(connected);setReadOwner(epoch);setGuides(parsed.guides);setFailure(null);setSelectedId(id=>parsed.guides.some(g=>g.guide_id===id)?id:parsed.guides[0]?.guide_id??'');}
  }catch(e){if(valid()){setGuides(null);setFailure(e instanceof Error&&['session','denied','not_ready'].includes(e.message)?e.message as GuideLoadFailure:'retry');}}})();
  return()=>abort.abort();
 },[contextId,workspaceId,owner,fetch,attempt]);
 const selected=guides?.find(g=>g.guide_id===selectedId)??null;
 let commands:ReturnType<typeof createCe012GuideHttpCommandsV1>|null=null;
 if(editingReady&&selected?.can_edit){
  // Retain unresolved wire across read/locale refresh. A new accepted version gets
  // a separate slot only after success; readback never resolves an UNKNOWN.
  const key=selected.guide_id,slot=sessions.get(key);
  commands=slot&&(slot.version===selected.version||slot.commands.retainedDraft())?slot.commands:null;
  if(!commands){commands=createCe012GuideHttpCommandsV1({binding:{context_id:contextId,workspace_id:workspaceId,guide_id:selected.guide_id,expected_guide_version:selected.version},
   owner:()=>cache.owner(),fetch:(...args)=>cache.fetch(...args),denied:()=>cache.denied()});sessions.set(key,{version:selected.version,commands});}
 }
 if(failure)return <Notice lang={lang} text={failure==='session'?t.session:failure==='denied'?t.denied:failure==='not_ready'?t.notReady:t.retry} retry={failure==='session'?undefined:()=>{setFailure(null);setGuides(null);setAttempt(n=>n+1);}} retryLabel={t.again}/>;
 if(!guides||readOwner!==generation)return <Notice lang={lang} text={t.loading}/>;
 return <section dir={lang==='fa'?'rtl':'ltr'} className="space-y-5">
  <header className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold text-[#102A43]">{t.title}</h1><p className="mt-2 text-sm text-[#52667A]">{t.subtitle}</p></header>
  {!guides.length?<Notice lang={lang} text={t.empty}/>:<>
   <label className="block min-w-0 rounded-2xl border bg-white p-4"><span className="mb-2 block text-sm font-semibold">{t.choose}</span><select aria-label={t.choose} value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="w-full min-w-0 max-w-full rounded-xl border p-3">{guides.map(g=><option key={g.guide_id} value={g.guide_id}>{g.title}</option>)}</select></label>
   <CustomerExperienceGuide key={`${workspaceId}:${selectedId}`} lang={lang} guide={selected?toExperienceGuideView(selected,lang):null} commands={commands} onChanged={()=>{if(owner())setAttempt(n=>n+1);}}/>
  </>}
 </section>;
}

function Notice({ lang, text, retry, retryLabel }: { lang: Language; text: string; retry?: () => void; retryLabel?: string }) {
  return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} role="status" className="rounded-2xl border bg-white p-8 text-center text-sm text-[#52667A]">{text}{retry ? <button type="button" onClick={retry} className="ms-3 rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white">{retryLabel}</button> : null}</div>;
}
