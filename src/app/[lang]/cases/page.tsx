import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupportedLocale } from '@/types';
import { CasePortal, type CaseInvitation, type CaseListing } from '@/components/cases/CasePortal';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function CasesPage({params}:{params:Promise<{lang:string}>}) {
  const {lang}=await params;
  if(!isSupportedLocale(lang))redirect('/ro/login');
  const db=await createClient();const {data:claims,error}=await db.auth.getClaims();
  if(error||!claims?.claims?.sub)redirect(`/${lang}/login?next=cases`);
  const {data:assurance}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')redirect(`/${lang}/mfa?next=cases`);
  const [invites,cases]=await Promise.all([
    db.schema('customer_api').rpc('my_case_invitations_v1'),db.schema('customer_api').rpc('my_customer_cases_v1'),
  ]);
  if(invites.error||cases.error)throw invites.error??cases.error;
  return <CasePortal lang={lang} invitations={invites.data as unknown as CaseInvitation[]} cases={cases.data as unknown as CaseListing[]} />;
}
