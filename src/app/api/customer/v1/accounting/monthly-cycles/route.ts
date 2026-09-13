import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMonthlyCycleSchema, monthlyCycleListQuerySchema } from '@/lib/customer/monthly-cycle-schema';
import { mapMonthlyCycleError, MONTHLY_CYCLE_HEADERS } from '@/lib/customer/monthly-cycle-api-helper';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

export async function GET(request: NextRequest) {
  const parsed=monthlyCycleListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if(!parsed.success)return NextResponse.json({error:{code:'INVALID_QUERY'}},{status:400,headers:MONTHLY_CYCLE_HEADERS});
  const s=await createClient(); const {data:claims,error:authError}=await s.auth.getClaims();
  if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:MONTHLY_CYCLE_HEADERS});
  const {data,error}=await s.schema('customer_api').rpc('list_monthly_cycles_v1' as never,{p_context_id:parsed.data.context_id,p_property_id:parsed.data.property_id??null} as never);
  if(error){const e=mapMonthlyCycleError(error);return NextResponse.json({error:{code:e.code}},{status:e.status,headers:MONTHLY_CYCLE_HEADERS});}
  return NextResponse.json(data,{headers:MONTHLY_CYCLE_HEADERS});
}

export async function POST(request: NextRequest) {
  if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'BAD_ORIGIN'}},{status:403,headers:MONTHLY_CYCLE_HEADERS});
  if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:MONTHLY_CYCLE_HEADERS});
  const {data:raw,errorResponse}=await parseJsonWithLimit<unknown>(request,12*1024);if(errorResponse)return errorResponse;
  const parsed=createMonthlyCycleSchema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:MONTHLY_CYCLE_HEADERS});
  const s=await createClient();const {data:claims,error:authError}=await s.auth.getClaims();if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:MONTHLY_CYCLE_HEADERS});
  const {data,error}=await s.schema('customer_api').rpc('create_monthly_cycle_v1' as never,{p_context_id:parsed.data.context_id,p_property_id:parsed.data.property_id,p_period_id:parsed.data.period_id,p_currency:parsed.data.currency} as never);
  if(error){const e=mapMonthlyCycleError(error);return NextResponse.json({error:{code:e.code}},{status:e.status,headers:MONTHLY_CYCLE_HEADERS});}
  return NextResponse.json(data,{status:201,headers:MONTHLY_CYCLE_HEADERS});
}
