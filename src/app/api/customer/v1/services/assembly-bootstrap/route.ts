import {NextRequest,NextResponse} from 'next/server';
import {coreServiceAppReadV1} from '@/lib/core/service-app-read-v1';
export async function GET(request:NextRequest){
 return await coreServiceAppReadV1(request,'selections')??NextResponse.json({error:{code:'CORE_SERVICE_ASSEMBLY_NOT_READY'}},{status:503,headers:{'Cache-Control':'no-store, private',Vary:'Cookie'}});
}
