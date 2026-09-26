import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupportedLocale } from '@/types';
import { SignOutButton } from '@/components/auth/SignOutButton';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
const copy = {
  fa: {title:'انتخاب محیط کار',intro:'هر محیط فقط دسترسی‌های مربوط به همان نقش را دارد.',owner:'مدیریت املاک من',ownerText:'واحدها، قراردادهای اجاره و حساب‌های شخصی',platform:'مدیریت پلتفرم',platformText:'وظایف داخلی و پرونده‌های مشتریان',building:'محیط ساختمان',buildingText:'نقش‌ها و ساختمان‌های مجاز شما',cases:'پرونده‌ها و درخواست‌ها',empty:'هنوز محیط فعالی ندارید. وضعیت درخواست را در پرونده‌ها بررسی کنید.',failed:'بررسی دسترسی‌ها ناموفق بود؛ صفحه را دوباره بارگذاری کنید.'},
  ro: {title:'Alege spațiul de lucru',intro:'Fiecare spațiu păstrează propriile permisiuni.',owner:'Proprietățile mele',ownerText:'Unități, contracte de închiriere și evidențe private',platform:'Administrarea platformei',platformText:'Responsabilități interne și dosare clienți',building:'Spațiul clădirii',buildingText:'Clădirile și rolurile la care ai acces',cases:'Dosare și cereri',empty:'Nu ai încă un spațiu activ. Verifică starea cererii în dosare.',failed:'Accesul nu a putut fi verificat. Reîncarcă pagina.'},
  en: {title:'Choose your workspace',intro:'Each workspace keeps its own permissions.',owner:'My properties',ownerText:'Units, rental contracts and private records',platform:'Platform management',platformText:'Internal responsibilities and customer cases',building:'Building workspace',buildingText:'Your authorized buildings and roles',cases:'Cases and requests',empty:'You have no active workspace yet. Check your request in Cases.',failed:'Unable to verify access. Reload the page.'},
};
export default async function AccountPage({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{choose?:string}>}) {
  const {lang}=await params;
  if(!isSupportedLocale(lang)) redirect('/ro/login');
  const t=copy[lang]; const db=await createClient();
  const {data:claims,error}=await db.auth.getClaims();
  if(error||!claims?.claims?.sub) redirect(`/${lang}/login?next=account`);
  const {data:aal,error:aalError}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aalError||!aal) redirect(`/${lang}/login?reason=security`);
  if(aal.currentLevel!=='aal2') redirect(`/${lang}/mfa`);
  const [platform,owner,contexts]=await Promise.all([
    db.schema('customer_api').rpc('has_platform_access_v1'),
    db.schema('customer_api').rpc('my_multi_unit_owner_access_v1' as never),
    db.schema('customer_api').rpc('list_contexts_v1'),
  ]);
  if(platform.error||owner.error||contexts.error) return <main className="mx-auto max-w-3xl p-8" dir={lang==='fa'?'rtl':'ltr'}><h1 className="text-2xl font-bold">{t.title}</h1><p role="alert" className="mt-4">{t.failed}</p></main>;
  const choices=[
    ...(owner.data===true?[{href:`/${lang}/owner-portfolio`,title:t.owner,text:t.ownerText}]:[]),
    ...(platform.data===true?[{href:`/${lang}/platform/overview`,title:t.platform,text:t.platformText}]:[]),
    ...(Array.isArray(contexts.data)&&contexts.data.length?[{href:`/${lang}/app/dashboard`,title:t.building,text:t.buildingText}]:[]),
  ];
  if(choices.length===1&&(await searchParams).choose!=='1') redirect(choices[0].href);
  return <main dir={lang==='fa'?'rtl':'ltr'} className="mx-auto max-w-4xl space-y-6 p-6 sm:p-10"><header className="flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-bold text-slate-900">{t.title}</h1><p className="mt-3 text-slate-600">{t.intro}</p></div><div className="flex items-center gap-3">{(['ro','en','fa'] as const).map(locale=><Link key={locale} href={`/${locale}/account?choose=1`} hrefLang={locale} className="text-sm underline">{locale==='fa'?'فارسی':locale==='ro'?'Română':'English'}</Link>)}<SignOutButton lang={lang}/></div></header><div className="grid gap-4 sm:grid-cols-2">{choices.map(c=><Link key={c.href} href={c.href} className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm hover:border-teal-700 focus-visible:outline-teal-700"><h2 className="text-xl font-bold text-teal-800">{c.title}</h2><p className="mt-2 text-slate-600">{c.text}</p></Link>)}</div>{!choices.length&&<p>{t.empty}</p>}<Link href={`/${lang}/cases`} className="inline-block text-teal-800 underline">{t.cases}</Link></main>;
}
