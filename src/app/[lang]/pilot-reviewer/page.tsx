import { redirect } from 'next/navigation';
import { isSupportedLocale } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { PilotReviewerPanel } from '@/components/customer/PilotReviewerPanel';

export const dynamic='force-dynamic';
export default async function PilotReviewerPage({params}:{params:Promise<{lang:string}>}){
 const {lang}=await params;
 if(!isSupportedLocale(lang))redirect('/ro/login');
 const supabase=await createClient();
 const {data}=await supabase.auth.getClaims();
 if(!data?.claims)redirect(`/${lang}/login`);
 return <main className="mx-auto max-w-2xl p-6"><PilotReviewerPanel lang={lang}/></main>;
}
