import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson,parseJsonWithLimit } from "@/lib/security/request-body";
import { proposeBankExceptionResolutionSchema } from "@/lib/customer/payments-schema";
import { mapPaymentsRpcError } from "@/app/api/customer/v1/payments/route";
const HEADERS={"Cache-Control":"no-store, private",Pragma:"no-cache",Vary:"Cookie"};
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:"UNTRUSTED_ORIGIN"}},{status:403,headers:HEADERS});
  if(!isApplicationJson(request.headers.get("content-type")))return NextResponse.json({error:{code:"UNSUPPORTED_MEDIA_TYPE"}},{status:415,headers:HEADERS});
  const {id}=await params;const {data:body,errorResponse}=await parseJsonWithLimit(request,12*1024);if(errorResponse)return errorResponse;
  const parsed=proposeBankExceptionResolutionSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:{code:"INVALID_RESOLUTION_PAYLOAD",details:parsed.error.format()}},{status:400,headers:HEADERS});
  const supabase=await createClient();const {data:claims,error:authError}=await supabase.auth.getClaims();if(authError||!claims?.claims?.sub)return NextResponse.json({error:{code:"UNAUTHORIZED"}},{status:401,headers:HEADERS});
  const p=parsed.data;const {data,error}=await supabase.schema("customer_api").rpc("propose_bank_exception_resolution_v1",{p_context_id:p.context_id,p_exception_id:id,p_payment_id:p.payment_id??null,p_receivable_id:p.receivable_id??null,p_matched_amount:p.matched_amount??null,p_note:p.note});
  if(error){const mapped=mapPaymentsRpcError(error);return NextResponse.json(mapped.body,{status:mapped.status,headers:HEADERS});}return NextResponse.json(data,{status:201,headers:HEADERS});
}
