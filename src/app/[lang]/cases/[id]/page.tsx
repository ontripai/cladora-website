import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupportedLocale } from '@/types';
import { CaseConversation, type CaseDetail, type CaseDocument } from '@/components/cases/CasePortal';
import { getPlatformAuthContext, hasPlatformRole } from '@/lib/platform/auth';
import type { CaseStaffOption } from '@/components/cases/CasePortal';

export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
function activeStaffOptions(users:{id:string;display_name:string}[],roles:{platform_user_id:string;role:string;valid_from:string;valid_until:string|null}[]):CaseStaffOption[]{
  const current=Date.now();const lookup=new Map(users.map(u=>[u.id,u.display_name]));
  return roles.filter(role=>lookup.has(role.platform_user_id)&&new Date(role.valid_from).getTime()<=current&&(!role.valid_until||new Date(role.valid_until).getTime()>current)).map(role=>({id:role.platform_user_id,name:lookup.get(role.platform_user_id)!,role:role.role}));
}
export default async function CasePage({params}:{params:Promise<{lang:string;id:string}>}) {
  const {lang,id}=await params;
  if(!isSupportedLocale(lang))redirect('/ro/login');
  const db=await createClient();const {data:claims,error}=await db.auth.getClaims();
  if(error||!claims?.claims?.sub)redirect(`/${lang}/login?next=cases`);
  const {data:assurance}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2')redirect(`/${lang}/mfa?next=cases`);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))redirect(`/${lang}/cases`);
  const {data,error:caseError}=await db.schema('customer_api').rpc('get_customer_case_v1',{p_case_id:id});
  if(caseError||!data)redirect(`/${lang}/cases`);
  const detail=data as unknown as CaseDetail;
  const {data:documents,error:documentsError}=await db.schema('customer_api').rpc('get_customer_case_documents_v1',{p_case_id:id});
  if(documentsError)throw documentsError;
  const auth=detail.staff_view?await getPlatformAuthContext():null;
  const manager=auth?hasPlatformRole(auth,['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS']):false;
  let staff:CaseStaffOption[]=[];
  if(manager){
    const [users,roles]=await Promise.all([
      db.schema('customer_api').from('platform_users_v1').select('id,display_name,status,deactivated_at').eq('status','active').is('deactivated_at',null),
      db.schema('customer_api').from('platform_role_assignments_v1').select('platform_user_id,role,status,valid_from,valid_until').eq('status','active'),
    ]);
    if(users.error||roles.error)throw users.error??roles.error;
    staff=activeStaffOptions(users.data??[],roles.data??[]);
  }
  return <CaseConversation lang={lang} detail={detail} documents={documents as unknown as CaseDocument[]} userId={claims.claims.sub}
    manager={manager} staffOptions={staff}
    reviewer={auth?hasPlatformRole(auth,['PLATFORM_SUPER_ADMIN','PLATFORM_AUDITOR']):false} />;
}
