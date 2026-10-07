import { redirect } from 'next/navigation';
import { AccountSecurityPanel } from '@/components/auth/AccountSecurityPanel';
import { OnboardingCompletionForm } from '@/components/auth/OnboardingCompletionForm';
import { createClient } from '@/lib/supabase/server';
import { isSupportedLocale } from '@/types';

export default async function OnboardingPage({ params, searchParams }: { params: Promise<{lang:string}>; searchParams: Promise<{workspace?:string}> }) {
  const {lang}=await params; if(!isSupportedLocale(lang)) redirect('/ro/login');
  const query=await searchParams;
  if(!query.workspace || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.workspace)) redirect(`/${lang}/app/dashboard`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('customer_api')
    .rpc('get_my_primary_admin_onboarding_v1', { p_workspace_id: query.workspace });
  const state = Array.isArray(data) ? data[0] : data;
  if (error || !state) {
    const message = {
      fa: 'اطلاعات راه‌اندازی دریافت نشد. با حساب مدیر اصلی وارد شوید و این صفحه را دوباره بارگذاری کنید. نیازی به ثبت دوبارهٔ دسترسی نیست.',
      ro: 'Datele de configurare nu au putut fi încărcate. Folosește contul administratorului principal și reîncarcă pagina. Nu înregistra din nou accesul.',
      en: 'Setup information could not be loaded. Use the primary administrator account and reload this page. Do not register access again.',
    };
    return <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-slate-900">{message[lang]}</p>;
  }

  return <div className="grid gap-6 lg:grid-cols-2"><OnboardingCompletionForm lang={lang} workspaceId={state.customer_workspace_id} version={state.workspace_version} completed={state.onboarding_completed}/><AccountSecurityPanel lang={lang}/></div>;
}
