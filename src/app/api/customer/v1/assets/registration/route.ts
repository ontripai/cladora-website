import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {assetUuidSchema,registerEquipmentSchema} from '@/lib/customer/assets-schema';
import {HEADERS,mapAssetsRpcError} from '@/lib/customer/assets-api-helper';
import {hasTrustedMutationOrigin} from '@/lib/security/same-origin';
import {isApplicationJson,parseJsonWithLimit} from '@/lib/security/request-body';
export async function GET(request:NextRequest){
 const parsed=assetUuidSchema.safeParse(request.nextUrl.searchParams.get('context_id'));
 if(!parsed.success)return NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:HEADERS});
 const client=await createClient();const {data:claims,error:authError}=await client.auth.getClaims();
 if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});
 const {data,error}=await (client.schema('customer_api') as any).rpc('get_asset_registration_choices_v1',{p_context_id:parsed.data});
 if(error){const mapped=mapAssetsRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS});}
 return NextResponse.json(data,{headers:HEADERS});
}
export async function POST(request:NextRequest){
 if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'BAD_ORIGIN'}},{status:403,headers:HEADERS});
 if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:HEADERS});
 const {data:body,errorResponse}=await parseJsonWithLimit<unknown>(request,10*1024);if(errorResponse)return errorResponse;
 const parsed=registerEquipmentSchema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:HEADERS});
 const client=await createClient();const {data:claims,error:authError}=await client.auth.getClaims();
 if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});
 const p=parsed.data;const {data,error}=await (client.schema('customer_api') as any).rpc('register_equipment_v1',{p_context_id:p.context_id,p_property_id:p.property_id,p_building_id:p.building_id,p_category_code:p.category_code,p_asset_code:p.asset_code,p_name:p.name});
 if(error){const mapped=mapAssetsRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS});}
 return NextResponse.json(data,{headers:HEADERS});
}
