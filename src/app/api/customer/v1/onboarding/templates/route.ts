import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { configureImportTemplateSchema, importContextSchema } from "@/lib/customer/onboarding-import-schema";
import { mapOnboardingError, ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";
import { hasTrustedMutationOrigin } from "@/lib/security/same-origin";
import { isApplicationJson, parseJsonWithLimit } from "@/lib/security/request-body";
export async function GET(request: NextRequest) {
  const parsed=importContextSchema.safeParse({context_id:request.nextUrl.searchParams.get("context_id")});
  if(!parsed.success) return NextResponse.json({error:{code:"INVALID_CONTEXT"}},{status:400,headers:ONBOARDING_HEADERS});
  const supabase=await createClient(); const {data,error}=await supabase.schema("customer_api").rpc("list_import_templates_v1" as never,{p_context_id:parsed.data.context_id} as never);
  if(error){const e=mapOnboardingError(error);return NextResponse.json({error:{code:e.code}},{status:e.status,headers:ONBOARDING_HEADERS});}
  return NextResponse.json(data,{headers:ONBOARDING_HEADERS});
}

export async function POST(request: NextRequest) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({error:{code:"BAD_ORIGIN"}},{status:403,headers:ONBOARDING_HEADERS});
  if (!isApplicationJson(request.headers.get("content-type"))) return NextResponse.json({error:{code:"UNSUPPORTED_MEDIA_TYPE"}},{status:415,headers:ONBOARDING_HEADERS});
  const {data:bodyJson,errorResponse}=await parseJsonWithLimit<unknown>(request,32*1024); if(errorResponse)return errorResponse;
  const parsed=configureImportTemplateSchema.safeParse(bodyJson);
  if(!parsed.success)return NextResponse.json({error:{code:"INVALID_TEMPLATE"}},{status:400,headers:ONBOARDING_HEADERS});
  const supabase=await createClient();
  const {data,error}=await supabase.schema("customer_api").rpc("configure_import_template_v1" as never,{
    p_context_id:parsed.data.context_id,p_code:parsed.data.code,p_name:parsed.data.name,p_description:parsed.data.description??null,
    p_dependency_order:parsed.data.dependency_order,p_schema:parsed.data.schema,p_max_rows:parsed.data.max_rows,
  } as never);
  if(error){const e=mapOnboardingError(error);return NextResponse.json({error:{code:e.code}},{status:e.status,headers:ONBOARDING_HEADERS});}
  return NextResponse.json(data,{status:201,headers:ONBOARDING_HEADERS});
}
