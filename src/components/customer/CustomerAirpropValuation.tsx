'use client';
import { useEffect, useRef, useState } from 'react';
import type { Language } from '@/types';
import { valuationReadResponseV1Schema, type ValuationReadResponseV1 } from '@/lib/airprop/valuation-read-response-v1';

const copy={
 ro:{title:'Estimare de vânzare sau chirie',sale:'Vânzare',rent:'Chirie',refresh:'Verifică din nou',loading:'Se verifică disponibilitatea…',notReady:'Estimarea nu este încă disponibilă. Legătura cu proprietatea, accesul și datele autorizate trebuie verificate. Cere ajutor administratorului; nu este un preț calculat.',unavailable:'Rezultatul nu poate fi afișat. Verifică accesul și încearcă din nou.',insufficient:'Date insuficiente. Nu se afișează un preț; sunt necesare date comparabile autorizate.',review:'Rezultatul necesită verificare.',estimated:'Estimare orientativă',central:'Valoare centrală',date:'Data estimării',computed:'Calculată la',month:'pe lună',year:'pe an',limits:'Nu este o evaluare oficială și nu a fost validată pe piață. Nu publică un anunț, nu încheie un contract și nu efectuează o plată.',factors:'Calcul pe baza proprietăților comparabile; vânzarea și chiria se analizează separat.'},
 en:{title:'Sale or rent estimate',sale:'Sale',rent:'Rent',refresh:'Check again',loading:'Checking availability…',notReady:'An estimate is not ready. The property link, access and authorized data must be verified. Ask your administrator for help; no price has been calculated.',unavailable:'The result cannot be displayed. Check access and try again.',insufficient:'Insufficient data. No price is shown; authorized comparable data is needed.',review:'This result needs review.',estimated:'Indicative estimate',central:'Central value',date:'Valuation date',computed:'Calculated at',month:'per month',year:'per year',limits:'This is not an official appraisal and has not been market validated. It does not publish a listing, create a contract or make a payment.',factors:'Calculated from comparable properties; sale and rent are assessed independently.'},
 fa:{title:'برآورد فروش یا اجاره',sale:'فروش',rent:'اجاره',refresh:'بررسی دوباره',loading:'در حال بررسی دسترسی…',notReady:'برآورد هنوز آماده نیست. ارتباط ملک، اختیار و دادهٔ مجاز باید بررسی شود. از مدیر کمک بگیرید؛ قیمتی محاسبه نشده است.',unavailable:'نمایش نتیجه ممکن نیست. دسترسی را بررسی و دوباره تلاش کنید.',insufficient:'داده ناکافی است. قیمتی نمایش داده نمی‌شود؛ دادهٔ مقایسه‌ای مجاز لازم است.',review:'این نتیجه نیازمند بررسی است.',estimated:'برآورد راهنما',central:'مقدار مرکزی',date:'تاریخ برآورد',computed:'زمان محاسبه',month:'در ماه',year:'در سال',limits:'این برآورد رسمی یا اعتبارسنجی‌شده در بازار نیست. آگهی، قرارداد یا پرداخت ایجاد نمی‌کند.',factors:'محاسبه بر پایهٔ ملک‌های قابل مقایسه است؛ فروش و اجاره جدا بررسی می‌شوند.'},
};
type Props={contextId:string;workspaceId:string;opportunityId:string;lang:Language};
export function CustomerAirpropValuation(props:Props){
 return <Valuation key={`${props.contextId}:${props.workspaceId}:${props.opportunityId}`} {...props}/>;
}
function Valuation({contextId,workspaceId,opportunityId,lang}:Props){
 const t=copy[lang];
 const [purpose,setPurpose]=useState<'sale_estimate'|'rental_recommendation'>('sale_estimate');
 const [view,setView]=useState<ValuationReadResponseV1|null>(null),[loading,setLoading]=useState(false);
 const epoch=useRef(0),abort=useRef<AbortController|null>(null);
 useEffect(()=>()=>{epoch.current++;abort.current?.abort();},[]);
 function change(next:typeof purpose){epoch.current++;abort.current?.abort();setView(null);setLoading(false);setPurpose(next);}
 async function read(){
  const ticket=++epoch.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;
  setView(null);setLoading(true);
  try{
   const query=new URLSearchParams({context_id:contextId,workspace_id:workspaceId,opportunity_id:opportunityId,purpose});
   const response=await fetch(`/api/customer/v2/airprop/valuation?${query}`,{method:'GET',cache:'no-store',signal:controller.signal});
   const body=valuationReadResponseV1Schema.parse(await response.json());
   if(body.state==='RESULT'&&(!response.ok||body.transaction_kind!==(purpose==='sale_estimate'?'sale':'rent')))throw new Error('unavailable');
   if(ticket===epoch.current&&!controller.signal.aborted)setView(body);
  }catch{if(ticket===epoch.current&&!controller.signal.aborted)setView({contract:'airprop-valuation-read.v1',state:'UNAVAILABLE'});}
  finally{if(ticket===epoch.current&&!controller.signal.aborted)setLoading(false);}
 }
 const result=view?.state==='RESULT'?view:null;
 return <section className="space-y-3 rounded border p-4" dir={lang==='fa'?'rtl':'ltr'} aria-label={t.title}>
  <h2 className="text-xl font-semibold">{t.title}</h2>
  <div className="flex flex-wrap gap-3"><label>{t.title}<select className="mx-2 rounded border p-2" value={purpose} onChange={e=>change(e.target.value as typeof purpose)}><option value="sale_estimate">{t.sale}</option><option value="rental_recommendation">{t.rent}</option></select></label><button type="button" className="rounded border px-3 py-2" onClick={()=>void read()}>{t.refresh}</button></div>
  <p role="status" aria-live="polite">{loading?t.loading:view?.state==='UNAVAILABLE'?t.unavailable:result?result.outcome==='insufficient_data'?t.insufficient:result.outcome==='review_required'?t.review:t.estimated:t.notReady}</p>
  {result&&<div><p>{t.date}: <time dateTime={result.as_of}>{result.as_of}</time></p><p>{t.computed}: <time dateTime={result.computed_at}>{result.computed_at}</time></p>{result.range&&<p dir="ltr">{result.range.low} – {result.range.high} {result.currency}; {t.central}: {result.range.central} {result.currency} {result.rental_period==='month'?t.month:result.rental_period==='year'?t.year:''}</p>}{result.range&&<p>{t.factors}</p>}</div>}
  <p>{t.limits}</p>
 </section>;
}
