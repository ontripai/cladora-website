import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { generateBankMatchSuggestionsSchema, queryBankMatchingQueueSchema } from "@/lib/customer/payments-schema";
import { mapPaymentsRpcError } from "../route";

const HEADERS={"Cache-Control":"no-store, private",Pragma:"no-cache",Vary:"Cookie"};

export async function GET(request:NextRequest){
  const parsed=queryBankMatchingQueueSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({error:{code:"INVALID_MATCHING_QUERY"}},{status:400,headers:HEADERS});
  const supabase=await createClient();
  const {data:claims,error:authError}=await supabase.auth.getClaims();
  if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:"UNAUTHORIZED"}},{status:401,headers:HEADERS});
  const p=parsed.data;
  const {data,error}=await supabase.schema("customer_api").rpc("get_bank_matching_work_queue_v1",{
    p_context_id:p.context_id,p_bank_account_id:p.bank_account_id??null,p_status:p.status??null,p_limit:p.limit,p_offset:p.offset,
  });
  if(error){const mapped=mapPaymentsRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS});}
  return NextResponse.json(data,{headers:HEADERS});
}

export async function POST(request:NextRequest){
  if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:"UNTRUSTED_ORIGIN"}},{status:403,headers:HEADERS});
  if(!isApplicationJson(request.headers.get("content-type")))return NextResponse.json({error:{code:"UNSUPPORTED_MEDIA_TYPE"}},{status:415,headers:HEADERS});
  const {data:body,errorResponse}=await parseJsonWithLimit(request,16*1024);if(errorResponse)return errorResponse;
  const parsed=generateBankMatchSuggestionsSchema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:{code:"INVALID_MATCHING_PAYLOAD",details:parsed.error.format()}},{status:400,headers:HEADERS});
  const supabase=await createClient();const {data:claims,error:authError}=await supabase.auth.getClaims();
  if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:"UNAUTHORIZED"}},{status:401,headers:HEADERS});
  const p=parsed.data;const {data,error}=await supabase.schema("customer_api").rpc("generate_bank_match_suggestions_v1",{
    p_context_id:p.context_id,p_bank_account_id:p.bank_account_id,p_period_start:p.period_start,p_period_end:p.period_end,p_idempotency_key:p.idempotency_key,
  });
  if(error){const mapped=mapPaymentsRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS});}
  return NextResponse.json(data,{status:201,headers:HEADERS});
}
