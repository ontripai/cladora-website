'use client';
import { useState } from 'react';
import type { Language } from '@/types';

const copy={
 fa:{title:'دعوت تأییدکنندهٔ مستقل پایلوت',workspace:'شناسهٔ ورک‌اسپیس پایلوت',email:'ایمیل تأییدکننده',reason:'دلیل دسترسی',send:'ارسال دعوت محدود',sent:'دعوت ارسال شد. تأییدکننده باید ورود و MFA را تکمیل کند.',error:'دعوت انجام نشد؛ شناسه، وضعیت پایلوت و حساب را بررسی کنید.'},
 ro:{title:'Invită revizorul independent al pilotului',workspace:'ID spațiu pilot',email:'E-mail revizor',reason:'Motivul accesului',send:'Trimite invitația limitată',sent:'Invitație trimisă. Revizorul trebuie să finalizeze autentificarea și MFA.',error:'Invitația a eșuat; verifică spațiul și contul.'},
 en:{title:'Invite independent pilot reviewer',workspace:'Pilot workspace ID',email:'Reviewer email',reason:'Access reason',send:'Send limited invitation',sent:'Invitation sent. Reviewer must complete sign-in and MFA.',error:'Invitation failed; verify workspace and account.'},
};
export function PilotReviewerInvite({lang}:{lang:Language}){
 const t=copy[lang];const [workspace,setWorkspace]=useState('');const [email,setEmail]=useState('');const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage('');try{
 const response=await fetch(`/api/platform/v1/workspaces/${encodeURIComponent(workspace)}/pilot-reviewer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,reason,lang})});
 setMessage(response.ok?t.sent:`${t.error} (${(await response.json())?.error?.code ?? response.status})`);
 }catch{setMessage(t.error)}finally{setBusy(false)}}
 return <form onSubmit={submit} className="space-y-3 rounded-xl border border-emerald-500/30 bg-[#102A43] p-5 text-white" dir={lang==='fa'?'rtl':'ltr'}><h2 className="font-bold">{t.title}</h2><div className="grid gap-3 sm:grid-cols-2"><label>{t.workspace}<input required pattern="[0-9a-fA-F-]{36}" value={workspace} onChange={e=>setWorkspace(e.target.value)} className="block w-full rounded bg-white p-2 text-slate-900"/></label><label>{t.email}<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="block w-full rounded bg-white p-2 text-slate-900"/></label></div><label>{t.reason}<textarea required minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} className="block w-full rounded bg-white p-2 text-slate-900"/></label><button disabled={busy} className="rounded bg-emerald-500 px-4 py-2 font-bold text-slate-950 disabled:opacity-50">{t.send}</button>{message&&<p role="status">{message}</p>}</form>;
}
