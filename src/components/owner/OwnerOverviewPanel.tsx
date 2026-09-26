'use client';
import {useEffect,useState} from 'react';
import type {Language} from '@/types';
import type {ownerOverview} from '@/lib/owner-portfolio/overview';
type Overview=ReturnType<typeof ownerOverview>;
const copy={
  en:{title:'Portfolio overview',units:'Active units',leased:'Units with a current lease',monthly:'Current contractual monthly rent',income:'Received this month',expense:'Paid this month',owed:'Recorded overdue receivables',payable:'Recorded overdue payables',expiring:'Contracts ending within 60 days or awaiting closure',overdue:'Recorded overdue items',none:'No items to show.',note:'Self-reported records only. Currencies stay separate. Overdue totals include only unpaid items you recorded, not an automatically generated rent schedule. Official building balances are shown under each verified unit.',failed:'Unable to load the complete overview. Reload to retry.',loading:'Loading portfolio…',settle:'Record full payment',date:'Actual payment date',direction:'Direction',incomeLabel:'Receivable',expenseLabel:'Payable'},
  ro:{title:'Prezentare portofoliu',units:'Unități active',leased:'Unități cu contract în vigoare',monthly:'Chirie lunară contractuală curentă',income:'Încasat luna aceasta',expense:'Plătit luna aceasta',owed:'Creanțe restante înregistrate',payable:'Plăți restante înregistrate',expiring:'Contracte care expiră în 60 de zile sau necesită închidere',overdue:'Scadențe restante înregistrate',none:'Nu există înregistrări de afișat.',note:'Doar evidențe declarate de proprietar, separat pe monede. Restanțele includ doar sumele înregistrate și neplătite, nu un calendar de chirii generat automat. Soldurile oficiale sunt afișate pentru fiecare unitate verificată.',failed:'Prezentarea completă nu a putut fi încărcată. Reîncarcă pagina.',loading:'Se încarcă portofoliul…',settle:'Înregistrează plata integrală',date:'Data efectivă a plății',direction:'Direcție',incomeLabel:'De încasat',expenseLabel:'De plătit'},
  fa:{title:'نمای کلی املاک من',units:'واحدهای فعال',leased:'واحدهای دارای قرارداد جاری',monthly:'اجاره ماهانه طبق قراردادهای جاری',income:'دریافتی این ماه',expense:'پرداختی این ماه',owed:'مطالبات معوق ثبت‌شده',payable:'پرداخت‌های معوق ثبت‌شده',expiring:'قراردادهای رو به پایان تا ۶۰ روز یا نیازمند بستن',overdue:'سررسیدهای معوق ثبت‌شده',none:'موردی برای نمایش وجود ندارد.',note:'اطلاعات خوداظهاری و به تفکیک ارز است. معوقات فقط شامل موارد ثبت‌شده و پرداخت‌نشده است، نه برنامه خودکار اجاره. مانده رسمی ساختمان در بخش هر واحد تأییدشده نمایش داده می‌شود.',failed:'نمای کامل دریافت نشد؛ صفحه را دوباره بارگذاری کنید.',loading:'در حال دریافت نمای املاک…',settle:'ثبت پرداخت کامل',date:'تاریخ واقعی پرداخت',direction:'جهت',incomeLabel:'دریافتنی',expenseLabel:'پرداختنی'},
};
export function OwnerOverviewPanel({lang,revision,onChange}:{lang:Language;revision:unknown;onChange:()=>void}){
  const t=copy[lang];
  const [result,setResult]=useState<{revision:unknown;data:Overview|null;failed:boolean}|null>(null);
  const [saving,setSaving]=useState<string|null>(null);const [error,setError]=useState(false);
  useEffect(()=>{let active=true;void fetch('/api/owner-portfolio/v1/overview',{cache:'no-store',credentials:'same-origin'})
    .then(async r=>{if(!r.ok)throw Error('read');return r.json() as Promise<Overview>;})
    .then(data=>{if(active)setResult({revision,data,failed:false});})
    .catch(()=>{if(active)setResult({revision,data:null,failed:true});});return()=>{active=false;};},[revision]);
  const current=result?.revision===revision?result:null;
  const data=current?.data;
  if(current?.failed)return <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{t.failed}</p>;
  if(!data)return <p role="status" className="p-4">{t.loading}</p>;
  const unit=(id:string)=>{const u=data.units.find(x=>x.id===id);return u?`${u.building_label} · ${u.unit_label}`:id;};
  async function settle(event:React.FormEvent<HTMLFormElement>,id:string){
    event.preventDefault();setSaving(id);setError(false);
    const paid_on=new FormData(event.currentTarget).get('paid_on');
    try{const r=await fetch('/api/owner-portfolio/v1/cash',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({entry_id:id,paid_on})});if(!r.ok)throw Error('save');onChange();}catch{setError(true);}finally{setSaving(null);}
  }
  return <section aria-label={t.title} className="space-y-5"><div><h2 className="text-xl font-bold">{t.title}</h2><p className="mt-2 text-sm text-slate-600">{t.note}</p></div>
    <dl className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-teal-800 p-5 text-white"><dt>{t.units}</dt><dd className="mt-2 text-3xl font-bold">{data.unitCount}</dd></div><div className="rounded-2xl border bg-white p-5"><dt>{t.leased}</dt><dd className="mt-2 text-3xl font-bold">{data.leasedUnitCount}</dd></div></dl>
    <div className="grid gap-3 lg:grid-cols-3">{data.currencies.map(c=><section key={c.currency} className="rounded-2xl border bg-white p-5"><h3 className="font-bold text-teal-800">{c.currency}</h3><dl className="mt-3 space-y-2 text-sm">{(['monthlyRent','income','expense','overdueIncome','overdueExpense'] as const).map((key,i)=><div key={key} className="flex flex-wrap justify-between gap-2"><dt>{[t.monthly,t.income,t.expense,t.owed,t.payable][i]}</dt><dd dir="ltr" className="font-semibold">{c[key]}</dd></div>)}</dl></section>)}</div>
    <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">{t.expiring}</h3>{!data.expiring.length&&<p className="mt-3 text-sm">{t.none}</p>}<ul className="mt-3 max-h-96 space-y-3 overflow-auto">{data.expiring.map(l=><li key={l.id} className="border-b pb-3"><strong>{unit(l.unit_id)}</strong><p className="text-sm">{l.tenant_label} · <time>{l.ends_on}</time></p></li>)}</ul></section>
    <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">{t.overdue}</h3>{error&&<p role="alert" className="text-rose-800">{t.failed}</p>}{!data.overdue.length&&<p className="mt-3 text-sm">{t.none}</p>}<ul className="mt-3 max-h-96 space-y-4 overflow-auto">{data.overdue.map(e=><li key={e.id} className="border-b pb-3"><strong>{unit(e.unit_id)}</strong><p className="text-sm">{e.direction==='income'?t.incomeLabel:t.expenseLabel} · {e.amount} {e.currency} · {e.due_on}</p><form onSubmit={event=>void settle(event,e.id)} className="mt-2 flex flex-wrap items-end gap-2"><label className="text-xs">{t.date}<input name="paid_on" type="date" required max={data.today} className="mt-1 block max-w-full rounded border p-2"/></label><button disabled={saving!==null} className="rounded bg-teal-700 p-2 text-xs text-white disabled:opacity-50">{t.settle}</button></form></li>)}</ul></section></div></section>;
}
