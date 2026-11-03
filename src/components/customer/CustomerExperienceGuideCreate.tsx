'use client';
import {useEffect,useId,useRef,useState} from 'react';
import type {Language} from '@/types';
import type {GuideCreateInput,GuideCreatorV1} from '@/lib/community/experience-guide-create-client';
const copy={
 en:{heading:'Create a guide',title:'Guide title',step:'First step title',body:'Instructions',reason:'Reason for creating this guide',scope:'One-step draft for this workspace. No document reference is required; this does not publish the guide.',submit:'Create draft',retry:'Retry the same creation',sending:'Saving draft…',unknown:'The result is unknown. Your draft is retained. Retry explicitly with the same command; do not create another copy.',error:'Creation could not be confirmed. Your draft has been kept.'},
 ro:{heading:'Creează un ghid',title:'Titlul ghidului',step:'Titlul primului pas',body:'Instrucțiuni',reason:'Motivul creării ghidului',scope:'Ciornă cu un pas pentru acest spațiu de lucru. Nu necesită un document; ghidul nu este publicat.',submit:'Creează ciorna',retry:'Reîncearcă aceeași creare',sending:'Se salvează ciorna…',unknown:'Rezultatul este necunoscut. Ciorna este păstrată. Reîncearcă explicit aceeași comandă; nu crea altă copie.',error:'Crearea nu a putut fi confirmată. Ciorna este păstrată.'},
 fa:{heading:'ایجاد راهنما',title:'عنوان راهنما',step:'عنوان گام اول',body:'دستورالعمل',reason:'دلیل ایجاد راهنما',scope:'پیش‌نویس یک‌گامی برای همین فضای کاری؛ به ارجاع سند نیاز ندارد و با ایجاد، منتشر نمی‌شود.',submit:'ایجاد پیش‌نویس',retry:'تلاش دوباره برای همین ایجاد',sending:'در حال ذخیرهٔ پیش‌نویس…',unknown:'نتیجه نامعلوم است. پیش‌نویس شما حفظ شده؛ فقط همین فرمان را صریحاً دوباره امتحان کنید و نسخهٔ دیگری نسازید.',error:'ایجاد تأیید نشد. پیش‌نویس شما حفظ شده است.'},
} as const;
const empty:GuideCreateInput={title:'',step_title:'',instructions:'',reason:''};
export function CustomerExperienceGuideCreate({lang,commands,onCreated}:{lang:Language;commands:GuideCreatorV1;onCreated:(id:string)=>void}){
 const t=copy[lang],heading=useId(),status=useId(),epoch=useRef<object|null>(null),pending=useRef(false);
 const [draft,setDraft]=useState(()=>commands.retainedDraft()??{...empty}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [unknown,setUnknown]=useState(commands.isUncertain());
 useEffect(()=>{const current={};epoch.current=current;return()=>{if(epoch.current===current)epoch.current=null;commands.invalidate();};},[commands]);
 useEffect(()=>{commands.rememberDraft(draft);},[draft,commands]);
 useEffect(()=>{const guard=(e:BeforeUnloadEvent)=>{if(unknown||Object.values(draft).some(Boolean)){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[draft,unknown]);
 async function submit(){if(pending.current)return;pending.current=true;const owner=epoch.current;setBusy(true);setError('');
  try{const id=await commands.create({...draft});if(owner===null||epoch.current!==owner)return;setUnknown(false);setDraft({...empty});onCreated(id);}
  catch{if(owner!==null&&epoch.current===owner){setUnknown(commands.isUncertain());setError(commands.isUncertain()?t.unknown:t.error);}}
  finally{pending.current=false;if(owner!==null&&epoch.current===owner)setBusy(false);}}
 function change(key:keyof GuideCreateInput,value:string){setDraft(v=>({...v,[key]:value}));}
 return <form dir={lang==='fa'?'rtl':'ltr'} aria-labelledby={heading} aria-describedby={status} className="min-w-0 space-y-3 rounded-2xl border bg-white p-5" onSubmit={e=>{e.preventDefault();void submit();}}>
  <h2 id={heading} className="font-bold">{t.heading}</h2><p className="text-sm">{t.scope}</p>
  <p id={status} role="status" aria-live="polite">{busy?t.sending:''}</p>{error?<p role="alert">{error}</p>:null}
  <fieldset disabled={busy||unknown} aria-busy={busy} className="min-w-0 space-y-3">
   <label className="block">{t.title}<input required minLength={2} maxLength={160} value={draft.title} onChange={e=>change('title',e.target.value)} className="block w-full min-w-0 rounded-lg border p-2"/></label>
   <label className="block">{t.step}<input required maxLength={160} value={draft.step_title} onChange={e=>change('step_title',e.target.value)} className="block w-full min-w-0 rounded-lg border p-2"/></label>
   <label className="block">{t.body}<textarea required maxLength={5000} value={draft.instructions} onChange={e=>change('instructions',e.target.value)} className="block w-full min-w-0 rounded-lg border p-2"/></label>
   <label className="block">{t.reason}<input required minLength={5} maxLength={500} value={draft.reason} onChange={e=>change('reason',e.target.value)} className="block w-full min-w-0 rounded-lg border p-2"/></label>
  </fieldset><button disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{unknown?t.retry:t.submit}</button>
 </form>;
}
