import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getApplicationOrigin } from '@/lib/supabase/server-env';

const headers={'Cache-Control':'no-store, private'};
const schema=z.object({workspace_id:z.string().uuid(),expected_version:z.number().int().positive(),reason:z.string().trim().min(10).max(500)});
export async function POST(request:NextRequest){
  if(request.headers.get('origin')!==getApplicationOrigin()) return NextResponse.json({error:{code:'ORIGIN_REJECTED'}},{status:403,headers});
  let input:z.infer<typeof schema>; try{input=schema.parse(await request.json());}catch{return NextResponse.json({error:{code:'INVALID_PAYLOAD'}},{status:400,headers});}
  const supabase=await createClient(); const {data:claims,error:claimsError}=await supabase.auth.getClaims();
  if(claimsError||!claims?.claims?.sub) return NextResponse.json({error:{code:'AUTHENTICATION_REQUIRED'}},{status:401,headers});
  const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(assurance?.currentLevel!=='aal2') return NextResponse.json({error:{code:'MFA_REQUIRED'}},{status:403,headers});
  const {data,error}=await supabase.schema('customer_api').rpc('complete_primary_admin_onboarding_v1',{p_workspace_id:input.workspace_id,p_expected_version:input.expected_version,p_reason:input.reason});
  if(error||!data) return NextResponse.json({error:{code:error?.message.includes('concurrency_conflict')?'CONCURRENCY_CONFLICT':'ONBOARDING_REJECTED'}},{status:error?.message.includes('concurrency_conflict')?409:403,headers});
  return NextResponse.json({completed:true},{status:200,headers});
}
