import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {maintenanceUuidSchema} from '@/lib/customer/maintenance-schema';
import {HEADERS,mapMaintenanceRpcError} from '@/lib/customer/maintenance-api-helper';
import {hasTrustedMutationOrigin} from '@/lib/security/same-origin';
import {isApplicationJson,parseJsonWithLimit} from '@/lib/security/request-body';
const read=z.object({context_id:maintenanceUuidSchema}).strict();
const write=read.extend({item_id:maintenanceUuidSchema,notes:z.string().trim().min(10).max(2000)}).strict();
type Params={params:Promise<{id:string}>};
async function call(id:string,p:{context_id:string;item_id?:string;notes?:string}){
 const supabase=await createClient();const {data:claims,error:authError}=await supabase.auth.getClaims();
 if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});
 const {data,error}=await (supabase.schema('customer_api') as any).rpc('work_order_checklist_v1',{p_context_id:p.context_id,p_work_order_id:id,p_item_id:p.item_id??null,p_notes:p.notes??null});
 if(error){if(error.code==='40001')return NextResponse.json({error:{code:'CONFLICT'}},{status:409,headers:HEADERS});const mapped=mapMaintenanceRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS})}
 return NextResponse.json(data,{headers:HEADERS});
}
const invalid=()=>NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:HEADERS});
export async function GET(request:NextRequest,{params}:Params){const {id}=await params;const parsed=read.safeParse(Object.fromEntries(request.nextUrl.searchParams));return maintenanceUuidSchema.safeParse(id).success&&parsed.success?call(id,parsed.data):invalid()}
export async function POST(request:NextRequest,{params}:Params){
 if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'BAD_ORIGIN'}},{status:403,headers:HEADERS});
 if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:HEADERS});
 const {id}=await params;if(!maintenanceUuidSchema.safeParse(id).success)return invalid();
 const {data,errorResponse}=await parseJsonWithLimit<unknown>(request,10*1024);if(errorResponse)return errorResponse;
 const parsed=write.safeParse(data);return parsed.success?call(id,parsed.data):invalid();
}
