import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {HEADERS,mapMaintenanceRpcError} from '@/lib/customer/maintenance-api-helper';
import {hasTrustedMutationOrigin} from '@/lib/security/same-origin';
import {isApplicationJson,parseJsonWithLimit} from '@/lib/security/request-body';
const date=z.iso.date();
const save=z.object({action:z.literal('save'),context_id:z.uuid(),id:z.uuid(),revision:z.number().int().min(0),asset_id:z.uuid(),vendor_id:z.uuid(),name:z.string().trim().min(1).max(200),anchor:date,unit:z.enum(['days','weeks','months','years']),every:z.number().int().min(1).max(120),enabled:z.boolean(),checklist:z.array(z.string().trim().min(1).max(200)).max(50)}).strict();
const generate=z.object({action:z.literal('generate'),context_id:z.uuid(),plan_id:z.uuid(),due_on:date}).strict();
const mutation=z.discriminatedUnion('action',[save,generate]);
async function rpc(name:string,params:Record<string,unknown>){
 const client=await createClient();const{data:claims,error:authError}=await client.auth.getClaims();
 if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});
 const{data,error}=await (client.schema('customer_api') as any).rpc(name,params);
 if(error){if(error.code==='40001')return NextResponse.json({error:{code:'REVISION_CONFLICT'}},{status:409,headers:HEADERS});const mapped=mapMaintenanceRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS});}
 return NextResponse.json(data,{headers:HEADERS});
}
export async function GET(request:NextRequest){const context=z.uuid().safeParse(request.nextUrl.searchParams.get('context_id'));if(!context.success)return NextResponse.json({error:{code:'INVALID_CONTEXT'}},{status:400,headers:HEADERS});return rpc('list_calendar_plans_v1',{p_context_id:context.data});}
export async function POST(request:NextRequest){
 if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'BAD_ORIGIN'}},{status:403,headers:HEADERS});
 if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:HEADERS});
 const{data,errorResponse}=await parseJsonWithLimit<unknown>(request,20*1024);if(errorResponse)return errorResponse;
 const parsed=mutation.safeParse(data);if(!parsed.success)return NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:HEADERS});
 const p=parsed.data;
 if(p.action==='generate')return rpc('generate_calendar_order_v1',{p_context_id:p.context_id,p_plan_id:p.plan_id,p_due_on:p.due_on});
 return rpc('save_calendar_plan_v1',{p_context_id:p.context_id,p_id:p.id,p_revision:p.revision,p_asset_id:p.asset_id,p_vendor_id:p.vendor_id,p_name:p.name,p_anchor:p.anchor,p_unit:p.unit,p_every:p.every,p_enabled:p.enabled,p_checklist:p.checklist});
}
