import {notFound} from 'next/navigation';
import {isSupportedLocale} from '@/types';
import {getPlatformAuthContext} from '@/lib/platform/auth';
import {ModuleRegistryPanel} from '@/components/platform/ModuleRegistryPanel';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function ModuleRegistryPage({params}:{params:Promise<{lang:string}>}){
 const{lang}=await params;if(!isSupportedLocale(lang))notFound();const auth=await getPlatformAuthContext();
 if(!auth.isAuthorized||auth.assuranceLevel!=='aal2'||!auth.roles.includes('PLATFORM_SUPER_ADMIN'))notFound();
 return <ModuleRegistryPanel lang={lang}/>;
}
