import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {contractorUuidSchema,contractorMutationSchema} from '@/lib/customer/contractor-schema';
import {HEADERS,mapMaintenanceRpcError} from '@/lib/customer/maintenance-api-helper';
import {hasTrustedMutationOrigin} from '@/lib/security/same-origin';
import {isApplicationJson,parseJsonWithLimit} from '@/lib/security/request-body';
async function rpc(name:string,args:Record<string,unknown>){
 const client=await createClient();const {data:claims,error:authError}=await client.auth.getClaims();
 if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});
 const {data,error}=await (client.schema('customer_api') as any).rpc(name,args);
 if(error){if(error.code==='40001')return NextResponse.json({error:{code:'CONFLICT'}},{status:409,headers:HEADERS});const mapped=mapMaintenanceRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS});}
 return NextResponse.json(data,{headers:HEADERS});
}
export async function GET(request:NextRequest){
 const parsed=contractorUuidSchema.safeParse(request.nextUrl.searchParams.get('context_id'));
 if(!parsed.success)return NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:HEADERS});
 return rpc('list_contractors_v1',{p_context_id:parsed.data});
}
export async function POST(request:NextRequest){
 if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'BAD_ORIGIN'}},{status:403,headers:HEADERS});
 if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:HEADERS});
 const {data:body,errorResponse}=await parseJsonWithLimit<unknown>(request,10*1024);if(errorResponse)return errorResponse;
 const parsed=contractorMutationSchema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:HEADERS});
 const p=parsed.data;
 return p.action==='register'?rpc('register_contractor_v1',{p_context_id:p.context_id,p_id:p.id,p_name:p.name,p_category:p.category}):rpc('approve_contractor_v1',{p_context_id:p.context_id,p_vendor_id:p.vendor_id,p_reason:p.reason});
}
