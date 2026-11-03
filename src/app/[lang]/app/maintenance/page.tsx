import {notFound} from 'next/navigation';
import {CustomerMaintenanceDashboard} from '@/components/customer/CustomerMaintenanceDashboard';
import {maintenanceUuidSchema} from '@/lib/customer/maintenance-schema';
import {isSupportedLocale} from '@/types';

export default async function MaintenancePage({params,searchParams}:{
 params:Promise<{lang:string}>;
 searchParams?:Promise<{view?:string|string[];work_order?:string|string[]}>;
}){
 const {lang}=await params;
 if(!isSupportedLocale(lang))notFound();
 const query=(await searchParams)??{};
 const order=query.work_order===undefined?undefined:maintenanceUuidSchema.safeParse(query.work_order);
 if(order&&!order.success)notFound();
 const views=['assets','components','plans','work_orders','tasks','vendors','sla','costs','history'] as const;
 const requested=typeof query.view==='string'&&views.includes(query.view as typeof views[number])?query.view as typeof views[number]:'work_orders';
 return <CustomerMaintenanceDashboard lang={lang} initialView={order?.data?'work_orders':requested} initialWorkOrderId={order?.data}/>;
}
