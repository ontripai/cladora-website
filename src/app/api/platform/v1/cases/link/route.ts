import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { buildingSetupIdSchema } from '@/lib/customer/building-setup-schema';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
import { createClient } from '@/lib/supabase/server';

const HEADERS={'Cache-Control':'no-store, private', Vary:'Cookie'};
export async function POST(request:NextRequest){
  const auth=await getPlatformAuthContext();
  if(!hasPlatformAal2(auth)||!hasPlatformRole(auth,['PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS']))
    return NextResponse.json({error:{code:'FORBIDDEN'}},{status:403,headers:HEADERS});
  if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'UNTRUSTED_ORIGIN'}},{status:403,headers:HEADERS});
  if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:HEADERS});
  const {data:body,errorResponse}=await parseJsonWithLimit<unknown>(request,8*1024);
  if(errorResponse)return errorResponse;
  const parsed=z.object({case_id:buildingSetupIdSchema,workspace_id:buildingSetupIdSchema,contract_id:buildingSetupIdSchema.nullable(),reason:z.string().trim().min(8).max(500)}).strict().safeParse(body);
  if(!parsed.success)return NextResponse.json({error:{code:'INVALID_INPUT'}},{status:400,headers:HEADERS});
  const db=await createClient();
  const {data,error}=await db.schema('customer_api').rpc('link_customer_case_workspace_v1',{p_case_id:parsed.data.case_id,p_workspace_id:parsed.data.workspace_id,p_contract_id:parsed.data.contract_id,p_reason:parsed.data.reason});
  if(error)return NextResponse.json({error:{code:'APPROVED_ACCESS_BASIS_REQUIRED'}},{status:403,headers:HEADERS});
  if(!data)return NextResponse.json({error:{code:'LINK_RESULT_UNAVAILABLE'}},{status:502,headers:HEADERS});
  return NextResponse.json({link:data},{headers:HEADERS});
}
