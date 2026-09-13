import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { monthlyCycleActionSchema, monthlyCycleParamsSchema } from '@/lib/customer/monthly-cycle-schema';
import { mapMonthlyCycleError, MONTHLY_CYCLE_HEADERS } from '@/lib/customer/monthly-cycle-api-helper';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';

const actions=['capture-source','submit','review','publish','close'] as const;
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;action:string}>}){
 if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'BAD_ORIGIN'}},{status:403,headers:MONTHLY_CYCLE_HEADERS});
 if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},{status:415,headers:MONTHLY_CYCLE_HEADERS});
 const rawParams=await params;const p=monthlyCycleParamsSchema.safeParse({id:rawParams.id});if(!p.success||!actions.includes(rawParams.action as typeof actions[number]))return NextResponse.json({error:{code:'INVALID_ACTION'}},{status:400,headers:MONTHLY_CYCLE_HEADERS});
 const {data:raw,errorResponse}=await parseJsonWithLimit<Record<string,unknown>>(request,12*1024);if(errorResponse)return errorResponse;
 const body=monthlyCycleActionSchema.safeParse({...raw,action:rawParams.action});if(!body.success)return NextResponse.json({error:{code:'INVALID_REQUEST'}},{status:400,headers:MONTHLY_CYCLE_HEADERS});
 const s=await createClient();const {data:claims,error:authError}=await s.auth.getClaims();if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:MONTHLY_CYCLE_HEADERS});
 let rpc:string;let args:Record<string,unknown>;
 switch(body.data.action){
  case 'capture-source':rpc='capture_monthly_cycle_source_v1';args={p_context_id:body.data.context_id,p_cycle_id:p.data.id,p_source_type:body.data.source_type,p_source_id:body.data.source_id};break;
  case 'submit':rpc='submit_monthly_cycle_v1';args={p_context_id:body.data.context_id,p_cycle_id:p.data.id,p_allocation_run_id:body.data.allocation_run_id};break;
  case 'review':rpc='review_monthly_cycle_v1';args={p_context_id:body.data.context_id,p_cycle_id:p.data.id,p_decision:body.data.decision,p_note:body.data.note??null};break;
  case 'publish':rpc='publish_monthly_cycle_v1';args={p_context_id:body.data.context_id,p_cycle_id:p.data.id};break;
  case 'close':rpc='close_monthly_cycle_v1';args={p_context_id:body.data.context_id,p_cycle_id:p.data.id,p_reason:body.data.reason};break;
 }
 const {data,error}=await s.schema('customer_api').rpc(rpc as never,args as never);if(error){const e=mapMonthlyCycleError(error);return NextResponse.json({error:{code:e.code}},{status:e.status,headers:MONTHLY_CYCLE_HEADERS});}
 return NextResponse.json(data,{headers:MONTHLY_CYCLE_HEADERS});
}
