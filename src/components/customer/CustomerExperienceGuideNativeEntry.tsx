'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import type {Language} from '@/types';
import {guideDiscoveryV1Schema,type GuideSelectionV1} from '@/lib/community/experience-guide-discovery-contract';
import {CustomerExperienceGuideScope} from './CustomerExperienceGuidePage';
const copy={en:{choose:'Choose a Guide Context and Workspace',none:'Choose explicitly',loading:'Loading permitted Guide workspaces…',denied:'Guide access is not permitted in the current session.',session:'Sign in again to read guides.',unavailable:'The Guide connection is unavailable.',empty:'No permitted Guide workspace is available.',retry:'Refresh permitted workspaces',signin:'Sign in'},ro:{choose:'Alege contextul și spațiul de lucru pentru ghiduri',none:'Alege explicit',loading:'Se încarcă spațiile permise pentru ghiduri…',denied:'Accesul la ghiduri nu este permis în sesiunea curentă.',session:'Autentifică-te din nou pentru a citi ghidurile.',unavailable:'Conexiunea pentru ghiduri este indisponibilă.',empty:'Nu există un spațiu permis pentru ghiduri.',retry:'Actualizează spațiile permise',signin:'Autentificare'},fa:{choose:'انتخاب زمینه و فضای کاری راهنما',none:'صریحاً انتخاب کنید',loading:'در حال دریافت فضاهای مجاز راهنما…',denied:'در نشست فعلی اجازهٔ دسترسی به راهنماها ندارید.',session:'برای خواندن راهنما دوباره وارد شوید.',unavailable:'اتصال راهنما در دسترس نیست.',empty:'فضای کاری مجازی برای راهنما در دسترس نیست.',retry:'دریافت دوبارهٔ فضاهای مجاز',signin:'ورود'}} as const;
const key=(s:GuideSelectionV1)=>`${s.context_id}:${s.membership_id}:${s.workspace_id}`;
export function CustomerExperienceGuideNativeEntry({lang}:{lang:Language}){
 const t=copy[lang],generation=useRef(0),[rows,setRows]=useState<GuideSelectionV1[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState<'session'|'denied'|'unavailable'|null>(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const current=++generation.current,controller=new AbortController();
  void(async()=>{try{const response=await fetch('/api/customer/v1/experience/guides/discovery',{cache:'no-store',credentials:'same-origin',signal:controller.signal});
   const valid=()=>!controller.signal.aborted&&generation.current===current;
   if(!valid())return;if(!response.ok){if(valid()){setRows([]);setSelected('');setError(response.status===401?'session':response.status===403?'denied':'unavailable');}return;}
   const body=await response.json();if(!valid())return;const projection=guideDiscoveryV1Schema.parse(body);
   setRows(projection.selections);setSelected(v=>projection.selections.some(s=>key(s)===v)?v:'');
  }catch{if(!controller.signal.aborted&&generation.current===current){setRows([]);setSelected('');setError('unavailable');}}
  finally{if(!controller.signal.aborted&&generation.current===current)setLoading(false);}})();return()=>{controller.abort();};
 },[attempt]);
 const selection=rows.find(s=>key(s)===selected)??null;
 return <section dir={lang==='fa'?'rtl':'ltr'} className="space-y-5">
  <label className="block min-w-0 rounded-xl border bg-white p-4">{t.choose}<select aria-label={t.choose} value={selected} disabled={loading||Boolean(error)} onChange={e=>setSelected(e.target.value)} className="block w-full min-w-0 max-w-full rounded-lg border p-3"><option value="">{t.none}</option>{rows.map(s=><option key={key(s)} value={key(s)}>{s.tenant_name} · {s.role_name} · {s.workspace_id}</option>)}</select></label>
  {loading?<p role="status">{t.loading}</p>:error?<p role="alert">{t[error]}</p>:!rows.length?<p role="status">{t.empty}</p>:null}
  {error==='session'?<Link href={`/${lang}/login?next=app%2Fexperience%2Fguides`}>{t.signin}</Link>:<button type="button" disabled={loading} onClick={()=>{setLoading(true);setError(null);setAttempt(v=>v+1);}}>{t.retry}</button>}
  <CustomerExperienceGuideScope lang={lang} scope={selection} loading={loading}/>
 </section>;
}
