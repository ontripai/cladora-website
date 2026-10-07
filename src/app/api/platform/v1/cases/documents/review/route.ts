import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlatformAuthContext, hasPlatformAal2, hasPlatformRole } from '@/lib/platform/auth';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS={'Cache-Control':'no-store, private',Vary:'Cookie'};
export async function POST(request:Request){
  const auth=await getPlatformAuthContext();
  if(!hasPlatformAal2(auth)||!hasPlatformRole(auth,['PLATFORM_SUPER_ADMIN','PLATFORM_AUDITOR']))return NextResponse.json({error:{code:'FORBIDDEN'}},{status:403,headers:HEADERS});
  if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'UNTRUSTED_ORIGIN'}},{status:403,headers:HEADERS});
  const parsed=z.object({version_id:z.uuid(),verdict:z.enum(['clean','quarantined']),evidence:z.string().trim().min(15).max(1000)}).safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:{code:'INVALID_INPUT'}},{status:400,headers:HEADERS});
  const db=await createClient();
  const {data,error}=await db.schema('customer_api').rpc('review_customer_case_document_v1',{p_version_id:parsed.data.version_id,p_verdict:parsed.data.verdict,p_evidence:parsed.data.evidence});
  if(error)return NextResponse.json({error:{code:'INDEPENDENT_REVIEW_REQUIRED'}},{status:403,headers:HEADERS});
  return NextResponse.json({review:data},{headers:HEADERS});
}
