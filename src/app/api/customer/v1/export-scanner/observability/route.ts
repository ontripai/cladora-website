import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';
const H={'Cache-Control':'no-store, private',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'};
const Q=z.object({context_id:z.string().uuid(),limit:z.coerce.number().int().min(1).max(100).default(25)});

export async function GET(request:NextRequest){
  const q=Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if(!q.success)return NextResponse.json({error:{code:'INVALID_SCANNER_OBSERVABILITY_QUERY'}},{status:400,headers:H});
  const supabase=await createClient();
  const {data:claims,error:claimsError}=await supabase.auth.getClaims();
  if(claimsError||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:H});
  const {data,error}=await supabase.schema('customer_api').rpc('get_export_scanner_observability_v1' as never,{p_context_id:q.data.context_id,p_limit:q.data.limit} as never);
  if(error)return NextResponse.json({error:{code:error.code==='42501'?'SCANNER_OBSERVABILITY_ACCESS_DENIED':'SCANNER_OBSERVABILITY_FAILED'}},{status:error.code==='42501'?403:500,headers:H});
  return NextResponse.json(data,{headers:H});
}
