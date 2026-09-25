import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { createClient } from '@/lib/supabase/server';

const HEADERS={'Cache-Control':'no-store, private', Vary:'Cookie'};
export async function POST(request:Request){
  if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'UNTRUSTED_ORIGIN'}},{status:403,headers:HEADERS});
  const parsed=z.object({case_id:z.uuid()}).safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:{code:'INVALID_INPUT'}},{status:400,headers:HEADERS});
  const db=await createClient();const {data,error}=await db.schema('customer_api').rpc('mark_customer_case_read_v1',{p_case_id:parsed.data.case_id});
  if(error)return NextResponse.json({error:{code:'FORBIDDEN'}},{status:403,headers:HEADERS});
  return NextResponse.json({marked:data},{headers:HEADERS});
}
