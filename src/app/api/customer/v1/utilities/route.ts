import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';

const HEADERS={'Cache-Control':'no-store, private',Pragma:'no-cache',Vary:'Cookie'};
const schema=z.object({context_id:z.string().uuid(),view:z.enum(['meters','readings','periods','contracts','invoices','comparisons','anomalies']).default('meters'),query:z.string().trim().max(120).optional(),status:z.string().trim().max(40).optional(),service:z.enum(['water','electricity','gas','heat','sewer','waste','internet','telephone','other']).optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),limit:z.coerce.number().int().min(1).max(100).default(25),offset:z.coerce.number().int().min(0).default(0),id:z.string().uuid().optional()});

export async function GET(request:NextRequest){
 const parsed=schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));if(!parsed.success)return NextResponse.json({error:{code:'INVALID_UTILITY_QUERY'}},{status:400,headers:HEADERS});
 const supabase=await createClient();const{data:claims,error}=await supabase.auth.getClaims();if(error||!claims?.claims?.sub)return NextResponse.json({error:{code:'UNAUTHORIZED'}},{status:401,headers:HEADERS});
 const p=parsed.data;
 // Customer API Gateway: delegates to utilities.get_customer_utilities
 const{data,error:queryError}=await supabase.schema('customer_api').rpc('get_utilities_v1',{p_context_id:p.context_id,p_view:p.view,p_query:p.query??null,p_status:p.status??null,p_service:p.service??null,p_from:p.from??null,p_to:p.to??null,p_limit:p.limit,p_offset:p.offset,p_id:p.id??null});
 if(queryError)return NextResponse.json({error:{code:queryError.code==='42501'?'UTILITY_ACCESS_DENIED':'UTILITY_QUERY_FAILED'}},{status:queryError.code==='42501'?403:500,headers:HEADERS});return NextResponse.json(data,{headers:HEADERS});
}
