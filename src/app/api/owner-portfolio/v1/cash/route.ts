import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';
import { isApplicationJson, parseJsonWithLimit } from '@/lib/security/request-body';
const headers={'Cache-Control':'no-store, private',Vary:'Cookie'};
export async function PATCH(request:NextRequest){
  if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:'BAD_ORIGIN'},{status:403,headers});
  if(!isApplicationJson(request.headers.get('content-type')))return NextResponse.json({error:'UNSUPPORTED_MEDIA_TYPE'},{status:415,headers});
  const {data:raw,errorResponse}=await parseJsonWithLimit(request,2048);if(errorResponse)return errorResponse;
  const body=z.object({entry_id:z.uuid(),paid_on:z.iso.date()}).strict().safeParse(raw);
  if(!body.success)return NextResponse.json({error:'INVALID_REQUEST'},{status:400,headers});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(body.data.paid_on>today)return NextResponse.json({error:'FUTURE_PAYMENT_DATE'},{status:400,headers});
  const db=await createClient();const {data:claims,error}=await db.auth.getClaims();
  if(error||!claims?.claims?.sub)return NextResponse.json({error:'UNAUTHORIZED'},{status:401,headers});
  const access=await db.schema('customer_api').rpc('my_multi_unit_owner_access_v1' as never);
  if(access.error||access.data!==true)return NextResponse.json({error:'ACCESS_DENIED'},{status:403,headers});
  const result=await db.from('owner_private_cash_entries').update({paid_on:body.data.paid_on}).eq('id',body.data.entry_id).is('paid_on',null).select('id,paid_on').maybeSingle();
  if(result.error)return NextResponse.json({error:'PAYMENT_RECORD_FAILED'},{status:400,headers});
  if(!result.data)return NextResponse.json({error:'RECORD_NOT_FOUND_OR_ALREADY_PAID'},{status:409,headers});
  return NextResponse.json({entry:result.data},{headers});
}
