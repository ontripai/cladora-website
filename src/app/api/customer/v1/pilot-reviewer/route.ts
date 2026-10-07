import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasTrustedMutationOrigin } from '@/lib/security/same-origin';

const headers={'Cache-Control':'no-store, private'};
const schema=z.object({workspace_id:z.string().uuid(),display_name:z.string().trim().min(2).max(120),locale:z.enum(['ro','en','fa'])});
export async function GET(){
 const supabase=await createClient();
 const {data,error}=await supabase.schema('customer_api').rpc('my_pilot_setup_reviewer_v1');
 return error?NextResponse.json({error:{code:'REVIEWER_STATE_UNAVAILABLE'}},{status:403,headers}):NextResponse.json({reviewer:data},{headers});
}
export async function POST(request:NextRequest){
 if(!hasTrustedMutationOrigin(request))return NextResponse.json({error:{code:'ORIGIN_REJECTED'}},{status:403,headers});
 const input=schema.safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:{code:'INVALID_PAYLOAD'}},{status:400,headers});
 const supabase=await createClient();
 const {data,error}=await supabase.schema('customer_api').rpc('claim_pilot_setup_reviewer_v1',{
   p_workspace_id:input.data.workspace_id,p_display_name:input.data.display_name,p_locale:input.data.locale,
 });
 return error?NextResponse.json({error:{code:'REVIEWER_ACTIVATION_FAILED'}},{status:403,headers}):NextResponse.json({reviewer:data},{headers});
}
