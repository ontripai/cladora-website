'use client';
import {useEffect,useRef,useState} from 'react';
import type {Language} from '@/types';
import type {GuideActionsV1} from '@/lib/community/experience-guide-actions-client';
const copy={
 en:{reason:'Reason for cancellation (5–500 characters)',publish:'Publish this version',cancel:'Cancel this guide',confirmPublish:'Publish the saved guide version to its authorized audience?',confirmCancel:'Cancel this guide? Its version history is retained.',unknown:'The result is unknown. Retry only the same action; reading the guide does not confirm the command.',retry:'Retry the same action',error:'The action could not be confirmed.',draft:'Save or resolve the current draft before this action.',busy:'Sending…'},
 ro:{reason:'Motivul anulării (5–500 de caractere)',publish:'Publică această versiune',cancel:'Anulează ghidul',confirmPublish:'Publici versiunea salvată pentru publicul autorizat?',confirmCancel:'Anulezi ghidul? Istoricul versiunilor se păstrează.',unknown:'Rezultatul este necunoscut. Reîncearcă doar aceeași acțiune; citirea ghidului nu confirmă comanda.',retry:'Reîncearcă aceeași acțiune',error:'Acțiunea nu a putut fi confirmată.',draft:'Salvează sau clarifică ciorna curentă înainte de această acțiune.',busy:'Se trimite…'},
 fa:{reason:'دلیل لغو (۵ تا ۵۰۰ نویسه)',publish:'انتشار همین نسخه',cancel:'لغو راهنما',confirmPublish:'نسخهٔ ذخیره‌شده برای مخاطبان مجاز منتشر شود؟',confirmCancel:'راهنما لغو شود؟ تاریخچهٔ نسخه‌ها حفظ می‌شود.',unknown:'نتیجه نامعلوم است؛ فقط همین اقدام را دوباره امتحان کنید. خواندن راهنما تأیید اجرای فرمان نیست.',retry:'تلاش دوباره برای همین اقدام',error:'نتیجهٔ اقدام تأیید نشد.',draft:'ابتدا پیش‌نویس فعلی را ذخیره یا وضعیت نامعلوم آن را روشن کنید.',busy:'در حال ارسال…'},
} as const;
export function CustomerExperienceGuideActions({lang,status,commands,hasDraft,onChanged,onPending}:{lang:Language;status:'draft'|'published'|'cancelled';commands:GuideActionsV1;hasDraft:()=>boolean;onChanged:()=>void;onPending:()=>void}){
 const t=copy[lang],mounted=useRef(false),flight=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState(''),[uncertain,setUncertain]=useState(commands.isUncertain());
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;commands.invalidate();};},[commands]);
 async function run(operation:'publish'|'cancel'){if(flight.current)return;if(!commands.isUncertain()&&hasDraft()){setError(t.draft);return;}
  if(operation==='cancel'&&!commands.isUncertain()&&(reason.trim().length<5||reason.trim().length>500)){setError(t.reason);return;}
  if(!commands.isUncertain()&&!window.confirm(operation==='publish'?t.confirmPublish:t.confirmCancel))return;
  flight.current=true;setBusy(true);setError('');try{const task=commands.run(operation,commands.isUncertain()?undefined:reason);onPending();await task;if(mounted.current){setUncertain(false);onChanged();}}
  catch{if(mounted.current){setUncertain(commands.isUncertain());setError(commands.isUncertain()?t.unknown:t.error);}}
  finally{flight.current=false;if(mounted.current){setBusy(false);onPending();}}}
 if(status==='cancelled'&&!uncertain)return null;
 return <div dir={lang==='fa'?'rtl':'ltr'} className="space-y-3 rounded-xl border p-4"><p role="status" aria-live="polite">{busy?t.busy:''}</p>{error?<p role="alert">{error}</p>:null}
  {!uncertain?<label className="block text-sm">{t.reason}<input name="guide-cancel-reason" minLength={5} maxLength={500} disabled={busy} value={reason} onChange={e=>setReason(e.target.value)} className="block w-full rounded-lg border p-2"/></label>:null}
  {uncertain?<button disabled={busy} onClick={()=>void run(commands.pendingOperation()!)}>{t.retry}</button>:<div className="flex flex-wrap gap-3">
   {status==='draft'?<button disabled={busy} onClick={()=>void run('publish')}>{t.publish}</button>:null}<button disabled={busy} onClick={()=>void run('cancel')}>{t.cancel}</button>
  </div>}
 </div>;
}
