import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importContextSchema } from "@/lib/customer/onboarding-import-schema";
import { mapOnboardingError, ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";
export async function GET(request: NextRequest) {
  const parsed=importContextSchema.safeParse({context_id:request.nextUrl.searchParams.get("context_id")});
  if(!parsed.success) return NextResponse.json({error:{code:"INVALID_CONTEXT"}},{status:400,headers:ONBOARDING_HEADERS});
  const supabase=await createClient(); const {data,error}=await supabase.schema("customer_api").rpc("list_import_templates_v1" as never,{p_context_id:parsed.data.context_id} as never);
  if(error){const e=mapOnboardingError(error);return NextResponse.json({error:{code:e.code}},{status:e.status,headers:ONBOARDING_HEADERS});}
  return NextResponse.json(data,{headers:ONBOARDING_HEADERS});
}
