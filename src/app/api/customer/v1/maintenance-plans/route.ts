import {NextRequest,NextResponse} from 'next/server';
import {maintenanceUuidSchema} from '@/lib/customer/maintenance-schema';
import {createClient} from '@/lib/supabase/server';
import {HEADERS,mapMaintenanceRpcError} from '@/lib/customer/maintenance-api-helper';
import {legacyOperationsMutationClosed} from '@/lib/customer/operations-command-server';
async function rpc(name:string,params:Record<string,unknown>){
 const client=await createClient();const{data:claims,error:authError}=await client.auth.getClaims();
 if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});
 const{data,error}=await (client.schema('customer_api') as any).rpc(name,params);
 if(error){if(error.code==='40001')return NextResponse.json({error:{code:'REVISION_CONFLICT'}},{status:409,headers:HEADERS});const mapped=mapMaintenanceRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS});}
 return NextResponse.json(data,{headers:HEADERS});
}
export async function GET(request:NextRequest){const context=maintenanceUuidSchema.safeParse(request.nextUrl.searchParams.get('context_id'));if(!context.success)return NextResponse.json({error:{code:'INVALID_CONTEXT'}},{status:400,headers:HEADERS});return rpc('list_calendar_plans_v1',{p_context_id:context.data});}
export const POST=legacyOperationsMutationClosed;
