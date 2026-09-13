import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importContextSchema } from "@/lib/customer/onboarding-import-schema";
import { mapOnboardingError, ONBOARDING_HEADERS } from "@/lib/customer/onboarding-import-helper";

const codePattern=/^[a-z][a-z0-9_]{2,63}$/;
function csvCell(value:string){return `"${value.replaceAll('"','""')}"`;}

export async function GET(request:NextRequest,{params}:{params:Promise<{code:string}>}){
  const {code}=await params;
  const parsed=importContextSchema.safeParse({context_id:request.nextUrl.searchParams.get("context_id")});
  if(!parsed.success||!codePattern.test(code))return NextResponse.json({error:{code:"INVALID_TEMPLATE"}},{status:400,headers:ONBOARDING_HEADERS});
  const supabase=await createClient();
  const {data,error}=await supabase.schema("customer_api").rpc("list_import_templates_v1" as never,{p_context_id:parsed.data.context_id} as never);
  if(error){const e=mapOnboardingError(error);return NextResponse.json({error:{code:e.code}},{status:e.status,headers:ONBOARDING_HEADERS});}
  const templates=Array.isArray(data)?data:[];
  const template=templates.find((item:unknown)=>typeof item==="object"&&item!==null&&(item as {code?:unknown}).code===code) as {schema?:{headers?:unknown}}|undefined;
  const headers=template?.schema?.headers;
  if(!Array.isArray(headers)||!headers.every((h):h is string=>typeof h==="string"))return NextResponse.json({error:{code:"TEMPLATE_NOT_FOUND"}},{status:404,headers:ONBOARDING_HEADERS});
  const csv=`\uFEFF${headers.map(csvCell).join(",")}\r\n`;
  return new NextResponse(csv,{status:200,headers:{...ONBOARDING_HEADERS,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="cladora-${code}.csv"`,"X-Content-Type-Options":"nosniff"}});
}
