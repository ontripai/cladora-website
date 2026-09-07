import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
const HEADERS={ 'Cache-Control':'no-store, private', Pragma:'no-cache', Vary:'Cookie' };
export async function GET(){
  const supabase=await createClient(); const {data:claims,error}=await supabase.auth.getClaims();
  if(error||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});

  // Customer API Gateway: delegates to platform.list_my_customer_contexts
  const {data,error:queryError}=await supabase.schema('customer_api').rpc('list_contexts_v1');
  if(queryError)return NextResponse.json({error:{code:'CONTEXT_QUERY_FAILED'}},{status:500,headers:HEADERS});
  return NextResponse.json({contexts:data??[]},{headers:HEADERS});
}
