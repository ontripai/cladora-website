import {notFound} from 'next/navigation';
import {getPlatformAuthContext} from '@/lib/platform/auth';
import {isSupportedLocale} from '@/types';
import {DashboardLab} from '@/components/dashboard-lab/DashboardLab';
import {isLabRole} from '@/lib/dashboard-lab/catalog';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function DashboardLabPage({params,searchParams}:{params:Promise<{lang:string}>;searchParams:Promise<{role?:string}>}){
 const {lang}=await params;if(!isSupportedLocale(lang))notFound();
 const auth=await getPlatformAuthContext();
 if(!auth.isAuthorized||auth.assuranceLevel!=='aal2'||!auth.roles.includes('PLATFORM_SUPER_ADMIN'))notFound();
 const {role}=await searchParams;
 return <DashboardLab lang={lang} initialRole={role&&isLabRole(role)?role:undefined}/>;
}
