import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createImportRunSchema } from "@/lib/customer/onboarding-import-schema";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
import { mapOnboardingError, ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";
export async function POST(request:NextRequest){
 if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:"BAD_ORIGIN"}},{status:403,headers:ONBOARDING_HEADERS});
 if(!isApplicationJson(request.headers.get("content-type")))return NextResponse.json({error:{code:"UNSUPPORTED_MEDIA_TYPE"}},{status:415,headers:ONBOARDING_HEADERS});
 const {data:bodyJson,errorResponse}=await parseJsonWithLimit<unknown>(request,16*1024);if(errorResponse)return errorResponse;
 const p=createImportRunSchema.safeParse(bodyJson);if(!p.success)return NextResponse.json({error:{code:"INVALID_REQUEST"}},{status:400,headers:ONBOARDING_HEADERS});
 const s=await createClient();const {data,error}=await s.schema("customer_api").rpc("create_import_run_v1" as never,{p_context_id:p.data.context_id,p_property_id:p.data.property_id??null,p_idempotency_key:p.data.idempotency_key} as never);
 if(error){const e=mapOnboardingError(error);return NextResponse.json({error:{code:e.code}},{status:e.status,headers:ONBOARDING_HEADERS});}return NextResponse.json(data,{status:201,headers:ONBOARDING_HEADERS});
}
