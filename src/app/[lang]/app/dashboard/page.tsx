import {notFound,redirect} from 'next/navigation';
import Link from 'next/link';
import {CustomerDashboard} from '@/components/customer/CustomerDashboard';
import {isSupportedLocale} from '@/types';
import {createClient} from '@/lib/supabase/server';
export default async function DashboardPage({params}:{params:Promise<{lang:string}>}){
  const{lang}=await params;
  if(!isSupportedLocale(lang))notFound();
  const db=await createClient();
  const {data:pending,error}=await db.schema('customer_api').rpc('list_my_unit_invitations_v1' as never);
  const hasPending=!error&&Array.isArray(pending as unknown)&&(pending as unknown[]).length>0;
  if(hasPending){
    const {data:contexts}=await db.schema('customer_api').rpc('list_contexts_v1');
    if(Array.isArray(contexts)&&contexts.length===0)redirect(`/${lang}/invitation-continuation`);
  }
  return <>{hasPending&&<div className="mx-auto max-w-5xl rounded border border-teal-300 bg-teal-50 p-4" dir={lang==='fa'?'rtl':'ltr'}>
    <p>{lang==='fa'?'دعوت تازه‌ای برای یکی از واحدها دارید. نقش‌های فعلی شما فعال می‌مانند.':lang==='ro'?'Aveți o invitație nouă pentru o unitate. Rolurile existente rămân active.':'You have a new unit invitation. Your existing roles remain active.'}</p>
    <Link className="font-semibold text-teal-800 underline" href={`/${lang}/invitation-continuation`}>{lang==='fa'?'بررسی و پذیرش دعوت':lang==='ro'?'Vedeți invitația':'Review invitation'}</Link>
  </div>}<CustomerDashboard lang={lang}/></>;
}
